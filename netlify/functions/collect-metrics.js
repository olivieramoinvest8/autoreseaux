/**
 * Fonction planifiée (voir netlify.toml, chaque nuit) : relève les mesures des posts publiés depuis 35 jours
 * (Facebook et Instagram) et les range dans social.metrics, une ligne par post, réseau et nombre de jours après
 * publication. C'est la matière de l'onglet Performances et du bilan lu par la routine avant chaque proposition.
 */
const { supabase, logEvent } = require("./_lib/supabase");
const { collectPost } = require("./_lib/metrics");
const { json } = require("./_lib/http");

exports.handler = async () => {
  const db = supabase();
  const since = new Date(Date.now() - 35 * 86400 * 1000).toISOString();
  const { data: posts, error } = await db.from("posts").select("id, type, published_at, external_ids").in("status", ["published", "partial"]).gte("published_at", since);
  if (error) return json(500, { error: error.message });
  let ok = 0, ko = 0; const problems = [];
  for (const post of posts || []) {
    if (!post.external_ids || !Object.keys(post.external_ids).length) continue;
    const days = Math.max(0, Math.floor((Date.now() - new Date(post.published_at).getTime()) / 86400000));
    try {
      const rows = await collectPost(post);
      for (const r of rows) {
        if (r.error) { ko++; problems.push(`${post.id} ${r.network} : ${r.error}`); continue; }
        const { error: ue } = await db.from("metrics").upsert({ post_id: post.id, network: r.network, days_after: days, measured_at: new Date().toISOString(), views: r.views, likes: r.likes, comments: r.comments, shares: r.shares, saves: r.saves ?? null, link_clicks: r.clicks ?? null, raw: { reach: r.reach, ...r.raw } }, { onConflict: "post_id,network,days_after" });
        if (ue) { ko++; problems.push(`${post.id} ${r.network} : ${ue.message}`); } else ok++;
      }
    } catch (e) { ko++; problems.push(`${post.id} : ${e.message}`); }
  }
  await logEvent("netlify", ko ? "warn" : "info", `Mesures relevées : ${ok} lignes, ${ko} échecs`, { problems: problems.slice(0, 10) });
  return json(200, { ok: true, lignes: ok, echecs: ko, problems });
};
