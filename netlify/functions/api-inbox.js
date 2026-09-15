/**
 * GET  /api/api-inbox                  → 50 derniers dépôts
 * POST /api/api-inbox { brand, kind, title, body, data, files:[{name,type,size}], clips:[{category, who, note}] }
 *      → crée le dépôt et renvoie, pour chaque fichier, une URL d'envoi signée vers le bucket privé « raw ».
 *        Pour un match : « clips » décrit chaque fichier (même ordre) ; la liste est gardée dans inbox.data.clips
 *        et dans la table social.clips (la base de montage), si elle existe.
 *        Le navigateur envoie ensuite chaque fichier directement à Supabase (pas de limite de taille côté Netlify).
 * PATCH /api/api-inbox { id, files_done: true } → confirme que les fichiers sont arrivés.
 */
const { supabase, logEvent } = require("./_lib/supabase");
const { json, parseBody, requireDashboard } = require("./_lib/http");
const clipsLib = require("./_lib/clips");

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
    let clips = null;
    if (b.kind === "match") {
      if (!files.length) return json(400, { error: "un match sans clip : ajoutez au moins un fichier vidéo" });
      const n = clipsLib.normalize(b.clips, files);
      if (n.error) return json(400, { error: n.error });
      clips = n.clips;
    }
    const data = { ...(b.data || {}), ...(clips ? { clips } : {}) };
    const { data: row, error } = await db.from("inbox").insert({ brand_id: brand.id, kind: b.kind, title: b.title || null, body: b.body || null, data, files }).select().single();
    if (error) return json(500, { error: error.message });
    const uploads = [];
    for (const path of files) {
      const { data: signed, error: e } = await db.storage.from("raw").createSignedUploadUrl(path);
      if (e) return json(500, { error: `URL d'envoi : ${e.message}` });
      uploads.push({ path, token: signed.token, url: signed.signedUrl });
    }
    if (b.kind === "match") {
      const d = b.data || {};
      const { data: match, error: me } = await db.from("matches").insert({ inbox_id: row.id, played_at: d.date || null, opponent: d.opponent || null, score_home: d.score_home ?? null, score_away: d.score_away ?? null, home: d.home ?? null, clips: files }).select().single();
      if (me) await logEvent("dashboard", "warn", `Match non enregistré dans matches : ${me.message}`, null);
      // Base de montage : une ligne par clip. Si la table n'existe pas encore (migration à passer), on le note sans bloquer.
      const rows = clips.map((c) => ({ match_id: match ? match.id : null, inbox_id: row.id, ...c }));
      const { error: ce } = await db.from("clips").insert(rows);
      if (ce) await logEvent("dashboard", "warn", `Clips gardés dans inbox.data seulement : ${ce.message}`, null);
    }
    await logEvent("dashboard", "info", `Dépôt ${b.kind} : ${b.title || ""}`, { files: files.length, clips: clips ? clips.map((c) => c.category) : undefined });
    return json(200, { id: row.id, uploads });
  }
  return json(405, { error: "méthode non prise en charge" });
};
