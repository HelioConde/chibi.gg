# chibi.gg — Product Strategy

## Positioning

chibi.gg is not trying to win by having the largest raw TFT statistics table.

The product goal is:

> Turn a player's recent TFT history into understandable, evidence-based coaching.

Existing TFT products are very strong at:
- meta comps;
- augment/item/unit statistics;
- leaderboards;
- large population datasets;
- in-game overlays;
- raw match history.

chibi.gg should be strongest at:
- personal explanation;
- recent-form diagnosis;
- player-specific patterns;
- "what changed?" between sessions;
- evidence behind each insight;
- learning without forcing a comp.

## Product promise

A player enters:

`GameName#TAG`

Without creating an account, chibi.gg should answer:

1. How am I doing?
2. What kind of TFT player am I right now?
3. What patterns appear in my best games?
4. What patterns appear in my worst games?
5. What changed recently?
6. What should I investigate next?

The site should never pretend to know information that is not present in Riot match data.

---

## Competitive landscape

### tactics.tools

Strengths:
- deep statistical exploration;
- strong player pages;
- comps, units, items, traits;
- advanced filters;
- trusted by high-level players.

Opportunity for chibi.gg:
- less statistical literacy required;
- explain results in natural language;
- surface the three most important player-specific findings automatically;
- make evidence one click away.

### MetaTFT

Strengths:
- broad TFT feature set;
- comps and data explorer;
- match history;
- desktop app / overlay;
- advanced round-by-round information when the app is running;
- pro data and VOD discovery.

Opportunity for chibi.gg:
- browser-first and instant;
- no Overwolf dependency;
- focus on learning from the player's own history;
- avoid pushing the user toward blindly forcing a meta comp.

### LoLChess / simple trackers

Strengths:
- easy Riot ID lookup;
- simple history;
- familiar presentation.

Opportunity for chibi.gg:
- keep the same low-friction lookup;
- add a much deeper interpretation layer.

---

## Core moat: Chibi DNA

Chibi DNA is the central product, not a decorative score.

It must be based on visible evidence from the matches currently loaded.

Initial dimensions:

### Consistency
How volatile are recent placements?

Input:
- recent placements.

Output:
- descriptive stability indicator;
- trend in placement variance.

### Flexibility
How diverse are the player's recurring lines?

Input:
- active final traits;
- recurring board identities.

Important:
- this is not a claim about in-game decision quality;
- it only describes final-board diversity.

### Conversion
When the player reaches Top 4, how often do they turn it into a first?

Input:
- placement history.

### Stability
How often does the player avoid 7th/8th?

Input:
- placement history.

### Recent form
Compare:
- latest 6 games;
- previous 6 games.

Never label a player as "good" or "bad".
Describe the direction of the sample.

---

## Evidence-first insights

Every Chibi insight needs four parts:

1. Finding
2. Explanation
3. Evidence
4. Confidence

Example:

> Your games with a 3-star unit finished better in this sample.

Evidence:
- with 3-star: 3.40 average;
- without 3-star: 5.10 average;
- 5 vs 7 games.

Confidence:
- medium.

The UI must explicitly communicate:
- association is not causation;
- the sample can be small;
- more loaded matches improve confidence.

---

## Player review modes

### 1. Snapshot

Immediate answer:
- rank;
- average placement;
- Top 4;
- firsts;
- bottom 2;
- placement strip;
- Chibi DNA.

### 2. Match review

Each match should show:
- placement;
- final board;
- champion portraits;
- star levels;
- items;
- active traits;
- augments;
- final level;
- gold left;
- damage dealt;
- set / patch;
- time played.

Clicking opens full lobby context.

### 3. Pattern review

Cross-match comparisons:
- Top 4 vs Bottom 4;
- firsts vs Bottom 2;
- games with 3-stars vs without;
- level distributions;
- recurring traits;
- augment recurrence;
- item recurrence;
- board diversity.

### 4. Progress review

Once enough history exists:
- current 10/20 games vs previous 10/20;
- patch-to-patch comparisons;
- session-to-session changes;
- strongest improvement;
- biggest regression.

---

## What not to fake with Riot API data

The standard public TFT match API provides final match information, not a complete round-by-round replay.

Do not claim to know from the public API alone:
- exact gold at Stage 3;
- roll timing per round;
- exact level-up timing;
- board transitions each stage;
- HP trajectory by round;
- positioning changes;
- shop decisions;
- scouting behavior.

Those require a separate client/overlay or another explicitly permitted data source.

chibi.gg can later add an optional desktop companion, but the website must remain useful without it.

---

## Chibi Review

Longer-term differentiator:

After a player loads enough games, generate a review such as:

### What is working
- recurring board identities with strong placement;
- consistent Top 4 lines;
- successful high-level boards;
- stable recent sessions.

### What is hurting
- repeated Bottom 2 patterns;
- final boards that repeatedly fail to convert;
- overly narrow line diversity;
- weak conversion after reaching Top 4.

### What changed
- placement trend;
- line diversity;
- level distribution;
- 3-star dependency;
- first / Bottom 2 frequency.

This should be written in plain Portuguese and backed by visible match evidence.

---

## Chibi vs generic tier-list products

Avoid making the primary home experience:

"Here are the S-tier comps. Force these."

Instead:

"The meta says X. Your history says Y."

Future meta integration should support questions such as:

- Which strong meta comps overlap with the units/traits I already perform well with?
- Which comps fit my recent item/board tendencies?
- Where does my personal result differ from global population performance?

This creates a bridge between global meta data and personal history.

---

## UX principles

### Search first
No registration before value.

### Explain before expanding
Show the finding first.
Detailed stats live underneath.

### Visual TFT language
Use:
- champion portraits;
- item icons;
- trait icons;
- stars;
- placement colors;
- augment art.

Avoid:
- generic SaaS analytics cards as the dominant interface.

### Evidence is always reachable
Every recommendation should answer:
"Why is Chibi telling me this?"

### Confidence matters
Small samples should look and read differently from strong signals.

---

## Accounts

Account creation should remain optional for public profile lookup.

Ask for account creation only when the user wants:
- favorites;
- saved players;
- long-term progress history;
- alerts;
- comparisons;
- personalized reports;
- optional desktop companion.

---

## Roadmap

### Phase 1 — Real player tracker
- Riot ID lookup
- rank
- official match history
- TFT assets
- match details
- pagination
- Chibi DNA
- evidence-based insights

### Phase 2 — Personal analysis
- Top 4 vs Bottom 4 comparisons
- recurring trait performance
- unit / item / augment recurrence
- patch filtering
- sessions
- stronger confidence model
- shareable Chibi Review

### Phase 3 — Meta + personal fit
- current patch meta
- comp explorer
- personal-fit layer
- "global performance vs your performance"
- recommended lines to study, not blindly force

### Phase 4 — Progress
- cached historical snapshots
- week-over-week changes
- patch-over-patch changes
- goals
- review history

### Phase 5 — Optional companion
Only if Riot policy and product value justify it:
- explicitly opt-in desktop companion;
- richer round-level history;
- board transitions;
- economy/HP timeline;
- positioning review.

The web product must not depend on this phase to be useful.

---

## Success metric

The most important early metric is not page views.

It is:

> After looking at a profile, did the player discover something about their own TFT play that they did not know before?

Secondary:
- profile searches per returning user;
- matches expanded;
- "load more" usage;
- Chibi Review shares;
- return after playing more games.

---

## Product test

If a feature can be copied by showing another global table, it is probably not the Chibi moat.

If a feature becomes more valuable specifically because we know the player's own history, it probably belongs in chibi.gg.
