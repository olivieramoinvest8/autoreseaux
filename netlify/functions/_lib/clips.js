/**
 * Catégories des clips de basket (brands/basket/clips.json) et validation de ce que le tableau de bord envoie.
 * Un clip = { path, category, who, note, publiable }. Une catégorie inconnue est refusée ; « publiable » suit la catégorie.
 */
const fs = require("fs");
const path = require("path");

function load() {
  const candidates = [path.resolve(__dirname, "../../../brands/basket/clips.json"), path.resolve(process.cwd(), "brands/basket/clips.json")];
  for (const c of candidates) if (fs.existsSync(c)) return JSON.parse(fs.readFileSync(c, "utf8"));
  throw new Error("brands/basket/clips.json introuvable");
}

/** Normalise la liste envoyée par le formulaire (une entrée par fichier, même ordre) ; renvoie { clips } ou { error }. */
function normalize(meta, files) {
  const { categories, qui } = load();
  const cats = new Map(categories.map((c) => [c.id, c]));
  const whos = new Set(qui.map((q) => q.id));
  const clips = [];
  for (let i = 0; i < files.length; i++) {
    const m = (meta && meta[i]) || {};
    const cat = cats.get(m.category);
    if (!cat) return { error: `clip ${i + 1} (${files[i].split("/").pop()}) : catégorie manquante ou inconnue` };
    const who = whos.has(m.who) ? m.who : "fils";
    clips.push({ path: files[i], category: cat.id, phase: cat.phase, who, note: String(m.note || "").slice(0, 120) || null, publiable: cat.publiable });
  }
  return { clips };
}

module.exports = { load, normalize };
