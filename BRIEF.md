# BRIEF — amo-social-bot
Automatisation des posts réseaux sociaux d'AMO Invest avec Claude Code.
Ce fichier est la source de vérité du projet. Lis-le en entier avant toute action.

## 1. Contexte
- Entreprise : AMO Invest, agence immobilière (SARL, Graveson 13690). Gérant : Olivier Faure.
- Positionnement : conseil honnête et direct, clientèle investisseurs, slogan « vous c'est nous ». Pas de vente émotionnelle, pas de promesse de rendement.
- Segments d'audience : vendeurs, investisseurs, acheteurs, bailleurs.
- Réseaux : Facebook (page), Instagram (compte pro), TikTok, YouTube Shorts.
- Olivier est débutant en code : explique chaque commande, livre des fichiers copiables, une étape à la fois.

## 2. Objectif
- 11h03 (lun-sam) : générer et publier un post image (texte + visuel).
- 18h03 (lun-sam) : générer et publier une vidéo verticale 45-60 s.
- Chaque post est validé par Olivier avant publication (aperçu par mail, bouton « Valider »). Le 100 % automatique viendra plus tard.

## 3. Décisions d'architecture (validées)
| Brique | Choix | Rôle |
|---|---|---|
| Déclencheur | Routines Claude Code (cloud) | Lance le cerveau à 11h03 / 18h03, cron `3 11 * * 1-6` et `3 18 * * 1-6` |
| Cerveau | Ce repo + skills Claude | Choisit le sujet, rédige texte/script, fabrique les assets |
| Visuels image | Template HTML/CSS → PNG (Playwright) | 1080×1350 feed, 1080×1920 story. Image IA (Higgsfield) en fond optionnel |
| Vidéo | GitHub Actions (Playwright + Remotion + ffmpeg) | Rendu MP4 1080×1920, sous-titres, hook |
| Voix off | ElevenLabs (MCP connecté) | Optionnel, format « voix off + B-roll » |
| Stockage | Supabase | Table `posts` + buckets publics `visuels` et `videos` |
| Validation | n8n → mail Gmail avec aperçu | Lien Valider / Refuser |
| Publication | n8n (nœuds Facebook, Instagram, YouTube ; TikTok via API ou brouillon) | Claude ne publie jamais directement |
| Stats | Windsor.ai (MCP) | Lecture des performances, ajustement du calendrier (phase 2) |

Stack déjà en place chez Olivier : Netlify, Railway, Supabase, n8n, Canva, GitHub. Connecteurs MCP disponibles : Gmail, Google Calendar, Supabase, Netlify, Canva, ElevenLabs, Higgsfield, Windsor.ai, Stripe, Microsoft 365.

## 4. Flux d'un run
1. Routine démarre, lit `content/calendar.json` et les 30 derniers `posts` en base (éviter les redites).
2. Skill `amo-social-strategist` : choisit segment + angle, rédige texte par réseau (FB long, IG + hashtags, TikTok/YouTube titre + description).
3. Skill `amo-visual-designer` : remplit un template HTML → PNG (11h) ; ou écrit `scenario.json` + script vidéo et pousse sur `main` → GitHub Actions rend le MP4 (18h).
4. Upload de l'asset dans le bucket Supabase → URL publique.
5. Insert dans `posts` avec statut `draft`.
6. Appel webhook n8n `{post_id}` → n8n envoie l'aperçu à Olivier.
7. Olivier valide → n8n publie → met à jour `posts` (`published`, `external_ids`).

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
    publish-to-supabase.js  upload asset + insert posts + appel webhook n8n
  n8n/workflow-publication.json
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
1. **Accès** (Olivier) : app Meta + token longue durée, projet Google Cloud + OAuth YouTube, demande app TikTok (ou compte Metricool). À lancer dès maintenant, délais de validation externes.
2. **Repo** : créer la structure ci-dessus, CLAUDE.md, importer les skills, templates HTML, `render-image.js`.
3. **Supabase** : `schema.sql`, buckets, clé service dans les secrets.
4. **n8n** : workflow webhook → aperçu mail → attente validation → publication FB/IG → callback Supabase.
5. **Routine image** : créer la routine 11h03 avec connecteurs GitHub, Supabase, Gmail ; run manuel ; corriger ; laisser tourner une semaine.
6. **Vidéo** : workflow GitHub Actions, scénarios Playwright, composition Remotion, routine 18h03, YouTube puis TikTok.

## 9. Première tâche pour Claude Code
Exécuter la phase 2 : initialiser le repo `amo-social-bot` avec la structure du §6, écrire `CLAUDE.md` à partir des §1, §3, §7, créer `templates/post-feed.html` (charte AMO : bleu marine, typographie sobre, logo en bas) et `render/render-image.js`. Produire un premier PNG de test à partir d'un texte d'exemple. Ne pas toucher aux réseaux sociaux à cette étape.

## 10. Décisions ouvertes (à trancher avec Olivier au fil de l'eau)
- Image IA en fond des visuels : oui/non, et quel générateur.
- TikTok : API directe (audit) ou brouillon validé sur téléphone, ou outil tiers.
- Type de vidéo prioritaire : démo d'outil (recommandé), data card, ou voix off + B-roll.
- Passage au 100 % automatique après X semaines sans refus.
