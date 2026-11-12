/**
 * Fonction planifiée (voir netlify.toml, chaque nuit) : relève les mesures des posts publiés depuis 35 jours
 * (Facebook et Instagram) et les range dans social.metrics, une ligne par post, réseau et nombre de jours après
 * publication. Relève aussi le nombre d'abonnés de chaque compte (social.account_stats, une ligne par jour) :
 * c'est le thermomètre de la notoriété. Matière de l'onglet Performances et du bilan lu par la routine.
 */
const { supabase, logEvent } = require("./_lib/supabase");
const { collectPost } = require("./_lib/metrics");
const meta = require("./_lib/publish/meta");
const { json } = require("./_lib/http");

exports.handler = async () => {
  const db = supabase();
  const since = new Date(Date.now() - 35 * 86400 * 1000).toISOString();
  const { data: posts, error } = await db.from("posts").select("id, type, published_at, external_ids").in("status", ["published", "partial"]).gte("published_at", since);
  if (error) return json(500, { error: error.message });
  let ok = 0, ko = 0, withReach = 0; const problems = []; const insightErrors = {};
  for (const post of posts || []) {
    if (!post.external_ids || !Object.keys(post.external_ids).length) continue;
    const days = Math.max(0, Math.floor((Date.now() - new Date(post.published_at).getTime()) / 86400000));
    try {
      const rows = await collectPost(post);
      for (const r of rows) {
        if (r.error) { ko++; problems.push(`${post.id} ${r.network} : ${r.error}`); continue; }
        if (typeof r.reach === "number") withReach++;
        if (r.raw && r.raw.insights_error) insightErrors[`${r.network} : ${r.raw.insights_error.slice(0, 160)}`] = (insightErrors[`${r.network} : ${r.raw.insights_error.slice(0, 160)}`] || 0) + 1;
        const { error: ue } = await db.from("metrics").upsert({ post_id: post.id, network: r.network, days_after: days, measured_at: new Date().toISOString(), views: r.views, likes: r.likes, comments: r.comments, shares: r.shares, saves: r.saves ?? null, link_clicks: r.clicks ?? null, raw: { reach: r.reach, ...r.raw } }, { onConflict: "post_id,network,days_after" });
        if (ue) { ko++; problems.push(`${post.id} ${r.network} : ${ue.message}`); } else ok++;
      }
    } catch (e) { ko++; problems.push(`${post.id} : ${e.message}`); }
  }

  // Abonnés du jour (marque AMO Invest : c'est elle que les variables META_* désignent).
  let followers = {};
  try {
    const { data: brand } = await db.from("brands").select("id").eq("slug", "amo-invest").maybeSingle();
    const day = new Date().toISOString().slice(0, 10);
    for (const s of brand ? await meta.accountStats() : []) {
      followers[s.network] = s.followers;
      if (s.followers === null) { problems.push(`abonnés ${s.network} : ${(s.raw && s.raw._error) || "valeur absente"}`); continue; }
      const { error: se } = await db.from("account_stats").upsert({ brand_id: brand.id, network: s.network, day, followers: s.followers, raw: s.raw, measured_at: new Date().toISOString() }, { onConflict: "brand_id,network,day" });
      if (se) problems.push(`abonnés ${s.network} : ${se.message}`);
    }
  } catch (e) { problems.push(`abonnés : ${e.message}`); }

  // Sans portée, le bilan ne repose que sur les « j'aime » : on le dit en clair dans le journal, avec la cause.
  const causes = Object.entries(insightErrors).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} (${n} fois)`);
  const level = ko || (ok && !withReach) ? "warn" : "info";
  await logEvent("netlify", level, `Mesures relevées : ${ok} lignes, ${ko} échecs, portée connue pour ${withReach} lignes`, { problems: problems.slice(0, 10), causes_portee_absente: causes, abonnes: followers });
  return json(200, { ok: true, lignes: ok, echecs: ko, avec_portee: withReach, abonnes: followers, causes_portee_absente: causes, problems });
};
