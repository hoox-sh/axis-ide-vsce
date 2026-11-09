# PyneIDE vs AXIS IDE — competitive feature list and parity plan

**Fetched:** 2026-11-09 (live listings, GitHub raw, this checkout).  
**Scope:** PyneIDE `pynesys.pyneide` **0.14.1** vs AXIS IDE `hoox-sh.axis-ide` **0.3.1** plus hard language dependency `hoox-sh.pyne` **0.5.7**.  
**Three AXIS surfaces (do not collapse):**

| Surface | What it is | Studios / live / MCP |
| --- | --- | --- |
| Marketplace / Open VSX **shipped** 0.3.1 | Last published VSIX (OVSX `2026-11-06`) | **Present** (listing still sells results/live) |
| Git `HEAD` | Last commit | **Present** in tree (same era as ship) |
| **Working tree** (this comparison’s “AXIS today”) | In-flight simplify, uncommitted | **Gone** from `package.json` contributes; chart + run + secrets only |

Pyodide is an **opt-in CSP stub; Wasm is not shipped**. This comparison does **not** recommend restoring Workers / Plugins / Alerts / Watchlist / Scripts / Layers **studios**. Supporting research: `docs/competitive/_research-axis-current.md`, `_research-pyneide-public.md`, `_research-pyneide-vsix.md`.

Evidence tags:

- **Confirmed** — stated in marketplace, README, changelog, or `package.json` contributes.
- **Inferred** — from command names, settings, or code structure without a product claim.
- **Unknown** — claimed somewhere but not verified here (no install of the competitor into VSCodium).

Confidence of this document: **high on manifests, R-AXIS, and working-tree `package.json`/`src`; medium on runtime quality** (no side-by-side run of PyneIDE). Marketplace README for AXIS is **stale** vs this checkout (still advertises studios / live / MCP). **AXIS today** is recited from **R-AXIS + working-tree `package.json`/`src` only**. Do not treat WT README as AXIS today when it contradicts `src/`.

---

## Executive summary

PyneIDE is a **preview, all-in-one Pine + Pyne IDE**: language server, managed CPython/PyneCore, cloud Pine compile (paid), local run/debug/profile, KLineChart backtest UI, symbol browser, robustness tests. AXIS IDE today is a **thin chart + `/run` host** that depends on sister **PYNE Language Support** for editor intelligence. Language coverage is in the same ballpark *if* the user installs the pack; **run/chart/debug is not**. The honest gap is not “a few toolbar buttons.” It is: no local bar-by-bar engine in-process, no debugger, no Pine-faithful plot/drawing/strategy surface, no inputs form, no data browser. AXIS should **match the run+chart loop first**, keep language work in `hoox-sh.pyne`, and **exceed** on privacy (no source upload to compile Pine), loopback-first secrets, paint-only CSP, Pyodide-in-webview, AGPL, VSCodium/Open VSX, and HOOX stack wiring — without cloning PyneSys branding or restoring deleted studios.

| Area | PyneIDE 0.14.1 | AXIS IDE 0.3.1 today | Verdict |
| --- | --- | --- | --- |
| Language / LSP | Built-in Pine LS + Pyne analysis | Sister `hoox-sh.pyne` (hard dep) | Near-parity via pack, not this repo |
| Chart | KLineChart, Pine plot/drawing/strategy UI | Lightweight Charts, candles + **line plots only**, trendline overlay | **Large gap** |
| Run / backtest | Local PyneCore, stream, stop, profile, robustness | Remote Pro/CF `/run` (key required) or **Pyodide stub** | **Large gap** |
| Debugger | Custom `pyne` DAP, bar step, chart-bar BP | None | **Large gap** |
| Data | Symbol browser, download, `*.ohlcv` table | Loopback datafeed **or** mock bars | Gap (picker, not a studio) |
| Inputs | `input.*` form → sibling TOML | None | Gap |
| Privacy / compile | Pine source uploaded to PyneComp unless cache hit | No cloud compile in this repo; Pro `/run` if keyed | AXIS can exceed |
| License | GPL-3.0-only (IDE); Apache-2.0 (PyneCore); **PyneComp closed** | AGPL-3.0-only (IDE); PYNE AGPL-3.0-or-later | Different copyleft; do not copy PyneComp |
| Installs (fetched) | Marketplace **57**; Open VSX **1,344** downloads | Marketplace **1**; Open VSX **428** | PyneIDE ahead on VS Code gallery |
| Pricing | IDE free; Pine compile **$8–$48/mo** | Extension free; README claims Pro path free | AXIS can exceed on Pine path |

Scorecard is a roll-up of the sourced Feature-by-feature table. Chart library name is **klinecharts 10.1.0** from R-VSIX + shipped changelog, not the live Marketplace README.

---

## What PyneIDE is

| Field | Value | Evidence |
| --- | --- | --- |
| Product | PyneIDE: Pine Script Debugger and Backtester (`preview: true`) | [OVSX API](https://open-vsx.org/api/pynesys/pyneide), [GitHub package.json](https://raw.githubusercontent.com/PyneSys/PyneIDE/main/package.json) |
| Publisher | `pynesys` / **PYNESYS LLC**; listing publisher GitHub `wallneradam` | OVSX API `publishedBy`; [about](https://pynesys.io/about/) |
| Version fetched | **0.14.1** (2026-11-08) | OVSX API; [CHANGELOG](https://raw.githubusercontent.com/PyneSys/PyneIDE/main/CHANGELOG.md) |
| License | **GPL-3.0-only** | GitHub README, package.json, LICENSE |
| Homepage | https://pynesys.io | package.json `homepage` |
| Repository | https://github.com/PyneSys/PyneIDE (public; **5** stars; **206** commits on `main` at re-fetch) | [GitHub API repo](https://api.github.com/repos/PyneSys/PyneIDE) `stargazers_count`; [commits `per_page=1`](https://api.github.com/repos/PyneSys/PyneIDE/commits?per_page=1) `Link` `rel="last"` page=206 (2026-11-09) |
| Install targets | VS Code Marketplace (`pynesys.pyneide`); Open VSX (`pynesys.pyneide`); VSIX on GitHub Releases | [Marketplace](https://marketplace.visualstudio.com/items?itemName=pynesys.pyneide); [OVSX](https://open-vsx.org/extension/pynesys/pyneide); changelog 0.10.0 / 0.9.2 |
| Engine floor | VS Code `^1.90.0`; workspace-only; **no untrusted / virtual workspaces** | package.json `engines`, `capabilities` |
| Language | Pine Script (`.pine`, `.psc`) + **Pyne** (`@pyne` Python / `pyne` language id) | README; contributes.languages |
| Runtime | **PyneCore** (Apache-2.0, CPython ≥3.11; managed env uses **Python 3.14.x**, min Core **6.12.1**, robustness needs **6.13.0+**) | README; changelog 0.13.0 / 0.14.0; [pynecore.org](https://pynecore.org) |
| Pine compiler | **PyneComp** — closed-source, deterministic, **cloud**. Pine run/debug **uploads source** unless content-hash cache hits. | [about](https://pynesys.io/about/); README Privacy |
| VSIX size | **2,241,137** bytes (universal) | OVSX `downloadSizes` |
| Telemetry | Claims **no automatic telemetry** | README; marketplace |

PyneSys stack (not the extension alone): **PyneIDE** (GPL IDE) + **PyneComp** (closed compiler, subscription) + **PyneCore** (Apache runtime). Discord bot: **3 lifetime** free compiles. Plans pay for **Pine compiles**, not for running Pyne.

---

## Full PyneIDE feature inventory

Grouped. Every item is **Confirmed** unless marked otherwise.

### Language

| Feature | Notes | Source |
| --- | --- | --- |
| Pine v6 syntax highlighting, snippets | `.pine` / `.psc`; builtin namespaces kept in sync with PyneComp | README; `contributes.languages` / `snippets` |
| Pine Language Server | Diagnostics, completion, hover, signature help; install/update/restart/log commands; `pyneide.pineLs.*` | README; commands `pyneide.pineLs*` |
| Workspace library intel | Import completion, go-to-definition, hover, call-argument checks (Pine and Pyne) | README |
| Convert Pine v4/v5 → v6 | Free; does not consume compile quota | README; command `pyneide.convertToV6`; pricing FAQ |
| Compile Pine → Pyne | Cloud PyneComp; local content-hash cache (`.py.map`); overwrite protection | README; `pyneide.compilePine` |
| Pyne language mode | `@pyne` files; separate from Python Run/Debug | README; language id `pyne` |
| Bundled pyright + Pyne checker + **Pyne Edge** linter | Series/`na`/persistent; can take over from Pylance | README; `pyneide.checker.enabled`, `pyneide.pyright.enabled` |
| TOML language contrib | For sibling input files | `contributes.languages` toml |
| Agent files | Init writes `AGENTS.md`, skills for Claude/Cursor/agents; `Update Agent Files`; `AGENT_RULES.md` | README; changelog 0.13.0; commands `editAgentRules`, `updateAgentFiles` |

### Editor / project UX

| Feature | Notes | Source |
| --- | --- | --- |
| Get Started walkthrough | 7 steps | README 0.1.0; `walkthroughs` “Get Started with PyneIDE” |
| Initialize Pyne Project | Scaffold + demos `demo_sma_cross.pine`, `demo_rsi_strategy.pine` (precompiled; run/debug **no account**) | README; changelog 0.11.1 |
| File nesting | `.pine` nests `.py`, `.py.map`, `.toml` | `configurationDefaults` |
| CodeLens / title Run, Debug, Profile, Robustness | 72 commands in manifest | package.json commands |
| Edit Inputs form | Built from `input.*`; sibling `<script>.toml`; Save re-runs | README |
| Strategy Properties tab | Backtest settings beside inputs | changelog 0.9.0 |
| Pine Script plans panel | When compile blocked; plan table; paste API key | changelog 0.11.1; `pyneide.showPineAccess` |
| Sign in / out | OS secret store; import from `pyne` CLI | README |
| Report a Problem | Opt-in, redacts paths/creds | README; `pyneide.reportProblem` |

### Chart

| Feature | Notes | Source |
| --- | --- | --- |
| Interactive candlestick chart | **klinecharts 10.1.0** (changelog names **KLineChart**); streams bar by bar | R-VSIX (`docs/competitive/_research-pyneide-vsix.md`: npm `klinecharts ^10.1.0`, bundled `dist/chart-webview.js` “Welcome to klinecharts. Version is 10.1.0”); shipped [CHANGELOG 0.1.0](https://raw.githubusercontent.com/PyneSys/PyneIDE/main/CHANGELOG.md). Live Marketplace README does **not** name KLineChart. |
| Pine plot fidelity | lines, histograms, steplines, areas, `plotcandle`/`plotbar`, `bgcolor`, `barcolor`, fills, shapes, `hline` | README |
| Script drawings | `line` / `label` / `box` / `table`; bold/italic `text_formatting`; label hover + links (0.14.0) | README; changelog 0.13.0 / 0.14.0 |
| `display.*` | Data window / status line / pane combinations | changelog 0.13.0 |
| Layers popup | Toggle plots without re-run | README |
| Legend, measure, go-to-date, fullscreen | Toolbar | README; `pyneide.toggleChartFullscreen` |
| Candle styles | candles, hollow, OHLC bars, monochrome, line, area (`pyneide.chart.candleStyle`) | README |
| Color schemes | Classic / Theme / Colorblind-safe | README |
| Price scale | Auto / log / % (`pyneide.chart.priceScale`) | README |
| Theme follow | VS Code theme recolors chart live | README |
| Data Window | Per-bar OHLCV + plots + equity; copy precision; debugger-paused bar | changelog 0.13.0 |
| Open Chart Source | Toolbar jump to script | changelog 0.13.2 |
| Persist zoom across re-run | Visible range survives rebuild | README |
| Chart is a **webview panel**, not a `*.axis.json` custom editor | Custom editor in PyneIDE is **OHLCV table** only | `customEditors`: `pyneide.ohlcvTable` on `*.ohlcv` |

### Backtest / run / debug / profile

| Feature | Notes | Source |
| --- | --- | --- |
| One-click Run on Pine or Pyne | Compile-if-needed then local PyneCore | README |
| Stop / restart | Stop replaces Run; restart if already running; cancel→kill | README |
| Pause / Next bar / Run to bar | Run controls + debug toolbar | commands `pauseRun`, `stepBar`, `runToBar` |
| Output channel | `PyneIDE Run`; reveal on first log | README; `pyneide.run.revealOutputOnLog` |
| Strategy UI | Trade markers, equity/performance curve, Trades / Stats, CSV export, per-trade details | README; changelog 0.11.1 |
| Robustness tab | Monte Carlo, coin-flip, extra costs, CSV; `pyneide.robustness.*` | changelog 0.14.0 / 0.14.1 |
| Line profiler | Flame column, sourcemap onto Pine, `output/<script>_profile.json` | README; changelog 0.10.0 |
| Debugger | Custom `pyne` debug adapter (**no Microsoft Python extension**); Pine↔Python sourcemap; demangled names; Pyne scope (OHLCV); `close[1]` watches; **chart-bar breakpoints** | README; `contributes.debuggers` type `pyne` |
| Runtime errors → Problems | Pine and Pyne; library frames map to caller | changelog 0.11.1 |

### Data

| Feature | Notes | Source |
| --- | --- | --- |
| Pyne activity-bar Workspace | Scripts / Data / Output | `viewsContainers` + `pyneide.workspace` |
| Symbol Browser + download wizard | Multiple providers; timeframe/from/to/truncate | README |
| Per-feed actions | Update, truncate, other TF, preview chart, delete | commands `pyneide.data*` |
| OHLCV table custom editor | Reads PyneCore binary schema | README; custom editor |
| Symbol map | For `request.security()` | README |
| Data picker shared across Run/Debug/Chart | One picker per script | changelog 0.11.1 |
| Keys for data providers | Local workdir config (not PyneSys) | README Privacy |

### UI/UX / environment

| Feature | Notes | Source |
| --- | --- | --- |
| Managed env per project | `.pyneide/venv` via **uv** (~80 MB first download); shared uv/Python in extension storage | README; changelog 0.11.0 |
| `pyneide.pynecore.version` | Pin or follow latest; auto-update ≤ daily | README |
| Plugin manager | PyneCore plugins into project env | `pyneide.openPlugins` |
| Remove / Reveal environment | Disk reclaim | commands |
| Integrated terminal activation | `pyne`, `python`, `pip` in initialized projects | README |
| Status bar environment menu | Sign-in, usage, docs | commands |
| Activation | `onStartupFinished` + languages + debug + OHLCV editor + `onUri` | package.json |

### Marketplace / distribution

| Feature | Notes | Source |
| --- | --- | --- |
| VS Marketplace | Preview, **57 installs**, 0 ratings (fetched 2026-11-09) | Marketplace item page |
| Open VSX | **1,344** downloads; verified; trusted publishing | OVSX API |
| GitHub release → Marketplace + Open VSX | Entra WIF + OVSX upload | changelog 0.9.2 / 0.10.0 |

### Pricing (PyneComp, not the VSIX)

IDE is free. **Pine compile is not.** From [pynesys.io](https://pynesys.io/) (fetched 2026-11-09):

| Plan | Price | Compiles | Per hour | API keys | Max script |
| --- | --- | --- | --- | --- | --- |
| Pyne code | $0 | n/a (local) | n/a | 0 | n/a |
| Seed | **$8 / mo** | 5 / day | 1 | 1 | 25 KB |
| Sprout | **$18 / mo** | 30 / day | 5 | 2 | 50 KB |
| Grower | **$28 / mo** | 700 / week | 60 | 5 | 150 KB |
| Forest | **$48 / mo** | 2100 / week | 120 | 10 | 300 KB |

Failed compiles and v4/v5→v6 conversion do not count. Unchanged `.pine` uses cache. Discord: 3 lifetime compiles ([about](https://pynesys.io/about/)). Payment: Stripe. Auth: Logto. **Unknown:** exact weekly quota UI vs daily (changelog 0.13.1 mentions weekly limits in the IDE).

### Integrations

| Feature | Notes | Source |
| --- | --- | --- |
| PyneCore CLI | Same robustness/profile/run | README |
| CCXT / replay / Bybit plugins | PyneCore plugin ecosystem (Bybit repo exists) | [PyneSys GitHub](https://github.com/PyneSys); pynecore entry points |
| Freqtrade example | Blog, not IDE | pynesys.io homepage |
| AI agents | Skills + AGENTS.md | README |
| `onUri` | Web app “Copy and open in PyneIDE” | changelog 0.11.1; activation `onUri` |

**Thin / 404:** news slug `…sprout-is-now-18…` **404**’d; pricing taken from homepage instead. Open VSX **HTML** listing is a JS shell; metadata taken from **API**.

---

## AXIS current capability inventory

**AXIS today** (this section) is recited from **R-AXIS** (`docs/competitive/_research-axis-current.md`) **+ working-tree `package.json`/`src` only**. WT README / DESIGN / Marketplace copy are **not** AXIS today when they contradict `src/` (status bar, diagnostics, Pyodide, activation globs). Marketplace/Open VSX listing for AXIS is **stale vs working tree** (still lists studios, live, MCP). Published users still get that older surface until a new VSIX ships. PYNE language id is **`pinescript`** (not PyneIDE’s `pine`). AXIS `axis.runScript` posts **history bars**; PYNE `pynescript.runOnPro` is a **one-bar** smoke (R-AXIS).

### Language (not this repo)

Hard dependency `hoox-sh.pyne` ≥ recommended 0.5.4; Open VSX **0.5.7**, **5,088** downloads, AGPL-3.0-or-later. Marketplace copy: highlighting, diagnostics, autocomplete, hover, formatting, signature help, semantic tokens, Convert to v6, document links, inlay hints. LSP is **hoox-pyne launched from the user’s Python env** (extension ships no server). **Confirmed** for the pack; **not implemented in axis-ide-vsce**.

### Editor (this repo)

| Feature | Status | Source |
| --- | --- | --- |
| Custom editor `axis.chart` on `*.axis.json` | Yes | package.json `customEditors` |
| Open Chart (sibling JSON, do not rewrite existing) | Yes | `axis.openChart`; `src/host/open-chart.ts` |
| Run Script `Ctrl/Cmd+Enter` on `pinescript` | Yes | keybindings + menus |
| Run Silent | Yes | `axis.runScriptSilent` |
| Secrets: Set Pro / Set Worker / Clear | Yes; SecretStorage only | `axis.secrets.*`; `src/secrets/` |
| Status bar set/missing | **No** | `src/extension.ts` activate comment “no statusBar in lightweight core”; R-AXIS §6 |
| Output channel `AXIS Run` | Yes (no command to show it) | `src/extension.ts` creates channel; `showRunOutput` **removed** (R-AXIS §4) |
| Walkthrough / project init / CodeLens | No | WT `package.json` contributes (none) |
| Inputs form | No | WT `package.json` contributes (none); R-AXIS |

Commands in this checkout: **6** (open, run, run silent, three secrets).

### Chart

| Feature | Status | Source |
| --- | --- | --- |
| Bundled TradingView Lightweight Charts | Yes, candles | `webview/chart/src/paint.ts`; dep `lightweight-charts` |
| Plot paint | **Line overlays only** (id + values) | `applyPlotOverlays` uses `LineSeries` |
| Histogram / stepline / area / plotcandle / bgcolor / barcolor / fills / shapes / hline | **No** | `webview/chart/src/paint.ts`; R-AXIS §3 (AGENTS.md lists engine kinds; webview paints lines only) |
| Script drawings line/label/box/table | **No** | `src/editors/chart-drawings.ts` (user trendline only); R-AXIS §3 |
| User trendline overlay | Yes (two-click) | `webview/chart/src/main.ts` capabilities `drawing-trendline` |
| Layers / legend / measure / data window / fullscreen / candle styles / log scale | **No** (plot count HUD only) | main.ts `renderPlotCount` |
| CSP paint-only | Yes; host proxies network | `src/editors/chart-html.ts`; `docs/csp-matrix.md`; R-AXIS §3 |
| Protocol `axis.webview.v1` | Yes; coverage-gated 100% | `src/protocol/` |

### Backtest / run

| Feature | Status | Source |
| --- | --- | --- |
| POST `${endpoint}/run` with bars | Yes; 30s timeout; loopback unless app-scope allow | `src/run/engine-http.ts` |
| Requires Pro `pyn_…` or Worker `pn_…` for remote | Yes | orchestrator `MISSING_PRO_KEY_ERROR` |
| Engine id | `"server"` only | orchestrator `UNSUPPORTED_ENGINE_ERROR` |
| Pyodide | Flag `axis.engine.allowPyodide` default **false**; **Wasm not in VSIX**; status `ready: false` even when allowed | `src/host/pyodide-profile.ts` |
| Streaming bar-by-bar / Stop / Pause / Debug / Profile / Robustness | **No** | WT `package.json` commands (6: open/run/runSilent/secrets only); R-AXIS §4 |
| Strategy trades / equity / stats / CSV | **No** (protocol still has leftover `results.*` / `studio.*` types) | `src/protocol/types.ts` vs no Results view in WT `package.json` contributes |
| Diagnostics from engine | **No-op / output-only** | `src/extension.ts` `diagnostics.set` empty (“diagnostics stripped in lightweight core (errors still logged to output)”); orchestrator still calls `deps.diagnostics.set` (`src/run/orchestrator.ts`) but WT host is a no-op; R-AXIS §4 |

### Data

| Feature | Status | Source |
| --- | --- | --- |
| `GET` local `@hoox-sh/axis-datafeed` `/datafeed/ohlcv` | Yes, default `http://127.0.0.1:5003` | `src/host/history-client.ts` |
| Mock bars | Opt-in `axis.chart.useMockBars` | package.json |
| History window | `axis.chart.historyBars` default 1500, max 20000 | package.json |
| Symbol browser / download / OHLCV table | **No** | WT `package.json` contributes (no views / no OHLCV editor); R-AXIS §5 |

### UI/UX / marketplace / pricing / integrations

| Feature | Status | Source |
| --- | --- | --- |
| Activity-bar studios | **Removed from contributes** in this checkout (bloat may still exist on disk per simplify card) | package.json views: none |
| Telemetry | `axis.telemetry.offline` default true | package.json |
| License | AGPL-3.0-only | package.json |
| Pack | `hoox-sh.axis-pack` bundles pyne + axis-ide | `pack/README.md` |
| Open VSX | axis-ide **428** downloads, version 0.3.1, published description still mentions live/results | OVSX API |
| Marketplace | **1 install**; README still 0.1.0-era studios | Marketplace item |
| VS Code engine | `^1.95.0` (stricter than PyneIDE 1.90) | package.json |
| HOOX | PYNE is hard dep; CF worker is a README example, not src | WT `package.json` `extensionDependencies: ["hoox-sh.pyne"]`; worker `/run` is HTTP path in `src/run/` — PWA is out of this repo (R-AXIS §9) |
| MCP / live / Copilot | Not in current contributes; marketplace listing still claims them | WT `package.json` vs [Marketplace](https://marketplace.visualstudio.com/items?itemName=hoox-sh.axis-ide); R-AXIS §6–§7 |

---

## Feature-by-feature comparison

Owner column in Recommendation: **IDE** = this repo, **PYNE** = `hoox-sh.pyne`, **PACK** = both.

| Feature | PyneIDE | AXIS today | Gap | Recommendation | Source |
| --- | --- | --- | --- | --- | --- |
| Pine highlighting + LSP | Built-in LS | Sister PYNE 0.5.7 | Pack, not IDE | **Match** via PYNE; do not fork a second LS in AXIS | [PYNE OVSX](https://open-vsx.org/api/hoox-sh/pyne); [PyneIDE README](https://raw.githubusercontent.com/PyneSys/PyneIDE/main/README.md); R-AXIS §1 |
| Pyne / `@pyne` analysis | Bundled pyright + Edge | PYNE if it covers `.pyne`; **Unknown** vs Pyne Edge | Verify PYNE Series/`na` | **Match** in PYNE; **Later** Edge-strict if missing | R-VSIX (`docs/competitive/_research-pyneide-vsix.md` pyright 1.1.411); [CHANGELOG 0.9.x](https://raw.githubusercontent.com/PyneSys/PyneIDE/main/CHANGELOG.md); R-AXIS §1 |
| Convert to v6 | Free command | PYNE “Convert to v6” | Confirm UX parity | **Match** (PYNE) | [PyneIDE README](https://raw.githubusercontent.com/PyneSys/PyneIDE/main/README.md); R-AXIS §1 (`pynescript` convert-to-v6) |
| Compile Pine → Python | Cloud PyneComp + cache | No compiler in this repo; Pro `/run` may compile server-side (**Unknown** contract) | Pine-as-source local compile | **Exceed**: local/WASM compile, **no source upload** (IDE+engine) | [about](https://pynesys.io/about/); [README Privacy](https://raw.githubusercontent.com/PyneSys/PyneIDE/main/README.md); `src/run/orchestrator.ts` |
| One-click Run | Local PyneCore, no key for Pyne | `/run` needs key; Pyodide not actually runnable | Cannot run offline without sidecar+key | **Match** then **Exceed** (Pyodide + local PYNE) | [PyneIDE README](https://raw.githubusercontent.com/PyneSys/PyneIDE/main/README.md); `src/run/orchestrator.ts`; `src/host/pyodide-profile.ts`; R-AXIS §4 |
| Stop / cancel / restart | Yes | AbortController between commands only; no Stop UI | User cannot cancel a hung `/run` from the title bar | **Match** (IDE) | R-VSIX commands `pauseRun` / stop; WT `package.json` commands (no Stop); `src/extension.ts` |
| Stream bars onto chart | Yes | `chart.full` snapshot (delta protocol exists) | No live fill during run | **Match** (IDE): paint `chart.delta` during run | [CHANGELOG 0.1.0](https://raw.githubusercontent.com/PyneSys/PyneIDE/main/CHANGELOG.md) streaming; `src/protocol/types.ts`; `src/run/orchestrator.ts` `chart.full` |
| Plot fidelity (hist/step/area/candle/bar/bg/barcolor/fill/shape/hline) | Yes | Line series only | Scripts look wrong | **Match** (IDE) P0 | [PyneIDE README](https://raw.githubusercontent.com/PyneSys/PyneIDE/main/README.md); `webview/chart/src/paint.ts`; R-AXIS §3 |
| Script drawings (line/label/box/table) | Yes | User trendline only | Missing Pine drawings | **Match** (IDE) P0–P1 | [PyneIDE README](https://raw.githubusercontent.com/PyneSys/PyneIDE/main/README.md); `src/editors/chart-drawings.ts`; R-AXIS §3 |
| Strategy markers + equity + trades/stats + CSV | Yes | None | Cannot read a backtest | **Match** (IDE) as **chart tabs**, not a Results studio | [PyneIDE README](https://raw.githubusercontent.com/PyneSys/PyneIDE/main/README.md); WT `package.json` (no Results view); R-AXIS §4 |
| Inputs form + sidecar TOML | Yes | None | Must edit source | **Match** (IDE) | [PyneIDE README](https://raw.githubusercontent.com/PyneSys/PyneIDE/main/README.md); WT `package.json` contributes; R-AXIS |
| Data picker | Symbol browser + wizard | Datafeed URL + mock flag | No per-run symbol UI | **Match** with a **command/quick-pick**, not a Data studio | [PyneIDE README](https://raw.githubusercontent.com/PyneSys/PyneIDE/main/README.md); `src/host/history-client.ts`; WT `package.json` `axis.chart.useMockBars` |
| OHLCV table / download providers | Yes | No | Nice-to-have | **Later** (conflicts with simplify if it becomes a studio) | [OVSX package.json](https://open-vsx.org/api/pynesys/pyneide/0.14.1/file/package.json) `customEditors` `pyneide.ohlcvTable`; WT `package.json` (none) |
| Chart styles / log / % / measure / fullscreen / data window / layers popup | Yes | Minimal HUD | TV-like chart UX | **Match** layers+data window+fullscreen P0; styles/measure P1 — **chart chrome only**, not Layers studio | [CHANGELOG 0.1.0 / 0.13.0](https://raw.githubusercontent.com/PyneSys/PyneIDE/main/CHANGELOG.md); `webview/chart/src/main.ts` `renderPlotCount`; R-AXIS §3 |
| Debugger (bar step, chart BP, sourcemap) | Headline feature | None | Main PyneIDE differentiator | **Exceed** later in PYNE or IDE; **not P0** while chart/run is empty. Do not depend on ms-python | [OVSX package.json](https://open-vsx.org/api/pynesys/pyneide/0.14.1/file/package.json) `debuggers` type `pyne`; WT `package.json` (none) |
| Line profiler | Yes | None (old profiler store is simplify-bloat) | — | **Later**; do not restore deleted profiler studio | [CHANGELOG 0.10.0](https://raw.githubusercontent.com/PyneSys/PyneIDE/main/CHANGELOG.md); R-AXIS §4 (profiler gone in WT) |
| Robustness / Monte Carlo | Yes (Core 6.13+) | None | — | **Later** (engine feature; surface as chart tab) | [CHANGELOG 0.14.0](https://raw.githubusercontent.com/PyneSys/PyneIDE/main/CHANGELOG.md); WT `package.json` commands |
| Managed uv/Python env | Yes (~80 MB) | No; uses user’s PYNE env / Pro | Setup friction vs download tax | **Skip** cloning uv bootstrap; **Exceed** with Pyodide + documented PYNE env | R-VSIX SECURITY.md / uv download URL in `extension.js`; `src/host/pyodide-profile.ts` |
| PyneCore plugin manager | Yes | No (old Plugins studio in-flight delete) | — | **Skip** as AXIS studio; **Later** if HOOX has a plugin API | R-VSIX command `pyneide.openPlugins`; WT `package.json` (no plugins view); R-AXIS §6 |
| Workspace Scripts/Data/Output view | Activity bar | None | — | **Skip** restoring Scripts studio; Output channel is enough + Explorer | [OVSX package.json](https://open-vsx.org/api/pynesys/pyneide/0.14.1/file/package.json) `viewsContainers`; WT `package.json` contributes.views none; R-AXIS §6 |
| Walkthrough / init demos | Yes | Sample `fixtures/sample.axis.json` only | Onboarding | **Match** light: one sample `.pyne` + `.axis.json` in docs/fixtures, not a wizard product | [CHANGELOG 0.1.0](https://raw.githubusercontent.com/PyneSys/PyneIDE/main/CHANGELOG.md) walkthrough; `fixtures/sample.axis.json`; WT `package.json` (no walkthroughs) |
| Agent skills / AGENTS.md generator | Yes | This repo has AGENTS.md for *contributors* | User-project agents | **Later** | [CHANGELOG 0.13.0](https://raw.githubusercontent.com/PyneSys/PyneIDE/main/CHANGELOG.md); this repo `AGENTS.md` |
| Secrets | OS secret store | VS Code SecretStorage; never settings | AXIS stricter in code (no status bar) | **Exceed** (keep) | [PyneIDE README](https://raw.githubusercontent.com/PyneSys/PyneIDE/main/README.md); `src/secrets/`; `src/extension.ts` (no statusBar) |
| Remote endpoint gate | `pyneide.apiBaseUrl` (dev) | App-scope `allowRemoteEndpoint` default false | — | **Exceed** (keep) | [OVSX package.json](https://open-vsx.org/api/pynesys/pyneide/0.14.1/file/package.json); WT `package.json` `axis.engine.allowRemoteEndpoint` |
| Webview CSP | **Unknown** (not audited) | Paint-only `connect-src 'none'` | — | **Exceed** (keep; document) | `src/editors/chart-html.ts`; `docs/csp-matrix.md`; R-AXIS §3 |
| Cloud upload of Pine on Run | Yes unless cache | Not in this repo | Privacy | **Exceed**: never upload source unless user opts into a remote compiler | [PyneIDE README Privacy](https://raw.githubusercontent.com/PyneSys/PyneIDE/main/README.md); `src/run/engine-http.ts` |
| Telemetry | None claimed | Default offline | — | **Match** / keep off | [PyneIDE README](https://raw.githubusercontent.com/PyneSys/PyneIDE/main/README.md); WT `package.json` `axis.telemetry.offline` |
| Open VSX / VSCodium | Yes since 0.10.0 | Yes (pack + IDE) | AXIS listing stale | **Exceed**: keep OVSX first-class; **fix Marketplace README** (docs follow-on) | [CHANGELOG 0.10.0](https://raw.githubusercontent.com/PyneSys/PyneIDE/main/CHANGELOG.md); [AXIS OVSX](https://open-vsx.org/api/hoox-sh/axis-ide) |
| License | GPL-3.0-only IDE; closed compiler | AGPL-3.0-only | Network copyleft | **Exceed** on IDE license; **do not copy** PyneComp | [OVSX API](https://open-vsx.org/api/pynesys/pyneide); WT `package.json` `license`; [about](https://pynesys.io/about/) |
| Pricing | Compile $8–48/mo | Extension free; Pro claimed free **in README only** (not a src fact) | — | **Exceed** if HOOX Pro/local path stays free for compile+run | [pynesys.io](https://pynesys.io/); [AXIS Marketplace](https://marketplace.visualstudio.com/items?itemName=hoox-sh.axis-ide) Free; WT README is **not** AXIS-today src |
| VS Code min | 1.90 | 1.95 | Slightly fewer hosts | **Later** consider 1.90 if it costs nothing | [OVSX package.json](https://open-vsx.org/api/pynesys/pyneide/0.14.1/file/package.json) `engines.vscode`; WT `package.json` `^1.95.0` |
| Untrusted/virtual workspaces | Explicitly unsupported | **Unknown** (not declared) | Declare capabilities | **Match** declare `untrustedWorkspaces: false` if run executes code | R-VSIX `capabilities`; WT `package.json` (no `capabilities` key) |
| Debugger DAP type `pyne` | Yes | n/a | Name collision risk if AXIS adds one | **Skip** reusing type id `pyne` if PYNE/AXIS add a DAP — pick `axis-pyne` / `hoox-pyne` | [OVSX package.json](https://open-vsx.org/api/pynesys/pyneide/0.14.1/file/package.json) `debuggers`; WT `package.json` |

---

## Match list (parity AXIS must support)

These are user-visible PyneIDE capabilities required to **not lose** a Pine/Pyne developer who tries both. Language items are pack-level.

### P0 — run + chart loop (this repo, still lightweight)

1. **Runnable without a paid cloud compiler for Pyne** — local engine (shipped Pyodide **or** documented local PYNE/Pro loopback) so “press Run, see candles + plots” works. Today Pyodide is a stub and `/run` needs a key.
2. **Title-bar Stop** that aborts the in-flight `/run` or worker (PyneIDE Stop-replaces-Run).
3. **Paint engine plot kinds** already listed in AGENTS.md: `plot`, `hline`, `bgcolor`, `plotshape`, `plotchar`, `plotarrow` — plus histogram/step/area/`barcolor`/`plotcandle` as the engine emits them.
4. **Strategy overlay**: trade markers, equity curve, trades table, stats block, CSV export — **inside the chart webview tabs**, not a restored Results studio.
5. **Inputs panel**: read `input.*`, edit, persist sidecar (TOML or `*.axis.json` fields), re-run without mutating source.
6. **Per-plot layers popup** on the chart (toggle visibility). This is **not** the deleted Layers studio.
7. **Data Window** for the hovered (or last) bar: OHLCV + plot values.
8. **Shared data pick**: symbol/timeframe/history vs mock — Quick Pick or chart toolbar, using existing `HistoryClient` + mock flag.
9. **Open Chart Source** from the chart toolbar (sibling Pine file).
10. **Fullscreen chart** and **legend** with script title.
11. **Run output**: keep `AXIS Run` channel; add `AXIS: Show Run Output` back as a **command**, not a panel studio.
12. **Streaming or progressive paint** so long runs are not a blank chart until `/run` returns.

### Pack-level Match (do not reimplement in AXIS)

13. Pine LS diagnostics/completion/hover/signature (PYNE).
14. Convert to v6 (PYNE).
15. `.pyne` / `.pine` file association (PYNE). Keep AXIS menus on `pinescript` **and** whatever language ids PYNE actually registers (today menus use `pinescript` only — verify `.pyne` / `.pine` `when` clauses).

---

## Exceed list (better than PyneIDE — concrete)

No slogans. Each item is shippable.

1. **No source upload by default.** PyneIDE Run on `.pine` sends source to PyneComp unless the hash cache hits ([README Privacy](https://github.com/PyneSys/PyneIDE)). AXIS: compile/run on-device (Pyodide or local `hoox-pyne`) and treat any remote compiler as an explicit opt-in behind `allowRemoteEndpoint`.
2. **Ship Pyodide for real.** Version already locked `0.29.5` in `pyodide-profile.ts`. Exceed means: vendor or fetch-once Wasm, `ready: true` when `allowPyodide`, bars-in calculator produces the same `/run` result shape. PyneIDE cannot run inside the webview; it downloads CPython 3.14 (~80 MB) via uv.
3. **Paint-only CSP + host-proxied datafeed.** Keep `connect-src 'none'` on the chart. PyneIDE’s chart stack is unaudited here; AXIS can publish the CSP matrix as a product promise.
4. **Secrets never in files.** PyneIDE data-provider keys live in **workdir config** (their README). AXIS: SecretStorage only (`src/secrets/`); **no status bar** in lightweight core (`src/extension.ts`); scrub logs (`src/run/scrub.ts`). Keep that as a differentiator; do not add `.env` key settings.
5. **Loopback-fail-closed.** `allowRemoteEndpoint` application-scope. Document it next to Run.
6. **AGPL-3.0-only** on the IDE + network copyleft vs GPL-3.0-only + **closed PyneComp**. Users who care about a fully open Pine path can stay on HOOX. Do not claim “more open” without also open-sourcing the compiler/runtime AXIS actually uses — point at `hoox-sh/pyne` instead of implying PyneComp-equivalent.
7. **VSCodium / Open VSX as a first-class path**, not an afterthought (PyneIDE added OVSX in 0.10.0). Keep publishing both; AXIS pack already exists.
8. **Split extensions.** Language (PYNE) works without the chart. PyneIDE is one 2.2 MB blob that activates on `onStartupFinished`. AXIS: stay lazy (`onCustomEditor` + commands; no `onStartupFinished`).
9. **Typed `axis.webview.v1` + 100% protocol coverage.** Engineering quality bar PyneIDE does not advertise. Keep the ratchet; use it to add plot/strategy messages instead of ad-hoc `postMessage`.
10. **HOOX wiring:** same `/run` contract as AXIS PWA and CF worker example in README. One engine, three shells (PWA, VS Code, worker). PyneIDE is VS Code + CLI only.
11. **Lightweight Charts already bundled** — use it for log scale, percent scale, and multiple series types (histogram, area) that LWC supports natively, instead of adopting KLineChart.
12. **Fix the public listing** so Marketplace/Open VSX description matches lightweight reality (today they still sell live sessions). Honesty is a feature PyneIDE’s listing already has.
13. **Free Pine iterate** if HOOX Pro remains free (README “Pro (free)”). That undercuts Seed–Forest **$8–$48/mo** for people who want to stay in `.pine`. If Pro is not actually free, stop saying it.
14. **Chart document as git-friendly `*.axis.json`** (viewport, symbol, drawings) vs PyneIDE’s ephemeral panel + scattered CSV/JSON under `output/`. Exceed: one sidecar next to the script, already the AXIS model.

---

## Out of scope / do not copy

- PyneSys / PyneIDE / PyneCore / PyneComp **names, logos, “Once Upon a Pine” branding**, forest-plan names.
- **PyneComp** binaries, cloud API, or reverse-engineering the compiler ([terms](https://pynesys.io/terms/) forbid reverse-engineering conversion algorithms).
- Shipping **their** managed uv/Python tree or Pine LS blobs.
- Debug adapter type id **`pyne`** and command prefix **`pyneide.*`**.
- Restoring AXIS **Workers, Plugins, Alerts, Watchlist, Scripts, Layers studios** to “look like” the Pyne Workspace view. PyneIDE’s tree is a different product; the simplify card forbids that bloat unless a later Chief decision reopens it.
- Cloning Marketplace screenshots or GIF assets.
- Claiming TradingView affiliation (neither product is affiliated; keep the notice).
- Installing PyneIDE into the user’s VSCodium as a “parity test” without a new task (not done here).

---

## Proposed AXIS product feature list (Engineering cards)

Conflict flag: **simplify-in-flight**. Anything that adds a `contributes.views` studio is **blocked** unless Chief overrides. Chart-webview UI is allowed.

### P0 — parity (Match), lightweight

| ID | Feature | Owner | Done when |
| --- | --- | --- | --- |
| P0-1 | Make Pyodide **actually run** or fail the setting (ship Wasm or download-once; `pyodideRuntimeStatus.ready` true) | IDE | `allowPyodide: true` runs a sample script to plots without Pro key |
| P0-2 | Local loopback PYNE `/run` without requiring a key when endpoint is loopback (or a documented “no-auth local engine”) | IDE | Mock-bar RSI paints without SecretStorage |
| P0-3 | Stop Run command + title-bar swap | IDE | Hung run aborts; button shows Stop |
| P0-4 | Plot kind paint: line, histogram, step, area, hline, bgcolor, barcolor, shapes | IDE | Fixture engine payload paints each kind |
| P0-5 | Strategy tab in **chart webview**: markers, equity, trades, stats, CSV | IDE | Strategy fixture shows N trades + CSV save |
| P0-6 | Inputs UI + persist in `*.axis.json` or sibling TOML; Save re-runs | IDE | Change length, source untouched, chart updates |
| P0-7 | Chart layers popup + data window + legend + fullscreen + open source | IDE | No new activity-bar views |
| P0-8 | Data Quick Pick (symbol/tf/mock/datafeed) reused by Open Chart and Run | IDE | One picker; uses HistoryClient |
| P0-9 | Progressive `chart.delta` (or chunked full) during run | IDE | Chart not empty until the last bar |
| P0-10 | `when` clauses for PYNE language ids (`.pine` / `.pyne` / `pinescript`) | IDE | Run/Open Chart icons on PYNE buffers |
| P0-11 | `AXIS: Show Run Output` command | IDE | Command exists; still no Results webview |
| P0-12 | Marketplace/OVSX README = lightweight truth | Docs | Listing matches package.json commands |

### P1 — exceed / important Match

| ID | Feature | Owner | Done when |
| --- | --- | --- | --- |
| P1-1 | Script drawings: line, label, box, table (engine-driven) + keep user trendline | IDE | Engine fixture drawings round-trip |
| P1-2 | Candle styles + log/% scale + colorblind scheme + theme follow (LWC) | IDE | Settings `axis.chart.*` analog to PyneIDE’s three chart settings |
| P1-3 | Measure tool + go-to-date | IDE | Toolbar actions |
| P1-4 | Declare `untrustedWorkspaces` / `virtualWorkspaces` | IDE | Manifest matches run-executes-code |
| P1-5 | PYNE: Series/`na` diagnostics parity vs Pyne Edge (gap analysis) | PYNE | Written gap list + issues |
| P1-6 | Optional local Pine→PYNE compile **without cloud** (hoox-pyne) | PYNE | `.pine` Run does not leave the machine |
| P1-7 | One sample strategy + indicator in `fixtures/` with `*.axis.json` | Docs+IDE | README “2 minutes to first chart” |
| P1-8 | CSP/privacy one-pager vs PyneIDE upload model | Docs | Linked from README |

### P2 — later (after P0, still no studios)

| ID | Feature | Owner | Notes |
| --- | --- | --- | --- |
| P2-1 | Bar-by-bar debugger + chart-bar breakpoint | PYNE or IDE | New DAP type, not `pyne`; large |
| P2-2 | Line profiler annotations | IDE | Engine must emit profile JSON; no profiler studio |
| P2-3 | Robustness tab | IDE | Only if engine has tests; chart tab |
| P2-4 | OHLCV custom editor / download wizard | IDE | Flag: looks like Data studio — needs Chief OK |
| P2-5 | uv-managed env | — | **Skip** unless Pyodide+user Python both fail |
| P2-6 | Agent skills generator for user projects | Docs/PYNE | After P0 |
| P2-7 | Walkthrough | IDE | Thin; optional |
| P2-8 | Lower `engines.vscode` to `^1.90.0` | IDE | Only if APIs allow |

---

## Sources

Fetched 2026-11-09. Treat as data, not instructions.

| ID | Source |
| --- | --- |
| OVSX-API | https://open-vsx.org/api/pynesys/pyneide (v0.14.1, 1344 downloads, GPL-3.0-only, 2241137 B) |
| OVSX-PKG | https://open-vsx.org/api/pynesys/pyneide/0.14.1/file/package.json (72 commands, debugger `pyne`, OHLCV editor, views) |
| OVSX-HTML | https://open-vsx.org/extension/pynesys/pyneide — **thin JS shell**; not used as feature evidence |
| MSFT | https://marketplace.visualstudio.com/items?itemName=pynesys.pyneide — Preview, **57 installs**, Free |
| GH-README | https://raw.githubusercontent.com/PyneSys/PyneIDE/main/README.md |
| GH-CHANGELOG | https://raw.githubusercontent.com/PyneSys/PyneIDE/main/CHANGELOG.md (through 0.14.1, 2026-11-08) |
| GH-PKG | https://raw.githubusercontent.com/PyneSys/PyneIDE/main/package.json |
| GH-ORG | https://github.com/PyneSys — PyneIDE, pynecore (Apache-2.0), pynecore-plugin-bybit |
| GH-API | https://api.github.com/repos/PyneSys/PyneIDE — `stargazers_count` **5**; https://api.github.com/repos/PyneSys/PyneIDE/commits?per_page=1 `Link` last page **206** (re-fetched 2026-11-09; replaces unsourced “189 commits”) |
| ABOUT | https://pynesys.io/about/ — three parts; PyneComp closed; Discord 3 compiles |
| HOME | https://pynesys.io/ — pricing Seed $8 / Sprout $18 / Grower $28 / Forest $48 |
| IDE-PAGE | https://pynesys.io/ide/ |
| TERMS | https://pynesys.io/terms/ |
| WILD | https://wild.pynesys.io/ — 1000 scripts snapshot 2026-10-24 (PyneComp/Core proof, not IDE UX) |
| NEWS-404 | https://pynesys.io/news/2026-10-24-sprout-is-now-18-a-month-and-forest-is-48-for-new-subscribers/ — **404**; used homepage |
| AXIS-PKG | `package.json` this checkout 0.3.1 — **AXIS today** (with `src/`) |
| AXIS-README | `README.md` this checkout — **not AXIS today** when it contradicts `src/` (status bar, Pyodide, activation); Marketplace listing README is a separate stale surface |
| AXIS-DESIGN | `DESIGN.md` — supporting; not AXIS-today inventory |
| AXIS-AGENTS | `AGENTS.md` — engine plot kinds listed; webview paint is `src/` |
| AXIS-EXT | `src/extension.ts` — no statusBar; diagnostics.set no-op / output-only |
| AXIS-RUN | `src/run/orchestrator.ts`, `src/run/engine-http.ts` |
| AXIS-PAINT | `webview/chart/src/paint.ts`, `main.ts` |
| AXIS-PYODIDE | `src/host/pyodide-profile.ts` (stub, Wasm not shipped) |
| AXIS-OVSX | https://open-vsx.org/api/hoox-sh/axis-ide — 0.3.1, 428 downloads, stale description |
| AXIS-MSFT | https://marketplace.visualstudio.com/items?itemName=hoox-sh.axis-ide — **1 install**, stale README |
| PYNE-OVSX | https://open-vsx.org/api/hoox-sh/pyne — 0.5.7, 5088 downloads |
| PACK | `pack/README.md` — `hoox-sh.axis-pack` |
| BOARD | `.openorchestrate/board.md` — simplify card Ready for Review at write time; do not restore studios |
| R-AXIS | `docs/competitive/_research-axis-current.md` — WT vs HEAD vs shipped |
| R-PUB | `docs/competitive/_research-pyneide-public.md` |
| R-VSIX | `docs/competitive/_research-pyneide-vsix.md` — 72 commands; bundled **klinecharts 10.1.0** (`dist/chart-webview.js` welcome string + npm dep); Pine LS not in VSIX; shipped changelog 0.1.0 names KLineChart |

**Not done:** download/install of PyneIDE VSIX into VSCodium; runtime click-through of their chart. Manifest + VSIX/changelog are sufficient for a feature list; **Unknown** remains on klinecharts performance and exact Pine LS quality vs `hoox-pyne`. Do not cite Marketplace README for the chart library name.
