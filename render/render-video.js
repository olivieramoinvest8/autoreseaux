#!/usr/bin/env node
/**
 * render/render-video.js — Vidéo verticale « photos animées » (1080×1920, format reel / story) à partir d'un JSON.
 *
 *   node render/render-video.js --data content/runs/<date>-video-458.json --out output/video-458.mp4 [--thumb output/video-458.jpg]
 *
 * Le JSON décrit la vidéo :
 *   {
 *     "format": "portrait",            // portrait 1080×1920 (reel, story) | landscape 1920×1080 (Facebook, YouTube) | feed 1080×1350
 *     "fit": "blur",                   // blur : photo entière, vide comblé par un fond flou de la même photo (jamais de noir) | cover : recadrage plein cadre
 *     "photos": ["output/assets/458/photo-4.jpg", "output/assets/458/photo-1.jpg", …],   // 3 à 6 photos du bien
 *     "seconds_per_photo": 4, "transition": 0.6, "fps": 30,
 *     "intro": { "template": "templates/post-story.html", "data": { … }, "seconds": 3 },      // carte d'ouverture (facultatif)
 *     "outro": { "template": "templates/annonce-story.html", "data": { … }, "seconds": 4 }   // carte de fin : prix, DPE, logo
 *   }
 * Chaque photo est animée (zoom lent avant ou arrière, panoramique gauche ou droite, en alternance), les plans
 * s'enchaînent en fondu, les cartes sont rendues avec les templates HTML du dépôt (render-image.js) puis posées
 * en ouverture et en fin. Une carte dont le format ne correspond pas à la vidéo (affiche 4:5 dans une vidéo paysage)
 * est posée entière sur un fond bleu marine de la charte. Règle d'Olivier (17 sept.) : jamais de zone vide, jamais de
 * photo tronquée aux deux tiers ; le format se choisit selon le réseau visé, pas selon les photos. Sortie : MP4 H.264, piste audio silencieuse (Instagram et Facebook l'exigent parfois),
 * « faststart » pour la lecture en ligne. Olivier ajoute la musique dans l'application s'il le souhaite.
 * ffmpeg vient du paquet npm ffmpeg-static (binaire téléchargé à l'installation), ou du système s'il est présent.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { render } = require("./render-image");

const ROOT = path.resolve(__dirname, "..");
function arg(name, def) { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : def; }

function ffmpegPath() {
  try { return require("ffmpeg-static"); } catch { return "ffmpeg"; }
}

/** Mouvement de caméra d'une photo : n = index de la photo, N = nombre de frames du plan. */
function motion(n, N) {
  const t = `on/${N}`; // 0 → 1 au fil du plan
  switch (n % 4) {
    case 0: return { z: `1+0.10*${t}`, x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" };            // zoom avant, centré
    case 1: return { z: `1.10-0.10*${t}`, x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" };         // zoom arrière, centré
    case 2: return { z: "1.08", x: `(iw-iw/zoom)*${t}`, y: "ih/2-(ih/zoom/2)" };                 // panoramique vers la droite
    default: return { z: "1.08", x: `(iw-iw/zoom)*(1-${t})`, y: "ih/2-(ih/zoom/2)" };            // panoramique vers la gauche
  }
}

async function main() {
  const dataPath = arg("--data"); const out = path.resolve(ROOT, arg("--out", "output/video.mp4")); const thumb = arg("--thumb");
  if (!dataPath) throw new Error("--data <fichier.json> est requis");
  const spec = JSON.parse(fs.readFileSync(path.resolve(ROOT, dataPath), "utf8"));
  const FORMATS = { portrait: [1080, 1920], landscape: [1920, 1080], feed: [1080, 1350] };
  const [W, H] = spec.width && spec.height ? [spec.width, spec.height] : FORMATS[spec.format || "portrait"] || FORMATS.portrait;
  const FPS = spec.fps || 30; const fit = spec.fit || "blur"; const NAVY = "0x2E358D";
  const per = spec.seconds_per_photo || 4, tr = spec.transition ?? 0.6;
  const photos = (spec.photos || []).map((p) => path.resolve(ROOT, p));
  if (!photos.length) throw new Error("le JSON doit contenir une liste « photos »");
  for (const p of photos) if (!fs.existsSync(p)) throw new Error(`photo introuvable : ${p}`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "amo-video-"));
  // 1) Cartes d'ouverture et de fin, rendues par les templates HTML.
  const plans = []; // { file, seconds, still }
  async function card(c, name) {
    if (!c || !c.template) return null;
    const png = path.join(tmp, `${name}.png`);
    await render({ template: c.template, set: c.data || {}, out: png });
    return { file: png, seconds: c.seconds || 3, still: true };
  }
  const intro = await card(spec.intro, "intro"); if (intro) plans.push(intro);
  photos.forEach((p) => plans.push({ file: p, seconds: per, still: false }));
  const outro = await card(spec.outro, "outro"); if (outro) plans.push(outro);

  // 2) Composition de chaque plan en une image fixe au double de la taille de sortie (mouvement sans tremblement) :
  //    photo → « blur » (entière sur fond flou) ou « cover » (recadrée plein cadre) ; carte → entière sur fond bleu marine.
  const ff = ffmpegPath();
  const W2 = W * 2, H2 = H * 2;
  plans.forEach((pl, i) => {
    const composed = path.join(tmp, `plan-${i}.png`);
    let filter;
    if (pl.still) filter = `color=c=${NAVY}:s=${W2}x${H2}[bg];[0:v]scale=${W2}:${H2}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,format=rgb24`;
    else if (fit === "cover") filter = `[0:v]scale=${W2}:${H2}:force_original_aspect_ratio=increase,crop=${W2}:${H2},format=rgb24`;
    else filter = `[0:v]split=2[a][b];[a]scale=${W2}:${H2}:force_original_aspect_ratio=increase,crop=${W2}:${H2},gblur=sigma=60,eq=brightness=-0.12:saturation=0.9[bg];[b]scale=${W2}:${H2}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,format=rgb24`;
    const c = spawnSync(ff, ["-y", "-hide_banner", "-loglevel", "error", "-i", pl.file, "-filter_complex", filter, "-frames:v", "1", composed], { stdio: ["ignore", "inherit", "inherit"] });
    if (c.status !== 0) throw new Error(`composition du plan ${i + 1} échouée`);
    pl.composed = composed;
  });

  // 3) Filtre ffmpeg : un plan animé par image composée, puis enchaînement en fondu (xfade).
  const inputs = []; const filters = [];
  plans.forEach((pl, i) => {
    inputs.push("-loop", "1", "-framerate", String(FPS), "-t", String(pl.seconds), "-i", pl.composed); // image fixe lue à FPS images/s
    const N = Math.round(pl.seconds * FPS);
    const m = pl.still ? { z: `1+0.02*on/${N}`, x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" } : motion(i, N);
    filters.push(`[${i}:v]zoompan=z='${m.z}':x='${m.x}':y='${m.y}':d=1:s=${W}x${H}:fps=${FPS},setsar=1,format=yuv420p[v${i}]`);
  });
  let last = "v0"; let offset = 0;
  for (let i = 1; i < plans.length; i++) {
    offset += plans[i - 1].seconds - tr;
    const outLabel = i === plans.length - 1 ? "vout" : `x${i}`;
    filters.push(`[${last}][v${i}]xfade=transition=fade:duration=${tr}:offset=${offset.toFixed(3)}[${outLabel}]`);
    last = outLabel;
  }
  if (plans.length === 1) filters.push(`[v0]null[vout]`);
  const total = plans.reduce((s, p) => s + p.seconds, 0) - tr * (plans.length - 1);

  fs.mkdirSync(path.dirname(out), { recursive: true });
  const args = ["-y", "-hide_banner", "-loglevel", "error", ...inputs, "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
    "-filter_complex", filters.join(";"), "-map", "[vout]", "-map", `${plans.length}:a`, "-t", total.toFixed(3),
    "-c:v", "libx264", "-preset", "medium", "-crf", "24", "-pix_fmt", "yuv420p", "-r", String(FPS), "-movflags", "+faststart",
    "-c:a", "aac", "-b:a", "64k", out];
  const t0 = Date.now();
  const r = spawnSync(ff, args, { stdio: ["ignore", "inherit", "inherit"] });
  if (r.status !== 0) throw new Error(`ffmpeg a échoué (code ${r.status})`);
  if (thumb) {
    const th = spawnSync(ff, ["-y", "-hide_banner", "-loglevel", "error", "-ss", "0.5", "-i", out, "-frames:v", "1", "-q:v", "3", path.resolve(ROOT, thumb)], { stdio: "inherit" });
    if (th.status !== 0) throw new Error("vignette non produite");
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  const mb = (fs.statSync(out).size / 1048576).toFixed(1);
  console.log(`Vidéo produite : ${path.relative(ROOT, out)} (${W}×${H} ${spec.format || "portrait"}, ${fit}, ${total.toFixed(1)} s, ${mb} Mo, ${Math.round((Date.now() - t0) / 1000)} s de calcul)${thumb ? ` + vignette ${thumb}` : ""}`);
}

if (require.main === module) main().catch((e) => { console.error("Erreur :", e.message); process.exit(1); });
module.exports = { main };
