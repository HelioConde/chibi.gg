# Riot Production Review — readiness checklist

Last updated: 2026-09-29

This checklist tracks the public-facing state of chibi.gg while the Riot production application is pending.

## Product URL

- Public URL: https://helioconde.github.io/chibi.gg/
- Reviewer entry point: https://helioconde.github.io/chibi.gg/review.html
- Riot verification file: `/riot.txt`
- Product focus: Teamfight Tactics

## Public product flow

- [x] Synthetic reviewer mode is available at `/?demo=review` and clearly labels all player/match data as fictitious.

- [x] Prototype Riot ID search demonstrates the profile/review flow.
- [x] Public site explains that self-history production flow is expected to transition to Riot Sign On after production approval.
- [x] Profile, rank and recent match history are visible.
- [x] Match Review is post-game and evidence-first.
- [x] Chibi Dataset is labeled as observed data, not the entire TFT population.
- [x] Small samples use cautious language.
- [x] Comps separates personal familiarity from global observed signals.
- [x] Ask Chibi exposes sample, confidence/evidence and data limitations.
- [x] Companion page explicitly labels current telemetry/snapshots as a demo/local prototype.
- [x] Companion demo does not expose a live board score or pseudo competitive rating.

## Public policy pages

- [x] How Chibi Works in the SPA (`#about`) and direct static URL (`/about.html`).
- [x] Privacy in the SPA (`#privacy`) and direct static URL (`/privacy.html`).
- [x] Terms in the SPA (`#terms`) and direct static URL (`/terms.html`).
- [x] Riot Developer legal boilerplate visible in the site footer.
- [x] Legal Jibber Jabber non-endorsement notice visible on information pages.
- [x] Official Riot policy links are available from the information pages.

## Riot Sign On readiness

Current Riot TFT documentation lists self player stats and training tools that show a player's own match history as production use cases requiring RSO integration. RSO client access is only available after a production application is approved.

Before final production launch:

- [ ] Receive Production API key approval.
- [ ] Follow Riot's RSO onboarding instructions for the approved application.
- [ ] Add backend OAuth callback/token exchange; never expose an RSO client secret in the browser.
- [ ] Use `/riot/account/v1/accounts/me` to bind the signed-in Riot account.
- [ ] Update Privacy/Terms with token/session retention and revocation details.
- [ ] Decide which existing direct Riot-ID profile flows remain public after Riot review and which self-history features require the signed-in account.
- [ ] Re-test all profile, history, Study and Companion flows under the approved access model.

## Gameplay integrity

The public product must not be changed to provide:

- opponent scouting during a live match;
- live opponent-board tracking used for recommendations;
- automated buy/sell/reroll/level/positioning decisions;
- an alternative MMR/ELO intended to replace Riot ranking;
- claims about shops, exact roll timing, HP trajectory, scouting or historical positioning when the current data source does not provide them.

## Data/security

- [x] Riot API key is server-side only.
- [x] Supabase service role is server-side only.
- [x] Match cache reduces repeated Riot detail requests.
- [x] Privacy page distinguishes technical cache from the anonymized global observation table.
- [x] Local browser features are documented as localStorage-backed.
- [x] Global observation rows do not store Riot ID, player name or PUUID.

## Before responding to Riot

1. Open `/review.html` in a clean browser session and confirm every reviewer resource is reachable.
2. Open the normal production URL.
3. Open `/?demo=review` and verify the full synthetic review flow works without a Riot API call.
4. Search a valid Riot ID and verify the real profile/history flow when the temporary key is available.
5. Open Chibi Review and one match detail.
6. Open Comps and confirm sample/confidence labels.
7. Open Ask Chibi and verify evidence base/limits.
8. Open How It Works, Privacy and Terms from the footer and also test the direct `.html` URLs.
9. Confirm the Riot boilerplate is visible.
10. Confirm `/riot.txt` is still publicly reachable.
11. Take screenshots of the submitted description and any approval response for the Overwolf follow-up.
12. If Riot instructs RSO integration, preserve the app message/instructions together with the approval screenshot.

## Official references

- Riot Developer General Policies: https://developer.riotgames.com/policies/general
- Riot Legal Jibber Jabber: https://www.riotgames.com/en/legal
