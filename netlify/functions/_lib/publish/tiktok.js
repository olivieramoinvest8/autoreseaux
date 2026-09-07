/**
 * TikTok : dépôt de la vidéo dans la boîte de brouillons du compte (Content Posting API, mode « inbox »).
 * Olivier ouvre l'appli TikTok, retrouve la vidéo, ajoute un son, publie. Autorisé sans audit.
 * Variables : TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET. Jetons par marque dans social.tokens (network 'tiktok'),
 * posés par la fonction oauth-tiktok. Non testé tant que l'application TikTok n'est pas créée (étape 4).
 */
const { supabase } = require("../supabase");
const API = "https://open.tiktokapis.com/v2";
const CHUNK = 32 * 1024 * 1024;

async function accessToken(brandId) {
  const db = supabase();
  const { data: row } = await db.from("tokens").select("id, data, expires_at").eq("network", "tiktok").eq("brand_id", brandId).maybeSingle();
  if (!row) throw new Error("compte TikTok non connecté pour cette marque (lancer /api/oauth-tiktok)");
  if (row.expires_at && new Date(row.expires_at) > new Date(Date.now() + 60000)) return row.data.access_token;
  const res = await fetch(`${API}/oauth/token/`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY, client_secret: process.env.TIKTOK_CLIENT_SECRET, grant_type: "refresh_token", refresh_token: row.data.refresh_token }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(`TikTok refresh : ${data.error_description || data.error || res.status}`);
  await db.from("tokens").update({ data: { ...row.data, ...data }, expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(), updated_at: new Date().toISOString() }).eq("id", row.id);
  return data.access_token;
}

async function sendToInbox(post) {
  const token = await accessToken(post.brand_id);
  const media = await fetch(post.media_url);
  if (!media.ok) throw new Error(`vidéo introuvable : ${post.media_url}`);
  const buffer = Buffer.from(await media.arrayBuffer());
  const size = buffer.length;
  const chunkSize = size <= 64 * 1024 * 1024 ? size : CHUNK;
  const total = Math.ceil(size / chunkSize);

  const init = await fetch(`${API}/post/publish/inbox/video/init/`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({ source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: chunkSize, total_chunk_count: total } }),
  });
  const initData = await init.json();
  if (!init.ok || (initData.error && initData.error.code !== "ok")) throw new Error(`TikTok init : ${JSON.stringify(initData.error || initData)}`);
  const { publish_id, upload_url } = initData.data;

  for (let i = 0; i < total; i++) {
    const start = i * chunkSize; const end = Math.min(start + chunkSize, size) - 1;
    const part = buffer.subarray(start, end + 1);
    const up = await fetch(upload_url, { method: "PUT", headers: { "Content-Type": "video/mp4", "Content-Length": String(part.length), "Content-Range": `bytes ${start}-${end}/${size}` }, body: part });
    if (!up.ok && up.status !== 206) throw new Error(`TikTok upload : ${up.status} ${await up.text()}`);
  }
  return { id: publish_id, note: "Vidéo déposée dans les brouillons TikTok : ouvrir l'appli, ajouter un son, publier." };
}

module.exports = { sendToInbox, accessToken };
