# Pro backend vs AXIS IDE — `/run` envelope and route gap

**Fetched:** 2026-11-09 at write time from this checkout (not memory, not the prior draft).  
**AXIS today:** working-tree lightweight core (`src/` + `package.json`). Chart custom editor + `POST /run` + secrets. No studios, no live, no MCP.  
**Do not restore** Workers / Plugins / Alerts / Watchlist / Scripts / Layers **studios**. Chart-webview UI is allowed. Aligns with `docs/competitive/pyneide-vs-axis.md` P0 list.

Two hosts speak the same evaluate contract. They are **not** the same HTTP surface:

| Host | Role | Default | Source |
| --- | --- | --- | --- |
| Flask **Pro API** (`pynescript` `backend/`) | Local / SaaS evaluate. Default AXIS endpoint `http://127.0.0.1:5002` | `POST /run` **free** (no key). Unknown body fields → `UNKNOWN_FIELDS` 400 | `pynescript/backend/middleware/schemas.py` `RUN_SCHEMA`; `hoox-landing-page/content/pyne-docs/api/endpoints/run.mdx` |
| **pyne-worker** 0.10.0 | Cloudflare Python edge wrap of the same `pynescript.runtime.Runtime` | Auth `X-API-Key` (or tenant `Authorization: Bearer hx_live_…`). Extra edge fields (`ohlcv`, `script_id`, `realtime_*`, R2 load) | `../pyne-worker/README.md`; `../pyne-worker/src/handler.py` |

AXIS posts only REST `POST {endpoint}/run`. Default endpoint is Flask loopback (`src/run/engine-http.ts` `DEFAULT_ENGINE_ENDPOINT`). Worker keys (`pn_…`) are accepted on the same adapter but the Worker’s primary header is `X-API-Key`, not `Authorization`.

**Legend — split Host vs Paint.** A field copied onto `EngineRunResult` / `chart.full` is **not Unused**. Paint may still be Partial.

| Tag | Meaning |
| --- | --- |
| **Used** | AXIS **host** sends it, or a user-visible chart/run path **reads** it. Paint **Used** only when LWC/SVG/HTML/output actually consumes it |
| **Partial** | Host: parsed or forwarded with a hole (omitted when empty, not on `chart.full`, not dumped). Paint: some kinds/attrs consumed; remaining hole is named in the row |
| **Unused** | Pro/worker accepts or returns it; AXIS **never sends** and **never copies** onto `EngineRunResult` / `chart.full` (except maybe stashed on `raw`) |
| **P0** | Wire into chart + run only — matches `pyneide-vs-axis.md` P0 |
| **P1** | Chart + run, after P0 — matches comparison P1-1 (script drawings) |
| **Later** | Useful, not simplify-blocked, not P0 |
| **Skip** | Alerts / cron / live / hosted scripts — conflicts with simplify |

---

## How AXIS talks to `/run` today

Recited from disk at write time: `src/run/engine-http.ts`, `src/run/run-envelope.ts`, `src/run/orchestrator.ts`, `webview/chart/src/paint.ts`, `webview/chart/src/drawings.ts`, `webview/chart/src/main.ts`, `webview/chart/src/state.ts`.

### Request (host send)

`postEngineRun` always JSON-posts **four keys**, plus **`inputs` when non-empty** (`engine-http.ts` `postEngineRun` body):

```json
{ "script": "…", "data": [/* pine-ms OHLCV */], "mode": "auto", "symbol": "CHART", "inputs": { "Length": 14 } }
```

`inputs` is omitted when missing or `{}`. `RunOrchestrator.run` forwards `req.inputs` into `postEngineRun`. `extension.ts` `runScriptCore` supplies `opts.inputs ?? ctx.inputs`; `run-context.ts` `withDocInputs` lifts non-empty `scripts[].inputs`. `chart.applyInputs` persists then re-runs with overrides (`chart-editor.ts` `onApplyInputs`).

Headers: `Content-Type: application/json`, `X-AXIS-Client: ide`, optional `Authorization: Bearer <pyn_ or pn_>`. No `X-API-Key`. Timeout 30s client-side (`ENGINE_RUN_TIMEOUT_MS`). **Not posted:** `timeframe`, `from_bar` / `to_bar`, worker-only keys.

### Host consume (`EngineRunResult` + `chart.full`)

`mapEngineResponse` still maps `plots` / `series` (`coerceSeriesMap` drops `_`-prefixed keys) / `events` / optional `drawings` / capped `logs` / `profile`, then **`attachRunEnvelope`** copies onto `EngineRunResult`: `plotMeta`, `inputs`, `alerts`, `times`, `window`, `errorKind`, `scriptType`, `scriptName`, `overlay`, `strategy` (`extractStrategy` from `events` + equity columns). Source: `engine-http.ts` `mapEngineResponse` → `attachRunEnvelope`; `run-envelope.ts`.

On success `RunOrchestrator` publishes **`chart.full` via `chartFullFromRunResult(result, req.bars, nextSeq)`** (`orchestrator.ts`). Wire extras when present (`protocol/types.ts` `ChartFullPayload`): `drawings`, `plotMeta`, `inputs`, `alerts`, `times`, `window`, `strategy`, `scriptType`. **Not** put on `chart.full`: `events` (folded into `strategy`), `overlay`, `scriptName`, `errorKind`, `logs`. On engine error the output line includes `kind=${result.errorKind}` when set. `result.logs` is **not** appended to the Run output channel (only `run start` / `run ok` / `run error`).

`chart.delta` exists on the protocol and bus; the run path never emits it.

### Paint / webview (this checkout)

`webview/chart/src/state.ts` reads `plotMeta` / `times` / `strategy` / `inputs` / `window` / `alerts` / engine `drawings` on `chart.full` (`applyChartHostMessage`, `normalizePlotLines`, `plotPoints`, `normalizeStrategy`, `normalizeEngineDrawings`). Does **not** read `scriptType` / `overlay`.

`webview/chart/src/paint.ts` `apply()` paints candles + `applyPlotOverlays` kinds **line / step / histogram / area / hline / bgcolor**, `applyBarColors` (`barcolor`), `strategyMarkersFromTrades`, `shapeMarkersFromPlots` (`plotshape` / `plotchar` / `plotarrow`), and zips overlays with **`state.times`** via `plotPoints` (index zip only when `times` absent). Equity may be pushed as a `__equity` line. `data-axis-engine-drawings` / `data-axis-strategy-trades` / `data-axis-plot-kinds` are attributes.

`webview/chart/src/main.ts` `redrawOverlay()` calls `overlay.redraw(state.drawings, placer.getDraft(), state.engineDrawings)`. `drawings.ts` `paintEngineDrawing` SVG-paints **line / polyline / box / label / linefill**; `type === 'table'` is skipped in SVG and rendered as HTML in `main.ts` `renderEngineTables`. User `tool` batches still guarded (`isUserDrawingBatch`).

Inputs: `renderInputs` builds a form from `state.inputs`; Apply posts `chart.applyInputs`; host `chart-editor.ts` `onApplyInputs` persists `scripts[].inputs` then `extension.ts` re-runs. Strategy: `renderStrategy` table + stats + `copyCsv`; markers + equity already in paint. Window/alerts: `renderWindowChip` / `renderAlertsChip` (count only). Capabilities advertised: `plot-kinds`, `strategy`, `inputs`.

**Still not painted from `plot_meta`:** `fill`, `plotbar`, `plotcandle`, `linestyle`, `offset`, `show_last` (`resolvePlotPaintKind` / `finishPlot` never copy those; hline stroke is always `LineStyle.Dashed`). **Still not dumped:** engine `logs` (host caps them; orchestrator never `appendLine`s them). **Still unused on POST:** `timeframe`, `from_bar` / `to_bar`.

---

## `POST /run` request fields

Union of Flask `RUN_SCHEMA` and pyne-worker `handle_run`. **W** = worker, **F** = Flask Pro. Sending a **W-only** field to Flask is a 400 (`UNKNOWN_FIELDS`). Sending a **F-only** field to the worker is usually ignored.

AXIS send is host-only (paint does not POST).

| Field | Host | Pro | AXIS sends | Status | Priority | Source |
| --- | --- | --- | --- | --- | --- | --- |
| `script` | F+W | Pine source. Flask required. Worker: or `script_id` | Yes | **Used** | — | `engine-http.ts` `postEngineRun` body; `handler.py` ~752; `RUN_SCHEMA` |
| `data` | F+W | OHLCV list. Flask required. Worker alias of `ohlcv` | Yes (`barsForPine`, unix-s → ms) | **Used** | — | `engine-http.ts` `barsForPine`; `handler.py` `_normalize_ohlcv` |
| `ohlcv` | W | Same as `data` | No (sends `data`) | Unused (compat; do not add a second key) | — | `handler.py` `_normalize_ohlcv`; Flask **rejects** this name |
| `mode` | F+W | `interpret` \| `compile` \| `auto`. Flask default **auto**. Worker default **interpret** if omitted | Yes, always `auto` from run command | **Used** | — | `extension.ts` `runScriptCore` mode `'auto'`; `handler.py` `_VALID_MODES` |
| `symbol` | F+W | Flask default `"CHART"`. Worker default `"BTCUSDT"` if omitted | Yes (`seriesKey` part or `'CHART'`) | **Used** | — | `orchestrator.ts` `symbolFromSeriesKey`; `RUN_SCHEMA` |
| `inputs` | F+W | `input.*` overrides by title; worker forces interpret under `auto` | **Yes when non-empty**; omitted if missing/`{}`. From `scripts[].inputs` or `chart.applyInputs` | **Used** (optional fifth key; form + persist shipped) | — (P0-6) | `engine-http.ts` `if (req.inputs && Object.keys(req.inputs).length > 0)`; `orchestrator.ts` `inputs: req.inputs`; `run-context.ts` `withDocInputs`; `main.ts` `postApplyInputs`; `chart-editor.ts` `onApplyInputs`; `RUN_SCHEMA`; `handler.py` ~887 |
| `timeframe` | W | Sanitized TF; mapped to Pine `timeframe.period` via `to_pine_period`. Inline bars still need it for `timeframe.*` | No. Chart `doc.interval` is used only for **datafeed** fetch | **Unused** | **P0** | `handler.py` ~801–950; `run-context.ts` history `timeframe: doc.interval`; `security.py` `to_pine_period` |
| `libraries` | F+W | `[{namespace,name,version,source}]` max 32; interpret/`auto` only | No | **Unused** | **Later** | `RUN_SCHEMA`; `handler.py` `normalize_libraries`; README libraries |
| `profiler` | F+W | Per-line interpret timings | No | **Unused** | **Later** (comparison P2-2) | `RUN_SCHEMA`; `handler.py` `profiler = bool(...)` |
| `timeout_seconds` | F+W | Flask: omit = no budget. Worker: default 30, max 30 | No (client uses fetch abort 30s instead) | **Unused** | **Later** | `RUN_SCHEMA`; `handler.py` ~914–923; `ENGINE_RUN_TIMEOUT_MS` |
| `from_bar` / `to_bar` | F+W | Inclusive envelope window; negative from end; engine still evaluates all bars; adds `window` | No | **Unused** | **P0** (P0-9 / visible range) | `RUN_SCHEMA`; `handler.py` ~928; `window.py` |
| `script_id` | W | Load deployed R2 script instead of `script` | No | **Unused** | **Skip** (hosted Scripts) | `handler.py` ~753–778; README |
| `max_bars` | W | Tail when loading R2 history | No | **Unused** | **Skip** (R2 path) | `handler.py` ~872 |
| `realtime_last_bar` | W | Last bar forming (`barstate.isrealtime`) | No | **Unused** | **Skip** (live/forming) | `handler.py` ~934; README realtime |
| `realtime_ticks` | W | Re-visits per bar in realtime window (default 1) | No | **Unused** | **Skip** | `handler.py` ~937 |
| `realtime_bars` / `realtime_from_bar` | W | Realtime window extent | No | **Unused** | **Skip** | `handler.py` ~940–945 |
| `webhook_url` | F+W | L2 HTTPS public host; blocked → 400 `WEBHOOK_URL_BLOCKED` | No | **Unused** | **Skip** | `RUN_SCHEMA`; `handler.py` ~902; `entry.py` |
| `forward_alerts` | F+W | Default true | No | **Unused** | **Skip** | `RUN_SCHEMA`; `entry.py` ~183 |
| `alert_last_bar` | F+W | Default true | No | **Unused** | **Skip** | `RUN_SCHEMA`; `entry.py` ~184 |
| `alert_batch` | F+W | Default true | No | **Unused** | **Skip** | `RUN_SCHEMA`; `entry.py` ~185 |
| `forward_events` | W | Default true; trade-worker forward | No | **Unused** | **Skip** | `entry.py` ~182 |
| `exchange` | W | Exchange stamp on trade payloads | No | **Unused** | **Skip** | `entry.py` ~191 |
| `data_source` / `data_options` | F | `mock` / `ccxt` / `yahoo` / … + provider opts | No (IDE uses HistoryClient or mock bars) | **Unused** | **Later** | `RUN_SCHEMA` |
| Query `?mode=` | F | When body omits `mode` | No | **Unused** | — | `run.mdx` |

**Auth (not a body field, still a gap)**

| Header | Pro | AXIS | Status | Priority |
| --- | --- | --- | --- | --- |
| `Authorization: Bearer pyn_…` | Flask Pro usage on paid routes; `/run` itself is free | Sent when Pro key present | **Used** (Flask) | P0-2 already: keyless loopback is implemented for REST |
| `Authorization: Bearer pn_…` / `hx_live_…` | Worker tenant Bearer when `CONSOLE_URL` set | Worker key sent as Bearer | **Partial** | **Later** — Worker README requires `X-API-Key` for self-host |
| `X-API-Key` | Worker required in production | Never sent | **Unused** | **Later** (self-hosted CF) |
| `X-AXIS-Client: ide` | Worker open-beta / CORS client id | Always | **Used** | — |

---

## `POST /run` response fields

Engine envelope from `pynescript.runtime.host.Runtime.run` / session `result()`, then worker `handle_run` copies a subset onto HTTP (`handler.py` ~991–1045). Failure body: `status`/`error`/`message` plus `error_kind` (`parse|compile|runtime|data|order|mode`), optional `error_type` / `error_bar` / `error_bar_time` / `timed_out` / `logs` / `profile` / `meta` (`handler.py` `_run_error_body`; `host.py` `_error_payload`).

AXIS `mapEngineResponse` reads a **loose** JSON object, then `attachRunEnvelope`. Anything **not** listed on `EngineRunResult` is only reachable via `raw` (orchestrator never reads `raw`).

**Host vs paint:** Host tags below are for `EngineRunResult` + `chart.full` + run output. They are **Used or Partial, not Unused**, for every field `attachRunEnvelope` / `chartFullFromRunResult` copies. Paint tags are the webview LWC/SVG/UI remainder.

| Field | Pro returns | AXIS host | AXIS paint | Host | Paint | Priority | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `status` | `"success"` or `"error"` (also Flask `"ok"` / `"failed"`) | Maps to `EngineRunResult.status`; HTTP !ok forced to error | n/a | **Used** | — | — | `handler.py` 993; `engine-http.ts` `mapEngineResponse` |
| `plots` | Primary series: first numeric column (list). Interpret/compile | Copied onto result + `chart.full` | `normalizePlotLines` + `applyPlotOverlays` by `plot_meta.kind`/`style` (line/step/histogram/area/hline/bgcolor) | **Used** | **Partial** | **P0** (P0-4 remainder: fill/plotbar/plotcandle) | `host.py` ~3057 / 4682; `state.ts` `normalizePlotLines`; `paint.ts` `applyPlotOverlays` |
| `series` | Named map title → per-bar values (incl. fill edges, plotcandle OHLC components) | `coerceSeriesMap` drops `_`-prefixed keys; forwarded on `chart.full`. `extractStrategy` still reads raw `__equity` | Flattened with plots; kinds from `plotMeta` | **Used** | **Partial** | **P0** (P0-4 remainder) | `host.py` `_pack_interpret_plot_columns`; `engine-http.ts` `coerceSeriesMap`; `run-envelope.ts` `extractStrategy` |
| `plot_meta` | Per-title `{title,color,linewidth,index,kind,style?,linestyle?,location?,text?,char?,size?,plot1?,plot2?,price?,display?,offset?,show_last?,histbase?,…}` kinds: `plot`, `hline`, `bgcolor`, `barcolor`, `fill`, `plotshape`, `plotchar`, `plotarrow`, `plotbar`, `plotcandle` | `attachRunEnvelope` → `result.plotMeta`; `chartFullFromRunResult` → `chart.full.plotMeta` | `resolvePlotPaintKind` maps plot/hline/bgcolor/barcolor/shape + style histogram/step/area. **Not painted:** fill, plotbar, plotcandle, linestyle, offset, show_last (`finishPlot` does not copy those attrs; hline is always Dashed) | **Used** | **Partial** | **P0** (P0-4 remainder) | `host.py` 722–796, `_PACK_READY_KINDS`; `handler.py` 1014; `run-envelope.ts` `coercePlotMeta`; `state.ts` `resolvePlotPaintKind` / `finishPlot`; `paint.ts` `applyPlotOverlays` |
| `drawings` | Registry export: `{type: line\|box\|label\|table\|polyline\|linefill, t1,p1,…}` — **no `tool`** | Forwarded on `chart.full` | User `tool` batches still guarded. Engine batch → `engineDrawings`. `main.ts` `redrawOverlay(..., state.engineDrawings)`. SVG: line/polyline/box/label/linefill. HTML: table (`renderEngineTables`). Line `style`/`extend` and box text extras not fully honoured | **Used** | **Used** (six types; extras Partial) | **P1** remainder: style/extend/text | `drawing.py` `export_for_api`; `orchestrator.ts` `chartFullFromRunResult`; `state.ts` `isUserDrawingBatch` / `normalizeEngineDrawings`; `drawings.ts` `paintEngineDrawing`; `main.ts` `redrawOverlay` / `renderEngineTables` |
| `inputs` | List of `input.*` declarations (title, type, defval, …). Also `meta.inputs` | Copied to `result.inputs` + `chart.full.inputs` | `normalizeInputs` → `renderInputs` form; Apply posts `chart.applyInputs`; host persists + re-runs | **Used** | **Used** | — (P0-6) | `host.py` 3022–3063; `handler.py` 1022; `run-envelope.ts` `coerceInputs`; `state.ts` `normalizeInputs`; `main.ts` `renderInputs` / `postApplyInputs`; `chart-editor.ts` `onApplyInputs`; `extension.ts` `onApplyInputs` |
| `alerts` | `alert()` / `alertcondition()` firings (interpret; often empty on compile) | Copied to `result.alerts` + `chart.full.alerts` | Count chip only (`renderAlertsChip`); no Alerts studio | **Partial** | **Partial** | **Skip** UI | `host.py` 3062; `handler.py` 1018; `run-envelope.ts`; `state.ts` `alertsCount`; `main.ts` `renderAlertsChip`; simplify Alerts studio gone |
| `alert_conditions` | Full condition evals when present | Not mapped | n/a | **Unused** | — | **Skip** | `handler.py` 1020 |
| `alert_forward` | Webhook delivery summary | Not mapped | n/a | **Unused** | — | **Skip** | `entry.py` ~246; `run.mdx` |
| `events` | Strategy broker events (`to_dict()` + `script_id`/`run_id`). **No separate `trades` array** | Mapped to `result.events`; `extractStrategy` builds `result.strategy`; **not** a `chart.full` key | Consumed as `strategy` (markers, equity, table, CSV) | **Used** (via `strategy`) | **Used** | — (P0-5) | `host.py` 3059–3060; `engine-http.ts` events copy; `run-envelope.ts` `extractStrategy`; `paint.ts` `strategyMarkersFromTrades`; `main.ts` `renderStrategy` |
| `strategy` | Not a Pro top-level key. AXIS **derives** `{trades, equity?, stats}` from `events` + series equity | `result.strategy` + `chart.full.strategy`. Host `strategyTradesCsv` also exists | Markers + `__equity` overlay + chart chrome table/stats + CSV copy | **Used** | **Used** | — (P0-5) | `run-envelope.ts` `extractStrategy` / `strategyTradesCsv`; `paint.ts` apply() equity push; `main.ts` `renderStrategy` / `copyCsv` |
| `logs` | Engine log lines (`logs` or `log`) | Capped 200 lines / 2000 chars onto `result.logs`. Orchestrator **does not** append them (only start/ok/error) | n/a | **Partial** | — | **P0** (P0-11 remainder) | `engine-http.ts` `coerceLogs`; `orchestrator.ts` `safeLog` |
| `times` | Bar-time axis (ms) of the evaluated window — join-by-time, not index | Coerced to unix-s on `result.times` + `chart.full.times` | `plotPoints(bars, values, times)` then `toUtcPoints`; index zip **only if times absent** | **Used** | **Used** | **P0** (alignment; remainder = engine window gaps vs request bars) | `host.py` 3073–3077; `handler.py` 1044; `run-envelope.ts` `coerceTimes`; `state.ts` `plotPoints`; `paint.ts` `applyPlotOverlays(..., state.times)` |
| `window` | `{from_bar,to_bar,bars,total_bars}` when request windowed | `result.window` + `chart.full.window` (camelCase) | Chip (`renderWindowChip`). Paint does **not** trim LWC visible range from it. Request still never posts `from_bar`/`to_bar` | **Used** | **Used** (chip; range-trim remainder) | **P0** with request window | `window.py` `WINDOW_META_KEY`; `handler.py` 1042; `run-envelope.ts` `coerceWindow`; `state.ts` `normalizeWindow`; `main.ts` `renderWindowChip` |
| `error` / `message` | Sanitized failure string (worker 0.6.30 parity) | Used as `result.error`; diagnostics fallback | n/a | **Used** | — | — | `_run_error_body`; `mapEngineResponse` |
| `error_kind` | `parse` \| `compile` \| `runtime` \| `data` \| `order` \| `mode` | `result.errorKind`; logged `kind=` on run error line. Not on `chart.full` | n/a | **Used** | — | **P0** (Problems vs output; logs still Partial) | `host.py` 235–240; `_run_error_body`; `run-envelope.ts` `errorKind`; `orchestrator.ts` error `safeLog` |
| `error_type` / `error_bar` / `error_bar_time` / `timed_out` | Optional failure coords | Not mapped | n/a | **Unused** | — | **Later** | `_run_error_body` |
| `meta` | `{overlay, script_name, script_type, inputs, drawing limits, profile?}` | Nested `profile` lifted into `result.meta.profile`. Overlay/name/type also copied as top-level envelope fields (see those rows) | n/a | **Partial** | — | **P0** (`script_type`/`overlay` remainder) | `host.py` 3048–3071; `engine-http.ts` `readProfile`; `run-envelope.ts` |
| `count` / `bars` | Bar count (worker sends both; `bars` is a **count**, not a vector) | Unused (chart uses request bars) | n/a | **Unused** | — | **Later** (sanity vs `times.length`) | `handler.py` 991–997; `window.py` comment |
| `script_id` / `run_id` | `sha256(source)[:16]` / runtime id | Unused (`orchestrator` invents `run-${epoch}`) | n/a | **Unused** | — | **Later** | `handler.py` 998–999 |
| `mode` / `auto_backend` / `compile_fallback_reason` | Effective backend | Unused | n/a | **Unused** | — | **Later** | `handler.py` 1000–1009 |
| `object_mode` / `compile_cached` / `compile_ms` / `nopython_fallback_reason` | Compile diagnostics | Unused | n/a | **Unused** | — | **Later** | `handler.py` 1010–1031; `host.py` compile `out` |
| `overlay` | Declaration field (also inside `meta`) | `result.overlay` boolean. **Not** copied onto `chart.full` | Ignored (no pane vs overlay from this flag) | **Partial** | **Partial** | **Later** (pane split) | `handler.py` 1032–1037; `run-envelope.ts` `attachRunEnvelope`; `chartFullFromRunResult` (no `overlay`); `state.ts` `chart.full` branch |
| `script_name` | Declaration field | `result.scriptName`. **Not** on `chart.full` | Ignored | **Partial** | **Partial** | **Later** | `handler.py` 1032–1037; `run-envelope.ts` |
| `script_type` | Declaration field | `result.scriptType` + `chart.full.scriptType` | `applyChartHostMessage` does **not** read `scriptType` (strategy chrome keys off `strategy` payload) | **Used** | **Partial** | **Later** | `handler.py` 1032–1037; `run-envelope.ts` `chartFullFromRunResult`; `state.ts` `chart.full` branch |
| `profile` | `{total_ms, bars, mode, parse_ms, eval_ms, lines?}` | Lifted to `meta.profile` if plain object; never painted | n/a | **Partial** | — | **Later** (P2-2) | `handler.py` 1040; `engine-http.ts` `readProfile` |
| `session_bars` | Evaluated bar count on session envelope | Unused | n/a | **Unused** | — | **Skip** (sessions) | `host.py` 3071 |
| `code` | Flask schema/auth codes (`UNAUTHORIZED`, …) | Mapped on error | n/a | **Used** (HTTP errors) | — | — | `engine-http.ts` `mapEngineResponse` |
| `errors` / `diagnostics` / `compile_errors` | Occasional arrays | `coerceDiagnostics`. Lightweight `extension.ts` diagnostics.set is a no-op; errors still logged | n/a | **Partial** | — | **Later** (worker usually uses `error` string) | `engine-http.ts` `coerceDiagnostics`; `extension.ts` diagnostics stripped |
| `raw` | — | Full JSON kept on result | n/a | **Partial** (debug only; not a product surface) | — | — | `mapEngineResponse` |

Worker-only extras on success: `deployed_script_id`, `symbol`, `timeframe`, `forwarded` / `forward_errors` (trade-worker). **Skip.**

---

## Other Pro / worker routes AXIS ignores

AXIS working-tree `src/` has **no** client for these paths (grep `src/` for `/health`, `/ws/`, `/cron`, `/ingest`, `/scripts`, `/feed`: no engine calls). History uses `GET {datafeed}/datafeed/ohlcv` (`src/host/history-client.ts`), not worker `/ingest`.

| Route | Host | What it is | AXIS | Priority |
| --- | --- | --- | --- | --- |
| `GET /health` | F+W | Feature flags (`websocket`, `live_stream`, worker `features.*`) | Unused. No capability probe; REST `/run` only | **Later** (optional; not required for P0 REST) |
| `WS /ws/run` | F (`flask-sock`) | Same evaluate contract as `/run` over JSON frames (`type: run` / `result`). PWA prefers this | Unused. IDE is REST-only | **Later** (P0-9 is `chart.delta` from host, not this socket) |
| `WS /ws/live` | F | Engine-owned live plane (`subscribe` → `full`/`delta`/`close`, AXB1). Worker **does not** implement this path | Unused. Live bridge **deleted** in simplify | **Skip** |
| `GET /api/ws/live?issue=ticket` + `WS /api/ws/live?ticket=` | AXIS **PWA worker** proxy, not pyne-worker | Ticket mint so the browser never puts `pn_` on the URL | Unused (no `src/live/`) | **Skip** |
| `POST /run/batch` | F | ≤8 scripts, shared OHLCV | Unused (one script per run) | **Later** |
| `POST /session` · `/tick` · `/append` | F | O(1) retick / O(delta) append, interpret only | Unused | **Skip** (live sessions) |
| `GET/POST /data/series*` · `/data/session*` | F | Engine-owned OHLCV store | Unused | **Later** / **Skip** if it becomes a Data studio |
| `POST /ingest` | W | Upload OHLCV to R2 | Unused | **Skip** |
| `POST/GET/DELETE /scripts` · `/scripts/:id` | W (F if `PYNE_RUNNER=1`) | Deployed script registry | Unused | **Skip** (Scripts studio) |
| `GET/PUT /cron/jobs` · `POST /cron/run` | W (F if runner) | 1m bar-close scheduler | Unused | **Skip** |
| `POST /feed/refresh` | W | Bybit/Binance klines → R2 | Unused | **Skip** |
| `POST /ast/:op` | W | parse/dump/unparse/format/lint/diagnostics/compile for pyne-agent | Unused (language is `hoox-sh.pyne`) | **Skip** / PYNE |
| `POST /optimize` | F | Strategy input search | Unused | **Later** (P2-3 adjacent) |
| `POST /preview/*` · `/backtest/quick` | F, API key | PNG / metrics | Unused | **Skip** (not chart webview) |
| `POST /compile/prewarm` | F | Numba warm | Unused | **Later** |
| `POST /lsp/*` | F | Editor intel | Unused (sister PYNE extension) | **Skip** this repo |
| `GET /stats` | F | Counters | Unused | **Skip** |

pyne-worker `_KNOWN_ROOTS`: `/health`, `/run`, `/ingest`, `/scripts`, `/cron`, `/schedules` (alias of cron jobs), `/feed`, `/ast`. **No WebSocket routes** in `handler.py`. `/ws/run` and `/ws/live` are Flask Pro (and AXIS PWA) only.

---

## P0 wire-in-IDE (chart + run only)

Implement against Flask `RUN_SCHEMA` **and** worker `handle_run`. Do not send worker-only keys to `127.0.0.1:5002`.

**Host lift (this checkout):** `plot_meta`, `inputs`, `alerts`, `times`, `window`, `error_kind`, `script_type`, `overlay`, `script_name`, `strategy` are on `EngineRunResult`; `chart.full` carries the subset listed above; request may include `inputs`.

**Paint lift (this checkout, vs prior recit):** histogram/step/area/hline/bgcolor/barcolor/shape; engine drawings in `redraw` (line/label/box/table/polyline/linefill); inputs form + persist + `chart.applyInputs`; strategy table + CSV + markers + equity; times zip; window chip; `error_kind` on the error line; alerts count chip.

Remaining P0 is **leftover plot kinds / request window+timeframe / logs dump**, not “copy the envelope” and not “wire drawings/inputs/strategy.”

| Order | Gap | Engineering done-when | Maps to |
| --- | --- | --- | --- |
| 1 | Paint remaining `plot_meta` kinds (`fill`, `plotbar`, `plotcandle`) + `linestyle` / `offset` / `show_last`. Host already lifts `plotMeta`; line/histogram/step/area/hline/bgcolor/barcolor/shape already paint | Fixture paints fill/plotbar/plotcandle and honours linestyle/offset/show_last | P0-4 remainder |
| 2 | POST `timeframe` from `*.axis.json` `interval` (Flask `RUN_SCHEMA` still omits it — coordinate with PYNE first). Inputs form **already** posts `chart.applyInputs` | `timeframe.in_seconds()` matches bars without 400 on `:5002` | P0-8 remainder |
| 3 | Keep join-by-`times` (already in `plotPoints`). Prove engine window with gaps does not shift plots vs request bars | Engine window with gaps does not shift plots | host.py 3073; P0 chart fidelity |
| 4 | Optional `from_bar`/`to_bar` from visible range **or** chunked `chart.full`/`chart.delta`. Response `window` is already forwarded + chipped | Chart not empty until last bar; envelope trim is already in Pro | P0-9 |
| 5 | Append capped `logs` to the Run output channel. `error_kind` is already on the error line | `AXIS: Show Run Output` shows `log.info` lines; parse vs runtime distinguishable | P0-11 remainder |

**P1 remainder (still chart, still no studio):** honour drawing `style` / `extend` / box text extras. The six engine types already redraw. Comparison P1-1 mostly landed.

**Shipped on this checkout (do not recard):** P0-4 kinds listed above; P0-5 strategy chrome; P0-6 inputs form+persist.

---

## Skip (simplify)

Do not add IDE UI or clients for: `alerts*` studios, webhooks, `forward_events` / trade-worker, `realtime_*`, `/cron`, `/scripts`, `/ingest`, `/feed`, `/ws/live`, live tickets, `/session`, `/preview`, `/backtest`, `/ast`, `/lsp`. Those conflict with “core chart + Pyodide + PYNE worker example only.” Host may still stash `alerts` on `chart.full` without an Alerts studio.

---

## Later (not P0, not Skip)

| Item | Why later |
| --- | --- |
| `libraries[]` | Needed for `import ns/Name/ver`; not on the P0 chart loop |
| `profiler` / `profile.lines` | Comparison P2-2; no profiler studio |
| `WS /ws/run` | PWA prefers it; IDE REST is enough until P0 paint works |
| `GET /health` feature probe | Only if `/ws/run` is added |
| `POST /run/batch` | Multi-script on one chart |
| Worker `X-API-Key` header | Self-hosted CF; loopback Flask `/run` is free |
| Compile diagnostic fields | `auto_backend`, `compile_fallback_reason`, `compile_ms` |
| Flask `data_source` | IDE already has HistoryClient + mock bars |

---

## Auth / host mismatch (do not paper over)

1. **Flask `/run` is free.** AXIS default `http://127.0.0.1:5002` does not need a key. Keyless + `X-AXIS-Client: ide` is already the open-beta path (`engine-http.ts`, `orchestrator.ts`).
2. **pyne-worker production requires `X-API-Key`.** AXIS never sends it. A keyed Worker call with only `Authorization: Bearer pn_…` may 401 unless tenant Bearer verify is on. Source: `../pyne-worker/README.md` Auth; `handler.py` auth branch.
3. **Flask rejects unknown JSON keys.** Worker-only fields (`ohlcv`, `script_id`, `realtime_*`, `timeframe` if not added to `RUN_SCHEMA`) must be host-gated. `timeframe` is **not** in Flask `RUN_SCHEMA` today — adding it to the IDE body against default Flask **will 400** until Pro schema is updated. Worker already accepts `timeframe`. **Coordinate with PYNE** before posting `timeframe` to `:5002`. `inputs` **is** in Flask `RUN_SCHEMA` (safe to POST).
4. Worker `mode` default is `interpret`; AXIS always sends `auto` so this does not bite the IDE.

---

## Out of scope

- Restoring studios, MCP, live HUD, activity-bar views.
- Shipping Pyodide Wasm (comparison P0-1; not a Pro envelope gap).
- Stop command (P0-3; host abort already exists on `RunOrchestrator.abortAll`).
- Marketplace README rewrite (P0-12; docs card elsewhere).

---

## Sources

| Path | Used for |
| --- | --- |
| `../pyne-worker/README.md` | Worker endpoints, `/run` fields, cron/alerts/libraries/window/realtime/modes |
| `../pyne-worker/src/handler.py` | Request parse, success copy, `_run_error_body`, `/health` features, route table |
| `../pyne-worker/src/entry.py` | Alert/trade forward flags on `/run` |
| `../pyne-worker/src/window.py` | `window` meta; series keys sliced; alerts never trimmed |
| `../pyne-worker/src/pynescript_backend/runtime.py` | Thin wrap; `error_kind`; realtime kwargs |
| `../pyne-worker/python_modules/pynescript/runtime/host.py` | Envelope: plots/series/plot_meta/events/drawings/alerts/inputs/times/meta |
| `../pyne-worker/python_modules/pynescript/ast/evaluator/builtins/drawing.py` | Drawing export shape (`type`, not `tool`) |
| `pynescript/backend/middleware/schemas.py` | Flask `RUN_SCHEMA` (strict keys) |
| `hoox-landing-page/content/pyne-docs/api/endpoints/run.mdx` | Flask `/run`, `/run/batch`, `WS /ws/run` |
| `hoox-landing-page/content/pyne-docs/api/index.mdx` | Pro route map |
| `src/run/engine-http.ts` | AXIS request body (four keys + optional `inputs`) + `mapEngineResponse` → `attachRunEnvelope` |
| `src/run/run-envelope.ts` | `attachRunEnvelope`, `chartFullFromRunResult`, `extractStrategy` |
| `src/run/orchestrator.ts` | Forwards `req.inputs`; `chart.full` via `chartFullFromRunResult`; logs `errorKind` |
| `src/run/chart-bus.ts` | `chart.full` / unused `chart.delta` fan-out |
| `src/run/run-context.ts` | Bars + seriesKey + doc `inputs`; timeframe not posted to `/run` |
| `src/protocol/types.ts` | `ChartFullPayload` extras: plotMeta, inputs, alerts, times, window, strategy, scriptType |
| `src/extension.ts` | Run path passes inputs; no envelope log dump; diagnostics no-op |
| `src/editors/chart-editor.ts` | `chart.applyInputs` persist + re-run |
| `webview/chart/src/state.ts` | plotMeta/times/strategy/inputs/window/engineDrawings on `chart.full`; no `scriptType` |
| `webview/chart/src/paint.ts` | LWC kinds line/step/histogram/area/hline/bgcolor/barcolor/shape + times zip + strategy markers + equity |
| `webview/chart/src/drawings.ts` | Engine SVG: line/polyline/box/label/linefill; tables skipped here |
| `webview/chart/src/main.ts` | `redrawOverlay(..., state.engineDrawings)`; inputs form; strategy table/CSV; table drawings HTML; window/alerts chips |
| `docs/competitive/pyneide-vs-axis.md` | P0/P1/P2; no studios |

---

## Checklist (this artifact)

```text
[1] the artifact exists at docs/competitive/pro-backend-vs-axis.md
[2] verified with test -f (cwd axis-ide-vsce) plus rg of engine-http.ts / run-envelope.ts / orchestrator.ts / paint.ts / drawings.ts / main.ts / state.ts
[3] every table row cites a file path or Pro docs path
[4] docs only — no product code
```
