/**
 * Pipeline de publication.
 *  approveByToken / approvePost : passe le post en approved et déclenche publish-background, ou le programme (scheduled_at).
 *  unschedulePost : annule une programmation (retour en brouillon). publishDue : publie les posts programmés dont l'heure est venue.
 *  publishPost : publie sur chaque réseau de la marque (Meta, YouTube, TikTok), met à jour le post.
 * Claude ne publie jamais : seule cette chaîne, après le clic d'Olivier, parle aux plateformes.
 */
const { supabase, logEvent } = require("../supabase");
const meta = require("./meta");
const youtube = require("./youtube");
const tiktok = require("./tiktok");

async function loadPost(id) {
  const { data, error } = await supabase().from("posts").select("*, brand:brands(*)").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

async function trigger(id, baseUrl) {
  const url = `${baseUrl}/.netlify/functions/publish-background`;
  if (!baseUrl || !process.env.INTERNAL_SECRET) {
    await logEvent("netlify", "warn", "publish-background non déclenché : DASHBOARD_URL ou INTERNAL_SECRET manquant", null, id);
    return;
  }
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, secret: process.env.INTERNAL_SECRET }) });
  if (res.status !== 202 && res.status !== 200) await logEvent("netlify", "error", `publish-background a répondu ${res.status}`, null, id);
}

/**
 * Valide un post. Sans scheduledAt : publication immédiate (publish-background). Avec scheduledAt dans le
 * futur : le post attend en statut approved, publish-scheduled le publiera à l'heure dite.
 * Accepté depuis draft (validation), error (relance) et approved (changement d'heure ou « publier maintenant »).
 */
async function approvePost(id, { via, baseUrl, scheduledAt }) {
  const post = await loadPost(id);
  if (!post) return { ok: false, error: "Post introuvable" };
  if (!["draft", "error", "approved"].includes(post.status)) return { ok: false, error: `Ce post est déjà « ${post.status} »`, postId: id };
  const when = scheduledAt ? new Date(scheduledAt) : null;
  if (when && Number.isNaN(when.getTime())) return { ok: false, error: "Date de programmation invalide", postId: id };
  const future = when && when.getTime() > Date.now() + 60 * 1000;
  const patch = { status: "approved", approved_at: new Date().toISOString(), approval_token: null, error: null, scheduled_at: future ? when.toISOString() : null };
  const { error } = await supabase().from("posts").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message, postId: id };
  if (future) {
    await logEvent("dashboard", "info", `Post programmé (${via}) pour ${when.toISOString()}`, { scheduled_at: when.toISOString() }, id);
    return { ok: true, postId: id, scheduled_at: when.toISOString() };
  }
  await logEvent("dashboard", "info", `Post validé (${via})${post.status === "error" ? ", relance" : ""}`, null, id);
  await trigger(id, baseUrl);
  return { ok: true, postId: id };
}

/** Remet un post programmé (ou en erreur) en brouillon, sans le publier. */
async function unschedulePost(id) {
  const post = await loadPost(id);
  if (!post) return { ok: false, error: "Post introuvable" };
  if (!["approved", "error"].includes(post.status)) return { ok: false, error: `Ce post est « ${post.status} »`, postId: id };
  const { error } = await supabase().from("posts").update({ status: "draft", scheduled_at: null, approved_at: null }).eq("id", id);
  if (error) return { ok: false, error: error.message, postId: id };
  await logEvent("dashboard", "info", "Programmation annulée, retour en brouillon", null, id);
  return { ok: true, postId: id };
}

/** Lance la publication de tous les posts approved dont l'heure est venue. Appelé par publish-scheduled. */
async function publishDue(baseUrl) {
  const now = new Date().toISOString();
  const { data, error } = await supabase().from("posts").select("id, scheduled_at").eq("status", "approved").not("scheduled_at", "is", null).lte("scheduled_at", now).order("scheduled_at");
  if (error) throw error;
  for (const p of data || []) {
    await supabase().from("posts").update({ scheduled_at: null }).eq("id", p.id); // évite un double envoi au passage suivant
    await logEvent("netlify", "info", "Heure de publication atteinte", { scheduled_at: p.scheduled_at }, p.id);
    await trigger(p.id, baseUrl);
  }
  return (data || []).length;
}

async function approveByToken(token, opts) {
  if (!token) return { ok: false, error: "Le lien ne contient pas de jeton." };
  const { data: post } = await supabase().from("posts").select("id, status, token_expires_at").eq("approval_token", token).maybeSingle();
  if (!post) return { ok: false, error: "Ce lien ne correspond à aucun post, ou il a déjà été utilisé." };
  if (post.token_expires_at && new Date(post.token_expires_at) < new Date()) return { ok: false, error: "Ce lien a expiré (48 h). Ouvrez le tableau de bord pour valider.", postId: post.id };
  return approvePost(post.id, opts);
}

/** Publie sur chaque réseau. Un échec sur un réseau n'empêche pas les autres. */
async function publishPost(id) {
  const db = supabase();
  const post = await loadPost(id);
  if (!post) return;
  if (post.status !== "approved") { await logEvent("netlify", "warn", `Publication ignorée : statut ${post.status}`, null, id); return; }
  if (post.scheduled_at && new Date(post.scheduled_at).getTime() > Date.now() + 60 * 1000) { await logEvent("netlify", "warn", "Publication ignorée : programmée plus tard", { scheduled_at: post.scheduled_at }, id); return; }
  const networks = (post.networks && post.networks.length ? post.networks : post.brand.networks) || [];
  const external = { ...(post.external_ids || {}) };
  const errors = [];

  for (const network of networks) {
    if (external[network]) continue; // déjà publié sur ce réseau (relance après erreur partielle)
    try {
      let result;
      if (network === "facebook") result = await meta.publishFacebook(post);
      else if (network === "instagram") result = await meta.publishInstagram(post);
      else if (network === "youtube") result = await youtube.publish(post);
      else if (network === "tiktok") result = await tiktok.sendToInbox(post);
      else throw new Error(`réseau inconnu : ${network}`);
      external[network] = result.id;
      await logEvent("netlify", "info", `Publié sur ${network}`, result, id);
      await db.from("posts").update({ external_ids: external }).eq("id", id);
    } catch (e) {
      errors.push(`${network} : ${e.message}`);
      await logEvent("netlify", "error", `Échec sur ${network} : ${e.message}`, null, id);
    }
  }
  const done = networks.filter((n) => external[n]).length;
  const status = errors.length === 0 ? "published" : done > 0 ? "partial" : "error";
  await db.from("posts").update({ status, external_ids: external, error: errors.join(" | ") || null, published_at: done ? new Date().toISOString() : null }).eq("id", id);
}

module.exports = { approvePost, approveByToken, unschedulePost, publishDue, publishPost };
