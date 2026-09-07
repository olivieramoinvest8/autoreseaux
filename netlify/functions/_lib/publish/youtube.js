/**
 * Mise en ligne YouTube (API YouTube Data v3, envoi reprenable).
 * Variables : GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET. Le refresh token de la chaîne est stocké dans
 * social.tokens (network 'google') par la fonction oauth-google, ou dans GOOGLE_REFRESH_TOKEN.
 * Non testé tant que le projet Google n'est pas créé (étape 3 de la phase 1).
 */
const { supabase } = require("../supabase");

async function accessToken(brandId) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  let refresh = process.env.GOOGLE_REFRESH_TOKEN;
  if (!refresh) {
    const { data } = await supabase().from("tokens").select("data").eq("network", "google").eq("brand_id", brandId).maybeSingle();
    refresh = data && data.data && data.data.refresh_token;
  }
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !refresh) throw new Error("identifiants Google manquants (client, secret ou refresh token)");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, refresh_token: refresh, grant_type: "refresh_token" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google OAuth : ${data.error_description || data.error || res.status}`);
  return data.access_token;
}

async function publish(post) {
  const token = await accessToken(post.brand_id);
  const media = await fetch(post.media_url);
  if (!media.ok) throw new Error(`vidéo introuvable : ${post.media_url}`);
  const buffer = Buffer.from(await media.arrayBuffer());

  const title = (post.text_youtube || post.theme || "Vidéo").split("\n")[0].slice(0, 100);
  const descriptionParts = (post.text_youtube || "").split("\n").slice(1).join("\n").trim();
  const description = [descriptionParts, (post.hashtags || []).map((h) => (h.startsWith("#") ? h : "#" + h)).join(" ")].filter(Boolean).join("\n\n");
  const metadata = {
    snippet: { title, description, categoryId: "22", defaultLanguage: "fr" },
    status: { privacyStatus: "public", selfDeclaredMadeForKids: false, containsSyntheticMedia: !!(post.features && post.features.synthetic) },
  };
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": String(buffer.length) },
    body: JSON.stringify(metadata),
  });
  if (!init.ok) throw new Error(`YouTube init : ${init.status} ${await init.text()}`);
  const location = init.headers.get("location");
  const up = await fetch(location, { method: "PUT", headers: { "Content-Type": "video/mp4", "Content-Length": String(buffer.length) }, body: buffer });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) throw new Error(`YouTube upload : ${up.status} ${JSON.stringify(data)}`);
  return { id: data.id, url: `https://youtu.be/${data.id}` };
}

module.exports = { publish, accessToken };
