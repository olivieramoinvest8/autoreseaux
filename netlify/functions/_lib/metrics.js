/**
 * Mesures des posts publiés (Facebook, Instagram) via l'API Graph, avec le jeton de page.
 *
 * Ce que le jeton permet sans droit particulier : « j'aime », commentaires, partages, nombre d'abonnés.
 * Ce qui demande deux droits de plus sur le jeton (à cocher dans Business Manager en le régénérant) :
 *   - read_insights             → personnes touchées, vues et clics des posts Facebook
 *   - instagram_manage_insights → personnes touchées, vues, enregistrements et partages des posts Instagram
 * Sans ces droits, les champs concernés restent vides : on garde ce qu'on obtient, on ne bloque jamais.
 *
 * Panne corrigée le 12 nov. 2026 : Meta a retiré en 2026 les mesures « impressions » (post_impressions_unique,
 * total_video_views, plays…). Une seule mesure inconnue faisait échouer tout l'appel, et la portée n'a jamais été
 * relevée. Désormais chaque valeur a plusieurs noms possibles (le nouveau d'abord, l'ancien ensuite) ; si l'appel
 * groupé est refusé, on redemande les mesures une par une et on retient celles que Meta ne connaît plus.
 *
 * summarize() : bilan par format, segment et type, lu par la routine (bot-recent) et par l'onglet Performances.
 */
const meta = require("./publish/meta");
const { formatFamily } = require("./feedback");

async function tryGraph(path, params) {
  try { return await meta.graph(path, params, "GET"); } catch (e) { return { _error: e.message }; }
}

/** Valeur d'une mesure, quel que soit son habillage (values[0].value, total_value.value, nombre ou détail par type). */
function metricValue(m) {
  let v = m && m.values && m.values[0] ? m.values[0].value : undefined;
  if (v === undefined && m && m.total_value) v = m.total_value.value;
  if (typeof v === "number") return v;
  if (v && typeof v === "object") return Object.values(v).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);
  return null;
}

const unknownMetrics = new Set(); // « chemin|mesure » refusés par Meta, retenus le temps de vie de l'instance
const isUnknownMetric = (msg) => /\(#100\)|valid insights metric|must be one of the following values/i.test(msg || "");

/**
 * Lit des mesures en tolérant les noms retirés. `kind` sert de clé de mémoire (« fb-post », « fb-video », « ig »).
 * Renvoie { values: { nom: nombre }, errors: [textes] }.
 */
async function readInsights(kind, path, names) {
  const out = { values: {}, errors: [] };
  const wanted = names.filter((n) => !unknownMetrics.has(`${kind}|${n}`));
  if (!wanted.length) return out;
  const take = (res) => { for (const m of Array.isArray(res.data) ? res.data : []) { const v = metricValue(m); if (v !== null) out.values[m.name] = v; } };
  const all = await tryGraph(path, { metric: wanted.join(",") });
  if (!all._error) { take(all); return out; }
  // Droit manquant, post supprimé… : inutile d'insister mesure par mesure.
  if (!isUnknownMetric(all._error)) { out.errors.push(all._error); return out; }
  for (const n of wanted) {
    const one = await tryGraph(path, { metric: n });
    if (!one._error) take(one);
    else if (isUnknownMetric(one._error)) unknownMetrics.add(`${kind}|${n}`);
    else out.errors.push(`${n} : ${one._error}`);
  }
  return out;
}

const first = (values, names) => { for (const n of names) if (typeof values[n] === "number") return values[n]; return null; };

// Noms possibles de chaque valeur, du plus récent au plus ancien.
const FB_POST = { reach: ["post_total_media_view_unique", "post_impressions_unique"], views: ["post_media_view", "post_impressions"], clicks: ["post_clicks"] };
const FB_VIDEO = { reach: ["post_total_media_view_unique", "total_video_views_unique", "total_video_impressions_unique", "post_impressions_unique"], views: ["post_media_view", "blue_reels_play_count", "total_video_views"] };
const IG_MEDIA = { reach: ["reach"], views: ["views"], saves: ["saved"], shares: ["shares"], interactions: ["total_interactions"] };
const allNames = (map) => Array.from(new Set(Object.values(map).flat()));

/** Facebook : id de post (photo, album) ou id de vidéo. */
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
  out.shares = base.shares ? base.shares.count : isVideo ? null : 0; // Facebook n'envoie « shares » que s'il y en a
  out.raw.base = base;
  const map = isVideo ? FB_VIDEO : FB_POST;
  const ins = await readInsights(isVideo ? "fb-video" : "fb-post", `/${id}/${isVideo ? "video_insights" : "insights"}`, allNames(map));
  out.reach = first(ins.values, map.reach);
  out.views = first(ins.values, map.views);
  out.clicks = map.clicks ? first(ins.values, map.clicks) : null;
  if (Object.keys(ins.values).length) out.raw.insights = ins.values;
  if (ins.errors.length) out.raw.insights_error = ins.errors.join(" | ").slice(0, 500);
  return out;
}

/** Instagram : id de média (image, carrousel ou reel). */
async function instagram(id) {
  const out = { likes: null, comments: null, shares: null, saves: null, views: null, reach: null, raw: {} };
  const base = await tryGraph(`/${id}`, { fields: "like_count,comments_count,media_type,media_product_type" });
  if (base._error) return { ...out, error: base._error };
  out.likes = base.like_count ?? null; out.comments = base.comments_count ?? null; out.raw.base = base;
  const ins = await readInsights(`ig-${base.media_product_type || base.media_type || "media"}`, `/${id}/insights`, allNames(IG_MEDIA));
  out.reach = first(ins.values, IG_MEDIA.reach); out.views = first(ins.values, IG_MEDIA.views);
  out.saves = first(ins.values, IG_MEDIA.saves); out.shares = first(ins.values, IG_MEDIA.shares);
  if (Object.keys(ins.values).length) out.raw.insights = ins.values;
  if (ins.errors.length) out.raw.insights_error = ins.errors.join(" | ").slice(0, 500);
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
const reachOf = (m) => (typeof m.reach === "number" ? m.reach : m.raw && typeof m.raw.reach === "number" ? m.raw.reach : null);

/** Dernière mesure par (post, réseau) parmi des lignes de social.metrics. */
function latestByPost(rows) {
  const map = {};
  for (const r of rows) {
    const k = `${r.post_id}|${r.network}`;
    if (!map[k] || new Date(r.measured_at) > new Date(map[k].measured_at)) map[k] = r;
  }
  return Object.values(map);
}

const MIN_POSTS = 5; // en dessous, une moyenne ne veut rien dire : le groupe est marqué « fiable: false »

/**
 * Bilan : par format, segment, type et réseau, la moyenne d'engagement et de personnes touchées, et les meilleurs posts.
 * `portee_mesuree` dit si la portée est connue pour au moins un post (droits Meta présents) ; tant qu'elle ne l'est
 * pas, le classement ne repose que sur quelques « j'aime » et ne doit pas dicter les choix.
 */
function summarize(posts, metricRows) {
  const latest = latestByPost(metricRows);
  const byPost = {}; const byNetwork = {};
  for (const m of latest) {
    const p = byPost[m.post_id] || (byPost[m.post_id] = { engagement: 0, reach: null, views: null, networks: {} });
    const r = reachOf(m);
    p.engagement += engagement(m);
    if (r !== null) p.reach = (p.reach || 0) + r;
    if (typeof m.views === "number") p.views = (p.views || 0) + m.views;
    p.networks[m.network] = { likes: m.likes, comments: m.comments, shares: m.shares, saves: m.saves, views: m.views, reach: r, clicks: m.link_clicks ?? null, days_after: m.days_after };
    const n = byNetwork[m.network] || (byNetwork[m.network] = { cle: m.network, posts: 0, engagement: 0, reach: 0, avecPortee: 0 });
    n.posts++; n.engagement += engagement(m); if (r !== null) { n.reach += r; n.avecPortee++; }
  }
  const finish = (e) => ({
    cle: e.cle, posts: e.posts,
    engagement_moyen: Math.round((e.engagement / e.posts) * 10) / 10,
    reach_moyen: e.avecPortee ? Math.round(e.reach / e.avecPortee) : null,
    taux_engagement: e.avecPortee && e.reach ? Math.round((e.engagement / e.reach) * 1000) / 10 : null, // en %
    fiable: e.posts >= MIN_POSTS,
  });
  const group = (key) => {
    const g = {};
    for (const post of posts) {
      const s = byPost[post.id]; if (!s) continue;
      const k = key(post) || "?"; const e = g[k] || (g[k] = { cle: k, posts: 0, engagement: 0, reach: 0, avecPortee: 0 });
      e.posts++; e.engagement += s.engagement; if (s.reach !== null) { e.reach += s.reach; e.avecPortee++; }
    }
    return Object.values(g).map(finish).sort((a, b) => (b.reach_moyen || 0) - (a.reach_moyen || 0) || b.engagement_moyen - a.engagement_moyen);
  };
  const measured = posts.filter((p) => byPost[p.id]);
  const meilleurs = measured.map((p) => ({ id: p.id, theme: p.theme, type: p.type, format: formatFamily(p.features && p.features.format), segment: p.segment, engagement: byPost[p.id].engagement, reach: byPost[p.id].reach, views: byPost[p.id].views }))
    .sort((a, b) => (b.reach || 0) - (a.reach || 0) || b.engagement - a.engagement).slice(0, 5);
  return {
    posts_mesures: Object.keys(byPost).length,
    portee_mesuree: measured.some((p) => byPost[p.id].reach !== null),
    seuil_fiable: MIN_POSTS,
    par_format: group((p) => formatFamily(p.features && p.features.format)), par_segment: group((p) => p.segment), par_type: group((p) => p.type),
    par_heure: group((p) => (p.published_at ? `${new Date(p.published_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit" }).replace(/\D/g, "")} h` : null)),
    par_reseau: Object.values(byNetwork).map(finish),
    meilleurs, par_post: byPost,
  };
}

module.exports = { collectPost, summarize, latestByPost, engagement, readInsights, metricValue };
