/**
 * Fonction planifiée (lundi 6h UTC) : vérifie et prolonge le jeton de page Meta (validité 60 jours).
 * Le nouveau jeton est écrit dans social.tokens (network 'meta') et signalé dans le journal ;
 * il doit ensuite être recopié dans la variable META_PAGE_TOKEN de Netlify (une fois tous les deux mois).
 */
const { supabase, logEvent } = require("./_lib/supabase");
const { json } = require("./_lib/http");
const meta = require("./_lib/publish/meta");

exports.handler = async () => {
  try {
    const r = await meta.refreshPageToken();
    const expires = r.expires_in ? new Date(Date.now() + r.expires_in * 1000).toISOString() : null;
    // Une seule ligne par compte : sans marque (brand_id vide), « upsert » en créait une nouvelle chaque lundi.
    const db = supabase(); const account = process.env.META_PAGE_ID || "page";
    const row = { data: { access_token: r.access_token }, expires_at: expires, updated_at: new Date().toISOString() };
    const { data: existing } = await db.from("tokens").select("id").eq("network", "meta").eq("account_id", account).is("brand_id", null).order("updated_at", { ascending: false }).limit(1);
    if (existing && existing[0]) await db.from("tokens").update(row).eq("id", existing[0].id);
    else await db.from("tokens").insert({ brand_id: null, network: "meta", account_id: account, ...row });
    await logEvent("netlify", "info", "Jeton Meta prolongé", { expires_at: expires });
    return json(200, { ok: true, expires_at: expires });
  } catch (e) {
    await logEvent("netlify", "warn", `Jeton Meta non prolongé : ${e.message}`);
    return json(200, { ok: false, error: e.message });
  }
};
