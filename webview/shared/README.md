# AXIS shared webview design system (`ax-*`)

Vanilla TS + CSS layers used by the chart webview (lightweight core). No framework. Class
names on builders are the frozen contract with `components.css`. (No studio webviews.)

## Layers (import order)

| File | Role |
|------|------|
| `tokens.css` | `--axis-*` semantic tokens (VS Code vars first, AXIS hex fallbacks last) |
| `theme.css` | Reset, body type, single `:focus-visible`, scrollbars, high-contrast |
| `motion.css` | Keyframes, chrome transitions, reduced-motion guard |
| `components.css` | All `.ax-*` rules |

Chart (and any minimal) import via `@axis-shared/…` (see `vite.ts` in chart). Chart primarily imports
`tokens.css` so canvas chrome tracks tokens without full studio chrome tax. (Shared still provides full for future minimal use.)

## Builders (`components.ts`)

| Builder | Class | Purpose |
|---------|-------|---------|
| `panel` | `ax-panel` | Elevated surface (+ `ax-panel--in` entrance) |
| `header` | `ax-header` | Sticky title + optional count pill |
| `tabs` | `ax-tabs` | Underline tab bar (keyboard arrows) |
| `row` | `ax-row` | List row + optional hover actions/scrim |
| `chip` | `ax-chip` | Pill filter / toggle (`aria-pressed`) |
| `kpi` | `ax-kpi` | Stat tile; optional `tone` on value |
| `capsule` | `ax-capsule` | Mono status capsule |
| `statusDot` | `ax-status-dot` | Dot + label (`idle/ok/warn/err/live`) |
| `search` | `ax-search` | Search input (focus ring contract) |
| `field` | `ax-field` | Labeled input (+ mono / invalid) |
| `kbd` | `ax-kbd` | Keyboard hint chip |
| `empty` | `ax-empty` | Empty state (`title` + `hint` + action) |
| `flash` | `ax-flash` | Tick flash up/down |
| `bar` | `ax-bar` | Profiler multi-segment bar |
| `swatch` | `ax-swatch` | Color-literal chip |
| `glyph` | `ax-glyph` | Symbol grid cell |
| `btn` | `ax-btn` | `primary` / `secondary` / `ghost` / `danger` · `sm`/`md` |
| `toolbar` | `ax-toolbar` | Compact chrome strip |
| `badge` | `ax-badge` | Semantic pill (`neutral` + tones) |
| `sectionTitle` | `ax-section-title` | Uppercase section label |
| `loading` | `ax-loading` | Indeterminate status |
| `codeBlock` | `ax-code` | Mono dump block |
| `cluster` | `ax-cluster` | Flex-wrap gap helper |

## Storybook

(Storybook + stories/ removed with bloat in lightweight core simplification; design system still used by chart webview.)

## Chart / minimal webview rules

1. Prefer builders over one-off buttons/headers/badges.
2. CSS is **layout only** — colors through `--axis-*`, never raw hex
   or stray `--vscode-*` (except chart canvas-specific paints).
3. Always import the shared CSS layers as needed (chart may skip theme/motion/
   components when paint-only chrome is intentional).
4. Do not invent Pine / `TV.*` APIs. Engine plot kinds stay the fixed set.
5. CSP stays paint-only; no inline scripts; host proxies network.
(Note: src/views/ax-shell removed in lightweight; host uses direct chart html.)

## Related

- `docs/csp-matrix.md` — webview CSP
- `AGENTS.md` — hard constraints for agents
- (storybook removed)
