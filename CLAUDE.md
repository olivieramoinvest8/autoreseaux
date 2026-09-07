# CLAUDE.md — amo-social-bot

Charte de travail pour Claude Code sur ce dépôt. `BRIEF.md` est la source de vérité complète ; ce fichier en est le résumé opérationnel. Lis les deux avant toute action.

## 1. Qui, quoi, pour qui

- **Entreprise** : AMO Invest, agence immobilière (SARL) à Graveson, 13690, Bouches-du-Rhône. Gérant : Olivier Faure.
- **Positionnement** : conseil honnête et direct, clientèle d'investisseurs. Slogan : « vous c'est nous ». Pas de vente émotionnelle, pas de promesse de rendement.
- **Segments d'audience** : vendeurs, investisseurs, acheteurs, bailleurs.
- **Trois marques** : AMO Invest (Facebook page + Instagram pro), chaîne tech / IA (YouTube + TikTok), basket (TikTok, matchs de son fils). Ce fichier détaille la charte AMO ; chaque marque aura la sienne dans `brands/<slug>/charte.md`.
- **Logiciel immobilier** : Hektor. Les annonces d'amoinvest.fr (pages vente et location) sont lues par une fonction Netlify planifiée vers la table `listings` ; plus tard, par la passerelle Hektor.
- **Chaque post enregistre ses caractéristiques** (`posts.features` : accroche, durée, sujet, format, présentateur, CTA) pour l'analyse. Lire `brands/<slug>/learnings.md` avant de créer.
- **Olivier ne veut pas apparaître à l'écran** : présentateur virtuel Higgsfield, voix ElevenLabs, écran des applis au centre.
- **Olivier est débutant en code** : explique chaque commande, livre des fichiers copiables, une étape à la fois. Jamais de jargon sans traduction.

## 2. Ce que fait ce dépôt

- AMO : 11h03 (lun-sam) un post image ; 18h03 (lun-sam) une vidéo verticale de 45 à 60 s.
- Tech : lun, mer, ven, une vidéo longue de 4 à 6 min et 3 à 5 extraits verticaux complets en eux-mêmes (jamais de « partie 1/10 »).
- Basket : montage d'un match dès qu'Olivier en dépose un.
- Chaque post est validé par Olivier dans le tableau de bord privé (mail « un post est prêt » + lien).
- **Claude ne publie jamais directement sur un réseau social.** Après validation, une fonction Netlify publie via les APIs Meta et YouTube, ou dépose un brouillon TikTok qu'Olivier publie depuis l'appli.

## 3. Architecture (décisions validées, ne pas remettre en cause sans Olivier)

| Brique | Choix | Rôle |
|---|---|---|
| Déclencheur | Routines Claude Code (cloud), une par marque et par créneau | amo-image, amo-video, tech-video, basket-match |
| Cerveau | Ce repo + skills `.claude/skills/` | Choix du sujet, rédaction, fabrication des assets |
| Source AMO | Pages vente/location du site → table `listings` ; passerelle Hektor plus tard | Nouveau bien, sous offre, vendu → post « annonce » avec lien vers le site |
| Visuels image | `templates/*.html` → PNG via `render/render-image.js` (Playwright) | 1080×1350 feed, 1080×1920 story ; fond Higgsfield avec parcimonie |
| Vidéo | GitHub Actions (Playwright + Remotion + ffmpeg) | Une longue 16:9 + extraits 9:16, sous-titres depuis le script |
| Voix et présentateur | ElevenLabs ; Higgsfield Speak + Soul ID | Contenu synthétique signalé dans les descriptions |
| Stockage | Supabase, projet « Communication », schéma `social` | `brands`, `posts`, `listings`, `inbox`, `matches`, `tokens` + buckets `visuels`, `videos`, `raw` |
| Validation | Mail Gmail → tableau de bord privé Netlify (`netlify/site`, mot de passe `DASHBOARD_PASSWORD`) | Valider / Refuser / Modifier, Copier, Télécharger, Déposer, Annonces, Historique |
| Publication | Fonctions Netlify : API Meta, API YouTube, brouillon TikTok | Jamais Claude en direct. n8n et Postiz écartés |
| Stats et apprentissage | Routine `analytics` via Windsor.ai → `metrics` ; `posts.features` ; `brands/<slug>/learnings.md` | Lu par le stratège à chaque création. Un test par semaine |

Stack déjà chez Olivier : Netlify, Railway, Supabase, Canva, GitHub, Hektor, Higgsfield. MCP disponibles : Gmail, Google Calendar, Supabase, Netlify, Canva, ElevenLabs, Higgsfield, Windsor.ai, Stripe, Microsoft 365.

## 4. Règles de contenu (obligatoires)

### Ton
- Direct, concret, pédagogique. On explique, on ne vend pas.
- **Vouvoiement obligatoire** envers les clients. Le tutoiement est interdit.
- Signature d'esprit : « vous c'est nous ». Proximité et franc-parler, jamais corporate ni grandiloquent.

### Interdits
- Promesse de rendement chiffré garanti (« 8 % garantis », « investissement sans risque »).
- Superlatifs non vérifiables : « meilleur », « n°1 », « le moins cher ».
- Données personnelles (nom de client, adresse précise d'un bien, numéro de téléphone d'un particulier).
- Photos de biens sans mandat. Aucune photo trouvée sur le web.
- Chiffres fiscaux ou légaux non vérifiés. En cas de doute, ne pas citer de chiffre.

### Toujours
- Mentionner AMO Invest.
- Localiser (Graveson / Bouches-du-Rhône / Provence) quand c'est pertinent.
- Un appel à l'action sobre (« Parlons-en », « Écrivez-nous », « Estimation sur rendez-vous »).
- Rotation des segments sur la semaine (voir `content/calendar.json`).
- Jamais deux fois le même thème en 14 jours : relire les 30 derniers `posts` en base avant de choisir.
- Sur un visuel d'annonce (vente/location) : DPE et GES lisibles, mention des honoraires. Ne jamais inventer ces valeurs.

### Formats par réseau
| Réseau | Contrainte |
|---|---|
| Facebook | 300 à 600 caractères, texte long autorisé, 0 à 3 hashtags |
| Instagram | 150 à 300 caractères + 10 à 15 hashtags |
| TikTok / YouTube Shorts | titre ≤ 60 caractères, description ≤ 300 caractères |
| Image feed | 1080×1350 (4:5) |
| Story / vidéo | 1080×1920 (9:16) |

## 5. Charte graphique

- **Bleu marine** `#2E358D` : couleur dominante, fonds et blocs.
- **Or** `#E9CA31` : accents, accroches, filets. **Or foncé** `#E0B21F` : ombres, relief.
- **Blanc** `#FFFFFF` : texte principal sur fond bleu, cartouche du logo.
- **Noir** : uniquement dans le logo et les mentions légales.
- **Typographies** : Oswald (titres, majuscules, condensée), Inter (texte courant). Jamais de script/cursive en dehors du mot « invest » du logo.
- **Logo** : `assets/brand/logo-amo-invest.png` (fichier officiel, jamais redessiné). Il a un fond blanc : sur fond bleu, on le pose dans un cartouche blanc en bas du visuel.
- **Signature visuelle** : diagonales blanches/dorées sur fond bleu marine, placées hors des zones de texte.
- **Lisibilité** : contraste fort, aucun élément graphique qui traverse un texte ou le logo.

## 6. Flux d'un run (résumé)

1. Lire la charte de la marque, `calendar.json`, les 30 derniers `posts` de la marque et la table `inbox`.
2. AMO : lire les pages vente et location du site, mettre à jour `listings`, noter les changements.
3. Sujet par priorité : dépôt d'Olivier > changement d'annonce > création (ancien bien, loi vérifiée, chiffre sourcé, vie de l'agence).
4. Skill `amo-social-strategist` : angle et textes par réseau. Lien vers la fiche du site sur toute annonce.
5. Skill `amo-visual-designer` : template HTML → PNG ; ou `scenario.json` + script → GitHub Actions.
6. Uploader l'asset dans le bucket Supabase, insérer dans `posts` avec `status = 'draft'`.
7. Envoyer le mail « un post est prêt » (Gmail) avec le lien du tableau de bord.
8. Olivier valide → fonction Netlify publie ou dépose le brouillon TikTok → `posts` passe en `published`.

## 7. Commandes utiles

```bash
npm install                      # installe Playwright (une seule fois)
npx playwright install chromium  # installe le navigateur de rendu (une seule fois)
npm run test:image               # produit output/post-feed-test.png à partir de l'exemple
node render/render-image.js --template templates/post-feed.html --data content/examples/post-test.json --out output/mon-post.png
npm run test:functions          # vérifie la syntaxe des fonctions Netlify
npm run test:listings           # auto-test du lecteur d'annonces amoinvest.fr
node netlify/functions/_lib/listings.js --dry-run   # lit vraiment le site, n'écrit rien
node scripts/publish-to-supabase.js --brand amo-invest --asset output/post.png --post content/runs/<date>.json
```

Règle de travail avec Olivier : **rien n'est poussé sur GitHub sans son accord explicite** (« on pousse »), car Netlify construit le site à chaque push. On commite en local, on pousse sur son signal.

## 8. Conventions de code

- Node.js ≥ 20, JavaScript CommonJS, pas de TypeScript (Olivier doit pouvoir lire le code).
- Chaque script a un en-tête qui explique en français ce qu'il fait et comment le lancer.
- Aucune clé ou token dans le dépôt : tout passe par des variables d'environnement (`.env` ignoré par git, secrets GitHub Actions).
- Le dossier `output/` est ignoré par git, sauf `output/examples/` qui conserve les rendus de référence.
- Ne jamais publier depuis une routine : la publication est le rôle exclusif des fonctions Netlify, après validation d'Olivier.
- Sur une annonce : prix, honoraires, DPE, GES et lien vers le site sont obligatoires ; photos uniquement celles du bien sous mandat (Hektor ou site).
