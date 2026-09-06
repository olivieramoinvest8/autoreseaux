-- supabase/schema.sql — Table posts + buckets publics. À exécuter dans l'éditeur SQL Supabase (phase 3).
-- Idempotent : peut être relancé sans casser l'existant.

create extension if not exists "pgcrypto";

create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  slot          text not null check (slot in ('11h', '18h')),
  type          text not null check (type in ('image', 'video')),
  segment       text,
  theme         text,
  text_fb       text,
  text_ig       text,
  text_tiktok   text,
  text_youtube  text,
  hashtags      text[] default '{}',
  media_url     text,
  thumbnail_url text,
  status        text not null default 'draft'
                check (status in ('draft', 'approved', 'rejected', 'published', 'error')),
  networks      text[] default '{}',
  external_ids  jsonb default '{}'::jsonb,
  error         text,
  published_at  timestamptz
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_status_idx     on public.posts (status);
create index if not exists posts_theme_idx      on public.posts (theme);

-- Sécurité : la table n'est accessible qu'avec la clé service (n8n, scripts). Pas d'accès public.
alter table public.posts enable row level security;

-- Buckets publics pour les assets (lecture publique, écriture par clé service uniquement).
insert into storage.buckets (id, name, public)
values ('visuels', 'visuels', true), ('videos', 'videos', true)
on conflict (id) do nothing;
