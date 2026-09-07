/**
 * Autorisation YouTube en deux temps (à faire une fois par chaîne, depuis le navigateur d'Olivier) :
 *  1. GET /api/oauth-google?brand=tech&key=<mot de passe>  → redirige vers l'écran de consentement Google
 *  2. Google revient sur /api/oauth-google?code=…&state=…   → échange le code, stocke le refresh token dans social.tokens
 * URI de redirection à déclarer dans le projet Google : https://<site>.netlify.app/.netlify/functions/oauth-google
 */
const { supabase, logEvent } = require("./_lib/supabase");
const { json, html, redirect, requireDashboard, dashboardUrl } = require("./_lib/http");
const { page } = require("./approve");

const SCOPES = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly";

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const redirectUri = `${dashboardUrl()}/.netlify/functions/oauth-google`;
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return json(500, { error: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET manquants" });

  if (q.code) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code: q.code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    const data = await res.json();
    if (!res.ok || !data.refresh_token) return html(400, page("Autorisation Google échouée", `Google n'a pas renvoyé de refresh token (${data.error_description || data.error || res.status}). Réessayez en révoquant d'abord l'accès dans votre compte Google.`));
    const slug = q.state || "tech";
    const { data: brand } = await supabase().from("brands").select("id").eq("slug", slug).maybeSingle();
    await supabase().from("tokens").upsert({ brand_id: brand ? brand.id : null, network: "google", account_id: slug, data: { refresh_token: data.refresh_token, scope: data.scope }, updated_at: new Date().toISOString() }, { onConflict: "brand_id,network,account_id" });
    await logEvent("netlify", "info", `Chaîne YouTube autorisée pour la marque ${slug}`);
    return html(200, page("YouTube connecté", `La chaîne de la marque « ${slug} » est autorisée. Le robot pourra y publier après votre validation.`));
  }
  const denied = requireDashboard(event);
  if (denied) return denied;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: "code", scope: SCOPES, access_type: "offline", prompt: "consent", state: q.brand || "tech" }).toString();
  return redirect(url.toString());
};
