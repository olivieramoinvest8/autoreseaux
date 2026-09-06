# Architecture v2 — un robot, trois marques

Proposition d'architecture pour rendre la publication autonome sur trois marques, avec une seule action humaine : ouvrir un mail et cliquer « Valider ». Ce document sert à choisir. Une fois les décisions prises (§8), `BRIEF.md` et `CLAUDE.md` seront mis à jour.

## 1. Les trois marques

| Marque | Réseaux | Contenu | Matière première | Cadence proposée |
|---|---|---|---|---|
| **AMO Invest** | Facebook (page) + Instagram (pro) | Pédagogie immobilière, 4 segments | Calendrier, actualité, textes Claude, templates HTML | Image 11h03 lun-sam, vidéo 18h03 (phase suivante) |
| **Chaîne tech / IA** (nom à choisir) | YouTube (Shorts) + TikTok | L'IA et les applis que vous créez (AMO, basket, perso) | Enregistrements d'écran de vos applis, voix off ElevenLabs | 3 vidéos / semaine (lun, mer, ven 18h) |
| **Basket — votre fils** | TikTok (Instagram ou YouTube plus tard) | Résumés de match, actions, temps forts | Clips filmés au téléphone + score saisis par vous | Après chaque match (traitement quotidien à 20h) |

Chaque marque a sa charte, son calendrier, ses templates et son adresse de validation. Le moteur est le même pour les trois.

## 2. Le flux, de bout en bout

```
Sources (calendrier, 30 derniers posts, actualité, clips, applis)
   │
   ▼
Routine Claude Code (une par marque et par créneau)
   │  lit la charte de la marque, choisit le sujet, écrit les textes
   ▼
Fabrique d'assets
   │  image : template HTML → PNG (Playwright)      [déjà fait]
   │  vidéo : GitHub Actions (Playwright + Remotion + ffmpeg + ElevenLabs)
   ▼
Supabase : media dans un bucket public, ligne `posts` en statut draft
   │
   ▼
Mail d'aperçu (Gmail) : visuel + textes par réseau + boutons Valider / Refuser
   │
   ▼  clic « Valider »
Fonction Netlify : passe le post en approved, appelle l'API de l'outil de publication
   │
   ▼
Outil de publication (Postiz ou équivalent) → Facebook, Instagram, YouTube, TikTok
   │
   ▼
Retour : `posts` passe en published avec les identifiants ; stats lues via Windsor.ai
```

Trois principes :
- **Claude ne publie jamais directement.** Il prépare, et c'est la fonction Netlify, après votre clic, qui déclenche l'outil de publication.
- **Un seul point de validation** : le mail. Pas d'interface à ouvrir, pas d'application à installer.
- **Un seul outil de publication pour tous les réseaux et toutes les marques.** C'est lui qui porte les connexions aux plateformes.

## 3. Publication : toutes les options

Le nœud du problème, ce sont les plateformes elles-mêmes :
- **TikTok** : sans audit de votre propre application, l'API ne publie qu'en privé (visible par vous seul) et pour 5 utilisateurs par jour. L'audit prend du temps et peut être refusé.
- **Meta (Facebook + Instagram)** : une application en mode développement peut publier sur les pages dont vous êtes administrateur sans validation Meta, mais il faut créer l'application, lier Instagram pro à la page, et renouveler les jetons.
- **YouTube** : il faut un projet Google Cloud et un écran OAuth ; utilisable pour votre propre chaîne sans vérification, avec un avertissement.

Les outils de programmation (« schedulers ») ont déjà passé ces audits. Vous connectez vos comptes en cliquant, et le robot n'a qu'une seule API à parler.

| Option | Réseaux couverts | Prix pour 5 comptes | API incluse | Avantages | Limites |
|---|---|---|---|---|---|
| **Postiz (cloud)** | FB, IG, YouTube, TikTok et 10+ autres | Standard 29 $/mois (5 canaux, 400 posts) ; Team 39 $/mois (10 canaux) | Oui, à tous les paliers | Open source (vous pouvez l'héberger vous-même si l'entreprise disparaît), mûr, prévisualisation, webhooks | Interface en anglais |
| **Zernio (ex-Late)** | Idem, 15 plateformes | 2 comptes gratuits puis 6 $/compte : ≈ 18 $/mois | Oui, pensé pour l'API | Le moins cher, API très simple | Société jeune, vient de changer de nom |
| **Publer** | Idem | Business : 10 $ + 7 $/compte supplémentaire : ≈ 38 $/mois | Oui (plan Business) | Interface soignée, circuit d'approbation intégré | Prix par compte, API moins documentée |
| **Metricool** | Idem + statistiques | API réservée au plan Advanced : 54 $/mois et plus | Oui, mais cher | Statistiques incluses, marques séparées | Le plus cher pour ce besoin |
| **APIs directes** (Meta, Google, TikTok) | FB, IG, YouTube ; TikTok privé seulement | 0 € | — | Gratuit, contrôle total | Trois applications développeur à créer, audit TikTok, jetons à renouveler, code à maintenir |
| **Brouillon TikTok** (envoi dans l'appli) | TikTok seulement | 0 € | — | Autorisé sans audit | Vous publiez à la main depuis le téléphone |

**Recommandation : Postiz cloud, plan Standard.** Zernio si le budget prime ; les deux ont un essai gratuit, on peut tester les deux la même semaine. Les APIs directes restent une option de repli pour Facebook/Instagram uniquement.

## 4. Orchestration et validation : toutes les options

| Option | Rôle | Coût | Avantages | Limites |
|---|---|---|---|---|
| **Fonctions Netlify** (code dans ce dépôt) | Reçoit le clic Valider/Refuser, met à jour Supabase, appelle l'API de publication, gère les erreurs | 0 € (offre gratuite Netlify) | Aucun compte à créer, tout est versionné ici, Claude maintient le code | Pas d'interface visuelle ; les erreurs se lisent dans les logs Netlify ou dans le mail |
| **n8n cloud** | Même chose, en flux visuel | 20 €/mois (annuel) ou 24 €/mois, 2 500 exécutions | Vous voyez chaque exécution, nombreux connecteurs | Compte et abonnement de plus ; son atout (nœuds Facebook/YouTube natifs) devient inutile avec un scheduler |
| **n8n auto-hébergé** (Railway) | Idem | ≈ 5 à 10 €/mois | Moins cher que le cloud | Mises à jour et sauvegardes à gérer |
| **Make** | Idem, visuel | ≈ 9 à 16 €/mois | Simple | Facturation à l'opération, moins adapté au code |
| **Supabase Edge Functions** | Comme Netlify | 0 € | Déjà chez vous | Environnement Deno, moins courant |

**Recommandation : fonctions Netlify, sans n8n.** C'est un changement par rapport au brief initial, justifié par le §3 : une fois les plateformes portées par Postiz, n8n n'apporte plus qu'une interface visuelle. Si vous voulez cette console visuelle plus tard, on pourra la brancher sans rien casser : la fonction Netlify et n8n parlent aux mêmes tables et à la même API.

Le mail d'aperçu est envoyé par la routine elle-même via le connecteur Gmail déjà en place. Les boutons sont des liens signés vers la fonction Netlify (un jeton par post, à usage unique, expirant à 48 h).

## 5. Fabrique d'assets : toutes les options

### Images (AMO Invest surtout)
| Option | Usage | Coût | Verdict |
|---|---|---|---|
| **Templates HTML → PNG** (fait) | Base de tous les visuels : sobre, lisible, conforme | 0 € | Socle |
| **Higgsfield** (MCP déjà connecté) | Image de fond IA optionnelle (Provence, intérieurs génériques), jamais un bien réel | Crédits Higgsfield | À activer en option, avec parcimonie |
| **Canva** (MCP déjà connecté) | Visuels ponctuels retouchés à la main | Votre abonnement | Pour les cas manuels, pas pour la routine |
| Ideogram, Flux (fal.ai, Replicate) | Générateurs avec texte propre dans l'image | ≈ 0,03 $/image | Inutile tant que les templates suffisent |

### Vidéos
| Brique | Outil | Coût |
|---|---|---|
| Enregistrement d'écran des applis (chaîne tech) | Playwright, scripté par Claude | 0 € |
| Montage, habillage, sous-titres | Remotion + ffmpeg sur GitHub Actions | 0 € (2 000 min/mois inclus, il en faut ≈ 150) |
| Voix off | ElevenLabs (MCP déjà connecté) | Votre abonnement |
| Sous-titres | Générés depuis le script écrit par Claude, calés avec les horodatages ElevenLabs : pas de transcription à payer | 0 € |
| Plans d'illustration IA | Higgsfield vidéo, en option | Crédits |
| Clips de match (votre fils) | Vous déposez les clips et le score sur une petite page « Déposer un match » (Netlify → bucket Supabase) ; le robot assemble : carte score, clips, titre, générique | 0 € |

Points d'attention vidéo :
- Une vidéo publiée sur TikTok par API ne peut pas utiliser la bibliothèque musicale TikTok. Soit musique libre de droits ajoutée au montage, soit ajout du son dans l'appli après publication.
- Pour les clips de basket : d'autres mineurs apparaissent à l'image. Prévoir l'accord du club ou des parents, et ne jamais afficher de nom de famille.
- Compte TikTok d'un mineur : 13 ans minimum pour publier ; en dessous, le compte est au nom d'un parent.

## 6. Déclencheurs : Routines Claude Code

Une routine par marque et par créneau, chacune avec ses connecteurs (GitHub, Supabase, Gmail, ElevenLabs, Higgsfield, recherche web) :

| Routine | Cron (UTC, heure d'hiver) | Ce qu'elle fait |
|---|---|---|
| amo-image | `3 10 * * 1-6` | Post image AMO, mail de validation |
| amo-video | `3 17 * * 1-6` | Scénario + rendu vidéo AMO (phase 5) |
| tech-video | `3 17 * * 1,3,5` | Vidéo chaîne tech |
| basket-match | `0 19 * * *` | Regarde s'il y a un nouveau match déposé ; s'il y en a un, monte et propose |

Une routine qui échoue n'empêche pas les autres. Chaque routine relit les 30 derniers posts de sa marque pour éviter les redites.

## 7. Données et dépôt

Supabase, projet dédié « social-bot » (gratuit) :
- `brands` : id, slug, nom, réseaux, e-mail de validation, identifiants des canaux chez Postiz.
- `posts` : comme aujourd'hui, plus `brand_id`, `approval_token`, `scheduler_post_id`.
- `matches` (basket) : date, adversaire, score, clips déposés, statut.
- Buckets : `visuels`, `videos` (publics), `raw` (privé, clips bruts).

Dépôt :
```
brands/
  amo-invest/     charte.md, calendar.json, templates/, assets/
  tech/           charte.md, calendar.json, templates/
  basket/         charte.md, templates/
render/           commun : render-image.js, remotion/, assemble.sh
netlify/
  functions/      approve.js, reject.js, publish.js, upload-match.js
  site/           page « Déposer un match »
scripts/          publish-to-supabase.js, create-scheduler-post.js
supabase/         schema.sql (v2)
```

## 8. Décisions à prendre

| # | Décision | Recommandation |
|---|---|---|
| 1 | Outil de publication | **Postiz Standard** (29 $/mois). Alternative : Zernio (≈ 18 $). Tester les deux en essai gratuit. |
| 2 | Orchestration | **Fonctions Netlify**, pas de n8n pour l'instant. |
| 3 | Nom et cadence de la chaîne tech | À choisir. Proposition : 3 Shorts par semaine, 45 à 60 s, un outil ou une astuce par vidéo. |
| 4 | Compte TikTok basket | Qui en est titulaire, âge de votre fils, règle sur la musique, accord du club. |
| 5 | Images IA en fond des visuels AMO | **Non au départ**, on active Higgsfield après deux semaines de posts sobres. |
| 6 | Projet Supabase | **Nouveau projet dédié**, gratuit, séparé de vos applications. |
| 7 | Adresse de validation | Une seule adresse Gmail pour les trois marques, avec un libellé par marque. |

## 9. Comptes à créer et à connecter

Déjà en place : GitHub, Supabase, Netlify, Railway, Canva, ElevenLabs, Higgsfield, Windsor.ai, Gmail.

À faire par vous, dans cet ordre, sans délai de validation externe :
1. **Instagram AMO Invest** : vérifier que le compte est « professionnel » et lié à la page Facebook.
2. **Chaîne YouTube tech** : créer une chaîne de marque sous votre compte Google.
3. **Compte TikTok tech** et **compte TikTok basket**.
4. **Postiz** : créer le compte (essai), connecter les 5 canaux, copier la clé API dans les secrets (jamais dans le dépôt).
5. **Supabase** : créer le projet « social-bot », exécuter `supabase/schema.sql`, copier l'URL et la clé service dans les secrets.
6. **Netlify** : créer un site depuis ce dépôt, renseigner les variables d'environnement.
7. **Routines Claude Code** : les créer avec les connecteurs listés au §6 (je vous guide pas à pas).

Plus besoin de : application Meta, projet Google Cloud, application TikTok, compte n8n.

## 10. Coût mensuel

| Poste | Montant |
|---|---|
| Postiz Standard | 29 $ (≈ 27 €) |
| Netlify, Supabase, GitHub Actions | 0 € (offres gratuites suffisantes) |
| Routines Claude Code | inclus dans votre abonnement Claude |
| ElevenLabs, Higgsfield, Canva | vos abonnements existants |
| **Total nouveau** | **≈ 27 €/mois** |

## 11. Phases

| Phase | Contenu | Qui | Durée |
|---|---|---|---|
| 0 | Décisions du §8 | Olivier | 1 échange |
| 1 | Comptes du §9 | Olivier, guidé | 1 à 2 h |
| 2 | Dépôt multi-marques, schéma v2, site Netlify avec fonctions | Claude | 1 session |
| 3 | Validation par mail de bout en bout, premier vrai post AMO | Claude + Olivier | 1 session |
| 4 | Routine AMO image en production, une semaine d'observation | Routine | 1 semaine |
| 5 | Vidéo : pipeline GitHub Actions, chaîne tech, AMO 18h | Claude | 2 à 3 sessions |
| 6 | Basket : page de dépôt, montage automatique | Claude | 1 à 2 sessions |
| 7 | Statistiques Windsor.ai, publication par défaut après X semaines sans refus | Claude | plus tard |

## Sources vérifiées le 6 septembre 2026
- Postiz : https://postiz.com/ et https://postplanify.com/postiz-pricing
- Zernio (ex-Late) : https://getlate.dev/pricing
- Publer : https://publer.com/plans et https://blog.publer.com/publer-api-for-marketers-and-developers/
- Metricool : https://tygartmedia.com/metricool-api-guide/
- TikTok Content Posting API : https://developers.tiktok.com/docs/en/content-sharing-guidelines
- n8n : https://n8n.io/pricing
