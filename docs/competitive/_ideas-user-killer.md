# Killer features a Pine author would switch for

**Voice:** trader / Pine author who lives in VSCodium all day. Git, not a browser tab. Replay, data I own, privacy, speed to first plot, “why is my strategy lying,” shareable charts, TradingView muscle memory.

**Job of this file:** 7 concrete scenes, not slogans. Docs (`oo-spec-1`) **picks exactly 3**. Engineering does not card from this file until that pick.

**Fetched / recited:** 2026-11-09. Ideas only. No product code. Do not restore Workers / Plugins / Alerts / Watchlist / Scripts / Layers **studios**. Do not clone PyneIDE branding or DAP type `pyne`.

AXIS **already ships** (working tree, not a Marketplace republish): chart chrome (layers, data window, legend, fullscreen, open source), inputs form on the chart, strategy table + CSV + markers + equity, bar debugger DAP type `axis-bar`, local Pyodide wheel (`hoox_pyne-0.6.29` + Runtime envelope, flag default **false**). Sources: `docs/competitive/axis-capability-list.md` tables A–D; README Status.

These ideas are **switch reasons**. They sit on that core. They are not “add a symbol-browser studio.”

---

## How Docs picks exactly 3

Score each idea. Keep **three**. Kill the rest for this round.

| Gate | Pass means |
| --- | --- |
| Switch, not parity | A TV-native Pine author would change their **home editor** for this one scene. “We also have X” is fail. |
| Both competitors | The scene is worse or impossible on **TradingView web** *and* on **PyneIDE 0.14.1** (cloud Pine compile, paid). |
| Lives in AXIS core | Chart custom editor, native Debug view, Output, git files. **No** activity-bar studio. |
| Foundation exists | Uses chrome / table / inputs / `axis-bar` / local wheel that already landed. |
| Privacy | Does not require uploading `.pine` to a compiler cloud, and does not make that the happy path. |

Suggested spread (not the pick): one **privacy / first plot**, one **lying strategy**, one **shareable chart**. Docs may choose another spread if a scene scores higher.

---

## Already in the bag — do not re-sell as new

| Surface | Why it is not a killer by itself | Source |
| --- | --- | --- |
| Chart chrome | Toolbar is table stakes once PyneIDE and TV exist. | AXIS capability list A; PyneIDE README chart |
| Inputs on chart | PyneIDE already has `input.*` → sibling `.toml`. TV has the script Settings dialog. | [pynesys.io/ide](https://pynesys.io/ide/); TV Pine editor |
| Strategy table + CSV | TV Strategy Tester; PyneIDE Trades/Stats. | PyneIDE README; TV Strategy Tester |
| DAP `axis-bar` | PyneIDE already markets bar-step as *the* TV gap. Shipping a debugger is parity with PyneIDE, not a switch from it — unless it answers a **trade** without a paid compile. | [pynesys.io/ide](https://pynesys.io/ide/) “TradingView has no step-through debugger for Pine.” |
| Local Pyodide wheel | Dead if first plot still needs a Pro key, a CDN wait, or a flag the user never finds. | AXIS capability list C; README Pyodide |

The killers below **complete** those into a day I would not go back from.

---

## K1 — Airplane-mode first plot

**Theme:** privacy + speed to first plot.

**Scene.** Friday 22:40, seat 14A, no wifi. Legal already said the ORB script does not leave the laptop. I paste a TradingView `strategy()` into `orb.pine`, sibling `orb.axis.json` opens, I hit `Ctrl+Enter`. Candles, plots, trade markers. No account. No API key. No “5 compiles / day.” Source bytes uploaded: **zero**. I land, I still have the same chart because it is a file.

**TradingView web.** Pine compiles and runs on their servers. No editor, no git, no offline. The script lives in their Pine Editor; I am a guest in a browser tab.

**PyneIDE.** Pyne (Python) is free and local. **`.pine` is not.** “Pine Script files are compiled by the PyneSys cloud compiler, which needs an API key from one of the plans.” Unchanged scripts hit a cache; **each edit is a compile**. Seed **$8 / mo** (5/day, 25 KB); Sprout **$18**; Grower **$28** (60/hour); Forest **$48**. First-run also downloads managed CPython/uv (~80 MB) and needs a real filesystem (no untrusted/virtual workspaces). Airplane mode on a `.pine` I just edited: **blocked**. Sources: [pynesys.io/ide FAQ](https://pynesys.io/ide/); [pricing on same page](https://pynesys.io/ide/); `_research-pyneide-public.md`; `_research-pyneide-vsix.md` capabilities.

**AXIS already has.** Opt-in Pyodide + trusted `hoox_pyne` wheel + Runtime envelope that paints the same plot kinds as `/run`. `Ctrl/Cmd+Enter`. Mock bars so I am not waiting on a feed.

**What would make me switch.** First plot is the **default** path: pack install → open `.pine` → Run → picture. Flag-off-by-default is a researcher default, not a trader default. Honest banner if Wasm is still downloading; never a silent Pro upload. Wheel on disk so the second flight works with the radio off.

**Not this.** A “Get Started” walkthrough clone. A paywall panel. Uploading source “just this once.”

**Done-when (user).** Cold VSCodium, no network after the VSIX is installed, fixture strategy in `fixtures/` plots `chart.full` in one keystroke. Run output can say `engine=pyodide wheel=hoox_pyne-0.6.29 uploaded=0`.

---

## K2 — Click the lying trade

**Theme:** “why is my strategy lying.”

**Scene.** TV Strategy Tester printed +12% and a pretty equity curve. I know that Tuesday fill: I would have been stopped, not banked. In AXIS I click the green triangle in the **strategy table**. The chart jumps, a debug cursor sits on that bar, VS Code Debug view opens **Bar** (OHLCV + time) and **Series** (plot columns, `na` is `na`, not `null`). I step **back** one bar. `close[1]` is the prior close. The filter that should have blocked the entry is `na` on that bar. The fill price is the bar **high** because I did not use `process_orders_on_close`. I am not adding `plotchar(bar_index)` to the script. I am looking at the **trade**.

**TradingView web.** Official debugging is `plot` / `plotchar` / labels / Pine Logs. Docs never offer a step-through debugger. Third-party write-ups say it outright: “Pine Script doesn’t have a traditional step-through debugger like an IDE.” Sources: [Pine debugging (v5)](https://www.tradingview.com/pine-script-docs/v5/writing/debugging/); [v6 debugging](https://www.tradingview.com/pine-script-docs/writing/debugging/); [trading-strategies.academy](https://trading-strategies.academy/archives/401). Strategy Tester is a **report**, not a bar inspector.

**PyneIDE.** This is their headline: “TradingView has no step-through debugger for Pine.” Line breakpoints, next bar, run-to-bar, chart-bar BP, sourcemap, `close[1]` watches. **Catch:** for `.pine` that debugger sits **behind cloud compile + quota**. The lying trade I care about is almost always a Pine strategy I still publish on TV, not a `@pyne` rewrite. Clicking a **trade row** is not their marketed loop (editor BP → next bar). Source: [pynesys.io/ide](https://pynesys.io/ide/); README debugger; DAP type `pyne` in `_research-pyneide-vsix.md`.

**AXIS already has.** Strategy table + markers + equity on the chart. DAP `axis-bar` with bar-step, stepBack, chart-bar breakpoints, Series/`na`, `chart.debugCursor`. Commands `axis.debug.start` / `stepBar` / `toggleBarBreakpoint`.

**What would make me switch.** The table is the debugger’s index: click trade → that bar, those series, that fill. Bidirectional: Debug cursor moves, table highlights the open position. `na` in the variables view is the smoking gun, not a JS `null`. Works on the **local wheel**, so I am not burning Grower compiles to ask why one fill is wrong.

**Not this.** A Replay studio. DAP type `pyne`. Microsoft Python debugger. Cloning PyneIDE’s sourcemap UI.

**Done-when (user).** Fixture strategy with a known bad fill: click row 7 in the strategy table → cursor on that `bar_index` → Series shows the `na` filter → stepBack still matches the previous table row.

---

## K3 — The chart is a git object

**Theme:** shareable charts.

**Scene.** PR `#184`. Description is not a PNG. Reviewer checks out the branch, opens `charts/btc-orb.axis.json`. Same symbol pointer, same inputs, same drawings, same script path. They hit Run. The plot matches the screenshot I did not attach. They comment on the **input** that changed the win rate, in the same diff as the Pine. Discord gets a repo path, not a snapshot URL that lives on someone else’s CDN.

**TradingView web.** Share is a **snapshot image** (camera icon, hosted link, does not expire, does not update) or a **published idea** (public / friends / invite-only) or a view-only layout link the recipient can **Copy**. Scripts are private until published; layouts are not git. The unit of sharing is a URL on TradingView. Sources: [How to share a snapshot](https://www.tradingview.com/support/solutions/43000482537-how-to-share-a-snapshot/); idea/layout sharing write-ups citing TV’s share/privacy help.

**PyneIDE.** Honest win vs TV: scripts are files. Inputs live in sibling `.toml`. Chart is a **webview panel**, not a file; the custom editor is `*.ohlcv` tables. There is no `*.axis.json` I can review. “Copy and open in PyneIDE” `onUri` from their web app is the other direction (web → IDE), not a git chart. Source: `_research-pyneide-vsix.md` `customEditors: pyneide.ohlcvTable`; changelog 0.11.1 `onUri`.

**AXIS already has.** `axis.chart` custom editor on `*.axis.json`. Inputs persist on `scripts[].inputs`. Open Chart creates the sibling. Drawings commit on the document.

**What would make me switch.** The JSON is the **chart**: script, inputs, data pointer, drawings, visible range. Clone → open → same picture. A one-line “copy chart path for review” that a human can paste in a PR. Optional sealed export (K7) for people not in the repo. Never a public idea feed as the default share.

**Not this.** A social snapshot host. Publishing to TradingView from AXIS. Restoring a Scripts registry studio.

**Done-when (user).** Two worktrees of the same commit open the same `*.axis.json` and paint the same plots/inputs/drawings after one Run, with no extra UI state in `globalStorage` required for the picture.

---

## K4 — Replay the fill, not the market

**Theme:** replay + lying strategy.

**Scene.** Argument on Discord: “your ORB only works because you peeked at the close.” I click the disputed trade. Future bars go dark. Space (or DAP Continue) reveals **one bar at a time** with the **same engine** that built the strategy table. When the fill prints, the table row appears in the same instant as the marker. I cannot accidentally use a different fill model than the backtest. I am not in a separate “Bar Replay” product with its own paper account.

**TradingView web.** Bar Replay is a first-class chart mode: pick a start bar, hide the future, play/step, optional Replay Trading (separate from Paper Trading; session results **not saved**). Strategy Tester is a **different** loop — dump the whole history, then read the report. Minute replay is gated by plan (free plan: daily+; minute starts at Essential). Sources: [TV Bar Replay help](https://www.tradingview.com/support/solutions/43000712747-bar-replay-how-and-why-to-test-a-strategy-in-the-past/); [Replay Trading](https://www.tradingview.com/support/solutions/43000691889-learn-to-trade-on-historical-data/); [session restore blog 2025-10-06](https://www.tradingview.com/blog/en/continue-your-last-replay-seamlessly-54148/); plan comparison citing TV pricing (LuxAlgo, 2026-11-03).

**PyneIDE.** `pauseRun` / `stepBar` / `runToBar` / chart-bar breakpoints — debugger controls, not a replay that **hides the future** and re-grows the equity as bars arrive. No marketed “click this trade and replay 50 bars around it.” Core has a replay **data provider**; that is feed, not this scene. Source: `_research-pyneide-public.md` commands; pynecore replay plugin.

**AXIS already has.** `chart.debugCursor`, bar-step / stepBack, strategy markers, `from_bar`/`to_bar` already posted on `/run` when the viewport is known.

**What would make me switch.** Replay is a **chart overlay** on `axis.chart` (capability list B already says Skip view). Hide future, play, speed, click-trade-to-window. The table and equity are functions of the revealed prefix, not a second engine. Keyboard close to TV (play / step) so muscle memory survives.

**Not this.** A Replay activity-bar studio. Replay Trading with a fake broker. Gating minute replay behind a paid SKU.

**Done-when (user).** Click trade at `bar_index=1840` → window `[1790, 1840]` dark-to-the-right → Play steps to 1840 → the same row appears in the strategy table with the same fill price as a full run.

---

## K5 — Drop your own bars

**Theme:** data I own.

**Scene.** The desk gives me `es-2024-5m.csv` from the CME file, not a Yahoo symbol. TradingView will not eat it. I do not want a Python venv and a plugin manager at 07:55. I run **Pick Data** → “from file,” or I drop the CSV on the chart. `*.axis.json` points at that file. `request.security` for `ES` 15m maps to a sibling `es-2024-15m.csv` sitting next to it. Offline. When compliance asks where the ticks came from, I point at the file in git-lfs, not “whatever TV had that day.”

**TradingView web.** You chart **their** symbol universe. No “open this CSV as the series.” Replay and Tester both use their history. Export exists; import of arbitrary OHLCV as the primary series does not.

**PyneIDE.** Real Symbol Browser, download wizard, multiple providers, `*.ohlcv` table editor, keys in **local workdir config**, market-data requests go to the provider not PyneSys. Cost: initialized project, uv, plugins (CCXT, Bybit, replay). First data is a **product**, not a drop. Source: `_research-pyneide-public.md` Data; README Privacy.

**AXIS already has.** `axis.pickData` Quick Pick (symbol / timeframe / mock vs datafeed). Loopback datafeed **or** mock bars. Capability list B: Data / symbol browser = **Skip view** — Quick Pick is enough *if* a file is a first-class choice.

**What would make me switch.** File-backed series as the happy path: CSV / the OHLCV I already have, remembered on the `*.axis.json`, no studio. Mock remains the zero-friction demo. Remote datafeed stays opt-in. Mapping for `request.security` is files, not a cloud symbol map.

**Not this.** A Data activity-bar. Cloning PyneIDE’s download wizard. Storing exchange API keys in settings.

**Done-when (user).** Drop `fixtures/` CSV on a chart → candles match the file’s rows 1:1 → Run on the local wheel uses those bars → JSON records the file path, not a vendor symbol.

---

## K6 — TV hands, VSCodium desk

**Theme:** TV muscle memory.

**Scene.** I can rewrite a strategy in Pine with my eyes closed. I cannot relearn an IDE. `Ctrl+Enter` runs. Inputs are grouped the way `input.group` says. Data Window follows the crosshair (OHLCV + plots + equity). I want **A / L / %** on the price scale, measure, go-to-date, layers toggle without re-run. Fullscreen is the chart, not the editor. Open source jumps to the `plot` that drew this line. I never open an activity bar named after the product. Git, multi-file search, and Copilot stay where they are because this is VSCodium.

**TradingView web.** This **is** the muscle memory: Supercharts keyboard, Settings, Data Window, replay button, Strategy Tester tab. The tax is the browser, the account, the Pine Editor gutter, no git, no DAP.

**PyneIDE.** Closest clone of that chrome on a KLineChart webview: layers, legend, measure, go-to-date, fullscreen, data window, candle styles, A/L/%, color schemes, open chart source. They also add a **Pyne** activity-bar (Scripts / Data / Output) and a 72-command surface. I have to accept their project layout (`.pyneide/venv`, nested `.py` / `.py.map` / `.toml`) to get the hands. Source: `_research-pyneide-public.md` Chart + UI; vsix 72 commands.

**AXIS already has.** Layers popup, data window, legend, fullscreen, open source, inputs, strategy table — **on the chart**, no views. Language `when` includes Pine + PYNE. Stop swaps the Run button.

**What would make me switch.** Finish the **hands** so I stop alt-tabbing to TV for “just the scale / measure / go-to-bar,” while the **desk** stays git + DAP + local wheel. Crosshair-driven data window with copy precision. Price scale A/L/%. Measure. Go-to-bar/date. Persist zoom across re-run (PyneIDE already does). Keyboard cheat-sheet mapped to TV where it does not collide with VS Code.

**Not this.** Recreating Supercharts. 72 commands. An activity bar. Theme packs as the headline.

**Done-when (user).** A TV-native can run, change one input, read the data window on hover, measure a swing, and jump to a date **without** opening a non-chart view — documented in a one-page “hands” cheatsheet.

---

## K7 — Sealed “reproduce this” pack

**Theme:** lying strategy + shareable charts + privacy.

**Scene.** “Works on my TV, fails in AXIS.” I export **one folder**: `script.pine` (hash), `inputs` as they ran, the **exact bars** used, `trades.csv`, engine id + wheel version. Colleague on another machine opens the folder, hits Run, gets the **same fills**. If they differ, we file a bug against the engine, not against each other’s screenshots. Compliance gets a zip instead of a TradingView login. I can attach it to a GitHub issue without pasting proprietary source to a compile cloud.

**TradingView web.** You cannot export a sealed, re-runnable backtest. Snapshot is a picture. Strategy Tester CSV is trades, not the bars + script + fill model. Replay Trading results “are not saved anywhere.” Source: [Replay Trading help](https://www.tradingview.com/support/solutions/43000691889-learn-to-trade-on-historical-data/).

**PyneIDE.** Closest: initialized project + sample data + `.toml` + `output/<script>_profile.json` + robustness CSV. Repro is “clone this repo and wait for uv.” Pine still needed a cloud compile to produce the `.py`. Their **Pyne in the Wild** proof (1,000 TV scripts, bit-exact bars) is a **publisher** corpus, not a user export. Source: [pynesys.io/ide proof](https://pynesys.io/ide/); wild.pynesys.io.

**AXIS already has.** Strategy CSV copy; `*.axis.json` as the chart document; local wheel version on disk; run output with engine logs.

**What would make me switch.** One command: **Export run pack**. One command: **Open run pack** (folder or zip). Hash of script+inputs+bars printed in Run output. Same pack is what I git-ignore or encrypt for a desk. Default engine is local, so the pack does not contain a PyneSys receipt.

**Not this.** Telemetry. “Report a Problem” that optionally attaches source to a vendor (PyneIDE has this, opt-in). Publishing packs to a public gallery.

**Done-when (user).** Export pack from a fixture strategy on machine A; open on machine B with network off; trade list hash matches. A one-line mismatch names which of {script, inputs, bars, engine} drifted.

---

## Contrast card (one glance)

| Idea | TV web | PyneIDE 0.14.1 | AXIS lever |
| --- | --- | --- | --- |
| K1 Airplane-mode first plot | Cloud Pine, account, online | `.pine` → PyneComp paid; uv download | Local wheel + Ctrl+Enter |
| K2 Click the lying trade | plotchar / Pine Logs / Tester report | Bar DAP after compile; editor-first | Table row → `axis-bar` |
| K3 Chart is git | Snapshot / idea / layout URL | Files yes; chart is a panel | `*.axis.json` is the chart |
| K4 Replay the fill | Bar Replay ≠ Strategy Tester; plan-gated | Debugger step, not hide-future | Cursor + same table engine |
| K5 Drop your bars | Their symbols | Browser + plugins + venv | Pick Data + file on JSON |
| K6 TV hands | Native, trapped in the browser | Rich chrome + 72 cmds + activity bar | Chart chrome only |
| K7 Reproduce pack | Cannot re-run a picture | Whole project + cloud Pine | Zip of script+inputs+bars+trades |

---

## Out of scope for this round

- Restoring deleted studios (Workers, Plugins, Alerts, Watchlist, Scripts, Layers-as-studio).
- Cloning PyneIDE: DAP type `pyne`, robustness Monte Carlo, line profiler, managed uv, Pine LS inside this repo (language stays `hoox-sh.pyne`).
- Becoming TradingView: broker, social ideas, their data universe, invite-only scripts marketplace.
- Money: no paid compile SKU, no spend, no Marketplace publish without Chief.

---

## Sources

| Id | What | Where |
| --- | --- | --- |
| R-AXIS | AXIS today | `docs/competitive/axis-capability-list.md`; `docs/competitive/_research-axis-current.md` |
| R-CMP | PyneIDE vs AXIS | `docs/competitive/pyneide-vs-axis.md` |
| R-PUB | PyneIDE public surface / pricing | `docs/competitive/_research-pyneide-public.md`; [pynesys.io/ide](https://pynesys.io/ide/) fetched 2026-11-09 |
| R-VSIX | PyneIDE 0.14.1 manifest | `docs/competitive/_research-pyneide-vsix.md` |
| R-README | AXIS shipped loop | `README.md` Status + Lightweight PYNE Options |
| TV-DBG | No step debugger; plot/logs | [Pine debugging v5](https://www.tradingview.com/pine-script-docs/v5/writing/debugging/); [v6](https://www.tradingview.com/pine-script-docs/writing/debugging/) |
| TV-RPL | Bar Replay / Replay Trading | [Bar Replay](https://www.tradingview.com/support/solutions/43000712747-bar-replay-how-and-why-to-test-a-strategy-in-the-past/); [Replay Trading](https://www.tradingview.com/support/solutions/43000691889-learn-to-trade-on-historical-data/) |
| TV-SHR | Snapshot share | [How to share a snapshot](https://www.tradingview.com/support/solutions/43000482537-how-to-share-a-snapshot/) |

---

## Handoff note for Docs

Pick **exactly three** ids (`K1`…`K7`). Write the pick at the top of the comparison or a short `_ideas-user-picked.md` — **not** this file’s job. Engineering cards from the pick, not from the graveyard.
