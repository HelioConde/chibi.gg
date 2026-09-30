create table if not exists public.chibi_riot_account_links (
  user_id uuid not null references auth.users(id) on delete cascade,
  puuid text not null,
  linked_at timestamptz not null default now(),
  primary key (user_id, puuid)
);

create table if not exists public.chibi_recorded_matches (
  session_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  owner_puuid text not null,
  game_id text,
  status text not null check (status in ('waiting_riot_match','reconciled')),
  quality jsonb not null default '{}'::jsonb,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, session_id)
);

alter table public.chibi_riot_account_links enable row level security;
alter table public.chibi_recorded_matches enable row level security;
revoke all on public.chibi_riot_account_links, public.chibi_recorded_matches from anon, authenticated;
create index if not exists chibi_recorded_matches_game_owner_idx on public.chibi_recorded_matches (game_id, owner_puuid);
