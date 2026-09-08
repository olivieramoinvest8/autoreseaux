#!/usr/bin/env node
/**
 * scripts/publish-to-supabase.js — Dépose un post prêt à valider (utilisé par les routines Claude Code).
 *
 *   node scripts/publish-to-supabase.js --brand amo-invest --asset output/post.png --post content/runs/2026-09-08-11h.json
 *
 * Le JSON du post contient : slot, type, segment, theme, text_fb, text_ig, text_tiktok, text_youtube,
 * hashtags[], features{}, listing_id?, inbox_id?, networks?[].
 * Étapes : 1) envoie l'asset dans le bucket public (visuels ou videos) ; 2) insère la ligne posts en draft
 * avec un jeton de validation valable 48 h ; 3) affiche le texte du mail à envoyer (liens Valider / Refuser
 * et lien du tableau de bord). La routine envoie ensuite ce mail via le connecteur Gmail.
 *
 * Deux modes :
 *   - direct : SUPABASE_URL + SUPABASE_SERVICE_KEY (fonctions Netlify, GitHub Actions) ;
 *   - relais : SUPABASE_URL + SUPABASE_ANON_KEY + BOT_SECRET (routines Claude Code, qui ne détiennent pas la clé
 *     service) → tout passe par la fonction Supabase « bot-draft », qui ne sait que déposer des brouillons.
 * Variables lues dans l'environnement ou dans .env : SUPABASE_URL, SUPABASE_SERVICE_KEY | SUPABASE_ANON_KEY + BOT_SECRET, DASHBOARD_URL.
 * Options : --extra fichier.png (répétable) pour les slides d'un carrousel ou les déclinaisons (extra_media).
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

function arg(name, def) { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : def; }
function args(name) { return process.argv.map((a, i) => (a === name ? process.argv[i + 1] : null)).filter(Boolean); }

/** Lit .env à la racine si les variables ne sont pas déjà dans l'environnement. */
function loadEnv() {
  const p = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".mp4": "video/mp4" };

/** Mode relais : appelle la fonction Supabase bot-draft avec le secret de bot. */
async function relay(action, payload) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, BOT_SECRET } = process.env;
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/bot-draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY, "x-bot-secret": BOT_SECRET },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`bot-draft ${action} : ${data.error || res.status}`);
  return data;
}

async function uploadViaRelay(brandSlug, filePath) {
  const type = MIME[path.extname(filePath).toLowerCase()];
  if (!type) throw new Error(`type de fichier non géré : ${filePath}`);
  const r = await relay("upload", { brand: brandSlug, name: path.basename(filePath), type, base64: fs.readFileSync(filePath).toString("base64") });
  return r.url;
}

async function mainRelay(brandSlug, assetPath, postPath, extras) {
  const post = JSON.parse(fs.readFileSync(postPath, "utf8"));
  const media_url = assetPath ? await uploadViaRelay(brandSlug, assetPath) : post.media_url || null;
  const extra_media = [];
  for (const f of extras) extra_media.push({ url: await uploadViaRelay(brandSlug, f), kind: "slide" });
  const r = await relay("create", { brand: brandSlug, dashboard_url: process.env.DASHBOARD_URL || "", post: { ...post, media_url, extra_media: extra_media.length ? extra_media : post.extra_media || [] } });
  console.log(JSON.stringify(r, null, 2));
}

async function main() {
  loadEnv();
  const brandSlug = arg("--brand"); const assetPath = arg("--asset"); const postPath = arg("--post"); const extras = args("--extra");
  if (!brandSlug || !postPath) throw new Error("--brand et --post sont requis");
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, DASHBOARD_URL } = process.env;
  if (!SUPABASE_URL) throw new Error("SUPABASE_URL est requis");
  if (!SUPABASE_SERVICE_KEY) {
    if (!process.env.SUPABASE_ANON_KEY || !process.env.BOT_SECRET) throw new Error("Sans SUPABASE_SERVICE_KEY, il faut SUPABASE_ANON_KEY et BOT_SECRET (mode relais)");
    return mainRelay(brandSlug, assetPath, postPath, extras);
  }
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { db: { schema: "social" }, auth: { persistSession: false } });

  const { data: brand, error: be } = await db.from("brands").select("*").eq("slug", brandSlug).single();
  if (be || !brand) throw new Error(`marque inconnue : ${brandSlug}`);
  const post = JSON.parse(fs.readFileSync(postPath, "utf8"));

  let media_url = post.media_url || null;
  if (assetPath) {
    const ext = path.extname(assetPath).toLowerCase();
    const isVideo = [".mp4", ".mov", ".webm"].includes(ext);
    const bucket = isVideo ? "videos" : "visuels";
    const key = `${brandSlug}/${new Date().toISOString().slice(0, 10)}/${Date.now()}${ext}`;
    const { error: ue } = await db.storage.from(bucket).upload(key, fs.readFileSync(assetPath), { contentType: isVideo ? "video/mp4" : ext === ".png" ? "image/png" : "image/jpeg", upsert: false });
    if (ue) throw new Error(`upload : ${ue.message}`);
    media_url = db.storage.from(bucket).getPublicUrl(key).data.publicUrl;
  }

  const token = crypto.randomBytes(24).toString("base64url");
  const row = {
    brand_id: brand.id, slot: post.slot || "11h", type: post.type || "image", segment: post.segment || null, theme: post.theme || null,
    text_fb: post.text_fb || null, text_ig: post.text_ig || null, text_tiktok: post.text_tiktok || null, text_youtube: post.text_youtube || null,
    hashtags: post.hashtags || [], media_url, thumbnail_url: post.thumbnail_url || null, extra_media: post.extra_media || [],
    features: post.features || {}, listing_id: post.listing_id || null, inbox_id: post.inbox_id || null, networks: post.networks || [],
    status: "draft", approval_token: token, token_expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
  };
  const { data: inserted, error: ie } = await db.from("posts").insert(row).select().single();
  if (ie) throw new Error(`insert : ${ie.message}`);
  if (post.inbox_id) await db.from("inbox").update({ status: "utilise", used_at: new Date().toISOString() }).eq("id", post.inbox_id);
  await db.from("events").insert({ source: "routine", level: "info", message: `Post ${row.type} ${row.slot} préparé (${brand.name})`, post_id: inserted.id, data: { theme: row.theme } });

  const base = (DASHBOARD_URL || "").replace(/\/$/, "");
  const mail = {
    to: brand.validation_email || null,
    subject: `[${brand.name}] Un post est prêt : ${row.theme || row.type}`,
    text: [
      `Un post ${row.type} est prêt pour ${brand.name} (${row.slot}).`, "",
      `Sujet : ${row.theme || ""}`, "",
      media_url ? `Aperçu : ${media_url}` : "", "",
      `Valider : ${base}/api/approve?token=${token}`,
      `Refuser : ${base}/api/reject?token=${token}`, "",
      `Modifier les textes ou voir le détail : ${base}/#post-${inserted.id}`, "",
      "Sans clic sous 48 h, le post reste en brouillon. Rien ne part sans vous.",
    ].join("\n"),
  };
  console.log(JSON.stringify({ post_id: inserted.id, media_url, mail }, null, 2));
}

main().catch((e) => { console.error("Échec :", e.message); process.exit(1); });
