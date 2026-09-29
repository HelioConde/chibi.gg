# Chibi.gg — Riot API data foundation

This document describes the player-facing data flow used by the public Chibi.gg TFT product.

## Riot APIs used

### account-v1
Used to resolve a Riot ID (`gameName#tagLine`) to a PUUID.

### tft-summoner-v1
Used for TFT summoner/profile information where available.

### tft-league-v1
Used for official TFT ranked entries, LP, wins and losses.

### tft-match-v1
Used for match IDs and post-match match details. Chibi normalizes the current player's placement, final level, remaining gold, last round, damage, traits, units, items and the player's own recorded augments.

### tft-status-v1
Used only to display/check TFT platform service status.

## Security

The Riot API key is read only from the Supabase Edge Function environment as `RIOT_API_KEY`.
It must never be committed to GitHub or exposed in browser JavaScript.

Browser:
```
chibi.gg -> Supabase Edge Function -> Riot API
```

Never:
```
chibi.gg -> Riot API with a bundled API key
```

## Public statistics guardrails

Global Chibi Dataset statistics are limited to champions, traits, items and final-board composition signals.

Augments can appear in a player's own post-match record because they are part of that player's match history, but Chibi does not publish global augment win-rate, average-placement, tier-list or recommendation statistics.

## Live data

The Riot API pipeline is post-match/profile data.

Future Overwolf GEP integration is a separate provider and must remain behind Riot + Overwolf approval. Live telemetry must not become opponent scouting or dynamic instructions such as what to buy, sell, reroll, level or reposition.

## Current profile request

A first profile request performs:

1. Riot ID -> PUUID through account-v1
2. TFT profile through tft-summoner-v1
3. official ranked data through tft-league-v1
4. up to 20 recent match IDs through tft-match-v1
5. up to 20 post-match detail requests through tft-match-v1

Additional history is loaded in pages of up to 20 matches.
