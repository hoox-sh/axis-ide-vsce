# PyneIDE VSIX / manifest inspect

Ground-truth from the **shipped binary**, not marketing. No comparison, no AXIS claims.

| Field | Value |
| --- | --- |
| Inspected | 2026-11-09 |
| Source | Open VSX API `https://open-vsx.org/api/pynesys/pyneide` → latest `0.14.1` |
| Download URL | `https://open-vsx.org/api/pynesys/pyneide/0.14.1/file/pynesys.pyneide-0.14.1.vsix` |
| Temp VSIX (not committed) | `/tmp/pyneide-inspect/pynesys.pyneide-0.14.1.vsix` |
| Unpacked | `/tmp/pyneide-inspect/unpacked/` |
| SHA-256 (local) | `a924e75bf2b0247dca480be93bb93847689daec8b0c584e21dcb68ab2d0acd66` (matches Open VSX `.sha256`) |
| Size | 2,241,137 bytes (Open VSX `downloadSizes.universal` = 2241137) |
| Unpacked files | 827 (zip listing); payload uncompressed ~8.4 MB, mostly bundled pyright typeshed |
| Published | 2026-11-08T21:46:51Z (Open VSX timestamp) |
| Gallery | Open VSX `preview: true`, `verified: true`, `publishedWithTrustedPublishing: true`, downloadCount ~1340 at inspect time |
| Pricing (vsixmanifest) | `Microsoft.VisualStudio.Services.Content.Pricing` = **Free** |
| Installed into VSCodium? | **No** (inspect-only unzip in `/tmp`) |

---

## Identity

| Field | Value |
| --- | --- |
| Extension id | `pynesys.pyneide` |
| `name` | `pyneide` |
| `publisher` | `pynesys` |
| `displayName` | PyneIDE: Pine Script Debugger and Backtester |
| `version` | **0.14.1** |
| `author` | PYNESYS LLC |
| `license` | `GPL-3.0-only` |
| `preview` | `true` |
| `main` | `./dist/extension.js` |
| `engines.vscode` | `^1.90.0` |
| `extensionKind` (vsixmanifest) | `workspace` |
| `ExecutesCode` | `true` |
| Categories | Programming Languages, Debuggers, Linters, Visualization, Snippets |
| Keywords | pine script, pinescript, pyne, pynecore, trading, indicators, strategies, backtesting |
| Homepage | https://pynesys.io |
| Repository | https://github.com/PyneSys/PyneIDE |
| Bugs / QnA | https://github.com/PyneSys/PyneIDE/issues |
| `galleryBanner` | color `#1A1B1C`, theme `dark` |

### Activation events

```
onStartupFinished
onLanguage:python
onLanguage:pine
onLanguage:pyne
onDebugDynamicConfigurations:pyne
onCustomEditor:pyneide.ohlcvTable
onUri
```

### Capabilities

| Capability | Supported | Description (from package.json) |
| --- | --- | --- |
| `untrustedWorkspaces` | **false** | Compiles, runs and debugs workspace scripts; launches interpreters from workspace settings |
| `virtualWorkspaces` | **false** | Needs a local filesystem for the Python environment and compile/run/debug |

### Dependencies (npm, declared in package.json)

| Package | Version | Role in VSIX |
| --- | --- | --- |
| `klinecharts` | `^10.1.0` | Bundled into `dist/chart-webview.js` (string: “Welcome to klinecharts. Version is 10.1.0”) |
| `pyright` | `1.1.411` | Vendored under `dist/pyright/` (MIT, Microsoft) |
| `vscode-languageclient` | `^9.0.1` | Used from bundled `dist/extension.js` |

- `extensionDependencies`: **none** (no Microsoft Python extension required).
- `extensionPack` / `bundledExtensions`: **none**.
- `enabledApiProposals`: **none**.

### Activation / workspace trust (SECURITY.md, shipped)

Runs local code: downloads and manages a Python env, spawns `uv`, `python`, `pyne`, `debugpy`; stores compile API key in SecretStorage; talks to the PyneSys compile service. No automatic telemetry claimed in README badge.

---

## Contributes inventory

`contributes` keys: `configurationDefaults`, `commands`, `menus`, `colors`, `keybindings`, `viewsContainers`, `views`, `viewsWelcome`, `walkthroughs`, `breakpoints`, `debuggers`, `configuration`, `languages`, `grammars`, `snippets`, `customEditors`.

**Not present:** `webviews` contribution point, `taskDefinitions`, `problemMatchers`, `terminal`, `notebooks`, `authentication`, `mcpServerDefinitionProviders`, `chatParticipants`, `languageModelTools`, `iconThemes`, `themes`.

### Commands (72 declared)

All `category: PyneIDE`. Hidden extra: keybinding `pyneide.workspace.deleteSelected` is **not** in `contributes.commands`.

| Command | Title | Enablement |
| --- | --- | --- |
| `pyneide.setupEnvironment` | Setup Environment | — |
| `pyneide.createWorkspace` | Initialize Pyne Project | — |
| `pyneide.editAgentRules` | Edit Agent Rules… | `pyneide.hasWorkdir` |
| `pyneide.updateAgentFiles` | Update Agent Files | `pyneide.hasWorkdir` |
| `pyneide.openWalkthrough` | Get Started | — |
| `pyneide.openSettings` | Open Settings | — |
| `pyneide.removeEnvironment` | Remove Environment | — |
| `pyneide.revealEnvironmentFolder` | Reveal Environment Folder | — |
| `pyneide.showEnvironmentLog` | Show Environment Log | — |
| `pyneide.openDocs` | Documentation | — |
| `pyneide.reportProblem` | Report a Problem | — |
| `pyneide.environmentMenu` | Environment Menu | — |
| `pyneide.signIn` | Sign In to PyneSys | — |
| `pyneide.showPineAccess` | Pine Script Plans and API Key | — |
| `pyneide.signOut` | Sign Out from PyneSys | — |
| `pyneide.pineLsInstall` | Install / Update Pine Language Server | — |
| `pyneide.pineLsRestart` | Restart Pine Language Server | — |
| `pyneide.pineLsShowLog` | Show Pine Language Server Log | — |
| `pyneide.pyrightRestart` | Restart Pyne Typing (pyright) | — |
| `pyneide.pyrightShowLog` | Show Pyne Typing Log | — |
| `pyneide.usePyneAnalysis` | Use PyneIDE for Python Analysis (instead of Pylance) | — |
| `pyneide.compilePine` | Compile Pine Script | `editorLangId == pine` |
| `pyneide.convertToV6` | Convert Pine to v6 | `editorLangId == pine` |
| `pyneide.showUsage` | Show Compile Usage | — |
| `pyneide.toggleStrictCompile` | Toggle Strict Compilation | — |
| `pyneide.runScript` | Run Pyne code | `pyneide.isPyneScript \|\| resourceLangId == pine` |
| `pyneide.debugScript` | Debug Pyne code | same |
| `pyneide.runPineScript` | Run Pine Script | `resourceLangId == pine` |
| `pyneide.debugPineScript` | Debug Pine Script | `resourceLangId == pine` |
| `pyneide.profileScript` | Profile Pyne code | `pyneide.isPyneScript \|\| resourceLangId == pine` |
| `pyneide.profilePineScript` | Profile Pine Script | `resourceLangId == pine` |
| `pyneide.robustnessScript` | Run Robustness Tests | `pyneide.isPyneScript \|\| resourceLangId == pine` |
| `pyneide.robustnessPineScript` | Run Robustness Tests on Pine Script | `resourceLangId == pine` |
| `pyneide.showProfile` | Show Profile | — |
| `pyneide.hideProfile` | Hide Profile | — |
| `pyneide.changeRunData` | Select Data… | `pyneide.isPyneScript \|\| resourceLangId == pine` |
| `pyneide.openChart` | Open Chart | same |
| `pyneide.selectBreakpointBar` | Choose Bar on Chart… | same |
| `pyneide.toggleChartFullscreen` | Toggle Chart Fullscreen | — |
| `pyneide.openChartSource` | Open Chart Source | `activeWebviewPanelId == pyneideChart && pyneide.chartHasInputs` |
| `pyneide.pauseRun` | Pause Run at Next Bar | `pyneide.runActive && !pyneide.runPaused` |
| `pyneide.resumeRun` | Resume Run | `pyneide.runPaused` |
| `pyneide.stepBar` | Next Bar | `pyneide.runActive` |
| `pyneide.runToBar` | Run to Bar… | `pyneide.runActive` |
| `pyneide.cancelRun` | Stop Run | `pyneide.runActive` |
| `pyneide.runControlMenu` | Run Controls | `pyneide.runActive` |
| `pyneide.workspace.refresh` | Refresh | — |
| `pyneide.workspace.createScript` | New Script… | — |
| `pyneide.dataDownloadWizard` | Download Data… | — |
| `pyneide.openSymbolBrowser` | Open Symbol Browser | — |
| `pyneide.openPlugins` | Manage Plugins | — |
| `pyneide.editSymbolMap` | Edit Symbol Map | — |
| `pyneide.openSymbolMap` | Open Symbol Map | — |
| `pyneide.showDataRequirements` | Show Data Requirements | — |
| `pyneide.workspace.runScript` | Run Pyne code | — |
| `pyneide.workspace.debugScript` | Debug Pyne code | — |
| `pyneide.workspace.runPineScript` | Run Pine Script | — |
| `pyneide.workspace.debugPineScript` | Debug Pine Script | — |
| `pyneide.workspace.profileScript` | Profile Pyne code | — |
| `pyneide.workspace.profilePineScript` | Profile Pine Script | — |
| `pyneide.workspace.selectData` | Select Data… | — |
| `pyneide.workspace.openTable` | Open as Table | — |
| `pyneide.dataUpdate` | Update (continue) | — |
| `pyneide.dataTruncate` | Truncate & Re-download… | — |
| `pyneide.dataDownloadTimeframe` | Download Other Timeframe… | — |
| `pyneide.dataPreviewChart` | Preview Chart | — |
| `pyneide.dataDelete` | Delete Data… | — |
| `pyneide.scriptDelete` | Delete | — |
| `pyneide.outputDelete` | Delete | — |
| `pyneide.workspace.openOutputChart` | Open Chart | — |
| `pyneide.workspace.revealInExplorer` | Reveal in Explorer | — |
| `pyneide.editInputs` | Edit Inputs… | `pyneide.isPyneScript \|\| resourceLangId == pine \|\| pyneide.chartHasInputs` |

Palette hides: convert-to-v6 unless `pyneide.canConvertToV6`; Pyne vs Pine run/debug/profile/robustness split by `resourceLangId`; workspace duplicates of run/debug/profile use `"when": "false"` (view-only).

### Menus

| Menu | Count | What it wires |
| --- | --- | --- |
| `commandPalette` | 16 | Language-split run/debug/profile/robustness; hide workspace clones |
| `editor/lineNumber/context` | 1 | Choose Bar on Chart… |
| `editor/context` | 13 | Compile, convert, run, debug, profile, robustness, data, chart, inputs |
| `editor/title` | 12 | Run/debug/profile + chart/inputs/fullscreen/open-source + OHLCV preview |
| `debug/toolBar` | 2 | Next Bar, Run to Bar… when `debugType == pyne` |
| `view/title` | 6 | Refresh, settings, walkthrough, docs, agent rules/files |
| `view/item/context` | 33 | Scripts/data/outputs tree: run, debug, profile, data ops, delete, reveal |

### Views / containers

| Kind | Id | Title |
| --- | --- | --- |
| Activity bar container | `pyneide` | Pyne (`./icons/pyne-view.svg`) |
| View | `pyneide.workspace` | Workspace (contextualTitle Pyne) |

`viewsWelcome` on `pyneide.workspace` when `!pyneide.hasWorkdir`: Initialize / Get Started / Documentation.

Tree `viewItem` context keys observed in menus: `pyneSection.scripts`, `pyneSection.data`, `pyneSymbolMapRoot`, `pyneScriptPine`, `pyneScript`, `pyneLibrary`, `pyneLibraryRoot`, `pyneLibraryPublisher`, `pyneLibraryFolder`, `pyneFile`, `pyneData`, `pyneChartOutput`, `pyneOutput`.

### Languages

| Id | Aliases | Files | Config / icon |
| --- | --- | --- | --- |
| `pyne` | Pyne, pyne | (no extensions; `@pyne` Python mode) | `language-configuration-pyne.json`; pine-file.svg |
| `pine` | Pine Script, pine, pinescript | `.pine`, `.psc` | `language-configuration.json`; pine-file.svg |
| `toml` | TOML | `.toml` plus lockfile names (`Cargo.lock`, `Pipfile`, `poetry.lock`, `uv.lock`, `Gopkg.lock`) | `language-configuration-toml.json` |
| `json` | — | `filenamePatterns: *.py.map` | (sourcemap association) |

### Grammars

| Language / scope | Path | Notes |
| --- | --- | --- |
| `pine` / `source.pine` | `syntaxes/pine.tmLanguage.json` | Full Pine TM grammar |
| `toml` / `source.toml` | `syntaxes/toml.tmLanguage.json` | Bundled TOML grammar |
| inject `pyne.injection` | `syntaxes/pyne.injection.json` | Injects into `source.python` and `source.python.pyne` |
| inject `pyne.variables.injection` | `syntaxes/pyne.variables.injection.json` | Injects into `source.python.pyne` |
| `pyne` / `source.python.pyne` | `syntaxes/pyne.tmLanguage.json` | Tiny stub (106 bytes); Pyne reuses Python highlighting + injections |

### Snippets

`contributes.snippets` lists **only** `language: pine` → `snippets/pine.json`.

`snippets/pyne.json` is **on disk** (19 prefixes) but **not** contributed. Pine snippets (18): Indicator/Strategy/Library skeleton, ATR trailing stop, Alert condition, Bars since / value when, Bollinger Bands, Conditional color plot, Entry with SL/TP, Higher timeframe request, Input group, Last bar label, MACD, MA crossover, Persistent counter, RSI with bands, Signal markers, Stats table.

### Custom editors

| viewType | Display name | Selector | Priority |
| --- | --- | --- | --- |
| `pyneide.ohlcvTable` | OHLCV Table | `*.ohlcv` | default |

Chart is **not** a custom editor; menus/enablement use `activeWebviewPanelId == pyneideChart`.

### Debuggers / breakpoints

Debugger type `pyne`, label **Pyne**, languages `pyne` + `pine`.

Launch properties: `script` (default `${file}`), `data` (OHLCV; bare name in `<workdir>/data`), `justMyCode`, `variablePresentation` (debugpy grouping). Attach: `connect.host/port` for an already-running bridge.

Breakpoints contributed for `python`, `pine`, `pyne`.

### Keybindings

| Command | Key | When |
| --- | --- | --- |
| `pyneide.workspace.deleteSelected` | Delete (Mac: Backspace) | `focusedView == pyneide.workspace` |

### Colors (8)

All profiler UI: `pyneide.profile.{hot,warm,mild,measured}Background`, `{hot,warm,mild}Ruler`, `annotationForeground`.

### Walkthroughs

One: `pyneide.gettingStarted` — “Get Started with PyneIDE”, featured for `**/*.pine`, `**/*.psc`. Steps:

1. **environment** — Set up the Pyne runtime (Python + uv shared; no Microsoft Python extension).
2. **project** — Initialize a Pyne project (workdir, demo script, sample data).
3. **run** — Run on a chart (Pine demos run without account; strategies get trade markers, equity, Trades/Stats).
4. **debug** — Bar-by-bar debugger, Pyne scope, `close[1]` in Pine terms.
5. **pine** — Cloud compile own Pine (plan + API key); Pyne local; free v4/v5→v6.
6. **script** — New indicator/strategy/library as `.pine` or `@pyne` `.py`; TV-compatible library layout.
7. **data** — Symbol search, OHLCV download, table/chart preview, Symbol Map for `request.security()`.

### Configuration (6 sections, 30 properties)

#### General (`pyneide.general`)

| Key | Type | Default |
| --- | --- | --- |
| `pyneide.workdir` | string | `""` (search upward for `workdir`) |
| `pyneide.strictCompile` | boolean | `false` |
| `pyneide.run.revealOutputOnLog` | boolean | `true` |
| `pyneide.debug.justMyCode` | boolean | `true` |
| `pyneide.chart.candleStyle` | enum | `candles` (`candles`, `hollow`, `bars`, `mono`, `line`, `area`) |
| `pyneide.chart.colorScheme` | enum | `classic` (`classic`, `theme`, `colorblind`) |
| `pyneide.chart.priceScale` | enum | `normal` (`normal`, `logarithm`, `percentage`) |
| `pyneide.reportProblem.includeLogs` | boolean | `true` (machine scope; confirm before send) |

#### Code intelligence (`pyneide.codeIntelligence`)

| Key | Default | Meaning |
| --- | --- | --- |
| `pyneide.checker.enabled` | true | Pyne structure checker (`main()`, `@script`, Series/Persistent, `request.security`) |
| `pyneide.pyright.enabled` | true | Bundled pyright; auto-off if Pylance/Pyright/BasedPyright installed |
| `pyneide.pineLs.enabled` | true | Pine LS; **signed native binary installed into extension storage** (not in VSIX) |
| `pyneide.pineLs.autoUpdate` | true | Daily check; atomic install + rollback |

#### Environment (`pyneide.environment`)

| Key | Default | Meaning |
| --- | --- | --- |
| `pyneide.pynecore.version` | `""` | Empty = latest stable; min **6.12.1** |
| `pyneide.pythonPath` | `""` | Bypass managed env; user must install PyneCore + debugpy |
| `pyneide.venvPath` | `""` | Alternate venv; wins over pythonPath |

#### Agent assistance (`pyneide.agents`)

| Key | Default |
| --- | --- |
| `pyneide.showAgentFiles` | false (hide AGENTS/skills in Explorer) |

#### Robustness (`pyneide.robustness`)

| Key | Default |
| --- | --- |
| `draws` | 10000 |
| `seed` | 0 |
| `coinflip` | `direction` (`direction`, `timing`, `both`, `none`) |
| `coinflipRuns` | 200 |
| `exact` | false |
| `earlyStop` | `edge` (`edge`, `better`, `off`) — needs PyneCore ≥ 6.13.1 |
| `jobs` | 0 (CPU-1) — needs PyneCore ≥ 6.13.1 |
| `costBps` | `[0, 2, 5, 10]` |
| `riskPercent` | 1 |
| `ruinPercent` | 50 |
| `maxLeverage` | null |
| `targetMultiple` | null |

#### Development (order 99, hidden from Settings UI)

| Key | Default |
| --- | --- |
| `pyneide.apiBaseUrl` | `https://api.pynesys.io` (machine-scoped) |
| `pyneide.pineLs.path` | `""` (skip signature/auto-update) |
| `pyneide.pineLs.baseUrl` | `https://pine-ls.pynesys.io` |

### Configuration defaults (workspace)

- Hide `**/.pyneide`.
- File nesting on: `*.pine` nests `.py`, `.py.map`, `.toml`; `*.py` nests map+toml; `*.ohlcv` nests toml; `*.csv` nests viz/strategy/trade/profile/robustness artifacts.
- Custom editor labels for `scripts/lib/*/*/v*.{pine,py}`.
- `[pyne]`: tabSize 4, insertSpaces.

---

## Implied features (from command titles + walkthrough + README shipped in VSIX)

Treat as **declared product surface**, not runtime verification.

1. **Managed local Python runtime** — uv + CPython env per project (`.pyneide/venv`); Setup / Remove / Reveal / log; no Microsoft Python extension required.
2. **Project scaffold** — workdir, scripts/data/outputs tree, Pine demos that run without account.
3. **Cloud Pine compile** — PyneSys account, API key, plans/usage quotas, strict compile, v4/v5→v6 conversion, content-hash cache (`.py.map`).
4. **Pine language server** — diagnostics/completion/hover/signature; downloaded signed native binary from `pine-ls.pynesys.io`, not packed in the VSIX.
5. **Pyne language mode** — `@pyne` Python; bundled pyright + Edge checker + series type support (`python/pyneide_series.py`, `pyneide_edge_rules.py`).
6. **Run / debug / profile / robustness** on both Pine and Pyne, with bar-stepping (`Next Bar`, `Run to Bar`, pause/resume).
7. **Interactive chart webview** — klinecharts; candle styles; layers; data window (changelog); inputs form; fullscreen; CSV export artifacts.
8. **OHLCV data pipeline** — download wizard, symbol browser, symbol map, table custom editor (`*.ohlcv`), update/truncate/other timeframe, preview chart.
9. **Plugins** — Manage Plugins; installed into project env (changelog 0.11.0).
10. **Agent files/skills** — AGENTS.md + skills for pine/pyne/workflow; Edit Agent Rules / Update Agent Files.
11. **Auth / billing surface** — Sign in/out, plans and API key panel, compile usage.
12. **Problem reporter** — optional log attach after confirmation.

---

## Bundled runtime clues

**Not in the VSIX:** Pyodide, CPython interpreter, `.wasm`, `.so`/`.node`, tree-sitter, lightweight-charts, plotly, monaco.

| Clue | Evidence |
| --- | --- |
| **Local CPython via uv** | Walkthrough + SECURITY.md; `extension.js` contains `https://github.com/astral-sh/uv/releases/download/$`; env in `.pyneide/venv` (changelog 0.11.0) |
| **PyneCore (not bundled)** | Min 6.12.1; installed into managed venv; Apache-2.0 runtime per README badge |
| **debugpy** | 28 hits in `extension.js`; debugger attach to bridge; `python/pydevd_plugins/` |
| **Python bridge (shipped)** | `python/pyneide_bridge/` — `python -m pyneide_bridge`; NDJSON protocol v3; runner, control (pause/step), debug_inspect, robustness, provider_service |
| **klinecharts 10.1.0** | `dist/chart-webview.js` welcome string; npm dep |
| **Bundled pyright 1.1.411** | `dist/pyright/` ~8.4 MB including typeshed (`*.pyi` = 752 files) |
| **Pine LS native (not bundled)** | Downloaded to extension storage from `https://pine-ls.pynesys.io`; Ed25519 verify |
| **Cloud compiler** | `https://api.pynesys.io`, `https://app.pynesys.io` |
| **Data providers** | Bridge `provider_service.py` uses `pynecore.core.plugin` (`ProviderPlugin`, discover/load plugins); `ccxt` string count 4 in `extension.js` |
| **Webviews (runtime, not contributes.webviews)** | Bundled JS: `chart-webview.js` (348k), `inputs-form.js`, `ohlcv-table.js`, `plugins.js`, `symbol-browser.js`, `symbol-map.js` |
| **Host entry** | `dist/extension.js` 785k |

### High-level file tree (shipped)

```
extension/
  package.json, readme.md, changelog.md, LICENSE.txt, COPYRIGHT, SECURITY.md, icon.png
  dist/extension.js, chart-webview.js, inputs-form.js, ohlcv-table.js, plugins.js,
       symbol-browser.js, symbol-map.js
  dist/pyright/          # pyright 1.1.411 + typeshed
  python/pyneide_bridge/ # runner + debug + providers + robustness
  python/pydevd_plugins/ # debugpy plugin
  python/pyneide_edge_rules.py, pyneide_series.py
  syntaxes/, snippets/, language-configuration*.json
  icons/, media/walkthrough/*.svg, media/profile-flame.svg
  resources/pine-demos/  # RSI strategy + SMA cross (.pine/.py/.sourcemap)
  resources/agent-project/, resources/agent-skills/{pine,pyne,pyneide-workflow}/
  signatures/version1/cla.json
```

Sizes (unpacked `extension/`): `dist/` 9.6M (pyright 8.4M), `python/` 236K, rest small.

---

## License files

| Path | Content |
| --- | --- |
| `extension/LICENSE.txt` | GNU GPL v3 full text |
| `extension/COPYRIGHT` | PyneIDE © 2026 PYNESYS LLC, GPL-3; contact pynesys.io. Trademarks: Pine Script (TradingView); PyneCore/PyneComp (PYNESYS LLC); “not affiliated with TradingView” |
| `extension/dist/pyright/LICENSE.txt` | MIT, Microsoft Pyright |
| `extension/dist/pyright/dist/typeshed-fallback/LICENSE` | typeshed license |
| `extension/SECURITY.md` | Private GH advisory reporting; in-scope: host, python bridge, chart webview, env bootstrap, plugin installer, problem reporter |

Open VSX `license`: `GPL-3.0-only`.

---

## Changelog highlights (shipped `changelog.md`)

Versions in package: Unreleased (empty), **0.14.1** (2026-11-08), 0.14.0, 0.13.2, 0.13.1, 0.13.0, 0.11.1, 0.11.0, 0.10.0, 0.9.2, 0.9.1, 0.9.0, 0.1.0 (2026-07-24 first public preview). No 0.12.x.

| Version | Highlights |
| --- | --- |
| **0.14.1** | Robustness coin-flip parallel jobs + earlyStop; “not valid” when too few paired trades |
| **0.14.0** | Robustness tests (Monte Carlo, coin-flip, extra costs) + chart tab + CSV; chart label hover/links |
| **0.13.2** | Open Chart Source; charts survive source-tab close |
| **0.13.1** | Compile usage weekly/daily/hourly quotas; `barcolor()` drawn by chart |
| **0.13.0** | Chart Data Window; status-line-only plots; bold/italic drawings; Update Agent Files; **breaking min PyneCore 6.12.1**; displayName becomes “Pine Script Debugger and Backtester” |
| **0.11.1** | Precompiled Pine demos (no account); Plans and API Key panel; `vscode://` copy-key from web app; trade details; download-from-data-picker |
| **0.11.0** | Per-project `.pyneide/venv`; `pyneide.pynecore.version`; plugins pin Core |
| **0.10.0** | Line profiler (flame, sourcemap to Pine); Open VSX publish |
| **0.9.x** | Edge linter for `open`/`input` builtins; Pyne language mode vs Python Run/Debug; Marketplace OIDC publish |
| **0.9.0** | Strategy Properties tab; bundled Core docs (later moved into env); Remove Environment |
| **0.1.0** | Walkthrough, Pine v6 TM, Pyne `@pyne`, cloud compile, debugger, chart, data, plugins — first preview |

---

## README claims that match manifest (for synthesizer)

Shipped README restates: Pine LS + Pyne analysis, cloud compile, inputs `.toml` sidecar, kline-style chart with Pine plots/drawings/strategy tables, line profiler, robustness, agent skills, local PyneCore, no automatic telemetry. Pine compile needs a plan; Pyne does not.

Do **not** treat README GIFs as binary proof. Commands, contributes, and bundled files above are the binary.

---

## Source of this note

- Open VSX API JSON for `pynesys/pyneide` and `/0.14.1`
- Unpacked `extension/package.json`, `extension.vsixmanifest`, `changelog.md`, `readme.md`, `LICENSE.txt`, `COPYRIGHT`, `SECURITY.md`
- Directory listing + string scan of `dist/*.js` and `python/`
- Local SHA-256 of `/tmp/pyneide-inspect/pynesys.pyneide-0.14.1.vsix`
