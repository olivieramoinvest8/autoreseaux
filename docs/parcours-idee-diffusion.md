# De l'idée à la diffusion

Trois marques, un moteur : AMO Invest, chaîne tech / IA, basket.

Légende : _(robot)_ = automatique, _(vous)_ = Olivier, _(Netlify)_ = fonction après votre clic. Sans marque = les trois.


## 0. Déclencheur

> Une routine par marque et par créneau. Une routine qui échoue n'empêche pas les autres.

- Routine amo-image · 11h03 lun-sam _(robot, AMO)_
- Routine amo-video · 18h03 lun-sam _(robot, AMO)_
- Routine tech-video · lun, mer, ven 18h03 _(robot, Tech)_
- Routine basket-match · tous les soirs 20h, s'il y a un match déposé _(robot, Basket)_
- Fonction Netlify · 9h : lit amoinvest.fr (vente, location) → table listings _(Netlify, AMO)_

## 1. Matière première _(robot)_

- Vos dépôts dans le tableau de bord (table inbox) _(vous)_
  - Info d'agence : signature notaire, nouveau mandat, événement + photo + 2 phrases _(AMO)_
  - Match : clips filmés au téléphone, adversaire, score _(Basket)_
  - Enregistrement : voix, remarques _(Tech)_
- Annonces (table listings) : nouveau bien, baisse de prix, sous offre, vendu, loué _(AMO)_
- Calendrier éditorial (calendar.json) : segment du jour, angles possibles _(AMO, Tech)_
- 30 derniers posts de la marque : jamais le même thème en 14 jours
- Enseignements (learnings.md) : ce qui a marché, test de la semaine
- Actualité vérifiée par recherche web : loi, fiscalité, chiffre local sourcé _(AMO)_
- Vos applis (Netlify) : ce qu'il y a à montrer à l'écran _(Tech)_

## 2. Choix du sujet _(robot)_

> Le robot lit d'abord ce que vous avez déposé, puis les annonces, et ne « crée » que s'il n'y a rien de nouveau.

- Priorité 1 : un dépôt d'Olivier _(robot)_
- Priorité 2 : un changement d'annonce → post « annonce » avec lien vers la fiche du site _(AMO)_
- Priorité 3 : création
  - Ancien bien et son histoire (« vendu en 23 jours ») _(AMO)_
  - Loi, fiscalité, chiffre local, toujours sourcé _(AMO)_
  - Vie de l'agence, sans vente _(AMO)_
  - Un outil, une astuce, une appli créée _(Tech)_
- Garde-fous
  - Segment de rotation du jour respecté
  - Pas de redite sur 14 jours
  - Pas de promesse de rendement, pas de superlatif, pas de donnée personnelle
  - Prénom seul, jamais de nom de famille _(Basket)_

## 3. Écriture (skill stratège) _(robot)_

- Angle et accroche : type enregistré dans posts.features (question, chiffre, promesse, démonstration)
- Texte Facebook : 300 à 600 caractères, 0 à 3 hashtags _(AMO)_
- Texte Instagram : 150 à 300 caractères + 10 à 15 hashtags _(AMO)_
- Titre ≤ 60 caractères + description ≤ 300 (TikTok, YouTube) _(Tech, Basket)_
- Script vidéo
  - AMO : 45 à 60 s, data card ou démo d'outil _(AMO)_
  - Tech : 4 à 6 min + plan des 3 à 5 extraits complets en eux-mêmes _(Tech)_
  - Basket : carte score, ordre des clips, titre _(Basket)_
- Mentions obligatoires : DPE, GES, honoraires sur une annonce ; « contenu synthétique » si voix ou présentateur IA
- Appel à l'action sobre : « Parlons-en », « la vidéo complète est sur YouTube »

## 4. Fabrication de l'image (11h) _(robot, AMO)_

- JSON de données : segment, titre, texte, chiffre, source, CTA
- Template : post-feed (1080×1350), datacard, annonce, story (1080×1920)
- Fond : Higgsfield avec parcimonie, ou photos du bien sous mandat (site / Hektor)
- render-image.js (Playwright) → PNG
- Contrôle : texte lisible, diagonale hors des textes, logo dans le cartouche blanc

## 5. Fabrication de la vidéo (18h, tech, basket) _(robot)_

- Voix : ElevenLabs (votre voix clonée) + horodatage de chaque mot
- Image principale
  - Tech : Playwright enregistre l'écran de votre appli _(Tech)_
  - Basket : vos clips, dans l'ordre du script _(Basket)_
  - AMO : data card animée ou démo d'outil _(AMO)_
- Présentateur virtuel Higgsfield (Speak + Soul ID) sur l'audio ElevenLabs : intro et conclusion, 5 à 10 s _(Tech)_
- Plans d'illustration Higgsfield vidéo, si le script en demande
- Remotion : montage, sous-titres depuis le script, habillage charte
- GitHub Actions : rendu MP4 longue 16:9 + extraits 9:16 depuis le même montage
- Musique : libre de droits au montage, ou son ajouté dans TikTok _(Tech, Basket)_

## 6. Stockage _(robot)_

- Upload dans le bucket Supabase visuels ou videos → URL publique
- Ligne posts : statut draft, textes par réseau, media_url, features, brand_id, listing_id

## 7. Validation (vous) _(vous)_

> La seule étape où vous intervenez. Un clic.

- Mail Gmail « un post est prêt » avec le lien du tableau de bord _(robot)_
- Tableau de bord (téléphone) : aperçu, textes par réseau _(vous)_
- Valider · Refuser · Modifier le texte · Copier · Télécharger _(vous)_
- Sans clic sous 48 h : le post reste en brouillon, rien ne part

## 8. Publication (fonction Netlify) _(Netlify)_

- Facebook + Instagram : API Meta, votre application, vos jetons _(AMO)_
- YouTube : API YouTube Data, longue + Shorts, case « contenu synthétique » _(Tech)_
- TikTok : brouillon déposé dans votre appli → vous ajoutez le son et publiez (30 s) _(vous, Tech, Basket)_
- posts → published + identifiants des publications
- Erreur → statut error + mail avec la cause
- Jetons Meta renouvelés automatiquement tous les 60 jours

## 9. Mesure et apprentissage _(robot)_

> Boucle : la mesure nourrit le choix du sujet et l'écriture de la vidéo suivante.

- Routine analytics · lundi 9h et jeudi : Windsor.ai → table metrics (J+2, J+7, J+28)
- Indicateurs : vues, % regardé, rétention à 3 s, likes, partages, abonnés, clics sur le lien
- Croisement metrics × features → learnings.md par marque
- Onglet Performances du tableau de bord + mail du lundi : 3 chiffres, 3 enseignements, le test
- Test de la semaine : une variable à la fois, tranché la semaine suivante
- ↩ Retour à l'étape 2 : le stratège lit learnings.md avant chaque création
