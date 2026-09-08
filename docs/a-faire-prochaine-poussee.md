# À faire à la prochaine poussée

Idées et corrections validées avec Olivier, à embarquer dans le prochain push (rien ne part sans son signal).

- [ ] **Dépôt par marque** (idée d'Olivier, 8 sept.) : dans l'onglet « Déposer », choisir d'abord la marque, puis le type de dépôt ; chaque combinaison ouvre son propre formulaire.
  - AMO Invest : info d'agence (signature, mandat, événement), bien à mettre en avant (référence ou lien de la fiche), photo.
  - Basket : match (date, adversaire, score, domicile, clips), entraînement ou moment d'équipe (clips, deux phrases).
  - Chaîne tech : idée de vidéo (sujet, appli concernée, ce qu'il faut montrer), enregistrement (voix, remarque), capture d'écran.
- [x] **Calibrage du lecteur amoinvest.fr** (fait le 8 sept., session 2, dans `netlify/functions/_lib/listings.js`) :
  - titre : balise `<title>` (« Villa 148m² Graveson ») ; le détail du `<h1>` (pièces, chambres, surface) va dans `raw.headline` et `raw.bedrooms`
  - DPE / GES : le site les affiche en « bulles » A→G dont une seule porte `bubble--active` ; lues sur 31 fiches sur 51 (les autres sont en « DPE ancienne version » ou vierges : rien d'inventé). L'image officielle du diagnostic est gardée dans `raw.dpe_image` / `raw.ges_image`
  - honoraires : bloc « Informations financières » (« Prix de vente honoraires TTC inclus », « Honoraires TTC charge locataire… »), plus « à la charge du vendeur » quand la description le dit
  - photos : uniquement les photos du bien (dossier `images/biens`), en 1600 px, sans l'avatar du négociateur ; adresses `//…` normalisées en `https://`
  - description et caractéristiques gardées dans `raw` pour l'écriture des posts ; bandeaux (« Exclusivité », « Nouveauté », « Coup de cœur ») dans `raw.banners`
  - **Après la poussée** : cliquer « Relire le site maintenant » dans l'onglet Annonces pour remplir la base avec ces nouvelles données (la lecture planifiée de 9h le fera sinon).
- [ ] **Réseau de l'environnement Claude Code** : ajouter `*.staticlbi.com` (photos des biens) et `*.cloudfront.net` (rendus Higgsfield) à la liste blanche. En attendant, `render/fetch-media.js` passe par la fonction Supabase `fetch-image` (relais en lecture seule, hôtes limités) : voir `docs/atelier-visuel.md` §6.
- [ ] **Dépôt par marque** (ci-dessus) : toujours à faire, prochaine session.
