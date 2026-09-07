/**
 * Connexion d'un compte TikTok (une fois par compte, depuis le navigateur d'Olivier) :
 *  1. GET /api/oauth-tiktok?brand=basket&key=<mot de passe> → redirige vers TikTok
 *  2. TikTok revient sur /api/oauth-tiktok?code=…&state=…    → échange le code, stocke les jetons dans social.tokens
 * URI de redirection à déclarer dans l'application TikTok : https://<site>.netlify.app/.netlify/functions/oauth-tiktok
 */
const { supabase, logEvent } = require("./_lib/supabase");
const { json, html, redirect, requireDashboard, dashboardUrl } = require("./_lib/http");
const { page } = require("./approve");

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const redirectUri = `${dashboardUrl()}/.netlify/functions/oauth-tiktok`;
  const { TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET } = process.env;
  if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) return json(500, { error: "TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET manquants" });

  if (q.code) {
    const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_key: TIKTOK_CLIENT_KEY, client_secret: TIKTOK_CLIENT_SECRET, code: q.code, grant_type: "authorization_code", redirect_uri: redirectUri }),
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) return html(400, page("Connexion TikTok échouée", `${data.error_description || data.error || res.status}`));
    const slug = q.state || "tech";
    const { data: brand } = await supabase().from("brands").select("id").eq("slug", slug).maybeSingle();
    await supabase().from("tokens").upsert({ brand_id: brand ? brand.id : null, network: "tiktok", account_id: data.open_id, data, expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(), updated_at: new Date().toISOString() }, { onConflict: "brand_id,network,account_id" });
    await logEvent("netlify", "info", `Compte TikTok connecté pour la marque ${slug}`);
    return html(200, page("TikTok connecté", `Le compte TikTok de la marque « ${slug} » est connecté. Les vidéos validées arriveront dans ses brouillons.`));
  }
  const denied = requireDashboard(event);
  if (denied) return denied;
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.search = new URLSearchParams({ client_key: TIKTOK_CLIENT_KEY, response_type: "code", scope: "user.info.basic,video.upload", redirect_uri: redirectUri, state: q.brand || "tech" }).toString();
  return redirect(url.toString());
};
