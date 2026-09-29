# Riot Production Application — preserved draft

Last updated: 2026-09-29

> Keep the exact submitted wording and screenshots after submission. Overwolf requested a screenshot of Riot's approval **including the app description submitted to Riot**.

## Product identity

- **Product name:** Chibi.gg
- **Game:** Teamfight Tactics
- **Product type:** Public web companion + optional desktop/Overwolf companion
- **Public prototype:** https://helioconde.github.io/chibi.gg/
- **Verification file:** https://helioconde.github.io/chibi.gg/riot.txt
- **Repository:** https://github.com/HelioConde/chibi.gg
- **How it works:** https://helioconde.github.io/chibi.gg/about.html
- **Privacy:** https://helioconde.github.io/chibi.gg/privacy.html
- **Terms:** https://helioconde.github.io/chibi.gg/terms.html

## Proposed production description

Use this as the canonical long-form description unless a Riot form field forces a shorter version:

> Chibi.gg is a public Teamfight Tactics companion focused on helping players understand and improve their own gameplay over time. The product provides player profiles, match history, visual board reconstruction, composition history, performance trends, and post-match coaching based on data available from Riot's supported TFT services.
>
> The current prototype demonstrates the profile and review flow with Riot ID lookup. For production self-player statistics and history, Chibi.gg plans to integrate Riot Sign On (RSO) after the production application is approved and Riot provides the RSO onboarding flow.
>
> Chibi.gg also provides aggregate statistics built from anonymized match observations collected when matches are consulted through the product. These aggregate views show sample size and confidence and do not claim to represent the entire TFT population or an official Riot tier list.
>
> Chibi.gg is designed as a review-first training tool. It does not provide opponent scouting, track opponents' boards during gameplay, predict opponents' next actions, or dynamically recommend purchases, rerolls, leveling, positioning, or other gameplay decisions based on the current live game state. It does not create an alternative MMR/ELO system.
>
> An optional Companion/Overwolf experience is under development. Any in-game information intended for release will be limited to static information available before the game or other functionality explicitly approved under Riot/Overwolf policies. Any permitted telemetry, if approved, will be used primarily to record context for post-match review rather than to prescribe immediate gameplay actions.
>
> Riot API keys and server credentials are kept in backend functions and are not exposed in the public frontend. Chibi.gg will keep a free tier and any future monetization will follow Riot Games policies. The Overwolf version will use Overwolf-approved monetization systems where applicable.

## Short description

If the form provides a shorter field:

> Public TFT companion for self-history, post-match review, aggregate observed stats and evidence-first coaching. Chibi.gg does not provide opponent scouting, dynamic live recommendations, gameplay automation or alternate MMR/ELO. Production self-history is planned to use Riot Sign On after approval.

## User flow to describe to Riot

1. User opens Chibi.gg.
2. Prototype: user enters a Riot ID and region to demonstrate the product.
3. Chibi loads TFT profile/rank and recent match history through server-side Riot API calls.
4. The player sees match history first, then evidence-first review/coach tools.
5. Match review shows the final board snapshot and comparisons supported by the available Match API data.
6. Ask Chibi points responses back to the matches/sample used and shows data limitations.
7. Aggregate Meta/Comps/Statistics use the Chibi Dataset and always show sample/confidence context.
8. For production self-history, the player is expected to authorize through RSO after Riot enables RSO onboarding for the approved application.
9. Companion functionality remains review-first; live decision prescriptions/opponent scouting are out of scope.

## Data/API services currently used

- Riot Account API (`account-v1`) for Riot ID resolution.
- TFT Summoner API (`tft-summoner-v1`) for profile details.
- TFT League API (`tft-league-v1`) for official ranked data.
- TFT Match API (`tft-match-v1`) for match IDs/details and post-match history.
- TFT Status API (`tft-status-v1`) for service status.
- Riot/Data Dragon TFT static assets for names/images/static content.
- Supabase Edge Functions as the server-side API layer/cache.

## Important data limitations

The Match API is treated primarily as a final-state/post-match source. Chibi.gg does **not** claim to know, unless an approved source explicitly provides it:

- exact shop sequence;
- exact roll timing;
- exact level-up timing;
- HP trajectory by round;
- scouting decisions;
- historical positioning round-by-round;
- causal reason a match was won or lost.

## RSO note for the reviewer

Current TFT documentation lists self-player statistics and training tools showing a player's own history as production use cases requiring RSO. Riot's documentation also states that RSO client access is made available after a Production application is approved.

Chibi.gg therefore keeps the current Riot-ID flow as a testable prototype and has a prepared RSO migration plan in `docs/RSO_PLAN.md`.

## Monetization

Current prototype is free.

Planned direction:

- free tier remains available;
- paid/advertising features must be transformative and policy compliant;
- no betting/gambling;
- no pay-to-win gameplay advantage;
- Overwolf release uses approved Overwolf monetization where applicable.

Do not add a payment claim to the Riot form unless the actual launch plan is confirmed.

## Screenshots to preserve after form submission

Keep screenshots showing:

- product name;
- full submitted description;
- public product URL;
- game selected as Teamfight Tactics;
- verification status;
- any Riot reviewer messages;
- final Production approval/status.

These screenshots are also needed for the Overwolf follow-up.
