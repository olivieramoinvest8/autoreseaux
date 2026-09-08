# amo-social-bot

Automatisation des posts réseaux sociaux d'AMO Invest (agence immobilière, Graveson 13690) avec Claude Code.

- `BRIEF.md` : le projet complet, source de vérité.
- `CLAUDE.md` : la charte de travail pour Claude (ton, interdits, formats, couleurs).

## État d'avancement

| Phase | Contenu | État |
|---|---|---|
| 0. Architecture | `docs/architecture-v2.md` : trois marques, hybride gratuit, tableau de bord | **Décidée** |
| 1. Comptes | App Meta, projet Google, app TikTok (inbox), Supabase, Netlify, comptes sociaux | À faire par Olivier, guidé |
| 2. Repo | Templates, rendu PNG, schéma Supabase (appliqué sur « Communication »), tableau de bord, fonctions Netlify, lecteur amoinvest.fr, script des routines | **En production** (Netlify) |
| 2 bis. Atelier visuel v1 | Affiche annonce (feed + story), carrousel 5 slides, pédagogie premium (objet 3D Higgsfield), lecteur calibré (DPE/GES, honoraires, photos) | **Construit, 3 créations réelles en validation** |
| 3. Bout en bout | Premier vrai post AMO validé et publié sur Facebook et Instagram | À faire |
| 4. Routine AMO image | Routine Claude Code + une semaine d'observation | À faire |
| 5. Vidéo | GitHub Actions, Remotion, ElevenLabs, présentateur Higgsfield | Squelettes vides |
| 6. Basket | Dépôt de match, montage, brouillon TikTok | À faire |

## Produire un visuel en local (3 commandes)

Ouvrez un terminal dans le dossier du projet, puis :

```bash
npm install                      # 1. installe la bibliothèque de rendu (une seule fois)
npx playwright install chromium  # 2. installe le navigateur invisible qui fait la capture (une seule fois)
npm run test:image               # 3. produit output/post-feed-test.png
```

Pour un autre texte : copiez `content/examples/post-test.json`, modifiez les champs, puis :

```bash
node render/render-image.js --template templates/post-feed.html --data content/mon-post.json --out output/mon-post.png
```

Templates disponibles : `post-feed.html` (1080×1350), `post-story.html` (1080×1920), `datacard.html` (chiffre-clé), `annonce-feed.html` et `annonce-story.html` (affiche d'annonce), `carrousel-cover.html` / `carrousel-photo.html` / `carrousel-infos.html` (carrousel), `pedagogie-premium.html` (objet 3D + titre en relief). Voir `docs/atelier-visuel.md` §6.

Un carrousel complet : `node render/render-carousel.js --data content/runs/2026-09-08-carrousel-447.json --dir output/creations`.
Télécharger une photo du site ou un rendu Higgsfield : `node render/fetch-media.js --url <adresse> --out output/assets/photo.jpg` (voir `.env.example` pour le relais).
Les rendus de référence sont dans `output/examples/`.

## Arborescence

```
CLAUDE.md, BRIEF.md            charte et brief
.claude/skills/                amo-social-strategist, amo-visual-designer
assets/brand/                  logo officiel (PNG recadré + JPG original)
assets/fonts/                  Oswald et Inter (licence OFL)
content/calendar.json          thèmes par jour, rotation des segments
content/examples/              textes d'exemple pour les tests
templates/                     post-feed, post-story, datacard, annonce-feed, annonce-story, carrousel-*, pedagogie-premium
render/render-image.js         HTML → PNG ou JPEG (Playwright)
render/render-carousel.js      toutes les slides d'un carrousel depuis un JSON
render/fetch-media.js          téléchargement des photos et rendus (direct ou relais Supabase)
assets/generated/              images Higgsfield réutilisables (objets 3D dorés)
content/runs/                  données des créations et textes par réseau, un fichier par post
render/remotion, scenarios     vidéo (phase 6)
scripts/publish-to-supabase.js upload + insert + mail « un post est prêt » (phase 2)
netlify/site/                  tableau de bord privé (posts prêts, déposer, annonces, historique)
netlify/functions/             API du tableau de bord, liens Valider/Refuser, publication Meta/YouTube/TikTok, lecteur du site, OAuth
brands/<slug>/                 charte et enseignements par marque
docs/netlify-env.md            variables d'environnement à renseigner dans Netlify
supabase/schema.sql            tables et buckets
supabase/functions/            fonctions Supabase : fetch-image (relais d'images), bot-draft (guichet de dépôt des routines)
.github/workflows/             rendu vidéo (phase 6)
```
