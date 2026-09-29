-- Dépôt d'un sujet à traiter (demande d'Olivier, 29 sept.) : nouveau type « sujet ». Passée le 29 sept. via le connecteur Supabase.
alter table social.inbox drop constraint if exists inbox_kind_check;
alter table social.inbox add constraint inbox_kind_check check (kind in ('info', 'match', 'enregistrement', 'bien', 'sujet'));
