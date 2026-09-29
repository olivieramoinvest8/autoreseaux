/**
 * Fonction d'arrière-plan : relit amoinvest.fr et met à jour social.listings, à la demande d'une routine
 * (en-tête x-bot-secret). Le lecteur planifié (read-listings) tourne à heures fixes ; ici la routine du matin
 * s'assure d'avoir les annonces du jour avant de choisir ses sujets. Répond 202 tout de suite, travaille ensuite
 * (une trentaine de secondes pour 45 fiches) et note le résultat dans social.events.
 */
const { supabase, logEvent } = require("./_lib/supabase");
const { syncListings } = require("./_lib/listings");
const { checkBotSecret } = require("./_lib/bot");

exports.handler = async (event) => {
  const db = supabase();
  if (event.httpMethod !== "POST" || !(await checkBotSecret(event, db))) return { statusCode: 401, body: "" };
  const notes = [];
  try {
    const r = await syncListings(db, { log: (m) => notes.push(m) });
    await logEvent("netlify", "info", `Lecture du site (routine) : ${r.total} fiches, ${r.nouveaux.length} nouvelles, ${r.modifies.length} modifiées, ${r.retires.length} retirées`, { notes });
  } catch (e) {
    await logEvent("netlify", "error", `Lecture du site (routine) échouée : ${e.message}`, { notes });
  }
  return { statusCode: 200, body: "" };
};
