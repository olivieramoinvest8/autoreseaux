#!/usr/bin/env node
/**
 * render/render-image.js — Transforme un template HTML en image PNG (Playwright / Chromium).
 *
 * Usage :
 *   node render/render-image.js --template templates/post-feed.html --data content/examples/post-test.json --out output/post.png
 *
 * Options :
 *   --template  chemin du template HTML (défaut : templates/post-feed.html)
 *   --data      fichier JSON dont les clés remplacent les {{cle}} du template (défaut : aucun)
 *   --out       chemin du PNG à produire (défaut : output/<nom-du-template>-<horodatage>.png)
 *   --scale     facteur de résolution, 1 = taille native (défaut : 1)
 *   --format    png (défaut) ou jpeg ; --quality 1 à 100 pour le jpeg (défaut : 90)
 *   --set cle=valeur   surcharge une clé sans passer par un fichier JSON (répétable)
 *
 * Fonctionnement :
 *   1. Lit le template et remplace chaque {{cle}} par la valeur correspondante (échappée pour le HTML,
 *      sauts de ligne conservés). Une clé absente devient une chaîne vide. Une valeur qui est un chemin
 *      d'image relatif au dépôt (output/assets/458/photo-1.jpg) est convertie en adresse file:// absolue.
 *   2. Supprime tout élément portant data-if="cle" si la valeur de cette clé est vide,
 *      ce qui permet des blocs optionnels (chiffre-clé, image de fond...).
 *   3. Lit la taille du visuel dans <meta name="render-size" content="1080x1350"> (défaut 1080×1350).
 *   4. Ouvre la page dans Chromium sans interface, attend le chargement des polices, et capture le PNG.
 *
 * Le HTML rempli est écrit dans un fichier temporaire à côté du template (templates/.tmp-*.html, ignoré
 * par git) et ouvert avec une URL file:// : c'est ce qui permet à Chromium de charger les polices et le logo
 * par leurs chemins relatifs. Le fichier temporaire est supprimé à la fin, même en cas d'erreur.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = { template: "templates/post-feed.html", data: null, out: null, scale: 1, format: "png", quality: 90, set: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--template") args.template = next();
    else if (a === "--data") args.data = next();
    else if (a === "--out") args.out = next();
    else if (a === "--scale") args.scale = Number(next());
    else if (a === "--format") args.format = next();
    else if (a === "--quality") args.quality = Number(next());
    else if (a === "--set") {
      const kv = next() || "";
      const eq = kv.indexOf("=");
      if (eq > 0) args.set[kv.slice(0, eq)] = kv.slice(eq + 1);
    } else if (a === "--help" || a === "-h") {
      console.log(fs.readFileSync(__filename, "utf8").split("*/")[0].replace(/^\/\*\*?/, ""));
      process.exit(0);
    } else {
      throw new Error(`Option inconnue : ${a}`);
    }
  }
  return args;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Remplace les {{cle}} et retire les blocs data-if dont la valeur est vide. */
function fillTemplate(html, data) {
  // Blocs optionnels : on supprime l'élément complet (balise ouvrante → balise fermante correspondante).
  html = html.replace(
    /<(\w+)([^>]*)\sdata-if="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/g,
    (match, tag, before, key, after, inner) => {
      const v = data[key];
      const empty = v === undefined || v === null || String(v).trim() === "";
      return empty ? "" : `<${tag}${before}${after}>${inner}</${tag}>`;
    }
  );
  // Variables.
  return html.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key) => {
    const v = data[key];
    if (v === undefined || v === null) return "";
    return escapeHtml(v);
  });
}

function readSize(html) {
  const m = html.match(/<meta\s+name="render-size"\s+content="(\d+)x(\d+)"/i);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : { width: 1080, height: 1350 };
}

async function render(opts) {
  const templatePath = path.resolve(ROOT, opts.template);
  if (!fs.existsSync(templatePath)) throw new Error(`Template introuvable : ${templatePath}`);

  let data = {};
  if (opts.data) {
    const dataPath = path.resolve(ROOT, opts.data);
    if (!fs.existsSync(dataPath)) throw new Error(`Fichier de données introuvable : ${dataPath}`);
    data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  }
  Object.assign(data, opts.set);

  // Toute image donnée en chemin relatif au dépôt (bg_image, photo_main, photo_1, object_image…) devient
  // un chemin absolu file:// : c'est ce qui permet à Chromium de la charger depuis le fichier temporaire.
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== "string" || !/\.(png|jpe?g|webp|gif|svg)$/i.test(value) || /^(https?:|data:|file:)/.test(value)) continue;
    const abs = path.resolve(ROOT, value);
    if (!fs.existsSync(abs)) throw new Error(`Image introuvable pour « ${key} » : ${abs}`);
    data[key] = "file://" + abs;
  }

  const raw = fs.readFileSync(templatePath, "utf8");
  const size = readSize(raw);
  const html = fillTemplate(raw, data);

  const outPath = path.resolve(
    ROOT,
    opts.out ||
      path.join("output", `${path.basename(templatePath, ".html")}-${new Date().toISOString().replace(/[:.]/g, "-")}.png`)
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  // Fichier temporaire à côté du template, pour que les chemins relatifs (../assets/...) fonctionnent.
  const tmpPath = path.join(
    path.dirname(templatePath),
    `.tmp-${path.basename(templatePath, ".html")}-${process.pid}-${Date.now()}.html`
  );
  fs.writeFileSync(tmpPath, html, "utf8");

  const { chromium } = require("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: opts.scale || 1 });
    page.on("pageerror", (e) => console.warn("Erreur dans la page :", e.message));
    page.on("requestfailed", (r) => console.warn("Ressource non chargée :", r.url()));
    await page.goto("file://" + tmpPath, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    // Vérifie que toutes les images (logo, fond) sont bien chargées.
    const broken = await page.evaluate(() =>
      Array.from(document.images).filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute("src"))
    );
    if (broken.length) console.warn("Images non chargées :", broken.join(", "));
    await page.waitForTimeout(150);
    const jpeg = (opts.format || "png") === "jpeg" || /\.jpe?g$/i.test(outPath);
    await page.screenshot({ path: outPath, type: jpeg ? "jpeg" : "png", ...(jpeg ? { quality: opts.quality || 90 } : {}), clip: { x: 0, y: 0, ...size } });
  } finally {
    await browser.close();
    fs.rmSync(tmpPath, { force: true });
  }
  return { outPath, size };
}

if (require.main === module) {
  const opts = parseArgs(process.argv.slice(2));
  render(opts)
    .then(({ outPath, size }) => {
      console.log(`Image produite : ${path.relative(ROOT, outPath)} (${size.width}×${size.height})`);
    })
    .catch((err) => {
      console.error("Échec du rendu :", err.message);
      process.exit(1);
    });
}

module.exports = { render, fillTemplate, readSize };
