/** GET /api/api-listings → annonces connues, les plus récemment modifiées en premier. */
const { supabase } = require("./_lib/supabase");
const { json, requireDashboard } = require("./_lib/http");

exports.handler = async (event) => {
  const denied = requireDashboard(event);
  if (denied) return denied;
  const { data, error } = await supabase().from("listings").select("id, kind, title, city, price, status, url, dpe, ges, surface_m2, photos, changed_at, last_seen_at").order("changed_at", { ascending: false, nullsFirst: false }).limit(100);
  if (error) return json(500, { error: error.message });
  return json(200, { listings: data });
};
