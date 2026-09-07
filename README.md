# amo-social-bot

Automatisation des posts réseaux sociaux d'AMO Invest (agence immobilière, Graveson 13690) avec Claude Code.

- `BRIEF.md` : le projet complet, source de vérité.
- `CLAUDE.md` : la charte de travail pour Claude (ton, interdits, formats, couleurs).

## État d'avancement

| Phase | Contenu | État |
|---|---|---|
| 0. Architecture | `docs/architecture-v2.md` : trois marques, hybride gratuit, tableau de bord | **Décidée** |
| 1. Comptes | App Meta, projet Google, app TikTok (inbox), Supabase, Netlify, comptes sociaux | À faire par Olivier, guidé |
| 2. Repo | Templates, rendu PNG, schéma Supabase (appliqué sur « Communication »), tableau de bord, fonctions Netlify, lecteur amoinvest.fr, script des routines | **Construit, en attente de push** |
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

Templates disponibles : `post-feed.html` (1080×1350), `post-story.html` (1080×1920), `datacard.html` (chiffre-clé, 1080×1350).
Les rendus de référence sont dans `output/examples/`.

## Arborescence

```
CLAUDE.md, BRIEF.md            charte et brief
.claude/skills/                amo-social-strategist, amo-visual-designer
assets/brand/                  logo officiel (PNG recadré + JPG original)
assets/fonts/                  Oswald et Inter (licence OFL)
content/calendar.json          thèmes par jour, rotation des segments
content/examples/              textes d'exemple pour les tests
templates/                     post-feed.html, post-story.html, datacard.html
render/render-image.js         HTML → PNG (Playwright)
render/remotion, scenarios     vidéo (phase 6)
scripts/publish-to-supabase.js upload + insert + mail « un post est prêt » (phase 2)
netlify/site/                  tableau de bord privé (posts prêts, déposer, annonces, historique)
netlify/functions/             API du tableau de bord, liens Valider/Refuser, publication Meta/YouTube/TikTok, lecteur du site, OAuth
brands/<slug>/                 charte et enseignements par marque
docs/netlify-env.md            variables d'environnement à renseigner dans Netlify
supabase/schema.sql            table posts + buckets
.github/workflows/             rendu vidéo (phase 6)
```
