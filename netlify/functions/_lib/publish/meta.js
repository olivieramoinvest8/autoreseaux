/**
 * Publication Facebook (page) et Instagram (compte professionnel) via l'API Graph de Meta.
 * Variables : META_PAGE_ID, META_PAGE_TOKEN (jeton de page longue durée), META_IG_USER_ID.
 * Les médias doivent être accessibles publiquement (bucket Supabase public) : image → photo, vidéo → reel.
 * Non testé tant que l'application Meta n'est pas créée (étape 2 de la phase 1).
 */
const GRAPH = "https://graph.facebook.com/v21.0";

async function graph(path, params, method = "POST") {
  const token = process.env.META_PAGE_TOKEN;
  if (!token) throw new Error("META_PAGE_TOKEN manquant");
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

module.exports = { publishFacebook, publishInstagram, refreshPageToken };
