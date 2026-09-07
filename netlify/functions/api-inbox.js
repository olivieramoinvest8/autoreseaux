/**
 * GET  /api/api-inbox                  → 50 derniers dépôts
 * POST /api/api-inbox { brand, kind, title, body, data, files:[{name,type,size}] }
 *      → crée le dépôt et renvoie, pour chaque fichier, une URL d'envoi signée vers le bucket privé « raw ».
 *        Le navigateur envoie ensuite chaque fichier directement à Supabase (pas de limite de taille côté Netlify).
 * PATCH /api/api-inbox { id, files_done: true } → confirme que les fichiers sont arrivés.
 */
const { supabase, logEvent } = require("./_lib/supabase");
const { json, parseBody, requireDashboard } = require("./_lib/http");

exports.handler = async (event) => {
  const denied = requireDashboard(event);
  if (denied) return denied;
  const db = supabase();

  if (event.httpMethod === "GET") {
    const { data, error } = await db.from("inbox").select("*, brand:brands(slug, name)").order("created_at", { ascending: false }).limit(50);
    if (error) return json(500, { error: error.message });
    return json(200, { inbox: data });
  }
  if (event.httpMethod === "POST") {
    const b = parseBody(event);
    const { data: brand } = await db.from("brands").select("id").eq("slug", b.brand).maybeSingle();
    if (!brand) return json(400, { error: `marque inconnue : ${b.brand}` });
    if (!["info", "match", "enregistrement", "bien"].includes(b.kind)) return json(400, { error: "kind invalide" });
    const stamp = new Date().toISOString().slice(0, 10);
    const files = (b.files || []).map((f, i) => `${b.brand}/${stamp}/${Date.now()}-${i}-${String(f.name || "fichier").replace(/[^\w.\-]+/g, "_")}`);
    const { data: row, error } = await db.from("inbox").insert({ brand_id: brand.id, kind: b.kind, title: b.title || null, body: b.body || null, data: b.data || {}, files }).select().single();
    if (error) return json(500, { error: error.message });
    const uploads = [];
    for (const path of files) {
      const { data: signed, error: e } = await db.storage.from("raw").createSignedUploadUrl(path);
      if (e) return json(500, { error: `URL d'envoi : ${e.message}` });
      uploads.push({ path, token: signed.token, url: signed.signedUrl });
    }
    if (b.kind === "match") {
      await db.from("matches").insert({ inbox_id: row.id, played_at: (b.data || {}).date || null, opponent: (b.data || {}).opponent || null, score_home: (b.data || {}).score_home ?? null, score_away: (b.data || {}).score_away ?? null, home: (b.data || {}).home ?? null, clips: files });
    }
    await logEvent("dashboard", "info", `Dépôt ${b.kind} : ${b.title || ""}`, { files: files.length });
    return json(200, { id: row.id, uploads });
  }
  return json(405, { error: "méthode non prise en charge" });
};
