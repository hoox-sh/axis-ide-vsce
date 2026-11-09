# AXIS IDE current-capability inventory

**Audience:** Docs (`oo-spec-1`) comparing AXIS IDE to PyneIDE.
**Date:** 2026-11-09.
**Repo:** `/mnt/data/home/jango/Git/hoox-open-trading-stack/axis-ide-vsce`
**Read-only product code.** This file is research, not a product spec rewrite.

Three live surfaces disagree. Docs must not collapse them.

| Surface | What it is | Version | Studios / live / MCP |
| --- | --- | --- | --- |
| **Marketplace / Open VSX (public ship)** | Last published VSIX | `hoox-sh.axis-ide@0.3.1` (OVSX timestamp `2026-11-06T03:37:38Z`) | **Shipped.** Activity-bar + panel studios, live, MCP, Copilot tools. |
| **Git `HEAD`** | Last committed tree | `package.json` `0.3.1` | **Present in git.** Same studio/live/MCP contributes as published 0.3.1. |
| **Working tree (this checkout)** | In-flight simplify, **uncommitted** | `package.json` `0.3.1` (same number) | **Deleted from disk.** Chart + run + secrets only. Local `axis-ide-0.3.1.vsix` rebuilt from this tree (12 files). **Not republished.** |

**Rule for comparison:** “What users can install today from Marketplace/Open VSX” = **studio 0.3.1**. “What this repo’s working tree will become if simplify lands” = **lightweight core**. Do not treat the local rebuild as a new marketplace release.

---

## Method

- Working-tree `package.json`, `src/extension.ts`, `src/editors/`, `src/run/`, `src/host/`, `webview/chart/`, `pack/package.json`, README, DESIGN, AGENTS, CHANGELOG, `.vscodeignore`.
- Git `HEAD:package.json` + `git ls-files` / `git status` for leftover vs deleted.
- Local VSIX listing: `unzip -l axis-ide-0.3.1.vsix` (12 files).
- Open VSX API `https://open-vsx.org/api/hoox-sh/axis-ide` and published `package.json` at `https://openvsx.eclipsecontent.org/hoox-sh/axis-ide/0.3.1/package.json`.
- VS Marketplace item page `https://marketplace.visualstudio.com/items?itemName=hoox-sh.axis-ide`.
- Sibling language pack: `/mnt/data/home/jango/Git/hoox-open-trading-stack/pyne-lsp-vsce` (`hoox-sh.pyne@0.5.7`).
- Board: `.openorchestrate/board.md` card **Simplify AXIS IDE…** is still **Working**; this inventory does **not** continue that card.

---

## Product identity

| Field | Working tree | Published 0.3.1 |
| --- | --- | --- |
| Extension id | `hoox-sh.axis-ide` | same |
| Display name | AXIS IDE | same |
| Description | “Lightweight AXIS chart… + Pyodide engine option. Core: chart editor + run orchestration…” (`package.json`) | “AXIS chart IDE… charts, results, and live sessions” (OVSX + Marketplace) |
| Version | 0.3.1 | 0.3.1 |
| Publisher | `hoox-sh` | same |
| License | AGPL-3.0-only | same |
| Engines | `vscode ^1.95.0` | same |
| Kind | `workspace` | same |
| Hard dep | `extensionDependencies: ["hoox-sh.pyne"]` | same |
| Categories | Other, Visualization | same |
| Main | `./out/extension.js` | same |
| Pack | `hoox-sh.axis-pack@0.3.0` in `pack/` | OVSX pack 0.3.0 published 2026-11-08 |

AXIS IDE does **not** contribute a language id. Pine language `pinescript` and file globs come from **PYNE** (`hoox-sh.pyne`). Source: `src/host/open-chart.ts` (`PINE_LANGUAGE_ID = 'pinescript'`), `package.json` `extensionDependencies`.

---

## 1. Language

AXIS IDE ships **no grammar, LSP, snippets, themes, or formatter**. Language UX is the hard dependency.

### PYNE Language Support (`hoox-sh.pyne`) — sibling pack, **shipped**

Evidence: `../pyne-lsp-vsce/package.json` v0.5.7; OVSX `hoox-sh.pyne@0.5.7`; FEATURES.md; README.

| Capability | Status | Evidence |
| --- | --- | --- |
| Language id `pinescript` | Shipped | aliases PYNE / pyne / pinescript / Pine; extensions `.pyne` `.pine` `.pinev5` `.pinev6` `.pinescript` |
| TextMate grammar | Shipped | `syntaxes/pinescript.tmLanguage.json` |
| Language configuration | Shipped | `language-configuration.json` |
| Snippets | Shipped | `snippets/pine.code-snippets` |
| Themes | Shipped | AXIS Void, Hoox Signal, PYNE Volt |
| Default formatter | Shipped | `editor.defaultFormatter: hoox-sh.pyne` for `[pinescript]` |
| LSP (`pyne-lsp`) | Shipped, **not bundled** | Client launches PATH / python / docker; `pip install "hoox-pyne[lsp]"` required |
| Diagnostics, completion, hover, signature, semantic tokens, folding, color swatches, document links, inlay param hints, format, convert-to-v6 | Shipped | FEATURES.md + contributes |
| Inferred-type inlay hints | Removed (0.5.3+) | FEATURES.md |
| **PYNE: Run on Pro** | Shipped | `pynescript.runOnPro` → `POST /run` with **one synthetic bar**; hosted key via **plaintext setting** `pynescript.pro.apiKey` |
| **PYNE: Test/Install/Start Backend** | Shipped | FEATURES.md |
| Real data / optimize / backtest / cron in the **extension** | Not exposed | FEATURES.md footnote |

AXIS vs PYNE run: AXIS `axis.runScript` posts **history bars** (datafeed or mock) and paints a chart. PYNE `runOnPro` is a **one-bar** Pro smoke, not a chart IDE.

---

## 2. Editor (AXIS)

| Capability | Working-tree core | Published 0.3.1 / HEAD | Evidence |
| --- | --- | --- | --- |
| Custom editor `axis.chart` on `*.axis.json` | **Core** | Shipped | `package.json` `contributes.customEditors`; `src/editors/chart-editor.ts`; `CHART_VIEW_TYPE` |
| Schema `axis.chart.v1` | **Core** | Shipped | `src/editors/chart-document.ts` — symbol, exchange, market, interval, historyBars, chartType, theme, panes, scripts[], drawings[], engine, source. Bars **not** persisted. |
| Open/create sibling `rsi.pyne` → `rsi.axis.json` | **Core** | Shipped | `axis.openChart`; `src/host/open-chart.ts` |
| Default custom editor on `*.pyne` | **Not** registered | **Not** registered | AGENTS.md “Native editor only for Pine” |
| Save / saveAs / revert / backup | **Core** | Shipped | `AxisChartDocument` in `chart-editor.ts` |
| Activation on `workspaceContains:**/*.axis.json` | **Core** | Shipped | WT + published |
| Activation on `*.pyne`/`*.pine` globs | **Removed** in WT | **Shipped** | WT `activationEvents` vs published list |
| Pine editor title/context/explorer menus | **Core** | Shipped | Open Chart + Run Script when `resourceLangId == pinescript` |
| Keybinding Ctrl/Cmd+Enter Run Script | **Core** | Shipped | `when: editorTextFocus && editorLangId == pinescript` |

README WT still says activation matches PYNE globs (`*.pyne` …). That is **true for published 0.3.1**, **false for working-tree `package.json`** (only `*.axis.json` + commands). Source: README.md “Activation” vs WT `activationEvents`.

---

## 3. Chart

| Capability | Working-tree core | Published / leftover | Evidence |
| --- | --- | --- | --- |
| Webview chart (Vite → `dist/webview/chart/main.js`) | **Core** | Shipped | `webview/chart/`; `.vscodeignore` allowlists only this webview |
| TradingView Lightweight Charts v5, bundled (no CDN) | **Core** | Shipped | `package.json` dep `lightweight-charts ^5.2.0`; `webview/chart/src/paint.ts`; NOTICE |
| Candlestick series | **Core** | Shipped | `paint.ts` `CandlestickSeries` |
| Plot overlays as **line series** | **Core (partial)** | Partial | `applyPlotOverlays` — lines from `plot.values`; AGENTS.md lists engine kinds `plot, hline, bgcolor, plotshape, plotchar, plotarrow` but **webview paints lines only** |
| `chart.init` / `chart.full` / `chart.delta` | **Core** | Shipped | `src/protocol/types.ts`; `webview/chart/src/main.ts` |
| Theme class (`vscode-dark` / light / HC) | **Core** | Shipped | `chart-editor.ts` `themeBodyClass` |
| Paint-only CSP (`connect-src 'none'`) | **Core** | Shipped | `src/editors/chart-html.ts`; `docs/csp-matrix.md` |
| Trendline drawing (toolbar, two clicks, persist in `*.axis.json`) | **Core** | Shipped | `chart-drawings.ts`; `webview/chart/src/drawings.ts`; toolbar button in `chart-html.ts` |
| Command `axis.chart.drawing.trendline` | **Removed** | Shipped | HEAD/published commands; absent from WT |
| Plugin HUD chips on chart | **Stub / leftover** | Shipped with plugins | WT `copyChartPlugins` returns `undefined`; HTML still has `#chart-plugins` hidden |
| `chart.requestReload` | **Core (host stub)** | Live resume in published | `main.ts` seq-gap → reload; live-doc deleted in WT |
| Results / Strategy webviews | **Gone** | Shipped | published `axis.results` / `axis.strategy` |

Fixture: `fixtures/sample.axis.json` (BTC/USDT binance spot 1m). Not in VSIX (`.vscodeignore` excludes `fixtures/**`).

---

## 4. Backtest / run

| Capability | Working-tree core | Published / leftover | Evidence |
| --- | --- | --- | --- |
| `axis.runScript` / `axis.runScriptSilent` | **Core** | Shipped | WT `package.json` + `src/extension.ts` |
| Output channel `AXIS Run` | **Core** | Shipped | `src/constants.ts`; created in `activate` |
| `axis.showRunOutput` | **Removed** | Shipped | HEAD/published |
| Run-on-save `axis.run.onSave` | **Removed** | Shipped (off/evaluate/run) | HEAD config; `src/host/run-on-save.ts` deleted in WT |
| Engine | **HTTP `POST ${endpoint}/run` only**, engine id hardcoded `'server'` | Same HTTP path + setting `axis.engine.id` enum `server` | `src/run/orchestrator.ts`; WT `extension.ts` `engineId: 'server'` |
| Body | `{ script, data, mode, symbol }` | same | `src/run/engine-http.ts` |
| Modes | `auto` \| `interpret` \| `compile` | same | `RunMode` |
| Timeout | 30s | same | `ENGINE_RUN_TIMEOUT_MS` |
| Auth | **Requires** Pro `pyn_…` **or** Worker `pn_…` (SecretStorage or `AXIS_PRO_KEY` / `AXIS_WORKER_KEY` env) | same | `orchestrator.ts` `MISSING_PRO_KEY_ERROR`; WT `extension.ts` env fallback |
| Loopback default | `http://127.0.0.1:5002` | same | `DEFAULT_ENGINE_ENDPOINT` |
| Remote | needs `axis.engine.allowRemoteEndpoint` (application scope) | same | `package.json` + `endpoint.ts` |
| Chart paint on success | `chart.full` via `notifyChart` | same + Results panel | `orchestrator.ts` |
| Diagnostics collection | **No-op** in WT (`diagnostics.set` empty) | Shipped (Problems + Results) | WT `extension.ts` comment “diagnostics stripped” |
| Results / Strategy / Profiler / Logs panels | **Gone** | Shipped | published views |
| Strategy / backtest UI | **Not in IDE** | Results/Strategy webviews exist in published; not a full TV strategy tester | CHANGELOG 0.3.1 panel studios |
| Pyodide local calc | **Flag + CSP stub only. Wasm not shipped. Runtime never ready.** | same stub | `src/host/pyodide-profile.ts` `ready: false` even when flag true; `docs/csp-matrix.md` item 4 |
| README “Run → Pyodide” | **Overclaim vs code** | Marketplace README still studio-era | WT README Status vs `pyodideRuntimeStatus` |

`RunOrchestrator` comment still says “pyne-worker lands later” (`UNSUPPORTED_ENGINE_ERROR`). Worker **key** is used as Bearer on the same `/run` HTTP path, not a separate engine id.

---

## 5. Data

| Capability | Working-tree core | Published / leftover | Evidence |
| --- | --- | --- | --- |
| HistoryClient `GET {base}/datafeed/ohlcv?exchange=&symbol=&timeframe=&since=&limit=` | **Core** | Shipped | `src/host/history-client.ts` |
| Default datafeed | `http://127.0.0.1:5003` | same | `axis.datafeed.url` |
| Timeout | 30s | same | `DATAFEED_TIMEOUT_MS` |
| Remote datafeed | same `allowRemoteEndpoint` gate | same | history-client |
| Mock bars | opt-in `axis.chart.useMockBars` default **false** | same | `src/host/mock-bars.ts`; cap 20000 |
| Default history window | 1500 (50–20000) | same | `axis.chart.historyBars` |
| Sidecar `@hoox-sh/axis-datafeed` | **Not bundled** in VSIX | same | README / published settings text |
| Live WS / ticket mint | **Deleted** (`src/live/` absent on disk) | **Shipped** (`axis.liveStart/Stop`, `axis.worker.url`, `axis.live.enabled`) | HEAD + published package.json |
| Quote / last-price status bar | **Leftover helpers only** | Watchlist + quote in published | WT `src/host/quote.ts` still labeled “watchlist StatusBar (PR-08b)”; no status bar in WT `activate` |
| Builtins catalog 111 scripts | **Shipped as media, unwired** | Shipped + `axis.applyBuiltin` | `media/builtins/catalog.json` (`count: 111`); WT has `src/host/builtins.ts` loader; **`apply-builtin.ts` deleted**; catalog **is** in local VSIX |

---

## 6. UI / UX

### Working-tree lightweight core

Contributes **no** `views`, `viewsContainers`, `languageModelTools`, `mcpServerDefinitionProviders`.

Commands (6): `axis.openChart`, `axis.runScript`, `axis.runScriptSilent`, `axis.secrets.setProKey`, `axis.secrets.setWorkerKey`, `axis.secrets.clear`.

Settings (7): `axis.telemetry.offline` (default true), `axis.engine.endpoint`, `axis.engine.allowRemoteEndpoint`, `axis.engine.allowPyodide`, `axis.chart.historyBars`, `axis.chart.useMockBars`, `axis.datafeed.url`.

No status bar (comment in `extension.ts`: “no statusBar in lightweight core”).
No activity bar. `media/axis-activity.svg` still exists (and ships in local VSIX) but is unused without `viewsContainers`.
Shared `ax-*` design system remains under `webview/shared/` (tokens used by chart toolbar). `createStudioViteConfig` leftover in `webview/shared/vite.ts`. Protocol still encodes `studio.*` and `results.*` types (`src/protocol/types.ts`) with no studio webviews to consume them.

### Published 0.3.1 / git HEAD (what Marketplace users have)

**Activity bar `axis`:** Library, Layers, Scripts (`axis.indicators`), Watchlist, Alerts, Plugins, Workers.

**Panel `axis-panel`:** Results, Strategy, Profiler, Colors, Symbols, Logs.

**Extra commands:** Show Run Output, Focus Results, Apply Builtin, Start/Stop Live, Probe Workers, Activate Plugin, Plugin Menu, Add/Remove Alert, Add/Remove Watchlist symbol, Drawing: Trendline, Show MCP Config.

**Extra settings:** `axis.engine.id`, `axis.run.onSave`, `axis.worker.url`, `axis.live.enabled`, `axis.plugins.allowUrlInstall`, `axis.mcp.stdio`, `axis.mcp.command`, `axis.mcp.allowNpx`.

**Copilot LM tools:** `axis_run_script`, `axis_get_results_focus`, `axis_chart_snapshot_meta`, `axis_get_run_logs`, `axis_get_profiler`.

**MCP:** `mcpServerDefinitionProviders` id `axis.mcp`.

These are exactly the studios the simplify card names for removal: Workers, Plugins, Alerts, Watchlist, Scripts, Layers (plus Library + panel studios not named in the card title).

---

## 7. Marketplace / distribution

| Channel | Id | Version | Notes |
| --- | --- | --- | --- |
| VS Marketplace | `hoox-sh.axis-ide` | 0.3.1 | Listed **Free**; description “charts, results, and live sessions”; ~1 install shown on item page 2026-11-09 |
| Open VSX | `hoox-sh/axis-ide` | 0.3.1 | `downloadCount` 428; `downloadSizes.universal` 345229 bytes; published 2026-11-06 |
| VS Marketplace / OVSX pack | `hoox-sh.axis-pack` | 0.3.0 | Members `hoox-sh.pyne` + `hoox-sh.axis-ide`; OVSX downloads 84; published 2026-11-08 |
| PYNE | `hoox-sh.pyne` | 0.5.7 | OVSX downloads 5088 |
| GitHub Releases | tag-driven | `PUBLISH.md`, `.github/workflows/release.yml` | Dual vsce + ovsx |
| Local rebuilt VSIX | `./axis-ide-0.3.1.vsix` | 0.3.1 **same version, different contents** | 12 files, ~159 KB package script; **not** the 345 KB OVSX artifact |

Local VSIX contents (working-tree rebuild): `package.json`, `readme.md`, `NOTICE`, `LICENSE.txt`, `out/extension.js`, `media/icon.png`, `media/axis-activity.svg`, `media/builtins/catalog.json`, `dist/webview/chart/main.js` + `main.css`.

Pack is **manifest-only** (`extensionPack`); does not rebundle members (`pack/package.json`, `pack/README.md`). DESIGN.md still says pack id `hoox-sh.axis` — **stale**; live pack id is `hoox-sh.axis-pack` (board card “Rename pack id axis → axis-pack (0.3.0)” is Done).

---

## 8. Pricing

| Claim | Source | Notes |
| --- | --- | --- |
| Extension **Free** | Marketplace item page | No paid VS Code SKU |
| License AGPL-3.0-only | `package.json`, LICENSE | Copyleft; PYNE is AGPL-3.0-or-later — do not relicense |
| README “Pro (free)” | WT README Lightweight PYNE Options | Means **PYNE Pro API key path** is available without a VS Code purchase, not that hosted Pro compute is unlimited |
| Keys | AXIS: SecretStorage only (`src/secrets/slots.ts`). PYNE: `pynescript.pro.apiKey` **plaintext setting** | Different trust models |
| Telemetry | `axis.telemetry.offline` default **true** | Setting exists; no evidence of a paid telemetry product |
| No in-extension billing, Polar, or seat SKU | No contributes / no pricing files in this repo | Hosted Pro billing lives outside this extension (PYNE FEATURES.md `pynescript.online`) |

Do not invent a price list. AXIS IDE itself is a free Marketplace extension; engine/data sidecars are separate processes.

---

## 9. Integrations

| Integration | Working-tree core | Published 0.3.1 |
| --- | --- | --- |
| PYNE language extension | Hard dep | Hard dep |
| PYNE Pro HTTP `/run` | Core | Shipped |
| Self-hosted CF worker `/run` | Core (README stub) | Shipped + Workers studio |
| AXIS Worker live (`worker.axis.hoox.sh`) | **Removed** | Shipped |
| Local datafeed `:5003` | Core (not bundled) | Shipped |
| MCP stdio / AXIS CLI | **Removed** | Shipped |
| GitHub Copilot LM tools | **Removed** | Shipped |
| Plugin URL install | **Removed** | Shipped, default off |
| AXIS PWA / HOOX mesh | Out of repo | Out of repo (DESIGN.md) |
| Storybook / OKF | Absent on disk | In HEAD git + published scripts |

Secret slots leftover in WT code even after studios gone: `enginePyneWorkerApiKey`, `gitPat` in `src/secrets/slots.ts` (unused by WT commands).

Env fallbacks WT: `AXIS_PRO_KEY`, `AXIS_WORKER_KEY` (`extension.ts`).

---

## Conflict with in-flight simplify card

Card: **Simplify AXIS IDE: core chart + Pyodide + PYNE worker example only; remove Workers, Plugins, Alerts, Watchlist, Scripts, Layers and all related views/studios** — owner `oo-spec-2`, status **Working** (gate FAIL text still on the board from an earlier review).

| Named studio | Published 0.3.1 | Working tree disk | Git index |
| --- | --- | --- | --- |
| Workers | view `axis.workers` + `axis.workers.probeAll` | **Absent** | Still tracked (deleted in WT) |
| Plugins | view `axis.plugins` + activate/statusMenu | **Absent** | Still tracked |
| Alerts | view `axis.alerts` + add/remove | **Absent** | Still tracked |
| Watchlist | view `axis.watchlist` + add/remove | **Absent** | Still tracked |
| Scripts | view `axis.indicators` | **Absent** | Still tracked |
| Layers | view `axis.layers` | **Absent** | Still tracked |
| Library (not in card title) | view `axis.library` | **Absent** | Still tracked |
| Panel Results/Strategy/Profiler/Colors/Symbols/Logs | shipped | **Absent** | Still tracked |
| live / mcp / plugins host | shipped | **Absent** | Still tracked |

**Do not treat this inventory as completing that card.** Working tree has already deleted those directories, but:

1. Deletions are **uncommitted** (`git status` shows `D src/live/…`, `D src/views/…`, `D webview/{alerts,layers,…}`).
2. Same **version number** 0.3.1 is reused for a different binary than Marketplace.
3. Pyodide is **not** a working engine (stub). Card title “core chart + Pyodide + PYNE worker example” overstates Pyodide.
4. Checker’s earlier FAIL (trailing comma, studios still on disk, lint/compile red) is **stale relative to this working tree**, but the card is still Working and must be re-gated separately.
5. Docs WT already describe the lightweight target; Marketplace README still describes studios.

For PyneIDE comparison:

- **User-visible today (install from store):** full studio IDE + live + MCP + Copilot tools + chart + `/run`.
- **Intended post-simplify core:** chart custom editor + `/run` (Pro or CF worker) + secrets + optional datafeed/mock + trendline. Pyodide = CSP flag only.

---

## Doc vs code mismatches (do not copy blindly)

| Doc claim | Reality |
| --- | --- |
| WT README Settings `axis.engine.id` | **Not** in WT `contributes.configuration`; **is** in published 0.3.1 |
| WT README Activation pine globs | WT activation is `*.axis.json` + commands only |
| WT README / AGENTS “Pyodide engine” | Flag + CSP; `pyodideRuntimeStatus.ready === false`; Wasm not in VSIX |
| DESIGN.md pack id `hoox-sh.axis` | Pack is `hoox-sh.axis-pack` 0.3.0 |
| CHANGELOG `[0.3.1]` “Declare merged panel studio views” | Describes **published** 0.3.1; Unreleased bullets describe simplify **docs**, not a new published version |
| AGENTS.md `src/run/` “Pyodide” | Orchestrator is HTTP `/run` only |
| Protocol `WEBVIEW_VIEWS = ['chart','results']` | WT has no results webview |

---

## Working-tree leftover (not studios, still in core tree)

Keep these on the radar; they are not the named studios but are not “minimal”:

- `src/host/quote.ts` — watchlist quote helpers, no UI.
- `src/host/builtins.ts` + `media/builtins/catalog.json` — catalog ships, apply command gone.
- `src/protocol/types.ts` — `studio.*` / `results.*` / `ChartPluginsPayload`.
- `src/secrets/slots.ts` — unused git PAT / pyne-worker slots.
- `webview/shared/` full `ax-*` kit + `createStudioViteConfig`.
- Chart HTML hidden plugin HUD.

Git still tracks (deleted on disk, not committed): `src/live/`, `src/mcp/`, `src/plugins/`, `src/views/`, `webview/{alerts,layers,library,plugins,runoutput,scripts,toolbox,watchlist,workers}/`, plus apply-builtin, run-on-save, profiler, chart-live-doc.

Counts: `git ls-files src` = **228** files; working-tree `find src -type f` = **60** files.

---

## Suggested comparison columns for Docs

Use two AXIS columns against PyneIDE, or one column with a “store vs next” footnote:

1. **AXIS store 0.3.1** — language via PYNE dep; chart editor; run `/run`; datafeed; **studios + live + MCP + Copilot**.
2. **AXIS working-tree core** — language via PYNE dep; chart editor; run `/run`; datafeed; **no studios**; Pyodide **unshipped**.

Do not claim Pyodide execution, strategy backtester UI, or Pine LSP inside `axis-ide` itself.

---

## Sources (fetched this run)

- `package.json` (working tree)
- `git show HEAD:package.json`
- `src/extension.ts`, `src/run/orchestrator.ts`, `src/run/engine-http.ts`, `src/run/run-context.ts`, `src/host/pyodide-profile.ts`, `src/host/history-client.ts`, `src/host/open-chart.ts`, `src/host/builtins.ts`, `src/host/quote.ts`, `src/editors/chart-document.ts`, `src/editors/chart-editor.ts`, `src/editors/chart-html.ts`, `src/editors/chart-drawings.ts`, `src/protocol/types.ts`, `src/secrets/slots.ts`
- `webview/chart/src/main.ts`, `webview/chart/src/paint.ts`
- `README.md`, `DESIGN.md`, `AGENTS.md`, `CHANGELOG.md`, `PUBLISH.md`, `docs/csp-matrix.md`, `pack/package.json`, `pack/README.md`, `.vscodeignore`
- `media/builtins/catalog.json`
- `unzip -l axis-ide-0.3.1.vsix`
- `git status --short -- src webview package.json`
- Open VSX API `hoox-sh/axis-ide`, `hoox-sh/axis-pack`, `hoox-sh/pyne`
- Published `package.json` `https://openvsx.eclipsecontent.org/hoox-sh/axis-ide/0.3.1/package.json`
- Marketplace `https://marketplace.visualstudio.com/items?itemName=hoox-sh.axis-ide`
- Sibling `../pyne-lsp-vsce/package.json`, `FEATURES.md`, `README.md`
- `.openorchestrate/board.md`
