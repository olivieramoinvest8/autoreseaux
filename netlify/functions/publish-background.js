/**
 * Fonction d'arrière-plan (suffixe -background : jusqu'à 15 minutes, réponse 202 immédiate).
 * POST { id, secret } : publie le post « approved » sur chaque réseau de sa marque, met à jour
 * external_ids et le statut (published, partial ou error), écrit le journal.
 */
const { publishPost } = require("./_lib/publish");
const { safeEqual } = require("./_lib/http");

exports.handler = async (event) => {
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}
  if (!safeEqual(body.secret, process.env.INTERNAL_SECRET)) return { statusCode: 401, body: "" };
  if (!body.id) return { statusCode: 400, body: "" };
  await publishPost(body.id);
  return { statusCode: 200, body: "" };
};
