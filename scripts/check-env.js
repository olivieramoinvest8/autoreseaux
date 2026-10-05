/**
 * Vérifie que les variables nécessaires à une routine existent, sans jamais afficher leur valeur.
 * Lancer : node scripts/check-env.js            → une ligne par variable : NOM=present | NOM=absent
 * Code de sortie 1 si une variable manque (la routine s'arrête alors proprement et le dit dans son résumé).
 */
const NEEDED = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "DASHBOARD_URL", "BOT_SECRET"];
let missing = 0;
for (const name of NEEDED) {
  const ok = typeof process.env[name] === "string" && process.env[name].length > 0;
  console.log(`${name}=${ok ? "present" : "absent"}`);
  if (!ok) missing++;
}
if (missing) { console.log(`${missing} variable(s) manquante(s) : à ajouter dans l'environnement Claude Code « com ».`); process.exit(1); }
console.log("Toutes les variables sont présentes.");
