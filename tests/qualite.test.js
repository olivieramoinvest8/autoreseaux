#!/usr/bin/env node
/**
 * tests/qualite.test.js — Essais des corrections du 12 novembre 2026 (voir docs/audit-2026-11-12.md).
 *
 *   npm run test:qualite
 *
 * Rien ne sort de la machine : Meta et Supabase sont remplacés par des doublures qui notent ce qu'on leur demande.
 * On vérifie : 1) un carrousel part en entier (album Facebook, carrousel Instagram) et la story suit ; 2) la mesure
 * survit aux noms de mesures retirés par Meta ; 3) les retours d'Olivier (refus, part gardée) et la variété sont
 * bien calculés ; 4) la mémoire de la routine dit quels biens sont présentables et quels événements annoncer ;
 * 5) un refus enregistre son motif.
 */
const assert = require("assert");
const path = require("path");

const LIB = path.resolve(__dirname, "../netlify/functions/_lib");
let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { console.error(`ÉCHEC  ${name}\n       ${e.stack || e.message}`); process.exitCode = 1; }
}

// ---------- Doublure de Supabase : tables en mémoire, requêtes chaînées ----------
function fakeDb(tables) {
  const from = (table) => {
    const st = { filters: [], op: "select", patch: null };
    const run = async () => {
      const rows = (tables[table] || (tables[table] = [])).filter((r) => st.filters.every((f) => f(r)));
      if (st.op === "update") rows.forEach((r) => Object.assign(r, st.patch));
      if (st.op === "insert" || st.op === "upsert") { const add = [].concat(st.patch); tables[table].push(...add); return { data: add, error: null }; }
      return { data: rows, error: null };
    };
    const api = {
      select: () => api, order: () => api, limit: () => api, gte: () => api, lte: () => api, or: () => api, not: () => api, ilike: () => api,
      eq: (k, v) => { st.filters.push((r) => r[k] === v); return api; },
      in: (k, vs) => { st.filters.push((r) => vs.includes(r[k])); return api; },
      is: (k, v) => { st.filters.push((r) => (r[k] ?? null) === v); return api; },
      update: (p) => { st.op = "update"; st.patch = p; return api; },
      insert: (p) => { st.op = "insert"; st.patch = p; return api; },
      upsert: (p) => { st.op = "upsert"; st.patch = p; return api; },
      maybeSingle: () => run().then((r) => ({ data: r.data[0] || null, error: null })),
      single: () => run().then((r) => ({ data: r.data[0] || null, error: null })),
      then: (res, rej) => run().then(res, rej),
    };
    return api;
  };
  return { from };
}
const events = [];
let db = fakeDb({});
const supaPath = require.resolve(path.join(LIB, "supabase.js"));
require.cache[supaPath] = { id: supaPath, filename: supaPath, loaded: true, exports: { supabase: () => db, logEvent: async (source, level, message, data, postId) => { events.push({ level, message, postId }); } } };

// ---------- Doublure de Meta : note chaque appel, répond comme l'API Graph ----------
process.env.META_PAGE_ID = "PAGE"; process.env.META_PAGE_TOKEN = "jeton-de-test"; process.env.META_IG_USER_ID = "IG";
process.env.DASHBOARD_PASSWORD = "mot-de-passe-de-test";
let calls = []; let graphReply = () => null; let seq = 0;
global.fetch = async (url, opts = {}) => {
  const u = new URL(url); const method = opts.method || "GET";
  const params = Object.fromEntries(method === "GET" ? u.searchParams : new URLSearchParams(String(opts.body || "")));
  const p = u.pathname.replace(/^\/v[\d.]+/, "");
  delete params.access_token;
  calls.push({ method, path: p, params });
  let body = graphReply({ method, path: p, params });
  if (body === null || body === undefined) {
    if (p === "/me") body = { id: "PAGE", name: "AMO Invest" };
    else if (p === "/PAGE/photos") body = { id: `photo${++seq}`, post_id: `PAGE_${seq}` };
    else if (p === "/PAGE/feed") body = { id: "PAGE_album" };
    else if (p === "/PAGE/photo_stories") body = { success: true, post_id: "story_fb" };
    else if (p === "/IG/media") body = { id: `conteneur${++seq}` };
    else if (p === "/IG/media_publish") body = { id: `ig_${params.creation_id}` };
    else if (/^\/conteneur\d+$/.test(p)) body = { status_code: "FINISHED" };
    else body = {};
  }
  return { ok: !body.error, status: body.error ? 400 : 200, json: async () => body };
};

const meta = require(path.join(LIB, "publish/meta.js"));
const metrics = require(path.join(LIB, "metrics.js"));
const { feedback, variety, formatFamily } = require(path.join(LIB, "feedback.js"));

const slide = (n) => ({ url: `https://x.supabase.co/visuels/vente-471-${n}.jpg`, kind: "slide" });
const carousel = { id: "p1", type: "image", media_url: "https://x.supabase.co/visuels/vente-471-1.jpg", extra_media: [slide(2), slide(3), slide(4), slide(5)], text_fb: "Texte Facebook", text_ig: "Texte Instagram", hashtags: ["Graveson"] };

(async () => {
  console.log("Publication");
  await test("le plan des médias sépare les slides et la story", () => {
    const plan = meta.mediaPlan({ type: "image", media_url: "a-feed.jpg", extra_media: [{ url: "https://x/loc-334-story.jpg", kind: "slide" }] });
    assert.deepStrictEqual(plan.images, ["a-feed.jpg"]); assert.strictEqual(plan.story, "https://x/loc-334-story.jpg"); assert.strictEqual(plan.isCarousel, false);
    const p2 = meta.mediaPlan({ ...carousel, extra_media: [...carousel.extra_media, { url: "https://x/s.jpg", kind: "story" }] });
    assert.strictEqual(p2.images.length, 5); assert.strictEqual(p2.story, "https://x/s.jpg"); assert.strictEqual(p2.isCarousel, true);
    assert.strictEqual(meta.mediaPlan({ type: "video", media_url: "v.mp4", extra_media: [slide(2)] }).images.length, 0);
  });
  await test("Facebook : un carrousel part en album de 5 photos, dans l'ordre", async () => {
    calls = [];
    const r = await meta.publishFacebook(carousel);
    const photos = calls.filter((c) => c.path === "/PAGE/photos");
    assert.strictEqual(photos.length, 5); assert.ok(photos.every((c) => c.params.published === "false" && !c.params.message));
    assert.deepStrictEqual(photos.map((c) => c.params.url), [carousel.media_url, ...carousel.extra_media.map((e) => e.url)]);
    const feed = calls.find((c) => c.path === "/PAGE/feed");
    assert.strictEqual(feed.params.message, "Texte Facebook");
    assert.strictEqual(Object.keys(feed.params).filter((k) => k.startsWith("attached_media[")).length, 5);
    assert.ok(JSON.parse(feed.params["attached_media[0]"]).media_fbid);
    assert.deepStrictEqual({ id: r.id, kind: r.kind, images: r.images }, { id: "PAGE_album", kind: "album", images: 5 });
  });
  await test("Facebook : une image seule part comme avant", async () => {
    calls = [];
    const r = await meta.publishFacebook({ type: "image", media_url: "https://x/a.jpg", extra_media: [], text_fb: "Bonjour" });
    const photos = calls.filter((c) => c.path === "/PAGE/photos");
    assert.strictEqual(photos.length, 1); assert.strictEqual(photos[0].params.message, "Bonjour"); assert.strictEqual(r.kind, "photo");
    assert.ok(!calls.some((c) => c.path === "/PAGE/feed"));
  });
  await test("Instagram : un carrousel = 5 conteneurs enfants, 1 conteneur CAROUSEL, 1 publication", async () => {
    calls = [];
    const r = await meta.publishInstagram(carousel);
    const created = calls.filter((c) => c.path === "/IG/media" && c.method === "POST");
    const children = created.filter((c) => c.params.is_carousel_item === "true");
    const parent = created.find((c) => c.params.media_type === "CAROUSEL");
    assert.strictEqual(children.length, 5); assert.ok(children.every((c) => !c.params.caption));
    assert.strictEqual(parent.params.children.split(",").length, 5);
    assert.ok(parent.params.caption.startsWith("Texte Instagram") && parent.params.caption.includes("#Graveson"));
    assert.strictEqual(calls.filter((c) => c.path === "/IG/media_publish").length, 1);
    assert.strictEqual(r.kind, "carousel");
  });
  await test("publication complète : statut publié, story sur les deux réseaux, décochable", async () => {
    const post = { ...carousel, id: "p9", status: "approved", networks: ["facebook", "instagram"], external_ids: {}, features: {}, brand: { networks: ["facebook", "instagram"] }, extra_media: [...carousel.extra_media, { url: "https://x/vente-471-story.jpg", kind: "story" }] };
    db = fakeDb({ posts: [post] }); calls = []; events.length = 0;
    const { publishPost } = require(path.join(LIB, "publish/index.js"));
    await publishPost("p9");
    assert.strictEqual(post.status, "published");
    assert.ok(post.external_ids.facebook && post.external_ids.instagram && post.external_ids.facebook_story && post.external_ids.instagram_story);
    assert.ok(calls.some((c) => c.path === "/IG/media" && c.params.media_type === "STORIES" && c.params.image_url.endsWith("story.jpg")));
    assert.ok(calls.some((c) => c.path === "/PAGE/photo_stories"));
    const post2 = { ...post, id: "p10", status: "approved", external_ids: {}, features: { sans_story: true } };
    db = fakeDb({ posts: [post2] }); calls = [];
    await publishPost("p10");
    assert.strictEqual(post2.status, "published"); assert.ok(!post2.external_ids.instagram_story && !calls.some((c) => c.params.media_type === "STORIES"));
  });
  await test("une story refusée par Meta ne fait pas échouer le post", async () => {
    const post = { ...carousel, id: "p11", status: "approved", networks: ["facebook", "instagram"], external_ids: {}, features: {}, brand: { networks: [] }, extra_media: [{ url: "https://x/a-story.jpg", kind: "story" }] };
    db = fakeDb({ posts: [post] }); events.length = 0;
    graphReply = ({ path: p, params }) => (p === "/PAGE/photo_stories" || params.media_type === "STORIES" ? { error: { message: "(#200) story refusée" } } : null);
    const { publishPost } = require(path.join(LIB, "publish/index.js"));
    await publishPost("p11"); graphReply = () => null;
    assert.strictEqual(post.status, "published"); assert.strictEqual(post.error, null);
    assert.strictEqual(events.filter((e) => e.level === "warn" && /Story non publiée/.test(e.message)).length, 2);
  });

  console.log("Mesure");
  await test("Facebook : les noms retirés par Meta ne bloquent plus la portée", async () => {
    const valid = { post_total_media_view_unique: 321, post_media_view: 400, post_clicks: 12 };
    graphReply = ({ path: p, params }) => {
      if (p === "/PAGE_1") return { likes: { summary: { total_count: 4 } }, comments: { summary: { total_count: 1 } }, shares: { count: 2 } };
      if (p === "/PAGE_1/insights") {
        const names = params.metric.split(",");
        if (names.some((n) => !(n in valid))) return { error: { message: "(#100) The value must be a valid insights metric" } };
        return { data: names.map((n) => ({ name: n, values: [{ value: valid[n] }] })) };
      }
      return null;
    };
    calls = [];
    const rows = await metrics.collectPost({ type: "image", external_ids: { facebook: "PAGE_1" } });
    assert.deepStrictEqual({ reach: rows[0].reach, views: rows[0].views, clicks: rows[0].clicks, likes: rows[0].likes, shares: rows[0].shares }, { reach: 321, views: 400, clicks: 12, likes: 4, shares: 2 });
    // Au post suivant, les noms inconnus ne sont plus redemandés : un seul appel de mesures.
    calls = [];
    await metrics.collectPost({ type: "image", external_ids: { facebook: "PAGE_1" } });
    const ins = calls.filter((c) => c.path === "/PAGE_1/insights");
    assert.strictEqual(ins.length, 1); assert.strictEqual(ins[0].params.metric, "post_total_media_view_unique,post_media_view,post_clicks");
    graphReply = () => null;
  });
  await test("Instagram : sans le droit « insights », on garde les j'aime et on note la cause, sans insister", async () => {
    graphReply = ({ path: p }) => (p === "/IGM" ? { like_count: 3, comments_count: 1, media_type: "IMAGE", media_product_type: "FEED" } : p === "/IGM/insights" ? { error: { message: "(#10) Application does not have permission for this action" } } : null);
    calls = [];
    const rows = await metrics.collectPost({ type: "image", external_ids: { instagram: "IGM" } });
    assert.strictEqual(rows[0].likes, 3); assert.strictEqual(rows[0].reach, null); assert.ok(/#10/.test(rows[0].raw.insights_error));
    assert.strictEqual(calls.filter((c) => c.path === "/IGM/insights").length, 1);
    graphReply = ({ path: p }) => (p === "/IGM" ? { like_count: 3, comments_count: 1, media_product_type: "FEED" } : p === "/IGM/insights" ? { data: [{ name: "reach", values: [{ value: 250 }] }, { name: "saved", values: [{ value: 2 }] }, { name: "views", total_value: { value: 300 } }] } : null);
    const ok = (await metrics.collectPost({ type: "image", external_ids: { instagram: "IGM" } }))[0];
    assert.deepStrictEqual({ reach: ok.reach, saves: ok.saves, views: ok.views }, { reach: 250, saves: 2, views: 300 });
    graphReply = () => null;
  });
  await test("bilan : classé par personnes touchées, groupes trop petits signalés", () => {
    const posts = [1, 2, 3, 4, 5, 6].map((i) => ({ id: `a${i}`, type: i <= 5 ? "image" : "video", segment: "acheteurs", features: { format: i <= 5 ? "carrousel 5 slides" : "vidéo photos animées, portrait" }, published_at: "2026-11-10T10:10:00Z" }));
    const rows = posts.map((p, i) => ({ post_id: p.id, network: "facebook", measured_at: "2026-11-11T04:00:00Z", likes: 2, comments: 0, shares: 1, saves: null, views: 100, raw: { reach: i === 5 ? 2000 : 400 } }));
    const b = metrics.summarize(posts, rows);
    assert.strictEqual(b.portee_mesuree, true);
    assert.deepStrictEqual(b.par_format.map((g) => [g.cle, g.posts, g.reach_moyen, g.fiable]), [["vidéo photos du bien", 1, 2000, false], ["carrousel annonce", 5, 400, true]]);
    assert.strictEqual(b.par_format[1].taux_engagement, 0.8);
    assert.strictEqual(b.par_heure[0].cle, "11 h");
    assert.strictEqual(metrics.summarize(posts, rows.map((r) => ({ ...r, raw: {} }))).portee_mesuree, false);
  });

  console.log("Retours et variété");
  const hist = [
    { id: "1", created_at: "2026-11-12T06:00:00Z", status: "rejected", type: "video", segment: "bailleurs", theme: "annonce : maison Mallemort", features: { format: "vidéo photos animées, portrait 9:16" }, listing_id: "L547", reject_category: "photos", reject_reason: "pas la bonne maison" },
    { id: "2", created_at: "2026-11-11T06:00:00Z", status: "published", type: "image", segment: "acheteurs", theme: "actualité acheteurs : DPE 2027", features: { format: "pédagogie premium (objet 3D)" } },
    { id: "3", created_at: "2026-11-10T06:00:00Z", status: "rejected", type: "image", segment: "vendeurs", theme: "actualité vendeurs : estimer", features: { format: "pédagogie premium (objet 3D)" }, error: "thème pas top" },
    { id: "4", created_at: "2026-11-09T06:00:00Z", status: "published", type: "image", segment: "vendeurs", theme: "annonce : local Graveson", features: { format: "carrousel 5 slides" }, listing_id: "L501" },
    { id: "5", created_at: "2026-11-08T06:00:00Z", status: "rejected", type: "image", segment: "bailleurs", theme: "conseil bailleurs", features: { format: "post-feed (photo-voilée)" } },
    { id: "6", created_at: "2026-11-07T06:00:00Z", status: "draft", type: "image", segment: "bailleurs", theme: "en attente", features: {} },
  ];
  await test("les refus arrivent avec leur motif, les anciens gardent leur phrase", () => {
    const f = feedback(hist);
    assert.strictEqual(f.periode_posts, 5); assert.strictEqual(f.part_gardee_globale, 40);
    assert.deepStrictEqual(f.derniers_refus[0], { date: "2026-11-12", theme: "annonce : maison Mallemort", type: "video", format: "vidéo photos du bien", motif: "Photos (mauvaise photo, pas le bon bien)", precision: "pas la bonne maison" });
    assert.strictEqual(f.derniers_refus[1].precision, "thème pas top");
    assert.deepStrictEqual(f.motifs_de_refus.map((m) => [m.cle, m.refus]).sort(), [["autre", 1], ["photos", 1], ["sans raison", 1]]);
    assert.deepStrictEqual(f.par_format.find((g) => g.cle === "pédagogie objet 3D"), { cle: "pédagogie objet 3D", proposes: 2, gardes: 1, refuses: 1, part_gardee: 50 });
  });
  await test("variété : les visuels vus récemment sont à laisser reposer", () => {
    const v = variety(hist);
    assert.ok(v.a_laisser_reposer.includes("pédagogie objet 3D") && v.a_laisser_reposer.includes("photo et texte"));
    assert.ok(!v.a_laisser_reposer.includes("carrousel annonce"));
    assert.strictEqual(formatFamily("carrousel conseil 4 slides"), "carrousel conseil");
  });

  console.log("Mémoire de la routine et tableau de bord");
  const now = Date.now(); const daysAgo = (d) => new Date(now - d * 86400000).toISOString();
  const listing = (id, o = {}) => ({ id, external_id: id.slice(1), reference: `R${id.slice(1)}`, kind: "vente", title: `Bien ${id}`, property_type: "maison", city: "Graveson", price: 300000, fees_note: "Honoraires TTC inclus", surface_m2: 100, rooms: 4, dpe: null, ges: null, dpe_note: "DPE vierge", photos: ["https://x/1.jpg"], status: "disponible", manual_status: null, manual_status_at: null, url: `https://www.amoinvest.fr/vente/1-graveson/maison/${id.slice(1)}-x`, first_seen_at: daysAgo(60), changed_at: daysAgo(60), raw: { description: "Belle maison.", features: ["Jardin"] }, ...o });
  const tables = () => ({
    tokens: [{ network: "internal", account_id: "bot", brand_id: null, data: { secret: "s".repeat(32) } }],
    brands: [{ id: "B", slug: "amo-invest", name: "AMO Invest", networks: ["facebook", "instagram"], settings: { google_url: "https://g.page/r/exemple" } }],
    listings: [listing("L1"), listing("L2"), listing("L3", { first_seen_at: daysAgo(2) }), listing("L4", { manual_status: "vendu", manual_status_at: daysAgo(1) }), listing("L5", { manual_status: "ne_plus_proposer" }), listing("L6", { status: "retire", manual_status: "loue", manual_status_at: daysAgo(3) }), listing("L7", { price: 280000, raw: { prix_precedent: 300000, prix_change_le: daysAgo(2) } })],
    posts: [
      { id: "a", brand_id: "B", listing_id: "L1", status: "published", created_at: daysAgo(10), published_at: daysAgo(10), type: "image", theme: "annonce", features: { format: "carrousel 5 slides" } },
      { id: "b", brand_id: "B", listing_id: "L2", status: "rejected", created_at: daysAgo(20), type: "image", theme: "annonce", features: {}, reject_category: "photos", reject_reason: "sombre" },
      { id: "c", brand_id: "B", listing_id: "L6", status: "published", created_at: daysAgo(1), published_at: daysAgo(1), type: "image", theme: "loué", features: { evenement: "loue" } },
    ],
    inbox: [], metrics: [], account_stats: [{ brand_id: "B", network: "facebook", day: daysAgo(0).slice(0, 10), followers: 1290 }, { brand_id: "B", network: "facebook", day: daysAgo(8).slice(0, 10), followers: 1284 }],
  });
  const call = async (file, event) => JSON.parse((await require(path.resolve(__dirname, "../netlify/functions", file)).handler(event)).body);
  await test("mémoire : biens présentables, événements à annoncer, abonnés, lien Google", async () => {
    db = fakeDb(tables());
    const r = await call("bot-recent.js", { httpMethod: "POST", headers: { "x-bot-secret": "s".repeat(32) }, body: JSON.stringify({ brand: "amo-invest" }) });
    const by = Object.fromEntries(r.biens.map((x) => [x.id, x]));
    assert.strictEqual(by.L1.presentable, false); assert.ok(/déjà proposé/.test(by.L1.pourquoi_non));
    assert.strictEqual(by.L2.presentable, true); assert.strictEqual(by.L2.derniere_proposition.motif_refus, "photos"); // refusé il y a 20 jours : de nouveau possible
    assert.strictEqual(by.L3.presentable, true); assert.strictEqual(by.L3.nouveau, true);
    assert.strictEqual(by.L4.presentable, false); assert.strictEqual(by.L5.presentable, false);
    assert.strictEqual(by.L7.baisse_de_prix_recente, true);
    assert.strictEqual(by.L1.reference, "R1"); assert.strictEqual(by.L1.dpe_mention, "DPE vierge");
    assert.ok(!by.L6, "un bien retiré du site n'est plus dans la liste des annonces");
    assert.deepStrictEqual(r.evenements.map((e) => [e.id, e.evenement]), [["L4", "vendu"]]); // L6 « loué » a déjà eu son post
    assert.deepStrictEqual(r.comptes.facebook, { abonnes: 1290, releve_le: daysAgo(0).slice(0, 10), evolution_7_jours: 6, evolution_30_jours: null });
    assert.strictEqual(r.brand.google_url, "https://g.page/r/exemple");
    assert.strictEqual(r.posts.find((p) => p.id === "b").refus.motif, "photos");
    assert.ok(r.retours && r.variete && r.bilan && Array.isArray(r.listings));
  });
  await test("mémoire : détail d'un bien par sa référence ; secret obligatoire", async () => {
    db = fakeDb(tables());
    const r = await call("bot-recent.js", { httpMethod: "POST", headers: { "x-bot-secret": "s".repeat(32) }, body: JSON.stringify({ brand: "amo-invest", bien: "R3" }) });
    assert.strictEqual(r.bien.description, "Belle maison."); assert.deepStrictEqual(r.bien.caracteristiques, ["Jardin"]);
    const denied = await require(path.resolve(__dirname, "../netlify/functions/bot-recent.js")).handler({ httpMethod: "POST", headers: { "x-bot-secret": "faux" }, body: "{}" });
    assert.strictEqual(denied.statusCode, 401);
  });
  await test("refus : motif obligatoire, enregistré ; « bien vendu » retire le bien des propositions", async () => {
    const t = tables(); t.posts.push({ id: "d", brand_id: "B", listing_id: "L3", status: "draft", features: {} }); db = fakeDb(t); events.length = 0;
    const ev = (body) => ({ httpMethod: "POST", headers: { "x-dashboard-key": "mot-de-passe-de-test" }, body: JSON.stringify(body) });
    const h = require(path.resolve(__dirname, "../netlify/functions/post-action.js")).handler;
    assert.strictEqual((await h(ev({ id: "d", action: "reject" }))).statusCode, 400);
    assert.strictEqual((await h(ev({ id: "d", action: "reject", category: "bien_indisponible", reason: "vendue hier" }))).statusCode, 200);
    const p = t.posts.find((x) => x.id === "d");
    assert.deepStrictEqual([p.status, p.reject_category, p.reject_reason], ["rejected", "bien_indisponible", "vendue hier"]);
    assert.strictEqual(t.listings.find((l) => l.id === "L3").manual_status, "ne_plus_proposer");
  });
  await test("modifications : seuls les vrais changements sont notés ; un réseau peut être décoché", async () => {
    const t = tables(); t.posts.push({ id: "e", brand_id: "B", status: "draft", text_fb: "Bonjour", text_ig: null, hashtags: ["Graveson"], networks: [], features: {}, brand: { networks: ["facebook", "instagram"] } }); db = fakeDb(t); events.length = 0;
    const ev = (body) => ({ httpMethod: "POST", headers: { "x-dashboard-key": "mot-de-passe-de-test" }, body: JSON.stringify(body) });
    const h = require(path.resolve(__dirname, "../netlify/functions/post-action.js")).handler;
    const same = JSON.parse((await h(ev({ id: "e", action: "update", text_fb: "Bonjour", text_ig: "", hashtags: ["#Graveson"], networks: ["facebook", "instagram"], sans_story: false }))).body);
    assert.deepStrictEqual(same.changed, []); assert.strictEqual(events.length, 0);
    const diff = JSON.parse((await h(ev({ id: "e", action: "update", text_fb: "Bonjour à tous", networks: ["facebook"], sans_story: true }))).body);
    assert.deepStrictEqual(diff.changed.sort(), ["features", "networks", "text_fb"]);
    const p = t.posts.find((x) => x.id === "e");
    assert.deepStrictEqual([p.networks, p.features.sans_story], [["facebook"], true]);
    assert.strictEqual((await h(ev({ id: "e", action: "update", networks: [] }))).statusCode, 400);
  });
  await test("annonces : l'état posé par Olivier est enregistré, un état inconnu est refusé", async () => {
    const t = tables(); db = fakeDb(t);
    const h = require(path.resolve(__dirname, "../netlify/functions/api-listings.js")).handler;
    const ev = (body) => ({ httpMethod: "POST", headers: { "x-dashboard-key": "mot-de-passe-de-test" }, body: JSON.stringify(body) });
    assert.strictEqual((await h(ev({ id: "L1", etat: "sous_offre" }))).statusCode, 200);
    assert.strictEqual(t.listings[0].manual_status, "sous_offre"); assert.ok(t.listings[0].manual_status_at);
    assert.strictEqual((await h(ev({ id: "L1", etat: "brade" }))).statusCode, 400);
    assert.strictEqual((await h(ev({ id: "L1", etat: null }))).statusCode, 200); assert.strictEqual(t.listings[0].manual_status, null);
    assert.strictEqual((await h({ httpMethod: "POST", headers: {}, body: "{}" })).statusCode, 401);
  });

  console.log("Lecture du site");
  await test("« modifié » = prix ou état ; une photo en plus ne fait pas d'un ancien bien une nouveauté", async () => {
    const { syncListings } = require(path.join(LIB, "listings.js"));
    const item = (id, o = {}) => ({ source: "site", external_id: id, reference: "R" + id, title: "Bien " + id, price: 300000, status: "disponible", photos: ["a", "b"], raw: { description: "x" }, fingerprint: "f", ...o });
    const t = { listings: [
      { id: "u1", source: "site", external_id: "1", status: "disponible", price: 300000, raw: {}, manual_status: "sous_offre", changed_at: "2026-09-01" },
      { id: "u2", source: "site", external_id: "2", status: "disponible", price: 300000, raw: {}, changed_at: "2026-09-01" },
      { id: "u3", source: "site", external_id: "3", status: "disponible", price: 300000, raw: {}, changed_at: "2026-09-01" },
    ] };
    db = fakeDb(t);
    const r = await syncListings(db, { found: [item("1", { photos: ["a", "b", "c"], title: "Titre retouché" }), item("2", { price: 280000 }), item("4")] });
    assert.deepStrictEqual([r.nouveaux.length, r.modifies.length, r.retires.length], [1, 1, 1]);
    assert.deepStrictEqual(r.modifies[0].changements, ["prix 300000 → 280000"]);
    const [l1, l2, l3] = t.listings;
    assert.strictEqual(l1.changed_at, "2026-09-01"); assert.strictEqual(l1.manual_status, "sous_offre"); assert.strictEqual(l1.photos.length, 3);
    assert.strictEqual(l2.raw.prix_precedent, 300000); assert.ok(l2.raw.prix_change_le && l2.changed_at !== "2026-09-01");
    assert.strictEqual(l3.status, "retire");
  });
  await test("deux lectures simultanées : un bien vu par l'autre lecture n'est pas retiré", async () => {
    const { syncListings } = require(path.join(LIB, "listings.js"));
    const t = { listings: [
      { id: "a", source: "site", external_id: "1", status: "disponible", price: 1, raw: {}, last_seen_at: "2026-01-01T00:00:00Z" },
      { id: "b", source: "site", external_id: "2", status: "disponible", price: 1, raw: {}, last_seen_at: "2999-01-01T00:00:00Z" },
    ].concat(Array.from({ length: 10 }, (_, i) => ({ id: "x" + i, source: "site", external_id: "x" + i, status: "disponible", price: 1, raw: {} }))) };
    db = fakeDb(t);
    const r = await syncListings(db, { found: Array.from({ length: 10 }, (_, i) => ({ source: "site", external_id: "x" + i, price: 1, status: "disponible", photos: [], raw: {} })) });
    assert.deepStrictEqual(r.retires.map((x) => x.external_id), ["1"]);
    assert.strictEqual(t.listings[1].status, "disponible");
  });
  await test("une lecture presque vide ne retire pas tous les biens", async () => {
    const { syncListings } = require(path.join(LIB, "listings.js"));
    const t = { listings: Array.from({ length: 12 }, (_, i) => ({ id: "u" + i, source: "site", external_id: String(i), status: "disponible", price: 1, raw: {} })) };
    db = fakeDb(t); const notes = [];
    const r = await syncListings(db, { found: [{ source: "site", external_id: "0", price: 1, status: "disponible", photos: [], raw: {} }], log: (m) => notes.push(m) });
    assert.strictEqual(r.retires.length, 0); assert.ok(t.listings.every((l) => l.status === "disponible")); assert.ok(/lecture incomplète/.test(notes.join(" ")));
  });

  console.log(`\n${passed} essais réussis${process.exitCode ? ", des échecs ci-dessus" : ", aucun échec"}.`);
})();
