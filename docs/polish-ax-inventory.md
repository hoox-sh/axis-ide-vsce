# Polish pass inventory — AXIS visuals + `ax-*` library

Date: 2026-11-09 · Seat: oo-spec-2 · Cards: Polish AXIS visuals + ax component library; Finish ax-* on host shells + commit-ready

## Surfaces audited

| Surface | Path | Notes |
|---------|------|-------|
| Shared tokens/theme/motion/components | `webview/shared/*` | Expanded catalog |
| Chart editor chrome | `webview/chart/src/style.css` | Tokenized toolbar/btn/chip; tokens import |
| Results / Strategy / Profiler / Logs | `webview/runoutput/` | `ax-btn`, `ax-section-title`, motion |
| Scripts | `webview/scripts/` + host shell | `ax-btn` host FOUC + runtime rebuild |
| Alerts | `webview/alerts/` + host shell | Primary + row actions → `ax-btn` |
| Watchlist | `webview/watchlist/` + host shell | Add + row actions → `ax-btn` |
| Workers | `webview/workers/` + host shell | Probe cards + probe-all → `btn()`; host `ax-btn` |
| Plugins | `webview/plugins/` | Card actions + `ax-badge` |
| Layers | `webview/layers/` + host shell | Open chart → `ax-btn` host + runtime |
| Toolbox colors/symbols | `webview/toolbox/` | Refresh/copy → `ax-btn`; badge tokens |
| Library | `webview/library/` | Apply control → `btn()` + Sent label swap |
| Storybook | `stories/`, `.storybook/` | New Buttons + Badges stories |

## Host shells touched (residual pass)

| Path | Control | Change |
|------|---------|--------|
| `src/views/ax-shell.ts` | shared | `axBtnClass` / `axBtnHtml` frozen classes |
| `src/views/workers-html.ts` | `#workers-probe-all` | `axBtnHtml` primary |
| `src/views/workers-messages.ts` | `#workers-probe-all` | same body for studio registry |
| `src/views/scripts-html.ts` | `#scripts-run`, `#scripts-open-chart` | `ax-btn` + icon/label spans |
| `src/views/scripts-messages.ts` | same | same |
| `src/views/watchlist-messages.ts` | `#watchlist-add` | `ax-btn` primary submit |
| `src/views/alerts-html.ts` | `#alerts-add` | `ax-btn` primary |
| `src/views/alerts-studio.ts` | `#alerts-add` | same |
| `src/views/layers-messages.ts` | `#layers-open-chart` | `ax-btn` + `layers-open` hook |
| `webview/workers/src/main.ts` | probe-all | `replaceWith(btn())` |
| `webview/library/src/render.ts` | Apply | `btn()`; Sent via label text |

## Root-cause fixes (not one-off hacks)

1. **Missing shared button** — every studio reinvented primary/secondary CSS.
2. **Missing badge / section / loading / code** — duplicated markup/CSS.
3. **Inconsistent motion import** — half the studios skipped `motion.css`.
4. **Chart off-token** — raw VS Code vars; now prefers `--axis-*`.
5. **Empty states** — flat text only; now title + hint hierarchy.
6. **Host FOUC chrome bypassed ax-*** — one-off `workers-btn` / bare buttons; now stamp frozen `ax-btn` classes from `ax-shell.ts`.
7. **Library Apply dual DOM** — dual label/sent spans + custom CSS; now `btn()` + label swap on `is-sent`.

## New / updated `ax-*`

See `webview/shared/README.md` for the full table. New: `btn`, `toolbar`,
`badge`, `sectionTitle`, `loading`, `codeBlock`, `cluster`. Updated: `empty`,
`kpi`. Host helper: `src/views/ax-shell.ts`.

## Story paths

- `stories/Buttons.stories.ts`
- `stories/Badges.stories.ts`
- Existing stories updated: `Surfaces`, `Plugins`
