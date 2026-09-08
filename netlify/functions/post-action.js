/**
 * POST /api/post-action  { id, action, texts?: {text_fb,…}, networks?: [], scheduled_at? }
 * - update     : enregistre les textes modifiés dans le tableau de bord
 * - reject     : statut rejected
 * - approve    : statut approved puis publication immédiate en arrière-plan (publish-background) ;
 *                accepté aussi depuis error (relance) et approved programmé (« publier maintenant »)
 * - schedule   : statut approved + scheduled_at (ISO, dans le futur) ; publish-scheduled publiera à l'heure
 * - unschedule : annule la programmation ou l'erreur, retour en brouillon
 * - rerender   : { photos: [url principale, vignette 1, 2, 3] } change les photos du visuel et lance sa refabrication
 *                (render-visual-background). Seules les photos du bien (table listings) sont acceptées.
 */
const { supabase, logEvent } = require("./_lib/supabase");
const { json, parseBody, requireDashboard, dashboardUrl } = require("./_lib/http");
const { approvePost, unschedulePost } = require("./_lib/publish");

exports.handler = async (event) => {
  const denied = requireDashboard(event);
  if (denied) return denied;
  if (event.httpMethod !== "POST") return json(405, { error: "POST attendu" });
  const body = parseBody(event);
  if (!body.id || !body.action) return json(400, { error: "id et action requis" });
  const db = supabase();

  if (body.action === "update") {
    const allowed = ["text_fb", "text_ig", "text_tiktok", "text_youtube", "hashtags", "networks"];
    const patch = {};
    for (const k of allowed) if (body[k] !== undefined) patch[k] = body[k];
    const { error } = await db.from("posts").update(patch).eq("id", body.id);
    if (error) return json(500, { error: error.message });
    await logEvent("dashboard", "info", "Textes modifiés", patch, body.id);
    return json(200, { ok: true });
  }
  if (body.action === "reject") {
    const { error } = await db.from("posts").update({ status: "rejected", error: body.reason || null }).eq("id", body.id);
    if (error) return json(500, { error: error.message });
    await logEvent("dashboard", "info", "Post refusé", { reason: body.reason || null }, body.id);
    return json(200, { ok: true });
  }
  if (body.action === "approve") {
    const r = await approvePost(body.id, { via: "dashboard", baseUrl: dashboardUrl() });
    return json(r.ok ? 200 : 400, r);
  }
  if (body.action === "schedule") {
    if (!body.scheduled_at) return json(400, { error: "scheduled_at requis" });
    const r = await approvePost(body.id, { via: "dashboard", baseUrl: dashboardUrl(), scheduledAt: body.scheduled_at });
    if (r.ok && !r.scheduled_at) return json(400, { error: "L'heure choisie est déjà passée : utilisez « Publier maintenant »." });
    return json(r.ok ? 200 : 400, r);
  }
  if (body.action === "unschedule") {
    const r = await unschedulePost(body.id);
    return json(r.ok ? 200 : 400, r);
  }
  if (body.action === "rerender") {
    const { data: post } = await db.from("posts").select("id, status, features, listing_id, listing:listings(photos)").eq("id", body.id).maybeSingle();
    if (!post) return json(404, { error: "Post introuvable" });
    if (!["draft", "error", "approved"].includes(post.status)) return json(400, { error: `Ce post est « ${post.status} »` });
    const visual = post.features && post.features.visual;
    if (!visual || !visual.renders) return json(400, { error: "Ce post n'a pas de recette de visuel modifiable" });
    const allowed = new Set((post.listing && post.listing.photos) || []);
    const photos = Array.isArray(body.photos) ? body.photos.filter((u) => allowed.has(u)) : [];
    if (!photos.length) return json(400, { error: "Choisissez au moins la photo principale parmi les photos du bien" });
    const data = { ...(visual.data || {}), photo_main: photos[0], photo_1: photos[1] || "", photo_2: photos[2] || "", photo_3: photos[3] || "" };
    const features = { ...post.features, visual: { ...visual, data, status: "rendering", error: null, requested_at: new Date().toISOString() } };
    const { error } = await db.from("posts").update({ features }).eq("id", body.id);
    if (error) return json(500, { error: error.message });
    await logEvent("dashboard", "info", "Nouvelles photos choisies, visuel en cours de refabrication", { photos }, body.id);
    const base = dashboardUrl();
    if (!base || !process.env.INTERNAL_SECRET) return json(500, { error: "DASHBOARD_URL ou INTERNAL_SECRET manquant" });
    const res = await fetch(`${base}/.netlify/functions/render-visual-background`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: body.id, secret: process.env.INTERNAL_SECRET }) });
    if (res.status !== 202 && res.status !== 200) return json(500, { error: `refabrication non lancée (${res.status})` });
    return json(200, { ok: true });
  }
  return json(400, { error: `action inconnue : ${body.action}` });
};
