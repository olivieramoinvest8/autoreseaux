/**
 * Fonction planifiée (voir netlify.toml, lun-sam à 7h30 UTC) : vérifie que la routine amo-image a bien déposé
 * ses propositions du matin. Si aucun post n'a été créé par une routine depuis 5h UTC, écrit un événement
 * « error » que le tableau de bord affiche en bandeau rouge (onglet Posts prêts) pour qu'Olivier relance
 * la routine (« Run now ») et me prévienne.
 */
const { supabase, logEvent } = require("./_lib/supabase");
const { json } = require("./_lib/http");

exports.handler = async () => {
  const db = supabase();
  const since = new Date(); since.setUTCHours(5, 0, 0, 0);
  const { data: brand } = await db.from("brands").select("id").eq("slug", "amo-invest").maybeSingle();
  const { count, error } = await db.from("posts").select("id", { count: "exact", head: true }).eq("brand_id", brand.id).gte("created_at", since.toISOString());
  if (error) return json(500, { error: error.message });
  if (!count) {
    await logEvent("netlify", "error", "La routine amo-image n'a rien déposé ce matin : ouvrez claude.ai → Code → Routines → amo-image, lisez le dernier run et cliquez « Run now »", { since: since.toISOString() });
    return json(200, { ok: false, posts_ce_matin: 0 });
  }
  return json(200, { ok: true, posts_ce_matin: count });
};
