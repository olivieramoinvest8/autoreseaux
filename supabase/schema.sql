-- supabase/schema.sql — Schéma v2 de amo-social-bot (trois marques, tableau de bord, annonces, analyse).
-- Toutes les tables vivent dans le schéma « social », isolé du reste du projet Supabase qui l'héberge.
-- Appliqué par Claude via le connecteur. Idempotent : peut être relancé.

create extension if not exists "pgcrypto";
create schema if not exists social;
set search_path to social, public;

-- 1. Marques -----------------------------------------------------------------
create table if not exists social.brands (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,                  -- 'amo-invest' | 'tech' | 'basket'
  name             text not null,
  networks         text[] not null default '{}',          -- ex. {facebook,instagram}
  validation_email text,
  channel_ids      jsonb not null default '{}'::jsonb,    -- {facebook_page_id, instagram_user_id, youtube_channel_id, tiktok_open_id}
  settings         jsonb not null default '{}'::jsonb,    -- cadence, langue, options
  created_at       timestamptz not null default now()
);

insert into social.brands (slug, name, networks) values
  ('amo-invest', 'AMO Invest', '{facebook,instagram}'),
  ('tech',       'Chaîne tech / IA', '{youtube,tiktok}'),
  ('basket',     'Basket', '{tiktok}')
on conflict (slug) do nothing;

-- 2. Annonces AMO (lues sur amoinvest.fr, plus tard par la passerelle Hektor) ------------------
create table if not exists social.listings (
  id            uuid primary key default gen_random_uuid(),
  source        text not null default 'site',            -- 'site' | 'hektor' | 'manuel'
  external_id   text not null,                           -- identifiant sur le site ou dans Hektor
  url           text,
  kind          text not null check (kind in ('vente', 'location')),
  title         text,
  property_type text,
  city          text,
  price         numeric,
  fees_note     text,                                    -- mention honoraires telle qu'affichée
  surface_m2    numeric,
  rooms         int,
  dpe           text,
  ges           text,
  photos        text[] not null default '{}',
  status        text not null default 'disponible'
                check (status in ('disponible', 'sous_offre', 'vendu', 'loue', 'retire')),
  fingerprint   text,                                    -- empreinte pour détecter un changement
  raw           jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  changed_at    timestamptz,
  unique (source, external_id)
);
create index if not exists listings_status_idx on social.listings (status);
create index if not exists listings_changed_idx on social.listings (changed_at desc);

-- 3. Ce qu'Olivier dépose dans le tableau de bord -------------------------------------------
create table if not exists social.inbox (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references social.brands (id),
  kind       text not null check (kind in ('info', 'match', 'enregistrement', 'bien')),
  title      text,
  body       text,
  files      text[] not null default '{}',                -- chemins dans le bucket raw
  data       jsonb not null default '{}'::jsonb,          -- score, adversaire, date de match...
  status     text not null default 'nouveau'
             check (status in ('nouveau', 'utilise', 'ignore')),
  created_at timestamptz not null default now(),
  used_at    timestamptz
);
create index if not exists inbox_brand_status_idx on social.inbox (brand_id, status);

-- 4. Posts -------------------------------------------------------------------------
create table if not exists social.posts (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  brand_id       uuid not null references social.brands (id),
  slot           text not null,                          -- '11h' | '18h' | 'match'
  type           text not null check (type in ('image', 'video', 'video_longue', 'extrait')),
  segment        text,
  theme          text,
  text_fb        text,
  text_ig        text,
  text_tiktok    text,
  text_youtube   text,
  hashtags       text[] not null default '{}',
  media_url      text,
  thumbnail_url  text,
  extra_media    jsonb not null default '[]'::jsonb,     -- extraits, versions 16:9 / 9:16
  features       jsonb not null default '{}'::jsonb,     -- accroche, durée, sujet, format, présentateur, cta, heure
  listing_id     uuid references social.listings (id),
  inbox_id       uuid references social.inbox (id),
  parent_post_id uuid references social.posts (id),      -- extrait → vidéo longue
  status         text not null default 'draft'
                 check (status in ('draft', 'approved', 'rejected', 'published', 'partial', 'error')),
  approval_token text unique,
  token_expires_at timestamptz,
  networks       text[] not null default '{}',
  external_ids   jsonb not null default '{}'::jsonb,     -- {facebook: id, instagram: id, youtube: id, tiktok: publish_id}
  error          text,
  approved_at    timestamptz,
  scheduled_at   timestamptz,                            -- publication programmée (null = dès validation)
  published_at   timestamptz
);
create index if not exists posts_brand_created_idx on social.posts (brand_id, created_at desc);
create index if not exists posts_status_idx        on social.posts (status);
create index if not exists posts_theme_idx         on social.posts (theme);
create index if not exists posts_scheduled_idx     on social.posts (status, scheduled_at);

-- 5. Matchs de basket ---------------------------------------------------------------
create table if not exists social.matches (
  id         uuid primary key default gen_random_uuid(),
  inbox_id   uuid references social.inbox (id),
  played_at  date,
  opponent   text,
  score_home int,
  score_away int,
  home       boolean,
  clips      text[] not null default '{}',
  status     text not null default 'nouveau'
             check (status in ('nouveau', 'monte', 'publie', 'ignore')),
  post_id    uuid references social.posts (id),
  created_at timestamptz not null default now()
);

-- 6. Mesures et apprentissage ---------------------------------------------------------
create table if not exists social.metrics (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references social.posts (id),
  network       text not null,
  measured_at   timestamptz not null default now(),
  days_after    int,                                     -- 2, 7, 28
  views         bigint,
  avg_watch_pct numeric,
  retention_3s  numeric,
  retention_50  numeric,
  likes         int,
  comments      int,
  shares        int,
  saves         int,
  follows       int,
  link_clicks   int,
  raw           jsonb,
  unique (post_id, network, days_after)
);

-- 7. Jetons d'accès aux plateformes (chiffrés côté application, jamais en clair dans le dépôt) --
create table if not exists social.tokens (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid references social.brands (id),
  network    text not null,                              -- 'meta' | 'google' | 'tiktok'
  account_id text,
  data       jsonb not null,                             -- valeurs chiffrées
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (brand_id, network, account_id)
);

-- 8. Journal ---------------------------------------------------------------------------
create table if not exists social.events (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  source     text not null,                              -- 'routine' | 'netlify' | 'dashboard'
  level      text not null default 'info' check (level in ('info', 'warn', 'error')),
  post_id    uuid references social.posts (id),
  message    text not null,
  data       jsonb
);
create index if not exists events_at_idx on social.events (at desc);

-- Sécurité : accès uniquement par clé service (routines, fonctions Netlify). Aucun accès social.
-- RLS : aucun accès public, seule la clé service lit et écrit.
alter table social.brands   enable row level security;
alter table social.listings enable row level security;
alter table social.inbox    enable row level security;
alter table social.posts    enable row level security;
alter table social.matches  enable row level security;
alter table social.metrics  enable row level security;
alter table social.tokens   enable row level security;
alter table social.events   enable row level security;

-- Buckets : visuels et videos publics (lecture), raw privé.
insert into storage.buckets (id, name, public)
values ('visuels', 'visuels', true), ('videos', 'videos', true), ('raw', 'raw', false)
on conflict (id) do nothing;
