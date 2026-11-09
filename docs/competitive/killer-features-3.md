# Killer features: exactly three

**Card:** `Killer-feature discussion: 3 ideas users would murder for`  
**Seat:** oo-spec-1 (Head of Docs). Draft. Nothing leaves the team.  
**Fetched:** 2026-11-09 from `docs/competitive/_ideas-eng-killer.md` (Engineering) and `docs/competitive/_ideas-user-killer.md` (trader / Pine author). Recited against `docs/competitive/axis-capability-list.md` tables A–D.  
**Job:** one discussion, **exactly three** named ideas, honorable mentions we are not picking, explicit Skip of activity-bar studio revival.

AXIS today (working tree, not a Marketplace republish): chart chrome, inputs on the chart, strategy table + CSV + markers + equity, DAP type `axis-bar` (Bar + Series/`na` + `chart.debugCursor`), opt-in Pyodide Runtime envelope with `hoox_pyne-0.6.29` on disk, **zero** `contributes.views`. Sources: capability list A–D; both idea notes “already in the bag / do not recard.”

---

## Discussion

Engineering and the trader **agreed** that the switch is not “we also have a chart”: it is local `.pine` with **source uploaded = 0**, a debug loop that starts from a **trade** (not from `plotchar`), and **no activity-bar studio** (capability list B ADD none; both notes). They **agreed** the shipped loop is foundation, not the killer: flag-off Pyodide, Bar/Series DAP, and `*.axis.json` do not uninstall anyone until they complete a scene. The **strongest disagreement** is the third slot and the #1 uninstall vector. Engineering’s recommendation if the criterion is uninstall: *“(1) TV first-divergence (2) repaint/lookahead radar (3) offline TV-faithful run of real scripts”* (`_ideas-eng-killer.md` Recommendation). The trader’s suggested spread (explicitly *not* the pick): *“K1 + K2 + K3 (privacy/first plot, lying strategy, shareable git chart)”* (`_ideas-user-killer.md` How Docs picks / handoff). Engineering ranks **TV CSV first-divergence** as murder-worthy because “TV is the referee”; the trader never named a TV export — their first-plot scene is airplane-mode Run on the **local wheel**, and they treat a shipped debugger as **PyneIDE parity** unless it answers a fill without a paid compile. Docs kills Engineering #1 as a *named* killer this round: Engineering’s own two-week vs six-month table says a wrong fill model makes the divergence report “a liar — worse than nothing.” Docs also kills K3 as a killer: the custom editor on `*.axis.json` already exists (capability list A); finishing git round-trip is hygiene, not a switch. The three that survive both gates (switch vs TV **and** PyneIDE 0.14.1, lives in chart/DAP/language, foundation on disk, no upload happy path) are **Airplane-mode first plot**, **Click the lying trade**, and **Repaint / lookahead radar**.

---

## The 3 ideas

### 1. Airplane-mode first plot

| Field | Pick |
| --- | --- |
| **Name** | Airplane-mode first plot |
| **User scene** | Friday 22:40, seat 14A, no wifi. Legal said the ORB script does not leave the laptop. Paste a TradingView `strategy()` into `orb.pine`, sibling `orb.axis.json` opens, `Ctrl+Enter`. Candles, plots, trade markers. No account, no API key, no “5 compiles / day.” Source bytes uploaded: **zero**. The chart is a file when they land. (Trader K1.) |
| **Why murder-for** | TradingView Pine compiles on their servers; the author is a guest in a browser tab. PyneIDE: *“Pine Script files are compiled by the PyneSys cloud compiler”*; Seed **$8 / mo** (5/day) through Forest **$48**; each edit is a compile; first-run also pulls ~80 MB uv/CPython. A local wheel that actually paints `chart.full` uninstalls the **paid compile product**, which is PyneIDE’s business, not their VSIX. |
| **AXIS+PYNE fit** | **Language / Runtime** (PYNE wheel + interpret) + **chart chrome** (honest “Wasm still downloading” / `engine=pyodide uploaded=0` on the Run channel). **Not** a view. **Not** a DAP. Host already has opt-in Pyodide + trusted `hoox_pyne-0.6.29` + Runtime envelope (capability list C). Product change is the **default path**: pack install → open `.pine` → Run → picture. Unresolved `import` / `request.security` is Problems + Quick Pick, never a Libraries studio (Engineering idea 3 owner surface). |
| **2-week vs 6-month** | **2-week:** fixture strategy in `fixtures/` plots on a cold VSCodium with **no network after VSIX install**; Run output can say `engine=pyodide wheel=hoox_pyne-0.6.29 uploaded=0`; flag-off-by-default is the researcher default — trader done-when is the **happy path** (Chief must approve flipping `axis.engine.allowPyodide`; Wasm stays CDN per capability list C, so “radio off” is true only after first Wasm fetch **or** a documented offline cache — do not fake 100% JS Pine). **6-month:** Engineering idea 3 — workspace `import user/Lib/ver` + real `request.security` join. That is the “their actual published script” bar, not a 2-week claim. |
| **Source** | Trader K1 (`_ideas-user-killer.md`); Engineering idea 3 + table C cannot-do (`_ideas-eng-killer.md`; `axis-capability-list.md` C); PyneComp pricing `_research-pyneide-public.md` / pynesys.io/ide. |

### 2. Click the lying trade

| Field | Pick |
| --- | --- |
| **Name** | Click the lying trade |
| **User scene** | TV Strategy Tester printed +12%. They know Tuesday’s fill: they would have been stopped. In AXIS they click the green triangle in the **strategy table**. Chart jumps, debug cursor on that bar, VS Code Debug view shows **Bar** (OHLCV + time) and **Series** (plot columns, `na` is `na`). Step **back** one bar. The filter that should have blocked the entry is `na`. Fill is the bar **high** because they did not use `process_orders_on_close`. They are looking at the **trade**, not adding `plotchar(bar_index)`. (Trader K2.) |
| **Why murder-for** | TV official debugging is `plot` / `plotchar` / Pine Logs; docs never offer step-through. PyneIDE’s headline is that gap — but for `.pine` the DAP sits **behind cloud compile + quota**, and the marketed loop is editor BP → next bar, not “click this fill.” Whoever debugs the **trade row** on a **local** engine becomes the home IDE. |
| **AXIS+PYNE fit** | **Chart chrome** (existing strategy table is the debugger’s index) + **DAP** type `axis-bar` (already Bar/Series/`na`/stepBack/`chart.debugCursor`; commands `axis.debug.start` / `stepBar` / `toggleBarBreakpoint`). **Not** a view. **Not** DAP type `pyne`. Bidirectional: cursor moves, table highlights the open position. Must work on the **local wheel** (idea 1) so Grower compiles are not the cost of asking why one fill is wrong. |
| **2-week vs 6-month** | **2-week:** click strategy-table row → `chart.debugCursor` on that `bar_index` → Series shows the `na` filter → stepBack still matches the previous table row (trader K2 done-when). Uses shipped table + DAP; no new engine semantics. **6-month / do not claim in this pick:** Engineering idea 4 Vars + Broker + Security scopes + watch evaluator — needs a PYNE per-bar snapshot API; Engineering: *“Do not pick 4 without a Runtime snapshot API or it stays a reskin of table D.”* |
| **Source** | Trader K2 (`_ideas-user-killer.md`); Engineering idea 4 “enough to demo, not enough to leave PyneIDE” + constraint DAP stays `axis-bar` (`_ideas-eng-killer.md`); capability list A strategy chrome + D `axis-bar`; TV Pine debugging v5/v6 (trader TV-DBG). |

### 3. Repaint / lookahead radar

| Field | Pick |
| --- | --- |
| **Name** | Repaint / lookahead radar |
| **User scene** | A strategy looks perfect on the chart and dies live. After Run, every plot, shape, and trade marker that **could see the future relative to the bar it is drawn on** gets a hatch overlay and a gutter mark. Click the overlay: expression, lookahead mode, and a **confirmed-only** ghost series. Toggle “live-safe”: hide repainting plots. PYNE also warns as they type (`lookahead_on`, insecure `security`, `strategy.entry` without `barstate.isconfirmed`). They keep AXIS open even if they still **publish** on TV. (Engineering idea 2; trader theme “why is my strategy lying.”) |
| **Why murder-for** | TV *hides* this. PyneIDE Edge is import-time subset checking, not a chart-visible taint of plots vs fills. This is the feature that **saves real money**. Unique vs **both** competitors; trader gate “switch, not parity” passes. Complements idea 2 (the lying *fill*) with the lying *series*. |
| **AXIS+PYNE fit** | **Language** (PYNE static taint + diagnostics) + **chart chrome** (hatch overlay, ghost series, live-safe toggle on `axis.chart`). **Not** a view. Alerts chip stays count-only — not this. HTF join visualization (Engineering idea 5) is plumbing/visual proof once `request.security` exists; it is not a fourth killer and it is not a Data studio. |
| **2-week vs 6-month** | **2-week:** grep-level hatch on `lookahead_on` / obvious `security` arity + gutter + click-to-source (Engineering “sexy trap” table still forbids claiming dynamic taint). **6-month:** dynamic taint (not just grep) + confirmed-only ghost series (Engineering ~6 months). Do not ship a “radar” that only greps and call it money-safe. |
| **Source** | Engineering idea 2 + 6-month row (`_ideas-eng-killer.md`); capability list B (no new view); trader K2 theme and gate table (`_ideas-user-killer.md`). |

---

## Honorable mentions (not picked; max 5)

| # | Name | Why it is strong | Why it is not one of the 3 |
| --- | --- | --- | --- |
| 1 | **TV first-divergence** (Engineering idea 1) | Only AXIS can own chart+DAP vs a TV *List of Trades* CSV; attacks TV’s referee status. | Engineering: product-grade fill model (commission, slippage, bar magnifier, `process_orders_on_close`, pyramiding) is **~6 months**; a toy join is worse than nothing. Trader never named a TV export. Revisit after idea 1’s local engine is the default and fills are trusted. |
| 2 | **The chart is a git object** (trader K3) | PR review of `*.axis.json` vs TV snapshot URLs; PyneIDE chart is a panel, custom editor is `*.ohlcv`. | Foundation **already shipped** (`axis.chart` on `*.axis.json`, inputs persist). Completing “clone → open → same picture, no `globalStorage` required” is hygiene / 2-week, not uninstall bait. Trader’s own “already in the bag” table: do not re-sell chrome as new. |
| 3 | **Sealed “reproduce this” pack** (trader K7) | Export script hash + inputs + exact bars + trades.csv + wheel id; machine B offline matches fills. TV cannot re-run a snapshot. | Depends on ideas 1 and 2 (local engine + trusted trades). Engineering did not rank a zip as uninstall. Ship as a command on top of the three, later. |
| 4 | **Drop your own bars** (trader K5) | Desk CSV as the primary series; compliance points at git-lfs, not “whatever TV had.” | Engineering trap: OHLCV custom editor / download wizard **looks like the deleted Data studio**. Path is Pick Data + file on `*.axis.json` (capability list B Skip view). 2-week file choice, not a killer name. |
| 5 | **Replay the fill** (trader K4) | Hide future, play, same engine as the strategy table; TV Bar Replay ≠ Strategy Tester. | Capability list B already **Skip view** for Replay; overlay on `chart.debugCursor`. Overlaps idea 2. Engineering did not rank it as uninstall. Do it as chrome on the lying-trade loop, not a fourth idea and **not** a Replay studio. |

Not listed (still killed, not honorable): full click-bar Pine machine (Engineering 4) until PYNE commits snapshots; git-native libraries (Engineering 8) — plumbing for idea 1’s 6-month bar, not a slogan; re-eval from cursor (Engineering 7) — 6-month interpreter bet; chart↔source inspect (Engineering 6) — 2-week multiplier on idea 2, card under that pick if needed; HTF overlay (Engineering 5) — visual proof of `security()`, not a third killer.

---

## Explicit Skip: activity-bar studio revival

**None of the three earns a `contributes.views` row.**

| Temptation | Why it looks like a studio | Where it actually lives | Source |
| --- | --- | --- | --- |
| First-plot onboarding | Walkthrough / Get Started panel | Run channel banner + fixture files | Trader K1 “Not this”; Engineering trap “AI / walkthrough” |
| Libraries / imports | Scripts registry revival | Problems + Quick Pick “add this symbol”; folder convention later (Engineering 8) | Engineering idea 3 owner surface; capability list B Scripts **Skip** |
| Lying trade / replay | Replay studio, debugger studio | Strategy table chrome + native Debug view + `chart.debugCursor` | Capability list B Debugger **Skip view**, Replay **Skip view**; trader K2/K4 “Not this” |
| Repaint radar | Results / robustness tab | Hatch on the chart + PYNE diagnostics | Engineering idea 2 “No new view”; robustness/Monte Carlo is a **trap** (`_ideas-eng-killer.md` Debate) |
| Data for airplane-mode | Data / symbol-browser studio | `axis.pickData` + file path on JSON | Capability list B Data **Skip view**; trader K5 |

Capability list B remains **ADD none**. Deleted studios stay deleted: Workers, Plugins, Alerts, Watchlist, Scripts, Layers-as-studio. DAP type stays `axis-bar`, never `pyne`. Do not clone PyneIDE’s 72 commands or Pyne activity-bar (Scripts / Data / Output).

### Other traps killed this round (not the three)

From Engineering Debate table, still in force: robustness / Monte Carlo tab; uv-managed CPython + venv; clone DAP type `pyne`; OHLCV custom editor / download wizard; live broker / alerts manager / watchlist; AI that writes Pine; shipping Wasm in the VSIX / fake 100% JS Pine; KLineChart swap / TV-lookalike chrome as the headline; `chart.delta` as the headline (plumbing under later re-eval, not a killer). From trader “Not this”: paywall panel, upload “just this once,” social snapshot host, publishing to TV from AXIS, Replay Trading with a fake broker, gating minute replay behind a SKU, 72-command surface, telemetry / “Report a Problem” that attaches source.

---

## Pick at a glance

| # | Name | Horizon (honest) | Surface | From |
| --- | --- | --- | --- | --- |
| 1 | Airplane-mode first plot | 2-week fixture+default path; 6-month import+`security` | Runtime + chrome | Trader K1; Eng 3 as later bar |
| 2 | Click the lying trade | 2-week table→`axis-bar`; not Vars/Broker | Chrome + DAP | Trader K2; Eng 4 deferred |
| 3 | Repaint / lookahead radar | 2-week grep hatch; 6-month dynamic taint | Language + chrome | Eng 2 |

Engineering cards from **this file**, not from the graveyard in the two `_ideas-*` notes.

---

## Sources

| Id | What | Where |
| --- | --- | --- |
| R-ENG | Engineering ranked 8 + traps + 2-week/6-month + rec 1,2,3 | `docs/competitive/_ideas-eng-killer.md` |
| R-USER | Trader scenes K1–K7 + pick gates + suggested K1+K2+K3 | `docs/competitive/_ideas-user-killer.md` |
| R-CAP | AXIS shipped A–D; ADD none; DAP `axis-bar`; Pyodide 100% = envelope not Numba/R2 | `docs/competitive/axis-capability-list.md` |
| R-CMP | P2 robustness/uv skip; P1-6 local compile gap | `docs/competitive/pyneide-vs-axis.md` |
| R-PUB | PyneIDE cloud Pine + Seed $8 … Forest $48 | `docs/competitive/_research-pyneide-public.md`; pynesys.io/ide (via R-USER/R-ENG) |
| R-VSIX | PyneIDE DAP type `pyne`; activity-bar; `*.ohlcv` editor | `docs/competitive/_research-pyneide-vsix.md` (via both idea notes) |

---

## Checklist (this artifact)

```
[1] PASS docs/competitive/killer-features-3.md exists
[2] PASS test -f cwd repo root (command recorded on the board)
[3] PASS every claim sourced (R-ENG, R-USER, R-CAP, R-CMP, R-PUB)
[4] PASS docs only; idea notes were inputs; no product code
```
