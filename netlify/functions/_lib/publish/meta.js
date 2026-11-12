/**
 * Publication Facebook (page) et Instagram (compte professionnel) via l'API Graph de Meta.
 * Variables : META_PAGE_ID, META_PAGE_TOKEN (jeton de page longue durée), META_IG_USER_ID.
 * Les médias doivent être accessibles publiquement (bucket Supabase public) : image → photo, vidéo → reel.
 * Carrousel (12 nov.) : un post qui porte plusieurs images (media_url + extra_media de type « slide ») part en album
 * sur Facebook et en carrousel sur Instagram, dans l'ordre des slides. Avant, seule la première image partait.
 * Story : l'image extra_media de type « story » (affiche 1080×1920) est publiée en story après le post, sans jamais
 * faire échouer la publication principale.
 */
const GRAPH = "https://graph.facebook.com/v21.0";

let pageTokenCache = null; // { token, forPage } le temps de vie de l'instance

/** Appel brut avec un jeton donné. */
async function graphWith(token, path, params, method = "POST") {
  const body = new URLSearchParams({ ...params, access_token: token });
  const url = method === "GET" ? `${GRAPH}${path}?${body}` : `${GRAPH}${path}`;
  const res = await fetch(url, method === "GET" ? {} : { method, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error((data.error && data.error.message) || `Graph ${res.status}`);
  return data;
}

/**
 * Jeton de page effectif. META_PAGE_TOKEN peut être le jeton de la page elle-même, ou un jeton d'utilisateur
 * (système ou personne) qui administre la page : dans ce cas on cherche la page dans « /me/accounts », qui
 * donne à la fois son jeton et les tâches accordées (CREATE_CONTENT = droit de publier). Une page absente
 * de cette liste, ou sans CREATE_CONTENT, est signalée en clair plutôt que par le « (#200) » de Meta.
 */
async function pageToken() {
  const configured = process.env.META_PAGE_TOKEN;
  const pageId = process.env.META_PAGE_ID;
  if (!configured) throw new Error("META_PAGE_TOKEN manquant");
  if (!pageId) throw new Error("META_PAGE_ID manquant");
  if (pageTokenCache && pageTokenCache.forPage === pageId) return pageTokenCache.token;
  const me = await graphWith(configured, "/me", { fields: "id,name" }, "GET");
  let token = configured;
  if (me.id !== pageId) {
    const found = await findPage(configured, pageId);
    if (!found) throw new Error(`le jeton configuré (${me.name}) ne voit pas la page ${pageId} : générez-le à nouveau en donnant accès à la page AMO Invest (utilisateur système → « Attribuer des actifs », ou fenêtre Meta → « Modifier les paramètres »)`);
    if (Array.isArray(found.tasks) && found.tasks.length && !found.tasks.includes("CREATE_CONTENT")) {
      throw new Error(`le jeton configuré (${me.name}) voit la page ${found.name} mais sans le droit « Créer du contenu » (tâches : ${found.tasks.join(", ")})`);
    }
    if (!found.access_token) throw new Error(`le jeton configuré (${me.name}) ne donne pas accès au jeton de la page ${pageId}`);
    token = found.access_token;
  }
  pageTokenCache = { token, forPage: pageId };
  return token;
}

/** Liste des pages visibles par un jeton d'utilisateur, avec leur jeton et leurs tâches. */
async function listPages(userToken) {
  const r = await graphWith(userToken, "/me/accounts", { fields: "id,name,access_token,tasks", limit: "100" }, "GET").catch(() => ({ data: [] }));
  return Array.isArray(r.data) ? r.data : [];
}

/** Page cherchée dans /me/accounts ; sinon lecture directe de la page (certains jetons système ne listent pas leurs pages). */
async function findPage(userToken, pageId) {
  const pages = await listPages(userToken);
  const hit = pages.find((p) => p.id === pageId);
  if (hit) return hit;
  const direct = await graphWith(userToken, `/${pageId}`, { fields: "id,name,access_token" }, "GET").catch(() => null);
  return direct && direct.access_token ? { ...direct, tasks: [] } : null;
}

async function graph(path, params, method = "POST") {
  const token = await pageToken();
  const body = new URLSearchParams({ ...params, access_token: token });
  const url = method === "GET" ? `${GRAPH}${path}?${body}` : `${GRAPH}${path}`;
  const res = await fetch(url, method === "GET" ? {} : { method, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error((data.error && data.error.message) || `Graph ${res.status}`);
  return data;
}

function isVideo(post) { return post.type !== "image" || /\.(mp4|mov|webm)(\?|$)/i.test(post.media_url || ""); }

const MAX_SLIDES = 10; // limite commune prudente (Instagram accepte 2 à 10 images par carrousel)

/**
 * Ce qu'il faut publier pour un post image : la liste ordonnée des images (media_url puis les slides) et la story.
 * extra_media = [{ url, kind }] ; kind « slide » = image suivante du carrousel, « story » = affiche verticale.
 * Une image marquée « slide » dont le nom contient « story » est traitée en story (anciens dépôts de la routine).
 */
function mediaPlan(post) {
  const extras = Array.isArray(post.extra_media) ? post.extra_media : [];
  const urlOf = (e) => (typeof e === "string" ? e : e && e.url) || null;
  const isStory = (e) => (e && e.kind === "story") || /story/i.test(String(urlOf(e) || "").split("/").pop());
  const slides = extras.filter((e) => !isStory(e) && (typeof e === "string" || !e.kind || e.kind === "slide")).map(urlOf).filter(Boolean);
  const story = extras.filter(isStory).map(urlOf).filter(Boolean)[0] || null;
  const images = isVideo(post) ? [] : [post.media_url, ...slides].filter(Boolean).slice(0, MAX_SLIDES);
  return { images, story, isCarousel: images.length >= 2 };
}

async function publishFacebook(post) {
  const pageId = process.env.META_PAGE_ID;
  if (!pageId) throw new Error("META_PAGE_ID manquant");
  const message = post.text_fb || post.text_ig || "";
  if (isVideo(post)) {
    const r = await graph(`/${pageId}/videos`, { file_url: post.media_url, description: message });
    return { id: r.id, kind: "video" };
  }
  const plan = mediaPlan(post);
  if (plan.isCarousel) {
    // Album : chaque photo est d'abord déposée sans être publiée, puis un seul post les réunit dans l'ordre.
    const params = { message };
    for (const [i, url] of plan.images.entries()) {
      const ph = await graph(`/${pageId}/photos`, { url, published: "false" });
      params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: ph.id });
    }
    const r = await graph(`/${pageId}/feed`, params);
    return { id: r.id, kind: "album", images: plan.images.length };
  }
  const r = await graph(`/${pageId}/photos`, { url: post.media_url, message });
  return { id: r.post_id || r.id, kind: "photo" };
}

async function waitContainer(creationId) {
  for (let i = 0; i < 40; i++) {
    const s = await graph(`/${creationId}`, { fields: "status_code,status" }, "GET");
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error(`Instagram : conteneur ${s.status_code} (${JSON.stringify(s.status)})`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("Instagram : le conteneur n'est pas prêt après 200 s");
}

async function publishInstagram(post) {
  const igId = process.env.META_IG_USER_ID;
  if (!igId) throw new Error("META_IG_USER_ID manquant");
  const caption = [post.text_ig || post.text_fb || "", (post.hashtags || []).map((h) => (h.startsWith("#") ? h : "#" + h)).join(" ")].filter(Boolean).join("\n\n");
  let creation;
  if (isVideo(post)) {
    creation = await graph(`/${igId}/media`, { media_type: "REELS", video_url: post.media_url, caption, share_to_feed: "true" });
    await waitContainer(creation.id);
  } else if (mediaPlan(post).isCarousel) {
    // Carrousel : un conteneur par image (is_carousel_item), puis un conteneur CAROUSEL qui les réunit avec la légende.
    const children = [];
    for (const url of mediaPlan(post).images) {
      const child = await graph(`/${igId}/media`, { image_url: url, is_carousel_item: "true" });
      await waitContainer(child.id);
      children.push(child.id);
    }
    creation = await graph(`/${igId}/media`, { media_type: "CAROUSEL", children: children.join(","), caption });
    await waitContainer(creation.id);
  } else {
    creation = await graph(`/${igId}/media`, { image_url: post.media_url, caption });
    // Instagram télécharge l'image (JPEG public) en arrière-plan : publier avant la fin donne « Media ID is not available ».
    await waitContainer(creation.id);
  }
  const pub = await publishContainer(igId, creation.id, post.media_url);
  return { id: pub.id, kind: isVideo(post) ? "reel" : mediaPlan(post).isCarousel ? "carousel" : "image", ...(mediaPlan(post).isCarousel ? { images: mediaPlan(post).images.length } : {}) };
}

/** Même FINISHED, Meta refuse parfois la publication pendant quelques secondes : on réessaie trois fois. */
async function publishContainer(igId, creationId, label) {
  let pub, lastErr;
  for (let i = 0; i < 4; i++) {
    try { pub = await graph(`/${igId}/media_publish`, { creation_id: creationId }); break; }
    catch (e) { lastErr = e; if (!/Media ID is not available/i.test(e.message)) throw e; await new Promise((r) => setTimeout(r, 8000)); }
  }
  if (!pub) throw new Error(`Instagram : ${lastErr.message} (image ${label})`);
  return pub;
}

/** Story Instagram : l'affiche verticale du post. */
async function publishInstagramStory(imageUrl) {
  const igId = process.env.META_IG_USER_ID;
  if (!igId) throw new Error("META_IG_USER_ID manquant");
  const creation = await graph(`/${igId}/media`, { media_type: "STORIES", image_url: imageUrl });
  await waitContainer(creation.id);
  const pub = await publishContainer(igId, creation.id, imageUrl);
  return { id: pub.id, kind: "story" };
}

/** Story Facebook de la page : la photo est déposée sans être publiée, puis passée en story. */
async function publishFacebookStory(imageUrl) {
  const pageId = process.env.META_PAGE_ID;
  if (!pageId) throw new Error("META_PAGE_ID manquant");
  const ph = await graph(`/${pageId}/photos`, { url: imageUrl, published: "false" });
  const r = await graph(`/${pageId}/photo_stories`, { photo_id: ph.id });
  return { id: r.post_id || r.id || ph.id, kind: "story" };
}

/** Nombre d'abonnés de la page et du compte Instagram (droits déjà présents sur le jeton). Un échec donne null. */
async function accountStats() {
  const out = [];
  const { META_PAGE_ID, META_IG_USER_ID } = process.env;
  if (META_PAGE_ID) {
    const p = await graph(`/${META_PAGE_ID}`, { fields: "followers_count,fan_count" }, "GET").catch((e) => ({ _error: e.message }));
    out.push({ network: "facebook", followers: p._error ? null : p.followers_count ?? p.fan_count ?? null, raw: p });
  }
  if (META_IG_USER_ID) {
    const i = await graph(`/${META_IG_USER_ID}`, { fields: "followers_count,media_count" }, "GET").catch((e) => ({ _error: e.message }));
    out.push({ network: "instagram", followers: i._error ? null : i.followers_count ?? null, raw: i });
  }
  return out;
}

/** Prolonge le jeton de page (60 jours). Appelé par refresh-tokens. */
async function refreshPageToken() {
  const { META_APP_ID, META_APP_SECRET, META_PAGE_TOKEN } = process.env;
  if (!META_APP_ID || !META_APP_SECRET || !META_PAGE_TOKEN) throw new Error("META_APP_ID, META_APP_SECRET ou META_PAGE_TOKEN manquant");
  const url = `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${META_PAGE_TOKEN}`;
  const res = await fetch(url); const data = await res.json();
  if (!res.ok || data.error) throw new Error((data.error && data.error.message) || `Graph ${res.status}`);
  return data; // { access_token, expires_in }
}

/** Diagnostic pour le tableau de bord : qui est le jeton, quelle page, quel compte Instagram, quels droits. */
async function check() {
  const out = { ok: true, details: {} };
  const configured = process.env.META_PAGE_TOKEN;
  const { META_PAGE_ID, META_IG_USER_ID, META_APP_ID, META_APP_SECRET } = process.env;
  out.details.variables = { META_PAGE_ID: !!META_PAGE_ID, META_PAGE_TOKEN: !!configured, META_IG_USER_ID: !!META_IG_USER_ID, META_APP_ID: !!META_APP_ID, META_APP_SECRET: !!META_APP_SECRET };
  if (!configured || !META_PAGE_ID) return { ok: false, error: "META_PAGE_TOKEN ou META_PAGE_ID manquant", details: out.details };
  try {
    const me = await graphWith(configured, "/me", { fields: "id,name" }, "GET");
    out.details.jeton_configure = { id: me.id, name: me.name, type: me.id === META_PAGE_ID ? "page" : "utilisateur (système ou personne)" };
    if (me.id !== META_PAGE_ID) {
      const pages = await listPages(configured);
      out.details.pages_visibles = pages.map((p) => ({ id: p.id, name: p.name, taches: p.tasks || [], cible: p.id === META_PAGE_ID }));
      const cible = pages.find((p) => p.id === META_PAGE_ID);
      if (!cible) out.details.alerte = `la page ${META_PAGE_ID} n'apparaît pas dans les pages accessibles à ce jeton`;
      else if (Array.isArray(cible.tasks) && !cible.tasks.includes("CREATE_CONTENT")) out.details.alerte = `la page ${cible.name} est visible mais sans la tâche CREATE_CONTENT (droit « Créer du contenu »)`;
    }
    const token = await pageToken();
    const page = await graphWith(token, `/${META_PAGE_ID}`, { fields: "id,name,instagram_business_account" }, "GET");
    out.details.page = { id: page.id, name: page.name, instagram_business_account: page.instagram_business_account && page.instagram_business_account.id };
    if (META_IG_USER_ID) {
      const ig = await graphWith(token, `/${META_IG_USER_ID}`, { fields: "id,username" }, "GET").catch((e) => ({ error: e.message }));
      out.details.instagram = ig;
    }
    if (META_APP_ID && META_APP_SECRET) {
      const dbg = await graphWith(`${META_APP_ID}|${META_APP_SECRET}`, "/debug_token", { input_token: token }, "GET").catch((e) => ({ error: e.message }));
      const d = dbg.data || dbg;
      out.details.jeton_page = { type: d.type, expires_at: d.expires_at === 0 ? "jamais" : d.expires_at, scopes: d.scopes, granular: d.granular_scopes };
      const need = ["pages_manage_posts", "pages_read_engagement", "instagram_basic", "instagram_content_publish"];
      out.details.droits_manquants = need.filter((n) => !(d.scopes || []).includes(n));
      if (out.details.droits_manquants.length) out.ok = false;
      // Droits des mesures : sans eux on publie normalement, mais la portée et les enregistrements restent vides.
      const mesure = ["read_insights", "instagram_manage_insights"];
      out.details.droits_mesure_manquants = mesure.filter((n) => !(d.scopes || []).includes(n));
      out.details.mesure = out.details.droits_mesure_manquants.length
        ? `portée non mesurable : cochez ${out.details.droits_mesure_manquants.join(" et ")} en régénérant le jeton de l'utilisateur système`
        : "droits de mesure présents";
    }
  } catch (e) {
    out.ok = false; out.error = e.message;
  }
  return out;
}

module.exports = { publishFacebook, publishInstagram, publishFacebookStory, publishInstagramStory, mediaPlan, accountStats, refreshPageToken, check, graph, pageToken };
