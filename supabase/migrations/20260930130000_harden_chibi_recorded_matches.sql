alter table public.chibi_riot_account_links
  add column if not exists game_name text,
  add column if not exists tag_line text,
  add column if not exists region text,
  add column if not exists verified_at timestamptz,
  add column if not exists verification_method text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists chibi_riot_account_links_puuid_uidx
  on public.chibi_riot_account_links (puuid);

create index if not exists chibi_riot_account_links_user_idx
  on public.chibi_riot_account_links (user_id);

alter table public.chibi_recorded_matches
  add column if not exists id uuid not null default gen_random_uuid(),
  add column if not exists riot_match_status text not null default 'waiting',
  add column if not exists riot_match_payload jsonb,
  add column if not exists uploaded_at timestamptz,
  add column if not exists reconciled_at timestamptz,
  add column if not exists schema_version integer not null default 1;

create unique index if not exists chibi_recorded_matches_id_uidx
  on public.chibi_recorded_matches (id);

create unique index if not exists chibi_recorded_matches_game_owner_uidx
  on public.chibi_recorded_matches (game_id, owner_puuid)
  where game_id is not null;

create index if not exists chibi_recorded_matches_user_created_idx
  on public.chibi_recorded_matches (user_id, created_at desc);

drop policy if exists chibi_links_select_own on public.chibi_riot_account_links;
create policy chibi_links_select_own
on public.chibi_riot_account_links
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists chibi_matches_select_own on public.chibi_recorded_matches;
create policy chibi_matches_select_own
on public.chibi_recorded_matches
for select
to authenticated
using ((select auth.uid()) = user_id);

grant select on public.chibi_riot_account_links, public.chibi_recorded_matches to authenticated;
