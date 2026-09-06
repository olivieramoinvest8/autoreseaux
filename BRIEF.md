# BRIEF — amo-social-bot (v2.1, 6 septembre 2026)
Automatisation des posts réseaux sociaux de trois marques d'Olivier avec Claude Code.
Ce fichier est la source de vérité du projet. Lis-le en entier avant toute action. Le détail des choix et des options écartées est dans `docs/architecture-v2.md`.

## 1. Contexte
- Entreprise : AMO Invest, agence immobilière (SARL, Graveson 13690). Gérant : Olivier Faure.
- Positionnement : conseil honnête et direct, clientèle investisseurs, slogan « vous c'est nous ». Pas de vente émotionnelle, pas de promesse de rendement.
- Segments d'audience AMO : vendeurs, investisseurs, acheteurs, bailleurs.
- Trois marques : **AMO Invest** (Facebook page + Instagram pro), **chaîne tech / IA** (YouTube + TikTok, nom à choisir), **basket** (TikTok, résumés des matchs de son fils).
- Logiciel immobilier : Hektor (La Boîte Immo). Site : amoinvest.fr, deux pages à lire (vente, location) par une fonction Netlify planifiée. Refonte du site prévue.
- Compte TikTok basket au nom d'Olivier (son fils a 14 ans et n'a pas TikTok). Prénom seul, jamais de nom de famille.
- Olivier est débutant en code : explique chaque commande, livre des fichiers copiables, une étape à la fois.

## 2. Objectif
- AMO : 11h03 (lun-sam) post image ; 18h03 (lun-sam) vidéo verticale 45-60 s.
- Tech : lun, mer, ven 18h03, une vidéo longue de 4-6 min (YouTube) et 3-5 extraits verticaux (TikTok, Shorts).
- Basket : chaque soir à 20h, montage s'il y a un match déposé.
- Chaque post est validé par Olivier dans un tableau de bord privé (mail « un post est prêt » + lien). Le 100 % automatique viendra plus tard.
- Olivier ne veut pas apparaître à l'écran : présentateur virtuel Higgsfield en intro et conclusion, écran des applis au centre, voix ElevenLabs.

## 3. Décisions d'architecture (validées)
| Brique | Choix | Rôle |
|---|---|---|
| Déclencheur | Routines Claude Code (cloud), une par marque et par créneau | amo-image `3 10 * * 1-6`, amo-video `3 17 * * 1-6`, tech-video `3 17 * * 1,3,5`, basket-match `0 19 * * *` (UTC) |
| Cerveau | Ce repo + skills Claude | Choisit le sujet, rédige texte/script, fabrique les assets |
| Source AMO | Lecture des pages vente/location du site → table `listings` ; passerelle Hektor (flux vers FTP Railway) avec la refonte du site | Nouveau bien, sous offre, vendu, baisse de prix → post « annonce » avec lien vers le site |
| Visuels image | Template HTML/CSS → PNG (Playwright) | 1080×1350 feed, 1080×1920 story. Fond IA Higgsfield avec parcimonie, photos réelles des biens sous mandat |
| Vidéo | GitHub Actions (Playwright + Remotion + ffmpeg) | Une longue 16:9 + extraits 9:16 depuis le même montage, sous-titres depuis le script |
| Voix et présentateur | ElevenLabs (voix clonée ou choisie) ; Higgsfield Speak + Soul ID (présentateur virtuel, intro et conclusion) | Contenu synthétique signalé dans les descriptions |
| Stockage | Supabase, projet dédié | Tables `brands`, `posts`, `listings`, `inbox`, `matches`, `tokens` + buckets `visuels`, `videos`, `raw` |
| Validation | Mail Gmail « un post est prêt » → tableau de bord privé Netlify (téléphone) | Valider / Refuser / Modifier, Copier le texte, Télécharger, Déposer (info, match, enregistrement) |
| Publication | Fonctions Netlify : API Meta (FB + IG), API YouTube, brouillon TikTok dans l'appli | Claude ne publie jamais directement. 0 € d'abonnement. n8n et Postiz écartés |
| Stats et apprentissage | Routine `analytics` (lundi 9h) via Windsor.ai → table `metrics` ; `posts.features` ; `brands/<slug>/learnings.md` lu par le stratège | Onglet Performances du tableau de bord, mail hebdomadaire, un test par semaine |

Stack déjà en place chez Olivier : Netlify, Railway, Supabase, Canva, GitHub, Hektor, Higgsfield. Connecteurs MCP disponibles : Gmail, Google Calendar, Supabase, Netlify, Canva, ElevenLabs, Higgsfield, Windsor.ai, Stripe, Microsoft 365.

## 4. Flux d'un run
1. Routine démarre, lit la charte de sa marque, `calendar.json`, les 30 derniers `posts` de la marque, et la table `inbox` (dépôts d'Olivier).
2. AMO uniquement : lit les pages vente et location du site, met à jour `listings`, note les changements.
3. Priorité du sujet : dépôt d'Olivier > changement d'annonce > création (ancien bien, loi vérifiée, chiffre sourcé, vie de l'agence).
4. Skill `amo-social-strategist` : angle et textes par réseau (FB long, IG + hashtags, TikTok/YouTube titre + description, lien vers le site pour les annonces).
5. Skill `amo-visual-designer` : template HTML → PNG (image) ; ou `scenario.json` + script → GitHub Actions rend les MP4 (vidéo).
6. Upload de l'asset dans le bucket Supabase → URL publique. Insert dans `posts` avec statut `draft`.
7. Mail Gmail « un post est prêt » avec lien vers le tableau de bord.
8. Olivier valide → fonction Netlify publie (Meta, YouTube) ou dépose le brouillon TikTok → `posts` passe en `published` avec `external_ids`.

## 5. Modèle de données Supabase (table `posts`)
```
id uuid pk, created_at, slot text ('11h'|'18h'), type text ('image'|'video'),
segment text, theme text, text_fb text, text_ig text, text_tiktok text, text_youtube text,
hashtags text[], media_url text, thumbnail_url text,
status text ('draft'|'approved'|'rejected'|'published'|'error'),
networks text[], external_ids jsonb, error text, published_at timestamptz
```
Buckets : `visuels` (public), `videos` (public).

## 6. Structure du repo à créer
```
amo-social-bot/
  CLAUDE.md                 charte, règles légales, formats par réseau, ce fichier en résumé
  BRIEF.md                  ce document
  .claude/skills/           amo-social-strategist, amo-visual-designer (à importer depuis l'existant)
  content/calendar.json     thèmes par jour de semaine, rotation des segments
  templates/                post-feed.html, post-story.html, datacard.html
  render/
    render-image.js         HTML → PNG (Playwright)
    remotion/               composition vidéo « data card » et « démo outil »
    scenarios/              scripts Playwright d'enregistrement des apps (fiche-visite, estimateur DVF)
    assemble.sh             ffmpeg : hook + montage + sous-titres
  scripts/
    publish-to-supabase.js  upload asset + insert posts + mail « un post est prêt »
    read-listings.js        lit les pages vente/location du site → table listings
  netlify/
    functions/            approve, reject, publish-meta, publish-youtube, tiktok-inbox, refresh-tokens, inbox-upload
    site/                 tableau de bord privé (posts prêts, déposer, historique)
  brands/<slug>/          charte.md, calendar.json, templates/ par marque
  supabase/schema.sql
  .github/workflows/render-video.yml
```

## 7. Règles de contenu (à mettre dans CLAUDE.md)
- Ton : direct, concret, pédagogique. Tutoiement interdit envers les clients, vouvoiement.
- Interdits : promesse de rendement chiffré garanti, mentions « meilleur », données personnelles, photos de biens sans mandat.
- Toujours : mention AMO Invest, localisation Graveson / Bouches-du-Rhône quand pertinent, appel à l'action sobre.
- Rotation des segments sur la semaine ; jamais deux fois le même thème en 14 jours.
- Formats : FB 300-600 caractères ; IG 150-300 + 10-15 hashtags ; TikTok/YouTube titre ≤ 60 caractères + description ≤ 300.

## 8. Plan de travail par phases
1. **Comptes** (Olivier, guidé écran par écran, ≈ 2 h, aucune validation externe) : application Meta + jeton de page longue durée, projet Google Cloud + OAuth YouTube, application TikTok en mode inbox, projet Supabase dédié, site Netlify, comptes TikTok tech et basket, chaîne YouTube tech.
2. **Repo** : structure multi-marques (`brands/`), schéma v2, tableau de bord et fonctions Netlify, lecture du site AMO → `listings`. **Fait pour la partie image AMO (templates, rendu PNG).**
3. **Bout en bout** : premier vrai post AMO validé dans le tableau de bord et publié sur Facebook et Instagram.
4. **Routine AMO image** : création, run manuel, une semaine d'observation.
5. **Vidéo** : GitHub Actions, Remotion, voix ElevenLabs, présentateur Higgsfield, chaîne tech puis AMO 18h.
6. **Basket** : dépôt de match dans le tableau de bord, montage automatique, brouillon TikTok.
7. **Analyse et apprentissage** : routine `analytics`, table `metrics`, `learnings.md` par marque, onglet Performances, mail hebdomadaire. Puis passerelle Hektor avec la refonte du site, et publication par défaut après X semaines sans refus.

## 9. Première tâche pour Claude Code
Exécuter la phase 2 : initialiser le repo `amo-social-bot` avec la structure du §6, écrire `CLAUDE.md` à partir des §1, §3, §7, créer `templates/post-feed.html` (charte AMO : bleu marine, typographie sobre, logo en bas) et `render/render-image.js`. Produire un premier PNG de test à partir d'un texte d'exemple. Ne pas toucher aux réseaux sociaux à cette étape.

## 10. Décisions
Tranchées le 6 septembre 2026 : publication hybride gratuite ; tableau de bord Netlify sans n8n ; Higgsfield pour images, plans et présentateur virtuel ; lecture du site maintenant et passerelle Hektor avec la refonte ; vidéo longue + extraits pour la chaîne tech ; Olivier n'apparaît pas à l'écran.

Encore ouvertes :
- Adresse du site AMO Invest (à fournir).
- Nom de la chaîne tech.
- Compte TikTok basket : titulaire, âge, accord du club.
- Voix : ElevenLabs reste la voix du pipeline (narration, horodatages des sous-titres, clone si plan payant). Plan d'Olivier à confirmer.
- Passage au 100 % automatique après X semaines sans refus.
