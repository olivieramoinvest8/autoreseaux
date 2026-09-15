/**
 * Mémoire courte d'une routine : appelle /api/bot-recent du tableau de bord et affiche le JSON.
 * Lancer : node scripts/bot-recent.js --brand amo-invest
 * Variables (fichier .env ou environnement) : DASHBOARD_URL, BOT_SECRET. Aucun secret n'est affiché.
 */
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const p = path.resolve(__dirname, "../.env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  loadEnv();
  const args = process.argv.slice(2);
  const brand = args[args.indexOf("--brand") + 1] || "amo-invest";
  const { DASHBOARD_URL, BOT_SECRET } = process.env;
  if (!DASHBOARD_URL || !BOT_SECRET) throw new Error("DASHBOARD_URL ou BOT_SECRET manquant");
  const res = await fetch(`${DASHBOARD_URL.replace(/\/$/, "")}/api/bot-recent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-bot-secret": BOT_SECRET }, body: JSON.stringify({ brand }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`bot-recent : ${data.error || res.status}`);
  console.log(JSON.stringify(data, null, 2));
}

main().catch((e) => { console.error("Erreur :", e.message); process.exit(1); });
