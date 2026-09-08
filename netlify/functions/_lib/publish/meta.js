/**
 * Publication Facebook (page) et Instagram (compte professionnel) via l'API Graph de Meta.
 * Variables : META_PAGE_ID, META_PAGE_TOKEN (jeton de page longue durée), META_IG_USER_ID.
 * Les médias doivent être accessibles publiquement (bucket Supabase public) : image → photo, vidéo → reel.
 * Non testé tant que l'application Meta n'est pas créée (étape 2 de la phase 1).
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
 * (système ou personne) qui administre la page : dans ce cas on demande à Meta le jeton de page correspondant.
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
    const page = await graphWith(configured, `/${pageId}`, { fields: "access_token" }, "GET");
    if (!page.access_token) throw new Error(`le jeton configuré (${me.name}) ne donne pas accès au jeton de la page ${pageId}`);
    token = page.access_token;
  }
  pageTokenCache = { token, forPage: pageId };
  return token;
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

async function publishFacebook(post) {
  const pageId = process.env.META_PAGE_ID;
  if (!pageId) throw new Error("META_PAGE_ID manquant");
  const message = post.text_fb || post.text_ig || "";
  if (isVideo(post)) {
    const r = await graph(`/${pageId}/videos`, { file_url: post.media_url, description: message });
    return { id: r.id, kind: "video" };
  }
  const r = await graph(`/${pageId}/photos`, { url: post.media_url, message });
  return { id: r.post_id || r.id, kind: "photo" };
}

async function waitContainer(creationId) {
  for (let i = 0; i < 40; i++) {
    const s = await graph(`/${creationId}`, { fields: "status_code,status" }, "GET");
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR") throw new Error(`Instagram : conteneur en erreur (${JSON.stringify(s.status)})`);
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
  } else {
    creation = await graph(`/${igId}/media`, { image_url: post.media_url, caption });
    // L'image doit être un JPEG public ; on lit l'état du conteneur pour une erreur lisible plutôt que « Media ID is not available ».
    const s = await graph(`/${creation.id}`, { fields: "status_code,status" }, "GET").catch(() => null);
    if (s && s.status_code === "ERROR") throw new Error(`Instagram : conteneur en erreur (${JSON.stringify(s.status)})`);
  }
  const pub = await graph(`/${igId}/media_publish`, { creation_id: creation.id });
  return { id: pub.id, kind: isVideo(post) ? "reel" : "image" };
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
    }
  } catch (e) {
    out.ok = false; out.error = e.message;
  }
  return out;
}

module.exports = { publishFacebook, publishInstagram, refreshPageToken, check };
