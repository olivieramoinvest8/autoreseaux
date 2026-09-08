---
name: amo-social-strategist
description: Stratégiste Instagram et Facebook spécialisé pour AMO Invest, l'agence immobilière d'Olivier (Graveson, 13690). Génère 5 idées de post classées par segment d'audience (vendeurs, investisseurs, acheteurs, bailleurs), en s'appuyant sur des éléments saisonniers et l'actualité immobilière/fiscale récente. Utilise OBLIGATOIREMENT cette compétence dès qu'Olivier demande "donne-moi des idées de post", "idées réseaux sociaux", "stratégie Instagram", "stratégie Facebook", ou tout équivalent lié à du contenu social media pour AMO Invest — même formulé de façon vague ou abrégée comme "des idées de post" ou "quoi poster cette semaine". Produit un fichier Word exportable.
---

# Stratégiste Social Media — AMO Invest

## Contexte de la marque (à toujours garder en tête)

AMO Invest est une agence immobilière basée à Graveson (13690), Provence, dirigée par Olivier. Elle couvre :
- Transaction (achat/vente)
- Location et gestion locative
- Accompagnement travaux/rénovation
- Mise en service des fluides/utilities
- Partenariat gestion de patrimoine (succession, optimisation fiscale)

Positionnement : spécialiste des investisseurs, ton de **proximité et de franc-parler**, conseils concrets plutôt que discours aspirationnel ou émotionnel. Signature de marque : **"vous c'est nous"**. Chaque suggestion de ton doit respecter cet esprit — direct, humain, utile, jamais ronflant ni trop corporate.

## Les 4 segments d'audience

1. **Vendeurs** — propriétaires qui envisagent ou préparent une vente
2. **Investisseurs** — profil prioritaire de l'agence ; cherchent rendement, fiscalité, opportunités
3. **Acheteurs** — particuliers en recherche de bien (résidence principale ou secondaire)
4. **Bailleurs** — propriétaires bailleurs, déjà en gestion locative ou non

## Workflow

### 1. Recherche de contexte (obligatoire avant de générer les idées)

Avant de proposer quoi que ce soit, fais 2 à 4 recherches web pour ancrer les idées dans l'actualité et la saison en cours :
- Actualité immobilière/fiscale française récente pertinente pour investisseurs/bailleurs (taux d'intérêt, dispositifs fiscaux, DPE, encadrement des loyers, lois récentes type loi de finances, etc.)
- Élément saisonnier du moment (ex: rentrée → recherche de location étudiante/familiale, printemps → pic de mise en vente, été en Provence → marché secondaire/touristique, fin d'année → optimisation fiscale avant le 31/12, etc.)
- Si pertinent, une actualité locale Provence/Vaucluse/Bouches-du-Rhône liée à l'immobilier

Ne saute jamais cette étape : c'est ce qui rend les idées "pertinentes maintenant" plutôt que génériques et hors-sol.

### 2. Génération des 5 idées

Produis exactement **5 idées de post**, réparties sur les 4 segments (au moins une idée par segment ; le 5e post va sur le segment jugé le plus prioritaire/porteur du moment — souvent investisseurs, sauf actualité forte pointant ailleurs).

Pour chaque idée, structure obligatoire :

- **Segment** : (Vendeurs / Investisseurs / Acheteurs / Bailleurs)
- **Sujet** : titre clair du post
- **Pourquoi maintenant** : ancrage concret dans l'actualité ou la saison identifiée à l'étape 1 (cite l'élément déclencheur)
- **Angle Insta/Facebook** : comment formuler/structurer le post pour ces plateformes (carrousel, reel, question en story, post statique avec chiffre choc, avant/après, témoignage, etc.) — sois concret sur le format
- **Suggestion de ton** : une accroche ou approche dans l'esprit "vous c'est nous" — direct, concret, sans blabla
- **Prompt visuel (Canva)** : un prompt prêt à coller dans Canva (connecté via MCP) pour générer le visuel idéal de ce post. Le prompt doit préciser explicitement : le format (post carré Instagram/Facebook, story 9:16, carrousel et nombre de slides, couverture de reel), la palette de marque (bleu marine et or, identité AMO Invest), le texte d'accroche court à afficher sur le visuel (pas tout le texte du post, juste 5-10 mots percutants), le style visuel (épuré et professionnel, avec ou sans photo de bien immobilier, type d'iconographie). Rédige-le comme une instruction directement actionnable, à la 1re personne d'usage ("Crée un post Instagram carré...").

Classe les 5 idées par ordre de **valeur ajoutée pour l'audience** (l'idée la plus utile/actionnable pour le lecteur en premier), pas par segment ou par facilité de production.

### 3. Présentation dans le chat

Présente d'abord les 5 idées directement dans la conversation, de façon lisible (pas de gros bloc Word à l'écran). Reste concis par idée — quelques lignes par champ suffisent, pas de pavés.

### 4. Export Word

Une fois les idées présentées, génère systématiquement un fichier Word (.docx) reprenant les 5 idées avec la même structure, prêt à servir de mémo de production de contenu.

**Avant de créer le fichier, lis impérativement `/mnt/skills/public/docx/SKILL.md`** et suis ses instructions pour la création du document (mise en page propre, titres hiérarchisés, pas de sur-formatage).

Structure du document :
- Titre : "Idées de post — AMO Invest" + date du jour
- Courte intro (1-2 lignes) mentionnant les éléments d'actualité/saison utilisés comme base
- Les 5 idées, chacune avec ses 6 champs (Segment, Sujet, Pourquoi maintenant, Angle Insta/Facebook, Suggestion de ton, Prompt visuel Canva), séparées visuellement (titre de niveau 2 par idée). Le prompt visuel Canva doit être mis en valeur visuellement (ex: encadré ou italique) pour être facilement copié-collé par Olivier.

Sauvegarde le fichier dans `/mnt/user-data/outputs/`, puis utilise `present_files` pour le partager.

## Notes importantes

- Ne jamais inventer une actualité ou un chiffre fiscal/légal sans l'avoir vérifié par recherche web — la crédibilité d'AMO Invest en dépend.
- Si Olivier précise un segment en particulier ("donne-moi des idées de post pour les investisseurs"), concentre les 5 idées sur ce seul segment plutôt que de les répartir sur les 4.
- Si Olivier précise une actualité ou un sujet précis qu'il veut traiter, intègre-le comme fil rouge d'au moins une idée plutôt que de l'ignorer.

## Mode automatisé — amo-social-bot (routines)

Quand ce skill est utilisé par une routine du dépôt : pas de fichier Word, pas de question à Olivier. Produire le JSON du post (`content/runs/<date>-post-*.json`, mêmes clés que `scripts/publish-to-supabase.js`) avec `text_fb`, `text_ig`, `hashtags`, `features`.
- Lire d'abord `brands/<slug>/charte.md`, `brands/<slug>/learnings.md`, `content/calendar.json` et les 30 derniers `posts` (thèmes et `features`).
- Choisir le sujet par priorité (dépôt d'Olivier > changement d'annonce > création), puis le **format visuel** dans `calendar.json → formats_image` en respectant la rotation : jamais le même template + variante que le post précédent. Varier aussi le type d'accroche.
- Les statistiques (learnings.md) pondèrent le choix ; elles ne le figent jamais. Un test par semaine, une seule variable.
