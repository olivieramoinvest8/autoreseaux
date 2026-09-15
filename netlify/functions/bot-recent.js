/**
 * POST /api/bot-recent  { brand: "amo-invest" }  en-tête x-bot-secret: <secret du bot>
 *
 * La « mémoire courte » des routines Claude Code. Une routine ne détient pas la clé service de Supabase : elle ne
 * connaît que le secret de bot (table social.tokens, network 'internal', account_id 'bot'), le même que pour le
 * guichet bot-draft. Ici on lui rend, en lecture seule et sans aucun secret :
 *   - posts    : les 30 derniers posts de la marque (thème, segment, format, statut, caractéristiques), pour ne
 *                jamais refaire un thème à moins de 14 jours et pour varier les formats ;
 *   - listings : les annonces nouvelles ou modifiées depuis 14 jours (titre, ville, prix, DPE, GES, photos, lien) ;
 *   - inbox    : les dépôts d'Olivier encore non utilisés pour cette marque.
 * Rien ne peut être écrit ni publié par ce point d'accès.
 */
const { supabase } = require("./_lib/supabase");
const { json, parseBody, safeEqual } = require("./_lib/http");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "POST attendu" });
  const db = supabase();
  const given = event.headers["x-bot-secret"] || event.headers["X-Bot-Secret"] || "";
  const { data: tok } = await db.from("tokens").select("data").eq("network", "internal").eq("account_id", "bot").is("brand_id", null).maybeSingle();
  const expected = (tok && tok.data && tok.data.secret) || "";
  if (expected.length < 24 || !safeEqual(given, expected)) return json(401, { error: "secret de bot invalide" });

  const b = parseBody(event);
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
  return json(200, { brand: { slug: brand.slug, name: brand.name, networks: brand.networks }, now: new Date().toISOString(), posts: posts.data, listings: listings.data, inbox: inbox.data });
};
