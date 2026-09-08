# Fonctions Supabase (Edge Functions)

Déployées sur le projet « Communication » via le connecteur Supabase. Les sources sont gardées ici pour relecture ; un redéploiement se fait depuis une session Claude Code (outil `deploy_edge_function`) ou avec la CLI Supabase.

| Fonction | Rôle | Qui l'appelle | Droits |
|---|---|---|---|
| `fetch-image` | Relais en lecture seule vers les hébergeurs d'images bloqués pour l'environnement Claude Code (staticlbi.com, cloudfront.net, higgsfield.ai, amoinvest.fr) | `render/fetch-media.js` | clé publique du projet |
| `bot-draft` | Guichet de dépôt : envoie un visuel dans le bucket public, crée un post `draft` avec jeton de validation 48 h, renvoie le texte du mail | `scripts/publish-to-supabase.js` en mode relais | clé publique + secret de bot (`social.tokens`, network `internal`) |

Principe : les routines Claude Code ne détiennent jamais la clé service de Supabase ni un jeton de réseau social. Elles ne peuvent que déposer des brouillons. La publication reste le rôle exclusif des fonctions Netlify, après validation d'Olivier.
