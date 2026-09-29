/** GET /api/api-metrics → posts publiés (60 derniers jours) avec leurs dernières mesures et le bilan par format, segment, type. Mot de passe requis. */
const { supabase } = require("./_lib/supabase");
const { json, requireDashboard } = require("./_lib/http");
const { summarize } = require("./_lib/metrics");

exports.handler = async (event) => {
  const denied = requireDashboard(event);
  if (denied) return denied;
  const db = supabase();
  const since = new Date(Date.now() - 60 * 86400 * 1000).toISOString();
  const { data: posts, error } = await db.from("posts").select("id, type, segment, theme, features, published_at, external_ids, brand:brands(slug, name)").in("status", ["published", "partial"]).gte("published_at", since).order("published_at", { ascending: false });
  if (error) return json(500, { error: error.message });
  const ids = (posts || []).map((p) => p.id);
  const { data: rows } = ids.length ? await db.from("metrics").select("*").in("post_id", ids) : { data: [] };
  const bilan = summarize(posts || [], rows || []);
  return json(200, { posts: (posts || []).map((p) => ({ ...p, mesures: (bilan.par_post[p.id] || {}).networks || {}, engagement: (bilan.par_post[p.id] || {}).engagement ?? null })), bilan: { posts_mesures: bilan.posts_mesures, par_format: bilan.par_format, par_segment: bilan.par_segment, par_type: bilan.par_type, meilleurs: bilan.meilleurs } });
};
