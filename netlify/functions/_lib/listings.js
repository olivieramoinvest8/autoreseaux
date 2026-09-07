/**
 * Lecteur des annonces d'amoinvest.fr (pages vente et location) → table social.listings.
 *
 * Structure observée du site : listes paginées /vente/1, /vente/2… et /location/1…,
 * fiches /vente/<ville>/<type>/<id>-<titre>. Le lecteur :
 *   1. parcourt les listes jusqu'à une page sans nouvelle fiche ;
 *   2. ouvre chaque fiche et extrait titre, prix, honoraires, surface, pièces, DPE, GES, ville, photos, statut ;
 *   3. calcule une empreinte et compare avec la base : nouveau, modifié, disparu (→ 'retire').
 *
 * Les extractions sont volontairement tolérantes (expressions régulières sur le texte) : le premier
 * lancement réel sert à les calibrer. `node netlify/functions/_lib/listings.js --test` lance un auto-test
 * sur une page d'exemple, et `--dry-run https://…` affiche ce qui serait extrait sans rien écrire.
 */
const cheerio = require("cheerio");
const crypto = require("crypto");

const BASE = (process.env.SITE_BASE_URL || "https://www.amoinvest.fr").replace(/\/$/, "");
const KINDS = ["vente", "location"];
const MAX_PAGES = 20;

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "amo-social-bot/1.0 (+https://amoinvest.fr)", Accept: "text/html" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  return await res.text();
}

/** Liens de fiches présents dans une page de liste, pour un type donné. */
function extractDetailLinks(htmlText, kind) {
  const $ = cheerio.load(htmlText);
  const links = new Set();
  const re = new RegExp(`^(?:https?://[^/]+)?/${kind}/[^/]+/[^/]+/(\\d+)-[^/?#]+`, "i");
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href") || "";
    const m = href.match(re);
    if (m) links.add(href.startsWith("http") ? href : BASE + href);
  });
  return Array.from(links);
}

function num(s) {
  if (!s) return null;
  const clean = String(s).replace(/\s| /g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const v = parseFloat(clean);
  return Number.isFinite(v) ? v : null;
}

/** Extrait les données d'une fiche. Tolérant : chaque champ peut rester null. */
function parseDetail(htmlText, url, kind) {
  const $ = cheerio.load(htmlText);
  const text = $("body").text().replace(/\s+/g, " ");
  const idMatch = url.match(/\/(\d+)-[^/?#]+$/);
  const external_id = idMatch ? idMatch[1] : crypto.createHash("md5").update(url).digest("hex").slice(0, 12);
  const parts = url.replace(BASE, "").split("/").filter(Boolean); // [kind, ville, type, id-slug]
  const citySlug = parts[1] || null;
  const city = citySlug ? citySlug.replace(/^\d+-/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null;
  const property_type = parts[2] ? parts[2].replace(/-/g, " ") : null;

  const title = ($("h1").first().text() || $("meta[property='og:title']").attr("content") || $("title").text() || "").trim();
  const priceMatch = text.match(/(\d[\d\s .]{2,})\s*€/);
  const price = priceMatch ? num(priceMatch[1]) : null;
  const feesMatch = text.match(/(honoraires[^.]{0,160})/i);
  const surfaceMatch = text.match(/(\d+(?:[.,]\d+)?)\s*m²/i) || text.match(/(\d+(?:[.,]\d+)?)\s*m2/i);
  const roomsMatch = text.match(/(\d+)\s*pi[èe]ces?/i);
  const dpeMatch = text.match(/DPE\s*[:\-]?\s*([A-G])\b/i) || text.match(/classe\s+(?:énergie|energie)\s*[:\-]?\s*([A-G])\b/i);
  const gesMatch = text.match(/GES\s*[:\-]?\s*([A-G])\b/i) || text.match(/climat\s*[:\-]?\s*([A-G])\b/i);

  let status = "disponible";
  if (/vendu/i.test(title) || /\bvendu\b/i.test(text.slice(0, 2000))) status = "vendu";
  else if (/lou[ée]\b/i.test(title)) status = "loue";
  else if (/sous\s+(offre|compromis)/i.test(text.slice(0, 3000))) status = "sous_offre";

  const photos = new Set();
  const og = $("meta[property='og:image']").attr("content");
  if (og) photos.add(og);
  $("img[src], img[data-src]").each((_, img) => {
    const src = $(img).attr("data-src") || $(img).attr("src") || "";
    if (/\.(jpe?g|png|webp)(\?|$)/i.test(src) && !/logo|icon|sprite|placeholder/i.test(src)) {
      photos.add(src.startsWith("http") ? src : BASE + (src.startsWith("/") ? "" : "/") + src);
    }
  });

  const data = {
    source: "site", external_id, url, kind, title: title || null, property_type, city, price,
    fees_note: feesMatch ? feesMatch[1].trim() : null,
    surface_m2: surfaceMatch ? num(surfaceMatch[1]) : null,
    rooms: roomsMatch ? parseInt(roomsMatch[1], 10) : null,
    dpe: dpeMatch ? dpeMatch[1].toUpperCase() : null,
    ges: gesMatch ? gesMatch[1].toUpperCase() : null,
    photos: Array.from(photos).slice(0, 12), status,
  };
  data.fingerprint = crypto.createHash("sha1").update(JSON.stringify([data.title, data.price, data.status, data.surface_m2, data.dpe, data.ges, data.photos.length])).digest("hex");
  return data;
}

/** Parcourt le site et renvoie la liste des fiches extraites. */
async function crawl({ log = () => {} } = {}) {
  const found = [];
  for (const kind of KINDS) {
    const seen = new Set();
    for (let page = 1; page <= MAX_PAGES; page++) {
      const listUrl = `${BASE}/${kind}/${page}`;
      let htmlText;
      try { htmlText = await fetchText(listUrl); } catch (e) { log(`liste ${listUrl} : ${e.message}`); break; }
      const links = extractDetailLinks(htmlText, kind).filter((l) => !seen.has(l));
      if (!links.length) break;
      links.forEach((l) => seen.add(l));
      for (const url of links) {
        try {
          const detail = parseDetail(await fetchText(url), url, kind);
          found.push(detail);
        } catch (e) { log(`fiche ${url} : ${e.message}`); }
      }
    }
    log(`${kind} : ${seen.size} fiches`);
  }
  return found;
}

/** Compare avec la base et écrit : renvoie { nouveaux, modifies, retires, total }. */
async function syncListings(supabase, { log = () => {} } = {}) {
  const found = await crawl({ log });
  const { data: existing, error } = await supabase.from("listings").select("id, external_id, fingerprint, status").eq("source", "site");
  if (error) throw error;
  const byId = new Map((existing || []).map((r) => [r.external_id, r]));
  const now = new Date().toISOString();
  const result = { nouveaux: [], modifies: [], retires: [], total: found.length };

  for (const item of found) {
    const prev = byId.get(item.external_id);
    if (!prev) {
      const { error: e } = await supabase.from("listings").insert({ ...item, first_seen_at: now, last_seen_at: now, changed_at: now });
      if (e) log(`insert ${item.external_id} : ${e.message}`); else result.nouveaux.push(item);
    } else {
      const changed = prev.fingerprint !== item.fingerprint;
      const patch = { ...item, last_seen_at: now };
      if (changed) patch.changed_at = now;
      const { error: e } = await supabase.from("listings").update(patch).eq("id", prev.id);
      if (e) log(`update ${item.external_id} : ${e.message}`); else if (changed) result.modifies.push({ avant: prev, apres: item });
      byId.delete(item.external_id);
    }
  }
  // Ce qui n'est plus sur le site est marqué retiré (probablement vendu ou loué).
  for (const [, prev] of byId) {
    if (prev.status === "retire") continue;
    const { error: e } = await supabase.from("listings").update({ status: "retire", changed_at: now }).eq("id", prev.id);
    if (!e) result.retires.push(prev);
  }
  return result;
}

// --- Auto-test et mode essai en ligne de commande ---------------------------------------------
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === "--test") {
    const sample = `<html><head><title>Maison 4 pièces 95 m² Graveson | Amo Invest</title><meta property="og:image" content="/img/1.jpg"></head>
      <body><h1>Maison 4 pièces 95 m² Graveson</h1><p>Prix : 289 000 € honoraires inclus charge vendeur</p>
      <p>Surface 95 m² · 4 pièces · DPE : C · GES : A</p><img src="/photos/a.jpg"><img src="/logo.png"></body></html>`;
    const d = parseDetail(sample, BASE + "/vente/2-graveson/maison/512-maison-4-pieces", "vente");
    const ok = d.external_id === "512" && d.price === 289000 && d.surface_m2 === 95 && d.rooms === 4 && d.dpe === "C" && d.ges === "A" && d.city === "Graveson" && d.photos.length === 2;
    console.log(JSON.stringify(d, null, 2));
    console.log(ok ? "Auto-test OK" : "Auto-test ÉCHOUÉ");
    process.exit(ok ? 0 : 1);
  }
  if (args[0] === "--dry-run") {
    crawl({ log: console.log }).then((r) => { console.log(JSON.stringify(r, null, 2)); console.log(`${r.length} fiches`); }).catch((e) => { console.error(e.message); process.exit(1); });
  }
}

module.exports = { crawl, syncListings, parseDetail, extractDetailLinks };
