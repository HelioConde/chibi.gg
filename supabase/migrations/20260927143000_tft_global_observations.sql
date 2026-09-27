create table if not exists public.tft_participant_observations (
  match_id text not null,
  placement smallint not null check (placement between 1 and 8),
  played_at bigint,
  queue_id integer,
  set_number integer,
  set_name text,
  game_version text,
  level smallint,
  gold_left integer,
  damage_to_players integer,
  players_eliminated integer,
  augments jsonb not null default '[]'::jsonb,
  traits jsonb not null default '[]'::jsonb,
  units jsonb not null default '[]'::jsonb,
  observed_at timestamptz not null default now(),
  primary key (match_id, placement)
);

alter table public.tft_participant_observations enable row level security;

revoke all on public.tft_participant_observations from anon, authenticated;

create index if not exists tft_obs_set_queue_idx
  on public.tft_participant_observations (set_number, queue_id);

create index if not exists tft_obs_version_idx
  on public.tft_participant_observations (game_version);

create index if not exists tft_obs_played_idx
  on public.tft_participant_observations (played_at desc);

create or replace view public.tft_trait_global_stats
with (security_invoker = false)
as
select
  o.set_number,
  o.queue_id,
  (trait->>'name')::text as trait_id,
  count(*)::bigint as games,
  round(avg(o.placement)::numeric, 2) as avg_placement,
  round((100.0 * avg(case when o.placement <= 4 then 1 else 0 end))::numeric, 1) as top4_rate,
  round((100.0 * avg(case when o.placement = 1 then 1 else 0 end))::numeric, 1) as win_rate,
  round(avg(o.level)::numeric, 2) as avg_level
from public.tft_participant_observations o
cross join lateral jsonb_array_elements(o.traits) trait
where
  coalesce((trait->>'numUnits')::integer, 0) > 0
  and (
    coalesce((trait->>'style')::integer, 0) > 0
    or coalesce((trait->>'numUnits')::integer, 0) >= 2
  )
group by o.set_number, o.queue_id, trait->>'name';

revoke all on public.tft_trait_global_stats from anon, authenticated;
