# netlify — PHASE 2

- `site/` : tableau de bord privé (posts prêts, déposer une info / un match / un enregistrement, historique). Utilisable au téléphone.
- `functions/` : approve, reject (liens du mail), post-action (valider, programmer, relancer, remettre en brouillon, modifier, refuser), api-posts / api-inbox / api-listings / api-events (tableau de bord), publish-background (publication Meta, YouTube, TikTok), publish-scheduled (toutes les 10 minutes : posts programmés), read-listings (7h UTC) et read-listings-now, refresh-tokens (lundi), oauth-google, oauth-tiktok.

Programmation : un post validé « pour plus tard » reste en `approved` avec `scheduled_at` ; `publish-scheduled` déclenche `publish-background` quand l'heure est passée (au plus tard 10 minutes après). Un post en `error` se relance depuis le tableau de bord.
