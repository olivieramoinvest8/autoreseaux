/** GET /api/api-meta-check → diagnostic de la connexion Meta (jeton, page, Instagram, droits). Mot de passe du tableau de bord requis. */
const { json, requireDashboard } = require("./_lib/http");
const meta = require("./_lib/publish/meta");

exports.handler = async (event) => {
  const denied = requireDashboard(event);
  if (denied) return denied;
  return json(200, await meta.check());
};
