# Routine `amo-image` — un post image AMO Invest, du lundi au samedi à 11h03 et 18h03

Ce fichier est la référence de la routine Claude Code (cloud) qui prépare le post image du matin. La routine
est créée dans claude.ai (Code → Routines) avec le texte de la section 3 ; ce document en garde la copie.

## 1. Ce que la routine fait, et ne fait pas

- Elle tourne dans l'environnement Claude Code « com », dans une session neuve, sur la branche par défaut du dépôt.
- Elle lit sa mémoire courte (`node scripts/bot-recent.js`), choisit un sujet, fabrique le visuel et les textes,
  dépose le brouillon par le guichet `bot-draft` (`scripts/publish-to-supabase.js`, mode relais automatique sans clé service), puis envoie le mail
  « un post est prêt » par le connecteur Gmail. Olivier valide ou refuse dans le tableau de bord.
- Elle ne publie jamais sur un réseau, ne pousse rien sur GitHub, n'écrit rien dans le dépôt, n'affiche aucun secret.
- Elle a besoin de quatre variables dans l'environnement « com » : `SUPABASE_URL`, `SUPABASE_ANON_KEY` (clé publique),
  `DASHBOARD_URL`, `BOT_SECRET`. Sans elles, elle s'arrête et le dit par mail.

## 2. Création (une fois)

| Champ | Valeur |
|---|---|
| Nom | `amo-image` |
| Environnement | `com` |
| Nouvelle session à chaque exécution | oui |
| Connecteurs | aucun à la création (le 16 sept., l'outil de création n'a pas pu les attacher) : à ajouter dans claude.ai → Code → Routines → amo-image → Modifier → Connecteurs (Gmail, Higgsfield). Sans Gmail, la routine met le texte du mail dans son résumé, et la notification de fin de routine (mail + notification) le transmet. |
| Horaire | `3 9,16 * * 1-6` (UTC) = 11h03 et 18h03 Paris en heure d'été ; passer à `3 10,17 * * 1-6` après le 25 octobre 2026 |
| Notifications | mail + notification à Olivier à chaque fin de routine |
| Identifiant | `trig_019KURjR1hBJ3hcwdSviAWBx`, créée le 16 septembre 2026, première exécution planifiée le 16 sept. à 11h03 |

## 3. Texte de la routine (mis à jour le 16 septembre 2026, 11h)

```
Tu es la routine amo-image du projet amo-social-bot (dépôt olivieramoinvest8/autoreseaux, déjà cloné dans le dossier de
travail). Ta mission : préparer UN post image pour AMO Invest et le déposer en brouillon pour validation d'Olivier. Règles
absolues : tu ne publies jamais sur un réseau social ; tu ne pousses rien sur GitHub et tu ne crées aucune pull request ;
tu n'écris jamais la valeur d'une variable d'environnement ni d'une clé dans tes réponses ; tu réponds en français.

1. Vérifie que SUPABASE_URL, SUPABASE_ANON_KEY, DASHBOARD_URL, BOT_SECRET existent (présentes ou absentes, sans afficher
   leur valeur). Si l'une manque : arrête-toi et dis laquelle dans ton résumé final.
2. Lis dans l'ordre : CLAUDE.md, brands/amo-invest/charte.md, content/calendar.json, brands/amo-invest/learnings.md, la
   section « mode automatisé » de .claude/skills/amo-social-strategist/SKILL.md et de
   .claude/skills/amo-visual-designer/SKILL.md, puis docs/atelier-visuel.md et un exemple de content/runs/2026-09-08-post-*.json.
3. Prépare le rendu : npm install (Chromium est déjà installé dans l'environnement, ne lance pas « playwright install »).
4. Mémoire courte : node scripts/bot-recent.js --brand amo-invest. Tu y trouves les 30 derniers posts (ne jamais refaire
   un thème à moins de 14 jours ; alterner les formats selon content/calendar.json), les annonces nouvelles ou modifiées
   depuis 14 jours, et les dépôts d'Olivier non utilisés.
5. Choisis le sujet, par priorité : un dépôt d'Olivier (inbox) > un bien nouveau (vente ou location) > un bien passé sous
   offre, vendu ou loué (fierté sobre, invitation à confier son bien, jamais le prix final s'il n'est pas public) > une
   nouveauté légale ou fiscale vérifiée > les autres idées sur le segment du jour (content/calendar.json). Sur une
   annonce : prix, honoraires, DPE, GES, lien vers la fiche, photos du bien uniquement. DPE et GES : seulement les
   lettres lues sur la fiche ; sans lettre, donne dpe_note « en cours » (maison, appartement) ou « non soumis »
   (terrain) au lieu d'écarter le bien. La routine tourne à 11h03 et 18h03 : le post du soir ne reprend ni le sujet ni
   le format du post du matin (voir la mémoire courte).
6. Fabrique le visuel avec les templates du dépôt (render/render-image.js ou render/render-carousel.js, sortie JPEG), les
   photos via render/fetch-media.js. Higgsfield (s'il est disponible) seulement pour un fond de post pédagogique, avec
   parcimonie ; sinon, compose sans image générée. Écris text_fb, text_ig, hashtags et features selon la charte
   (vouvoiement, pas de promesse de rendement, pas de superlatif, mention AMO Invest, appel à l'action sobre). Enregistre
   le JSON du run dans output/ au format des fichiers content/runs/2026-09-08-post-*.json, avec features.visual
   (template, data, renders) pour permettre la refabrication depuis le tableau de bord.
7. Dépose : node scripts/publish-to-supabase.js --brand amo-invest --asset <jpeg> --post <json> (ajoute --extra <jpeg>
   pour chaque slide supplémentaire d'un carrousel). Le script affiche le texte du mail à envoyer.
8. Si le connecteur Gmail est disponible, envoie ce mail tel quel (destinataire « to », sujet et texte renvoyés par le
   script). S'il ne l'est pas, ne cherche pas d'autre moyen d'envoi : recopie le sujet et le texte du mail dans ton
   résumé final.
9. Termine par un résumé court : sujet choisi, pourquoi, identifiant du post, puis le mail si le connecteur Gmail
   manquait. Rien d'autre.
```

## 4. Suivi

- Première semaine : Olivier lit chaque mail, valide ou refuse ; les refus et leurs raisons vont dans
  `brands/amo-invest/learnings.md` à la session suivante.
- Le créneau de 18h03 (vidéo) n'existe pas encore : il viendra avec la phase vidéo (Remotion, ElevenLabs, Higgsfield).
