# À faire à la prochaine poussée

Idées et corrections validées avec Olivier, à embarquer dans le prochain push (rien ne part sans son signal).

- [ ] **Dépôt par marque** (idée d'Olivier, 8 sept.) : dans l'onglet « Déposer », choisir d'abord la marque, puis le type de dépôt ; chaque combinaison ouvre son propre formulaire.
  - AMO Invest : info d'agence (signature, mandat, événement), bien à mettre en avant (référence ou lien de la fiche), photo.
  - Basket : match (date, adversaire, score, domicile, clips), entraînement ou moment d'équipe (clips, deux phrases).
  - Chaîne tech : idée de vidéo (sujet, appli concernée, ce qu'il faut montrer), enregistrement (voix, remarque), capture d'écran.
- [ ] **Calibrage du lecteur amoinvest.fr** (première lecture réelle du 8 sept. : 50 fiches, 43 ventes, 7 locations) :
  - prix, surface, pièces, ville, honoraires, photos : extraits sur 100 % des fiches ✔
  - titre : le `<h1>` contient des retours à la ligne et les sous-blocs (« 4 pièce(s) », « 96 m² ») → prendre la balise `<title>` ou `og:title`, ou nettoyer les espaces et garder la première ligne
  - DPE / GES : trouvés sur 3 fiches sur 50 → le site les affiche autrement (image ou libellé « Classe énergie ») ; stocker un extrait de texte autour de « énergie / DPE / GES » dans `raw` pour calibrer à la lecture suivante
  - honoraires vente : le texte capté déborde sur « Calcul des mensualités » → couper avant ce libellé
