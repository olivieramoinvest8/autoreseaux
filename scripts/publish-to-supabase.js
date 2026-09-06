#!/usr/bin/env node
/**
 * scripts/publish-to-supabase.js — PHASE 3, squelette non fonctionnel pour l'instant.
 *
 * Rôle prévu :
 *   1. Uploader un asset (PNG ou MP4) dans le bucket Supabase `visuels` ou `videos` → URL publique.
 *   2. Insérer une ligne dans la table `posts` avec status = 'draft'.
 *   3. Appeler le webhook n8n avec { post_id } pour déclencher l'aperçu mail à Olivier.
 *
 * Variables d'environnement attendues (jamais dans le dépôt) :
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY, N8N_WEBHOOK_URL
 *
 * Usage prévu :
 *   node scripts/publish-to-supabase.js --asset output/post.png --post content/runs/2026-09-06-11h.json
 */

console.error("Pas encore implémenté : ce script est prévu pour la phase 3 (voir BRIEF.md §8).");
process.exit(1);
