# AXIS IDE webview CSP matrix

Audit against design KD-6 / CSP matrix (Task 25 + Task 27). **Do not widen runtime CSP
without updating this doc** (and README).

HTML is host-generated (`src/editors/chart-html.ts`) with `webview.cspSource` — never hard-coded `vscode-resource:` / `https:`. (Chart webview only in lightweight core.)

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

## Enforced (chart primary; minimal core webviews) — default

| Directive | Chart (`axis.chart`) | All other webviews (none in lightweight core) |
| --- | --- | --- |
| `default-src` | `'none'` | `'none'` |
| `base-uri` | `'none'` | `'none'` |
| `form-action` | `'none'` | `'none'` |
| `script-src` | `${webview.cspSource}` | `${webview.cspSource}` |
| `style-src` | `${webview.cspSource} 'unsafe-inline'` | `${webview.cspSource} 'unsafe-inline'` |
| `img-src` | `${webview.cspSource} data: blob:` | `${webview.cspSource} data: blob:` |
| `connect-src` | `'none'` | `'none'` |
| `worker-src` | _(omitted)_ | _(omitted)_ |
| Inline `<script>` | **Forbidden** (src= only) | **Forbidden** (src= only) |

`style-src 'unsafe-inline'` covers VS Code theme CSS variables and the shared
`--axis-*` design-token layer. Scripts and styles load via `asWebviewUri` from
`dist/webview/chart/` under `localResourceRoots`. Lightweight Charts is
bundled into the chart `main.js` (no CDN).

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
