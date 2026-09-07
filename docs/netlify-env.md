# Variables d'environnement du site Netlify « communicationsocial »

À renseigner dans Netlify : Site configuration → Environment variables. Jamais dans le dépôt.

| Variable | Rôle | Où la trouver | Quand |
|---|---|---|---|
| `SUPABASE_URL` | Adresse du projet Supabase « Communication » | Supabase → Project settings → Data API → Project URL | Étape 2 |
| `SUPABASE_SERVICE_KEY` | Clé service (accès complet, côté serveur seulement) | Supabase → Project settings → API keys → service_role | Étape 2 |
| `DASHBOARD_PASSWORD` | Mot de passe du tableau de bord | À choisir : 16 caractères minimum | Étape 2 |
| `DASHBOARD_URL` | Adresse du site | `https://communicationsocial.netlify.app` | Étape 2 |
| `INTERNAL_SECRET` | Secret interne entre fonctions | Chaîne aléatoire longue (je la génère) | Étape 2 |
| `SITE_BASE_URL` | Site à lire pour les annonces | `https://www.amoinvest.fr` | Étape 2 |
| `META_APP_ID`, `META_APP_SECRET` | Application Meta | developers.facebook.com → votre app → Paramètres de base | Étape 3 |
| `META_PAGE_ID`, `META_PAGE_TOKEN` | Page Facebook et jeton de page longue durée | Explorateur Graph API, guidé | Étape 3 |
| `META_IG_USER_ID` | Compte Instagram professionnel lié | Graph API : `/{page-id}?fields=instagram_business_account` | Étape 3 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Projet Google Cloud, identifiant OAuth | console.cloud.google.com → Identifiants | Étape 4 |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | Application TikTok | developers.tiktok.com → votre app | Étape 5 |

Les refresh tokens Google et TikTok ne sont pas des variables : ils sont stockés dans la table `social.tokens` par les fonctions `oauth-google` et `oauth-tiktok`, que vous ouvrez une fois dans le navigateur.

URI de redirection à déclarer :
- Google : `https://communicationsocial.netlify.app/.netlify/functions/oauth-google`
- TikTok : `https://communicationsocial.netlify.app/.netlify/functions/oauth-tiktok`
