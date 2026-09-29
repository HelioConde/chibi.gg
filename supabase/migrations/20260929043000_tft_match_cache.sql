create table if not exists public.tft_match_cache (
  match_id text primary key,
  region text not null,
  played_at bigint,
  queue_id integer,
  set_number integer,
  game_version text,
  payload jsonb not null,
  cached_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tft_match_cache enable row level security;

revoke all on public.tft_match_cache from anon, authenticated;

create index if not exists tft_match_cache_played_idx
  on public.tft_match_cache (played_at desc);

create index if not exists tft_match_cache_set_queue_idx
  on public.tft_match_cache (set_number, queue_id);
