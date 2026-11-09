# PyneIDE public-surface inventory

**Scope:** public listings, publisher sites, README, changelog, pricing, related products.  
**Not in scope:** VSIX/manifest inspect (other card), AXIS inventory, comparison write-up.  
**Fetched:** 2026-11-09. Claims are labeled **Confirmed** (stated on a cited page), **Inferred** (reasonable from cited text but not explicit), or **Unknown**.

## Identity

| Field | Value | Status | Source |
| --- | --- | --- | --- |
| Display name | PyneIDE: Pine Script Debugger and Backtester | Confirmed | [OVSX API](https://open-vsx.org/api/pynesys/pyneide), [VS Marketplace](https://marketplace.visualstudio.com/items?itemName=pynesys.pyneide) |
| Extension id | `pynesys.pyneide` | Confirmed | same |
| Publisher id | `pynesys` | Confirmed | same |
| Author / company | PYNESYS LLC (Delaware LLC). Founder/engineer Adam Wallner (`wallneradam`). OVSX `publishedBy` is Adam Wallner via GitHub. | Confirmed | [OVSX API](https://open-vsx.org/api/pynesys/pyneide), [pynesys.com](https://pynesys.com/), [GitHub org](https://github.com/PyneSys) |
| License (extension) | GPL-3.0-only | Confirmed | OVSX `license`, Marketplace README, [GitHub](https://github.com/PyneSys/PyneIDE) |
| Latest version | **0.14.1** (preview / pre-release). Timestamp 2026-11-08T21:46:51Z on OVSX. GitHub tag `v0.14.1`. | Confirmed | [OVSX API](https://open-vsx.org/api/pynesys/pyneide), [GitHub releases](https://github.com/PyneSys/PyneIDE/releases) |
| OVSX versions listed | 0.14.1, 0.14.0, 0.13.2, 0.13.1, 0.13.0, 0.11.1, 0.11.0, 0.10.0, 0.9.2 | Confirmed | [OVSX API](https://open-vsx.org/api/pynesys/pyneide) |
| Preview flag | `preview: true` on listing; GitHub releases marked Pre-release | Confirmed | OVSX API, GitHub releases |
| Engine | VS Code `^1.90.0` | Confirmed | OVSX API `engines`, README Requirements |
| Categories | Programming Languages, Debuggers, Linters, Visualization, Snippets | Confirmed | OVSX API |
| Tags / keywords | pine, pine script, pinescript, pyne, pynecore, python, trading, indicators, strategies, backtesting, plus OVSX internal `__ext_*` tags | Confirmed | OVSX API |
| Homepage | https://pynesys.io | Confirmed | OVSX API |
| Repository | https://github.com/PyneSys/PyneIDE | Confirmed | OVSX API |
| Q&A / bugs | https://github.com/PyneSys/PyneIDE/issues | Confirmed | OVSX API |
| OVSX installs | `downloadCount`: **1344** (OVSX download metric, not unique users) | Confirmed | [OVSX API](https://open-vsx.org/api/pynesys/pyneide) fetched 2026-11-09 |
| Marketplace installs | **57** installs, **0** ratings | Confirmed | [Marketplace listing](https://marketplace.visualstudio.com/items?itemName=pynesys.pyneide) fetched 2026-11-09 |
| GitHub traction | Public repo, GPL-3.0, **5** stars, **1** fork (page snapshot) | Confirmed | [GitHub PyneIDE](https://github.com/PyneSys/PyneIDE) |
| VSIX size (OVSX) | universal download ~2.24 MB (`downloadSizes.universal`: 2241137) | Confirmed | OVSX API |
| Workspace trust | Untrusted workspaces **not** supported. Virtual workspaces **not** supported. | Confirmed | OVSX-hosted `package.json` for 0.14.1 (`capabilities`) |
| Telemetry | Claims **no automatic telemetry** of its own | Confirmed | Marketplace/GitHub README, changelog 0.1.0 Notes |
| Trademark | Pine Script is a TradingView trademark. PyneIDE is not a TradingView product and is not affiliated. PyneCore/PyneComp are PYNESYS LLC trademarks. | Confirmed | listing description, README footer, [about](https://pynesys.io/about/) |

## What they claim the product is

PyneIDE is a **free VS Code extension** (open source, GPL-3.0) that is a **full development environment for Pine Script and Pyne** inside the editor: language server, one-click compile/run onto a streaming candlestick chart, backtests, a **bar-by-bar debugger** (claimed as something TradingView does not offer), line profiler, robustness tests, managed local Python/PyneCore runtime.

Positioning (not a TV replacement): keep charting/publishing on TradingView; PyneSys is a **second home** you control, with files in git, running locally on open-source **PyneCore**.

**Pyne** is “Pine written as plain Python”: `@pyne` Python files that keep Pine’s bar-by-bar model and run on CPython 3.11+ via PyneCore.

**Monetization split:** writing/running/debugging **Pyne code is free** (no account). Compiling **`.pine`** goes through closed-source **PyneComp** in the PyneSys cloud and needs a paid plan + API key (cached unchanged scripts do not re-bill).

Sources: [pynesys.io](https://pynesys.io/), [pynesys.io/ide](https://pynesys.io/ide/), [Marketplace README](https://marketplace.visualstudio.com/items?itemName=pynesys.pyneide), [about](https://pynesys.io/about/).

## Install targets

| Target | Status | Source |
| --- | --- | --- |
| Visual Studio Code (Marketplace) | Confirmed. Preview listed 2026-10-22. | [Marketplace](https://marketplace.visualstudio.com/items?itemName=pynesys.pyneide), [news 2026-10-22](https://pynesys.io/news/2026-10-22-pyneide-preview-is-now-on-the-vs-code-marketplace/) |
| Open VSX (VSCodium, Cursor, Windsurf, other OVSX clients) | Confirmed as of 0.10 (2026-10-25). Listing still current at 0.14.1. | [news 2026-10-25](https://pynesys.io/news/2026-10-25-pyneide-010-is-out-now-on-open-vsx-too/), [open-vsx.org/extension/pynesys/pyneide](https://open-vsx.org/extension/pynesys/pyneide) |
| GitHub Releases VSIX sideload | Confirmed. Releases warn sideload does not auto-update. | [GitHub releases](https://github.com/PyneSys/PyneIDE/releases) |
| VS Code 1.90+ required | Confirmed | README Requirements, OVSX engines |
| Windows / macOS / Linux hosts | Confirmed for **PyneCore** runtime. IDE is a VS Code extension so it follows VS Code platforms. Changelog 0.9.0 explicitly fixed Windows OHLCV download (`os.pread`/`os.pwrite`). | [compiler FAQ](https://pynesys.io/compiler/), changelog 0.9.0 |
| Untrusted / virtual / remote-only FS | Confirmed **unsupported** (needs local FS for venv, compile, run, debug). | OVSX `package.json` capabilities |
| Browser-only / codespaces-without-FS | Inferred unsupported from virtual-workspace flag | same |

Publisher docs often say “only VS Code and the extension” for setup; Open VSX news is the explicit Cursor/VSCodium/Windsurf claim.

## Feature bullets

Each bullet: claim · **status** · source.

### Language

- Pine Script **v6 syntax highlighting**, completion, hover docs, signature help for `.pine` (and `.psc`) built into the extension with no setup. **Confirmed.** [README](https://marketplace.visualstudio.com/items?itemName=pynesys.pyneide), changelog 0.1.0.
- Dedicated **Pine Language Server**: as-you-type diagnostics, Problems panel; shared between projects; auto-update (can be disabled). **Confirmed.** README; commands in OVSX `package.json`.
- Workspace **libraries**: import completion, go-to-definition, hover, call-argument checks across Pine and Pyne. **Confirmed.** README.
- Pine doc-comments (`//@function`, `//@param`, …) and `#region` folding. **Confirmed.** changelog 0.1.0.
- Free **v4/v5 → v6 conversion** path; does not consume compile quota. **Confirmed.** README; [pynesys.io pricing notes](https://pynesys.io/).
- Compiler supports Pine **v4, v5, v6**; older than v4 is best-effort via v4 upgrade. **Confirmed.** [compiler FAQ](https://pynesys.io/compiler/).
- **Pyne** language: `@pyne` Python files; own language mode so Python Run/Debug menu does not apply. **Confirmed.** README, changelog 0.9.1.
- Bundled **Pyne-aware analysis** (Series history, `na`, persistent state) and **Pyne checker** for import-time mistakes; **Pyne Edge** linter for the Pine-compatible subset. Takes over from Pylance in initialized projects unless user already chose pyright/basedpyright. **Confirmed.** README.
- Snippets for Pine and Pyne. **Confirmed.** README, OVSX categories include Snippets.
- No reverse compile Pyne → Pine; not planned. **Confirmed.** [pynesys.io FAQ](https://pynesys.io/), [compiler FAQ](https://pynesys.io/compiler/).

### Editor

- Full VS Code file/git workflow: scripts are ordinary files. **Confirmed.** [ide page](https://pynesys.io/ide/), about page.
- **Initialize Pyne Project** scaffolds demo Pyne + two **precompiled** Pine demos (`demo_sma_cross.pine`, `demo_rsi_strategy.pine`), sample data, agent files. Demos run/debug **without** an account. **Confirmed.** README, changelog 0.11.1.
- New-script wizard: Pine/Pyne × indicator/strategy/library, TradingView-compatible library layout. **Confirmed.** changelog 0.1.0.
- **Get Started** walkthrough (7 steps). **Confirmed.** changelog 0.1.0.
- CodeLens / editor title **Run, Debug, Profile, Robustness**, Edit Inputs, Open Chart. **Confirmed.** README, changelog, OVSX commands.
- **Inputs form** from `input.*()` (type, options, min/max/step, group, tooltip) stored in sibling `<script>.toml`; Save re-runs; Reset to defaults; `.pine` and compiled Python share one form. **Confirmed.** README.
- **Strategy Properties** tab for backtest settings alongside inputs. **Confirmed.** changelog 0.9.0.
- File nesting: `.pine` nests `.py`, `.py.map`, `.toml`. **Confirmed.** OVSX `package.json` `configurationDefaults`.
- **AI agent setup**: `AGENTS.md` (+ Claude `CLAUDE.md` path), skills in `.agents/skills/`, `.claude/skills/`, `.cursor/skills/` (Pine, Pyne, run/debug). Skills point at **on-disk PyneCore docs** for the installed Core version and a Pine v6 topic index. `AGENT_RULES.md` is user-owned. Commands: Update Agent Files, Edit Agent Rules. **Confirmed.** README, changelog 0.13.0.
- Zero-setup **managed Python** via `uv`: ~80 MB first download; per-project `.pyneide/venv`; shared uv/Python cache; managed Python **3.14.x**; min PyneCore **6.12.1**; pin via `pyneide.pynecore.version`; optional user `venvPath`/`pythonPath` (never installs into user env). **Confirmed.** README, changelog 0.11.0 / 0.13.0.
- Does **not** require Microsoft Python extension. **Confirmed.** README.
- Integrated terminal in initialized projects uses project interpreter; `pyne`/`python`/`pip` available. **Confirmed.** README.
- **Report a Problem**: opt-in, redacts paths/credentials, optional script attach. **Confirmed.** README.

### Chart

- Interactive streaming **candlestick chart** (implementation named **KLineChart** in changelog 0.1.0). **Confirmed** (library name from changelog, not marketing pages).
- Pine plot family: lines, histograms, steplines, areas, `plotcandle`/`plotbar`, `bgcolor`, `barcolor`, fills, shapes, `hline`; drawings `line`/`label`/`box`/`table`. **Confirmed.** README.
- Per-plot **Layers** popup (toggle without re-run). **Confirmed.** README (`chart.gif`).
- Legend, measure tool, go-to-date, fullscreen, CSV export of plots/trades. **Confirmed.** README.
- Chart styles: candles, hollow, OHLC bars, monochrome, line, area; remembered. **Confirmed.** changelog 0.1.0.
- Price axis: auto-fit, log, percent (TradingView-like A/L/%). **Confirmed.** changelog 0.1.0.
- Color schemes: Classic teal/red, Theme, Colorblind-safe blue/orange; live recolor on VS Code theme change. Script-set colors not overridden. **Confirmed.** changelog 0.1.0.
- Strategy overlays: trade markers, equity/performance curve, Trades / Stats tables; trade details button. **Confirmed.** README, changelog 0.11.1.
- **Data Window** (OHLCV, plots including `display.data_window`, strategy equity; follows crosshair; paused-bar in debugger). **Confirmed.** changelog 0.13.0.
- Status-line-only plots appear in legend without drawing. **Confirmed.** changelog 0.13.0.
- `text_formatting` bold/italic on labels/boxes/table cells. **Confirmed.** changelog 0.13.0.
- Label hover tooltips + web/file links. **Confirmed.** changelog 0.14.0.
- **Open Chart Source** toolbar. **Confirmed.** changelog 0.13.2.
- **Robustness** tab on the chart after tests. **Confirmed.** README, changelog 0.14.0.
- Live/realtime broker charting inside the IDE. **Unknown** as an IDE product claim. PyneCore CLI has `pyne run --live` ([news 2026-07-22](https://pynesys.io/news/2026-07-22-pynecore-v660-released-pynecore-becomes-a-platform-data-sour/)); IDE README talks about streaming the **run** onto candles, not live exchange ticks.

### Backtest / run / debug / profile

- One-click **Run** compiles `.pine` via PyneSys cloud, caches by content hash, streams bars onto the chart. Unchanged files skip upload. **Confirmed.** README Privacy section.
- **Pyne code runs entirely locally**, no account. **Confirmed.** README, [ide FAQ](https://pynesys.io/ide/).
- Stop / restart run from editor title; pause at next bar, resume. **Confirmed.** changelog 0.1.0; OVSX commands `pauseRun` / `resumeRun` / `cancelRun`.
- Custom **`pyne` debug adapter** (not Microsoft Python debugger): bidirectional Pine↔Python sourcemap, demangled names, synthetic **Pyne** scope (bar OHLCV/time), series watches (`close[1]`). **Confirmed.** README, changelog 0.1.0.
- **Next bar**, **Run to bar**, **chart-bar breakpoints** (pick bar/date on chart). **Confirmed.** README (`debug.gif`, `chart-breakpoint.gif`).
- Line **profiler** (flame button): per-line share, heat column, top-3 flames, hover time/executions/`request.security` breakdown; sourcemap onto Pine lines; `output/<script>_profile.json`; needs **Python 3.13+**; CLI `pyne run --profile`. **Confirmed.** README, changelog 0.10.0, [dev-updates 0.10](https://pynesys.io/dev-updates/).
- **Robustness** tests (PyneCore ≥ 6.13.0; 0.14.1 extras need 6.13.1): R-multiple, CI, bootstrap mean, Monte Carlo path ruin, extra cost-to-zero, yearly, coin-flip direction/timing; seeded; CSV; settings `pyneide.robustness.*`; CLI `pyne robustness`. **Confirmed.** README, changelog 0.14.0 / 0.14.1.
- Performance stats include Sharpe/Sortino with script `risk_free_rate` (fixed for Core 6.12.1). **Confirmed.** changelog 0.13.0.
- Bundled Pine demos run/debug without compile quota. **Confirmed.** README.

### Data

- **Symbol Browser** + download wizard over **multiple providers**; read-only OHLCV table custom editor; Symbol Map for `request.security()`. **Confirmed.** README (`data.png`), changelog 0.1.0.
- Per-feed actions: Update (continue), Truncate & re-download, other timeframe, Preview Chart, Delete. **Confirmed.** changelog 0.1.0.
- OHLCV binary format is self-describing (extra series e.g. bid/ask, OI, VWAP show as columns). **Confirmed.** changelog 0.1.0.
- Market-data requests go **directly to the provider** (not through PyneSys); keys stay in local workdir config. **Confirmed.** README Privacy.
- Providers named in public ecosystem: **CCXT** (optional extra on PyneCore), **Bybit v5** plugin repo, **replay** provider. **Confirmed** for PyneCore, **Inferred** that IDE plugin manager can install the same catalogue. [pynecore GitHub](https://github.com/PyneSys/pynecore), [pynecore-plugin-bybit](https://github.com/PyneSys/pynecore-plugin-bybit), README “Manage Plugins”.
- Demo/sample data shipped with initialized projects. **Confirmed.** README.
- Exact default exchange list in the Symbol Browser UI. **Unknown** from public pages (not enumerated on README/marketing).

### UI

- Dedicated **Pyne** activity-bar view: Scripts, Data, Output. **Confirmed.** README.
- Status bar environment menu (plugins, LS update/rollback, compile usage, sign-in). **Confirmed.** README, changelog 0.13.1.
- **Pine Script in PyneIDE** paywall/plan panel when compile needs account/quota; **Copy and open in PyneIDE** from web app. **Confirmed.** changelog 0.11.1.
- Documentation command bundles PyneIDE + PyneCore docs, walkthrough, issues. **Confirmed.** changelog 0.1.0 / 0.9.0.
- Hidden by default: `.pyneide/`, agent files (`pyneide.showAgentFiles`). **Confirmed.** README.

### Distribution

- Marketplace + Open VSX + GitHub VSIX. **Confirmed.** (see Install targets.)
- GitHub release workflow publishes verified VSIX to Marketplace (Entra WIF, 0.9.2) and Open VSX (0.10.0). **Confirmed.** changelog.
- OVSX: `verified: true`, `publishedWithTrustedPublishing: true`, `deprecated: false`, `preRelease: false` at API level while `preview: true` in manifest. **Confirmed.** OVSX API. (API `preRelease` vs manifest `preview` differ.)
- First public preview **0.1.0** 2026-07-24; Marketplace preview 2026-10-22; OVSX 2026-10-25. **Confirmed.** changelog, news.

### Pricing / license constraints

See dedicated section below. Short:

- Extension **free** (GPL-3.0-only). Runtime **Apache-2.0**. Compiler **closed-source SaaS**.
- Pine compile quotas billed; Pyne local run free.
- Cloud compiler **caches source + generated Python** per account. **Confirmed.** README Privacy, [terms](https://pynesys.io/terms/).

### Integrations

- **PyneCore** local runtime (min 6.12.1 for current IDE). **Confirmed.** README.
- **PyneComp** cloud compiler + CLI `pyne compile` / `pyne run file.pine` + HTTP `POST https://api.pynesys.io/compiler/compile`. **Confirmed.** [compiler page](https://pynesys.io/compiler/).
- **Logto** auth, **Stripe** payments. **Confirmed.** [pynesys.io](https://pynesys.io/) Data Handling.
- **Discord** bot: 3 free lifetime conversions, v4–v6, 25 KB cap. **Confirmed.** [compiler](https://pynesys.io/compiler/), [about](https://pynesys.io/about/).
- Plugin manager / `pyne.plugin` ecosystem (providers, brokers, CLI plugins). **Confirmed** for Core; IDE “Manage Plugins”. [PyneCore v6.6.0 news](https://pynesys.io/news/2026-07-22-pynecore-v660-released-pynecore-becomes-a-platform-data-sour/).
- Freqtrade example (Pine indicators in a Freqtrade strategy). **Confirmed.** [pynesys.io](https://pynesys.io/) links `/blog/pine-script-in-freqtrade-with-pynecore/`.
- Cursor/Claude agent skill folders. **Confirmed.** README.
- B2B: REST API today; **browser WASM/Pyodide** “Q4 2026”; **embeddable SDK** “Q1 2027”; visual builder and strategy marketplace “in active development”. **Confirmed** as *roadmap claims*, not IDE features. [pynesys.com](https://pynesys.com/), [pynesys.com/technology](https://pynesys.com/technology/).
- Live broker execution **inside PyneIDE**. **Unknown** (Core has live mode; IDE pages do not sell it).

## Screenshots / media (as published)

Marketing and README media (not captured locally; described from alt text and surrounding copy):

| Asset | Where | Description |
| --- | --- | --- |
| `media/debug.gif` | Marketplace/GitHub README | Debugger paused on a Pine script: Next-bar stepping, live Pyne scope, series `fastMa` unfolded as history; chart grows one candle at a time. |
| `media/pine-ls.png` | README, [ide](https://pynesys.io/ide/) (`pine-ls_hu_*.webp`) | Pine signature help with parameter docs; diagnostics in Problems. |
| `media/chart-breakpoint.gif` | README | “Choose Bar on Chart”: click a candle; debugger pauses on that bar. |
| `media/run.gif` | README | CodeLens above line one compiles Pine and streams onto a candlestick chart beside the editor. |
| `media/inputs.gif` | README | Inputs form beside script; MA-type dropdown; Save re-runs; source untouched. |
| `media/chart.gif` | README | Layers popup toggling plots on/off without re-run. |
| `media/profile.gif` | README | Flame profile: gutter column of time share; hover on costly WMA line (~39%). |
| `media/pyne.png` | README | Pyne hover docs + typo caught as you type. |
| `media/env.png` | README | Managed environment setup UI. |
| `media/data.png` | README | Symbol Browser + Pyne workspace tree (Scripts/Data/Output). |
| `media/logo.png` | README | Product logo (also claimed plotted in Pine on about page). |
| Homepage hero | [pynesys.io](https://pynesys.io/) | “PyneIDE: compiling and running a Pine strategy” (video/animation). |
| IDE hero | [pynesys.io/ide](https://pynesys.io/ide/) | “PyneIDE: stepping through a Pine strategy”. |
| Convert screenshot | [compiler](https://pynesys.io/compiler/) | Pine strategy vs generated `@pyne` Python (`convert-to-pyne_*.webp`); upload / convert / run-local stills; Discord bot preview. |
| X post media | [@pynesys](https://x.com/pynesys) 2026-10-22 | Marketplace launch screenshot (PNG). |

Robustness tab, Data Window, and plan panel are described in changelog/README but **no dedicated public screenshot** was found for those three. **Unknown** visual for robustness UI.

## Pricing / license constraints

### Extension and runtime (free)

- PyneIDE: **GPL-3.0-only**, Copyright (C) 2026 PYNESYS LLC. **Confirmed.** README License, OVSX.
- PyneCore: **Apache-2.0**, Python 3.11+, no required dependencies. **Confirmed.** [pynecore.org](https://pynecore.org/), about page.
- Writing, running, debugging **Pyne code in PyneIDE: no account, no API key**. **Confirmed.** [ide](https://pynesys.io/ide/), homepage FAQ.

### Pine compilation (paid SaaS)

PyneComp is **closed source**, classical compiler (no LLM), same output every time. Used from PyneIDE, web app, CLI, HTTP API. **Confirmed.** [about](https://pynesys.io/about/), [compiler](https://pynesys.io/compiler/).

Plans as shown on [pynesys.io](https://pynesys.io/) and [pynesys.io/ide](https://pynesys.io/ide/) on 2026-11-09 (USD / month, Stripe, cancel anytime, no partial-month refunds per [terms](https://pynesys.io/terms/)):

| Plan | Price | Converts | Hourly | API keys | Max script size |
| --- | --- | --- | --- | --- | --- |
| Free Pyne | $0 | n/a (no Pine compile) | n/a | 0 | n/a |
| Discord trial | $0 | **3 lifetime** | — | — | 25 KB |
| Seed | **$8** | 5 / day | 1 | 1 | 25 KB |
| Sprout | **$18** | 30 / day | 5 | 2 | 50 KB (new subs) |
| Grower | **$28** | 700 / week | 60 | 5 | 150 KB |
| Forest | **$48** | 2100 / week | 120 | 10 | 300 KB |

Notes **Confirmed** on homepage pricing:

- Failed conversions **do not** count.
- Each run of a **changed** `.pine` is one compile; cache hits do not count.
- v4/v5 → v6 conversion does not use quota.
- Generated Pyne is the user’s to read, edit, keep.
- Grower/Forest exist because the IDE **recompiles on every edited run**.

[News 2026-10-24](https://pynesys.io/news/2026-10-24-sprout-is-now-18-a-month-and-forest-is-48-for-new-subscriber/): Sprout cut $20 → $18; new Sprout max size 50 KB (existing keep 100 KB); Forest new subs $48 (existing stay $45). Seed $8 and Grower $28 unchanged.

**Firewood** one-time credit pack ($700 / 50k credits) appears on third-party summaries; **not** on the live homepage/compiler pricing tables fetched 2026-11-09. Treat as **Unknown / possibly withdrawn**.

### Legal / operational constraints

- Converted code inherits the original Pine script’s license. **Confirmed.** [terms](https://pynesys.io/terms/).
- No redistributing the conversion service / using keys for other people without a written agreement. **Confirmed.** terms.
- No reverse-engineering conversion algorithms. **Confirmed.** terms.
- Service not available in US-sanctioned countries. **Confirmed.** terms.
- Subscription does **not** guarantee a given script compiles or matches; compatibility is documented on PyneCore. **Confirmed.** terms.
- Compiler caches submitted Pine and generated Python, tied to account, not shared with third parties, retained while account exists. **Confirmed.** README Privacy + terms.
- Untrusted folders: extension refuses to activate. **Confirmed.** OVSX package.json.

### B2B (pynesys.com, not the IDE SKU)

Self-service API; pilot partnership; enterprise white-label SDK. WASM-in-browser targeted Q4 2026. **Confirmed** as marketing, not current IDE surface. [pynesys.com](https://pynesys.com/).

## Related products

| Product | Role | License | Notes | Source |
| --- | --- | --- | --- | --- |
| **PyneIDE** | VS Code / OVSX extension | GPL-3.0-only | This inventory | listings |
| **PyneComp™** | Pine → Pyne compiler | Closed, SaaS | Deterministic, no LLM | about, compiler |
| **PyneCore™** | Runtime + CLI `pyne` | Apache-2.0 | Bar-by-bar Pine semantics; optional Rust transform (news 2026-10-30); PyPI `pynesys-pynecore` | [pynecore.org](https://pynecore.org/), [GitHub pynecore](https://github.com/PyneSys/pynecore) |
| **Pyne code** | DSL: Python syntax + Pine series/state | (user code) | `@pyne` / `@pyne edge` | [What is Pyne code](https://pynecore.org/docs/overview/pyne-code/) |
| **Pyne in the Wild** | Public TV parity report | — | Snapshot 2026-10-24: 1000 scripts, 1353/1353 comparable outputs match, 99.771% of 132M bars bit-identical, 353,577 trades | [wild.pynesys.io](https://wild.pynesys.io/), homepage |
| **Learn book** | “Trading indicators and strategies with Pyne code”, free, 12 languages | — | Teaches via PyneIDE; no account needed | [news 2026-10-18](https://pynesys.io/news/), [pynecore.org/learn](https://pynecore.org/learn/en/02-first-project/) |
| **Web app** | Convert + account + keys | — | https://app.pynesys.io | compiler, README |
| **HTTP API** | `api.pynesys.io` | paid | OpenAPI at `/docs` | compiler |
| **Discord** | Community + 3 free converts | — | https://discord.pynesys.io ; ~742 members claimed on pynesys.com | pynesys.com, compiler |
| **Bybit plugin** | Data + broker | Apache-2.0 | Separate repo | GitHub |
| **pynesys.com** | B2B embed / WASM / SDK | — | Distinct from pynesys.io IDE/compiler site | pynesys.com |

Parity numbers are **vendor-published** (Wild report). Treat as Confirmed *as claims*, not independently re-run here.

## Changelog highlights (public, 0.9 → 0.14.1)

Source: [OVSX changelog](https://openvsx.eclipsecontent.org/pynesys/pyneide/0.14.1/changelog.md) / GitHub releases.

- **0.9.0** (2026-10-15): first “preview toward 1.0”; strategy properties; bundled Core docs; remove-env; Core pin 6.10.10; Windows data fix.
- **0.9.2** (2026-10-22): Marketplace auto-publish.
- **0.10.0** (2026-10-25): profiler; Open VSX publish.
- **0.11.0**: per-project `.pyneide/venv`; Core version pin.
- **0.11.1**: free precompiled Pine demos; in-IDE plans/API-key panel.
- **0.13.0**: Data Window; min Core 6.12.1; rename listing to “Debugger and Backtester”.
- **0.14.0**: Robustness suite.
- **0.14.1**: robustness jobs / early-stop (Core 6.13.1).

## Unknowns (public surface)

- Exact Symbol Browser provider list in the shipping IDE (CCXT/Bybit confirmed in Core; UI list not published).
- Whether IDE exposes Core **live/`--live` broker** mode.
- Whether Firewood credit SKU still exists.
- Unique-user install count (OVSX 1344 downloads ≠ Marketplace 57 installs; metrics differ).
- Runtime behavior vs claims (needs VSIX/runtime inspect, other card).
- Full command/setting/view contribution list (present in public `package.json` on OVSX; **owned by VSIX inspect card** — not duplicated here).

## Links dump

### Listings
- https://open-vsx.org/extension/pynesys/pyneide
- https://open-vsx.org/api/pynesys/pyneide
- https://open-vsx.org/api/pynesys/pyneide/0.14.1/file/pynesys.pyneide-0.14.1.vsix
- https://openvsx.eclipsecontent.org/pynesys/pyneide/0.14.1/readme.md
- https://openvsx.eclipsecontent.org/pynesys/pyneide/0.14.1/changelog.md
- https://openvsx.eclipsecontent.org/pynesys/pyneide/0.14.1/package.json
- https://marketplace.visualstudio.com/items?itemName=pynesys.pyneide
- https://marketplace.visualstudio.com/publishers/pynesys

### Product / company
- https://pynesys.io/
- https://pynesys.io/ide/
- https://pynesys.io/compiler/
- https://pynesys.io/about/
- https://pynesys.io/news/
- https://pynesys.io/dev-updates/
- https://pynesys.io/terms/
- https://pynesys.io/privacy/
- https://pynesys.io/contact
- https://pynesys.com/
- https://pynesys.com/technology/
- https://app.pynesys.io
- https://app.pynesys.io/signup
- https://api.pynesys.io/docs
- https://api.pynesys.io/compiler/compile

### Runtime / language / proof
- https://pynecore.org/
- https://pynecore.org/docs
- https://pynecore.org/docs/overview/what-is-pynecore/
- https://pynecore.org/docs/overview/pyne-code/
- https://pynecore.org/docs/overview/ecosystem
- https://pynecore.org/docs/overview/compatibility/
- https://pynecore.org/learn/en/01-what-is-pyne/
- https://pynecore.org/learn/en/02-first-project/
- https://wild.pynesys.io/
- https://pypi.org/project/pynesys-pynecore/

### GitHub
- https://github.com/PyneSys
- https://github.com/PyneSys/PyneIDE
- https://github.com/PyneSys/PyneIDE/issues
- https://github.com/PyneSys/PyneIDE/releases
- https://github.com/PyneSys/PyneIDE/blob/HEAD/CONTRIBUTING.md
- https://github.com/PyneSys/PyneIDE/blob/HEAD/SECURITY.md
- https://github.com/PyneSys/pynecore
- https://github.com/PyneSys/pynecore/discussions
- https://github.com/PyneSys/pynecore-examples
- https://github.com/PyneSys/pynecore-plugin-bybit

### News cited
- https://pynesys.io/news/2026-10-16-pyneide-090-preview-available-for-early-testing/
- https://pynesys.io/news/2026-10-18-learn-pyne-from-scratch-a-free-book-for-building-indicators/
- https://pynesys.io/news/2026-10-22-pyneide-preview-is-now-on-the-vs-code-marketplace/
- https://pynesys.io/news/2026-10-24-sprout-is-now-18-a-month-and-forest-is-48-for-new-subscriber/
- https://pynesys.io/news/2026-10-25-pyneide-010-is-out-now-on-open-vsx-too/
- https://pynesys.io/news/2026-10-25-pynecore-can-now-show-you-where-a-backtest-spends-its-time/
- https://pynesys.io/news/2026-11-08-pynecore-can-now-test-whether-a-backtest-result-is-luck/
- https://pynesys.io/news/2026-07-22-pynecore-v660-released-pynecore-becomes-a-platform-data-sour/
- https://pynesys.io/news/2025-06-25-pynesys-is-now-in-public-beta/

### Community
- https://discord.pynesys.io
- https://discord.com/invite/jegnhtq6gy
- https://x.com/pynesys
- https://www.youtube.com/@pynesys
- mailto:hello@pynesys.com (org profile)

---

*Inventory only. No AXIS comparison. VSIX contribution dump left to `_research-pyneide-vsix.md`.*
