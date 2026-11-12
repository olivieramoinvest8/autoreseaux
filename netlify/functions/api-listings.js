/**
 * GET  /api/api-listings → annonces connues : en ligne d'abord, puis celles qui ont quitté le site depuis 60 jours.
 * POST /api/api-listings { id, etat, note? } → pose l'état connu d'Olivier, que le site n'affiche pas :
 *      etat = "sous_offre" | "vendu" | "loue" | "ne_plus_proposer" | null (null efface).
 *      « sous offre », « vendu » et « loué » déclenchent, à la routine suivante, une proposition de post d'événement
 *      (fierté sobre, sans prix final). « Ne plus proposer » retire simplement le bien des propositions.
 * Mot de passe du tableau de bord requis.
 */
const { supabase, logEvent } = require("./_lib/supabase");
const { json, parseBody, requireDashboard } = require("./_lib/http");

const STATES = ["sous_offre", "vendu", "loue", "ne_plus_proposer"];

exports.handler = async (event) => {
  const denied = requireDashboard(event);
  if (denied) return denied;
  const db = supabase();

  if (event.httpMethod === "POST") {
    const b = parseBody(event);
    if (!b.id) return json(400, { error: "id requis" });
    const etat = b.etat || null;
    if (etat !== null && !STATES.includes(etat)) return json(400, { error: `état inconnu : ${etat}` });
    const patch = { manual_status: etat, manual_status_at: etat ? new Date().toISOString() : null, manual_note: etat ? String(b.note || "").slice(0, 300) || null : null };
    const { data, error } = await db.from("listings").update(patch).eq("id", b.id).select("id, reference, external_id, title").maybeSingle();
    if (error) return json(500, { error: error.message });
    if (!data) return json(404, { error: "bien introuvable" });
    await logEvent("dashboard", "info", `Bien réf. ${data.reference || data.external_id} : ${etat ? `marqué « ${etat} »` : "état manuel effacé"}`, { listing_id: data.id, etat });
    return json(200, { ok: true });
  }

  const since = new Date(Date.now() - 60 * 86400 * 1000).toISOString();
  const { data, error } = await db.from("listings").select("id, external_id, reference, kind, title, city, price, status, manual_status, manual_status_at, url, dpe, ges, dpe_note, surface_m2, photos, first_seen_at, changed_at, last_seen_at").or(`status.neq.retire,changed_at.gte.${since},manual_status.not.is.null`).order("first_seen_at", { ascending: false }).limit(200);
  if (error) return json(500, { error: error.message });
  // Dernière présentation de chaque bien, pour voir d'un coup d'œil ce qui a déjà été montré.
  const ids = (data || []).map((l) => l.id);
  const { data: posts } = ids.length ? await db.from("posts").select("listing_id, status, created_at").in("listing_id", ids).order("created_at", { ascending: false }).limit(1000) : { data: [] };
  const last = {};
  for (const p of posts || []) if (!last[p.listing_id]) last[p.listing_id] = { date: p.created_at, status: p.status };
  const rows = (data || []).map((l) => ({ ...l, photos: (l.photos || []).slice(0, 1), derniere_proposition: last[l.id] || null }));
  rows.sort((a, b) => (a.status === "retire") - (b.status === "retire") || new Date(b.first_seen_at) - new Date(a.first_seen_at));
  return json(200, { listings: rows });
};
