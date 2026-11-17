# AXIS IDE webview CSP matrix

Audit against design KD-6 / CSP matrix (Task 25 + Task 27). **Do not widen runtime CSP
without updating this doc** (and README).

HTML is host-generated. The chart shell is `src/editors/chart-html.ts` (`webview.cspSource`, never a hard-coded `vscode-resource:` / `https:`). The activity-bar desk is `src/host/desk.ts` (`renderDeskHtml`) and loads no extension resources. The start screen is `src/host/start-run.ts` (`renderStartHtml`): one nonce script, no extension resources.

Optional Pyodide widen is gated by **`axis.engine.allowPyodide`** (default **true**, Wave 1).
Runtime helper: `buildChartCspDirectives(cspSource, allowPyodide)` in
`src/editors/chart-html.ts`. Version lock: `LOCAL_PYODIDE_VERSION = '0.29.5'` in
`src/host/pyodide-profile.ts` (calculator / bars-in only — not stream-owning).
Pyodide **0.29.5 ships in this VSIX** under `vendor/pyodide/0.29.5/` (vendored at
package time by `scripts/vendor-pyodide.mjs`, pinned by size + SHA-256). The host
boots from that read-only copy; the jsDelivr fallback
(`https://cdn.jsdelivr.net/pyodide/v0.29.5/full/`) fills
`globalStorage/pyodide/0.29.5` only when the bundle is absent. `ready` is true
only after a `1+1` smoke **and** a pynescript Runtime smoke (trusted wheel via
micropip).

## Enforced (chart primary + AXIS desk + start screen) — default

| Directive | Chart (`axis.chart`) | Desk (`axis.desk`) | Start (`axis.start`) |
| --- | --- | --- | --- |
| `default-src` | `'none'` | `'none'` | `'none'` |
| `base-uri` | `'none'` | `'none'` | `'none'` |
| `form-action` | `'none'` | `'none'` | `'none'` |
| `script-src` | `${webview.cspSource}` | `'none'` | `'nonce-<random>'` |
| `style-src` | `${webview.cspSource} 'unsafe-inline'` | `'nonce-<random>'` | `'nonce-<random>'` |
| `img-src` | `${webview.cspSource} data: blob:` | `'none'` | `'none'` |
| `connect-src` | `'none'` | `'none'` | `'none'` |
| `worker-src` | _(omitted)_ | _(omitted)_ | _(omitted)_ |
| Inline `<script>` | **Forbidden** (src= only) | **Forbidden** (no script at all) | **One** nonce script |

The desk's buttons are `command:` links from a fixed allowlist in `DESK_ACTIONS`. Snapshot text (symbol, script name, engine) is escaped and never becomes a command id. `enableScripts` is false. `enableCommandUris` is that allowlist, not `true`.

The start screen's script only posts `{ type: 'choose', id }` or `{ type: 'back' }`. Card ids are checked against `hosted`, `local`, and `editor`. Step text is escaped. `enableScripts` is true. `enableCommandUris` stays off. `localResourceRoots` is empty.

The chart keeps `style-src 'unsafe-inline'` because the chart runtime sets element styles. Its stylesheet still loads via `asWebviewUri` from `dist/webview/chart/` under `localResourceRoots`. Lightweight Charts is bundled into the chart `main.js` (no CDN).

The desk and the start screen inline one `<style nonce>` block and do not use `'unsafe-inline'`. They load no extension files. The start screen is the only webview whose `script-src` is a nonce instead of `${webview.cspSource}`. Neither view sets `retainContextWhenHidden`. The extension repaints the document from host state when the view is shown again.

## vs AXIS PWA (`public/_headers`)

| Directive | PWA | IDE webviews (default) |
| --- | --- | --- |
| `default-src` | `'self'` | `'none'` |
| `script-src` | `'self'` + nonce + `wasm-unsafe-eval` + agent worker | `${webview.cspSource}` only |
| `style-src` | `'self' 'unsafe-inline'` | `${webview.cspSource} 'unsafe-inline'` |
| `img-src` | `'self' data: blob:` | `${webview.cspSource} data: blob:` |
| `connect-src` | `'self' https: wss:` + localhost | **`'none'`** — host proxies network |
| `worker-src` | `'self' blob:` | omitted until Pyodide flag on |
| COOP / COEP | same-origin / credentialless | N/A (VS Code iframe) |

**Default policy:** extension host owns `fetch` / WS (Pro `/run`, Worker `/run` endpoints, datafeed). Webviews are paint / UI only. That keeps `connect-src
'none'` and matches KD-6.

## Optional widen (`axis.engine.allowPyodide` — on by default)

When `axis.engine.allowPyodide` is **true**, the **chart** webview CSP only is
widened via `buildChartCspDirectives(..., true)` / `buildChartWebviewHtml({ allowPyodide: true })`:

| Directive | Value |
| --- | --- |
| `script-src` | `${webview.cspSource} 'wasm-unsafe-eval' https://cdn.jsdelivr.net` |
| `connect-src` | `${webview.cspSource} https://cdn.jsdelivr.net` |
| `worker-src` | `blob: ${webview.cspSource}` |

`connect-src ${webview.cspSource}` is what lets the chart worker read the
bundled `pyodide.asm.wasm` / `python_stdlib.zip` from the extension; the jsDelivr
entry stays for the no-bundle fallback. Chart HTML sets
`data-axis-pyodide-index` to the bundled webview URI (or the 0.29.5 jsDelivr
index when `vendor/pyodide/0.29.5/` is missing). Evaluation is **host-side**
(extension host boots Pyodide from the bundled copy, smokes `1+1`, then runs the
bars-in subset) so paint/POST stay untouched. The chart CSP is widened so the
blob worker *may* load the same files.

**Enable path checklist**

1. Setting default is **true** in `package.json` (Wave 1). Set false to skip the widen and force remote `/run`.
2. Host reads the flag when building chart HTML (`chart-editor` → `allowPyodide`).
3. Calculator profile is bars-in only (`src/host/pyodide-profile.ts`); do not treat
   Pyodide as stream-owning.
4. Pyodide 0.29.5 is vendored into the VSIX at `vendor/pyodide/0.29.5/` by
   `bun run vendor:pyodide` (`vscode:prepublish` runs it; files are pinned by
   size + SHA-256 in `scripts/pyodide-assets.json`). The directory is gitignored
   and never hand-edited. `pyodideRuntimeStatus.ready` is true only after Wasm
   smoke **and** a pynescript Runtime smoke (`callable(run_script)`), never from
   the flag alone. Trusted `hoox-pyne` + `antlr4` wheels live in `media/pyodide/`.
5. Update this matrix + README whenever the widen set changes.
