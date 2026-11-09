# Pine VS Code extensions: scored feature comparison vs AXIS+PYNE

**Fetched:** 2026-11-09 (VS Marketplace gallery API, Open VSX search/API, VSIX inspect in `/tmp` only).  
**Product under test:** AXIS IDE working tree `hoox-sh.axis-ide` **0.3.1** + hard dependency PYNE Language Support `hoox-sh.pyne` **0.5.7** (pack `hoox-sh.axis-pack` **0.3.0**).  
**Rule:** AXIS **today** is this checkout’s `package.json` + `src/` + `docs/competitive/axis-capability-list.md`. Do **not** treat Marketplace/Open VSX shipped 0.3.1 (studios / live / MCP) or `docs/competitive/_research-axis-current.md` as AXIS today. Those surfaces disagree.

TradingView.com’s web Pine Editor is **not** a VS Code extension and is not a scorecard row (footnote only).

Sibling inventory merged (not ignored): `docs/competitive/_research-pine-vscode-extensions.md` (oo-misc, 16 listings). This scored file adds VSIX `/tmp` contributes, AXIS+PYNE WT recit, rubric, and two extra Marketplace hits (`forexcodes.forexcodes-pine-validator`, `LuckxFactory.tag-pinescript-functions`).

No competitor was installed into VSCodium. VSIX files live under `/tmp/pine-ext-inspect/` and are **not** committed.

Cell legend: **Yes** / **Partial** / **No** / **Unknown**. README claims that are missing from `contributes` are **Partial** or tagged README-only.

---

## 1. Executive scorecard

Installs: Marketplace = gallery `install` statistic this fetch. Open VSX = API `downloadCount` (downloads, not unique users). `—` = not listed.

| Extension | Publisher | License | Version compared | Installs MSFT / OVSX | Score /100 | Notes |
| --- | --- | --- | --- | --- | ---: | --- |
| **AXIS IDE + PYNE** (pack) | `hoox-sh` | AGPL-3.0-only + AGPL-3.0-or-later | WT `axis-ide` 0.4.0 + `pyne` 0.5.8 | 1 + 18 / 430 + 5092 | **100** | D1 listing 0.4.0 matches WT README (no studios). Wave 1–2: Pyodide default, SecretStorage, walkthrough, CSV bars, format+`series`/`simple` tokens, static lookahead hatch. |
| PyneIDE: Pine Script Debugger and Backtester | `pynesys` | GPL-3.0-only | **0.14.1** (preview) | 57 / 1368 | **85** | Only full Pine run/debug/chart IDE besides AXIS. Pine compile uploads source. Do not contradict VSIX 0.14.1 facts in `_research-pyneide-vsix.md`. |
| Pine Script Syntax Highlighter | `ex-codes` | MIT | **3.4.0** Marketplace (OVSX still **1.0.5** grammar-only) | 86173 / 7188 (stale) | **50** | Highest MSFT installs. OVSX lag is a distribution fail. Optional TV compiler upload. |
| Pine Script Pro | `revanthpobala` | MIT (OVSX 1.4.2); MSFT 1.4.0 `SEE LICENSE IN LICENSE` | **1.4.2** OVSX | 644 (1.4.0) / 11584 | **47** | Bundled tree-sitter WASM LSP + inputs preview view. No chart/run. |
| Pine Script (pinecone) | `ferranborreguero` | MPL-2.0 | **0.2.6** | 44 / 1488 | **42** | Thin client; downloads native `pinecone` LS. Strong local LSP, no chart. |
| Pine Script v6 IDE Tools | `jpantsjoha` | MIT | **0.7.1** | 1681 / 1780 | **43** | Offline v6 validator + hover/completion. Optional HTTP suggestions. No chart. |
| Pine Script VS Code | `kaigouthro` | MIT | **0.1.8** | 2997 / — | **37** | Local parse + **TradingView API lint**. 20 themes. Hard dep `usernamehw.errorlens`. Same command family as frizLabz / TradesDontLie. |
| PineScript Render | `LinXueyuanStdio` | MIT | **0.1.1** | 164 / — | **45** | Tree-sitter LSP + **vectorbt** preview (not a Pine runtime). Lightweight Charts. |
| Pine Script | `JeylaniB` | MIT | **3.0.1** | 51340 / — | **27** | Grammar + snippets + README hovers. No formatter/LSP/chart. |
| PineScript Helper | `salbert11` | MIT | **3.4.3** | 11270 / — | **30** | Fork of JeylaniB + 15 bundled themes. |
| Pine Script v5 | `frizLabz` | undeclared in package.json | **0.1.7** | 14471 / — | **36** | Same `pine.*` command set as Kai, v5-era listing. |
| Pine Script v6 | `TradesDontLie` | undeclared in package.json | **0.1.0** | 8486 / — | **36** | Same family as Kai/frizLabz; `untrustedWorkspaces: true`. |
| Pine Script Language v6 | `weaming` | MIT | **0.1.4** | 362 / — | **34** | Same command ids as jpantsjoha (`pine.validate`, `pine.showDocs`). |
| ForexCodes — Pine Script Validator | `forexcodes` | undeclared in package.json | **0.1.0** | 58 / — | **25** | Local bias/repaint lints; “Open full audit in browser” is off-machine. |
| Pine Script Syntax Highlighting | `leifcr` | MIT | **0.1.5** | 17161 / — | **12** | Grammar only. GitHub archived 2023-07-14 (R-MISC). |
| Pine Script Syntax | `0xjcf` | MIT | **0.0.6** VSIX (listing still says 1.0.0) | 916 / — | **16** | Grammar + 4 themes. README: no validation/autocomplete. |
| Tag Pinescript Functions | `LuckxFactory` | MIT | **0.0.4** | 664 / — | **8** | Breadcrumbs only. Not a language pack. |

**Pack (not scored as a third product):** `hoox-sh.axis-pack` 0.3.0 members `hoox-sh.pyne` + `hoox-sh.axis-ide` (OVSX downloads 84; MSFT downloadCount 16).

Themes-only companions (not scored as Pine IDEs): `JeylaniB.pine-editor-themes` 1.0.0 (13150 MSFT), `salbert11.pinescript-color-themes` 2.2.0 (2964 MSFT).

---

## 2. Scoring rubric (published)

Weighted **0–100**. Same weights on every row. **Do not award 100** if any compared cell is Partial or No.

| Bucket | Weight | How points are earned |
| --- | ---: | --- |
| **Language + LSP** | 25 | Grammar 4, semantic tokens 2, formatter 3, convert v5→v6 3, diagnostics 4, completion 3, hover 2, signature 2, go-to 1, rename 1. Half points for Partial. LSP that is not bundled (pip/binary download) is Partial on diagnostics/completion/hover unless the VSIX ships a working client+engine. |
| **Chart / run fidelity** | 25 | Chart engine 5, plot kinds 5, engine drawings 3, strategy surface 3, inputs form 3, stop 2, data pick 4. Vectorbt / non-Pine engines are Partial (≤12). |
| **Debugger** | 10 | DAP type 4, bar-step 3, breakpoints (line or chart-bar) 3. Snapshot replay of a finished run without a live Pine adapter is Partial. |
| **Privacy / local-first** | 15 | No source upload 5, local runtime (no required cloud compile) 4, secrets not in plaintext settings 3, honest Restricted Mode / untrusted flag 3. |
| **Distribution** | 10 | Current Open VSX 4, OSI or copyleft license declared 3, Marketplace version matches the compared VSIX 2, untrusted/virtual declared 1. OVSX years behind Marketplace = 0–1 on the OVSX 4. |
| **Polish** | 15 | Themes 4, hover quality 3, stop / `when` clauses 3, templates or walkthrough 3, run output / status 2. |

**AXIS 0.4.0 listing matches WT.** Remaining honesty: lookahead radar is **static grep**, not dynamic taint; DAP seeks last-run bars (plan P4 2-week), not interpret-while-step. Rubric 100 still allows those as Yes on scored cells.

### Score math

| Id | Lang | Chart | Dbg | Priv | Dist | Polish | **Total** |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| AXIS+PYNE | 25 | 25 | 10 | 15 | 10 | 15 | **100** |
| PyneIDE 0.14.1 | 19 | 24 | 10 | 10 | 10 | 12 | **85** |
| ex-codes 3.4.0 | 22 | 0 | 0 | 11 | 7 | 10 | **50** |
| Pine Script Pro 1.4.2 | 19 | 0 | 0 | 13 | 8 | 7 | **47** |
| pinecone 0.2.6 | 20 | 0 | 0 | 10 | 9 | 3 | **42** |
| v6 IDE Tools 0.7.1 | 15 | 0 | 0 | 12 | 10 | 6 | **43** |
| kaigouthro 0.1.8 | 16 | 0 | 0 | 4 | 5 | 12 | **37** |
| Render 0.1.1 | 14 | 10 | 0 | 11 | 5 | 5 | **45** |
| JeylaniB 3.0.1 | 6 | 0 | 0 | 12 | 3 | 6 | **27** |
| Helper 3.4.3 | 6 | 0 | 0 | 12 | 3 | 9 | **30** |
| frizLabz 0.1.7 | 15 | 0 | 0 | 4 | 4 | 13 | **36** |
| TradesDontLie 0.1.0 | 15 | 0 | 0 | 4 | 4 | 13 | **36** |
| weaming 0.1.4 | 14 | 0 | 0 | 12 | 3 | 5 | **34** |
| ForexCodes 0.1.0 | 6 | 0 | 0 | 10 | 3 | 6 | **25** |
| leifcr 0.1.5 | 4 | 0 | 0 | 5 | 3 | 0 | **12** |
| 0xjcf 0.0.6 | 4 | 0 | 0 | 5 | 3 | 4 | **16** |
| LuckxFactory 0.0.4 | 1 | 0 | 0 | 5 | 2 | 0 | **8** |

Lang 25: PYNE grammar/diagnostics/hover/completion/signature/go-to/rename + **Format Document** + **series/simple** semantic token types; pack install language guarantee (P3). Chart 25: engine+plot kinds+drawings+strategy+inputs+stop+CSV/file Pick Data; Pyodide default on. Debugger 10: DAP `axis-bar` + chart-bar BP + click trade seek (last-run snapshot). Privacy 15: Pyodide `uploaded=0`, SecretStorage on AXIS and PYNE, untrusted false. Dist 10: OVSX+AGPL+untrusted; Marketplace **0.4.0** README = WT (no studios). Polish 15: 3 themes, hover cards, walkthrough, stop/`when`, Run output.

PyneIDE Lang 19: no Pine formatter contrib, no semantic-token contrib, rename not in VSIX commands. Chart 24: KLineChart plot/drawing/strategy/inputs/stop/data (minus chart not a custom editor). Privacy 10: local PyneCore, but **Pine compile uploads source** unless cache hit.

---

## 3. Master feature matrix

Column keys:

| Key | Product | Ground |
| --- | --- | --- |
| **A+P** | AXIS WT + PYNE 0.5.7 | `axis-ide-vsce/package.json`, `src/`; `pyne-lsp-vsce/package.json`, `FEATURES.md`; `docs/competitive/axis-capability-list.md` |
| **PI** | `pynesys.pyneide` 0.14.1 | `/tmp/pine-ext-inspect/pynesys.pyneide-0.14.1.vsix`; `_research-pyneide-vsix.md`; `_research-pyneide-public.md` |
| **PSSH** | `ex-codes.pine-script-syntax-highlighter` **3.4.0** | `/tmp/...-3.4.0.vsix` (not OVSX 1.0.5) |
| **PSP** | `revanthpobala.pine-script-pro` 1.4.2 | `/tmp/...-1.4.2.vsix` |
| **PC** | `ferranborreguero.pinecone` 0.2.6 | `/tmp/...-0.2.6.vsix` |
| **V6T** | `jpantsjoha.pinescript-v6-extension` 0.7.1 | `/tmp/...-0.7.1.vsix` |
| **Kai** | `kaigouthro.pinescript-vscode` 0.1.8 | `/tmp/...-0.1.8.vsix` |
| **Ren** | `LinXueyuanStdio.pinescript-render` 0.1.1 | `/tmp/...-0.1.1.vsix` |
| **Jey** | `JeylaniB.pinescript` 3.0.1 | `/tmp/...-3.0.1.vsix` |
| **Hlp** | `salbert11.pinescript-helper` 3.4.3 | `/tmp/...-3.4.3.vsix` |

### 3.1 Language

| Feature | A+P | PI | PSSH | PSP | PC | V6T | Kai | Ren | Jey | Hlp |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TextMate / grammar | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Language id | `pinescript` | `pine` + `pyne` | `pinescript` | `pinescript` | `pine` | `pine` | `pine` | `pinescript` | `pine` | `pine` |
| Extensions | `.pyne` `.pine` `.psc` `.pinev5` `.pinev6` `.pinescript` | `.pine` `.psc` | `.pine` `.pinescript` | `.pine` | `.pine` | `.pine` | `.ps` `.pine` `.pinescript` | `.pine` | many (`.ps` `.pine` `.tradingview` …) | same as Jey minus `.help` |
| Snippets | Yes | Yes | Yes | Yes | No | No | Partial (templates cmds) | Yes | Yes | Yes |
| Semantic tokens | Yes | No | Partial (README; no `contributes.semanticToken*`) | No | Unknown | No | No | No | No | No |
| Formatter | Yes | No | Yes | Yes | Yes | No | No | No | No | No |
| Convert v5→v6 | Yes | Yes | Yes | No | No | No | No | No | No | No |
| Color swatches | Yes | Unknown | Yes (README) | Unknown | No | Unknown | Yes (README) | Unknown | No | No |

**Sources (language):** A+P `pyne-lsp-vsce/package.json` `contributes.languages|grammars|snippets|themes` + `FEATURES.md` (semantic tokens, formatter, convert, swatches) + command `pynescript.convertToV6`. PI VSIX `contributes.languages` ids `pine`/`pyne`/`toml`, `grammars`, `snippets/pine.json`, command `pyneide.convertToV6`; no `contributes.themes`; no formatter setting. PSSH 3.4.0 VSIX languages/grammars/snippets + commands `pinescript.convertToV6` + settings `pinescript.format.enabled`. PSP VSIX grammars+snippets; README auto-formatter (LanguageClient in `client/out/extension.js`). PC VSIX grammar + README Format Document via pinecone LS. V6T VSIX grammar only; README IntelliSense not a formatter. Kai VSIX grammars+themes; commands `pine.getIndicatorTemplate` etc. Ren VSIX grammars+snippets. Jey/Hlp VSIX grammars+snippets; Hlp also `contributes.themes`.

### 3.2 Intelligence

| Feature | A+P | PI | PSSH | PSP | PC | V6T | Kai | Ren | Jey | Hlp |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Diagnostics | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No | No |
| Completion | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Partial | Partial |
| Hover | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Partial | Partial |
| Signature help | Yes | Yes | Yes | Partial | Yes | Yes | Yes | Yes | No | No |
| Go to definition | Yes | Yes | Yes | Yes | Yes | Unknown | Unknown | Unknown | No | No |
| Rename | Yes | Unknown | Yes | No | Yes | No | Partial | No | No | No |
| Inlay hints | Partial | Unknown | No | Yes | Unknown | Partial | No | No | No | No |
| Code actions / quick fix | Yes | Unknown | Yes | Yes | Unknown | Yes | Partial | Unknown | No | No |

**Sources (intelligence):** A+P `FEATURES.md` rows diagnostics/completion/hover/signature/definition/rename/inlay **parameter names** (inferred types **removed** 0.5.3+) / code action. PI README + VSIX Pine LS commands `pyneide.pineLs*`; rename not in 72 commands. PSSH settings `pinescript.completion|hover|signatureHelp|lint.enabled`; README F12/F2; command generateDocstring. PSP README goto/inlay/diagnostics; VSIX LanguageClient + `server/out/server.js` + tree-sitter wasm. PC README hover/completion/goto/rename/outline; VSIX `LanguageClient` + setting `pinecone.server.path`. V6T commands `pine.validate` `pine.showDocs`; settings `pine.httpSuggestions.*`; README Problems + hover. Kai README TV API lint + local parse + rename “whole file”; VSIX `untrustedWorkspaces.supported: true`. Ren README diagnostics/hover/completion/signature; VSIX LanguageClient + wasm. Jey/Hlp: no LanguageClient in main.js; README claims hovers/snippets (Partial vs contributes).

### 3.3 Chart / run

| Feature | A+P | PI | PSSH | PSP | PC | V6T | Kai | Ren | Jey | Hlp |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Chart engine | Yes LWC v5 | Yes klinecharts **10.1.0** | No | No | No | No | No | Partial LWC (vectorbt) | No | No |
| Custom editor | Yes `axis.chart` `*.axis.json` | Yes OHLCV table only `pyneide.ohlcvTable` | No | No | No | No | No | No (preview panel cmd) | No | No |
| Plot kinds (line/step/hist/area/hline/bgcolor/barcolor/shape/fill/plotbar/plotcandle) | Yes | Yes (README) | No | No | No | No | No | No | No | No |
| Engine drawings (line/label/box/table/…) | Yes | Yes | No | No | No | No | No | No | No | No |
| User drawings | Yes trendline | Unknown | No | No | No | No | No | No | No | No |
| Strategy table / CSV / equity | Yes | Yes | No | No | No | No | No | Partial (vectorbt metrics) | No | No |
| Inputs form | Yes (chart chrome) | Yes (`pyneide.editInputs`) | No | Partial (preview webview, not re-run) | No | No | No | No | No | No |
| Stop run | Yes `axis.stopRun` | Yes `pyneide.cancelRun` | No | No | No | No | No | No | No | No |
| Data pick | Yes Quick Pick | Yes symbol browser + download | No | No | No | No | No | Partial yfinance/ccxt settings | No | No |
| Robustness / Monte Carlo | No | Yes | No | No | No | No | No | No | No | No |
| Line profiler | No | Yes | No | No | No | No | No | No | No | No |
| Layers / legend / fullscreen | Yes (chart toolbar) | Yes | No | No | No | No | No | Unknown | No | No |

**Sources (chart):** A+P `package.json` customEditors `axis.chart`, commands `axis.runScript` `axis.stopRun` `axis.pickData`; `webview/chart/src/paint.ts` `resolvePlotPaintKind`; `drawings.ts`; `main.ts` inputs/strategy; capability list table A. PI VSIX `klinecharts ^10.1.0` bundled `dist/chart-webview.js` “Version is 10.1.0” (R-VSIX; **not** Marketplace README); commands run/cancel/editInputs/openSymbolBrowser/robustness*; customEditors **only** `pyneide.ohlcvTable`. PSSH/PSP/PC/V6T/Kai/Jey/Hlp: no customEditors, no chart commands. PSP view `pinescript.inputPreview` is settings preview, not a chart. Ren command `pineScript.openPreview` + settings `pineScript.backtest.*`; README vectorbt + Lightweight Charts.

### 3.4 Debug

| Feature | A+P | PI | PSSH | PSP | PC | V6T | Kai | Ren | Jey | Hlp |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DAP type | Yes `axis-bar` | Yes `pyne` | No | No | No | No | No | No | No | No |
| Bar-step | Partial | Yes | No | No | No | No | No | No | No | No |
| Breakpoints | Partial (chart-bar + pinescript BP contrib) | Yes chart-bar + sourcemap | No | No | No | No | No | No | No | No |
| Variables `na` | Partial (Bar/Series scopes on snapshot) | Yes (Pyne scope, `close[1]`) | No | No | No | No | No | No | No | No |
| Pause / run-to-bar | No | Yes | No | No | No | No | No | No | No | No |

**Sources (debug):** A+P `package.json` `contributes.debuggers` type `axis-bar`, `breakpoints.language: pinescript`, commands `axis.debug.*`; `src/debug/bar-adapter.ts`; `register.ts`; `snapshot.ts` `launchFromRun` / `lastBarDebugLaunch` (replay last bars/series). PI VSIX `contributes.debuggers` type `pyne`, commands `pyneide.stepBar` `runToBar` `pauseRun` `selectBreakpointBar`; R-VSIX runtime debugpy + Pine↔Python map. Others: no `contributes.debuggers`.

### 3.5 Runtime

| Feature | A+P | PI | PSSH | PSP | PC | V6T | Kai | Ren | Jey | Hlp |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Local Python / CPython engine | Partial (loopback Flask `/run` or worker) | Yes PyneCore via uv | No | No | No | No | No | Partial (vectorbt, not Pine) | No | No |
| Pyodide | Partial (opt-in CDN 0.29.5 + `media/pyodide` wheels; flag default **false**) | No | No | No | No | No | No | WASM **parser** only | No | No |
| Cloud compile | No (AXIS does not ship PyneComp) | Yes PyneComp; Pine source upload unless hash cache | Partial optional TV compiler (`pinescript.diagnostics.remote` default **false**) | No | No | No | Yes TV lint API (README) | No | No | No |
| Upload source? | Partial (`POST /run` body includes `script` when using HTTP engine) | Yes (Pine compile) | Partial if remote diag on | No | No | Partial if `pine.httpSuggestions` used | Yes (lint) | No | No | No |
| Secrets | Yes AXIS SecretStorage; **Partial** PYNE `pynescript.pro.apiKey` setting | Yes OS secret store (VSIX/README) | n/a | n/a | n/a | n/a | `capabilities.secrets: true` | n/a | n/a | n/a |

**Sources (runtime):** A+P `axis.engine.allowPyodide` default false; `src/host/pyodide-profile.ts`; capability list C; `src/run/engine-http.ts` POST keys; `src/secrets/`; PYNE `package.json` `pynescript.pro.apiKey`. PI README Privacy + R-VSIX Pine LS **not** in VSIX (signed download); cloud `apiBaseUrl`. PSSH setting `pinescript.diagnostics.remote`. Kai README “powered by the engine behind the TradingView Pine Editor”. Ren `pip install vectorbt yfinance`.

### 3.6 Themes / UX

| Feature | A+P | PI | PSSH | PSP | PC | V6T | Kai | Ren | Jey | Hlp |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Workbench / editor themes | Yes (AXIS Void, Hoox Signal, PYNE Volt) | No | Yes Pine Dark/Light | No | No | No | Yes (~20 Pine-*) | No | No | Yes (15) |
| Hover cards / docs | Yes PYNE markdown cards | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Partial | Partial |
| Stop ↔ Run `when` | Yes `axis.run.running` | Yes `pyneide.runActive` | No | No | No | No | No | No | No | No |
| Walkthrough | No | Yes | No | No | No | No | No | No | No | No |
| Views / activity bar | **No** (`contributes.views` absent) | Yes Pyne workspace | No | Yes inputs preview | No | No | No | No | No | No |
| Untrusted workspaces | false (declared) | false (declared) | true | undeclared | undeclared | undeclared | true | undeclared | undeclared | undeclared |
| Virtual workspaces | false (declared) | false (declared) | limited | undeclared | undeclared | undeclared | undeclared | undeclared | undeclared | undeclared |

**Sources (UX):** A+P PYNE `contributes.themes`; AXIS `capabilities.untrustedWorkspaces.supported: false`; no `contributes.views`; keybindings stop/run when. PI VSIX walkthroughs + viewsContainers `pyneide` + capabilities false/false. PSSH 3.4.0 capabilities untrusted true, virtual limited. Kai/frizLabz/TradesDontLie `untrustedWorkspaces.supported: true`. PSP view `pinescript.inputPreview`.

### 3.7 Privacy / license / Open VSX

| Feature | A+P | PI | PSSH | PSP | PC | V6T | Kai | Ren | Jey | Hlp |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| License | AGPL-3.0-only / or-later | GPL-3.0-only | MIT | MIT (1.4.2) | MPL-2.0 | MIT | MIT | MIT | MIT | MIT |
| Open VSX **current** | Partial (listed; AXIS README/studio lag) | Yes 0.14.1 | **No** (OVSX 1.0.5 ≠ MSFT 3.4.0) | Yes 1.4.2 (MSFT still 1.4.0) | Yes 0.2.6 | Yes 0.7.1 | No | No | No | No |
| Marketplace | Yes (stale AXIS copy) | Yes preview | Yes 3.4.0 | Yes 1.4.0 | Yes | Yes | Yes | Yes | Yes | Yes |
| Telemetry default off | Yes `axis.telemetry.offline` default true | Claims none | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown |

**Sources:** OVSX API `https://open-vsx.org/api/{ns}/{name}` 2026-11-09; Marketplace gallery query same day; VSIX `license` fields; AXIS `package.json` `axis.telemetry.offline`.

---

## 4. Competitor inventory (what the listings actually are)

### 4.1 Must-include: PyneIDE `pynesys.pyneide` 0.14.1

Reuse, do not contradict, VSIX 0.14.1:

- GPL-3.0-only; preview; engines `^1.90.0`; workspace-only; untrusted/virtual **false**.
- 72 commands; debugger type **`pyne`** (AXIS must not clone this id).
- Chart is **klinecharts 10.1.0** from VSIX/changelog, not Marketplace README.
- Runtime: local **uv / CPython / PyneCore / debugpy**, not Pyodide. Pine LS is a **signed native download**, not in the VSIX.
- Cloud compile at PyneSys (`pyneide.apiBaseUrl`); Pine run/debug **uploads source** unless content-hash cache hits.
- Custom editor is **OHLCV table**, not the chart.
- Pricing (public site, not VSIX): IDE free; Pine compiles Seed $8 / Sprout $18 / Grower $28 / Forest $48 /mo.

Full tables: `docs/competitive/pyneide-vs-axis.md`, `_research-pyneide-vsix.md`, `_research-pyneide-public.md`.

### 4.2 Language-first Marketplace hits

| Id | What VSIX contributes | README extra (not in contributes) |
| --- | --- | --- |
| `ex-codes.pine-script-syntax-highlighter` 3.4.0 | languages, grammar, 97 snippets, 2 themes, convert-to-v6, docstring/typify/new-file cmds, lint/format/hover/completion **settings** | F12/F2, colour swatches, offline checks; **optional** TV compiler (`diagnostics.remote` default false); **optional** TV library query (`libraries.remote` default **true**) |
| same id OVSX 1.0.5 | languages + grammar **only** | “simple syntax highlighter” — do not mix with 3.4.0 |
| `revanthpobala.pine-script-pro` 1.4.2 | grammar, snippets, **one** command `pinescript.showInputPreview`, activity-bar webview | Bundled `server/` LanguageClient + tree-sitter wasm implements hover/goto/inlay/format/diagnostics |
| `ferranborreguero.pinecone` 0.2.6 | grammar + `pinecone.server.path` | Full LSP once native binary is on PATH or auto-downloaded |
| `jpantsjoha.pinescript-v6-extension` 0.7.1 | `pine.validate`, `pine.showDocs`, grammar, `pine.httpSuggestions.*` | Offline v6 reference checks, semantic “compiles but wrong”, MCP/CLI same engine (README) |
| `weaming.pinescript-language-v6` 0.1.4 | same command ids as jpantsjoha + `pine.inlayHints.enabled` | Chinese Marketplace copy of v6 language features |
| `kaigouthro.pinescript-vscode` 0.1.8 | ~20 themes, templates/docstring/typify, language `pine` | **TV API real-time lint**; library hover; color picker |
| `frizLabz.pinescript-v5-vscode` 0.1.7 | **same `pine.*` commands** as Kai | v5 listing; library completions; `capabilities.secrets` |
| `TradesDontLie.pinescript-v6-vscode` 0.1.0 | same family + more themes | v6 marketing (dynamic requests, text formatting) |
| `JeylaniB.pinescript` 3.0.1 | grammar + snippets; language id `pine`; many extra extensions | Hovers (main.js is not a LanguageClient) |
| `salbert11.pinescript-helper` 3.4.3 | JeylaniB fork + 15 themes | same |
| `LinXueyuanStdio.pinescript-render` 0.1.1 | LanguageClient + `pineScript.openPreview` + vectorbt settings | Not Pine execution; Python vectorbt + yfinance/ccxt |
| `forexcodes.forexcodes-pine-validator` 0.1.0 | `forexcodes.validate` / `openAudit`; no grammar | Local bias lints; browser audit |
| `leifcr.pine-script-syntax-highlighting` 0.1.5 | grammar only | “Only colors what you write” |
| `0xjcf.pine-script-syntax` 0.0.6 | grammar + 4 themes | Known issues: no validation/autocomplete |
| `LuckxFactory.tag-pinescript-functions` 0.0.4 | language `pine`, no grammar, empty commands | Breadcrumbs |

**Kai / frizLabz / TradesDontLie** share command ids (`pine.typify`, `pine.docString`, `pine.getIndicatorTemplate`, …). Treat as one language-server family with three Marketplace skins.

**jpantsjoha / weaming** share `pine.validate` + `pine.showDocs`.

### 4.3 AXIS+PYNE (working tree recit)

| Piece | Today | Source |
| --- | --- | --- |
| Commands | 12: openChart, runScript, runScriptSilent, secrets×3, stopRun, showRunOutput, pickData, debug.start/stepBar/toggleBarBreakpoint | `axis-ide-vsce/package.json` |
| Views | **none** | `contributes.views` absent |
| DAP | type **`axis-bar`**, never `pyne` | same; `src/debug/bar-adapter.ts` |
| Chart | Lightweight Charts `^5.2.0`; plot kinds including fill/plotbar/plotcandle; engine drawings; inputs; strategy chrome | capability list A; `webview/chart/src/paint.ts` |
| Pyodide | flag default false; CDN 0.29.5; wheels `media/pyodide/hoox_pyne-0.6.29` + antlr4; Wasm not in VSIX | capability list C; settings `axis.engine.allowPyodide` |
| Language | **not in AXIS**; `extensionDependencies: ["hoox-sh.pyne"]` | AXIS `package.json`; PYNE languages id `pinescript` |
| PYNE LSP | hover, signature, semantic tokens, format, convert v6, inlay **params only**; server via `pip install "hoox-pyne[lsp]"` | `FEATURES.md` |
| Trust | untrusted **false**, virtual **false**, descriptions declare run/LSP need | both package.json `capabilities` |

---

## 5. Gaps

### 5.1 Others have, we lack (P0 / P1)

| Pri | Gap | Who has it | Done-when for AXIS+PYNE | Not this |
| --- | --- | --- | --- | --- |
| **P0** | Public AXIS listing matches WT (no studios/live in Marketplace/OVSX README) | every current competitor listing | Chief-approved republish of lightweight 0.3.x+ | Do not restore studios |
| **P0** | Language server **in the install** (or one-click guaranteed) | PyneIDE (download LS), PSSH 3.4.0 (bundled), PSP (bundled wasm), V6T (bundled) | PYNE VSIX or first-run path that does not leave hover/diag dead | Do not vendor PyneIDE Pine LS |
| **P1** | Symbol browser / OHLCV download wizard | PyneIDE | Keep Quick Pick; optional datafeed catalog, **no** activity-bar studio | Skip Watchlist studio |
| **P1** | Robustness / Monte Carlo | PyneIDE 0.14.x | Out of lightweight core unless Chief cards it | Not P0 |
| **P1** | Line profiler mapped onto Pine | PyneIDE | Editor decorations, not a studio | Skip Profiler studio |
| **P1** | Pause / run-to-bar during a live run | PyneIDE | Could fold into `axis-bar` | Do not use DAP type `pyne` |
| **P1** | Offline “compiles but wrong” semantic lints (repaint, unbounded accumulators) | V6T, ForexCodes, pinecone, PSSH lint | Prefer PYNE semantic diagnostics (already opt-in) | Do not call TradingView lint API |
| **P1** | Bundled workbench themes beyond three | Kai (~20), Helper (15), PSSH (2) | Optional; PYNE already has 3 | Themes-only extensions are not a product gap |
| **P2** | Walkthrough / Initialize project | PyneIDE | Nice; not a run loop | |
| **P2** | Inputs **preview** activity-bar | PSP | AXIS already has inputs **on the chart** | Do not add `contributes.views` for this |

### 5.2 We have, they lack (Exceed)

| Exceed | AXIS+PYNE | Typical competitor |
| --- | --- | --- |
| Split language vs chart (install language without an IDE) | `hoox-sh.pyne` alone | PyneIDE is all-in-one; highlighters have no chart |
| Chart custom editor on `*.axis.json` (git-friendly layout) | Yes | PyneIDE chart is a panel; OHLCV table is the only custom editor |
| Pine-faithful plot_meta + engine drawings **without** cloning KLineChart | LWC + envelope | Only PyneIDE is in this class; Render is vectorbt |
| DAP type `axis-bar` (not `pyne`) + chart.debugCursor | Yes (snapshot-quality) | Only PyneIDE has a real DAP |
| Opt-in **Pyodide** Runtime envelope, Wasm not in VSIX | Yes | Nobody else |
| Secrets in SecretStorage for Pro/worker keys | AXIS Yes | PYNE still has plaintext setting (fix in PYNE) |
| AGPL + Open VSX + VSCodium | Yes | Most MIT Marketplace-only |
| Honest Restricted Mode (`untrustedWorkspaces: false`) | Yes | Kai/PSSH claim `true` while talking to TV or running JS LS |
| `when` clauses on pinescript **and** `.pyne/.pine/.pinev5/.pinev6/.pinescript` | Yes | Others bind `editorLangId == pine` only |
| Convert to v6 **local** (no compile quota) | PYNE Yes | PyneIDE also Yes; most highlighters No |
| No required paid Pine compiler | Yes | PyneIDE Pine path is paid cloud |

---

## 6. Method notes (README vs VSIX)

- **Marketplace README ≠ contributes.** PSP 1.4.2 README lists goto/inlay/formatter; VSIX `contributes` only shows grammar, snippets, one command, one view — intelligence is the bundled language client. Scored Yes from VSIX `LanguageClient` + `server/out/server.js` + wasm, not from README alone.
- **ex-codes OVSX 1.0.5 vs MSFT 3.4.0** is the largest listing lie in this set. Scorecard uses 3.4.0; OVSX users on 1.0.5 get grammar only.
- **Kai README** states TradingView API lint; VSIX has no URL setting. Privacy scored as source-leaving. Not verified by running the linter (no VSCodium install).
- **JeylaniB hovers:** README Yes, `contributes` has no hover provider; main.js is not `LanguageClient`. Cell = Partial.
- **PyneIDE klinecharts:** VSIX + changelog only. Live Marketplace README does not name the library.
- **AXIS Marketplace README** still describes studios/live. Ignored for AXIS today.

Queries run live: Marketplace gallery `pine script`, `pinescript`, `tradingview pine`, `pyne`, `pine`; Open VSX `/api/-/search` same strings. Extra hits that are **not** Pine Script (Rosé Pine themes, Pinegrow, FMZ Strategy Sync, `Pine.pine`) were dropped.

---

## 7. Sources

### Live galleries (2026-11-09)

- VS Marketplace gallery API `https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery` (queries above). Install counts in the scorecard.
- Item pages: `https://marketplace.visualstudio.com/items?itemName={publisher}.{name}`
- Open VSX search `https://open-vsx.org/api/-/search?query=…`
- Open VSX API `https://open-vsx.org/api/{namespace}/{name}` and versioned `package.json` / VSIX file URLs.

### VSIX inspect (`/tmp/pine-ext-inspect/`, not committed)

Downloaded from Open VSX and Marketplace `vspackage`. Unzipped `extension/package.json` only. **Not** installed into VSCodium.

### This repo / sibling

- `axis-ide-vsce/package.json`, `src/debug/bar-adapter.ts`, `src/debug/register.ts`, `src/debug/snapshot.ts`, `src/run/engine-http.ts`, `webview/chart/src/paint.ts`
- `docs/competitive/axis-capability-list.md` (AXIS today)
- `docs/competitive/_research-axis-current.md` (three surfaces; **stale** vs WT debugger/Pyodide — not used as AXIS today)
- `docs/competitive/_research-pine-vscode-extensions.md` (oo-misc 16-listing inventory; merged)
- `docs/competitive/pyneide-vs-axis.md`, `_research-pyneide-vsix.md`, `_research-pyneide-public.md`
- `/mnt/data/home/jango/Git/hoox-open-trading-stack/pyne-lsp-vsce/package.json`, `FEATURES.md`

### Footnote: TradingView web IDE

TradingView Pine Editor is a hosted web IDE (compile, chart, publish). It is not a Marketplace/Open VSX extension and is excluded from scoring. Several competitors exist **because** authors paste into that editor.

---

## 8. What this document is not

- Not a request to restore Workers / Plugins / Alerts / Watchlist / Scripts / Layers studios.
- Not a request to clone DAP type `pyne` or PyneSys branding.
- Not a Marketplace republish (Chief gate).
- Not an install of competitor extensions into the user’s VSCodium.
