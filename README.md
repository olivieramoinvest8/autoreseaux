# amo-social-bot

Automatisation des posts réseaux sociaux d'AMO Invest (agence immobilière, Graveson 13690) avec Claude Code.

- `BRIEF.md` : le projet complet, source de vérité.
- `CLAUDE.md` : la charte de travail pour Claude (ton, interdits, formats, couleurs).

## État d'avancement

| Phase | Contenu | État |
|---|---|---|
| 1. Accès | App Meta, Google Cloud / YouTube, TikTok | À faire par Olivier |
| 2. Repo | Structure, CLAUDE.md, skills, templates HTML, rendu PNG | **Fait** |
| 3. Supabase | `supabase/schema.sql`, buckets, clé service | Fichier SQL prêt, à exécuter |
| 4. n8n | Workflow aperçu mail → validation → publication | Squelette vide |
| 5. Routine image 11h03 | Routine Claude Code + run manuel | À faire |
| 6. Vidéo 18h03 | GitHub Actions, Playwright, Remotion | Squelettes vides |

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
scripts/publish-to-supabase.js upload + insert + webhook n8n (phase 3)
n8n/workflow-publication.json  workflow de validation/publication (phase 4)
supabase/schema.sql            table posts + buckets
.github/workflows/             rendu vidéo (phase 6)
```
