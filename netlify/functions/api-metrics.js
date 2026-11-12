/**
 * GET /api/api-metrics → posts publiés (60 derniers jours) avec leurs dernières mesures, le bilan par format, segment,
 * type, heure et réseau, les abonnés de chaque compte et les retours d'Olivier (part gardée, motifs de refus).
 * Mot de passe requis.
 */
const { supabase } = require("./_lib/supabase");
const { json, requireDashboard } = require("./_lib/http");
const { summarize } = require("./_lib/metrics");
const { feedback, formatFamily } = require("./_lib/feedback");

exports.handler = async (event) => {
  const denied = requireDashboard(event);
  if (denied) return denied;
  const db = supabase();
  const since = new Date(Date.now() - 60 * 86400 * 1000).toISOString();
  const { data: all, error } = await db.from("posts").select("id, type, segment, theme, status, created_at, features, published_at, external_ids, reject_category, reject_reason, error, brand:brands(slug, name)").gte("created_at", since).order("created_at", { ascending: false }).limit(500);
  if (error) return json(500, { error: error.message });
  const posts = (all || []).filter((p) => ["published", "partial"].includes(p.status) && p.published_at).sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  const ids = posts.map((p) => p.id);
  const { data: rows } = ids.length ? await db.from("metrics").select("*").in("post_id", ids) : { data: [] };
  const bilan = summarize(posts, rows || []);
  const { data: stats } = await db.from("account_stats").select("network, day, followers").gte("day", new Date(Date.now() - 35 * 86400 * 1000).toISOString().slice(0, 10)).order("day", { ascending: false });
  const comptes = {};
  for (const net of ["facebook", "instagram"]) {
    const serie = (stats || []).filter((s) => s.network === net && typeof s.followers === "number");
    if (!serie.length) continue;
    const at = (days) => { const limit = new Date(Date.now() - days * 86400 * 1000).toISOString().slice(0, 10); const s = serie.find((x) => x.day <= limit); return s ? s.followers : null; };
    const cur = serie[0].followers; const d7 = at(7), d30 = at(30);
    comptes[net] = { abonnes: cur, releve_le: serie[0].day, evolution_7_jours: d7 === null ? null : cur - d7, evolution_30_jours: d30 === null ? null : cur - d30 };
  }
  return json(200, {
    posts: posts.map((p) => ({ id: p.id, type: p.type, segment: p.segment, theme: p.theme, published_at: p.published_at, brand: p.brand, format: formatFamily(p.features && p.features.format), mesures: (bilan.par_post[p.id] || {}).networks || {}, engagement: (bilan.par_post[p.id] || {}).engagement ?? null, reach: (bilan.par_post[p.id] || {}).reach ?? null })),
    bilan: { posts_mesures: bilan.posts_mesures, portee_mesuree: bilan.portee_mesuree, seuil_fiable: bilan.seuil_fiable, par_format: bilan.par_format, par_segment: bilan.par_segment, par_type: bilan.par_type, par_heure: bilan.par_heure, par_reseau: bilan.par_reseau, meilleurs: bilan.meilleurs },
    comptes, retours: feedback(all || []),
  });
};
