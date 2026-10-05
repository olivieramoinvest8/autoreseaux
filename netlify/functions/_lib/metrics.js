/**
 * Mesures des posts publiés (Facebook, Instagram) via l'API Graph, avec le jeton de page.
 *
 * Ce que le jeton actuel permet : « j'aime », commentaires, partages (pages_read_engagement, instagram_basic).
 * Ce qui demande deux droits de plus sur le jeton (à cocher dans Business Manager quand Olivier le régénère) :
 *   - read_insights            → portée (personnes atteintes) et clics des posts Facebook, vues des vidéos
 *   - instagram_manage_insights → portée, enregistrements et partages des posts Instagram
 * Sans ces droits, les champs concernés restent vides : on garde ce qu'on obtient, on ne bloque jamais.
 *
 * summarize() : bilan par format, segment et type (moyenne d'engagement = j'aime + commentaires + partages +
 * enregistrements), lu par la routine (bot-recent) et par l'onglet Performances.
 */
const meta = require("./publish/meta");

async function tryGraph(path, params) {
  try { return await meta.graph(path, params, "GET"); } catch (e) { return { _error: e.message }; }
}

function insightValue(insights, name) {
  const d = insights && insights.data;
  if (!Array.isArray(d)) return null;
  const m = d.find((x) => x.name === name);
  const v = m && m.values && m.values[0] && m.values[0].value;
  return typeof v === "number" ? v : v && typeof v === "object" ? Object.values(v).reduce((a, b) => a + b, 0) : null;
}

/** Facebook : id de post (page_post) ou id de vidéo. */
async function facebook(id, isVideo) {
  const out = { likes: null, comments: null, shares: null, views: null, reach: null, clicks: null, raw: {} };
  let base = await tryGraph(`/${id}`, { fields: "likes.summary(true),comments.summary(true)" + (isVideo ? "" : ",shares") });
  if (base._error && isVideo) {
    // Une vidéo de page refuse parfois « likes » sur l'objet lui-même (#200) : on lit les compteurs sur les arêtes.
    const likes = await tryGraph(`/${id}/likes`, { summary: "true", limit: "0" });
    const comments = await tryGraph(`/${id}/comments`, { summary: "true", limit: "0" });
    base = { likes: likes._error ? null : likes, comments: comments._error ? null : comments, _partial: base._error };
    if (likes._error && comments._error) return { ...out, error: base._partial };
  } else if (base._error) return { ...out, error: base._error };
  out.likes = base.likes && base.likes.summary ? base.likes.summary.total_count : null;
  out.comments = base.comments && base.comments.summary ? base.comments.summary.total_count : null;
  out.shares = base.shares ? base.shares.count : null;
  out.raw.base = base;
  const ins = isVideo
    ? await tryGraph(`/${id}/video_insights`, { metric: "total_video_views,total_video_impressions_unique" })
    : await tryGraph(`/${id}/insights`, { metric: "post_impressions_unique,post_clicks" });
  if (!ins._error) {
    out.views = insightValue(ins, "total_video_views");
    out.reach = insightValue(ins, isVideo ? "total_video_impressions_unique" : "post_impressions_unique");
    out.clicks = insightValue(ins, "post_clicks");
    out.raw.insights = ins;
  } else out.raw.insights_error = ins._error;
  return out;
}

/** Instagram : id de média (image, carrousel ou reel). */
async function instagram(id) {
  const out = { likes: null, comments: null, shares: null, saves: null, views: null, reach: null, raw: {} };
  const base = await tryGraph(`/${id}`, { fields: "like_count,comments_count,media_type,media_product_type" });
  if (base._error) return { ...out, error: base._error };
  out.likes = base.like_count ?? null; out.comments = base.comments_count ?? null; out.raw.base = base;
  const reel = base.media_product_type === "REELS" || base.media_type === "VIDEO";
  const ins = await tryGraph(`/${id}/insights`, { metric: reel ? "reach,saved,shares,plays" : "reach,saved,shares" });
  if (!ins._error) {
    out.reach = insightValue(ins, "reach"); out.saves = insightValue(ins, "saved"); out.shares = insightValue(ins, "shares");
    out.views = insightValue(ins, "plays"); out.raw.insights = ins;
  } else out.raw.insights_error = ins._error;
  return out;
}

/** Mesure un post : renvoie une ligne par réseau publié. */
async function collectPost(post) {
  const ext = post.external_ids || {}; const rows = [];
  if (ext.facebook) rows.push({ network: "facebook", ...(await facebook(ext.facebook, post.type !== "image" || !String(ext.facebook).includes("_"))) });
  if (ext.instagram) rows.push({ network: "instagram", ...(await instagram(ext.instagram)) });
  return rows;
}

function engagement(m) { return (m.likes || 0) + (m.comments || 0) + (m.shares || 0) + (m.saves || 0); }

/** Dernière mesure par (post, réseau) parmi des lignes de social.metrics. */
function latestByPost(rows) {
  const map = {};
  for (const r of rows) {
    const k = `${r.post_id}|${r.network}`;
    if (!map[k] || new Date(r.measured_at) > new Date(map[k].measured_at)) map[k] = r;
  }
  return Object.values(map);
}

/** Bilan : moyenne d'engagement par format, segment et type, et les meilleurs posts. */
function summarize(posts, metricRows) {
  const latest = latestByPost(metricRows);
  const byPost = {};
  for (const m of latest) {
    const p = byPost[m.post_id] || (byPost[m.post_id] = { engagement: 0, reach: 0, networks: {} });
    p.engagement += engagement(m); p.reach += m.reach || (m.raw && m.raw.reach) || 0;
    p.networks[m.network] = { likes: m.likes, comments: m.comments, shares: m.shares, saves: m.saves, views: m.views, reach: m.reach, days_after: m.days_after };
  }
  const group = (key) => {
    const g = {};
    for (const post of posts) {
      const s = byPost[post.id]; if (!s) continue;
      const k = key(post) || "?"; const e = g[k] || (g[k] = { cle: k, posts: 0, engagement: 0, reach: 0 });
      e.posts++; e.engagement += s.engagement; e.reach += s.reach;
    }
    return Object.values(g).map((e) => ({ ...e, engagement_moyen: Math.round((e.engagement / e.posts) * 10) / 10, reach_moyen: Math.round(e.reach / e.posts) })).sort((a, b) => b.engagement_moyen - a.engagement_moyen);
  };
  const meilleurs = posts.filter((p) => byPost[p.id]).map((p) => ({ id: p.id, theme: p.theme, type: p.type, format: p.features && p.features.format, segment: p.segment, engagement: byPost[p.id].engagement, reach: byPost[p.id].reach }))
    .sort((a, b) => b.engagement - a.engagement).slice(0, 5);
  return { posts_mesures: Object.keys(byPost).length, par_format: group((p) => p.features && p.features.format), par_segment: group((p) => p.segment), par_type: group((p) => p.type), meilleurs, par_post: byPost };
}

module.exports = { collectPost, summarize, latestByPost, engagement };
