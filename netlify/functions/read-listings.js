/** Fonction planifiée (voir netlify.toml) : lit amoinvest.fr chaque matin et met à jour social.listings. */
const { supabase, logEvent } = require("./_lib/supabase");
const { syncListings } = require("./_lib/listings");
const { json } = require("./_lib/http");

exports.handler = async () => {
  const notes = [];
  try {
    const r = await syncListings(supabase(), { log: (m) => notes.push(m) });
    await logEvent("netlify", "info", `Lecture du site : ${r.total} fiches, ${r.nouveaux.length} nouvelles, ${r.modifies.length} modifiées, ${r.retires.length} retirées`, { notes });
    return json(200, { ok: true, ...r, notes });
  } catch (e) {
    await logEvent("netlify", "error", `Lecture du site échouée : ${e.message}`, { notes });
    return json(500, { ok: false, error: e.message, notes });
  }
};
