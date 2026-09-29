# Riot Production Review — readiness checklist

Last updated: 2026-09-29

This checklist tracks the public-facing state of chibi.gg while the Riot production application is pending.

## Product URL

- Public URL: https://helioconde.github.io/chibi.gg/
- Riot verification file: `/riot.txt`
- Product focus: Teamfight Tactics

## Public product flow

- [x] Riot ID search works without requiring account creation.
- [x] Profile, rank and recent match history are visible.
- [x] Match Review is post-game and evidence-first.
- [x] Chibi Dataset is labeled as observed data, not the entire TFT population.
- [x] Small samples use cautious language.
- [x] Comps separates personal familiarity from global observed signals.
- [x] Ask Chibi exposes sample, confidence/evidence and data limitations.

## Public policy pages

- [x] How Chibi Works (`#about`)
- [x] Privacy (`#privacy`)
- [x] Terms (`#terms`)
- [x] Riot Developer legal boilerplate visible in the site footer.
- [x] Legal Jibber Jabber non-endorsement notice visible on information pages.
- [x] Official Riot policy links are available from the information pages.

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

1. Open the production URL in a clean browser session.
2. Search a valid Riot ID and verify profile/history flow.
3. Open Chibi Review and one match detail.
4. Open Comps and confirm sample/confidence labels.
5. Open Ask Chibi and verify evidence base/limits.
6. Open How It Works, Privacy and Terms from the footer.
7. Confirm the Riot boilerplate is visible.
8. Confirm `/riot.txt` is still publicly reachable.
9. Take screenshots of the submitted description and any approval response for the Overwolf follow-up.

## Official references

- Riot Developer General Policies: https://developer.riotgames.com/policies/general
- Riot Legal Jibber Jabber: https://www.riotgames.com/en/legal
