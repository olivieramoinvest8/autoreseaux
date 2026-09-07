/**
 * POST /api/post-action  { id, action: "approve" | "reject" | "update", texts?: {text_fb,…}, networks?: [] }
 * - update  : enregistre les textes modifiés dans le tableau de bord
 * - reject  : statut rejected
 * - approve : statut approved puis lance la publication en arrière-plan (publish-background)
 */
const { supabase, logEvent } = require("./_lib/supabase");
const { json, parseBody, requireDashboard, dashboardUrl } = require("./_lib/http");
const { approvePost } = require("./_lib/publish");

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
  return json(400, { error: `action inconnue : ${body.action}` });
};
