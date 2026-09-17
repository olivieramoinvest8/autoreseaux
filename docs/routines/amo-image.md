# Routine `amo-image` — trois propositions AMO Invest chaque matin (lun-sam, 8h03), dont une vidéo

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
| Connecteurs | Gmail et Higgsfield, attachés par Olivier le 17 sept. dans claude.ai → Code → Routines → amo-image (crayon → section Connectors) |
| Horaire | `3 6 * * 1-6` (UTC) = 8h03 Paris en heure d'été ; passer à `3 7 * * 1-6` après le 25 octobre 2026 |
| Notifications | mail + notification à Olivier à chaque fin de routine |

## 3. Texte de la routine (mis à jour le 17 septembre 2026, version « trois propositions dont une vidéo »)

Le texte enregistré est celui de la routine dans claude.ai ; il reprend les sections 2 et 5 de la charte AMO et ajoute : une des trois propositions est une vidéo (`render/render-video.js`, `--thumb` pour la vignette, type `video`, réseaux facebook + instagram en reel), en rotation d'un jour à l'autre ; `npm install` installe ffmpeg-static ; un seul mail récapitulatif « [AMO Invest] 3 propositions du <date> ». Pour le relire ou le modifier : claude.ai → Code → Routines → amo-image → crayon.

## 4. Suivi

- Première semaine : Olivier lit chaque mail, valide ou refuse ; les refus et leurs raisons vont dans
  `brands/amo-invest/learnings.md` à la session suivante.
- Le créneau de 18h03 (vidéo) n'existe pas encore : il viendra avec la phase vidéo (Remotion, ElevenLabs, Higgsfield).
