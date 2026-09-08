# Atelier visuel — direction artistique et moteurs de production

Objectif fixé par Olivier (8 sept.) : des visuels **recherchés**, photo-réalistes ou avec profondeur et effets 3D, déclinés par réseau (image, carrousel, story, vidéo), pour les trois marques, sans dépendre d'un outil tiers pour la composition. Références fournies : affiche « Open House » (collage photo, badges, portrait, icônes), visuels holographiques IA, affiches de match « VS » (joueurs détourés, fond dramatique, typographie XXL).

## 1. Quatre moteurs, un seul chef d'orchestre

| Moteur | Rôle | Outil | Dépendance externe |
|---|---|---|---|
| **Imagerie** | Photos réelles des biens (site, Hektor), photos et clips d'Olivier, images générées (fonds Provence, objets 3D dorés, scènes holographiques, arènes), détourage des personnes | Higgsfield (image et image→vidéo), `rembg` (détourage local, sans compte) | Higgsfield pour la génération seulement |
| **Composition** | Mise en page, calques, dégradés, modes de fusion, masques, ombres portées, texte en relief, halos, grilles de photos, badges, icônes SVG, particules | HTML/CSS/Canvas rendu par Playwright (`render/render-image.js`) : c'est le vrai « infographiste », en interne | Aucune |
| **Animation et vidéo** | Vidéo d'annonce à partir des photos (mouvements de caméra, transitions, cartes prix/DPE), résumé de match, vidéo tech longue et extraits, stories animées, sous-titres | Remotion + ffmpeg sur GitHub Actions, Higgsfield image→vidéo pour un plan animé, ElevenLabs pour la voix | Higgsfield et ElevenLabs optionnels |
| **Déclinaison** | Même création adaptée à chaque réseau : format, durée, texte, hashtags, appel à l'action | Le stratège (`amo-social-strategist`) et le catalogue ci-dessous | Aucune |

Règle : **le texte est toujours posé par la composition, jamais généré dans une image IA** (l'IA écrit mal). Les images IA servent de fond ou d'objet, jamais à représenter un bien réel.

## 2. Catalogue des formats par marque

### AMO Invest
| Format | Composition | Réseaux |
|---|---|---|
| Affiche annonce | Photo principale pleine page, bandeau bleu marine en diagonale, prix en relief doré, ville, surface, pièces, DPE/GES en pastilles, 3 vignettes photos, logo, `amoinvest.fr` | FB, IG feed (4:5), story (9:16) |
| Carrousel annonce | 5 slides : couverture, 3 photos plein cadre avec légende, dernière slide « infos + contact » | IG, FB |
| Vidéo annonce | 20 à 30 s : photos animées (zoom lent, panoramique), carte prix, carte DPE, fin logo + site. Plan animé Higgsfield en option | IG reel, FB, TikTok, story |
| Affiche événement | Portes ouvertes, nouveau mandat, « vendu en X jours » : photo + grand titre + date/horaire + badge | FB, IG, story |
| Pédagogie premium | Objet 3D doré (maison, clé, pièces) sur fond bleu profond, titre en relief, chiffre-clé | FB, IG |
| Data card | Chiffre sourcé, courbe ou jauge, fond clair | FB, IG |

### Chaîne tech / IA
| Format | Composition | Réseaux |
|---|---|---|
| Vignette / affiche | Scène holographique (écran, main, interface flottante), titre XXL en relief, sous-titre, nom de l'appli | YouTube miniature, IG, story TikTok |
| Vidéo longue 4-6 min | Écran de l'appli, présentateur virtuel en intro et conclusion, sous-titres, plans Higgsfield | YouTube |
| Extraits 30-60 s | Verticaux, écran en haut, sous-titres en bas, accroche 3 s | TikTok, Shorts |
| Story annonce de vidéo | 9:16, visuel + « nouvelle vidéo » + lien | TikTok, IG |

### Basket
| Format | Composition | Réseaux |
|---|---|---|
| Affiche de match | Style « VS » : joueur détouré (prénom seul), adversaire en silhouette ou logo, arène dramatique, date, score ou « match du jour », typographie XXL | TikTok, IG plus tard |
| Résumé vidéo 30-60 s | Carte score animée, clips, ralentis sur les actions, titre, générique | TikTok |
| Story score | 9:16, score final, photo de l'action | TikTok, IG |

## 3. Système graphique par marque
- **AMO Invest** : bleu marine `#2E358D` et profond `#1E2464`, or `#E9CA31` / `#E0B21F`, Oswald + Inter, diagonales, or en relief (texte extrudé par ombres empilées), photos chaudes (lumière dorée).
- **Tech / IA** : bleu nuit `#0B1230`, cyan `#3DD9FF`, violet `#7C5CFF`, blanc, halos et grilles fines, typographie géométrique (Space Grotesk ou Sora), effets de verre et de lueur.
- **Basket** : couleurs du club (à fournir), noir et blanc contrastés, orange ballon `#F26B1D`, typographie condensée très grasse (Bebas Neue ou Anton), grain, fumée, projecteurs.

## 4. Chaîne de production d'un visuel
1. Le stratège choisit le format dans le catalogue et écrit le brief : titre, sous-titre, données, photos à utiliser, ambiance.
2. L'imagerie fournit : photos réelles redimensionnées, image générée (prompt écrit par le designer), détourage si personne.
3. La composition rend la ou les images (1 à 5 slides, feed et story).
4. **Contrôle visuel obligatoire** : Claude regarde le rendu, vérifie lisibilité, cadrage, absence de chevauchement, cohérence des couleurs, et corrige avant de proposer.
5. Déclinaison : textes par réseau, hashtags, appel à l'action, `features` enregistrées pour l'analyse.
6. Vidéo, si le format l'exige : rendu sur GitHub Actions, contrôle de trois images extraites.

## 5. Contraintes honnêtes
- Photos des biens : celles du site sont en définition moyenne ; la passerelle Hektor apportera la HD. Jamais d'image IA pour figurer un bien.
- Visages : votre fils détouré, oui ; autres joueurs reconnaissables, accord du club. Adversaires jamais nommés.
- Génération d'images : coût en crédits Higgsfield ; le catalogue prévoit toujours une variante sans IA.
- Le rendu final se fait sur GitHub Actions ou Netlify, dont le réseau est ouvert. L'environnement de Claude Code a un réseau restreint : il faut y autoriser amoinvest.fr, supabase.co et netlify.app pour que Claude teste lui-même de bout en bout.
