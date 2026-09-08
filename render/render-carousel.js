#!/usr/bin/env node
/**
 * render/render-carousel.js — Produit toutes les slides d'un carrousel à partir d'un seul fichier JSON.
 *
 *   node render/render-carousel.js --data content/runs/2026-09-08-carrousel-447.json --dir output/creations
 *
 * Le JSON contient une liste `slides` ; chaque slide indique son template, le nom du PNG à produire (`out`)
 * et ses données (`data`, mêmes clés que le template). Chaque slide est rendue par render/render-image.js.
 * Le résultat : un PNG par slide dans le dossier `--dir`, dans l'ordre du fichier.
 */
const fs = require("fs");
const path = require("path");
const { render } = require("./render-image");

const ROOT = path.resolve(__dirname, "..");
function arg(name, def) { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : def; }

async function main() {
  const dataPath = arg("--data");
  if (!dataPath) throw new Error("--data <fichier.json> est requis");
  const dir = arg("--dir", "output");
  const spec = JSON.parse(fs.readFileSync(path.resolve(ROOT, dataPath), "utf8"));
  if (!Array.isArray(spec.slides) || !spec.slides.length) throw new Error("le JSON doit contenir une liste « slides »");
  const tmpDir = path.join(ROOT, "output", ".tmp");
  fs.mkdirSync(tmpDir, { recursive: true });
  const produced = [];
  for (const [i, slide] of spec.slides.entries()) {
    const tmp = path.join(tmpDir, `slide-${process.pid}-${i}.json`);
    fs.writeFileSync(tmp, JSON.stringify(slide.data || {}));
    try {
      const { outPath } = await render({ template: slide.template, data: path.relative(ROOT, tmp), out: path.join(dir, slide.out || `slide-${i + 1}.png`), set: {} });
      produced.push(path.relative(ROOT, outPath));
      console.log(`Slide ${i + 1}/${spec.slides.length} : ${path.relative(ROOT, outPath)}`);
    } finally { fs.rmSync(tmp, { force: true }); }
  }
  return produced;
}

if (require.main === module) {
  main().catch((e) => { console.error("Échec :", e.message); process.exit(1); });
}
module.exports = { main };
