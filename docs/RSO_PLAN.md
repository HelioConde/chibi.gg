# Riot Sign On (RSO) — production transition plan

Last updated: 2026-09-29

## Why this exists

Riot's current TFT documentation lists the following Production use cases as requiring RSO:

- showing **self** player stats;
- training tools that let players view their own match history and aggregate stats;
- static-data game overlays.

RSO client access is only available after a Production application is approved. Therefore Chibi.gg should prepare the architecture now but **must not invent client IDs, secrets, redirect URIs or scopes** before Riot provisions them.

## Current prototype

Today the public prototype:

1. accepts `Nome#TAG` + region;
2. resolves the Riot account server-side;
3. loads profile/rank/history through Supabase Edge Functions;
4. renders post-match review and aggregate features.

This is useful for Riot to test the product flow before RSO credentials exist.

## Production target

After Riot approval, split data flows into two categories.

### A. Self-history / personal coaching

Use RSO to identify the signed-in Riot account.

Personal areas include:

- own profile/rank;
- own match history;
- Chibi Review;
- Ask Chibi personal questions;
- Journal / Lessons / Sessions;
- personal-vs-global comparisons;
- Companion profile binding.

### B. Aggregate/public product data

Keep separate from the player's RSO session where policy permits:

- aggregate Chibi Dataset;
- current-set Meta;
- aggregate Comps;
- aggregate Statistics;
- official ladder Leaderboard;
- static Team Builder/reference content.

## Proposed server-side flow

Do not implement until Riot provides the approved client configuration.

1. Frontend calls a backend `rso-start` endpoint.
2. Backend creates a cryptographically random `state` value and an expiring login attempt record.
3. Backend returns/redirects to the exact Riot authorization URL/scopes provided for the approved RSO client.
4. Riot redirects to a backend `rso-callback` endpoint.
5. Backend validates `state` before exchanging the authorization code.
6. Backend exchanges the code using the client authentication method Riot provisions.
7. Riot access/refresh credentials stay **server-side only**.
8. Backend calls `/riot/account/v1/accounts/me` with the RSO access token to identify the account/PUUID.
9. Backend creates an opaque Chibi application session.
10. Callback redirects to the static GitHub Pages frontend using a short-lived **one-time bootstrap code**, never the Riot access/refresh token.
11. Frontend exchanges the bootstrap code for the Chibi session representation.
12. Personal endpoints resolve the authenticated PUUID from the server session rather than accepting an arbitrary PUUID from the browser.

## Suggested Supabase pieces

Edge Functions after approval:

- `rso-start`
- `rso-callback`
- `rso-bootstrap`
- `rso-session`
- `rso-disconnect`
- `my-tft-profile`
- `my-tft-history`
- `my-tft-match`

Tables after approval:

### `riot_rso_login_attempts`

- hashed/opaque state identifier;
- created_at;
- expires_at;
- used_at;
- optional return path.

### `riot_rso_accounts`

- internal account id;
- PUUID or a server-side derived identifier as needed for API access;
- created_at;
- updated_at.

Do **not** add Riot access tokens to browser-readable tables.

### `riot_rso_credentials`

If long-lived credentials are required by the provisioned RSO mode:

- server-only access;
- encrypted at rest using a server-side key/secret;
- access token metadata;
- refresh token metadata;
- expiration timestamps;
- rotation/revocation timestamps.

Implementation details must follow Riot's exact onboarding instructions.

### `chibi_sessions`

- opaque session id/hash;
- internal Riot account reference;
- created_at;
- expires_at;
- revoked_at;
- last_seen_at.

## Browser session rules

Preferred properties:

- browser never sees Riot client secret;
- browser never receives Riot refresh token;
- avoid putting reusable credentials in URL query strings;
- bootstrap codes are one-time and short-lived;
- session can be revoked independently of Riot credentials;
- logout/disconnect clears the Chibi session and follows Riot revocation instructions if provided.

Because the frontend is hosted on GitHub Pages and backend is on Supabase, cookie behavior/CORS must be tested under the final production domains. If secure cross-site cookie behavior is unsuitable, use a short-lived Chibi session token designed for the frontend — **not a Riot token**.

## Migration of the current UI

### Landing

Before approval:
- Riot ID search remains the prototype flow.
- UI says the product is a prototype and RSO is planned after approval.

After RSO:
- primary CTA becomes **Connect Riot Account** for personal review;
- aggregate Meta/Comps/Statistics can remain separately navigable if allowed;
- direct Riot ID lookup must be kept/removed/scoped according to Riot's final review instructions.

### Profile URLs

Current profile links contain player/tag/region. After RSO:

- do not use URL parameters as authorization;
- URL can identify a view, but backend decides whether signed-in user may access personal data;
- shared study links must be re-reviewed so they do not expose personal data beyond the approved model.

## Privacy updates required at RSO launch

Update Privacy Policy before enabling RSO to describe:

- what Riot account identifiers are stored;
- whether access/refresh credentials are retained;
- retention period;
- logout/disconnect behavior;
- revocation/deletion procedure;
- session cookies/tokens;
- scopes requested;
- purpose of each scope;
- any public/private profile behavior.

## Test plan after Riot provisions RSO

1. Start login from clean browser.
2. Cancel login and confirm no session is created.
3. Complete login and confirm `accounts/me` binds correct Riot account.
4. Tamper with `state`; callback must fail.
5. Reuse callback/bootstrap code; second use must fail.
6. Ensure frontend bundle contains no client secret, Riot API key, refresh token or Supabase service role.
7. Verify logout/disconnect invalidates Chibi session.
8. Test expired access token behavior.
9. Test refresh flow only if Riot's provisioned client supports/requires it.
10. Test region routing for TFT APIs after account identification.
11. Re-run profile/history/review/Ask Chibi.
12. Re-check Privacy/Terms/How It Works wording.

## Do not do before approval

- Do not invent an RSO client ID.
- Do not commit a client secret.
- Do not guess callback URLs accepted by Riot.
- Do not request undocumented scopes.
- Do not expose Riot access or refresh tokens to the SPA.
- Do not remove the working prototype before Riot can review the user flow.
