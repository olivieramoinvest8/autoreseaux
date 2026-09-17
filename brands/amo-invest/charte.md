# Charte — AMO Invest
Référence complète : `CLAUDE.md` §4 (règles de contenu) et §5 (charte graphique). Ce fichier n'ajoute que ce qui est propre à la marque.

- Réseaux : Facebook (page) + Instagram (professionnel). Image à 11h03, vidéo à 18h03, du lundi au samedi.
- Calendrier : `content/calendar.json`. Segments en rotation : vendeurs, investisseurs, acheteurs, bailleurs.
- Priorité du sujet : dépôt d'Olivier > bien nouveau (vente ou location) > bien sous offre, vendu ou loué (fierté sobre, invitation à confier son bien, jamais le prix final s'il n'est pas public) > nouveauté légale ou fiscale vérifiée > autres idées (segment du jour).
- Annonce : prix, honoraires, DPE, GES, lien vers la fiche amoinvest.fr obligatoires. Photos du bien uniquement. Sans lettre DPE lisible : « en cours » (maison, appartement) ou « non soumis » (terrain), via la clé `dpe_note` des templates.
- Signature : « AMO Invest · Graveson », appel à l'action sobre. Vouvoiement.
- Enseignements : `learnings.md` (lu avant chaque création, mis à jour par la routine analytics).

## Variété visuelle (règle d'Olivier, 8 septembre 2026)
- **Fixe** : bleu marine, or, blanc, Oswald et Inter, logo officiel dans son cartouche, DPE/GES et honoraires sur une annonce.
- **Libre, et doit changer** : composition, place de la photo, fond (bleu profond, clair, photo voilée), objet 3D (maison, clé, pièces, graphique, porte, boussole…), place des diagonales, taille du titre, ton de l'accroche (question, chiffre, affirmation, démonstration).
- Jamais deux visuels de suite avec le même template et la même variante ; un template ne revient pas avant 6 posts image (`calendar.json` → `regles.rotation_format_posts`). Le stratège relit `posts.features` (format, variante, visuel) avant de choisir.
- Les statistiques décident : la routine `analytics` compare les formats dans `learnings.md`, et le stratège favorise ce qui marche sans jamais figer un seul format. Un test par semaine, une variable à la fois.

## Trois propositions par jour (décision d'Olivier, 17 sept.)

La routine `amo-image` (8h03, lun-sam) dépose trois brouillons distincts ; Olivier en garde 0 à 3 et programme les heures.
- **Vente** : un bien à vendre, ou passé sous offre ou vendu. Priorité : bien nouveau > sous offre ou vendu (fierté sobre, sans prix final s'il n'est pas public) > bien disponible non présenté depuis 30 jours. Format : carrousel (cover, 3 photos, infos). Lien de la fiche amoinvest.fr dans le texte Facebook ; « lien en bio » + référence sur Instagram.
- **Location** : un bien à louer, mêmes priorités. Format différent de celui de la proposition Vente (affiche feed + story, ou carrousel).
- **Actualité** : nouveauté légale ou fiscale vérifiée, conseil, saison, vie de l'agence, sur le segment du jour. Visuel travaillé et réaliste (image générée Higgsfield quand le connecteur est disponible : scène provençale, intérieur lumineux, objet 3D doré ; sinon `assets/generated/*.jpg` ou template sans image), jamais deux fois la même composition de suite.
- Un dépôt d'Olivier (`inbox`) remplace la proposition de même nature.
- **Message toujours positif** sur les trois.
- Sans bien disponible pour Vente ou Location, la routine remplace par une deuxième Actualité d'un autre segment et le dit.

