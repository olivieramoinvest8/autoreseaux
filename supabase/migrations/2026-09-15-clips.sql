-- Base de montage basket : une ligne par clip déposé (catégorie, qui est à l'image, publiable ou non).
-- À passer une fois dans Supabase → SQL Editor (projet « Communication »). Sans cette table, le tableau de bord
-- garde quand même la liste dans inbox.data.clips ; la table sert au robot pour choisir les clips d'un montage.
create table if not exists social.clips (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid references social.matches (id),
  inbox_id   uuid references social.inbox (id),
  path       text not null,                               -- chemin dans le bucket raw
  category   text not null,                               -- id de brands/basket/clips.json
  phase      text,                                        -- attaque | defense | mixte | hors-jeu
  who        text not null default 'fils'                 -- fils | equipe
             check (who in ('fils', 'equipe')),
  note       text,
  publiable  boolean not null default true,               -- false : gardé pour Olivier et le coach, jamais monté
  duration_s numeric,                                     -- rempli au montage
  used_in    uuid[] not null default '{}',                -- posts où le clip a été monté
  created_at timestamptz not null default now()
);
create index if not exists clips_match_idx    on social.clips (match_id);
create index if not exists clips_category_idx on social.clips (category, who);
alter table social.clips enable row level security;
