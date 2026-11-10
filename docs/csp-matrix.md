# AXIS IDE webview CSP matrix

Audit against design KD-6 / CSP matrix (Task 25 + Task 27). **Do not widen runtime CSP
without updating this doc** (and README).

HTML is host-generated (`src/editors/chart-html.ts`) with `webview.cspSource` — never hard-coded `vscode-resource:` / `https:`. (Chart webview only in lightweight core.)

Optional Pyodide widen is gated by **`axis.engine.allowPyodide`** (default **true**, Wave 1).
Runtime helper: `buildChartCspDirectives(cspSource, allowPyodide)` in
`src/editors/chart-html.ts`. Version lock: `LOCAL_PYODIDE_VERSION = '0.29.5'` in
`src/host/pyodide-profile.ts` (calculator / bars-in only — not stream-owning). Wasm
is **not** shipped in this VSIX; when the flag is on the host loads **0.29.5** from
jsDelivr (`https://cdn.jsdelivr.net/pyodide/v0.29.5/full/`) and `ready` is true
only after a `1+1` smoke **and** a pynescript Runtime smoke (trusted wheel, not
Wasm in the VSIX).

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
| `connect-src` | `https://cdn.jsdelivr.net` |
| `worker-src` | `blob: ${webview.cspSource}` |

No inline script. Chart HTML also sets `data-axis-pyodide-cdn` to the 0.29.5
index URL. Evaluation this pass is **host-side** (extension host fetches the
CDN, smokes `1+1`, then a minimal bars-in subset) so paint/POST stay untouched.
The chart CSP is widened so a blob worker *may* fetch the same origin.

**Enable path checklist**

1. Setting default is **true** in `package.json` (Wave 1). Set false to skip the widen and force remote `/run`.
2. Host reads the flag when building chart HTML (`chart-editor` → `allowPyodide`).
3. Calculator profile is bars-in only (`src/host/pyodide-profile.ts`); do not treat
   Pyodide as stream-owning.
4. Do **not** vendor multi-MB Pyodide under `dist/` / VSIX. Load from jsDelivr.
   `pyodideRuntimeStatus.ready` is true only after Wasm smoke **and** a pynescript
   Runtime smoke (`callable(run_script)`), never from the flag alone. Trusted
   `hoox-pyne` + `antlr4` wheels live in `media/pyodide/` (not Wasm).
5. Update this matrix + README whenever the widen set changes.
