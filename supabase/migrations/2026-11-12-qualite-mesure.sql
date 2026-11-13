-- Migration du 12 novembre 2026 — suite de l'audit (docs/audit-2026-11-12.md).
-- Ajoute ce qu'il faut pour : la vraie référence et la mention DPE exacte, l'état posé à la main (sous offre, vendu,
-- loué, ne plus proposer), la raison des refus, le suivi des abonnés, et la règle « pas deux fois le même bien en
-- 30 jours » appliquée par la base elle-même. Rejouable sans risque (if not exists / or replace).
-- Passée le 12 novembre 2026 via le connecteur Supabase (sections 1 à 3 et 5). La section 4 (ménage des jetons
-- en double) n'a pas été passée : elle supprime des lignes et demande une confirmation à l'écran ; elle est sans
-- urgence, le renouvellement hebdomadaire met maintenant à jour la ligne la plus récente.

-- 1. Annonces -----------------------------------------------------------------------------------
alter table social.listings add column if not exists reference        text;         -- « Référence 443 » lue sur la fiche (≠ external_id, numéro de l'adresse web)
alter table social.listings add column if not exists dpe_note         text;         -- mention quand il n'y a pas de lettre : « DPE vierge », « DPE ancienne version »…
alter table social.listings add column if not exists manual_status    text;         -- posé par Olivier dans l'onglet Annonces
alter table social.listings add column if not exists manual_status_at timestamptz;
alter table social.listings add column if not exists manual_note      text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'listings_manual_status_check') then
    alter table social.listings add constraint listings_manual_status_check
      check (manual_status is null or manual_status in ('sous_offre', 'vendu', 'loue', 'ne_plus_proposer'));
  end if;
end $$;

-- 2. Posts : raison du refus (lue par la routine avant chaque création) ----------------------------
alter table social.posts add column if not exists reject_category text;             -- photos | deja_fait | theme | visuel | video | texte | bien_indisponible | autre
alter table social.posts add column if not exists reject_reason   text;             -- précision libre
create index if not exists posts_listing_idx on social.posts (listing_id, created_at desc);

-- 3. Abonnés de chaque compte, un relevé par jour (collect-metrics) -------------------------------
create table if not exists social.account_stats (
  brand_id    uuid not null references social.brands (id),
  network     text not null,                                -- 'facebook' | 'instagram'
  day         date not null,
  followers   int,
  raw         jsonb,
  measured_at timestamptz not null default now(),
  primary key (brand_id, network, day)
);
alter table social.account_stats enable row level security;

-- 4. Jetons : une seule ligne par compte même sans marque (le renouvellement hebdomadaire en créait une par semaine)
--    NON PASSÉE le 12 novembre (voir l'en-tête). À passer à la main quand Olivier est devant l'écran.
delete from social.tokens t using social.tokens u
 where t.brand_id is null and u.brand_id is null and t.network = u.network and t.account_id is not distinct from u.account_id
   and t.updated_at < u.updated_at;
create unique index if not exists tokens_sans_marque_uniq on social.tokens (network, account_id) where brand_id is null;

-- 5. Règle des 30 jours, appliquée à chaque dépôt de brouillon --------------------------------------
-- a) Rattache le post à son bien quand la routine ne l'a pas fait : le numéro est lu dans le lien de la fiche
--    (text_fb ou features.listing_url). Sans ce rattachement, ni la règle ni le changement de photos ne marchent.
-- b) Refuse le dépôt si ce bien a déjà été proposé : dans les 30 jours (brouillon, programmé, publié) ou dans les
--    14 jours (refusé). Exception : un post d'événement (features.evenement = sous_offre | vendu | loue | baisse_prix).
-- c) Refuse le dépôt d'une annonce classique pour un bien marqué « ne plus proposer », vendu, loué ou sous offre.
create or replace function social.posts_regle_bien() returns trigger
language plpgsql set search_path = social, public as $$
declare
  ext  text;
  evt  text := coalesce(new.features ->> 'evenement', '');
  prev record;
  bien record;
begin
  if new.listing_id is null then
    ext := substring(coalesce(new.features ->> 'listing_url', '') || ' ' || coalesce(new.text_fb, '')
                     from 'amoinvest\.fr/(?:vente|location)/[^/[:space:]]+/[^/[:space:]]+/([0-9]+)-');
    if ext is not null then
      select id into new.listing_id from social.listings where source = 'site' and external_id = ext;
    end if;
  end if;

  if new.listing_id is null or new.status <> 'draft' then
    return new;
  end if;

  select manual_status, coalesce(reference, external_id) as ref into bien from social.listings where id = new.listing_id;
  if bien.manual_status = 'ne_plus_proposer' then
    raise exception 'Bien réf. % marqué « ne plus proposer » : choisissez un autre bien.', bien.ref;
  end if;
  if bien.manual_status in ('sous_offre', 'vendu', 'loue') and evt not in ('sous_offre', 'vendu', 'loue') then
    raise exception 'Bien réf. % marqué « % » : seule une annonce d''événement (features.evenement) est acceptée.', bien.ref, bien.manual_status;
  end if;

  if evt not in ('sous_offre', 'vendu', 'loue', 'baisse_prix') then
    select p.created_at, p.status into prev
      from social.posts p
     where p.listing_id = new.listing_id and p.brand_id = new.brand_id
       and coalesce(p.features ->> 'evenement', '') = ''
       and (   (p.status in ('draft', 'approved', 'published', 'partial') and p.created_at > now() - interval '30 days')
            or (p.status = 'rejected' and p.created_at > now() - interval '14 days'))
     order by p.created_at desc limit 1;
    if found then
      raise exception 'Bien réf. % déjà proposé le % (%) : choisissez un autre bien (règle des 30 jours).',
        bien.ref, to_char(prev.created_at at time zone 'Europe/Paris', 'DD/MM'), prev.status;
    end if;
  end if;
  return new;
end $$;

create or replace trigger posts_regle_bien before insert on social.posts
  for each row execute function social.posts_regle_bien();

-- 6. Rattrapage (13 nov., à passer quand le connecteur Supabase est de nouveau autorisé) : rattacher à leur bien les
--    anciens posts d'annonce déposés sans listing_id, pour que la règle des 30 jours et les refus passés comptent.
--    Constaté le 13 nov. : le studio d'Eyguières (réf. 307) et la maison de Mallemort (réf. 436), refusés les 11 et
--    12 nov., apparaissaient « présentables » faute de rattachement.
update social.posts p set listing_id = l.id
  from social.listings l
 where p.listing_id is null and l.source = 'site'
   and l.external_id = substring(coalesce(p.features ->> 'listing_url', '') || ' ' || coalesce(p.text_fb, '')
                                 from 'amoinvest\.fr/(?:vente|location)/[^/[:space:]]+/[^/[:space:]]+/([0-9]+)-');
