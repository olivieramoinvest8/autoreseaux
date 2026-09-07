/** Même lecture que read-listings, déclenchée à la main depuis le tableau de bord (mot de passe requis). */
const { requireDashboard } = require("./_lib/http");
const scheduled = require("./read-listings");

exports.handler = async (event) => {
  const denied = requireDashboard(event);
  if (denied) return denied;
  return scheduled.handler(event);
};
