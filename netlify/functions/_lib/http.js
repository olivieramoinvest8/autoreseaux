/** Petits utilitaires de réponse HTTP pour les fonctions Netlify. */
const crypto = require("crypto");

function json(status, body, headers) {
  return { statusCode: status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(headers || {}) }, body: JSON.stringify(body) };
}
function html(status, body) {
  return { statusCode: status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }, body };
}
function redirect(location) {
  return { statusCode: 302, headers: { Location: location, "Cache-Control": "no-store" }, body: "" };
}
function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  try { return JSON.parse(raw); } catch { return {}; }
}
/** Compare deux chaînes sans fuite de temps (protection contre les attaques par chronométrage). */
function safeEqual(a, b) {
  const ba = Buffer.from(String(a || "")); const bb = Buffer.from(String(b || ""));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
/**
 * Vérifie le mot de passe du tableau de bord : en-tête x-dashboard-key, ou ?key= dans l'URL.
 * Variable : DASHBOARD_PASSWORD. Renvoie null si OK, sinon une réponse 401 à retourner.
 */
function requireDashboard(event) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return json(500, { error: "DASHBOARD_PASSWORD n'est pas configuré" });
  const given = (event.headers && (event.headers["x-dashboard-key"] || event.headers["X-Dashboard-Key"])) || (event.queryStringParameters || {}).key;
  if (!safeEqual(given, expected)) return json(401, { error: "Mot de passe du tableau de bord incorrect" });
  return null;
}
function dashboardUrl() {
  return (process.env.DASHBOARD_URL || process.env.URL || "").replace(/\/$/, "");
}
module.exports = { json, html, redirect, parseBody, safeEqual, requireDashboard, dashboardUrl };
