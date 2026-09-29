/**
 * Contrôle du secret de bot (table social.tokens, network 'internal', account_id 'bot'), partagé par les points
 * d'accès réservés aux routines : bot-recent, read-listings-background. Comparaison sans fuite de temps.
 */
const { safeEqual } = require("./http");

async function checkBotSecret(event, db) {
  const given = event.headers["x-bot-secret"] || event.headers["X-Bot-Secret"] || "";
  const { data: tok } = await db.from("tokens").select("data").eq("network", "internal").eq("account_id", "bot").is("brand_id", null).maybeSingle();
  const expected = (tok && tok.data && tok.data.secret) || "";
  return expected.length >= 24 && safeEqual(given, expected);
}

module.exports = { checkBotSecret };
