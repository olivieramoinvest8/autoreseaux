/**
 * POST /api/bot-recent  { brand: "amo-invest", refresh?: true }  en-tête x-bot-secret: <secret du bot>
 *
 * La « mémoire courte » des routines Claude Code. Une routine ne détient pas la clé service de Supabase : elle ne
 * connaît que le secret de bot (table social.tokens, network 'internal', account_id 'bot'), le même que pour le
 * guichet bot-draft. Ici on lui rend, en lecture seule et sans aucun secret :
 *   - posts    : les 30 derniers posts de la marque (thème, segment, format, statut, caractéristiques), pour ne
 *                jamais refaire un thème à moins de 14 jours et pour varier les formats ;
 *   - listings : les annonces nouvelles ou modifiées depuis 14 jours (titre, ville, prix, DPE, GES, photos, lien) ;
 *   - inbox    : les dépôts d'Olivier encore non utilisés pour cette marque (dont les « sujets » demandés) ;
 *   - metrics  : les dernières mesures de chaque post publié (j'aime, commentaires, partages, portée…) ;
 *   - bilan    : moyenne d'engagement par format, segment et type, et les meilleurs posts (voir _lib/metrics.js).
 * Avec { refresh: true } : lance d'abord la relecture du site (read-listings-background) et répond { refreshing: true } ;
 * la routine rappelle bot-recent une minute plus tard pour avoir les annonces du jour.
 * Rien ne peut être écrit ni publié par ce point d'accès.
 */
const { supabase } = require("./_lib/supabase");
const { json, parseBody, dashboardUrl } = require("./_lib/http");
const { checkBotSecret } = require("./_lib/bot");
const { summarize, latestByPost } = require("./_lib/metrics");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "POST attendu" });
  const db = supabase();
  if (!(await checkBotSecret(event, db))) return json(401, { error: "secret de bot invalide" });

  const b = parseBody(event);
  if (b.refresh) {
    const base = dashboardUrl();
    if (!base) return json(500, { error: "DASHBOARD_URL manquant" });
    const r = await fetch(`${base}/.netlify/functions/read-listings-background`, { method: "POST", headers: { "x-bot-secret": event.headers["x-bot-secret"] || event.headers["X-Bot-Secret"] || "" } });
    return json(r.status === 202 || r.status === 200 ? 200 : 500, { refreshing: r.status === 202 || r.status === 200, status: r.status });
  }
  const { data: brand } = await db.from("brands").select("id, slug, name, networks").eq("slug", b.brand).maybeSingle();
  if (!brand) return json(400, { error: `marque inconnue : ${b.brand}` });

  const since = new Date(Date.now() - 14 * 86400 * 1000).toISOString();
  const [posts, listings, inbox] = await Promise.all([
    db.from("posts").select("id, slot, type, segment, theme, status, created_at, published_at, scheduled_at, features, listing_id").eq("brand_id", brand.id).order("created_at", { ascending: false }).limit(30),
    brand.slug === "amo-invest"
      ? db.from("listings").select("id, kind, title, property_type, city, price, fees_note, surface_m2, rooms, dpe, ges, photos, status, url, first_seen_at, changed_at").or(`changed_at.gte.${since},first_seen_at.gte.${since}`).order("changed_at", { ascending: false, nullsFirst: false }).limit(20)
      : Promise.resolve({ data: [] }),
    db.from("inbox").select("id, kind, title, body, data, files, created_at").eq("brand_id", brand.id).eq("status", "nouveau").order("created_at", { ascending: false }).limit(10),
  ]);
  const err = posts.error || listings.error || inbox.error;
  if (err) return json(500, { error: err.message });
  // Mesures des posts publiés (60 derniers jours) et bilan, pour que la routine adapte ses choix.
  const since60 = new Date(Date.now() - 60 * 86400 * 1000).toISOString();
  const { data: measured } = await db.from("posts").select("id, type, segment, theme, features, published_at").eq("brand_id", brand.id).in("status", ["published", "partial"]).gte("published_at", since60);
  const ids = (measured || []).map((p) => p.id);
  const { data: rows } = ids.length ? await db.from("metrics").select("post_id, network, days_after, measured_at, views, likes, comments, shares, saves, link_clicks, raw").in("post_id", ids) : { data: [] };
  const bilan = summarize(measured || [], rows || []);
  const metrics = latestByPost(rows || []).map((m) => ({ post_id: m.post_id, network: m.network, days_after: m.days_after, likes: m.likes, comments: m.comments, shares: m.shares, saves: m.saves, views: m.views, reach: m.raw && m.raw.reach, link_clicks: m.link_clicks }));
  return json(200, { brand: { slug: brand.slug, name: brand.name, networks: brand.networks }, now: new Date().toISOString(), posts: posts.data, listings: listings.data, inbox: inbox.data, metrics, bilan: { posts_mesures: bilan.posts_mesures, par_format: bilan.par_format, par_segment: bilan.par_segment, par_type: bilan.par_type, meilleurs: bilan.meilleurs } });
};
