# Changelog

All notable changes to **AXIS IDE** (`hoox-sh.axis-ide`) and the **AXIS Trading
Pack** (`hoox-sh.axis`). This repository was extracted from the AXIS monorepo
with its commit history preserved.

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
