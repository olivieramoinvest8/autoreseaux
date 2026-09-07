/* Tableau de bord Social Bot. Parle uniquement aux fonctions Netlify (/api/…), jamais à Supabase directement.
   ?demo=1 affiche des données d'exemple sans serveur, pour prévisualiser. */
(function () {
  const DEMO = new URLSearchParams(location.search).get("demo") === "1";
  const KEY = "socialbot-key";
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  let key = "";
  try { key = localStorage.getItem(KEY) || ""; } catch {}

  const NET_LABEL = { text_fb: "Facebook", text_ig: "Instagram", text_tiktok: "TikTok", text_youtube: "YouTube (titre, puis description)" };
  const NET_FIELD = { facebook: "text_fb", instagram: "text_ig", tiktok: "text_tiktok", youtube: "text_youtube" };

  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => (t.hidden = true), 3500); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function fmtDate(s) { return s ? new Date(s).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : ""; }
  function isVideo(p) { return p.type !== "image" || /\.(mp4|mov|webm)(\?|$)/i.test(p.media_url || ""); }

  async function api(path, opts) {
    if (DEMO) return demoApi(path, opts);
    const res = await fetch("/api/" + path, { ...(opts || {}), headers: { "Content-Type": "application/json", "x-dashboard-key": key, ...((opts && opts.headers) || {}) } });
    if (res.status === 401) { showLogin("Mot de passe incorrect."); throw new Error("401"); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ("Erreur " + res.status));
    return data;
  }

  // ---------- Connexion ----------
  function showLogin(msg) { $("#login").hidden = false; $$(".tab").forEach((t) => (t.hidden = true)); if (msg) { $("#login-err").textContent = msg; $("#login-err").hidden = false; } }
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault(); key = $("#pwd").value.trim();
    try { localStorage.setItem(KEY, key); } catch {}
    $("#login").hidden = true; $("#login-err").hidden = true; showTab("posts");
  });

  // ---------- Onglets ----------
  function showTab(name) {
    $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
    $$(".tab").forEach((t) => (t.hidden = t.id !== "tab-" + name));
    ({ posts: loadPosts, deposer: loadInbox, annonces: loadListings, historique: loadHistory }[name] || (() => {}))();
  }
  $("#tabs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) showTab(b.dataset.tab); });

  // ---------- Posts prêts ----------
  async function loadPosts() {
    const box = $("#posts"); box.innerHTML = '<p class="empty">Chargement…</p>';
    try {
      const { posts } = await api("api-posts?status=draft");
      $("#badge-posts").textContent = posts.length || "";
      if (!posts.length) { box.innerHTML = '<p class="empty">Rien à valider pour le moment. Le prochain post arrive au prochain créneau.</p>'; return; }
      box.innerHTML = posts.map(renderPost).join("");
    } catch (e) { if (e.message !== "401") box.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }
  function renderPost(p) {
    const brand = p.brand || {}; const nets = p.networks && p.networks.length ? p.networks : brand.networks || [];
    const fields = Array.from(new Set(nets.map((n) => NET_FIELD[n]).filter(Boolean)));
    const media = p.media_url ? (isVideo(p) ? `<video class="media" src="${esc(p.media_url)}" controls playsinline preload="metadata"></video>` : `<img class="media" src="${esc(p.media_url)}" alt="">`) : "";
    return `<article class="card post" id="post-${p.id}" data-id="${p.id}">
      <div class="head"><div><span class="tag ${esc(brand.slug)}">${esc(brand.name || "")}</span> <span class="meta">${esc(p.slot)} · ${esc(p.type)} · ${fmtDate(p.created_at)}</span></div>
        <div class="meta">${nets.map(esc).join(" · ")}</div></div>
      ${media}
      <div class="texts">${fields.map((f) => `<div class="text"><label>${NET_LABEL[f]} <button type="button" class="ghost copy" data-field="${f}">Copier</button></label><textarea data-field="${f}">${esc(p[f])}</textarea></div>`).join("")}
        ${p.hashtags && p.hashtags.length ? `<div class="text"><label>Hashtags <button type="button" class="ghost copy" data-field="hashtags">Copier</button></label><textarea data-field="hashtags">${esc(p.hashtags.map((h) => (h.startsWith("#") ? h : "#" + h)).join(" "))}</textarea></div>` : ""}
      </div>
      <div class="actions">
        <button class="gold act" data-action="approve">Valider et publier</button>
        <button class="ghost act" data-action="update">Enregistrer les modifications</button>
        ${p.media_url ? `<a class="ghost" href="${esc(p.media_url)}" download target="_blank" rel="noopener"><button type="button" class="ghost">Télécharger</button></a>` : ""}
        <button class="danger act" data-action="reject">Refuser</button>
        <span class="status"></span>
      </div></article>`;
  }
  $("#posts").addEventListener("click", async (e) => {
    const copy = e.target.closest("button.copy");
    if (copy) { const ta = $(`textarea[data-field="${copy.dataset.field}"]`, copy.closest(".post")); try { await navigator.clipboard.writeText(ta.value); toast("Texte copié"); } catch { ta.select(); } return; }
    const btn = e.target.closest("button.act"); if (!btn) return;
    const card = btn.closest(".post"); const id = card.dataset.id; const status = $(".status", card);
    const texts = {}; $$("textarea[data-field]", card).forEach((ta) => { if (ta.dataset.field === "hashtags") texts.hashtags = ta.value.split(/\s+/).filter(Boolean); else texts[ta.dataset.field] = ta.value; });
    let body = { id, action: btn.dataset.action, ...texts };
    if (btn.dataset.action === "approve" && !confirm("Valider ce post ? Il partira sur les réseaux de la marque.")) return;
    if (btn.dataset.action === "reject") { const reason = prompt("Pourquoi ? (facultatif, aide le robot à s'améliorer)") ; body.reason = reason || null; }
    if (btn.dataset.action === "approve") { await api("post-action", { method: "POST", body: JSON.stringify({ id, action: "update", ...texts }) }).catch(() => {}); }
    $$("button", card).forEach((b) => (b.disabled = true)); status.textContent = "…";
    try {
      await api("post-action", { method: "POST", body: JSON.stringify(body) });
      toast({ approve: "Validé, publication lancée", update: "Modifications enregistrées", reject: "Refusé" }[btn.dataset.action]);
      if (btn.dataset.action === "update") { $$("button", card).forEach((b) => (b.disabled = false)); status.textContent = ""; } else loadPosts();
    } catch (err) { status.textContent = err.message; $$("button", card).forEach((b) => (b.disabled = false)); }
  });
  $("#reload-posts").addEventListener("click", loadPosts);

  // ---------- Déposer ----------
  $("#kind").addEventListener("change", (e) => ($("#match-fields").hidden = e.target.value !== "match"));
  $("#inbox-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target; const fd = new FormData(f); const files = Array.from(f.files.files || []);
    const st = $("#inbox-status"); $("#inbox-submit").disabled = true; st.textContent = "Envoi…";
    const data = fd.get("kind") === "match" ? { date: fd.get("date") || null, opponent: fd.get("opponent") || null, score_home: fd.get("score_home") ? Number(fd.get("score_home")) : null, score_away: fd.get("score_away") ? Number(fd.get("score_away")) : null, home: fd.get("home") === "on" } : {};
    try {
      const r = await api("api-inbox", { method: "POST", body: JSON.stringify({ brand: fd.get("brand"), kind: fd.get("kind"), title: fd.get("title"), body: fd.get("body"), data, files: files.map((x) => ({ name: x.name, type: x.type, size: x.size })) }) });
      for (let i = 0; i < files.length; i++) {
        st.textContent = `Fichier ${i + 1} / ${files.length}…`;
        if (!DEMO) { const up = await fetch(r.uploads[i].url, { method: "PUT", headers: { "Content-Type": files[i].type || "application/octet-stream" }, body: files[i] }); if (!up.ok) throw new Error(`fichier ${files[i].name} non envoyé (${up.status})`); }
      }
      st.textContent = "Déposé. Le robot s'en servira au prochain créneau."; f.reset(); $("#match-fields").hidden = true; loadInbox();
    } catch (err) { st.textContent = "Erreur : " + err.message; }
    $("#inbox-submit").disabled = false;
  });
  async function loadInbox() {
    const box = $("#inbox-list");
    try { const { inbox } = await api("api-inbox"); box.innerHTML = inbox.length ? `<div class="tablewrap"><table><tr><th>Date</th><th>Marque</th><th>Type</th><th>Titre</th><th>Fichiers</th><th>État</th></tr>${inbox.map((i) => `<tr><td>${fmtDate(i.created_at)}</td><td>${esc(i.brand && i.brand.name)}</td><td>${esc(i.kind)}</td><td>${esc(i.title)}</td><td>${(i.files || []).length}</td><td>${esc(i.status)}</td></tr>`).join("")}</table></div>` : '<p class="empty">Aucun dépôt pour l\'instant.</p>'; }
    catch (e) { if (e.message !== "401") box.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }

  // ---------- Annonces ----------
  async function loadListings() {
    const box = $("#listings");
    try { const { listings } = await api("api-listings"); box.innerHTML = listings.length ? `<div class="tablewrap"><table><tr><th>Type</th><th>Titre</th><th>Ville</th><th>Prix</th><th>DPE/GES</th><th>État</th><th>Modifié</th></tr>${listings.map((l) => `<tr><td>${esc(l.kind)}</td><td><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)}</a></td><td>${esc(l.city)}</td><td>${l.price ? Number(l.price).toLocaleString("fr-FR") + " €" : ""}</td><td>${esc(l.dpe || "?")}/${esc(l.ges || "?")}</td><td>${esc(l.status)}</td><td>${fmtDate(l.changed_at)}</td></tr>`).join("")}</table></div>` : '<p class="empty">Aucune annonce lue pour l\'instant. Cliquez sur « Relire le site maintenant ».</p>'; }
    catch (e) { if (e.message !== "401") box.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }
  $("#reread").addEventListener("click", async () => {
    const st = $("#reread-status"); $("#reread").disabled = true; st.textContent = "Lecture du site en cours, une à deux minutes…";
    try { const r = await api("read-listings-now"); st.textContent = `${r.total} fiches lues : ${r.nouveaux.length} nouvelles, ${r.modifies.length} modifiées, ${r.retires.length} retirées. ${(r.notes || []).join(" · ")}`; loadListings(); }
    catch (e) { st.textContent = "Erreur : " + e.message; }
    $("#reread").disabled = false;
  });

  // ---------- Historique ----------
  async function loadHistory() {
    try {
      const { posts } = await api("api-posts?status=history");
      $("#history").innerHTML = posts.length ? `<div class="tablewrap"><table><tr><th>Date</th><th>Marque</th><th>Sujet</th><th>Statut</th><th>Réseaux</th><th>Détail</th></tr>${posts.map((p) => `<tr><td>${fmtDate(p.published_at || p.approved_at || p.created_at)}</td><td>${esc(p.brand && p.brand.name)}</td><td>${esc(p.theme || "")}</td><td><span class="tag status-${esc(p.status)}">${esc(p.status)}</span></td><td>${Object.keys(p.external_ids || {}).map(esc).join(", ")}</td><td>${esc(p.error || "")}</td></tr>`).join("")}</table></div>` : '<p class="empty">Aucun post traité.</p>';
      const { events } = await api("api-events");
      $("#events").innerHTML = events.length ? events.map((ev) => `<div class="event"><span class="meta">${fmtDate(ev.at)} · ${esc(ev.source)}</span><span class="lvl-${esc(ev.level)}">${esc(ev.message)}</span></div>`).join("") : '<p class="empty">Journal vide.</p>';
    } catch (e) { if (e.message !== "401") $("#history").innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }

  // ---------- Données d'exemple (mode démo) ----------
  function demoApi(path) {
    const brands = { "amo-invest": { slug: "amo-invest", name: "AMO Invest", networks: ["facebook", "instagram"] }, tech: { slug: "tech", name: "Chaîne tech / IA", networks: ["youtube", "tiktok"] } };
    const posts = [
      { id: "demo-1", brand: brands["amo-invest"], slot: "11h", type: "image", theme: "rendement réel", created_at: new Date().toISOString(), media_url: "../../output/examples/post-feed-test.png", text_fb: "Loyer, charges, taxe foncière, vacance locative, travaux : le vrai rendement d'un bien, c'est ce qui reste une fois tout compté.\n\nAvant d'acheter à Graveson ou alentour, faites le calcul complet. Nous le faisons avec vous, chiffres réels à l'appui.\n\nAMO Invest, Graveson. Parlons-en.", text_ig: "Un bon rendement se calcule, il ne se promet pas. Avant d'acheter, faites le calcul complet : loyer, charges, taxe foncière, vacance, travaux. On le fait avec vous.", hashtags: ["immobilier", "investissement", "graveson", "provence", "rendement", "bouchesdurhone", "agenceimmobiliere", "amoinvest", "conseil", "investisseur"], networks: [] },
    ];
    if (path.startsWith("api-posts?status=draft")) return Promise.resolve({ posts });
    if (path.startsWith("api-posts")) return Promise.resolve({ posts: [{ ...posts[0], id: "demo-0", status: "published", theme: "diagnostics avant vente", published_at: new Date(Date.now() - 864e5).toISOString(), external_ids: { facebook: "1", instagram: "2" } }] });
    if (path.startsWith("api-inbox")) return Promise.resolve({ inbox: [{ created_at: new Date().toISOString(), brand: { name: "Basket" }, kind: "match", title: "Contre Châteaurenard", files: ["a", "b", "c"], status: "nouveau" }], id: "x", uploads: [] });
    if (path.startsWith("api-listings")) return Promise.resolve({ listings: [{ kind: "location", title: "Appartement meublé T3 60 m² avec parking", city: "Châteaurenard", price: 800, dpe: "D", ges: "B", status: "disponible", url: "https://amoinvest.fr/location/1", changed_at: new Date().toISOString() }] });
    if (path.startsWith("api-events")) return Promise.resolve({ events: [{ at: new Date().toISOString(), source: "routine", level: "info", message: "Post image AMO préparé, mail envoyé" }, { at: new Date().toISOString(), source: "netlify", level: "info", message: "Lecture du site : 12 fiches, 1 nouvelle" }] });
    return Promise.resolve({ ok: true, total: 12, nouveaux: [1], modifies: [], retires: [], notes: [] });
  }

  // ---------- Démarrage ----------
  if (!key && !DEMO) showLogin(); else showTab("posts");
})();
