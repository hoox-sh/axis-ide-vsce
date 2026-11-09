# AXIS IDE capability list

User-facing inventory for the lightweight AXIS IDE working tree (`hoox-sh.axis-ide` 0.3.1). Recited from `package.json` and `src/` on 2026-11-09. Not a Marketplace republish. Do not clone PyneIDE branding or DAP type `pyne`.

Sources: WT `package.json`, `src/extension.ts`, `src/run/*`, `src/editors/*`, `webview/chart/src/*`, sibling `pynescript` Runtime (`pynescript.runtime.host.Runtime.run`), AXIS PWA `pyodide/pynescript_runtime.py`.

## A. Shipped (lightweight AXIS today)

| Capability | Status | Where | Source |
| --- | --- | --- | --- |
| Chart custom editor `axis.chart` on `*.axis.json` | Yes | `contributes.customEditors` | `package.json` |
| Open Chart | Yes | `axis.openChart` | `package.json`; `src/host/open-chart.ts` |
| Run Script / Silent | Yes | `axis.runScript`, `axis.runScriptSilent`, Ctrl/Cmd+Enter | `package.json`; `src/extension.ts` |
| Stop Run | Yes | `axis.stopRun` + `axis.run.running` | `package.json`; `src/host/run-control.ts` |
| Show Run Output | Yes | `axis.showRunOutput` → channel `AXIS Run` | `package.json`; `src/constants.ts` |
| Plot paint: line / step / histogram / area / hline / bgcolor / barcolor / shape | Yes | chart webview | `webview/chart/src/paint.ts`; `state.ts` `resolvePlotPaintKind` |
| Plot paint: fill / plotbar / plotcandle / linestyle / offset / show_last | Yes | chart webview | `webview/chart/src/paint.ts` |
| Engine drawings (line/label/box/table/polyline/linefill) | Yes | SVG/HTML overlay | `webview/chart/src/drawings.ts`; `main.ts` |
| User trendline drawings | Yes | `drawing.setTool` / `drawing.commit` | `src/editors/chart-drawings.ts` |
| Inputs editor in chart chrome (persist `scripts[].inputs`, `chart.applyInputs`) | Yes | chart webview, not a studio | `webview/chart/src/main.ts` |
| Strategy chrome (table, CSV, markers, equity) | Yes | chart webview | `webview/chart/src/main.ts`; `src/run/run-envelope.ts` |
| POST `/run` body: script, data, mode, symbol, inputs, timeframe, from_bar, to_bar | Yes | host HTTP | `src/run/engine-http.ts` |
| Engine logs dumped to Run output | Yes | `log.<level> <message>` | `src/run/orchestrator.ts` |
| Dual auth: Bearer + `X-API-Key` (keyless still `X-AXIS-Client: ide`) | Yes | host HTTP | `src/run/engine-http.ts` |
| Pick Data Quick Pick (symbol / timeframe / mock / datafeed / workspace CSV) | Yes | `axis.pickData`; `barsPath` on `*.axis.json` | `src/host/data-pick.ts`; `src/host/csv-bars.ts` |
| Chart toolbar: layers popup, data window, legend, fullscreen, open source, live-safe | Yes | hatch when static lookahead grep fires | `webview/chart/src/main.ts`; `src/host/lookahead.ts` |
| Pyodide (`axis.engine.allowPyodide`, default **true**) | Yes | host CDN 0.29.5 into `globalStorage`, Wasm not in VSIX | `src/host/pyodide-profile.ts` |
| Pyodide Runtime envelope (plots, plot_meta, drawings, inputs, strategy, logs, window) | This card | micropip + trusted `hoox-pyne` wheel | Table C |
| PYNE language (id `pinescript`, `.pyne` / `.pine` / …) | Yes (sister) | `extensionDependencies: hoox-sh.pyne` | `package.json` |
| Secrets (Pro `pyn_…`, Worker `pn_…`) in SecretStorage | Yes | commands, never settings | `src/secrets/` |
| `contributes.views` / activity-bar studios | **No** | none | `package.json` |

## B. Useful studios / views — ADD

Rule: add a `contributes.views` row only if the feature cannot live in chart chrome or a native VS Code surface (Debug view, Output, Problems).

| Candidate | Verdict | Why it does / does not earn a view | Source |
| --- | --- | --- | --- |
| Debugger | **Skip view** | Use native VS Code Debug (DAP). Variables, call stack, breakpoints already have a VS Code surface. | Table D; VS Code Debug view |
| Replay / bar cursor | **Skip view** | Chart-linked overlay on `axis.chart` (`chart.debugCursor`). Not an activity-bar studio. | `webview/chart`; protocol |
| Data / symbol browser | **Skip view** | `axis.pickData` Quick Pick is enough for symbol + timeframe + mock/datafeed. | `src/host/data-pick.ts` |
| Profiler gutter | **Skip view** | Editor decorations, not a studio. Not this card. | n/a |
| Workers studio | **Skip** | Removed in simplify; CF worker is a remote `/run` URL + secret. | board simplify card |
| Plugins studio | **Skip** | Removed. | board simplify card |
| Alerts studio | **Skip** | Alerts count chip on chart; no alert manager in lightweight core. | `webview/chart/src/main.ts` |
| Watchlist | **Skip** | Out of lightweight scope. | board simplify card |
| Scripts registry | **Skip** | Native editor + sibling `*.axis.json`. | `src/host/open-chart.ts` |
| Layers studio | **Skip** | Layers already a chart popup. | `webview/chart/src/main.ts` |

**ADD rows for `contributes.views`: none.** If this table is empty of ADD, AXIS adds **zero** activity-bar studios.

## C. Pyodide 100% possible

**What “100%” means here:** with `axis.engine.allowPyodide: true` (Wave 1 product default) and no Pro key, the host loads Pyodide 0.29.5 from jsDelivr (Wasm **not** in the VSIX; `pyodide.mjs` cached in `globalStorage` after first fetch), micropip-installs a trusted `hoox-pyne` / `pynescript` wheel plus `antlr4-python3-runtime`, then evaluates Pine/PYNE through `pynescript.runtime.Runtime.run` (same packing as Flask / pyne-worker POST `/run`: `plots`, `plot_meta`, `drawings`, `inputs`, `strategy`, `logs`, `window`). `pyodideRuntimeStatus.ready` is true only after Wasm `1+1` **and** a Runtime smoke (`callable(run_script)`). Run output: `engine=pyodide wheel=… uploaded=0`.

Done-when: a fixture `.pine` strategy runs to `chart.full` with the same plot kinds the HTTP `/run` path already paints.

| Surface | In Pyodide | Not in Pyodide | Why |
| --- | --- | --- | --- |
| Interpret `Runtime.run` | Yes | | Pure-Python AST walker; wheel is `py3-none-any` |
| `plot` / `plot_meta` kinds AXIS already paints | Yes (envelope) | | Same host `mapEngineResponse` → `chart.full` |
| Drawings, inputs, strategy, logs, window | Yes (envelope) | | Runtime packing in `pynescript.runtime.host` |
| `mode=auto` | Yes | Numeric Numba compile | Numba is not a Pyodide package; auto falls back to interpret |
| `mode=compile` nopython | | No | Needs Numba |
| Cloudflare R2 / worker bindings | | No | Browser/host calculator is bars-in only |
| Cron / hosted `/scripts` runner | | No | Flask/worker-only |
| Live websocket / datafeed ownership | | No | Profile `streamOwning: false` |
| `requests` / Click CLI / LSP / MCP | | No | `micropip.install(..., deps=false)` — evaluate-only |

**Trusted wheel search order:** `axis.engine.pyodideWheelUrl` if set; else `media/pyodide/hoox_pyne-*-py3-none-any.whl` or `pynescript-*-py3-none-any.whl` shipped next to the extension; else sibling `pynescript/dist/` and `axis/vendor/`. Missing wheel is an honest `ready: false` with the searched paths — do not fall back to the JS `plot(close)` subset.

**Cannot-do is not faked as 100%.** 100% = everything the Runtime envelope can produce inside Pyodide, not TV cloud, not R2, not cron.

## D. Bar debugger

| Decision | Choice | Why |
| --- | --- | --- |
| DAP type | `axis-bar` | Must **not** be `pyne` (PyneIDE id). Not a clone. |
| Owner | **AXIS host** (not PYNE LSP) | Chart-bar cursor and `chart.barBreakpoint` live on `axis.chart`. PYNE remains language intelligence only. |
| UI | Native VS Code Debug view | No debugger studio |
| Step | Bar-step (`next` / `stepBack`) | One Pine bar per step |
| Breakpoints | Chart-bar index + optional line BPs (break on every bar while a line BP is set) | Pine line ≠ bar; chart click is the real BP |
| Variables | `Bar` scope (OHLCV + time) and `Series` scope (plot columns); `na` shown as `na` | Matches Pine na, not JS `null` |
| Chart sync | `chart.debugCursor` overlay | Webview overlay, not a view |

Commands: `axis.debug.start`, `axis.debug.stepBar`, `axis.debug.toggleBarBreakpoint`.
