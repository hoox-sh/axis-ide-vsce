# Engineering side — killer features (AXIS + PYNE)

**Seat:** oo-spec-2 (Head of Engineering). Discussion, not a sprint. No product code.  
**Fetched:** 2026-11-09 from `docs/competitive/axis-capability-list.md` (tables A–D), `pyneide-vs-axis.md`, `_research-pyneide-public.md`, `_research-pyneide-vsix.md`, WT `src/debug/bar-adapter.ts`.  
**Job:** 5–8 features a Pine / Pyne user would uninstall **TradingView web** and/or **PyneIDE** for. Docs picks **exactly 3**.

AXIS today already has the lightweight loop: `axis.chart`, Run/Stop/Output, plot kinds including fill/plotbar/plotcandle, engine drawings, inputs + strategy chrome, Pick Data, Pyodide Runtime envelope (opt-in), DAP type `axis-bar` with bar-step + chart-bar BP + Bar/Series/`na` + `chart.debugCursor`. **Do not recard those.** Do not restore Workers / Plugins / Alerts / Watchlist / Scripts studios.

Rank is “I would uninstall PyneIDE / TV web for this,” not “nice vs PyneIDE 0.14.1.”

---

## Ranked ideas

### 1. First-divergence vs TradingView (strategy CSV + plot CSV)

**Who / when:** A strategy author who just exported *List of Trades* (and maybe plot CSV) from TV’s Strategy Tester. They open the same `.pine` in AXIS, hit Run, and the local backtest is “close but not the same.” This is the moment they currently *go back to TV* and stay there.

**What the product does:** AXIS ingests the TV export (CSV drop onto the chart or a command on the `.pine` buffer). It aligns by time, not by row index. The chart marks the **first bar where a fill, size, or PnL disagrees**. Debug cursor jumps there. A small chart-chrome panel (not a studio) lists: our fill vs TV fill, commission/slippage assumption, and the last `strategy.*` values on that bar. Optional second pass: overlay TV plot columns vs our `plot_meta` and highlight the first series that diverges.

**Why it is murder-worthy:** TV is the referee. PyneIDE’s local PyneCore run does not close this loop; you still eyeball two windows. Whoever shows *the bar TV disagrees on* becomes the development IDE. TV web cannot debug itself this way.

**Not shipped:** capability list has strategy table/CSV/markers/equity from *our* engine only. No TV import, no first-divergence.

**Owner surface:** AXIS chart chrome + `axis-bar` cursor. PYNE Runtime must emit broker events with timestamps we can join (already in `/run` envelope `events`).

---

### 2. Repaint / lookahead radar

**Who / when:** Anyone who has been burned by a strategy that looks perfect on the chart and dies live. Classic Pine pain: `request.security(..., lookahead=barmerge.lookahead_on)`, `calc_on_every_tick`, `ta.valuewhen` on a future-touched series, `barstate.isconfirmed` skipped, HTF close used on an unfinished HTF bar.

**What the product does:** After a run, every plot, shape, and trade marker that *could see the future relative to the bar it is drawn on* gets a hatch overlay and a gutter mark on the source line. Click the overlay: a peek shows the expression, the lookahead mode, and a **confirmed-only** ghost series (what the plot would have been if it only used closed bars). Toggle “live-safe” on the chart: hide repainting plots, keep confirmed ones. PYNE LSP also warns as you type (`lookahead_on`, insecure `security` arity, `strategy.entry` in an `if close[0]` that isn’t `barstate.isconfirmed`).

**Why it is murder-worthy:** TV *hides* this. PyneIDE’s Edge linter is import-time subset checking, not a chart-visible taint of plots vs fills. This is the one feature that saves real money. People would keep AXIS open even if they still publish on TV.

**Not shipped:** no radar, no confirmed-only ghost, no LSP taint. Alerts chip is count-only — not this.

**Owner surface:** PYNE (static taint + diagnostics) + AXIS paint (overlay). No new view.

---

### 3. Offline TV-faithful run of *their* script (imports + `request.security`, source never uploaded)

**Who / when:** A Pine author with a published script that `import`s two TV libraries and calls `request.security` on a higher TF. PyneIDE will run it only after **PyneComp cloud compile** (Seed $8 … Forest $48/mo; source uploaded unless hash cache hits — `_research-pyneide-public.md`, pynesys.io pricing). TV web always has the source. AXIS today runs a fixture strategy through the Pyodide wheel **if** it is self-contained bars-in Pine (`axis-capability-list.md` table C). Real user scripts bounce.

**What the product does:** Open `foo.pine` + `foo.axis.json`. Run. No Pro key, no PyneSys account. Workspace (or a cache of fetched-once library sources the user pasted) resolves `import user/Lib/ver`. Extra symbols/TFs from Pick Data / datafeed are joined the way Pine `security()` joins — and the HTF series is inspectable (idea 5). Failure is honest: “library X/Y/1 not on disk” / “security symbol not in chart extras,” never a silent `plot(close)` subset.

**Why it is murder-worthy:** This is the PyneIDE uninstall. Their IDE is free; **Pine compile is the product**. If AXIS+PYNE runs the user’s actual `.pine` locally, the $8–$48 tax and the upload become the reason to leave. TV uninstall is partial (they still publish there) but daily authoring moves.

**Not shipped:** table C explicitly excludes live datafeed ownership, cron, Numba. Libraries and `request.security` are not in the “100% = Runtime envelope” claim. P1-6 in the comparison (“local Pine→PYNE compile”) is still a gap.

**Owner surface:** PYNE Runtime (library loader + security join) + AXIS host (multi-series history on the existing Pick Data path). Do **not** add a Libraries studio; unresolved import is a Problem + Quick Pick “add this symbol to the chart.”

---

### 4. Click-bar Pine machine (full state, not plot columns)

**Who / when:** The user who is staring at a weird spike on bar 4821. TV: replay is visual, no watches, no `var`. PyneIDE: headline DAP (`type: pyne`), sourcemap, `close[1]` watches, chart-bar BP. AXIS today: `axis-bar` with **Bar** (OHLCV+time) and **Series** (plot columns), `na` as `na`, step/stepBack, chart click BP (`axis-capability-list.md` table D). Enough to demo, not enough to leave PyneIDE.

**What the product does:** Click a candle. VS Code Debug view shows:

- `Bar` — already shipped.
- `Series` — already shipped (plots).
- `Vars` — `var` / `varip` / `varip`-like persistents with Pine names, not Python mangling.
- `Broker` — `strategy.position_size`, open orders, last fill.
- `Security` — one child per `request.security` call (OHLCV of the HTF bar this LTF bar actually saw).
- Watches: user types `close[1]`, `ta.sma(close,14)[2]`, `na(out)`.

Editor line highlight follows the Pine source (not the Python walker). Step Back is cheap because the run already materialized per-bar snapshots (or a compact ring). Chart cursor and editor stay locked.

**Why it is murder-worthy:** TV has no answer. To uninstall PyneIDE we must **beat** their DAP, not clone type `pyne`. The beat is Broker + Security scopes + watches + step-back that stays glued to `axis.chart`.

**Not shipped:** table D stops at Bar + Series/plot columns. No Vars/Broker/Security, no watch evaluator, no Pine sourcemap.

**Owner surface:** AXIS DAP (`axis-bar` only) + PYNE Runtime snapshot API. Native Debug view. No Replay studio — `chart.debugCursor` already exists.

---

### 5. HTF alignment overlay (`request.security` made visible)

**Who / when:** Indicator author mixing 1m entries with 1h RSI. They do not know whether this 1m bar sees the **current** 1h candle or the **last closed** one. This is the other half of idea 2, but it is a visualization even when lookahead is off.

**What the product does:** If the script used `request.security` / `ticker` extras, the chart can show a second pane (or a ghost candle overlay) of the HTF series **as the LTF bar saw it** — stepped, not resampled by the chart library. Hover LTF bar N: tooltip names the HTF bar time, `lookahead`, and gaps (`na`). Click → jump DAP cursor + highlight the `request.security(` call. Pick Data grows “add extra series for this script” when PYNE reports missing securities (Quick Pick, not a Data studio).

**Why it is murder-worthy:** TV’s data window shows values, not the join. PyneIDE has a Symbol Map for `security()`, not an overlay of *what the bar saw*. This is the feature people screenshot into Discord.

**Not shipped:** Pick Data is symbol + TF + mock/datafeed for the **primary** series. No HTF ghost, no security tooltip.

**Owner surface:** AXIS chart overlay + existing Pick Data. PYNE must return per-bar security keys in the envelope (new field, still chart.full — not a view).

---

### 6. Chart ↔ source inspect at the debug bar

**Who / when:** Every session, dozens of times: “which `plot()` is this line?” / “what is `len` on this bar?” TV: hover the plot, get a number, no jump to source. PyneIDE: Open Chart Source (file), Data Window (values). Neither is a two-way peek.

**What the product does:**

- Click a plot, fill, shape, or trade marker → peek definition (`plot(out, "RSI")` at line 88) and the value **at the debug/crosshair bar**.
- Hover / CodeLens on a `plot` / `strategy.entry` / `var float` in the editor → value at `chart.debugCursor` (or crosshair if not debugging).
- `display.data_window` series already have a data window; this adds **navigation**, not another panel.

Needs plot titles / ids in `plot_meta` (already forwarded) plus a cheap source index from PYNE (line of each plot/entry). No full sourcemap required for v1.

**Why it is murder-worthy:** This is the VS Code-native Pine editor people imagined in 2018. Small, daily, sticky. Combined with idea 4 it feels like a real IDE; without it the DAP is a side panel.

**Not shipped:** Open source toolbar jumps to the script file, not to a call. Data window is values only.

**Owner surface:** PYNE (symbol → line) + AXIS chart click + editor hover. 2-week-shaped if we only use `plot_meta.title` + regex/LSP definition.

---

### 7. Re-eval from cursor bar (Pine edit-and-continue)

**Who / when:** 20k-bar strategy. They change `length` from 14 to 12, or fix a `na` guard, and wait for a full `/run` / Pyodide walk. PyneIDE streams bars but still restarts. TV recompiles the whole history.

**What the product does:** While `axis-bar` is paused on bar N, the user edits the buffer. AXIS offers **Apply from here**: PYNE rewinds persistents to snapshot N−1 (or N, documented), walks to the last bar, and the chart paints a **diff overlay** (old plot ghost vs new). If the change is input-only, reuse the existing inputs form (already shipped) — this idea is for *source* changes. If snapshot is missing, fall back to full run and say so.

**Why it is murder-worthy:** Wall-clock is the hidden tax of local engines. A 2-second fix loop vs a 40-second full interpret is why people stay on TV’s tiny scripts and never test on real history in an IDE.

**Not shipped:** Run is whole-envelope `chart.full`. Inputs Apply re-runs the whole script. DAP has no snapshot ring.

**Owner surface:** PYNE interpreter checkpoints + AXIS `chart.delta` (comparison P0-9, still not the killer by itself). Trap: promising this without checkpoints — then it is just “fast full run.”

---

### 8. Git-native versioned libraries (TV `import` as folders)

**Who / when:** A desk that shares `MyLib/1` and `MyLib/2` across scripts, or a user who forked a TV library and cannot `import` it without republishing on TV. TV libraries are a cloud silo. PyneIDE workspace libraries exist for intel + compile, still tied to their project layout / cloud Pine path.

**What the product does:** A folder convention (e.g. `pine_libs/user/Name/ver/*.pine`) plus PYNE go-to-definition and Run-time load. `import user/Name/ver` in a buffer that is git-tracked Just Works. Version pin mismatches are Problems (“script asks /2, workspace has /1”). No registry UI. Optional: command “pin this import to the folder on disk.” Publishing to TV remains their problem; authoring becomes git.

**Why it is murder-worthy:** Teams leave TV because scripts are not files. If AXIS is the only place `import` matches git, the pack becomes the team standard. Individual hobbyists care less than idea 1–3.

**Not shipped:** native editor + sibling `*.axis.json` only. No library loader. Scripts studio was deleted on purpose — this must not resurrect it.

**Owner surface:** PYNE (resolve + LSP) + AXIS run (pass `libraries[]` that Pro already documents as Later). Quick Pick to attach a folder, not a view.

---

## Debate

### What looks sexy and is a trap

| Trap | Why it looks good | Why it is a trap |
| --- | --- | --- |
| **Robustness / Monte Carlo tab** | PyneIDE 0.14.0 headline; screenshots well | Users do not uninstall an IDE for coin-flip tests. Needs a trusted engine first (ideas 1–3). If ever: chart tab, not a studio (`pyneide-vs-axis.md` P2-3). |
| **uv-managed CPython + venv** | PyneIDE’s “it just runs” | They spent releases on Windows `pread`, 80 MB downloads, Core pins. We already have opt-in Pyodide + loopback `/run`. Comparison P2-5 says Skip. |
| **Clone PyneIDE DAP type `pyne` / 72 commands / activity bar** | Fast parity on a spreadsheet | Chief: do not clone. Lightweight core deleted those views. DAP stays `axis-bar`. |
| **OHLCV custom editor / download wizard** | Feels like a data product | Looks like the deleted Data studio. Pick Data + HistoryClient is the path (`axis-capability-list.md` table B). |
| **Live broker / alerts manager / watchlist** | “Then we replace TV” | Different product. Alerts are a count chip. Live ownership is out of Pyodide and out of simplify. |
| **AI that writes Pine** | Every pitch deck | Does not fix lookahead, TV divergence, or `security()` joins. Users still cannot trust the script. |
| **Ship Wasm in the VSIX / fake 100% JS Pine** | One-click offline | Capability list: Wasm stays CDN; missing wheel is `ready: false`; no JS subset fallback. |
| **KLineChart swap / TV-lookalike chrome** | Chart envy | Paint kinds already land on LWC. Measure / log scale / candle styles are P1 hygiene, not uninstall bait. |
| **`chart.delta` streaming as the headline** | Comparison P0-9 | Makes long runs less blank. Nobody leaves TV for a progress bar. Do it as plumbing under idea 7. |

### Two weeks vs six months

**~2 weeks (one engineer, no new engine semantics)**

- Idea **6** v1: click plot title → `plot_meta.title` + LSP/definition; hover shows series value at cursor (Series scope already exists).
- DAP watches for `close[1]`-style **already-materialized** series (idea 4 slice, not Vars/Broker).
- HTF overlay v0 if extra series are already on the chart document (idea 5 without a real `security()` join).
- `chart.delta` plumbing, measure, go-to-date, log/% — hygiene, not killers.

**~6–12 weeks (PYNE Runtime contract + AXIS)**

- Idea **4** Vars + Broker scopes if the walker can dump persistents per bar without a new VM.
- Idea **8** folder resolver + `libraries[]` on `/run` / Pyodide.
- Idea **3** for scripts that only need libraries, still single-symbol (no security).

**~6 months (do not pretend otherwise)**

- Idea **1** as a product: TV fill model (commission, slippage, bar magnifier, `process_orders_on_close`, pyramiding) plus CSV join that is not a toy. Wrong fills make the divergence report a liar — worse than nothing.
- Idea **2** dynamic taint (not just grep `lookahead_on`) + confirmed-only ghost series.
- Idea **3** + **5** real `request.security` join (gaps, lookahead, multi-symbol history).
- Idea **7** checkpoint/rewind. This is interpreter work in PYNE, not a toolbar button.

### Recommendation to Docs (not a pick — you pick 3)

If the criterion is uninstall:

1. **Idea 1** (TV first-divergence) — only AXIS can own the chart+DAP loop; it attacks TV’s referee status.  
2. **Idea 2** (repaint radar) — unique vs both competitors; money pain.  
3. **Idea 3** (offline real scripts) — unique vs PyneIDE’s compile tax; idea 8 is a dependency, idea 5 is the visual proof.

Idea 4 is how we keep people after they arrive (and how we beat PyneIDE’s headline). Do not pick 4 without a Runtime snapshot API or it stays a reskin of table D. Idea 6 is the cheap multiplier on 4. Idea 7 is a 6-month engine bet — do not put it in the three unless PYNE commits checkpoints. Idea 8 is necessary plumbing for 3, not a user-facing slogan.

### Constraints this side will not violate

- Zero `contributes.views` unless table B is updated to ADD (today: none).
- DAP type stays `axis-bar`. PYNE stays language-only.
- No Workers / Plugins / Alerts / Watchlist / Scripts studios.
- No Marketplace/OVSX publish from this discussion (Chief).
- Cannot-do is not faked as 100% (table C).

---

## Sources

| Claim | Source |
| --- | --- |
| AXIS shipped chart/run/paint/drawings/inputs/strategy/Pyodide envelope/`axis-bar` | `docs/competitive/axis-capability-list.md` A, C, D |
| No activity-bar studios; debugger is native Debug + overlay | same, table B |
| PyneIDE DAP, profiler, robustness, cloud Pine compile, pricing $8–$48 | `docs/competitive/_research-pyneide-public.md`; `pyneide-vs-axis.md` |
| PyneIDE uploads `.pine` unless cache hit | PyneIDE README Privacy via R-PUB |
| Comparison P0–P2 (delta, profiler, robustness, OHLCV editor, uv skip) | `docs/competitive/pyneide-vs-axis.md` |
| `axis-bar` scopes today = Bar + Series plots | `src/debug/bar-adapter.ts`; capability list D |
| Pro `libraries[]` / profiler unused, not P0 | `docs/competitive/pro-backend-vs-axis.md` Later |

---

## Checklist (discussion artifact)

```
[1] PASS docs/competitive/_ideas-eng-killer.md
[2] PASS test -f + wc -l (this file); ideas checked against capability list A–D
[3] PASS claims sourced in table above
[4] PASS engineering discussion only; no product code; no external send
```
