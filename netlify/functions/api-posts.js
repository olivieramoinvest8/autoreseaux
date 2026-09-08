/**
 * GET /api/api-posts?status=draft          → file d'attente : brouillons, posts programmés, posts en erreur (avec leur marque)
 * GET /api/api-posts?status=history        → 60 derniers posts validés, publiés, refusés ou en erreur
 * Mot de passe du tableau de bord requis (en-tête x-dashboard-key).
 */
const { supabase } = require("./_lib/supabase");
const { json, requireDashboard } = require("./_lib/http");

exports.handler = async (event) => {
  const denied = requireDashboard(event);
  if (denied) return denied;
  const status = (event.queryStringParameters || {}).status || "draft";
  let q = supabase().from("posts").select("*, brand:brands(slug, name, networks)").order("created_at", { ascending: false });
  if (status === "draft") q = q.or("status.eq.draft,status.eq.error,and(status.eq.approved,scheduled_at.not.is.null)");
  else q = q.in("status", ["approved", "published", "partial", "rejected", "error"]).limit(60);
  const { data, error } = await q;
  if (error) return json(500, { error: error.message });
  return json(200, { posts: data });
};
