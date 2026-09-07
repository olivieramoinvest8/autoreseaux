/** GET /api/approve?token=… : lien « Valider » du mail. Le jeton, unique et limité à 48 h, sert d'authentification. */
const { html, dashboardUrl } = require("./_lib/http");
const { approveByToken } = require("./_lib/publish");

exports.handler = async (event) => {
  const token = (event.queryStringParameters || {}).token;
  const r = await approveByToken(token, { via: "mail", baseUrl: dashboardUrl() });
  const title = r.ok ? "Post validé" : "Validation impossible";
  const body = r.ok ? "La publication est lancée. Vous pouvez suivre son état dans le tableau de bord." : r.error;
  return html(r.ok ? 200 : 400, page(title, body, r.postId));
};

function page(title, body, postId) {
  const url = dashboardUrl();
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
  <style>body{font-family:Inter,Arial,sans-serif;background:#F4F5FA;color:#1A1D3B;margin:0;padding:40px 20px}main{max-width:520px;margin:0 auto;background:#fff;border:1px solid #D6D9E8;padding:28px}h1{font-size:24px;color:#2E358D;margin:0 0 12px}a{display:inline-block;margin-top:18px;background:#2E358D;color:#fff;text-decoration:none;padding:10px 16px}</style></head>
  <body><main><h1>${title}</h1><p>${body}</p>${url ? `<a href="${url}/${postId ? "#post-" + postId : ""}">Ouvrir le tableau de bord</a>` : ""}</main></body></html>`;
}
exports.page = page;
