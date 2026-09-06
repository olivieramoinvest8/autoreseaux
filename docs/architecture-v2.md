# Architecture v2.1 — un robot, trois marques, 0 € de plus

Architecture retenue le 6 septembre 2026 après discussion avec Olivier. Trois décisions ont modifié la v2 : publication **hybride gratuite** (APIs Meta et YouTube, brouillon TikTok) au lieu d'un abonnement Postiz ; **Hektor et le site** comme source des annonces AMO ; **Higgsfield** pour les images, les plans d'illustration et un présentateur virtuel. `BRIEF.md` et `CLAUDE.md` reflètent cette version.

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
Mail (Gmail) : « un post est prêt » + lien vers le tableau de bord
   │
   ▼
Tableau de bord privé (site Netlify, utilisable au téléphone) : aperçu, textes par réseau,
   │  boutons Valider / Refuser / Modifier, Copier le texte, Télécharger
   ▼  clic « Valider »
Fonction Netlify : passe le post en approved puis publie
   │  Facebook + Instagram : API Meta (votre application, mode développement)
   │  YouTube : API YouTube Data (votre projet Google)
   │  TikTok : envoi du brouillon dans votre appli TikTok, vous ajoutez le son et publiez
   ▼
Retour : `posts` passe en published avec les identifiants ; stats lues via Windsor.ai
```

Trois principes :
- **Claude ne publie jamais directement.** Il prépare, et c'est la fonction Netlify, après votre clic, qui déclenche l'outil de publication.
- **Un seul point de validation** : le mail. Pas d'interface à ouvrir, pas d'application à installer.
- **Zéro abonnement de plus.** Les APIs officielles de Meta et de Google sont gratuites pour vos propres comptes. TikTok reste le seul geste manuel, et c'est le réseau où c'est le mieux ainsi (choix de la musique dans l'appli).

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

**Décision : hybride gratuit.** Facebook et Instagram par l'API Meta, YouTube par l'API YouTube Data, TikTok en brouillon envoyé dans l'appli. Ce qu'il faut savoir :
- **Meta** : une application en mode développement peut publier sur les pages et comptes dont vous êtes administrateur, sans passer par la validation Meta. Il faut un compte Instagram professionnel lié à la page Facebook. Le jeton longue durée se renouvelle tous les 60 jours ; la fonction Netlify s'en charge et vous prévient par mail si le renouvellement échoue.
- **YouTube** : un projet Google Cloud avec écran de consentement OAuth. Pour votre propre chaîne, il fonctionne sans vérification Google, avec un avertissement à la première connexion. Quota gratuit : 6 mises en ligne par jour environ, largement suffisant.
- **TikTok** : sans audit, l'API ne peut publier qu'en privé. En revanche, elle peut déposer la vidéo dans votre boîte de brouillons TikTok (« inbox upload »). Vous ouvrez l'appli, ajoutez un son, publiez : 30 secondes par vidéo. Cela vaut pour les deux comptes TikTok (tech et basket).
- Postiz ou Zernio restent une option si, un jour, le geste TikTok devient pesant.

## 4. Orchestration et validation : toutes les options

| Option | Rôle | Coût | Avantages | Limites |
|---|---|---|---|---|
| **Fonctions Netlify** (code dans ce dépôt) | Reçoit le clic Valider/Refuser, met à jour Supabase, appelle l'API de publication, gère les erreurs | 0 € (offre gratuite Netlify) | Aucun compte à créer, tout est versionné ici, Claude maintient le code | Pas d'interface visuelle ; les erreurs se lisent dans les logs Netlify ou dans le mail |
| **n8n cloud** | Même chose, en flux visuel | 20 €/mois (annuel) ou 24 €/mois, 2 500 exécutions | Vous voyez chaque exécution, nombreux connecteurs | Compte et abonnement de plus ; son atout (nœuds Facebook/YouTube natifs) devient inutile avec un scheduler |
| **n8n auto-hébergé** (Railway) | Idem | ≈ 5 à 10 €/mois | Moins cher que le cloud | Mises à jour et sauvegardes à gérer |
| **Make** | Idem, visuel | ≈ 9 à 16 €/mois | Simple | Facturation à l'opération, moins adapté au code |
| **Supabase Edge Functions** | Comme Netlify | 0 € | Déjà chez vous | Environnement Deno, moins courant |

**Décision : fonctions Netlify et tableau de bord privé, sans n8n.**

Le tableau de bord est un petit site Netlify protégé par mot de passe, pensé pour le téléphone :
- **Posts prêts** : aperçu du visuel ou de la vidéo, textes par réseau, boutons Valider / Refuser / Modifier le texte, Copier le texte, Télécharger.
- **Déposer** : une info d'agence (signature notaire, nouveau mandat, événement) avec photo et deux phrases ; un match de basket (clips, adversaire, score) ; un enregistrement (voix, plans).
- **Historique** : ce qui est parti, où, quand, et les erreurs éventuelles.

Le mail d'aperçu part de la routine via le connecteur Gmail déjà en place et renvoie vers le tableau de bord. Les liens sont signés : un jeton par post, expirant à 48 h.

## 5. Fabrique d'assets : toutes les options

### Images (AMO Invest surtout)
| Option | Usage | Coût | Verdict |
|---|---|---|---|
| **Templates HTML → PNG** (fait) | Base de tous les visuels : sobre, lisible, conforme | 0 € | Socle |
| **Higgsfield** (compte pris, MCP connecté) | Image de fond IA (Provence, intérieurs génériques), jamais un bien réel. Photos réelles des biens sous mandat via Hektor | Crédits Higgsfield | Activé dès la phase 3, avec parcimonie sur AMO |
| **Canva** (MCP déjà connecté) | Visuels ponctuels retouchés à la main | Votre abonnement | Pour les cas manuels, pas pour la routine |
| Ideogram, Flux (fal.ai, Replicate) | Générateurs avec texte propre dans l'image | ≈ 0,03 $/image | Inutile tant que les templates suffisent |

### Vidéos
| Brique | Outil | Coût |
|---|---|---|
| Enregistrement d'écran des applis (chaîne tech) | Playwright, scripté par Claude | 0 € |
| Montage, habillage, sous-titres | Remotion + ffmpeg sur GitHub Actions | 0 € (2 000 min/mois inclus, il en faut ≈ 150) |
| Voix off | ElevenLabs (MCP déjà connecté) | Votre abonnement |
| Sous-titres | Générés depuis le script écrit par Claude, calés avec les horodatages ElevenLabs : pas de transcription à payer | 0 € |
| Plans d'illustration IA | Higgsfield vidéo | Crédits |
| Présentateur virtuel (chaîne tech) | Higgsfield Speak + Soul ID : un personnage créé une fois, cohérent d'une vidéo à l'autre, qui dit le texte en intro et en conclusion | Crédits |
| Clips de match (votre fils) | Vous déposez les clips et le score sur une petite page « Déposer un match » (Netlify → bucket Supabase) ; le robot assemble : carte score, clips, titre, générique | 0 € |

Points d'attention vidéo :
- Une vidéo publiée sur TikTok par API ne peut pas utiliser la bibliothèque musicale TikTok. Soit musique libre de droits ajoutée au montage, soit ajout du son dans l'appli après publication.
- Pour les clips de basket : d'autres mineurs apparaissent à l'image. Prévoir l'accord du club ou des parents, et ne jamais afficher de nom de famille.
- Compte TikTok d'un mineur : 13 ans minimum pour publier ; en dessous, le compte est au nom d'un parent.

## 5 bis. Source des annonces AMO Invest : Hektor et le site

Hektor (La Boîte Immo) exporte les annonces par une **passerelle** : un flux XML, CSV ou Poliris déposé plusieurs fois par jour sur un serveur FTP de votre choix, que vous configurez vous-même dans Hektor. Le flux CSV est le plus complet (255 critères : prix, honoraires, DPE, GES, surfaces, photos).

| Option | Comment | Quand |
|---|---|---|
| **Lecture du site** (pages vente et location) | La routine lit les deux pages chaque matin et compare avec la veille dans la table `listings` : nouveau bien, changement de prix, sous offre, vendu | **Maintenant.** Aucune infrastructure, fonctionne avec le site actuel |
| **Passerelle Hektor → FTP → Supabase** | Un petit serveur FTP sur Railway reçoit le flux, un script le charge dans `listings`. Données complètes et photos en haute définition | **Avec la refonte du site**, qui aura besoin du même flux |
| Dépôt manuel dans le tableau de bord | Vous déposez le bien à la main | Solution de secours |

Contrainte à connaître : la passerelle Hektor n'accepte que le FTP simple, sans chiffrement. Les annonces étant publiques, le risque est faible, et le serveur ne contiendra rien d'autre.

Chaque post d'annonce contient le lien vers la fiche du bien sur votre site, ce qui apporte du trafic. Priorité de la routine AMO chaque matin :
1. Une info déposée dans le tableau de bord (signature, mandat, événement).
2. Un changement détecté dans `listings` : nouveau bien, sous offre, vendu, baisse de prix. Template « annonce » avec prix, honoraires, DPE et GES obligatoires, photos du bien sous mandat.
3. Sinon, création : ancien bien et son histoire (« vendu en 23 jours »), loi ou fiscalité vérifiée, chiffre local sourcé, vie de l'agence.

## 5 ter. Chaîne tech : format et présentateur

Format : **une vidéo longue de 4 à 6 minutes** (horizontale, YouTube), dont sont tirés **3 à 5 extraits de 30 à 60 secondes** complets en eux-mêmes (verticaux, TikTok et YouTube Shorts) avec « la vidéo complète est sur YouTube » à la fin. La longue est aussi publiée telle quelle sur TikTok. Pas de « partie 1/10 » : TikTok montre chaque vidéo à des gens qui n'ont pas vu la précédente. Sous-titres incrustés partout, générés depuis le script.

Présentateur, sachant qu'Olivier ne veut pas se voir à l'écran :

| Option | Pour | Contre |
|---|---|---|
| **Présentateur virtuel Higgsfield** (personnage créé, Soul ID, Speak) | Aucune caméra, cohérent, sur une chaîne IA c'est un sujet en soi, déjà dans l'abonnement | Coût en crédits si on l'utilise sur toute la vidéo ; à réserver à l'intro et à la conclusion |
| Avatar à votre image (Higgsfield ou HeyGen) | Plus personnel | Vous vous voyez quand même ; demande une captation |
| Sans visage (écran + voix + sous-titres animés) | Le plus simple, très courant sur les chaînes tech | Moins incarné |

**Décision : sans visage par défaut, présentateur virtuel en intro et conclusion (5 à 10 s), l'écran de vos applis au centre.** Voix : clone ElevenLabs de votre voix si votre plan le permet, sinon une voix ElevenLabs choisie ensemble. YouTube et TikTok demandent de signaler le contenu synthétique : case à cocher à la publication et ligne dans la description, intégrées aux textes.

## 6. Déclencheurs : Routines Claude Code

Une routine par marque et par créneau, chacune avec ses connecteurs (GitHub, Supabase, Gmail, ElevenLabs, Higgsfield, recherche web) :

| Routine | Cron (UTC, heure d'hiver) | Ce qu'elle fait |
|---|---|---|
| amo-image | `3 10 * * 1-6` | Post image AMO, mail de validation |
| amo-video | `3 17 * * 1-6` | Scénario + rendu vidéo AMO (phase 5) |
| tech-video | `3 17 * * 1,3,5` | Vidéo chaîne tech |
| basket-match | `0 19 * * *` | Regarde s'il y a un nouveau match déposé ; s'il y en a un, monte et propose |
| amo-listings | intégré à amo-image | Lit les pages vente et location du site, met à jour `listings`, signale les changements |

Une routine qui échoue n'empêche pas les autres. Chaque routine relit les 30 derniers posts de sa marque pour éviter les redites.

## 7. Données et dépôt

Supabase, projet dédié « social-bot » (gratuit) :
- `brands` : id, slug, nom, réseaux, e-mail de validation, identifiants des pages et chaînes.
- `posts` : comme aujourd'hui, plus `brand_id`, `approval_token`, `listing_id`.
- `listings` (AMO) : référence Hektor ou URL, type (vente/location), prix, honoraires, DPE, GES, surface, ville, photos, statut (disponible, sous offre, vendu, loué), empreinte pour détecter les changements, dates.
- `inbox` : ce que vous déposez (info d'agence, match, enregistrement), avec fichiers et statut.
- `matches` (basket) : date, adversaire, score, clips déposés, statut.
- `tokens` : jetons Meta et Google chiffrés, dates d'expiration.
- Buckets : `visuels`, `videos` (publics), `raw` (privé : clips bruts, voix, dépôts).

Dépôt :
```
brands/
  amo-invest/     charte.md, calendar.json, templates/, assets/
  tech/           charte.md, calendar.json, templates/
  basket/         charte.md, templates/
render/           commun : render-image.js, remotion/, assemble.sh
netlify/
  functions/      approve.js, reject.js, publish-meta.js, publish-youtube.js, tiktok-inbox.js, refresh-tokens.js, inbox-upload.js
  site/           tableau de bord : posts prêts, déposer, historique
scripts/          publish-to-supabase.js, read-listings.js
supabase/         schema.sql (v2)
```

## 8. Décisions à prendre

| # | Décision | Recommandation |
|---|---|---|
| 1 | Publication | **Décidé : hybride gratuit.** API Meta (FB + IG), API YouTube, brouillon TikTok dans l'appli. |
| 2 | Orchestration | **Décidé : fonctions Netlify + tableau de bord privé**, pas de n8n. |
| 3 | Chaîne tech | **Décidé : longue de 4 à 6 min + 3 à 5 extraits.** Nom de chaîne encore à choisir. |
| 4 | Compte TikTok basket | À préciser : titulaire, âge de votre fils, accord du club. Musique ajoutée dans l'appli. |
| 5 | Images IA | **Décidé : Higgsfield**, fonds de visuels et plans d'illustration, avec parcimonie sur AMO. |
| 6 | Projet Supabase | Nouveau projet dédié, gratuit, séparé de vos applications. |
| 7 | Adresse de validation | Une seule adresse Gmail pour les trois marques, avec un libellé par marque. |
| 8 | Source des annonces | **Décidé : lecture du site maintenant, passerelle Hektor avec la refonte du site.** Adresse du site à me donner. |
| 9 | Présentateur | **Décidé : présentateur virtuel Higgsfield en intro et conclusion, écran au centre.** Voix : à confirmer selon votre plan ElevenLabs. |

## 9. Comptes à créer et à connecter

Déjà en place : GitHub, Supabase, Netlify, Railway, Canva, ElevenLabs, Higgsfield, Windsor.ai, Gmail.

À faire par vous, dans cet ordre, sans délai de validation externe :
1. **Instagram AMO Invest** : vérifier que le compte est « professionnel » et lié à la page Facebook.
2. **Chaîne YouTube tech** : créer une chaîne de marque sous votre compte Google.
3. **Compte TikTok tech** et **compte TikTok basket**.
4. **Application Meta** (developers.facebook.com) : créer une application « Business », ajouter les produits Facebook Login et Instagram Graph API, générer un jeton de page longue durée. Je vous guide écran par écran ; comptez 30 minutes. Aucune validation Meta à attendre.
5. **Projet Google Cloud** : activer l'API YouTube Data v3, créer un écran de consentement et un identifiant OAuth, autoriser votre chaîne une fois. 20 minutes.
6. **Application TikTok** (developers.tiktok.com) : créer l'application, activer le produit Content Posting API en mode « inbox ». Utilisable sans audit pour vos propres comptes.
7. **Supabase** : créer le projet « social-bot », exécuter `supabase/schema.sql`, copier l'URL et la clé service dans les secrets.
8. **Netlify** : créer un site depuis ce dépôt (tableau de bord + fonctions), renseigner les variables d'environnement.
9. **Routines Claude Code** : les créer avec les connecteurs listés au §6 (je vous guide pas à pas).
10. **Enregistrements** : 30 minutes de lecture pour le clone de voix (texte fourni), si votre plan ElevenLabs le permet.

Plus besoin de : Postiz ou tout abonnement de publication, compte n8n.

## 10. Coût mensuel

| Poste | Montant |
|---|---|
| APIs Meta, YouTube, TikTok | 0 € |
| Netlify, Supabase, GitHub Actions | 0 € (offres gratuites suffisantes) |
| Serveur FTP Railway pour la passerelle Hektor (avec la refonte du site) | ≈ 5 €/mois, plus tard |
| Routines Claude Code | inclus dans votre abonnement Claude |
| ElevenLabs, Higgsfield, Canva | vos abonnements existants |
| **Total nouveau aujourd'hui** | **0 €/mois** |

## 11. Phases

| Phase | Contenu | Qui | Durée |
|---|---|---|---|
| 0 | Décisions du §8 | Olivier | 1 échange |
| 1 | Comptes du §9 (Meta, Google, TikTok, Supabase, Netlify) | Olivier, guidé | 2 h |
| 2 | Dépôt multi-marques, schéma v2, tableau de bord et fonctions Netlify, lecture du site AMO | Claude | 2 sessions |
| 3 | Validation de bout en bout : premier vrai post AMO sur Facebook et Instagram | Claude + Olivier | 1 session |
| 4 | Routine AMO image en production, une semaine d'observation | Routine | 1 semaine |
| 5 | Vidéo : pipeline GitHub Actions, chaîne tech, AMO 18h | Claude | 2 à 3 sessions |
| 6 | Basket : page de dépôt, montage automatique | Claude | 1 à 2 sessions |
| 7 | Statistiques Windsor.ai, publication par défaut après X semaines sans refus | Claude | plus tard |

## Sources vérifiées le 6 septembre 2026
- Hektor, passerelles et flux : https://www.immowp.fr/nos-passerelles/passerelle-immobiliere-hektor-la-boite-immo-wordpress et https://wpline.fr/produit/plugin-hektor-wordpress/
- Higgsfield Speak et Soul ID : https://higgsfield.cc/higgsfield-speak et https://higgsfield.ai/blog/make-ai-lipsync-videos
- Postiz : https://postiz.com/ et https://postplanify.com/postiz-pricing
- Zernio (ex-Late) : https://getlate.dev/pricing
- Publer : https://publer.com/plans et https://blog.publer.com/publer-api-for-marketers-and-developers/
- Metricool : https://tygartmedia.com/metricool-api-guide/
- TikTok Content Posting API : https://developers.tiktok.com/docs/en/content-sharing-guidelines
- n8n : https://n8n.io/pricing

## 12. Compléments du 6 septembre (soir)

### 12.1 Site AMO Invest : amoinvest.fr
Structure observée : listes paginées `amoinvest.fr/location/1`, `/location/2`… (et `/vente/1`…), fiches `amoinvest.fr/location/<ville>/<type>/<id>-<titre>`. Le lecteur parcourt les listes, suit chaque fiche pour prix, honoraires, DPE, GES, surface, ville, photos, et calcule une empreinte par bien pour détecter les changements. Pages à lire : vente et location. Le lecteur ne tourne pas dans la routine Claude (dont le réseau sortant est restreint) mais dans une **fonction Netlify planifiée** chaque matin à 9h, qui écrit dans `listings`. La routine ne lit que Supabase. Cela rend la lecture indépendante des réglages réseau des routines et permet de la tester à la main depuis le tableau de bord (« Relire le site maintenant »).

### 12.2 Voix : ElevenLabs reste utile avec Higgsfield
Higgsfield intègre des voix ElevenLabs et accepte un fichier audio pour la synchronisation labiale. Mais trois choses restent du côté ElevenLabs :
1. **La narration automatisée** : les 4 à 6 minutes de voix sur l'écran des applis sont produites par le connecteur ElevenLabs dans le pipeline, sans intervention humaine.
2. **Les horodatages** : ElevenLabs renvoie le timing de chaque mot, ce qui fabrique les sous-titres sans transcription.
3. **Le clone de votre voix**, si votre plan le permet.
Le flux : ElevenLabs produit l'audio → Higgsfield fait parler le présentateur virtuel sur cet audio (intro, conclusion) → Remotion assemble. Une seule voix partout. Besoin mensuel : ≈ 60 minutes d'audio (3 vidéos de 5 min par semaine, plus les extraits). L'offre gratuite ElevenLabs (10 min/mois) ne suffit pas ; un plan payant est nécessaire, ou, à vérifier en phase 5, la synthèse vocale de Higgsfield si son API l'expose.

### 12.3 Comptes : ce qu'Olivier fournit
Règle : **jamais de mot de passe dans une conversation.** Ce qui circule, ce sont des clés d'API et des jetons, déposés dans les variables d'environnement Netlify et dans les connecteurs des routines. Je vous indique où trouver chaque valeur au moment de la configuration.

| # | Compte | Statut | Ce que vous faites | Ce que vous me donnez |
|---|---|---|---|---|
| 1 | Page Facebook AMO Invest | Existe | Vérifier que vous êtes administrateur | Nom de la page |
| 2 | Instagram AMO Invest | Existe | Passer en compte professionnel, lier à la page Facebook | Identifiant Instagram |
| 3 | Application Meta (developers.facebook.com) | À créer | Créer l'app, ajouter Facebook Login et Instagram Graph API, générer un jeton de page longue durée (guidé, 30 min) | App ID, App Secret, jeton de page : dans les secrets |
| 4 | Chaîne YouTube tech | À créer | Créer une chaîne de marque sous votre compte Google | Nom de la chaîne |
| 5 | Projet Google Cloud | À créer | Activer YouTube Data API v3, écran de consentement, identifiant OAuth, autoriser la chaîne (guidé, 20 min) | Client ID, Client Secret, refresh token : dans les secrets |
| 6 | Compte TikTok tech | À créer | Créer le compte, e-mail dédié | Identifiant TikTok |
| 7 | Compte TikTok basket | À créer, à votre nom (votre fils a 14 ans et n'a pas TikTok) | Créer le compte, régler la confidentialité et les commentaires | Identifiant TikTok |
| 8 | Application TikTok (developers.tiktok.com) | À créer | Créer l'app, activer Content Posting API, connecter les deux comptes | Client Key, Client Secret, jetons : dans les secrets |
| 9 | Supabase | Existe | Créer le projet « social-bot », exécuter `supabase/schema.sql` | URL du projet, clé service : dans les secrets |
| 10 | Netlify | Existe | Créer le site depuis ce dépôt | Rien : je déploie via le connecteur |
| 11 | GitHub | Existe | Rien | Rien : déjà connecté |
| 12 | Gmail | Existe, connecté | Choisir l'adresse qui reçoit « un post est prêt » | L'adresse |
| 13 | ElevenLabs | Existe, connecté | Me dire votre plan ; enregistrer 30 min de lecture si clone possible | Le plan, l'enregistrement |
| 14 | Higgsfield | Pris, connecté | Créer le présentateur virtuel avec moi (Soul ID) | Rien de plus |
| 15 | Windsor.ai | Existe, connecté | Connecter les sources : Facebook, Instagram, YouTube, TikTok (les trois marques) | Rien de plus |
| 16 | Hektor | Existe | Plus tard, avec la refonte : créer la passerelle vers le FTP Railway | Rien pour l'instant |
| 17 | Railway | Existe | Plus tard : serveur FTP pour la passerelle | Rien pour l'instant |

Compte basket : titulaire Olivier, fils de 14 ans. Le compte est au nom d'un adulte, ce qui est conforme. Prénom seul, jamais de nom de famille ni d'établissement scolaire, et accord du club pour les autres joueurs à l'image.

### 12.4 Analyse des vidéos et boucle d'amélioration
Objectif : savoir ce qui marche, et que chaque vidéo profite des précédentes.

**Collecte.** Une routine `analytics` le lundi à 9h (et le jeudi pour les vidéos de la semaine) lit les performances via Windsor.ai, déjà connecté, qui couvre Facebook, Instagram, YouTube et TikTok organiques. Pour chaque post publié : vues, durée moyenne de visionnage et pourcentage regardé, rétention à 3 s et à 50 %, likes, commentaires, partages, enregistrements, nouveaux abonnés, clics sur le lien (AMO). Écrit dans la table `metrics` à J+2, J+7 et J+28.

**Caractéristiques de chaque vidéo**, enregistrées au moment de la création dans `posts.features` : type d'accroche (question, chiffre, promesse, démonstration), durée, sujet, segment, format (longue, extrait, data card), présence du présentateur, position de l'appel à l'action, heure de publication, musique ou non, longueur du titre.

**Apprentissage.** La routine croise `metrics` et `features` et met à jour `brands/<slug>/learnings.md` : les trois accroches qui retiennent le mieux, la durée idéale par réseau, les sujets qui font s'abonner, ce qui fait décrocher à 3 s. Ce fichier est lu par le stratège à chaque création. Une variable à la fois : chaque semaine, la routine propose un test (par exemple accroche question contre accroche chiffre) et le tranche la semaine suivante.

**Restitution.** Un onglet « Performances » dans le tableau de bord (classement des vidéos, courbes par réseau, tests en cours et conclusions) et un mail hebdomadaire le lundi : trois chiffres, trois enseignements, le test de la semaine.

**Limites honnêtes.** Il faut une trentaine de vidéos avant de tirer des conclusions solides ; avant cela, les enseignements sont indicatifs. Windsor.ai a ses propres limites de plan ; si TikTok n'y remonte pas, la fonction Netlify lira l'API TikTok Display, ouverte aux comptes connectés.
