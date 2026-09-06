# CLAUDE.md — amo-social-bot

Charte de travail pour Claude Code sur ce dépôt. `BRIEF.md` est la source de vérité complète ; ce fichier en est le résumé opérationnel. Lis les deux avant toute action.

## 1. Qui, quoi, pour qui

- **Entreprise** : AMO Invest, agence immobilière (SARL) à Graveson, 13690, Bouches-du-Rhône. Gérant : Olivier Faure.
- **Positionnement** : conseil honnête et direct, clientèle d'investisseurs. Slogan : « vous c'est nous ». Pas de vente émotionnelle, pas de promesse de rendement.
- **Segments d'audience** : vendeurs, investisseurs, acheteurs, bailleurs.
- **Réseaux** : Facebook (page), Instagram (compte pro), TikTok, YouTube Shorts.
- **Olivier est débutant en code** : explique chaque commande, livre des fichiers copiables, une étape à la fois. Jamais de jargon sans traduction.

## 2. Ce que fait ce dépôt

- 11h03 (lun-sam) : un post image (texte + visuel PNG).
- 18h03 (lun-sam) : une vidéo verticale de 45 à 60 s.
- Chaque post est validé par Olivier avant publication (aperçu par mail via n8n, bouton « Valider »).
- **Claude ne publie jamais directement sur un réseau social.** La publication est faite par n8n après validation.

## 3. Architecture (décisions validées, ne pas remettre en cause sans Olivier)

| Brique | Choix | Rôle |
|---|---|---|
| Déclencheur | Routines Claude Code (cloud) | cron `3 11 * * 1-6` et `3 18 * * 1-6` |
| Cerveau | Ce repo + skills `.claude/skills/` | Choix du sujet, rédaction, fabrication des assets |
| Visuels image | `templates/*.html` → PNG via `render/render-image.js` (Playwright) | 1080×1350 feed, 1080×1920 story |
| Vidéo | GitHub Actions (Playwright + Remotion + ffmpeg) | MP4 1080×1920, sous-titres, hook |
| Voix off | ElevenLabs (MCP) | Optionnel |
| Stockage | Supabase | Table `posts` + buckets publics `visuels` et `videos` |
| Validation | n8n → mail Gmail avec aperçu | Lien Valider / Refuser |
| Publication | n8n (Facebook, Instagram, YouTube ; TikTok à trancher) | Jamais Claude en direct |
| Stats | Windsor.ai (MCP) | Phase 2 |

Stack déjà chez Olivier : Netlify, Railway, Supabase, n8n, Canva, GitHub. MCP disponibles : Gmail, Google Calendar, Supabase, Netlify, Canva, ElevenLabs, Higgsfield, Windsor.ai, Stripe, Microsoft 365.

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

1. Lire `content/calendar.json` et les 30 derniers `posts` en base.
2. Skill `amo-social-strategist` : segment + angle, textes par réseau.
3. Skill `amo-visual-designer` : remplir un template HTML → PNG (11h) ; ou `scenario.json` + script vidéo → GitHub Actions (18h).
4. Uploader l'asset dans le bucket Supabase → URL publique.
5. Insérer dans `posts` avec `status = 'draft'`.
6. Appeler le webhook n8n avec `{post_id}`.
7. Olivier valide → n8n publie → met à jour `posts`.

## 7. Commandes utiles

```bash
npm install                      # installe Playwright (une seule fois)
npx playwright install chromium  # installe le navigateur de rendu (une seule fois)
npm run test:image               # produit output/post-feed-test.png à partir de l'exemple
node render/render-image.js --template templates/post-feed.html --data content/examples/post-test.json --out output/mon-post.png
```

## 8. Conventions de code

- Node.js ≥ 20, JavaScript CommonJS, pas de TypeScript (Olivier doit pouvoir lire le code).
- Chaque script a un en-tête qui explique en français ce qu'il fait et comment le lancer.
- Aucune clé ou token dans le dépôt : tout passe par des variables d'environnement (`.env` ignoré par git, secrets GitHub Actions).
- Le dossier `output/` est ignoré par git, sauf `output/examples/` qui conserve les rendus de référence.
- Ne jamais toucher aux réseaux sociaux depuis ce dépôt : la publication est le rôle exclusif de n8n.
