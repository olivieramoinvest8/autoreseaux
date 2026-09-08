#!/usr/bin/env node
/**
 * render/fetch-media.js — Télécharge une image (ou une vidéo) pour la composition d'un visuel.
 *
 *   node render/fetch-media.js --url https://amoinvest.staticlbi.com/…/photo.jpg --out output/assets/458/photo-1.jpg
 *   node render/fetch-media.js --list fichier.json --dir output/assets/458      (fichier.json : ["url1", "url2", …])
 *
 * Pourquoi un script : l'environnement Claude Code n'a accès qu'à quelques sites (amoinvest.fr, Supabase, Netlify).
 * Les photos des biens (staticlbi.com) et les rendus Higgsfield (cloudfront.net) sont bloqués. Le script essaie
 * d'abord en direct ; si l'hébergeur ne répond pas, il passe par la fonction Supabase « fetch-image », un relais
 * en lecture seule limité à ces hébergeurs. Variables lues dans .env : SUPABASE_URL, SUPABASE_ANON_KEY (clé publique).
 * Sur GitHub Actions ou Netlify, le réseau est ouvert : le direct suffit et le relais n'est jamais appelé.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

/** Lit .env à la racine sans dépendance externe (une ligne CLE=valeur par variable). */
function loadEnv() {
  const p = path.join(ROOT, ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function fetchBytes(url, headers = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": "amo-social-bot/1.0 (+https://amoinvest.fr)", ...headers }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get("content-type") || "";
    if (!/^(image|video|audio)\//.test(type)) throw new Error(`type inattendu : ${type}`);
    return Buffer.from(await res.arrayBuffer());
  } finally { clearTimeout(timer); }
}

/** Télécharge une URL : en direct, sinon via le relais Supabase. Renvoie le chemin écrit. */
async function fetchMedia(url, outPath) {
  loadEnv();
  const abs = path.resolve(ROOT, outPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  let bytes, how = "direct";
  try { bytes = await fetchBytes(url); }
  catch (e1) {
    const base = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
    if (!base || !key) throw new Error(`direct impossible (${e1.message}) et pas de relais configuré (SUPABASE_URL / SUPABASE_ANON_KEY)`);
    how = "relais";
    bytes = await fetchBytes(`${base.replace(/\/$/, "")}/functions/v1/fetch-image?url=${encodeURIComponent(url)}`, { Authorization: `Bearer ${key}`, apikey: key });
  }
  fs.writeFileSync(abs, bytes);
  return { path: abs, bytes: bytes.length, how };
}

function arg(name) { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; }

if (require.main === module) {
  (async () => {
    const list = arg("--list");
    const jobs = list
      ? JSON.parse(fs.readFileSync(path.resolve(ROOT, list), "utf8")).map((u, i) => ({ url: u, out: path.join(arg("--dir") || "output/assets", `photo-${i + 1}${path.extname(new URL(u).pathname) || ".jpg"}`) }))
      : [{ url: arg("--url"), out: arg("--out") }];
    if (!jobs[0].url || !jobs[0].out) { console.error("Usage : --url <url> --out <fichier>  ou  --list <json> --dir <dossier>"); process.exit(1); }
    for (const j of jobs) {
      try { const r = await fetchMedia(j.url, j.out); console.log(`${path.relative(ROOT, r.path)} (${Math.round(r.bytes / 1024)} Ko, ${r.how})`); }
      catch (e) { console.error(`Échec ${j.url} : ${e.message}`); process.exitCode = 1; }
    }
  })();
}

module.exports = { fetchMedia };
