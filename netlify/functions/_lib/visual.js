/**
 * Fabrication d'un visuel côté Netlify : template HTML → JPEG, sans Playwright.
 *
 * Utilisé par render-visual-background quand Olivier change les photos d'un visuel dans le tableau de bord.
 * Le rendu local (render/render-image.js) reste la voie principale ; ici on refait la même chose dans une
 * fonction Netlify avec puppeteer-core et un Chromium allégé pour AWS Lambda (@sparticuz/chromium-min), dont
 * le paquet est téléchargé une fois par instance dans /tmp (une vingtaine de secondes au premier appel).
 *
 * Étapes : 1) lit le template et remplit les {{cle}} (même moteur que render-image.js) ; 2) remplace les polices
 * et le logo par leur contenu encodé (data:), car la fonction ne peut pas servir de fichiers ; 3) ouvre la page
 * dans Chromium, attend les images (les photos sont des URL publiques), capture en JPEG.
 */
const fs = require("fs");
const path = require("path");
const { fillTemplate, readSize } = require("../../../render/render-image");

const CHROMIUM_PACK = process.env.CHROMIUM_PACK_URL || "https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar";

/** Racine du dépôt telle que vue par la fonction (fichiers inclus via included_files) ou en local. */
function root() {
  const candidates = [path.resolve(__dirname, "../../.."), process.cwd(), "/var/task"];
  for (const c of candidates) if (fs.existsSync(path.join(c, "templates")) && fs.existsSync(path.join(c, "assets"))) return c;
  throw new Error("dossiers templates/ et assets/ introuvables dans la fonction");
}

const MIME = { ".ttf": "font/ttf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
function dataUri(abs) {
  const type = MIME[path.extname(abs).toLowerCase()] || "application/octet-stream";
  return `data:${type};base64,${fs.readFileSync(abs).toString("base64")}`;
}

/** HTML complet, autonome, prêt à être capturé. `template` = "templates/annonce-feed.html". */
function buildHtml(template, data) {
  const base = root();
  const tplPath = path.join(base, template);
  if (!fs.existsSync(tplPath)) throw new Error(`template introuvable : ${template}`);
  const raw = fs.readFileSync(tplPath, "utf8");
  const size = readSize(raw);
  let html = fillTemplate(raw, data);
  // Remplace chaque ../assets/… par son contenu encodé.
  html = html.replace(/\.\.\/assets\/([\w./-]+)/g, (m, rel) => {
    const abs = path.join(base, "assets", rel);
    return fs.existsSync(abs) ? dataUri(abs) : m;
  });
  return { html, size };
}

async function launchBrowser() {
  const puppeteer = require("puppeteer-core");
  if (process.env.RENDER_CHROME_PATH) {
    return puppeteer.launch({ executablePath: process.env.RENDER_CHROME_PATH, headless: true, args: ["--no-sandbox", "--disable-gpu", "--disable-background-networking", "--disable-component-update"] });
  }
  const chromium = require("@sparticuz/chromium-min");
  return puppeteer.launch({
    args: puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
    executablePath: await chromium.executablePath(CHROMIUM_PACK),
    headless: "shell",
  });
}

/** Rend un template avec ses données et renvoie un Buffer JPEG. */
async function renderJpeg(template, data, { quality = 90 } = {}) {
  const { html, size } = buildHtml(template, data);
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: size.width, height: size.height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "load", timeout: 90000 });
    await page.evaluate(() => document.fonts.ready);
    // Attend que toutes les images (balises et fonds CSS) soient chargées, 60 s au plus.
    const broken = await page.evaluate(async () => {
      const urls = new Set();
      document.querySelectorAll("img").forEach((i) => urls.add(i.currentSrc || i.src));
      for (const el of document.querySelectorAll("*")) {
        const bg = getComputedStyle(el).backgroundImage || "";
        for (const m of bg.matchAll(/url\((['"]?)(.*?)\1\)/g)) urls.add(m[2]);
      }
      const load = (u) => new Promise((res) => { const im = new Image(); im.onload = () => res(null); im.onerror = () => res(u); im.src = u; setTimeout(() => res(im.complete && im.naturalWidth ? null : u), 60000); });
      return (await Promise.all(Array.from(urls).filter(Boolean).map(load))).filter(Boolean);
    });
    if (broken.length) throw new Error(`images non chargées : ${broken.map((u) => u.slice(0, 80)).slice(0, 3).join(", ")}`);
    await new Promise((r) => setTimeout(r, 200));
    return await page.screenshot({ type: "jpeg", quality, clip: { x: 0, y: 0, width: size.width, height: size.height } });
  } finally {
    await browser.close();
  }
}

module.exports = { buildHtml, renderJpeg, root };
