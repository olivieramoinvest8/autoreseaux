/** GET /api/reject?token=… : lien « Refuser » du mail. */
const { supabase, logEvent } = require("./_lib/supabase");
const { html } = require("./_lib/http");
const { page } = require("./approve");

exports.handler = async (event) => {
  const token = (event.queryStringParameters || {}).token;
  if (!token) return html(400, page("Lien invalide", "Le lien ne contient pas de jeton."));
  const db = supabase();
  const { data: post } = await db.from("posts").select("id, status, token_expires_at").eq("approval_token", token).maybeSingle();
  if (!post) return html(404, page("Lien inconnu", "Ce lien ne correspond à aucun post."));
  if (post.status !== "draft") return html(400, page("Déjà traité", `Ce post est déjà « ${post.status} ».`, post.id));
  await db.from("posts").update({ status: "rejected", approval_token: null }).eq("id", post.id);
  await logEvent("dashboard", "info", "Post refusé par lien mail", null, post.id);
  return html(200, page("Post refusé", "Rien ne sera publié. Le robot en tiendra compte.", post.id));
};
