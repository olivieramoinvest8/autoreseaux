/**
 * Client Supabase pour les fonctions Netlify. Utilise la clé service (jamais exposée au navigateur)
 * et travaille dans le schéma « social ». Variables : SUPABASE_URL, SUPABASE_SERVICE_KEY.
 */
const { createClient } = require("@supabase/supabase-js");

let client = null;

function supabase() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_KEY manquant dans les variables d'environnement");
  client = createClient(url, key, { db: { schema: "social" }, auth: { persistSession: false } });
  return client;
}

/** Écrit une ligne dans le journal social.events (jamais bloquant). */
async function logEvent(source, level, message, data, postId) {
  try {
    await supabase().from("events").insert({ source, level, message, data: data || null, post_id: postId || null });
  } catch (e) {
    console.warn("journal non écrit :", e.message);
  }
}

module.exports = { supabase, logEvent };
