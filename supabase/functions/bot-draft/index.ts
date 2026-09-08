// Fonction Supabase « bot-draft » : le guichet de dépôt des routines Claude Code.
//
// Pourquoi : les routines ne détiennent pas la clé service de Supabase. Elles n'ont qu'un secret de bot
// (table social.tokens, network 'internal', account_id 'bot') qui n'autorise que deux choses :
//   - { action: "upload", brand, name, type, base64 }   → dépose une image ou une vidéo dans le bucket public
//                                                          « visuels » ou « videos », renvoie son URL publique ;
//   - { action: "create", brand, post }                  → insère une ligne posts en statut draft avec un jeton
//                                                          de validation 48 h, et renvoie le texte du mail.
// Rien ne peut être publié par ce guichet : la publication reste le rôle exclusif des fonctions Netlify,
// après le clic d'Olivier dans le tableau de bord.
//
// Appel : POST https://<projet>.supabase.co/functions/v1/bot-draft
//         en-têtes Authorization: Bearer <clé publique>, apikey: <clé publique>, x-bot-secret: <secret>
// Déploiement : via le connecteur Supabase (deploy_edge_function), verify_jwt = true.
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(url, serviceKey, { db: { schema: "social" }, auth: { persistSession: false } });

const MAX_BYTES = 25 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "video/mp4": "mp4" };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

/** Compare deux chaînes sans fuite de temps. */
function safeEqual(a: string, b: string) {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

async function checkSecret(req: Request) {
  const given = req.headers.get("x-bot-secret") || "";
  const { data } = await db.from("tokens").select("data").eq("network", "internal").eq("account_id", "bot").is("brand_id", null).maybeSingle();
  const expected = (data?.data as { secret?: string } | null)?.secret || "";
  return expected.length >= 24 && safeEqual(given, expected);
}

function slug(s: string) { return String(s || "fichier").replace(/\.[a-z0-9]+$/i, "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(0, 80); }

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST attendu" });
  if (!(await checkSecret(req))) return json(401, { error: "secret de bot invalide" });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "JSON invalide" }); }

  const { data: brand } = await db.from("brands").select("*").eq("slug", body.brand).maybeSingle();
  if (!brand) return json(400, { error: `marque inconnue : ${body.brand}` });

  if (body.action === "upload") {
    const ext = TYPES[body.type];
    if (!ext) return json(400, { error: `type non accepté : ${body.type}` });
    const bytes = Uint8Array.from(atob(body.base64 || ""), (c) => c.charCodeAt(0));
    if (!bytes.length || bytes.length > MAX_BYTES) return json(400, { error: "fichier vide ou trop lourd (25 Mo maximum)" });
    const bucket = ext === "mp4" ? "videos" : "visuels";
    const key = `${brand.slug}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${slug(body.name)}.${ext}`;
    const { error } = await db.storage.from(bucket).upload(key, bytes, { contentType: body.type, upsert: false });
    if (error) return json(500, { error: `upload : ${error.message}` });
    return json(200, { url: db.storage.from(bucket).getPublicUrl(key).data.publicUrl, bucket, key });
  }

  if (body.action === "create") {
    const p = body.post || {};
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const row = {
      brand_id: brand.id, slot: p.slot || "11h", type: p.type || "image", segment: p.segment || null, theme: p.theme || null,
      text_fb: p.text_fb || null, text_ig: p.text_ig || null, text_tiktok: p.text_tiktok || null, text_youtube: p.text_youtube || null,
      hashtags: p.hashtags || [], media_url: p.media_url || null, thumbnail_url: p.thumbnail_url || null, extra_media: p.extra_media || [],
      features: p.features || {}, listing_id: p.listing_id || null, inbox_id: p.inbox_id || null, networks: p.networks || [],
      status: "draft", approval_token: token, token_expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    };
    const { data: inserted, error } = await db.from("posts").insert(row).select().single();
    if (error) return json(500, { error: `insert : ${error.message}` });
    if (p.inbox_id) await db.from("inbox").update({ status: "utilise", used_at: new Date().toISOString() }).eq("id", p.inbox_id);
    await db.from("events").insert({ source: "routine", level: "info", message: `Post ${row.type} ${row.slot} préparé (${brand.name})`, post_id: inserted.id, data: { theme: row.theme, via: "bot-draft" } });

    const base = String(body.dashboard_url || "").replace(/\/$/, "");
    const mail = {
      to: brand.validation_email || null,
      subject: `[${brand.name}] Un post est prêt : ${row.theme || row.type}`,
      text: [
        `Un post ${row.type} est prêt pour ${brand.name} (${row.slot}).`, "",
        `Sujet : ${row.theme || ""}`, "",
        row.media_url ? `Aperçu : ${row.media_url}` : "", "",
        `Valider : ${base}/api/approve?token=${token}`,
        `Refuser : ${base}/api/reject?token=${token}`, "",
        `Modifier les textes ou voir le détail : ${base}/#post-${inserted.id}`, "",
        "Sans clic sous 48 h, le post reste en brouillon. Rien ne part sans vous.",
      ].join("\n"),
    };
    return json(200, { post_id: inserted.id, media_url: row.media_url, mail });
  }

  return json(400, { error: "action inconnue (upload | create)" });
});
