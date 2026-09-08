/**
 * Fonction d'arrière-plan (jusqu'à 15 minutes) : refait le visuel d'un post après un changement de photos
 * dans le tableau de bord. POST { id, secret }.
 *
 * Le post porte dans features.visual la recette de son visuel :
 *   { renders: [ { template: "templates/annonce-feed.html", target: "media_url", name: "annonce-458-feed" },
 *                { template: "templates/annonce-story.html", target: "extra_media.0", name: "annonce-458-story" } ],
 *     data: { …clés du template, photo_main, photo_1… }, status: "rendering" | "ok" | "error", rendered_at }
 * Pour chaque rendu : template + data → JPEG → bucket public « visuels » → mise à jour du post.
 */
const { supabase, logEvent } = require("./_lib/supabase");
const { safeEqual } = require("./_lib/http");
const { renderJpeg } = require("./_lib/visual");

function setPath(obj, target, value) {
  const parts = target.split(".");
  if (parts.length === 1) { obj[target] = value; return; }
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = /^\d+$/.test(parts[i]) ? Number(parts[i]) : parts[i];
    if (cur[k] === undefined || cur[k] === null) cur[k] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    cur = cur[k];
  }
  const last = parts[parts.length - 1];
  const key = /^\d+$/.test(last) ? Number(last) : last;
  if (Array.isArray(cur) && typeof cur[key] === "object" && cur[key]) cur[key] = { ...cur[key], url: value };
  else cur[key] = value;
}

exports.handler = async (event) => {
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}
  if (!safeEqual(body.secret, process.env.INTERNAL_SECRET)) return { statusCode: 401, body: "" };
  if (!body.id) return { statusCode: 400, body: "" };
  const db = supabase();
  const { data: post } = await db.from("posts").select("*, brand:brands(slug, name)").eq("id", body.id).maybeSingle();
  const visual = post && post.features && post.features.visual;
  if (!visual || !Array.isArray(visual.renders) || !visual.renders.length) {
    await logEvent("netlify", "warn", "Refabrication ignorée : pas de recette de visuel", null, body.id);
    return { statusCode: 200, body: "" };
  }
  const features = { ...post.features };
  try {
    const patch = {};
    const extra = Array.isArray(post.extra_media) ? post.extra_media.map((e) => ({ ...e })) : [];
    for (const r of visual.renders) {
      const jpeg = await renderJpeg(r.template, visual.data || {});
      const key = `${post.brand.slug}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${(r.name || "visuel").replace(/[^a-z0-9._-]+/gi, "-")}.jpg`;
      const { error } = await db.storage.from("visuels").upload(key, jpeg, { contentType: "image/jpeg", upsert: false });
      if (error) throw new Error(`upload : ${error.message}`);
      const url = db.storage.from("visuels").getPublicUrl(key).data.publicUrl;
      if (r.target === "media_url") patch.media_url = url;
      else if (r.target.startsWith("extra_media.")) setPath({ extra_media: extra }, r.target, url);
    }
    if (extra.length) patch.extra_media = extra;
    features.visual = { ...visual, status: "ok", rendered_at: new Date().toISOString(), error: null };
    await db.from("posts").update({ ...patch, features }).eq("id", post.id);
    await logEvent("netlify", "info", "Visuel refait avec les nouvelles photos", { media_url: patch.media_url }, post.id);
  } catch (e) {
    features.visual = { ...visual, status: "error", error: e.message };
    await db.from("posts").update({ features }).eq("id", post.id);
    await logEvent("netlify", "error", `Refabrication du visuel échouée : ${e.message}`, null, post.id);
  }
  return { statusCode: 200, body: "" };
};
