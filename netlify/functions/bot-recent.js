/**
 * POST /api/bot-recent  { brand: "amo-invest", refresh?: true, bien?: "443" }  en-tête x-bot-secret: <secret du bot>
 *
 * La « mémoire courte » des routines Claude Code. Une routine ne détient pas la clé service de Supabase : elle ne
 * connaît que le secret de bot (table social.tokens, network 'internal', account_id 'bot'), le même que pour le
 * guichet bot-draft. Ici on lui rend, en lecture seule et sans aucun secret :
 *   - posts      : les 30 derniers posts de la marque, avec pour chaque refus son motif et sa précision ;
 *   - biens      : TOUS les biens en ligne (référence de l'agence, prix, honoraires, DPE ou mention exacte, photos du
 *                  bien seul, lien), avec la date de leur dernière présentation et « presentable » : false quand la
 *                  règle des 30 jours ou un état posé par Olivier l'interdit (la base refuserait le dépôt) ;
 *   - evenements : les biens qu'Olivier a marqués sous offre, vendus ou loués et qui n'ont pas encore eu leur post ;
 *   - retours    : part des propositions gardées par format, segment et type, motifs de refus, derniers refus ;
 *   - variete    : familles de visuels récemment utilisées, celles à laisser reposer ;
 *   - bilan      : personnes touchées et engagement par format, segment, type, heure et réseau (voir _lib/metrics.js) ;
 *   - comptes    : abonnés Facebook et Instagram, avec l'évolution sur 7 et 30 jours ;
 *   - inbox      : les dépôts d'Olivier encore non utilisés (dont les « sujets » demandés).
 * Avec { bien: "<référence ou numéro de fiche>" } : le détail complet d'un seul bien (description, caractéristiques).
 * Avec { refresh: true } : lance d'abord la relecture du site (read-listings-background) et répond { refreshing: true } ;
 * la routine rappelle bot-recent une minute plus tard pour avoir les annonces du jour.
 * Rien ne peut être écrit ni publié par ce point d'accès.
 */
const { supabase } = require("./_lib/supabase");
const { json, parseBody, dashboardUrl } = require("./_lib/http");
const { checkBotSecret } = require("./_lib/bot");
const { summarize, latestByPost } = require("./_lib/metrics");
const { feedback, variety, formatFamily } = require("./_lib/feedback");

const DAY = 86400 * 1000;
const EVENTS = ["sous_offre", "vendu", "loue"];

/** État utile d'un bien : celui posé par Olivier passe avant celui lu sur le site. */
function effectiveStatus(l) { return l.manual_status || l.status; }

/** Peut-on présenter ce bien aujourd'hui dans une annonce classique ? Même règle que le déclencheur de la base. */
function presentable(l, lastPost, now) {
  const st = effectiveStatus(l);
  if (st === "ne_plus_proposer") return { ok: false, pourquoi: "marqué « ne plus proposer » par Olivier" };
  if (EVENTS.includes(st)) return { ok: false, pourquoi: `marqué « ${st} » : seul un post d'événement est possible` };
  if (st !== "disponible") return { ok: false, pourquoi: `état ${st}` };
  if (lastPost) {
    const age = (now - new Date(lastPost.created_at).getTime()) / DAY;
    const limit = lastPost.status === "rejected" ? 14 : 30;
    if (age < limit) return { ok: false, pourquoi: `déjà proposé le ${String(lastPost.created_at).slice(0, 10)} (${lastPost.status}), à nouveau possible dans ${Math.ceil(limit - age)} jours` };
  }
  return { ok: true, pourquoi: null };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "POST attendu" });
  const db = supabase();
  if (!(await checkBotSecret(event, db))) return json(401, { error: "secret de bot invalide" });

  const b = parseBody(event);
  if (b.refresh) {
    const base = dashboardUrl();
    if (!base) return json(500, { error: "DASHBOARD_URL manquant" });
    const r = await fetch(`${base}/.netlify/functions/read-listings-background`, { method: "POST", headers: { "x-bot-secret": event.headers["x-bot-secret"] || event.headers["X-Bot-Secret"] || "" } });
    return json(r.status === 202 || r.status === 200 ? 200 : 500, { refreshing: r.status === 202 || r.status === 200, status: r.status });
  }
  const { data: brand } = await db.from("brands").select("id, slug, name, networks, settings").eq("slug", b.brand).maybeSingle();
  if (!brand) return json(400, { error: `marque inconnue : ${b.brand}` });
  const now = Date.now();

  // Détail d'un seul bien, pour écrire son annonce.
  if (b.bien) {
    const key = String(b.bien).trim();
    const { data: rows, error } = await db.from("listings").select("*").or(`reference.eq.${key.replace(/[^\w.-]/g, "")},external_id.eq.${key.replace(/[^\w.-]/g, "")}`).limit(2);
    if (error) return json(500, { error: error.message });
    const l = (rows || []).find((r) => r.reference === key) || (rows || [])[0];
    if (!l) return json(404, { error: `bien inconnu : ${key}` });
    const raw = l.raw || {};
    return json(200, { bien: {
      id: l.id, reference: l.reference || l.external_id, kind: l.kind, titre: l.title, type: l.property_type, ville: l.city, prix: l.price, honoraires: l.fees_note,
      surface_m2: l.surface_m2, pieces: l.rooms, chambres: raw.bedrooms ?? null, dpe: l.dpe, ges: l.ges, dpe_mention: l.dpe ? null : l.dpe_note || "DPE en cours",
      etat: effectiveStatus(l), url: l.url, photos: l.photos, bandeaux: raw.banners || [], finances: raw.finance || {},
      description: raw.description || null, caracteristiques: raw.features || [], prix_precedent: raw.prix_precedent ?? null, prix_change_le: raw.prix_change_le ?? null,
    } });
  }

  const since60 = new Date(now - 60 * DAY).toISOString();
  const [posts, listings, inbox, decided, stats] = await Promise.all([
    db.from("posts").select("id, slot, type, segment, theme, status, created_at, published_at, scheduled_at, features, listing_id, networks, reject_category, reject_reason, error").eq("brand_id", brand.id).order("created_at", { ascending: false }).limit(30),
    brand.slug === "amo-invest"
      ? db.from("listings").select("id, external_id, reference, kind, title, property_type, city, price, fees_note, surface_m2, rooms, dpe, ges, dpe_note, photos, status, manual_status, manual_status_at, manual_note, url, first_seen_at, changed_at, raw").or(`status.neq.retire,manual_status_at.gte.${new Date(now - 45 * DAY).toISOString()}`).order("first_seen_at", { ascending: false }).limit(200)
      : Promise.resolve({ data: [] }),
    db.from("inbox").select("id, kind, title, body, data, files, created_at").eq("brand_id", brand.id).eq("status", "nouveau").order("created_at", { ascending: false }).limit(10),
    db.from("posts").select("id, type, segment, theme, status, created_at, published_at, features, listing_id, reject_category, reject_reason, error").eq("brand_id", brand.id).gte("created_at", since60).order("created_at", { ascending: false }).limit(400),
    db.from("account_stats").select("network, day, followers").eq("brand_id", brand.id).gte("day", new Date(now - 35 * DAY).toISOString().slice(0, 10)).order("day", { ascending: false }),
  ]);
  const err = posts.error || listings.error || inbox.error || decided.error;
  if (err) return json(500, { error: err.message });
  const all = decided.data || [];

  // Dernière présentation de chaque bien (hors posts d'événement) et événements déjà annoncés.
  const lastByListing = {}; const countByListing = {}; const announced = new Set();
  for (const p of all) {
    if (!p.listing_id) continue;
    const evt = p.features && p.features.evenement;
    if (evt) { if (p.status !== "rejected") announced.add(`${p.listing_id}|${evt}`); continue; }
    countByListing[p.listing_id] = (countByListing[p.listing_id] || 0) + 1;
    if (!lastByListing[p.listing_id]) lastByListing[p.listing_id] = p; // la liste est triée du plus récent au plus ancien
  }
  const biens = []; const evenements = [];
  for (const l of listings.data || []) {
    const raw = l.raw || {}; const last = lastByListing[l.id] || null; const st = effectiveStatus(l);
    const p = presentable(l, last, now);
    if (EVENTS.includes(l.manual_status) && !announced.has(`${l.id}|${l.manual_status}`)) {
      evenements.push({ id: l.id, reference: l.reference || l.external_id, evenement: l.manual_status, depuis: l.manual_status_at, note: l.manual_note || null, kind: l.kind, titre: l.title, type: l.property_type, ville: l.city, url: l.status === "retire" ? null : l.url, photos: l.photos });
    }
    if (l.status === "retire") continue; // plus sur le site : seulement utile comme événement
    biens.push({
      id: l.id, reference: l.reference || l.external_id, kind: l.kind, titre: l.title, type: l.property_type, ville: l.city, prix: l.price, honoraires: l.fees_note,
      surface_m2: l.surface_m2, pieces: l.rooms, dpe: l.dpe, ges: l.ges, dpe_mention: l.dpe ? null : l.dpe_note || "DPE en cours",
      etat: st, url: l.url, photos: l.photos, bandeaux: raw.banners || [],
      nouveau: now - new Date(l.first_seen_at).getTime() < 14 * DAY,
      prix_precedent: raw.prix_precedent ?? null, prix_change_le: raw.prix_change_le ?? null,
      baisse_de_prix_recente: !!(raw.prix_change_le && raw.prix_precedent && Number(l.price) < Number(raw.prix_precedent) && now - new Date(raw.prix_change_le).getTime() < 14 * DAY),
      derniere_proposition: last ? { date: String(last.created_at).slice(0, 10), statut: last.status, motif_refus: last.reject_category || null, precision: last.reject_reason || (last.status === "rejected" ? last.error : null) || null } : null,
      propositions_60_jours: countByListing[l.id] || 0,
      presentable: p.ok, pourquoi_non: p.pourquoi,
    });
  }

  // Mesures des posts publiés (60 derniers jours) et bilan, pour que la routine adapte ses choix.
  const measured = all.filter((p) => ["published", "partial"].includes(p.status) && p.published_at);
  const ids = measured.map((p) => p.id);
  const { data: rows } = ids.length ? await db.from("metrics").select("post_id, network, days_after, measured_at, views, likes, comments, shares, saves, link_clicks, raw").in("post_id", ids) : { data: [] };
  const bilan = summarize(measured, rows || []);
  const metrics = latestByPost(rows || []).map((m) => ({ post_id: m.post_id, network: m.network, days_after: m.days_after, likes: m.likes, comments: m.comments, shares: m.shares, saves: m.saves, views: m.views, reach: m.raw && m.raw.reach, link_clicks: m.link_clicks }));

  // Abonnés : dernière valeur et évolution.
  const comptes = {};
  for (const net of ["facebook", "instagram"]) {
    const serie = (stats.data || []).filter((s) => s.network === net && typeof s.followers === "number");
    if (!serie.length) continue;
    const at = (days) => { const limit = new Date(now - days * DAY).toISOString().slice(0, 10); const s = serie.find((x) => x.day <= limit); return s ? s.followers : null; };
    const cur = serie[0].followers; const d7 = at(7), d30 = at(30);
    comptes[net] = { abonnes: cur, releve_le: serie[0].day, evolution_7_jours: d7 === null ? null : cur - d7, evolution_30_jours: d30 === null ? null : cur - d30 };
  }

  const recentListings = biens.filter((x) => x.nouveau || x.baisse_de_prix_recente); // ancienne clé « listings », gardée pour compatibilité
  return json(200, {
    brand: { slug: brand.slug, name: brand.name, networks: brand.networks, google_url: (brand.settings && brand.settings.google_url) || null },
    now: new Date(now).toISOString(),
    posts: (posts.data || []).map((p) => ({ id: p.id, slot: p.slot, type: p.type, segment: p.segment, theme: p.theme, status: p.status, created_at: p.created_at, published_at: p.published_at, scheduled_at: p.scheduled_at, listing_id: p.listing_id, networks: p.networks, format: formatFamily(p.features && p.features.format), features: p.features, refus: p.status === "rejected" ? { motif: p.reject_category || null, precision: p.reject_reason || p.error || null } : null })),
    biens, evenements, listings: recentListings,
    inbox: inbox.data,
    retours: feedback(all), variete: variety(all),
    metrics, comptes,
    bilan: { posts_mesures: bilan.posts_mesures, portee_mesuree: bilan.portee_mesuree, seuil_fiable: bilan.seuil_fiable, par_format: bilan.par_format, par_segment: bilan.par_segment, par_type: bilan.par_type, par_heure: bilan.par_heure, par_reseau: bilan.par_reseau, meilleurs: bilan.meilleurs },
  });
};
exports._internals = { presentable, effectiveStatus };
