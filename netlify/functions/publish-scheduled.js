/**
 * Fonction planifiée (toutes les 10 minutes) : publie les posts validés « pour plus tard ».
 * Pour chaque post en statut approved dont scheduled_at est passé, elle déclenche publish-background
 * (la même chaîne que le clic « Valider »). Les posts sont donc publiés au plus tard 10 minutes après l'heure choisie.
 */
const { publishDue } = require("./_lib/publish");
const { json, dashboardUrl } = require("./_lib/http");
const { logEvent } = require("./_lib/supabase");

exports.handler = async () => {
  try {
    const n = await publishDue(dashboardUrl());
    return json(200, { ok: true, lances: n });
  } catch (e) {
    await logEvent("netlify", "error", `publish-scheduled : ${e.message}`);
    return json(200, { ok: false, error: e.message });
  }
};
