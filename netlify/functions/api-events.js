/** GET /api/api-events → 100 dernières lignes du journal (routine, Netlify, tableau de bord). */
const { supabase } = require("./_lib/supabase");
const { json, requireDashboard } = require("./_lib/http");

exports.handler = async (event) => {
  const denied = requireDashboard(event);
  if (denied) return denied;
  const { data, error } = await supabase().from("events").select("*").order("at", { ascending: false }).limit(100);
  if (error) return json(500, { error: error.message });
  return json(200, { events: data });
};
