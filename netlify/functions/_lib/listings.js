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
 * sur une page d'exemple, `--dry-run` lit tout le site sans rien écrire, et `--dry-run https://…` une seule fiche.
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

/** Nettoie un texte : espaces multiples, retours à la ligne. */
function clean(s) { return String(s || "").replace(/\s+/g, " ").trim(); }

/** Normalise une URL d'image du site (les photos sont servies en « //amoinvest.staticlbi.com/… »). */
function absUrl(src) {
  if (!src) return null;
  if (src.startsWith("//")) return "https:" + src;
  if (/^https?:/.test(src)) return src;
  return BASE + (src.startsWith("/") ? "" : "/") + src;
}

/**
 * Extrait les données d'une fiche. Calibré sur la structure réelle d'amoinvest.fr (8 septembre 2026) :
 *   - titre        : balise <title> « Villa 148m² Graveson | Amo Invest » (le <h1> mélange type, pièces, surface)
 *   - pièces, chambres, surface : sous-blocs du <h1> (« 5 pièce(s) », « 4 chambre(s) », « 148 m² »)
 *   - prix et honoraires : bloc « Informations financières » (libellé + valeur), ex. « Prix de vente honoraires TTC inclus » / « Loyer CC* / mois », « Honoraires TTC charge locataire »
 *   - DPE / GES    : bulles A→G dont une seule porte la classe « bubble--active » ; « bubble_dpe--unactive » = pas de DPE affiché.
 *                    L'image officielle du diagnostic est disponible (admin/dpe.php) et gardée dans raw.
 *   - photos       : uniquement les images du bien (dossier images/biens), en 1600 px, sans l'avatar du négociateur.
 *   - description  : texte « À propos de ce bien », gardé dans raw pour l'écriture des posts.
 * Chaque champ reste tolérant (fallback texte) : un champ absent vaut null, jamais une valeur inventée.
 */
function parseDetail(htmlText, url, kind) {
  const $ = cheerio.load(htmlText);
  const text = clean($("body").text());
  const idMatch = url.match(/\/(\d+)-[^/?#]+$/);
  const external_id = idMatch ? idMatch[1] : crypto.createHash("md5").update(url).digest("hex").slice(0, 12);
  const parts = url.replace(BASE, "").split("/").filter(Boolean); // [kind, ville, type, id-slug]
  const citySlug = parts[1] || null;
  const city = citySlug ? citySlug.replace(/^\d+-/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null;
  const property_type = parts[2] ? parts[2].replace(/-/g, " ") : null;

  // Titre : <title> sans le « | Amo Invest », sinon og:title, sinon première ligne du h1.
  const h1 = $("h1").first();
  const h1Main = clean(h1.clone().children().remove().end().text());
  const h1Parts = h1.find(".separator").map((_, el) => clean($(el).text())).get();
  const pageTitle = clean($("title").first().text()).split("|")[0].trim();
  const title = pageTitle || clean($("meta[property='og:title']").attr("content")) || h1Main || null;
  const headline = [h1Main, ...h1Parts].filter(Boolean).join(" · ") || null;
  const h1Text = h1Parts.join(" ") || text;
  const roomsMatch = h1Text.match(/(\d+)\s*pi[èe]ce/i) || text.match(/(\d+)\s*pi[èe]ces?/i);
  const bedroomsMatch = h1Text.match(/(\d+)\s*chambre/i);
  const surfaceMatch = h1Text.match(/(\d+(?:[.,]\d+)?)\s*m[²2]/i) || text.match(/(\d+(?:[.,]\d+)?)\s*m[²2]/i);

  // Informations financières : paires libellé → valeur.
  const finance = {};
  $(".finance_content").each((_, el) => {
    const label = clean($(el).find(".title_finance").text());
    const value = clean($(el).find(".price_finance").text());
    if (label && value) finance[label] = value;
  });
  const financeLabels = Object.keys(finance);
  const priceLabel = financeLabels.find((l) => /prix de vente|loyer/i.test(l));
  let price = priceLabel ? num(finance[priceLabel]) : null;
  if (price === null) { const m = text.match(/(\d[\d\s .]{2,})\s*€/); price = m ? num(m[1]) : null; }

  // Honoraires : libellé du bloc financier, complété par la mention « charge vendeur » de la description.
  const feeLabels = financeLabels.filter((l) => /honoraires|état des lieux/i.test(l) && !/non renseign/i.test(finance[l]));
  const sellerPays = /charge (?:du |des )?vendeurs?/i.test(text);
  let fees_note = null;
  if (kind === "location" && feeLabels.length) {
    fees_note = feeLabels.map((l) => `${l} : ${finance[l]}`).join(", ");
  } else if (priceLabel && /honoraires/i.test(priceLabel)) {
    fees_note = priceLabel.replace(/^prix de vente\s*/i, "").replace(/^\w/, (c) => c.toUpperCase());
    if (sellerPays) fees_note += ", à la charge du vendeur";
  } else if (sellerPays) {
    fees_note = "Honoraires à la charge du vendeur";
  } else {
    const m = text.match(/(honoraires(?: d[’'\u2019]agence)? (?:TTC )?inclus\s*:?\s*[\d\s .,]*€?)/i);
    fees_note = m ? clean(m[1]) : null;
  }

  // DPE / GES : bulle active. « --unactive » signifie que le site n'affiche pas de classe (ancien DPE, vierge…).
  const bubbleLetter = (sel) => {
    const active = $(`${sel} .bubble--active`).first();
    const letter = clean(active.text()).toUpperCase();
    return /^[A-G]$/.test(letter) ? letter : null;
  };
  let dpe = bubbleLetter(".bubble_dpe");
  let ges = bubbleLetter(".bubble_ges");
  if (!dpe) { const m = text.match(/\bDPE\s*[:\-]?\s*([A-G])\s*[:(]/i) || text.match(/classe\s+(?:énergie|energie)\s*[:\-]?\s*([A-G])\b/i); dpe = m ? m[1].toUpperCase() : null; }
  if (!ges) { const m = text.match(/\bGES\s*[:\-]?\s*([A-G])\s*[:(]/i); ges = m ? m[1].toUpperCase() : null; }
  const dpe_label = clean($(".energy__label").first().text()).slice(0, 300) || clean($(".diag_text").filter((_, el) => /ancienne|vierge|non soumis/i.test($(el).text())).first().text()) || null;
  const dpe_image = absUrl($(".energy__img[alt='DPE']").attr("src")) || null;
  const ges_image = absUrl($(".energy__img[alt='GES']").attr("src")) || null;

  // Statut : bandeau (« Exclusivité », « Vendu », « Sous offre »…) puis titre.
  const banners = Array.from(new Set($(".bandeau_item").map((_, el) => clean($(el).text())).get()));
  let status = "disponible";
  const flag = banners.join(" ") + " " + (title || "");
  if (/vendu/i.test(flag)) status = "vendu";
  else if (/\blou[ée]e?\b/i.test(flag)) status = "loue";
  else if (/sous\s+(offre|compromis)/i.test(flag)) status = "sous_offre";

  // Photos du bien : dossier images/biens, en 1600 px, une seule fois par photo.
  const photos = [];
  const seenPhoto = new Set();
  $("img[src], img[data-src]").each((_, img) => {
    const src = absUrl($(img).attr("data-src") || $(img).attr("src") || "");
    if (!src || !/images\/biens\//i.test(src) || /negociateurs|avatar|logo/i.test(src)) return;
    const key = (src.match(/(photo_[a-f0-9]+\.\w+)/i) || [src])[0];
    if (seenPhoto.has(key)) return;
    seenPhoto.add(key);
    photos.push(src.replace(/\/\d+xauto\//, "/1600xauto/"));
  });
  if (!photos.length) { const og = absUrl($("meta[property='og:image']").attr("content")); if (og) photos.push(og); }

  // Description et caractéristiques, pour l'écriture des posts (jamais affichées telles quelles).
  const description = clean($(".editorial-v2__text .text__content").text() || $(".text__content").first().text()).slice(0, 4000) || null;
  const features = $(".detail_caracteristiques_content .list_item").map((_, el) => clean($(el).text())).get();

  const data = {
    source: "site", external_id, url, kind, title, property_type, city, price, fees_note,
    surface_m2: surfaceMatch ? num(surfaceMatch[1]) : null,
    rooms: roomsMatch ? parseInt(roomsMatch[1], 10) : null,
    dpe, ges, photos: photos.slice(0, 12), status,
    raw: {
      headline, bedrooms: bedroomsMatch ? parseInt(bedroomsMatch[1], 10) : null, finance, banners,
      dpe_label, dpe_image, ges_image, description, features: features.slice(0, 40),
    },
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
    // 1. Structure réelle du site (bulles DPE, bloc financier, photos « biens »).
    const site = `<html><head><title>Maison 95m² Graveson | Amo Invest</title><meta property="og:image" content="//amoinvest.staticlbi.com/1200xauto/images/biens/1/abc/photo_1a.jpg"></head><body>
      <div class="detail_swiper__bandeau"><span class="bandeau_item">Exclusivité</span></div>
      <h1 class="title_item">Maison <span class="second_line"><span class="separator">4 pièce(s)</span><span class="separator">3 chambre(s)</span><span class="separator">95 m²</span></span></h1>
      <img src="//amoinvest.staticlbi.com/original/images/negociateurs/avatar_x.jpg"><img src="//amoinvest.staticlbi.com/1200xauto/images/biens/1/abc/photo_1a.jpg"><img src="//amoinvest.staticlbi.com/1600xauto/images/biens/1/abc/photo_1a.jpg"><img src="//amoinvest.staticlbi.com/1600xauto/images/biens/1/abc/photo_2b.jpg">
      <div class="editorial-v2__text"><div class="text__content"><p>Belle maison. Les honoraires d'agence seront intégralement à la charge du vendeur.</p></div></div>
      <section class="detail_dpe_ges"><div class="bubble_diag bubble_dpe"><span class="bubble bubble_dpe_a">A</span><span class="bubble bubble_dpe_c bubble--active">C</span></div>
      <div class="bubble_diag bubble_ges"><span class="bubble bubble_ges_a bubble--active">A</span></div>
      <div class="energy__drawing"><img class="energy__img" src="//amoinvest.fr/admin/dpe.php?idann=512" alt="DPE"><img class="energy__img" src="//amoinvest.fr/admin/dpe.php?type=GES&idann=512" alt="GES"></div></section>
      <section class="detail_data_finance"><div class="finance_content"><span class="title_finance">Prix de vente honoraires TTC inclus</span><span class="price_finance">289 000 €</span></div>
      <div class="finance_content"><span class="title_finance">Taxe foncière annuelle</span><span class="price_finance">900 €</span></div></section>
      <section class="detail_calculator">Calcul des mensualités</section></body></html>`;
    const d = parseDetail(site, BASE + "/vente/2-graveson/maison/512-maison-4-pieces", "vente");
    const ok1 = d.external_id === "512" && d.title === "Maison 95m² Graveson" && d.price === 289000 && d.surface_m2 === 95 && d.rooms === 4 && d.raw.bedrooms === 3
      && d.dpe === "C" && d.ges === "A" && d.city === "Graveson" && d.photos.length === 2 && d.photos.every((p) => p.startsWith("https://") && p.includes("1600xauto"))
      && d.fees_note === "Honoraires TTC inclus, à la charge du vendeur" && d.raw.dpe_image.startsWith("https://amoinvest.fr/admin/dpe.php");
    // 2. Fiche sans bulle active (DPE ancienne version) : aucune classe inventée.
    const noDpe = site.replace(' bubble--active', "").replace(' bubble--active', "");
    const d2 = parseDetail(noDpe, BASE + "/vente/2-graveson/maison/513-maison", "vente");
    const ok2 = d2.dpe === null && d2.ges === null;
    // 3. Location : loyer et honoraires locataire.
    const loc = site.replace("Prix de vente honoraires TTC inclus", "Loyer CC* / mois").replace("289 000 €", "695 €").replace("Taxe foncière annuelle", "Honoraires TTC charge locataire").replace("900 €", "552,24 €");
    const d3 = parseDetail(loc, BASE + "/location/1-graveson/duplex/558-duplex", "location");
    const ok3 = d3.price === 695 && d3.fees_note === "Honoraires TTC charge locataire : 552,24 €";
    console.log(JSON.stringify({ ...d, raw: { ...d.raw, description: (d.raw.description || "").slice(0, 60) } }, null, 2));
    const ok = ok1 && ok2 && ok3;
    console.log(`Auto-test ${ok ? "OK" : "ÉCHOUÉ"} (structure : ${ok1}, sans DPE : ${ok2}, location : ${ok3})`);
    process.exit(ok ? 0 : 1);
  }
  if (args[0] === "--dry-run" && args[1]) {
    const u = args[1]; const k = u.includes("/location/") ? "location" : "vente";
    fetchText(u).then((h) => console.log(JSON.stringify(parseDetail(h, u, k), null, 2))).catch((e) => { console.error(e.message); process.exit(1); });
  } else if (args[0] === "--dry-run") {
    crawl({ log: console.log }).then((r) => { console.log(JSON.stringify(r, null, 2)); console.log(`${r.length} fiches`); }).catch((e) => { console.error(e.message); process.exit(1); });
  }
}

module.exports = { crawl, syncListings, parseDetail, extractDetailLinks };
