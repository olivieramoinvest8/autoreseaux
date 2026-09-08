// fetch-image — relais d'images pour l'atelier visuel (amo-social-bot).
// L'environnement Claude Code n'atteint que amoinvest.fr, supabase.co et netlify.app :
// cette fonction va chercher une image sur un hébergeur autorisé (photos des biens, rendus Higgsfield)
// et la renvoie telle quelle. Lecture seule, hôtes limités, aucune écriture.
// Appel : GET /functions/v1/fetch-image?url=https://amoinvest.staticlbi.com/…  (avec la clé publique du projet)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED = [/\.staticlbi\.com$/i, /\.cloudfront\.net$/i, /^upload\.higgsfield\.ai$/i, /^(www\.)?amoinvest\.fr$/i];

Deno.serve(async (req: Request) => {
  const target = new URL(req.url).searchParams.get("url") || "";
  let u: URL;
  try { u = new URL(target); } catch { return new Response("url invalide", { status: 400 }); }
  if (u.protocol !== "https:" || !ALLOWED.some((re) => re.test(u.hostname))) return new Response("hôte non autorisé", { status: 403 });
  const res = await fetch(u.toString(), { headers: { "User-Agent": "amo-social-bot/1.0 (+https://amoinvest.fr)" } });
  if (!res.ok) return new Response(`amont : HTTP ${res.status}`, { status: 502 });
  const type = res.headers.get("content-type") || "application/octet-stream";
  if (!/^(image|video|audio)\//.test(type)) return new Response("pas un média", { status: 415 });
  return new Response(res.body, { headers: { "Content-Type": type, "Cache-Control": "public, max-age=3600" } });
});
