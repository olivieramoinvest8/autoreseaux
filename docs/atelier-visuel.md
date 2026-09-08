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

## 6. État de l'atelier v1 (8 septembre 2026, session 2)

Ce qui existe et a été contrôlé visuellement sur trois créations réelles (biens réf. 458 et 447, thème « prix juste » du calendrier) :

| Template | Format | Rôle | Clés principales |
|---|---|---|---|
| `templates/annonce-feed.html` | 1080×1350 | Affiche d'annonce : photo, diagonale, prix en relief, pastilles DPE/GES, 3 vignettes, cartouche logo | `photo_main`, `photo_1..3`, `badge`, `kicker`, `title`, `price`, `fees`, `spec_1..4`, `dpe`, `ges`, `ref`, `site` |
| `templates/annonce-story.html` | 1080×1920 | Même affiche en story / reel | mêmes clés |
| `templates/carrousel-cover.html` | 1080×1350 | Slide 1 d'un carrousel : photo plein cadre, titre, prix, « Faites défiler » | `photo`, `photo_size`, `photo_position`, `badge`, `kicker`, `title`, `price`, `fees`, `swipe`, `ref`, `site` |
| `templates/carrousel-photo.html` | 1080×1350 | Slides photo + légende | `photo`, `step`, `label`, `caption` |
| `templates/carrousel-infos.html` | 1080×1350 | Dernière slide : récapitulatif, DPE/GES, appel à l'action | `kicker`, `title`, `row1_label..row6_value`, `dpe`, `ges`, `cta`, `note`, `site` |
| `templates/pedagogie-premium.html` | 1080×1350 | Objet 3D doré (Higgsfield) + titre en relief + phrase + CTA | `object_image`, `segment`, `title`, `subtitle`, `body`, `cta`, `localisation` |

Scripts : `render/render-image.js` (un template → une image ; accepte maintenant tout chemin d'image relatif au dépôt et `--format jpeg`), `render/render-carousel.js` (un JSON `slides` → toutes les slides), `render/fetch-media.js` (télécharge photos et rendus, en direct ou via le relais).

Exemples de données : `content/runs/2026-09-08-*.json` (données des visuels, et fichiers `post-*.json` avec textes Facebook / Instagram, hashtags et `features`, prêts pour `scripts/publish-to-supabase.js`). Rendus de référence : `output/examples/annonce-feed-458.png`, `carrousel-cover-447.png`, `pedagogie-premium-vendeurs.png`.

Images générées réutilisables : `assets/generated/maison-or-podium.jpg` et `maison-or-contour.jpg` (Higgsfield, modèle Nano Banana Pro, 8 sept.). Une image générée sert de fond ou d'objet, jamais de bien réel ; le texte est toujours posé par le template.

Règles apprises sur les vraies photos du site :
- Les anciennes photos portent un filigrane « AMO Invest / cliches2.com » vers 70 à 80 % de la hauteur : le cacher sous le cartouche ou le bandeau avec `photo_size` (ex. `auto 1720px`) et `photo_position: center top`, ou choisir une autre photo. La passerelle Hektor apportera des photos propres.
- Les photos sont en 1600 px de large : suffisant pour 1080×1350, juste pour la story.
- Un texte clair posé sur une photo claire (toit, ciel) doit avoir un voile bleu dessous : les dégradés des templates montent jusqu'à 40 % de la hauteur.
- DPE et GES ne sont posés que s'ils sont lus sur la fiche (bulle active) ; sinon les pastilles disparaissent d'elles-mêmes (`data-if`).

Relais d'images : l'environnement Claude Code n'atteint que amoinvest.fr, Supabase et Netlify. La fonction Supabase `fetch-image` (projet Communication, lecture seule, hôtes limités à staticlbi.com, cloudfront.net, upload.higgsfield.ai et amoinvest.fr) sert de relais ; `render/fetch-media.js` l'appelle avec la clé publique du projet lue dans `.env` (voir `.env.example`). Le jour où `*.staticlbi.com` et `*.cloudfront.net` sont ajoutés à la liste blanche de l'environnement, le direct suffit et le relais n'est plus appelé.
