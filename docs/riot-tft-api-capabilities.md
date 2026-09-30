# Riot TFT API capabilities

Checked 2026-09-30 against the [Riot TFT developer documentation](https://developer.riotgames.com/docs/tft) and the [API catalogue](https://developer.riotgames.com/apis). Riot keys are server-only: the documentation explicitly prohibits including an API key in distributed code.

| Field | Official API | Local telemetry | Final source |
|---|---|---|---|
| Match id / duration / queue / set / version | `tft-match-v1` match metadata | LCU/checkpoint best effort | Riot Match after game |
| Placement / final level / final gold / last round | `tft-match-v1` participant | Vision/checkpoint | Riot Match after game |
| Final units, stars, items, augments, traits | `tft-match-v1` participant | local checkpoint | Riot Match after game |
| Player identity / PUUID | `account-v1`; `tft-summoner-v1` needs RSO | LCU | linked Riot identity / LCU locally |
| Ranked entries | `tft-league-v1` | none | Riot API |
| Service availability | `tft-status-v1` | none | Riot API |
| Current-game session metadata | `spectator-tft-v5`, if access/schema permits | LCU/heartbeat | optional, never required |
| Gold, level, round timeline, purchases, rerolls | not a match-history timeline | Vision/log/input | local Chibi recording |

`tft-match-v1` uses regional routing (for example `americas` for BR1) and exposes match-id lookup plus match-id lists by PUUID. Current-game data must not be used for opponent scouting or persisted for opponents. The recorder therefore stores only its owner PUUID's local state. `spectator-tft-v5` is treated as optional metadata: its response must be feature-detected by the server; no assumed board, gold, unit or opponent fields are consumed.

Development keys are for small/personal testing; production keys and RSO require Riot approval. The backend must respect response headers, `429` and `Retry-After`; it uses delayed reconciliation rather than aggressive polling.
