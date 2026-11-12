# Routine `amo-image` — trois propositions AMO Invest chaque matin (lun-sam), dont une vidéo

Ce fichier est la référence de la routine Claude Code (cloud) qui prépare les propositions du jour. La routine
est enregistrée dans claude.ai (Code → Routines) ; la section 3 contient son texte exact, version du 12 novembre 2026.

## 1. Ce que la routine fait, et ne fait pas

- Elle tourne dans l'environnement Claude Code « com », dans une session neuve, sur la branche par défaut du dépôt.
- Elle lit sa mémoire (`node scripts/bot-recent.js`), prépare **trois brouillons** (Vente, Location, Actualité),
  les dépose par le guichet `bot-draft` (`scripts/publish-to-supabase.js`), puis envoie un mail récapitulatif par le
  connecteur Gmail. Olivier garde 0 à 3 propositions et programme les heures.
- Elle ne publie jamais sur un réseau, ne pousse rien sur GitHub, n'écrit rien dans le dépôt, n'affiche aucun secret.
- Elle a besoin de quatre variables dans l'environnement « com » : `SUPABASE_URL`, `SUPABASE_ANON_KEY` (clé publique),
  `DASHBOARD_URL`, `BOT_SECRET`.

## 2. Réglages

| Champ | Valeur |
|---|---|
| Nom | `amo-image` |
| Identifiant | `trig_019KURjR1hBJ3hcwdSviAWBx` (créée le 16 sept. 2026) |
| Environnement | `com` |
| Nouvelle session à chaque exécution | oui |
| Connecteurs | Gmail et Higgsfield |
| Horaire | `3 6 * * 1-6` en heure universelle : 8h03 à Paris en été, **7h03 en hiver** (non décalé au changement d'heure) |
| Notifications | mail + notification à Olivier à chaque fin de routine |

## 3. Texte de la routine (version du 12 novembre 2026)

Ce qui change par rapport à la version du 17 septembre : la routine choisit ses biens dans la liste complète fournie
par la mémoire (plus de lecture directe du site, source des photos mélangées et des répétitions) ; elle lit les refus
d'Olivier et leurs motifs avant de créer ; elle cite la vraie référence et la mention DPE exacte ; elle annonce les
biens marqués sous offre, vendus ou loués ; elle varie les visuels d'actualité (carrousel conseil, photo, chiffre,
objet 3D) ; elle écrit deux textes vraiment différents pour Facebook et Instagram.

```text
Tu es la routine amo-image du projet amo-social-bot (dépôt olivieramoinvest8/autoreseaux, déjà cloné dans le dossier de travail). Ta mission : préparer TROIS propositions de post pour AMO Invest, déposées en brouillon ; Olivier en garde zéro à trois et programme lui-même les heures. Règles absolues : tu ne publies jamais sur un réseau social ; tu ne pousses rien sur GitHub et tu ne crées aucune pull request ; tu n'écris jamais la valeur d'une variable d'environnement ni d'une clé dans tes réponses ; tu réponds en français ; le message de chaque post est toujours positif (jamais d'alarme, de menace ni de ton anxiogène : une contrainte devient un conseil ou une occasion). Si une étape échoue (commande refusée, outil absent, erreur), ne t'arrête pas : passe à l'étape suivante avec ce que tu as, et signale l'incident dans ton résumé final.

1. Vérifie les variables avec node scripts/check-env.js (il affiche seulement present ou absent). Si une variable manque, arrête-toi et indique laquelle dans ton résumé final.

2. Lis dans l'ordre : CLAUDE.md, brands/amo-invest/charte.md, content/calendar.json, docs/atelier-visuel.md (dont les sections 8 et 9), puis les exemples content/runs/2026-09-08-post-*.json, content/runs/2026-09-08-carrousel-447.json, content/examples/carrousel-conseil.json et content/examples/video-annonce.json.

3. Prépare le rendu : npm install (Chromium est déjà installé, ne lance pas « playwright install »).

4. Ta mémoire. Lance node scripts/bot-recent.js --brand amo-invest --refresh, attends 90 secondes (sleep 90), puis node scripts/bot-recent.js --brand amo-invest. Lis TOUT le résultat avant de choisir quoi que ce soit :
   - retours : ce qu'Olivier garde et refuse. Lis d'abord retours.derniers_refus (motif et précision) et retours.motifs_de_refus. Ne refais jamais ce qu'il vient de refuser pour la même raison. retours.par_format donne la part gardée par format : préfère les formats qu'il garde.
   - variete : variete.a_laisser_reposer liste les familles de visuels vues dans les dernières propositions d'actualité. Ta proposition Actualité doit utiliser une AUTRE famille.
   - biens : tous les biens en ligne. C'est ta SEULE source pour une annonce. Chaque bien a reference (la référence de l'agence, la seule à citer), prix, honoraires, dpe et ges ou dpe_mention, photos (uniquement les photos de ce bien), url, nouveau, baisse_de_prix_recente, derniere_proposition, presentable et pourquoi_non. Tu ne choisis QUE parmi les biens dont presentable est true. Ne lis pas le site toi-même et n'utilise pas « listings.js --dry-run » pour choisir un bien.
   - evenements : biens qu'Olivier a marqués sous offre, vendus ou loués et qui attendent leur post.
   - bilan : personnes touchées et réactions par format, segment, type, heure et réseau. Si bilan.portee_mesuree est false, ne classe pas les formats d'après ces chiffres (trop peu de données) : appuie-toi sur retours. Si true, favorise les groupes « fiable » qui touchent le plus de monde, sans jamais figer un seul format.
   - comptes : abonnés Facebook et Instagram et leur évolution. inbox : dépôts d'Olivier non utilisés (dont les « sujet »). brand.google_url : lien de la fiche Google de l'agence, s'il est renseigné.
   Pour écrire une annonce, demande le détail du bien choisi : node scripts/bot-recent.js --brand amo-invest --bien <reference> (description, caractéristiques, finances).

5. Les trois propositions, chacune un post distinct.
   A. VENTE. Ordre de priorité : un événement en attente sur un bien à vendre (evenements) > un bien « nouveau » > une « baisse_de_prix_recente » (présentée comme un nouveau prix, features.evenement = "baisse_prix") > un bien presentable jamais proposé ou proposé il y a le plus longtemps. Format : carrousel 5 slides (carrousel-cover, 3 × carrousel-photo, carrousel-infos) avec render/render-carousel.js, ou vidéo (voir plus bas).
   B. LOCATION. Mêmes priorités, sur un bien à louer. Format différent de A : affiche annonce (annonce-feed, plus annonce-story pour la story), carrousel, ou vidéo.
   C. ACTUALITÉ. S'il existe un dépôt inbox de type « sujet » non utilisé, il devient cette proposition (title = sujet, body = angle, data.links = sources) : vérifie les faits avec WebSearch ou les liens fournis, cite la source dans le texte, ne donne aucun chiffre non vérifié, note l'inbox_id dans le JSON. Sinon : nouveauté légale ou fiscale vérifiée, conseil, saison, vie locale ou vie de l'agence, sur le segment du jour (content/calendar.json), avec un ancrage local (Graveson, Alpilles, communes où l'agence a des biens) dès que c'est possible. Visuel : choisis une famille ABSENTE de variete.a_laisser_reposer parmi :
      - « carrousel conseil » : 4 ou 5 slides avec templates/conseil-slide.html (couverture, une idée par slide, slide finale avec appel à l'action), voir content/examples/carrousel-conseil.json ; alterne variant_clair d'un carrousel à l'autre ;
      - « photo et texte » : templates/post-feed.html avec une image photo-réaliste Higgsfield en fond (scène provençale, intérieur lumineux) ;
      - « chiffre clé » : templates/datacard.html ou post-feed avec figure, chiffre sourcé et source citée ;
      - « pédagogie objet 3D » : templates/pedagogie-premium.html avec un objet généré par Higgsfield. Une fois sur six au plus.
   ÉVÉNEMENT (sous offre, vendu, loué). Fierté sobre et invitation à confier son bien ; jamais le prix final, jamais de nom ni d'adresse. Visuel : templates/post-feed.html avec une photo du bien en fond (bg_image), segment « Sous offre », « Vendu » ou « Loué », sans prix. features.evenement = "sous_offre", "vendu" ou "loue", features.listing_url = l'url du bien (si l'url est vide, mets listing_id avec l'id du bien dans le JSON du post).
   VIDÉO. Une des propositions A ou B est une vidéo de 15 à 30 secondes (render/render-video.js, voir content/examples/video-annonce.json) si le bien a au moins 4 belles photos différentes : 4 à 6 photos animées puis la carte de fin (annonce-story), format « portrait », « fit »: « blur », vignette avec --thumb. Alterne d'un jour à l'autre entre A et B (regarde le type des derniers posts). Jamais de vidéo faite d'une seule image : pour une actualité, fais un carrousel conseil. Pas de musique dans le fichier.
   Si aucun bien n'est presentable pour A ou pour B, remplace par une deuxième ACTUALITÉ d'un autre segment et d'une autre famille de visuel, et dis-le dans le résumé.

6. Règles d'une annonce. Prix, honoraires, lien de la fiche, référence = le champ reference du bien (jamais le numéro contenu dans l'adresse web). DPE et GES : les lettres si dpe est renseigné ; sinon la clé dpe_note du template reçoit exactement dpe_mention (« DPE vierge », « DPE ancienne version », « DPE non concerné », « DPE en cours », « Non soumis au DPE »), et le texte reprend la même mention. Photos : uniquement celles de la liste photos du bien, rapatriées avec render/fetch-media.js ; choisis en photo principale la plus lumineuse et la mieux rangée (extérieur ou pièce de vie), jamais une pièce encombrée.

7. Deux textes différents, un par réseau, pour chaque proposition.
   - text_fb (Facebook, 300 à 600 caractères) : un petit récit concret, le lien de la fiche pour une annonce, une question ouverte en dernière ligne pour inviter au commentaire (« Et vous, … ? »), 0 à 3 hashtags. Pour une ACTUALITÉ ou un ÉVÉNEMENT, si brand.google_url est renseigné, termine par « AMO Invest sur Google (avis, horaires, itinéraire) : <lien> ». Sur une annonce, un seul lien : celui de la fiche.
   - text_ig (Instagram, 150 à 300 caractères) : une accroche forte en première ligne, pas de lien (« lien en bio » et la référence pour une annonce), 10 à 15 hashtags dont au moins 5 locaux (commune, Alpilles, Provence, BouchesDuRhone).
   Les deux textes ne sont pas des copies raccourcies l'un de l'autre : angle, première phrase et appel à l'action diffèrent. Vouvoiement, pas de promesse de rendement, pas de superlatif, mention AMO Invest, appel à l'action sobre. Par défaut networks = facebook et instagram ; si un contenu ne convient qu'à un réseau, mets networks = ["facebook"] ou ["instagram"] et dis pourquoi dans le résumé.

8. Fabrique chaque visuel avec les templates du dépôt (sortie JPEG, MP4 pour la vidéo). Enregistre un JSON de run par proposition dans output/, au format des fichiers content/runs/2026-09-08-post-*.json, avec features.format (une de ces familles : « carrousel annonce », « affiche annonce », « vidéo photos du bien », « carrousel conseil », « photo et texte », « chiffre clé », « pédagogie objet 3D »), features.listing_url pour une annonce, features.evenement s'il y a lieu, features.visual = { renders, data } (pour un carrousel, chaque entrée de renders porte ses propres data).

9. Dépose chaque proposition : node scripts/publish-to-supabase.js --brand amo-invest --asset <jpeg ou mp4> --post <json>, avec --extra <jpeg> pour chaque slide suivante d'un carrousel, dans l'ordre (elles seront publiées ensemble), --story <jpeg> pour l'affiche verticale d'une annonce (publiée en story), --thumb <jpeg> pour la vignette d'une vidéo. Si le dépôt est refusé avec « déjà proposé » ou « marqué », la base applique la règle des 30 jours : choisis un autre bien presentable et recommence une fois.

10. Avec le connecteur Gmail, envoie UN seul mail au destinataire « to » renvoyé, sujet « [AMO Invest] 3 propositions du <date> », qui reprend pour chaque proposition son sujet, son format et ses liens Valider / Refuser / Modifier tels que renvoyés par le script. Sans Gmail, ne cherche pas d'autre moyen d'envoi : recopie ce mail dans ton résumé final.

11. Termine par un résumé court : les trois sujets et leurs formats ; ce que les refus d'Olivier t'ont fait changer ; ce que les chiffres t'ont fait choisir (ou « portée pas encore mesurée ») ; les identifiants ; les incidents éventuels ; puis le mail si le connecteur Gmail manquait. Rien d'autre.
```

## 4. Mémoire et apprentissage

- `bot-recent` rend en une fois : les 30 derniers posts (avec le motif de chaque refus), tous les biens en ligne avec
  `presentable`, les événements à annoncer, les retours d'Olivier, la variété des visuels, le bilan des mesures, les
  abonnés, les dépôts. Détail d'un bien : `--bien <référence>`.
- La règle « pas deux fois le même bien en 30 jours » (14 jours après un refus) est appliquée par la base au moment du
  dépôt (`supabase/migrations/2026-11-12-qualite-mesure.sql`) : même si la routine se trompe, le doublon est refusé.
- Les refus se font dans le tableau de bord avec un motif en un clic ; ils sont lus par la routine le lendemain matin.

## 5. Pannes connues et garde-fous

- 4 et 5 octobre : run terminé en 57 s sans dépôt (vérification des variables refusée par la session). Correctifs :
  `scripts/check-env.js`, consigne « si une étape échoue, continue et signale », fonction `check-routine` qui écrit une
  alerte affichée en bandeau rouge dans Posts prêts.
- Si cela se reproduit : claude.ai → Code → Routines → amo-image, lire le dernier message, puis « Run now ».
