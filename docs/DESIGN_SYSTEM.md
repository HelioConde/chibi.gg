# chibi.gg Design System

This document defines the UX/UI rules that new chibi.gg screens should follow.

## 1. Product hierarchy

Every dense screen should separate three layers:

1. **Data** — facts returned by Riot or stored by chibi.gg.
2. **Interpretation** — patterns inferred from the data.
3. **Recommendation** — one next action, not several competing CTAs.

Use explicit source badges when these layers appear together:
- `RIOT` for API facts;
- `CHIBI` for interpretation;
- primary action color only for the next recommended action.

## 2. Tokens

The canonical CSS tokens live in `src/styles.css` under `CHIBI UX SYSTEM v79`.

### Color roles

- `--chibi-bg`: app background.
- `--chibi-surface`: primary card surface.
- `--chibi-surface-2`: raised/secondary surface.
- `--chibi-border`: default component border.
- `--chibi-text`: primary readable text.
- `--chibi-text-2`: secondary text.
- `--chibi-text-3`: supporting metadata.
- `--chibi-primary`: the single primary CTA color.
- `--chibi-success`: positive state.
- `--chibi-warning`: caution state.
- `--chibi-risk`: risk/error state.
- `--chibi-info`: informational/source accent.

Do not use status color as the only carrier of meaning. Pair it with text, icons, numbers or labels.

## 3. Typography

Use a stable hierarchy instead of ad-hoc pixel values:

- page title: `--chibi-type-page`
- section title: `--chibi-type-section`
- card title: `--chibi-type-card`
- labels: `--chibi-type-label`
- body: `--chibi-type-body`
- support: `--chibi-type-sm`
- micro metadata: `--chibi-type-xs`

Avoid uppercase for sentences. Reserve uppercase for short labels such as `RIOT`, `CHIBI`, `FILA`, `SET`, `RESULTADO`.

## 4. Cards

Cards should have one of these roles:

- **informational**: no hover elevation and no misleading click affordance;
- **interactive**: whole card or one obvious control is actionable;
- **selected**: use `.is-selected`;
- **loading**: use a skeleton shaped like the final content;
- **empty/error**: explain what happened and provide recovery when possible.

Use `--chibi-radius-md` and `--chibi-border` by default. Strong gradients are reserved for the primary action or hero-level emphasis.

## 5. Buttons

- One primary CTA per decision block.
- Secondary actions use quiet borders/backgrounds.
- Mobile targets should be at least 44 px high.
- Icon-only controls require an accessible label and tooltip/title where useful.
- All keyboard-focusable controls must retain visible `:focus-visible`.

## 6. History

Default history density is **Compact**.

A collapsed match should reveal:
- placement;
- stage;
- gold;
- level;
- one Chibi insight.

Detailed board, units and items open on demand.

The history toolbar groups controls by:
- Set;
- Queue;
- Result;
- Visual density;
- Sort order.

Persist density and sort preferences locally.

## 7. Data source language

Use wording that keeps certainty honest:

- API fact: “Riot data”, “final snapshot”, “observed”.
- Estimated value: “estimated”, with tooltip/limitation.
- Pattern: “observed impact”, “associated with”, “in this sample”.
- Avoid deterministic wording when the sample is small.

## 8. Navigation

Desktop navigation and profile tabs remain accessible during long scrolls.

The current page/tab must have a visible selected state that is not color-only.

Modals and drawers must:
- close with Escape;
- avoid stacking another modal on top;
- restore a predictable return path.

## 9. Responsive behavior

Target these widths explicitly:
- 320 px
- 375 px
- 430 px
- tablet
- desktop

Mobile rules:
- metrics prefer two columns;
- wide tables become stacked cards;
- filters wrap instead of forcing page overflow;
- long copy wraps rather than shrinking below readable size;
- hover must never be the only way to discover information.

## 10. Accessibility

- Respect `prefers-reduced-motion`.
- Respect `prefers-contrast: more`.
- Maintain visible keyboard focus.
- Do not encode results only by red/green.
- Loading/error regions should use live-region semantics when state changes matter.
- Decorative art should be `aria-hidden`.

## 11. Review checklist

Before shipping a UI change, verify:

- Is there only one obvious primary action?
- Can the user tell Riot facts from Chibi inference?
- Is supporting text readable at normal zoom?
- Does the screen work at 320/375/430 px?
- Can keyboard users reach and understand every action?
- Does reduced motion remain usable?
- Are empty, loading and error states present?
- Does a dense block have a compact view?
- Are estimates and small-sample limitations explained?
- Does the UI preserve context when users open and close details?
