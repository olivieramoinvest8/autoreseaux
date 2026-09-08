# Passation — reprendre le projet dans une nouvelle session

Document écrit le 8 septembre 2026 pour qu'une nouvelle conversation Claude Code reprenne exactement où la précédente s'est arrêtée. À lire en premier, puis `CLAUDE.md`, `BRIEF.md`, `docs/architecture-v2.md`, `docs/atelier-visuel.md`, `docs/a-faire-prochaine-poussee.md`.

## 1. Qui et comment travailler
- Olivier Faure, gérant d'AMO Invest (agence immobilière, Graveson 13690). **Débutant en code** : expliquer chaque commande, une étape à la fois, en français, jamais de jargon sans traduction.
- **Rien n'est poussé sur GitHub sans son « on pousse »** : Netlify construit le site à chaque push. On commite en local, on pousse sur son signal, en regroupant.
- Jamais de mot de passe dans la conversation. Les clés vont dans les variables Netlify ; Olivier colle lui-même les secrets.
- Analyser toutes les options avant de recommander ; donner une recommandation nette.
- Claude ne publie jamais directement sur un réseau. La publication passe par les fonctions Netlify après validation d'Olivier.

## 2. Ce qui existe et fonctionne
| Brique | État | Où |
|---|---|---|
| Dépôt `olivieramoinvest8/autoreseaux`, branche `claude/brief-task-9-aa5k12` | Production Netlify | GitHub |
| Templates image AMO + rendu PNG (Playwright) | Fait, testé | `templates/`, `render/render-image.js`, `output/examples/` |
| Base Supabase, projet **« Communication »** (`milxjogpfpwipigdfyeb`), schéma `social` | Appliqué, exposé à l'API, droits posés | `supabase/schema.sql` |
| Site Netlify **`communicationsocial`** (id `aa002809-08e7-41c6-8c73-840bbb7e974a`) relié au dépôt | Déployé, 13 fonctions, 2 tâches planifiées | `netlify.toml`, `netlify/` |
| Tableau de bord privé https://communicationsocial.netlify.app | **Testé OK** par Olivier : connexion, lecture du site, dépôt | `netlify/site/` |
| Lecteur d'annonces amoinvest.fr → `social.listings` | **Calibré le 8 sept. (session 2)** : titre, DPE/GES par bulles (31 fiches sur 51), honoraires, photos propres, description dans `raw`. En base : encore l'ancienne lecture tant que la poussée n'est pas faite, puis « Relire le site maintenant » | `netlify/functions/_lib/listings.js` |
| Fonctions : liens Valider/Refuser, publication Meta/YouTube/TikTok, OAuth Google et TikTok, renouvellement jeton Meta | Déployées, **non testées** (les applications Meta/Google/TikTok n'existent pas encore) | `netlify/functions/` |
| Script des routines (upload + insert draft + texte du mail) | Écrit, non testé en réel | `scripts/publish-to-supabase.js` |
| Chartes des trois marques | Écrites | `brands/*/charte.md` |
| **Atelier visuel v1** : affiche annonce (feed + story), carrousel 5 slides, pédagogie premium ; scripts carrousel et téléchargement ; relais d'images Supabase `fetch-image` | Construit, **3 créations réelles montrées à Olivier le 8 sept.**, en attente de ses corrections puis d'une poussée | `templates/`, `render/`, `content/runs/`, `docs/atelier-visuel.md` §6 |
| Documentation : architecture v2.1, parcours de l'idée à la diffusion (XMind), atelier visuel, liste à faire | Écrites | `docs/` |

Variables Netlify posées : `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (par Olivier), `DASHBOARD_PASSWORD` (choisi par Olivier), `DASHBOARD_URL`, `INTERNAL_SECRET`, `SITE_BASE_URL`. Manquent : `META_*`, `GOOGLE_*`, `TIKTOK_*`.

Connecteurs disponibles dans l'environnement : GitHub, Supabase, Netlify, Gmail, Google Calendar, Windsor.ai, Cloudflare, **Higgsfield** (plan Plus, ≈ 1 200 crédits/mois). Non connectés pour l'instant : ElevenLabs, Canva.

Réseau de l'environnement : vérifié le 8 sept. (session 2), `curl -I https://www.amoinvest.fr` répond 200 ; Supabase et Netlify passent. **Bloqués** : `amoinvest.staticlbi.com` (photos des biens) et `*.cloudfront.net` (rendus Higgsfield). À ajouter à la liste blanche ; en attendant, `render/fetch-media.js` passe par la fonction Supabase `fetch-image`.

## 3. Décisions prises (ne pas rouvrir sans Olivier)
- Trois marques : AMO Invest (Facebook + Instagram), chaîne tech/IA (YouTube + TikTok, nom à choisir), basket (TikTok au nom d'Olivier, fils de 14 ans, prénom seul).
- Publication hybride gratuite : API Meta, API YouTube, brouillon TikTok dans l'appli. Pas de Postiz, pas de n8n.
- Validation dans le tableau de bord, mail « un post est prêt » via Gmail.
- Source des annonces : lecture d'amoinvest.fr maintenant, passerelle Hektor (flux vers FTP Railway) avec la refonte du site.
- Visuels **recherchés** (photo travaillée, profondeur, 3D) : moteur de composition interne HTML/CSS + Higgsfield pour l'imagerie, voir `docs/atelier-visuel.md`. Références d'Olivier : affiche « Open House », visuels holographiques IA, affiches de match « VS ».
- Chaîne tech : longue 4-6 min + 3 à 5 extraits, présentateur virtuel Higgsfield en intro/conclusion, Olivier n'apparaît pas. Voix ElevenLabs (plan à confirmer).
- Analyse et apprentissage : routine `analytics` via Windsor.ai, `posts.features`, `brands/<slug>/learnings.md`.
- Dépôt par marque dans le tableau de bord (idée d'Olivier, à faire).

## 4. Ordre des prochaines étapes
1. **Vérifier le réseau** de la session (`curl -I https://www.amoinvest.fr`) et que Higgsfield répond.
2. **Atelier visuel v1** : fait en session 2 (affiche annonce feed + story, carrousel, pédagogie premium ; calibrage du lecteur). Trois créations réelles montrées à Olivier (réf. 458, réf. 447, « le prix juste se calcule »). **Reste** : ses corrections, le dépôt par marque, l'affiche événement, puis une seule poussée (« on pousse »), puis « Relire le site maintenant » dans le tableau de bord.
3. **Application Meta** (Olivier, guidé écran par écran, 45 min) : étapes A à D décrites dans la conversation précédente, reprises ci-dessous.
4. **Routine `amo-image`** (11h03 lun-sam, Paris) avec connecteurs GitHub, Supabase, Gmail, Higgsfield ; premier run à la main ; premier vrai post validé et publié sur Facebook et Instagram.
5. Ensuite : vidéo AMO 18h, chaîne tech, basket, analytics.

## 5. Application Meta, résumé des étapes pour Olivier
A. Instagram en compte professionnel, lié à la page Facebook (Centre de comptes).
B. developers.facebook.com → « Créer une app », cas d'usage « Autre », type « Entreprise », nom `AMO Social Bot`. Noter ID de l'app et clé secrète. Ajouter « Facebook Login for Business ». Rester en mode développement.
C. Explorateur Graph API : autorisations `pages_show_list, pages_read_engagement, pages_manage_posts, instagram_basic, instagram_content_publish, business_management` ; générer le jeton ; `me/accounts` → ID de page + jeton de page ; `<page-id>?fields=instagram_business_account` → ID Instagram ; prolonger le jeton dans l'outil de débogage.
D. Olivier donne ID app, ID page, ID Instagram (Claude les pose dans Netlify via le connecteur, portée « all », sans option secret : l'offre gratuite refuse « secret » et les portées restreintes). Olivier colle lui-même `META_APP_SECRET` et `META_PAGE_TOKEN`.

## 6. Encore attendu d'Olivier
- Adresse Gmail qui reçoit « un post est prêt ».
- Nom de la chaîne tech ; plan ElevenLabs ; couleurs et logo du club de basket.
- Comptes à créer : chaîne YouTube tech, TikTok tech, TikTok basket.

## 7. Pièges connus
- `Invalid schema: social` / `schema cache` : le schéma `social` doit être exposé (`alter role authenticator set pgrst.db_schemas`) et l'API rechargée (`notify pgrst, 'reload schema'`). Déjà fait ; à refaire si un jour la base est recréée.
- Netlify offre gratuite : variables sans option « secret » et sans portée restreinte, sinon refus silencieux.
- Le fichier `.github/workflows/render-video.yml` doit rester en YAML valide (déclencheur manuel seulement) : un YAML invalide envoie un mail « failed » à chaque push.
- Les MCP se déconnectent et reconnectent : recharger les outils avec ToolSearch au besoin.
