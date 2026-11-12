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
  /** Même règle que le serveur (_lib/publish/meta.js) : les images du carrousel dans l'ordre, et la story. */
  function mediaPlan(p) {
    const extras = Array.isArray(p.extra_media) ? p.extra_media : [];
    const urlOf = (e) => (typeof e === "string" ? e : e && e.url) || null;
    const isStory = (e) => (e && e.kind === "story") || /story/i.test(String(urlOf(e) || "").split("/").pop());
    const slides = extras.filter((e) => !isStory(e) && (typeof e === "string" || !e.kind || e.kind === "slide")).map(urlOf).filter(Boolean);
    const story = extras.filter(isStory).map(urlOf).filter(Boolean)[0] || null;
    const images = isVideo(p) ? [] : [p.media_url, ...slides].filter(Boolean).slice(0, 10);
    return { images, story };
  }
  // Motifs de refus : mêmes clés que netlify/functions/_lib/feedback.js.
  const REJECT = [["photos", "Photos"], ["deja_fait", "Déjà fait"], ["theme", "Sujet sans intérêt"], ["visuel", "Visuel"], ["video", "Vidéo"], ["texte", "Texte"], ["bien_indisponible", "Bien vendu ou loué"], ["autre", "Autre"]];
  const NET_NAME = { facebook: "Facebook", instagram: "Instagram", youtube: "YouTube", tiktok: "TikTok" };
  const ETATS = [["", "En ligne, à proposer"], ["sous_offre", "Sous offre"], ["vendu", "Vendu"], ["loue", "Loué"], ["ne_plus_proposer", "Ne plus proposer"]];
  const etatLabel = (k) => (ETATS.find((e) => e[0] === (k || "")) || [])[1] || k;
  /** Date ISO → valeur d'un champ datetime-local, à l'heure de l'appareil (et non en heure universelle). */
  function toLocalInput(iso) { const d = new Date(iso); const z = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; }

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
    ({ posts: loadPosts, deposer: loadInbox, annonces: loadListings, historique: loadHistory, perf: loadPerf }[name] || (() => {}))();
  }
  $("#tabs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) showTab(b.dataset.tab); });

  // ---------- Posts prêts ----------
  async function loadPosts() {
    const box = $("#posts"); box.innerHTML = '<p class="empty">Chargement…</p>';
    try {
      const { posts, alerte } = await api("api-posts?status=draft");
      $("#badge-posts").textContent = posts.length || "";
      const banner = alerte ? `<p class="state err">${esc(fmtDate(alerte.at))} · ${esc(alerte.message)}</p>` : "";
      if (!posts.length) { box.innerHTML = banner + '<p class="empty">Rien à valider, rien de programmé, rien en erreur. Le prochain post arrive au prochain créneau.</p>'; return; }
      box.innerHTML = banner + posts.map(renderPost).join("");
    } catch (e) { if (e.message !== "401") box.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }
  function fmtLocal(iso) { return iso ? new Date(iso).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : ""; }
  /** Valeur par défaut du sélecteur : demain 11h03 (créneau image AMO), heure locale, au format datetime-local. */
  // Créneau proposé par défaut : le prochain créneau AMO libre dans la journée (11h03, puis 18h03), sinon demain 11h03.
  function defaultSlot() {
    const now = new Date(); const d = new Date(now);
    if (now.getHours() < 11 || (now.getHours() === 11 && now.getMinutes() < 3)) d.setHours(11, 3, 0, 0);
    else if (now.getHours() < 18 || (now.getHours() === 18 && now.getMinutes() < 3)) d.setHours(18, 3, 0, 0);
    else { d.setDate(d.getDate() + 1); d.setHours(11, 3, 0, 0); }
    const z = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
  }

  function renderPost(p) {
    const brand = p.brand || {}; const nets = p.networks && p.networks.length ? p.networks : brand.networks || [];
    const fields = Array.from(new Set(nets.map((n) => NET_FIELD[n]).filter(Boolean)));
    const plan = mediaPlan(p);
    const sansStory = !!(p.features && p.features.sans_story);
    // Carrousel : toutes les images, dans l'ordre où elles seront publiées (avant, seule la première était visible).
    const media = !p.media_url ? ""
      : isVideo(p) ? `<video class="media" src="${esc(p.media_url)}" controls playsinline preload="metadata"${p.thumbnail_url ? ` poster="${esc(p.thumbnail_url)}"` : ""}></video>`
      : plan.images.length > 1 ? `<p class="hint gal-title">Carrousel de ${plan.images.length} images, publiées ensemble dans cet ordre. Faites défiler.</p>
        <div class="gallery">${plan.images.map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Image ${i + 1}" loading="lazy"><b>${i + 1}/${plan.images.length}</b></a>`).join("")}</div>`
      : `<img class="media" src="${esc(p.media_url)}" alt="">`;
    const story = plan.story ? `<div class="story"><a href="${esc(plan.story)}" target="_blank" rel="noopener"><img src="${esc(plan.story)}" alt="Story" loading="lazy"></a>
        <label class="row"><input type="checkbox" data-story ${sansStory ? "" : "checked"}> Publier aussi cette affiche en story (Facebook et Instagram)</label></div>` : "";
    const allNets = brand.networks && brand.networks.length ? brand.networks : nets;
    const netPicker = allNets.length > 1 ? `<div class="nets"><span class="meta">Publier sur :</span>${allNets.map((n) => `<label class="row"><input type="checkbox" data-net="${esc(n)}" ${nets.includes(n) ? "checked" : ""}> ${esc(NET_NAME[n] || n)}</label>`).join("")}</div>` : "";
    const l = p.listing;
    const bien = l ? `<p class="meta bien">Bien réf. ${esc(l.reference || l.external_id || "?")} · <a href="${esc(l.url)}" target="_blank" rel="noopener">voir la fiche</a>${l.manual_status ? ` · <strong>${esc(etatLabel(l.manual_status))}</strong>` : ""}</p>` : "";
    const scheduled = p.status === "approved" && p.scheduled_at;
    const state = scheduled ? `<p class="state sched">Programmé : ${esc(fmtLocal(p.scheduled_at))}. Sera publié dans les 10 minutes qui suivent.</p>`
      : p.status === "error" ? `<p class="state err">Échec de publication : ${esc(p.error || "cause inconnue")}. Corrigez si besoin, puis relancez.</p>`
      : p.status === "partial" ? `<p class="state err">Publié sur ${esc(Object.keys(p.external_ids || {}).join(", ") || "?")}, échec sur le reste : ${esc(p.error || "cause inconnue")}. « Relancer » ne republie que les réseaux manquants.</p>` : "";
    const vis = p.features && p.features.visual; const lphotos = (p.listing && p.listing.photos) || [];
    // Photos actuellement dans le visuel : pour un carrousel, la photo de chaque slide (renders[].data.photo) ; sinon les clés partagées.
    const fromRenders = vis && vis.renders ? vis.renders.filter((r) => r.data && r.data.photo).map((r) => r.data.photo) : [];
    const chosen = fromRenders.length ? fromRenders : vis && vis.data ? [vis.data.photo_main, vis.data.photo_1, vis.data.photo_2, vis.data.photo_3].filter(Boolean) : [];
    const photoPicker = vis && vis.renders && lphotos.length ? `<details class="photos" ${vis.status === "rendering" ? "open" : ""}>
        <summary>Photos du visuel${vis.status === "rendering" ? " · refabrication en cours…" : vis.status === "error" ? " · échec : " + esc(vis.error || "") : ""}</summary>
        <p class="hint">Cliquez les photos dans l'ordre : la 1re devient la photo principale, les 3 suivantes les vignettes. Puis « Refaire le visuel » (une minute environ).</p>
        <div class="strip">${lphotos.map((u) => { const i = chosen.indexOf(u); return `<button type="button" class="ph${i > -1 ? " on" : ""}" data-url="${esc(u)}"><img src="${esc(u)}" alt="" loading="lazy">${i > -1 ? `<b>${i === 0 ? "P" : i}</b>` : ""}</button>`; }).join("")}</div>
        <div class="actions"><button type="button" class="gold act" data-action="rerender">Refaire le visuel</button><button type="button" class="ghost act" data-action="photos-reset">Tout désélectionner</button></div>
      </details>` : "";
    const mainBtn = scheduled ? `<button class="gold act" data-action="approve">Publier maintenant</button>`
      : p.status === "error" || p.status === "partial" ? `<button class="gold act" data-action="approve">Relancer la publication</button>`
      : `<button class="gold act" data-action="approve">Valider et publier</button>`;
    return `<article class="card post" id="post-${p.id}" data-id="${p.id}" data-status="${esc(p.status)}">
      <div class="head"><div><span class="tag ${esc(brand.slug)}">${esc(brand.name || "")}</span> <span class="meta">${esc(p.slot)} · ${esc(p.type)} · ${fmtDate(p.created_at)}</span></div>
        <div class="meta">${nets.map(esc).join(" · ")}</div></div>
      ${state}
      ${bien}
      ${media}
      ${story}
      ${photoPicker}
      ${netPicker}
      <div class="texts">${fields.map((f) => `<div class="text"><label>${NET_LABEL[f]} <button type="button" class="ghost copy" data-field="${f}">Copier</button></label><textarea data-field="${f}">${esc(p[f])}</textarea></div>`).join("")}
        ${p.hashtags && p.hashtags.length ? `<div class="text"><label>Hashtags <button type="button" class="ghost copy" data-field="hashtags">Copier</button></label><textarea data-field="hashtags">${esc(p.hashtags.map((h) => (h.startsWith("#") ? h : "#" + h)).join(" "))}</textarea></div>` : ""}
      </div>
      <div class="actions">
        ${mainBtn}
        <button class="ghost act" data-action="schedule-open">${scheduled ? "Changer l'heure" : "Programmer…"}</button>
        <button class="ghost act" data-action="update">Enregistrer les modifications</button>
        ${p.media_url ? `<a class="ghost" href="${esc(p.media_url)}" download target="_blank" rel="noopener"><button type="button" class="ghost">Télécharger</button></a>` : ""}
        ${scheduled || p.status === "error" ? `<button class="ghost act" data-action="unschedule">Remettre en brouillon</button>` : ""}
        <button class="danger act" data-action="reject-open">Refuser</button>
        <span class="status"></span>
      </div>
      <div class="sched-form" hidden>
        <label>Publier le <input type="datetime-local" data-sched value="${scheduled ? esc(toLocalInput(p.scheduled_at)) : defaultSlot()}" step="60"></label>
        <button type="button" class="gold act" data-action="schedule">Programmer</button>
        <button type="button" class="ghost act" data-action="schedule-close">Annuler</button>
        <span class="hint">Heure de votre appareil. La publication part dans les 10 minutes qui suivent.</span>
      </div>
      <div class="reject-form" hidden>
        <p><strong>Pourquoi ce refus ?</strong> <span class="hint">Un clic suffit. Le robot lit vos motifs chaque matin avant de créer.</span></p>
        <div class="chips">${REJECT.map(([k, lab]) => `<button type="button" class="chip" data-cat="${k}">${lab}</button>`).join("")}</div>
        <input type="text" data-reason maxlength="300" placeholder="Précision (facultatif) : ex. photo de la cuisine trop sombre">
        <div class="actions"><button type="button" class="danger act" data-action="reject">Confirmer le refus</button><button type="button" class="ghost act" data-action="reject-close">Annuler</button></div>
      </div></article>`;
  }
  $("#posts").addEventListener("click", async (e) => {
    const copy = e.target.closest("button.copy");
    if (copy) { const ta = $(`textarea[data-field="${copy.dataset.field}"]`, copy.closest(".post")); try { await navigator.clipboard.writeText(ta.value); toast("Texte copié"); } catch { ta.select(); } return; }
    const ph = e.target.closest("button.ph");
    if (ph) { // sélection ordonnée des photos : P puis 1, 2, 3
      const strip = ph.closest(".strip"); const sel = $$("button.ph.on", strip);
      if (ph.classList.contains("on")) { ph.classList.remove("on"); ph.querySelector("b") && ph.querySelector("b").remove(); }
      else if (sel.length < 4) { ph.classList.add("on"); ph.insertAdjacentHTML("beforeend", "<b></b>"); }
      $$("button.ph.on", strip).forEach((b, i) => { const l = b.querySelector("b") || b.appendChild(document.createElement("b")); l.textContent = i === 0 ? "P" : String(i); });
      return;
    }
    const chip = e.target.closest("button.chip");
    if (chip) { $$("button.chip", chip.closest(".chips")).forEach((c) => c.classList.toggle("on", c === chip)); return; }
    const btn = e.target.closest("button.act"); if (!btn) return;
    const card = btn.closest(".post"); const id = card.dataset.id; const status = $(".status", card); const action = btn.dataset.action;
    if (action === "photos-reset") { $$("button.ph", card).forEach((b) => { b.classList.remove("on"); const l = b.querySelector("b"); if (l) l.remove(); }); return; }
    if (action === "rerender") {
      const photos = $$("button.ph.on", card).map((b) => b.dataset.url);
      if (!photos.length) { toast("Cliquez d'abord la photo principale"); return; }
      if (!confirm(`Refaire le visuel avec ${photos.length} photo${photos.length > 1 ? "s" : ""} ?`)) return;
      $$("button", card).forEach((b) => (b.disabled = true));
      try { await api("post-action", { method: "POST", body: JSON.stringify({ id, action: "rerender", photos }) }); toast("Refabrication lancée, une minute environ"); setTimeout(loadPosts, 45000); loadPosts(); }
      catch (err) { toast("Erreur : " + err.message); $$("button", card).forEach((b) => (b.disabled = false)); }
      return;
    }
    if (action === "schedule-open") { const f = $(".sched-form", card); f.hidden = false; const inp = $("[data-sched]", f); if (inp && !inp.value) inp.value = defaultSlot(); return; }
    if (action === "schedule-close") { $(".sched-form", card).hidden = true; return; }
    if (action === "reject-open") { const f = $(".reject-form", card); f.hidden = false; f.scrollIntoView({ block: "nearest" }); return; }
    if (action === "reject-close") { $(".reject-form", card).hidden = true; return; }
    const texts = {}; $$("textarea[data-field]", card).forEach((ta) => { if (ta.dataset.field === "hashtags") texts.hashtags = ta.value.split(/\s+/).filter(Boolean); else texts[ta.dataset.field] = ta.value; });
    // Réseaux cochés et choix de la story : enregistrés avec les textes.
    const netBoxes = $$("input[data-net]", card);
    if (netBoxes.length) { texts.networks = netBoxes.filter((c) => c.checked).map((c) => c.dataset.net); if (!texts.networks.length && action !== "reject") { status.textContent = "Cochez au moins un réseau."; return; } }
    const storyBox = $("input[data-story]", card); if (storyBox) texts.sans_story = !storyBox.checked;
    let body = { id, action, ...texts };
    if (action === "approve" && !confirm(card.dataset.status === "error" || card.dataset.status === "partial" ? "Relancer la publication de ce post ?" : `Publier ce post maintenant sur ${(texts.networks || []).map((n) => NET_NAME[n] || n).join(" et ") || "les réseaux de la marque"} ?`)) return;
    if (action === "schedule") {
      const v = $("[data-sched]", card).value; if (!v) { status.textContent = "Choisissez une date et une heure."; return; }
      const when = new Date(v); if (when.getTime() < Date.now() + 60 * 1000) { status.textContent = "Cette heure est déjà passée."; return; }
      if (!confirm(`Programmer ce post pour ${fmtLocal(when.toISOString())} ?`)) return;
      body.scheduled_at = when.toISOString();
    }
    if (action === "reject") {
      const on = $("button.chip.on", card); const reason = $("[data-reason]", card).value.trim();
      if (!on) { toast("Choisissez un motif de refus"); return; }
      body = { id, action, category: on.dataset.cat, reason: reason || null };
    }
    if (action === "approve" || action === "schedule") { await api("post-action", { method: "POST", body: JSON.stringify({ id, action: "update", ...texts }) }).catch(() => {}); }
    $$("button", card).forEach((b) => (b.disabled = true)); status.textContent = "…";
    try {
      await api("post-action", { method: "POST", body: JSON.stringify(body) });
      toast({ approve: "Validé, publication lancée", schedule: "Post programmé", unschedule: "Remis en brouillon", update: "Modifications enregistrées", reject: "Refusé" }[action]);
      if (action === "update") { $$("button", card).forEach((b) => (b.disabled = false)); status.textContent = ""; } else loadPosts();
    } catch (err) { status.textContent = err.message; $$("button", card).forEach((b) => (b.disabled = false)); }
  });
  $("#reload-posts").addEventListener("click", loadPosts);

  // ---------- Déposer ----------
  // Même liste que brands/basket/clips.json (le serveur refuse une catégorie absente de ce fichier).
  const CLIP_CATEGORIES = [["2pts", "Panier 2 pts"], ["3pts", "Panier 3 pts"], ["lancer-franc", "Lancer franc"], ["layup", "Pénétration / layup"], ["passe", "Passe décisive"], ["rebond", "Rebond"], ["contre", "Contre"], ["interception", "Interception"], ["defense", "Action défensive"], ["ambiance", "Ambiance / banc"], ["arbitrage", "Arbitrage (privé)"]];
  const CLIP_WHO = [["fils", "Mon fils"], ["equipe", "L'équipe"]];
  function renderClipRows() {
    const isMatch = $("#kind").value === "match"; const files = Array.from($("#inbox-form").files.files || []);
    $("#clip-rows").hidden = !(isMatch && files.length);
    if (!isMatch) return;
    const opts = (list, sel) => list.map(([v, l]) => `<option value="${v}"${v === sel ? " selected" : ""}>${l}</option>`).join("");
    $("#clip-list").innerHTML = files.map((f, i) => `<div class="clip-row" data-i="${i}">
        <span class="name" title="${esc(f.name)}">${esc(f.name)}</span>
        <select data-clip="category">${opts(CLIP_CATEGORIES, i === 0 ? "" : $$(".clip-row select[data-clip=category]")[i - 1] ? $$(".clip-row select[data-clip=category]")[i - 1].value : "")}</select>
        <select data-clip="who">${opts(CLIP_WHO, "fils")}</select>
        <input data-clip="note" maxlength="120" placeholder="note (facultatif)">
      </div>`).join("");
  }
  function clipMeta() { return $$(".clip-row").map((r) => ({ category: $("[data-clip=category]", r).value, who: $("[data-clip=who]", r).value, note: $("[data-clip=note]", r).value })); }
  $("#kind").addEventListener("change", (e) => { $("#match-fields").hidden = e.target.value !== "match"; $("#sujet-fields").hidden = e.target.value !== "sujet"; if (e.target.value === "match") $("#inbox-form").brand.value = "basket"; renderClipRows(); });
  $("#inbox-form").files.addEventListener("change", renderClipRows);
  $("#inbox-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target; const fd = new FormData(f); const files = Array.from(f.files.files || []);
    const st = $("#inbox-status"); $("#inbox-submit").disabled = true; st.textContent = "Envoi…";
    const data = fd.get("kind") === "match" ? { date: fd.get("date") || null, opponent: fd.get("opponent") || null, score_home: fd.get("score_home") ? Number(fd.get("score_home")) : null, score_away: fd.get("score_away") ? Number(fd.get("score_away")) : null, home: fd.get("home") === "on" }
      : fd.get("kind") === "sujet" ? { links: String(fd.get("links") || "").split(/\s+/).filter((u) => /^https?:\/\//.test(u)) } : {};
    try {
      const r = await api("api-inbox", { method: "POST", body: JSON.stringify({ brand: fd.get("brand"), kind: fd.get("kind"), title: fd.get("title"), body: fd.get("body"), data, files: files.map((x) => ({ name: x.name, type: x.type, size: x.size })), clips: fd.get("kind") === "match" ? clipMeta() : undefined }) });
      for (let i = 0; i < files.length; i++) {
        st.textContent = `Fichier ${i + 1} / ${files.length}…`;
        if (!DEMO) { const up = await fetch(r.uploads[i].url, { method: "PUT", headers: { "Content-Type": files[i].type || "application/octet-stream" }, body: files[i] }); if (!up.ok) throw new Error(`fichier ${files[i].name} non envoyé (${up.status})`); }
      }
      st.textContent = "Déposé. Le robot s'en servira au prochain créneau."; f.reset(); $("#match-fields").hidden = true; $("#sujet-fields").hidden = true; $("#clip-rows").hidden = true; loadInbox();
    } catch (err) { st.textContent = "Erreur : " + err.message; }
    $("#inbox-submit").disabled = false;
  });
  async function loadInbox() {
    const box = $("#inbox-list");
    try { const { inbox } = await api("api-inbox"); box.innerHTML = inbox.length ? `<div class="tablewrap"><table><tr><th>Date</th><th>Marque</th><th>Type</th><th>Titre</th><th>Fichiers</th><th>État</th></tr>${inbox.map((i) => `<tr><td>${fmtDate(i.created_at)}</td><td>${esc(i.brand && i.brand.name)}</td><td>${esc(i.kind)}</td><td>${esc(i.title)}</td><td>${(i.files || []).length}${i.kind === "match" && i.data && i.data.clips ? " · " + esc(i.data.clips.map((c) => c.category).join(", ")) : ""}</td><td>${esc(i.status)}</td></tr>`).join("")}</table></div>` : '<p class="empty">Aucun dépôt pour l\'instant.</p>'; }
    catch (e) { if (e.message !== "401") box.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }

  // ---------- Performances ----------
  const n = (v) => (v === null || v === undefined ? "–" : String(v));
  const signed = (v) => (v === null || v === undefined ? "–" : v > 0 ? "+" + v : String(v));
  async function loadPerf() {
    const bilan = $("#perf-bilan"), box = $("#perf-posts");
    try {
      const { posts, bilan: b, comptes, retours } = await api("api-metrics");
      // Abonnés : le thermomètre de la notoriété.
      const comptesHtml = comptes && Object.keys(comptes).length ? `<div class="kpis">${Object.entries(comptes).map(([net, c]) => `<div class="kpi"><span class="lab">${esc(NET_NAME[net] || net)}</span><strong>${n(c.abonnes)}</strong><span class="lab">abonnés</span><span class="delta">${signed(c.evolution_7_jours)} en 7 jours · ${signed(c.evolution_30_jours)} en 30 jours</span></div>`).join("")}</div>` : '<p class="hint">Abonnés : premier relevé la nuit prochaine.</p>';
      const alerte = b.posts_mesures && !b.portee_mesuree ? '<p class="state err">La portée (personnes touchées) n\'est pas encore mesurée : il manque deux droits sur le jeton Meta (« read_insights » et « instagram_manage_insights »). Tant qu\'ils manquent, les classements ci-dessous reposent sur quelques « j\'aime » seulement. Onglet Historique → « Vérifier la connexion Meta » dit ce qui manque.</p>' : "";
      const grp = (title, rows) => rows && rows.length ? `<div class="card"><h3>${title}</h3><div class="tablewrap"><table><tr><th></th><th>Posts</th><th>Personnes touchées (moy.)</th><th>Réactions (moy.)</th><th>Taux</th></tr>${rows.map((r) => `<tr${r.fiable ? "" : ' class="faible"'}><td>${esc(r.cle)}${r.fiable ? "" : " *"}</td><td>${r.posts}</td><td>${n(r.reach_moyen)}</td><td>${r.engagement_moyen}</td><td>${r.taux_engagement === null || r.taux_engagement === undefined ? "–" : r.taux_engagement + " %"}</td></tr>`).join("")}</table></div></div>` : "";
      // Vos retours : ce que vous gardez, ce que vous refusez, et pourquoi.
      const r = retours || {};
      const kept = (title, rows) => rows && rows.length ? `<div class="card"><h3>${title}</h3><div class="tablewrap"><table><tr><th></th><th>Proposés</th><th>Gardés</th><th>Part gardée</th></tr>${rows.map((x) => `<tr><td>${esc(x.cle)}</td><td>${x.proposes}</td><td>${x.gardes}</td><td>${x.part_gardee} %</td></tr>`).join("")}</table></div></div>` : "";
      const motifs = r.motifs_de_refus && r.motifs_de_refus.length ? `<div class="card"><h3>Vos motifs de refus (60 jours)</h3><div class="tablewrap"><table><tr><th>Motif</th><th>Refus</th></tr>${r.motifs_de_refus.map((m) => `<tr><td>${esc(m.cle === "sans raison" ? "Sans raison donnée" : m.libelle)}</td><td>${m.refus}</td></tr>`).join("")}</table></div></div>` : "";
      const retoursHtml = r.periode_posts ? `<h2>Vos retours</h2><p class="hint">Sur 60 jours : ${r.periode_posts} propositions, ${n(r.part_gardee_globale)} % gardées. Le robot lit ce tableau chaque matin.</p>${kept("Part gardée par format", r.par_format)}${motifs}` : "";
      bilan.innerHTML = comptesHtml + alerte + (b.posts_mesures ? `<h2>Ce qui touche le plus de monde</h2><p class="hint">${b.posts_mesures} posts mesurés. * = moins de ${b.seuil_fiable || 5} posts : trop peu pour conclure.</p>${grp("Par format", b.par_format)}${grp("Par réseau", b.par_reseau)}${grp("Par heure de publication", b.par_heure)}${grp("Par segment", b.par_segment)}` : '<p class="empty">Aucune mesure pour l\'instant : la première relève a lieu la nuit suivant la mise en ligne, puis chaque nuit.</p>') + retoursHtml;
      box.innerHTML = posts.length ? `<div class="tablewrap"><table><tr><th>Publié</th><th>Sujet</th><th>Format</th><th>Touchées</th><th>Réactions</th><th>Facebook (j'aime / comm. / partages / touchées)</th><th>Instagram (j'aime / comm. / enreg. / touchées)</th></tr>${posts.map((p) => { const f = p.mesures.facebook || {}, i = p.mesures.instagram || {}; return `<tr><td>${fmtDate(p.published_at)}</td><td>${esc(p.theme || "")}</td><td>${esc(p.format || p.type)}</td><td>${n(p.reach)}</td><td>${n(p.engagement)}</td><td>${p.mesures.facebook ? `${n(f.likes)} / ${n(f.comments)} / ${n(f.shares)} / ${n(f.reach)}` : "–"}</td><td>${p.mesures.instagram ? `${n(i.likes)} / ${n(i.comments)} / ${n(i.saves)} / ${n(i.reach)}` : "–"}</td></tr>`; }).join("")}</table></div>` : '<p class="empty">Aucun post publié sur les 60 derniers jours.</p>';
    } catch (e) { if (e.message !== "401") bilan.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }

  // ---------- Annonces ----------
  // Le site n'affiche jamais « sous offre » ni « vendu » : c'est ici qu'Olivier le dit au robot, en un clic.
  async function loadListings() {
    const box = $("#listings");
    try {
      const { listings } = await api("api-listings");
      if (!listings.length) { box.innerHTML = '<p class="empty">Aucune annonce lue pour l\'instant. Cliquez sur « Relire le site maintenant ».</p>'; return; }
      const row = (l) => {
        const gone = l.status === "retire";
        const last = l.derniere_proposition;
        const dpe = l.dpe ? `${esc(l.dpe)}/${esc(l.ges || "?")}` : esc(l.dpe_note || "–");
        const site = gone ? `<span class="tag status-rejected">A quitté le site</span><br><span class="meta">${fmtDate(l.changed_at)}</span>${l.manual_status ? "" : '<br><strong class="ask">Vendu ? Loué ?</strong>'}` : '<span class="tag status-published">En ligne</span>';
        // Sur téléphone, tout doit tenir sans défilement horizontal : le choix de l'état est sous le titre du bien.
        return `<tr data-id="${esc(l.id)}"${gone && !l.manual_status ? ' class="ask-row"' : ""}>
          <td><strong>${esc(l.reference || l.external_id)}</strong></td>
          <td><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)}</a><br><span class="meta">${esc(l.kind)} · ${esc(l.city)} · ${l.price ? Number(l.price).toLocaleString("fr-FR") + " €" : ""} · ${dpe}</span>
            <label class="etat">Ce que vous savez <select data-etat>${ETATS.map(([k, lab]) => `<option value="${k}"${(l.manual_status || "") === k ? " selected" : ""}>${gone && !k ? "Je ne sais pas" : lab}</option>`).join("")}</select></label></td>
          <td>${site}<br><span class="meta">Proposé : ${last ? `${fmtDate(last.date).split(" ")[0]} (${esc({ published: "publié", partial: "publié", approved: "programmé", rejected: "refusé", draft: "à valider", error: "erreur" }[last.status] || last.status)})` : "jamais"}</span></td></tr>`;
      };
      box.innerHTML = `<div class="tablewrap"><table class="biens"><tr><th>Réf.</th><th>Bien</th><th>Sur le site</th></tr>${listings.map(row).join("")}</table></div>`;
    } catch (e) { if (e.message !== "401") box.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }
  $("#listings").addEventListener("change", async (e) => {
    const sel = e.target.closest("select[data-etat]"); if (!sel) return;
    const tr = sel.closest("tr"); const etat = sel.value || null; sel.disabled = true;
    try {
      await api("api-listings", { method: "POST", body: JSON.stringify({ id: tr.dataset.id, etat }) });
      toast(etat === "ne_plus_proposer" ? "Noté : ce bien ne sera plus proposé" : etat ? `Noté : ${etatLabel(etat).toLowerCase()}. Le robot proposera un post dès demain matin.` : "État effacé : le bien peut de nouveau être proposé");
      tr.classList.remove("ask-row"); const ask = $(".ask", tr); if (ask) ask.remove();
    } catch (err) { toast("Erreur : " + err.message); }
    sel.disabled = false;
  });
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

  $("#meta-check").addEventListener("click", async () => {
    const box = $("#meta-check-result"); box.hidden = false; box.textContent = "Vérification en cours…"; $("#meta-check").disabled = true;
    try { const r = await api("api-meta-check"); box.textContent = (r.ok ? "Connexion Meta OK\n" : "Problème : " + (r.error || "droits manquants") + "\n") + JSON.stringify(r.details, null, 2); }
    catch (e) { box.textContent = "Erreur : " + e.message; }
    $("#meta-check").disabled = false;
  });

  // ---------- Données d'exemple (mode démo) ----------
  function demoApi(path, opts) {
    const img = (name) => "../../output/examples/" + name;
    const brands = { "amo-invest": { slug: "amo-invest", name: "AMO Invest", networks: ["facebook", "instagram"] }, tech: { slug: "tech", name: "Chaîne tech / IA", networks: ["youtube", "tiktok"] } };
    const posts = [
      { id: "demo-1", brand: brands["amo-invest"], slot: "11h", type: "image", status: "draft", theme: "annonce : villa 3 chambres, Graveson", created_at: new Date().toISOString(), media_url: img("carrousel-cover-447.png"),
        extra_media: [{ url: img("annonce-feed-458.png"), kind: "slide" }, { url: img("annonce-feed-458-clair.png"), kind: "slide" }, { url: img("post-story-test.png"), kind: "story" }],
        listing: { id: "l1", reference: "471", external_id: "602", url: "https://www.amoinvest.fr/vente/1-graveson/villa/602-villa", photos: [] }, features: { format: "carrousel 5 slides" },
        text_fb: "Nouveau à Graveson : une villa de 80 m² à 5 minutes à pied des écoles.\n\n273 000 €, honoraires à la charge du vendeur. DPE ancienne version.\n\nFiche complète : https://www.amoinvest.fr/vente/1-graveson/villa/602-villa", text_ig: "Nouveau à Graveson : villa de 80 m², 3 chambres, terrasse ouest. 273 000 €. Fiche : lien en bio, réf. 471.", hashtags: ["#Graveson", "#immobilier", "#AMOInvest"], networks: [] },
      { id: "demo-2", brand: brands["amo-invest"], slot: "11h", type: "image", status: "draft", theme: "rendement réel", created_at: new Date().toISOString(), media_url: img("post-feed-test.png"), extra_media: [], features: { format: "post-feed (marine)" }, text_fb: "Loyer, charges, taxe foncière, vacance locative, travaux : le vrai rendement d'un bien, c'est ce qui reste une fois tout compté.\n\nAMO Invest, Graveson. Parlons-en.", text_ig: "Un bon rendement se calcule, il ne se promet pas.", hashtags: ["immobilier", "graveson"], networks: ["facebook"] },
    ];
    if (opts && opts.method === "POST") return Promise.resolve({ ok: true, id: "x", uploads: [] });
    if (path.startsWith("api-posts?status=draft")) return Promise.resolve({ posts });
    if (path.startsWith("api-posts")) return Promise.resolve({ posts: [{ ...posts[1], id: "demo-0", status: "published", theme: "diagnostics avant vente", published_at: new Date(Date.now() - 864e5).toISOString(), external_ids: { facebook: "1", instagram: "2" } }] });
    if (path.startsWith("api-metrics")) return Promise.resolve({
      posts: [{ id: "demo-0", theme: "annonce : maison T3, Eyragues, location", type: "video", format: "vidéo photos du bien", published_at: new Date(Date.now() - 3 * 864e5).toISOString(), reach: 2140, engagement: 59, mesures: { facebook: { likes: 31, comments: 9, shares: 19, reach: 1890 }, instagram: { likes: 0, comments: 0, saves: 0, reach: 250 } } }],
      bilan: { posts_mesures: 41, portee_mesuree: true, seuil_fiable: 5,
        par_format: [{ cle: "vidéo photos du bien", posts: 10, reach_moyen: 920, engagement_moyen: 6.1, taux_engagement: 0.7, fiable: true }, { cle: "carrousel annonce", posts: 11, reach_moyen: 410, engagement_moyen: 3, taux_engagement: 0.7, fiable: true }, { cle: "chiffre clé", posts: 1, reach_moyen: 90, engagement_moyen: 0, taux_engagement: 0, fiable: false }],
        par_reseau: [{ cle: "facebook", posts: 41, reach_moyen: 520, engagement_moyen: 3.1, taux_engagement: 0.6, fiable: true }, { cle: "instagram", posts: 41, reach_moyen: 60, engagement_moyen: 0.1, taux_engagement: 0.2, fiable: true }],
        par_heure: [{ cle: "11 h", posts: 22, reach_moyen: 480, engagement_moyen: 2.4, taux_engagement: 0.5, fiable: true }, { cle: "18 h", posts: 9, reach_moyen: 610, engagement_moyen: 3.9, taux_engagement: 0.6, fiable: true }],
        par_segment: [{ cle: "bailleurs", posts: 12, reach_moyen: 700, engagement_moyen: 9, taux_engagement: 1.3, fiable: true }], meilleurs: [] },
      comptes: { facebook: { abonnes: 1284, releve_le: "2026-11-12", evolution_7_jours: 6, evolution_30_jours: 21 }, instagram: { abonnes: 312, releve_le: "2026-11-12", evolution_7_jours: 2, evolution_30_jours: null } },
      retours: { periode_posts: 132, part_gardee_globale: 56, par_format: [{ cle: "carrousel annonce", proposes: 28, gardes: 22, refuses: 6, part_gardee: 79 }, { cle: "pédagogie objet 3D", proposes: 34, gardes: 19, refuses: 15, part_gardee: 56 }], motifs_de_refus: [{ cle: "sans raison", libelle: "sans raison", refus: 44 }, { cle: "photos", libelle: "Photos (mauvaise photo, pas le bon bien)", refus: 4 }] },
    });
    if (path.startsWith("api-inbox")) return Promise.resolve({ inbox: [{ created_at: new Date().toISOString(), brand: { name: "Basket" }, kind: "match", title: "Contre Châteaurenard", files: ["a", "b", "c"], status: "nouveau" }], id: "x", uploads: [] });
    if (path.startsWith("api-listings")) return Promise.resolve({ listings: [
      { id: "l1", reference: "471", external_id: "602", kind: "vente", title: "Villa 3 chambres parking, garage et extérieur", city: "Graveson", price: 273000, dpe: null, dpe_note: "DPE ancienne version", status: "disponible", manual_status: null, url: "https://www.amoinvest.fr/", changed_at: new Date().toISOString(), derniere_proposition: { date: new Date(Date.now() - 7 * 864e5).toISOString(), status: "rejected" } },
      { id: "l2", reference: "443", external_id: "547", kind: "location", title: "Maison T3 - Mallemort - 1400€ CC", city: "Mallemort", price: 1400, dpe: "C", ges: "A", status: "disponible", manual_status: "sous_offre", url: "https://www.amoinvest.fr/", changed_at: new Date().toISOString(), derniere_proposition: { date: new Date(Date.now() - 40 * 864e5).toISOString(), status: "published" } },
      { id: "l3", reference: "512", external_id: "599", kind: "vente", title: "Maison de village 120 m² + terrasse A RENOVER", city: "Graveson", price: 155000, dpe: "D", ges: "C", status: "retire", manual_status: null, url: "https://www.amoinvest.fr/", changed_at: new Date(Date.now() - 2 * 864e5).toISOString(), derniere_proposition: null },
    ] });
    if (path.startsWith("api-events")) return Promise.resolve({ events: [{ at: new Date().toISOString(), source: "routine", level: "info", message: "Post image AMO préparé, mail envoyé" }, { at: new Date().toISOString(), source: "netlify", level: "info", message: "Lecture du site : 12 fiches, 1 nouvelle" }] });
    return Promise.resolve({ ok: true, total: 12, nouveaux: [1], modifies: [], retires: [], notes: [] });
  }

  // ---------- Démarrage ----------
  if (!key && !DEMO) showLogin(); else showTab("posts");
})();
