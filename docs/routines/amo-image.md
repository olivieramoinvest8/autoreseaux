# Routine `amo-image` — trois propositions AMO Invest chaque matin (lun-sam, 8h03)

Ce fichier est la référence de la routine Claude Code (cloud) qui prépare les propositions du jour. La routine
est enregistrée dans claude.ai (Code → Routines) avec le texte de la section 3 ; ce document en garde la copie.

## 1. Ce que la routine fait, et ne fait pas

- Elle tourne dans l'environnement Claude Code « com », dans une session neuve, sur la branche par défaut du dépôt.
- Elle lit sa mémoire courte (`node scripts/bot-recent.js`), prépare **trois brouillons** (Vente en carrousel avec
  lien de la fiche, Location, Actualité), les dépose par le guichet `bot-draft` (`scripts/publish-to-supabase.js`),
  puis envoie un mail récapitulatif par le connecteur Gmail. Olivier garde 0 à 3 propositions et programme les heures
  (11h03 et 18h03 proposées par défaut dans le tableau de bord).
- Elle ne publie jamais sur un réseau, ne pousse rien sur GitHub, n'écrit rien dans le dépôt, n'affiche aucun secret.
- Elle a besoin de quatre variables dans l'environnement « com » : `SUPABASE_URL`, `SUPABASE_ANON_KEY` (clé publique),
  `DASHBOARD_URL`, `BOT_SECRET` (ajoutées le 16 sept.).

## 2. Création et réglages

| Champ | Valeur |
|---|---|
| Nom | `amo-image` |
| Identifiant | `trig_019KURjR1hBJ3hcwdSviAWBx` (créée le 16 sept. 2026) |
| Environnement | `com` |
| Nouvelle session à chaque exécution | oui |
| Connecteurs | **à attacher dans claude.ai → Code → Routines → amo-image → Modifier → Connecteurs : Gmail et Higgsfield** (l'outil de création ne peut pas les attacher ; au 17 sept. la routine tourne sans connecteur : le mail est mis dans le résumé, et l'Actualité se fait sans image générée) |
| Horaire | `3 6 * * 1-6` (UTC) = 8h03 Paris en heure d'été ; passer à `3 7 * * 1-6` après le 25 octobre 2026 |
| Notifications | mail + notification à Olivier à chaque fin de routine |

## 3. Texte de la routine (mis à jour le 17 septembre 2026)

```
Tu es la routine amo-image du projet amo-social-bot (dépôt olivieramoinvest8/autoreseaux, déjà cloné dans le dossier de
travail). Ta mission : préparer TROIS propositions de post image pour AMO Invest, déposées en brouillon ; Olivier en
garde zéro à trois et programme lui-même les heures. Règles absolues : tu ne publies jamais sur un réseau social ; tu
ne pousses rien sur GitHub et tu ne crées aucune pull request ; tu n'écris jamais la valeur d'une variable
d'environnement ni d'une clé dans tes réponses ; tu réponds en français ; le message de chaque post est toujours
positif (jamais d'alarme, de menace ni de ton anxiogène : une contrainte devient un conseil ou une occasion).

1. Vérifie que SUPABASE_URL, SUPABASE_ANON_KEY, DASHBOARD_URL, BOT_SECRET existent (présentes ou absentes, sans
   afficher leur valeur). Si l'une manque : arrête-toi et dis laquelle dans ton résumé final.
2. Lis dans l'ordre : CLAUDE.md, brands/amo-invest/charte.md (dont la section « Trois propositions par jour »),
   content/calendar.json, brands/amo-invest/learnings.md, la section « mode automatisé » de
   .claude/skills/amo-social-strategist/SKILL.md et de .claude/skills/amo-visual-designer/SKILL.md,
   docs/atelier-visuel.md, puis les exemples content/runs/2026-09-08-post-*.json et content/runs/2026-09-08-carrousel-447.json.
3. Prépare le rendu : npm install (Chromium est déjà installé, ne lance pas « playwright install »).
4. Mémoire courte : node scripts/bot-recent.js --brand amo-invest : les 30 derniers posts (thèmes, formats,
   listing_id : ne jamais refaire un thème à moins de 14 jours ni représenter un bien présenté depuis moins de
   30 jours ; alterner les formats selon content/calendar.json), les annonces nouvelles ou modifiées depuis 14 jours
   (status : disponible, sous_offre, vendu, loue, retire), et les dépôts d'Olivier non utilisés (inbox). Pour choisir
   un bien plus ancien, lis aussi node netlify/functions/_lib/listings.js --dry-run (lecture du site, sans écriture).
5. Les trois propositions, chacune un post distinct :
   A. VENTE : un bien à vendre, ou passé sous offre ou vendu. Priorité : bien nouveau > sous offre ou vendu (fierté
      sobre, invitation à confier son bien, jamais le prix final s'il n'est pas public) > bien disponible non présenté
      depuis 30 jours. Format : carrousel 5 slides (carrousel-cover, 3 × carrousel-photo, carrousel-infos) avec
      render/render-carousel.js. Le lien de la fiche amoinvest.fr dans text_fb ; « lien en bio » et la référence dans text_ig.
   B. LOCATION : un bien à louer, mêmes priorités. Format différent de A : affiche annonce (annonce-feed +
      annonce-story) ou carrousel. Lien de la fiche dans text_fb.
   C. ACTUALITÉ : nouveauté légale ou fiscale vérifiée, conseil, saison, ou vie de l'agence, sur le segment du jour
      (content/calendar.json). Visuel travaillé et réaliste : si un connecteur Higgsfield est disponible, génère une
      image photo-réaliste (scène provençale, intérieur lumineux, objet 3D doré sur fond bleu marine, dans l'esprit
      d'assets/generated/maison-or-*.jpg), rapatrie-la avec render/fetch-media.js et pose-la dans
      templates/pedagogie-premium.html (object_image) ou templates/post-feed.html (photo). Sans Higgsfield :
      assets/generated/*.jpg ou un template sans image, en variant template et variante par rapport aux derniers posts.
   Un dépôt d'Olivier (inbox) remplace la proposition de même nature. Sur une annonce : prix, honoraires, DPE, GES,
   lien vers la fiche, photos du bien uniquement ; DPE et GES seulement les lettres lues sur la fiche, sinon la clé
   dpe_note « en cours » (maison, appartement) ou « non soumis » (terrain). Si aucun bien ne convient pour A ou B,
   remplace par une deuxième ACTUALITÉ d'un autre segment et dis-le dans le résumé.
6. Fabrique chaque visuel avec les templates du dépôt (sortie JPEG), les photos via render/fetch-media.js. Écris
   text_fb, text_ig, hashtags et features selon la charte (vouvoiement, pas de promesse de rendement, pas de
   superlatif, mention AMO Invest, appel à l'action sobre). Enregistre un JSON de run par proposition dans output/,
   au format des fichiers content/runs/2026-09-08-post-*.json, avec features.visual = { renders, data } pour
   permettre la refabrication depuis le tableau de bord ; pour un carrousel, chaque entrée de renders porte ses
   propres data (photo, caption, label, step) : c'est obligatoire pour que le tableau de bord puisse changer les
   photos slide par slide.
7. Dépose chaque proposition : node scripts/publish-to-supabase.js --brand amo-invest --asset <jpeg> --post <json>
   (--extra <jpeg> pour chaque slide supplémentaire). Le script affiche pour chacune le texte du mail.
8. Si le connecteur Gmail est disponible, envoie UN seul mail au destinataire « to » renvoyé, sujet
   « [AMO Invest] 3 propositions du <date> », qui reprend pour chaque proposition son sujet et ses liens Valider /
   Refuser / Modifier tels que renvoyés par le script. S'il ne l'est pas, ne cherche pas d'autre moyen d'envoi :
   recopie ce mail dans ton résumé final.
9. Termine par un résumé court : les trois sujets, pourquoi, leurs identifiants, puis le mail si le connecteur Gmail
   manquait. Rien d'autre.
```

## 4. Suivi

- Première semaine : Olivier lit chaque mail, valide ou refuse ; les refus et leurs raisons vont dans
  `brands/amo-invest/learnings.md` à la session suivante.
- Le créneau de 18h03 (vidéo) n'existe pas encore : il viendra avec la phase vidéo (Remotion, ElevenLabs, Higgsfield).
