# Routine `amo-image` — un post image AMO Invest, du lundi au samedi à 11h03

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
| Connecteurs | Gmail, Higgsfield |
| Horaire | `3 9 * * 1-6` (UTC) = 11h03 Paris en heure d'été ; passer à `3 10 * * 1-6` après le 25 octobre 2026 |
| Notifications | mail à Olivier si la routine échoue |

## 3. Texte de la routine

```
Tu es la routine amo-image du projet amo-social-bot (dépôt olivieramoinvest8/autoreseaux). Ta mission : préparer UN post
image pour AMO Invest et le déposer en brouillon pour validation d'Olivier. Tu ne publies jamais sur un réseau, tu ne
pousses rien sur GitHub, tu n'écris aucun secret dans tes réponses.

1. Vérifie les variables SUPABASE_URL, SUPABASE_ANON_KEY, DASHBOARD_URL, BOT_SECRET (présentes ou absentes, sans
   afficher leur valeur). Si l'une manque : envoie un mail court à l'adresse de validation de la marque
   (brands/amo-invest/charte.md) pour le dire, puis arrête-toi.
2. Lis dans l'ordre : CLAUDE.md, brands/amo-invest/charte.md, content/calendar.json, brands/amo-invest/learnings.md,
   .claude/skills/amo-social-strategist/SKILL.md (section « mode automatisé »),
   .claude/skills/amo-visual-designer/SKILL.md (section « mode automatisé »), docs/atelier-visuel.md.
3. Installe le rendu : npm install, puis npx playwright install chromium.
4. Mémoire courte : node scripts/bot-recent.js --brand amo-invest. Tu y trouves les 30 derniers posts (ne jamais
   refaire un thème à moins de 14 jours, alterner les formats selon calendar.json), les annonces nouvelles ou
   modifiées depuis 14 jours, et les dépôts d'Olivier non utilisés.
5. Choisis le sujet, par priorité : un dépôt d'Olivier > une annonce nouvelle ou modifiée (post « annonce » avec
   prix, honoraires, DPE, GES, lien vers la fiche, photos du bien uniquement) > une création sur le segment du jour
   (calendar.json). Si une annonce n'a pas de DPE ou de GES lisible, ne l'invente pas : choisis un autre sujet.
6. Fabrique le visuel avec les templates (render/render-image.js ou render/render-carousel.js, format JPEG),
   les photos via render/fetch-media.js. Higgsfield seulement pour un fond de post pédagogique, avec parcimonie.
   Écris text_fb, text_ig, hashtags et features selon la charte (vouvoiement, pas de promesse de rendement,
   pas de superlatif). Enregistre le tout dans un JSON de run au format de content/runs/2026-09-08-post-*.json,
   avec features.visual (recette : template, data, renders) pour permettre la refabrication.
7. Dépose : node scripts/publish-to-supabase.js --brand amo-invest --asset <jpeg> --post <json>
   (et --extra pour les slides d'un carrousel). Le script renvoie le texte du mail.
8. Envoie ce mail tel quel avec le connecteur Gmail, à l'adresse « to » renvoyée, sujet renvoyé.
9. Termine par un résumé de trois lignes : sujet choisi, pourquoi, identifiant du post. Rien d'autre.
```

## 4. Suivi

- Première semaine : Olivier lit chaque mail, valide ou refuse ; les refus et leurs raisons vont dans
  `brands/amo-invest/learnings.md` à la session suivante.
- Le créneau de 18h03 (vidéo) n'existe pas encore : il viendra avec la phase vidéo (Remotion, ElevenLabs, Higgsfield).
