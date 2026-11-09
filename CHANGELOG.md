# Changelog

All notable changes to **AXIS IDE** (`hoox-sh.axis-ide`) and the **AXIS Trading
Pack** (`hoox-sh.axis-pack`, formerly `hoox-sh.axis`). This repository was
extracted from the AXIS monorepo with its commit history preserved.

## [Unreleased]

## [0.4.0] — 2026-11-09

Lightweight gallery listing matches this working tree: **no studios**, Pyodide default **on**, PYNE SecretStorage, walkthrough, CSV bars, `axis-bar` debug, static lookahead hatch.

### Changed (Wave 2)

- **Pick Data CSV bars:** `axis.pickData` lists workspace `.csv` files (or Browse). The path is stored on `*.axis.json` as `barsPath`. Run and chart handshake load those OHLCV rows (unix seconds / ms / ISO). No OHLCV studio.
- **Lookahead radar (static grep):** Run stamps `chart.full.lookahead`. Chart hatches when `lookahead_on` / `request.security` / `calc_on_every_tick=true` appear in source. **Live-safe** hides overlays. PYNE warns with `pyne.lookahead.static`. This is **not** dynamic taint and **not** a live-safe proof.
- **PYNE semantic tokens + format:** `series` / `simple` token types + theme colors; Format Document gated by `pynescript.formatting.enabled`.

### Changed (Wave 1)

- **Pyodide is the default run path.** `axis.engine.allowPyodide` defaults **true**. First Run uses the local `hoox-pyne` wheel; AXIS Run logs `engine=pyodide wheel=hoox_pyne-0.6.29 uploaded=0`. `pyodide.mjs` is cached in extension `globalStorage` after the first CDN fetch (Wasm still not in the VSIX). Set the flag false to force remote `/run` only.
- **PYNE missing** is a modal: Install PYNE (`hoox-sh.pyne`) + Run is gated until it is present.
- **Bar debug:** strategy-table click posts `chart.selectTrade` and seeks the live `axis-bar` session to that bar (last-run snapshot + seek).
- **Get Started walkthrough** `axis.firstPlot` opens `fixtures/orb.pine` + sibling chart.

### Added

- User-facing capability list: `docs/competitive/axis-capability-list.md` (shipped / useful studios / Pyodide 100% possible / bar debugger). Zero `contributes.views` (table B has no ADD rows).
- Bar debugger DAP type **`axis-bar`** (not `pyne`): bar-step, chart-bar breakpoints, Bar/Series variables with Pine `na`, chart overlay `chart.debugCursor`. Native VS Code Debug view. Commands `axis.debug.start` / `axis.debug.stepBar` / `axis.debug.toggleBarBreakpoint`.
- Optional Pyodide **0.29.5** bars-in calculator when `axis.engine.allowPyodide` is true (default still **false**): host loads Wasm from jsDelivr (not the VSIX). `ready` only after `1+1` **and** pynescript Runtime smoke (`callable(run_script)`). Micropip installs a trusted `hoox-pyne` wheel from `media/pyodide/`, `axis.engine.pyodideWheelUrl`, or sibling `pynescript/dist`. Same `/run` envelope as Flask/worker (`plots`, `plot_meta`, drawings, inputs, strategy, logs, window) onto `chart.full`. Not available in Wasm: Numba compile, Cloudflare R2, cron. Chart CSP widens `script-src`/`connect-src` for `https://cdn.jsdelivr.net` plus `'wasm-unsafe-eval'` and `worker-src blob:` only when the flag is on.
- Consume HOOX Pro / pyne-worker POST `/run` envelope on the chart: `plot_meta` (histogram, step, area, hline, bgcolor, barcolor, shapes, fill, plotbar, plotcandle) plus `linestyle` / `offset` / `show_last`, engine `drawings` (line/label/box/table/polyline/linefill), `inputs` editor in chart chrome (persist `scripts[].inputs` + re-run), strategy trades/equity markers + table/CSV, `times`/`window`/`alerts`/`error_kind`/`script_type`. No studios restored.
- POST `/run` leftover host fields: `timeframe` from `*.axis.json` `interval` (worker-style `1m`/`1h`/`1d`; one retry without `timeframe` on Flask `UNKNOWN_FIELDS`), `from_bar`/`to_bar` from chart viewport or full bar window, dual `Authorization: Bearer` + `X-API-Key` when a key is present, capped `result.logs` dumped to the AXIS Run output channel (`log.info` visible via Show Run Output).
- Host chrome for lightweight chart+run: **Stop Run** (`axis.stopRun`) swaps the title-bar Run button and aborts in-flight `/run`; **Show Run Output** (`axis.showRunOutput`); **Pick Data** (`axis.pickData`) Quick Pick for symbol/timeframe/mock vs datafeed.
- Run / Open Chart menus and Ctrl/Cmd+Enter `when` clauses cover PYNE language id `pinescript` plus `.pyne` / `.pine` / `.pinev5` / `.pinev6` / `.pinescript` extnames.
- Chart toolbar chrome (webview only): layers popup, data window, legend, fullscreen, open source.
- Manifest `capabilities.untrustedWorkspaces` / `virtualWorkspaces` declared unsupported (run executes script against an engine; sibling `*.axis.json` needs a real filesystem).

### Changed (lightweight core)

- Landed the in-flight simplify on `origin/main` (open-beta #6): removed live/MCP/plugins/views/storybook/OKF bloat. Core is chart custom editor + run orchestration + Pyodide opt-in + secrets.
- Absent Pro/Worker keys still POST `/run` with `X-AXIS-Client: ide` and no Authorization. Present-but-malformed keys fail closed. Worker key still preferred when both are set.
- Key prompt commands use shared beta copy (`proKeyPromptCopy` / `workerKeyPromptCopy`).

### Added

- "Lightweight PYNE Options" section in README.md:
  - Pro (free): `axis.secrets.setProKey` command; endpoint if needed. Auto-wired to `/run` when key present in SecretStorage.
  - CF worker example: short steps + wrangler stub code for a minimal worker handling `/run` (and live ticket if needed). Emphasizes no keys in settings / IDE config.

### Changed

- Simplified lightweight focus documented: chart in VS Code + Pyodide + simple CF PYNE worker or auto-wired Pro. Cleaned README, AGENTS.md, CONTRIBUTING.md, DESIGN.md, pack/README.md, and other docs of removed feature references (Workers, Plugins, Alerts, Watchlist, Scripts, Layers studios + related live/MCP/plugin details).
- Updated Status, Commands, Settings, and develop sections in README to match core scope.
- CHANGELOG updated with simplification + docs artifacts.

### Security / docs

- Re-emphasized throughout docs: secrets only via commands / SecretStorage; never settings, never in worker example source.

### Changed (follow-on)

- Reinstalled simplified AXIS IDE VSIX (0.3.1) into local VSCodium: `bun run compile && bun run package` (exit 0) produced axis-ide-0.3.1.vsix; `codium --install-extension ./axis-ide-0.3.1.vsix --force` (exit 0); verified `codium --list-extensions --show-versions` shows hoox-sh.axis-ide@0.3.1 + hoox-sh.pyne@0.5.7.
- Continued rewriting README + supporting docs (AGENTS.md, CHANGELOG, DESIGN.md, csp-matrix.md, webview/shared/README.md, CONTRIBUTING.md, SECURITY.md) to accurately describe only the lightweight core (AXIS chart custom editor + Pyodide + minimal run orchestration + secrets for Pro or CF PYNE worker). Removed all references to removed bloat (studios/views, live, mcp, plugins, alerts, layers, scripts, watchlist, workers, profiler, results, etc.). Updated "Lightweight PYNE Options" section and layout tables.
- Board card for this objective prepared for review.

### Docs (oo-spec-1 subagent)
- Created clean rewrite plan at `docs/rewrite-plan.md` (sourced from live board.md, README, AGENTS.md, task prompt).
- Rewrote README.md sections (intro, status, install, Lightweight PYNE Options with Pro auto-wire and CF example prominent and cleaned, commands, settings, development, layout). Stripped bloat refs. Verified: `git diff --stat` shows 120 ins/82 del; grep for removed features only shows explicit disclaimer (PASS). Language now "lightweight core: chart custom editor + Pyodide".
- Extended CHANGELOG with this entry.
- Updated AGENTS.md to match new scope (cleaned layout table, hard constraints remove MCP/live-if-present, security, testing notes; removed storybook/okf/old studio refs).
- Updated CONTRIBUTING.md, DESIGN.md, pack/README.md, docs/csp-matrix.md: removed mentions of removed features (e.g. live sessions, MCP, full studios in DESIGN; pruned in csp).
- All edits only *.md files. Before/after excerpts + command verification captured. Checklist run at end.
- Coordination note (fetched live from board.md): simplify card and reinstall+rewrite card (both oo-spec-2) show bloat still present (inventory: src/live/ etc. remains); docs work proceeds on described target state. Handoff will note.

## [0.3.1] — 2026-11-06

### Fixed

- Declare the merged panel studio views (Results, Strategy, Profiler,
  Colors, Symbols, Logs) in `contributes.views["axis-panel"]` and their
  activation events. The Nov 5 views refactor updated the runtime and the
  structure test but left the stale `axis.runOutput` / `axis.toolbox`
  panel declarations in package.json, so shipped 0.3.0 installs showed
  dead panels and none of the six studio panels. Also relaxed the stale
  `version.startsWith('0.1')` structure assertion to a semver check.

## [0.3.0] — 2026-11-06

### Fixed

- Security/robustness hardening across live, run, and MCP paths: strict
  AXIS Worker host allowlist (exact host or strict subdomain of
  `worker.axis.hoox.sh` — no substring/`workers.dev` matching), `axis.worker.url`
  now application-scope, MCP stdio definitions gated by the same worker-URL
  check with send-time `pn_` key re-validation, absolute 30s deadlines for
  Pro `/run` and datafeed OHLCV round-trips with combined abort signals,
  remint failure reporting in the live resume stub, array coercion for live
  frame `bars`/`tail` payloads, chart fan-out cursor reset on reconnect,
  deep secret scrubbing of engine payloads and console logging, bounded
  results cache (100 runs), live-doc snapshot disposal on chart close, and
  an inline-script vector backstop (`on*=` attributes, `javascript:` URLs)
  for chart HTML.

### Added

- OKF knowledge bundle (`okf/`, Open Knowledge Format v0.2): a compiled,
  committed map of the repo refreshed on every commit by the pre-commit hook
  (`.githooks/`), with `okf:enrich/check/lint/query/context` scripts, an
  `okf:check` CI step, and curated agent playbooks under `okf/playbooks/`
  (`okf_lock: human`). See `docs/okf.md`.
- Storybook for the `ax-*` webview design system (`.storybook/` + `stories/`,
  `@storybook/html-vite`): the shared CSS layers render under a VS Code token
  shim with a dark / light / high-contrast toolbar switch. Stories cover the
  token board, inputs (search / field + states), underline tab bars, pill
  chips, rows, status primitives, surfaces, the profiler bar, glyph grid, and
  the Plugins studio card composition. Run `bun run storybook`.

### Changed

- `AGENTS.md` and `DESIGN.md` are now local-only (untracked, gitignored)
  alongside `.opencode/` and `opencode.json`; `.grok/` is ignored for when it
  appears. The OKF bundle no longer ingests `DESIGN.md`.

- Webview shared components aligned with the AXIS repo design language
  (`src/ui/studio/studio.css`): tabs are underline-indicator tab bars
  (animated 2px accent indicator on a hairline rail) instead of segmented
  pills; chips are transparent accent-state pills with press scale, focus
  ring, and disabled fade; inputs gain the accent caret, hover edge lighten,
  focus edge + soft ring, selection tint, autofill fix, removed native
  number/search chrome, readonly/disabled/invalid states; motion durations
  normalized to the 120ms/200ms axis tokens; high-contrast contract updated
  for the new tab rail. Class names (`ax-*`) unchanged — studios and tests
  are unaffected.

### Security

- Hardened the Worker-key trust boundary: `axis.worker.url` is now
  application-scoped and the "known Worker host" allowlist uses strict
  exact/suffix matching instead of substring matching, so a workspace setting
  can no longer exfiltrate the `pn_` key to a spoofed host.
- The MCP stdio provider now gates the worker origin with the same loopback /
  known-host / `allowRemoteEndpoint` check as the live path, and re-validates
  the Worker key shape before emitting `AXIS_API_KEY` into the child env.
- Pro `/run` and datafeed HTTP now enforce a 30s round-trip timeout, and
  `postEngineRun` re-asserts the loopback gate at the transport layer
  (fail-closed for future callers).
- Scrubbed `error` / `strategyReport` fields flowing into the Scripts and Run
  Output webviews, and the host logger console bridge, for consistent secret
  redaction.

### Fixed

- Live reconnect now resets the chart fan-out's seq/bar cursors so a remint
  that restarts the worker's sequence counter is no longer dropped as a stale
  snapshot.
- Bounded the in-memory run-results and chart live-doc caches so long sessions
  no longer grow them without bound.
- The live resume stub now reports `reminted: false` when the remint actually
  fails, instead of logging "remint ok".

## [0.2.0] — 2026-11-05

### Added

- Standalone repository layout: extension at the root, extension pack under
  `pack/`.
- CI (unit + coverage gate + electron + VSIX artifacts), tag-driven release
  workflow with optional Marketplace / Open VSX publishing.
- Dependabot, issue templates, PR template, CODEOWNERS, security and
  contribution docs.
- `webview/shared/` source-only webview runtime and design system
  (Phase 0 groundwork, no behavior change): `--axis-*` design tokens with
  VS Code semantic variables first, base theme/motion/component CSS layers,
  a typed `acquireVsCodeApi()` singleton, DOM/announce/clipboard/filter
  helpers, the `createStudio()` lifecycle runtime, first-pass `ax-*`
  component builders, and a shared
  `createStudioViteConfig()` factory. The Colors studio pilots the
  `@axis-shared` alias (inert until a studio imports it).
- `axis.webview.v1` protocol extended with a generic `studio.*` namespace
  (`studio.init`, `studio.set`, `studio.notice`, `studio.ready`,
  `studio.action`) so every studio can share one codec, one error-code
  table, and one 100%-covered test suite. Additive only — existing
  `chart.*` / `results.*` / `host.*` branches are untouched.
- Colors studio migrated end-to-end onto the shared runtime and the
  `studio.*` protocol (pilot for the webview consolidation): the webview
  side runs on `createStudio()` + shared DOM/filter helpers and inlines
  the `--axis-*` design system; the host side encodes/decodes through the
  single codec bridge (`webview/shared/studio-protocol.ts`). Wire format
  is now `studio.init`/`studio.set`/`studio.ready`/`studio.action` with
  the old payload shapes preserved verbatim; behavior and visuals are
  unchanged.
- Generic studio host infrastructure (Phase 2 groundwork, not yet wired):
  `buildStudioHtml()` (single paint-only CSP shell, byte-identical CSP to
  the current builders), a generic `StudioViewProvider`, a
  `StudioMessageRouter` (decode → route by view/action, errors logged and
  dropped), and a `StudioRegistration` registry — all pure-host with 100%
  line coverage.
- Phase 2 studio rollout: every remaining panel/activity studio now runs on
  the generic `studio.*` protocol and the shared `buildStudioHtml()` shell —
  symbols, watchlist, alerts, library, layers, logs, scripts, workers, and
  plugins on the host side, with each `webview/<studio>/` bundle migrated to
  `createStudio()` and the `@axis-shared` runtime. Old per-studio HTML
  builders (`*-html.ts` bodies) collapsed into `buildBody()` markup and the
  flat `*.ready` / `*.set` / `*.action` messages became `studio.ready` /
  `studio.init` / `studio.set` / `studio.action` with the old payload fields
  preserved verbatim (`data` / `args`). Behavior and visuals are unchanged;
  `StudioMessageRouter` now accepts async action handlers (rejections logged
  and dropped), and asset-root failures degrade to a safe fallback shell.
- Phase 3 panel consolidation: the bottom panel now hosts **Run Output**
  (`axis.runOutput`) and **Toolbox** (`axis.toolbox`) instead of six separate
  views. Run Output has client-side tabs for Summary, Strategy, Profiler, and
  Logs; Toolbox has tabs for Colors and Symbols. `axis.focusResults` reveals
  Run Output and forces the Summary tab. The VSIX now ships exactly ten
  webview bundles (chart, runoutput, toolbox, alerts, library, layers, plugins,
  scripts, watchlist, workers). Stable LM tool ids (`axis_get_results_focus`,
  `axis_get_run_logs`, `axis_get_profiler`) are retargeted to the consolidated
  data sources without renames.
- Phase 4 design-system adoption: the remaining activity-bar studios
  (alerts, layers, library, plugins, scripts, watchlist, workers) now render
  through the shared `createStudio()` runtime and `ax-*` component builders
  (`ax-panel`, `ax-header`, `ax-row`, `ax-chip`, `ax-status-dot`, `ax-capsule`,
  etc.). Per-studio `style.css` files are layout-only with zero `--vscode-*`
  references and zero raw hex colors — all tokens come from `--axis-*`. Added
  `axis-wl-flash-up/down` to watchlist rows and `axis-live-pulse` to worker/live
  status dots; all motion is capped at 350 ms and gated by
  `prefers-reduced-motion`.

### Fixed

- Electron `compile-tests` type error where `assert.deepStrictEqual` narrowed
  the activity-view id list and rejected forbidden plugin view ids.
- Activation no longer throws on VS Code builds without
  `lm.registerMcpServerDefinitionProvider` / `lm.registerTool`; both features
  are feature-detected and soft-fail while the rest of the extension activates.

### Changed

- Watchlist studio migrated onto the shared `ax-*` component system
  (`createStudio()`, `ax-panel`, `ax-header`, `ax-row`, `ax-capsule`,
  `ax-search`, `ax-empty`) with tick-direction row flashes
  (`axis-wl-flash-up/down`, 180ms, gated by `prefers-reduced-motion`).
- Plugins studio migrated onto the shared `ax-*` component system
  (`createStudio()`, `ax-panel`, `ax-header`, `ax-row`, `ax-chip`,
  `ax-status-dot`, `ax-empty`, `ax-tabs`, `ax-search`). `style.css` is now
  layout-only with zero `--vscode-*` references and zero raw hex colors.
  Plugin cards, flags (allowPyodide/liveEnabled/allowUrlInstall), activate
  action, search, copy-id, tab selection, and keyboard navigation are
  preserved.
- Repository / bugs / QnA links now point at `hoox-sh/axis-ide-vsce`.
- Build and test commands no longer use monorepo `--cwd packages/…` paths.
- `.vscodeignore` excludes repo-only docs, `pack/`, CI files, and internal
  contributes fragments from the VSIX.

## [0.1.0] — 2026-11-04

### Added

- AXIS Chart custom editor (`*.axis.json`), Open Chart, Run Script
  (`Ctrl/Cmd+Enter`), and Run Script (Silent).
- Results / Strategy panel webviews with focus rules and Focus Results.
- Activity-bar studios: Library, Layers, Scripts, Watchlist, Alerts, Plugins,
  Workers; panel studios: Results, Strategy, Profiler, Colors, Symbols, Logs.
- SecretStorage-backed Worker / Pro key commands and status bar marks.
- Live session bridge (Worker ticket mint + WebSocket), on-save run modes.
- MCP server definition provider and Copilot language-model tools.
- Bundled builtins catalog, profiler decorations, colors/symbols contributions.
- Coverage ratchet (`test:coverage:gate`) and `@vscode/test-electron` suite.
- AXIS Trading Pack (`hoox-sh.axis`) bundling PYNE + AXIS IDE.
