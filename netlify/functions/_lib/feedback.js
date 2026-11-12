/**
 * Les retours d'Olivier, rendus lisibles pour la routine et pour l'onglet Performances.
 *
 *  formatFamily()  : ramène le texte libre de features.format à une famille stable (« carrousel annonce »,
 *                    « pédagogie objet 3D »…), pour compter et comparer.
 *  feedback()      : part des propositions gardées par format, segment et type ; motifs de refus comptés ;
 *                    les derniers refus avec leur raison. C'est ce que la routine lit avant de créer.
 *  variety()       : les familles de visuels utilisées récemment et celles à laisser reposer aujourd'hui.
 */
const REJECT_CATEGORIES = {
  photos: "Photos (mauvaise photo, pas le bon bien)",
  deja_fait: "Déjà fait ou bien déjà présenté",
  theme: "Sujet sans intérêt",
  visuel: "Visuel (toujours pareil, pas assez travaillé)",
  video: "Vidéo (montage, durée, plan fixe)",
  texte: "Texte à revoir",
  bien_indisponible: "Bien vendu, loué ou plus disponible",
  autre: "Autre",
};

function formatFamily(format) {
  const f = String(format || "").toLowerCase();
  if (!f) return "?";
  if (/carrousel/.test(f)) return /conseil|p[ée]dagog/.test(f) ? "carrousel conseil" : "carrousel annonce";
  if (/affiche/.test(f)) return "affiche annonce";
  if (/objet 3d|p[ée]dagogie premium/.test(f)) return "pédagogie objet 3D";
  if (/vid[ée]o/.test(f)) return /g[ée]n[ée]r[ée]e/.test(f) ? "vidéo image générée" : "vidéo photos du bien";
  if (/data ?card|chiffre/.test(f)) return "chiffre clé";
  if (/post-feed|photo/.test(f)) return "photo et texte";
  return f.slice(0, 40);
}

const KEPT = ["published", "partial", "approved"];

/** posts : lignes de social.posts (id, type, segment, theme, status, created_at, features, reject_category, reject_reason, error). */
function feedback(posts) {
  const decided = posts.filter((p) => KEPT.includes(p.status) || p.status === "rejected");
  const group = (key) => {
    const g = {};
    for (const p of decided) {
      const k = key(p) || "?"; const e = g[k] || (g[k] = { cle: k, proposes: 0, gardes: 0, refuses: 0 });
      e.proposes++; if (p.status === "rejected") e.refuses++; else e.gardes++;
    }
    return Object.values(g).map((e) => ({ ...e, part_gardee: Math.round((e.gardes / e.proposes) * 100) })).sort((a, b) => b.proposes - a.proposes);
  };
  const rejected = decided.filter((p) => p.status === "rejected").sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const motifs = {};
  for (const p of rejected) { const c = p.reject_category || (p.reject_reason || p.error ? "autre" : "sans raison"); motifs[c] = (motifs[c] || 0) + 1; }
  return {
    periode_posts: decided.length,
    part_gardee_globale: decided.length ? Math.round(((decided.length - rejected.length) / decided.length) * 100) : null,
    par_format: group((p) => formatFamily(p.features && p.features.format)),
    par_segment: group((p) => p.segment),
    par_type: group((p) => p.type),
    motifs_de_refus: Object.entries(motifs).map(([cle, n]) => ({ cle, libelle: REJECT_CATEGORIES[cle] || cle, refus: n })).sort((a, b) => b.refus - a.refus),
    derniers_refus: rejected.slice(0, 25).map((p) => ({
      date: String(p.created_at).slice(0, 10), theme: p.theme, type: p.type, format: formatFamily(p.features && p.features.format),
      motif: p.reject_category ? REJECT_CATEGORIES[p.reject_category] || p.reject_category : null,
      precision: p.reject_reason || p.error || null,
    })),
  };
}

/**
 * Variété : familles des derniers posts image et vidéo. Règle d'Olivier : un même visuel ne revient pas avant
 * 6 posts. `a_laisser_reposer` = familles vues dans les 6 dernières propositions « hors annonce » ; pour les annonces,
 * la famille (carrousel, affiche, vidéo) alterne d'un jour à l'autre.
 */
function variety(posts) {
  const recent = posts.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const isListing = (p) => /^annonce/i.test(p.theme || "") || !!p.listing_id;
  const fam = (p) => formatFamily(p.features && p.features.format);
  const actu = recent.filter((p) => !isListing(p)).slice(0, 6);
  const count = {};
  for (const p of recent.slice(0, 30)) count[fam(p)] = (count[fam(p)] || 0) + 1;
  return {
    derniers_formats: recent.slice(0, 12).map((p) => ({ date: String(p.created_at).slice(0, 10), famille: fam(p), annonce: isListing(p), statut: p.status })),
    a_laisser_reposer: Array.from(new Set(actu.map(fam))),
    repartition_30_derniers: count,
  };
}

module.exports = { REJECT_CATEGORIES, formatFamily, feedback, variety };
