# Plan: AXIS+PYNE from 78 → ≥95 (and 100)

**Fetched:** 2026-11-09 scored table (Checker PASS). Recited here because the comparison file may not be on the current branch.  
**Product:** working-tree `hoox-sh.axis-ide` + hard-dep `hoox-sh.pyne` (pack). Same rubric as `pine-vscode-extensions-comparison.md`.  
**Rule from the rubric:** *Do not award 100 if any compared cell is Partial or No.* ≥95 allows a few honest Partials. 100 does not.

PyneIDE 0.14.1 is **85**. Beating them is **≥86**. The user asked for **>95** or **100**.

---

## Current score (78)

| Bucket | Weight | AXIS now | Missing | Why (from the 2026-11-09 recit) |
| --- | ---: | ---: | ---: | --- |
| Language + LSP | 25 | **22** | 3 | PYNE is a separate VSIX; LSP not “in the AXIS install.” Semantic tokens / formatter not full. |
| Chart / run | 25 | **20** | 5 | Engine + plots + drawings + inputs + stop exist. Lost points: data pick vs PyneIDE symbol browser; Pyodide not the default run path; no live-safe / HTF chrome. |
| Debugger | 10 | **7** | 3 | DAP `axis-bar` exists but **replays the last run** (snapshot). Rubric: live Pine adapter or Partial. |
| Privacy / local-first | 15 | **11** | 4 | No source upload (full). Local runtime Partial because `allowPyodide` default **false**. PYNE `pynescript.pro.apiKey` in **settings**. Untrusted/virtual declared. |
| Distribution | 10 | **7** | 3 | AGPL + OVSX exist. Marketplace/OVSX **listing still studio-era 0.3.1**. Version/README mismatch. |
| Polish | 15 | **11** | 4 | 3 themes, Stop/`when`, Run output. Missing: walkthrough/templates (~3), hover scored before chip/table polish. |
| **Total** | **100** | **78** | **22** | |

**WT recit after Wave 1–2 (2026-11-09 implement):** Lang 25 / Chart 25 / Dbg 10 / Priv 15 / Dist 9 / Polish 15 = **99**. Dist −1 until D1 gallery README matches WT. Lookahead is static grep.

Headline reasons AXIS is not 100 (verbatim from the scored doc): *Pyodide default off, LSP not in the VSIX, debugger replays last run, PYNE stores apiKey in settings, public AXIS listing is stale.*

---

## What “100” actually requires

Every rubric cell **Yes**:

| Cell | Today | 100 requires |
| --- | --- | --- |
| Grammar / diagnostics / hover / completion / signature / go-to / rename | PYNE sister | Pack install → language **works with no extra hunt**. Bundle PYNE in `axis-pack` (already) **and** first-run must not leave hover dead if PYNE failed to install. |
| Semantic tokens | Partial/unknown | PYNE semantic tokens on. |
| Formatter | Partial/unknown | `Format Document` for `pinescript` (local, no TV API). |
| Convert v5→v6 | PYNE local | Keep; do not upload. |
| Chart engine + all plot kinds + drawings + strategy + inputs + stop | Yes | Keep. Do not swap to KLineChart for points. |
| Data pick | Quick Pick | Catalog of symbols/TFs **in Quick Pick** (files + mock + datafeed). **No** Data studio. |
| Local runtime | Opt-in Pyodide | Default path = local wheel; Pro `/run` remains optional. Wasm cache so airplane-mode works **after first fetch** (or vendor a documented cache command — **not** multi-MB Wasm in the VSIX unless Chief says so). |
| Debugger | Snapshot DAP | **Live** bar-step on the engine that produced the trades (Pyodide or `/run` stream), plus chart-bar + line breakpoints. Click strategy-table row → that bar (killer #2). |
| Secrets | AXIS SecretStorage; PYNE settings key | **Zero** API keys in `settings.json`. PYNE uses SecretStorage or AXIS’s vault. |
| Listing | Stale studios | Republish so Marketplace + Open VSX README = lightweight WT. |
| Untrusted / virtual | `supported: false` | Keep honest. |
| Themes / hover / stop / when | 3 themes + recent hover polish | Keep. |
| Walkthrough / templates | Missing | Fixture `.pine` + `*.axis.json` + Get Started walkthrough. |
| Numba / R2 / cron / live WS | Out of scope | **Do not fake.** Rubric does not score those. 100 on *this* rubric is still possible. |

100 is **possible** on the published rubric. It is **not** “Pyodide does Numba.” It is “no Partial on the scored cells.”

---

## Path A — ≥95 (need **+17** or more)

Ship in this order. Each row is a card Engineering can cut. Points are the **maximum** the rubric can give if the done-when is met (do not double-count).

### Wave 0 — listing truth (Dist **+2..3** → Dist 9–10)

| ID | Work | Done-when | Points |
| --- | --- | --- | ---: |
| D1 | Marketplace + Open VSX republish of lightweight AXIS (and pack). README = WT commands, **no studios**. | Live gallery version + README match `package.json`. Chief approve publish. | +2 to +3 |

Without D1 the score **cannot** honestly pass ~93: the rubric punishes listing lag.

### Wave 1 — close the five headline deductions (**+12..14**)

| ID | Work | Maps to | Done-when | Points |
| --- | --- | --- | ---: | ---: |
| P1 | **Airplane-mode first plot.** Flip `axis.engine.allowPyodide` default **true** (Chief). First Run uses local wheel; banner `engine=pyodide uploaded=0`. Cache Wasm in `globalStorage` after first fetch. Unresolved `import`/`security` → Problems, not a studio. | Privacy local-runtime + Chart default path + killer #1 | Cold VSCodium, no `pyn_` key, fixture strategy paints `chart.full`. | +2 Priv, +1 Chart |
| P2 | **PYNE secrets out of settings.** Move `pynescript.pro.apiKey` to SecretStorage (or AXIS vault). Settings hold **no** secrets. | Privacy secrets 0→3 | `rg apiKey` in PYNE `contributes.configuration` gone; SecretStorage only. | +3 Priv |
| P3 | **Language in the install.** Pack already depends on PYNE. Add AXIS activation check: if `hoox-sh.pyne` missing, modal “Install PYNE” + disable Run. Optionally **bundle** a thin client that talks to the same LS. | Lang “LSP not in VSIX” | Fresh pack install → hover on `ta.sma` without a second marketplace hunt. | +2 Lang |
| P4 | **Live `axis-bar` adapter** (not last-run snapshot) + **click the lying trade.** Strategy table row → `chart.debugCursor` + Debug view Bar/Series/`na`. Step back. | Debugger 7→10 + killer #2 | Unit + one fixture: click fill → bar_index matches trade. | +3 Dbg |
| P5 | **Walkthrough + fixture.** `contributes.walkthroughs` + `fixtures/orb.pine` + `orb.axis.json`. | Polish templates 0→3 | Get Started → open fixture → Run. | +3 Polish |

**Wave 0+1 math:** 78 + 3 + 2 + 3 + 2 + 3 + 3 = **94**. One more point from hover recit (already polished) or data-pick files = **95**.

### Wave 2 — the last points to **≥95 and toward 100** (**+6..8**)

| ID | Work | Maps to | Done-when | Points |
| --- | --- | --- | ---: | ---: |
| P6 | PYNE **semantic tokens** + **Format Document** (local). | Lang 22→25 | Tokens on `series`/`simple`; formatter command on `pinescript`. | +3 Lang |
| P7 | Data Quick Pick: **file CSV / workspace bars** as a first-class source (no OHLCV editor studio). | Chart data pick  Partial→Yes | `*.axis.json` can point at a csv path; Pick Data lists it. | +2 Chart |
| P8 | **Repaint / lookahead radar** (killer #3). 2-week: hatch + gutter on `lookahead_on` / obvious `security`. 6-month: dynamic taint + confirmed-only ghost. Do **not** call grep “money-safe.” | Chart leftover + Polish + unique vs PyneIDE | Hatch overlay + PYNE diagnostic; live-safe toggle hides tainted plots. | +2 Chart (after real taint) |
| P9 | Hover recit in the next score (chips + param tables already in pynescript + 3 themes). | Polish hover | Re-score hover as Yes. | +1 Polish |

**Wave 2 on top of 94:** 94 + 3 + 2 + 1 = **100** if P8’s chart points land and **no cell stays Partial**.

If P8 stays grep-only, cap Chart at 24 and total at **98–99**. That is still **>95**.

---

## Path B — honest 100

Do Path A **and**:

1. **D1** published (listing = WT).  
2. **P1** default local engine, Wasm cached (airplane-mode after first fetch is documented; do not claim radio-off on a blank `globalStorage`).  
3. **P2** zero plaintext keys.  
4. **P3** pack install = language.  
5. **P4** live DAP + click-fill.  
6. **P5** walkthrough.  
7. **P6** tokens + formatter.  
8. **P7** file bars in Pick Data.  
9. **P8** dynamic taint (not grep) **or** leave radar as Exceed and take Chart 24 → total **98**.  
10. Re-run the **same rubric** on disk (Checker), not README.

**Do not** restore Workers / Plugins / Alerts / Watchlist / Scripts / Layers studios. They score **0** on this rubric and fight the simplify card.

**Do not** clone DAP type `pyne`, KLineChart, uv bootstrap, or PyneComp.

---

## Ordered board (cut these cards)

| Seq | Card | Owner | Blocks 95? | Blocks 100? |
| ---: | --- | --- | --- | --- |
| 1 | D1 republish lightweight listing | Chief + Eng | Yes | Yes |
| 2 | P2 PYNE SecretStorage | PYNE (`pyne-lsp-vsce`) | Yes | Yes |
| 3 | P3 pack install language guarantee | AXIS + PYNE | Yes | Yes |
| 4 | P1 Pyodide default on + cache + fixture run | AXIS (Chief on default) | Yes | Yes |
| 5 | P5 walkthrough + fixtures | AXIS | Yes | Yes |
| 6 | P4 live DAP + click lying trade | AXIS | Yes | Yes |
| 7 | P6 semantic tokens + formatter | PYNE | For 100 | Yes |
| 8 | P7 CSV/file bars in Pick Data | AXIS | For 96+ | Yes |
| 9 | P8 repaint radar (static then dynamic) | PYNE + AXIS | No (Exceed) | If Chart must be 25 |
| 10 | Re-score vs rubric (Docs + Checker) | Docs | Proof | Proof |

Parallel: 2+3+5; 1 whenever Chief says publish; 4 after wheel path is the happy path; 6 after 4’s engine is default so debug is local.

---

## Target scores (forecast, not a promise)

| After | Forecast | vs PyneIDE 85 |
| --- | ---: | --- |
| Today | 78 | −7 |
| Wave 0 (D1 only) | 80–81 | still behind |
| Wave 0+1 | **94–96** | **ahead** |
| Wave 2 (P6–P7, hover recit) | **97–99** | ahead |
| Wave 2 + dynamic radar + zero Partials | **100** | ahead |

The first time AXIS is *meaningfully* better than PyneIDE on this rubric is **end of Wave 1**, not 100.

---

## Explicit out of scope (do not spend points here)

- Activity-bar studios  
- Monte Carlo / robustness tab  
- TradingView lint HTTP  
- Numba in Pyodide  
- Wasm inside the VSIX (unless Chief trades size for airplane-mode-before-first-fetch)  
- DAP type `pyne`  
- Flipping `untrustedWorkspaces` to true (would *lose* honesty points)

---

## Proof of this plan

Re-score with the published rubric after each wave. Done for ≥95: new table row **AXIS+PYNE ≥ 95** with the same weights, every Partial named. Done for 100: **zero** Partial/No on scored cells.
