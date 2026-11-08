# AXIS shared webview design system (`ax-*`)

Vanilla TS + CSS layers used by every studio webview. No framework. Class
names on builders are the frozen contract with `components.css`.

## Layers (import order)

| File | Role |
|------|------|
| `tokens.css` | `--axis-*` semantic tokens (VS Code vars first, AXIS hex fallbacks last) |
| `theme.css` | Reset, body type, single `:focus-visible`, scrollbars, high-contrast |
| `motion.css` | Keyframes, chrome transitions, reduced-motion guard |
| `components.css` | All `.ax-*` rules |

Studios import via `@axis-shared/…` (see `vite.ts`). Chart imports
`tokens.css` only so canvas chrome tracks tokens without studio chrome tax.

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

Stories live in `/stories`. Run:

```bash
bun run storybook          # http://localhost:6006
bun run build-storybook    # → storybook-static/
```

Toolbar switch: Dark / Light / High contrast (VS Code body classes).

## Studio rules

1. Prefer builders over one-off buttons/headers/badges.
2. Studio CSS is **layout only** — colors through `--axis-*`, never raw hex
   or stray `--vscode-*` (except chart canvas-specific paints).
3. Always import the four shared CSS layers (chart may skip theme/motion/
   components when paint-only chrome is intentional).
4. Host-emitted FOUC chrome must stamp the same frozen `ax-btn` classes
   (`src/views/ax-shell.ts` `axBtnClass` / `axBtnHtml`). Webview JS may
   `replaceWith(btn())` after load; ids stay stable.
5. Do not invent Pine / `TV.*` APIs. Engine plot kinds stay the fixed set.
6. CSP stays paint-only; no inline scripts; host proxies network.

## Related

- `.storybook/preview.css` — VS Code token shim for Storybook
- `docs/csp-matrix.md` — webview CSP
- `AGENTS.md` — hard constraints for agents
