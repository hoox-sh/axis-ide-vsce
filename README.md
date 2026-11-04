# AXIS IDE

**VS Code extension** that brings the [AXIS](https://hoox.sh/axis) charting IDE
beside Pine / PYNE buffers — run orchestration, charts, results, and live
sessions inside the editor.

| | |
| --- | --- |
| **Extension id** | `hoox-sh.axis-ide` |
| **Repository** | [hoox-sh/axis-ide-vsce](https://github.com/hoox-sh/axis-ide-vsce) |
| **License** | [AGPL-3.0-only](./LICENSE) |
| **Hard dependency** | [`hoox-sh.pyne`](https://marketplace.visualstudio.com/items?itemName=hoox-sh.pyne) (PYNE Language Support) — **recommended ≥ 0.5.4** |
| **Editor floor** | VS Code / compatible editor `^1.95.0` |

Part of the **[HOOX](https://hoox.sh) open trading stack**. Sister products:
**[PYNE](https://hoox.sh/pyne)** (Pine language tooling) and
**[AXIS](https://hoox.sh/axis)** (charting PWA).

> Independent, unofficial extension. **Not** affiliated with, endorsed by, or
> sponsored by TradingView, Inc.
> Pine Script™ and TradingView® are trademarks of TradingView, Inc.

## Install

From the VS Code Marketplace / Open VSX, search for **AXIS IDE**, or install a
VSIX built from this repo:

```bash
bun run package                       # → axis-ide-<version>.vsix
code --install-extension axis-ide-0.1.0.vsix
```

The optional **AXIS Trading Pack** (`hoox-sh.axis`) installs PYNE + AXIS IDE
together:

```bash
bun run pack:package                  # → pack/axis-<version>.vsix
code --install-extension pack/axis-0.1.0.vsix
```

## Status

This is the **0.1.0** extension:

- Activation without `onStartupFinished` (workspace globs + commands + `onCustomEditor:axis.chart`)
- Output channel **AXIS Run** (`AXIS: Show Run Output`)
- Status bar item (`axis.ide.status`) with Worker/Pro key **set/missing** marks (never values)
- **AXIS Chart** custom editor on `*.axis.json` (CSP webview + bundled Lightweight Charts; mock or datafeed `chart.full`)
- **AXIS: Open Chart** opens or creates a sibling `*.axis.json` beside the active Pine file (existing files are not rewritten)
- **AXIS: Run Script** (`Ctrl/Cmd+Enter`) → Pro `/run` on HistoryClient venue bars (default) or mock bars when `axis.chart.useMockBars` is true; paints `chart.full` candles or `axis-run` diagnostics; Silent variant skips Results focus / error toasts
- **Results / Strategy** panel WebviewViews (`axis.results` / `axis.strategy`) with focus rules; **AXIS: Focus Results** retargets the open run
- Activity-bar studios: Library / Layers / Scripts / Watchlist / Alerts / Plugins / Workers
- Settings: `axis.telemetry.offline`, `axis.engine.id` (`server` only for now), `axis.engine.endpoint` (loopback by default; remote needs `axis.engine.allowRemoteEndpoint`), `axis.chart.useMockBars` / `historyBars`, `axis.datafeed.url`
- Plot/drawing overlays from engine results are carried on `chart.full.plots`; webview plot paint is candle-first
- Typed host↔webview envelope codecs under `src/protocol/` (coverage-gated)
- Worker (`pn_…`) / Pro (`pyn_…`) keys via `axis.secrets.*` → `ExtensionContext.secrets` only
- MCP server definition provider + Copilot language-model tools (soft-fail unless the AXIS CLI resolves)

## Activation

Activates on commands and when the workspace contains AXIS/Pine sources. Pine
globs intentionally match the PYNE language extension list: `*.pyne`, `*.pine`,
`*.pinev5`, `*.pinev6`, `*.pinescript`, plus `*.axis.json`.

## Commands

| Command | Id |
| --- | --- |
| AXIS: Show Run Output | `axis.showRunOutput` |
| AXIS: Open Chart | `axis.openChart` (open/create sibling `*.axis.json`) |
| AXIS: Run Script | `axis.runScript` (Ctrl/Cmd+Enter on pinescript) |
| AXIS: Run Script (Silent) | `axis.runScriptSilent` |
| AXIS: Focus Results | `axis.focusResults` |
| AXIS: Apply Builtin Script | `axis.applyBuiltin` |
| AXIS: Start Live / Stop Live | `axis.liveStart` / `axis.liveStop` |
| AXIS: Probe Workers | `axis.workers.probeAll` |
| AXIS: Plugin Menu | `axis.plugins.statusMenu` |
| AXIS: Add / Remove Alert | `axis.alerts.add` / `axis.alerts.remove` |
| AXIS: Add / Remove Symbol | `axis.watchlist.add` / `axis.watchlist.remove` |
| AXIS: Show MCP Config Snippet | `axis.mcp.showConfig` |
| AXIS: Set Worker API Key | `axis.secrets.setWorkerKey` |
| AXIS: Set Pro API Key | `axis.secrets.setProKey` |
| AXIS: Clear Stored Secrets | `axis.secrets.clear` (Worker + Pro) |

### SecretStorage UX (`axis.secrets.*`)

Keys live only in `ExtensionContext.secrets` (VS Code SecretStorage):

| Slot | Prefix / shape | Commands |
| --- | --- | --- |
| Worker API key | `/^pn_[a-f0-9]{48}$/` | `axis.secrets.setWorkerKey` |
| Pro API key | `pyn_` + 20–508 `[A-Za-z0-9_-]` | `axis.secrets.setProKey` |
| Both | — | `axis.secrets.clear` (confirm; deletes Worker + Pro) |

- Set flows use `showInputBox({ password: true })`; invalid input is rejected **before** store.
- Empty input on a set command clears that slot.
- Status bar shows Worker/Pro **set/missing** only — never key material.
- Keys are **never** `contributes.configuration` properties (no `axis.worker.apiKey` / `axis.pro.apiKey`).
- Run / live paths read SecretStorage only.

## Settings

| Setting | Default | Notes |
| --- | --- | --- |
| `axis.telemetry.offline` | `true` | Keep product telemetry off |
| `axis.engine.id` | `server` | Pro `/run` only in this release |
| `axis.engine.endpoint` | `http://127.0.0.1:5002` | Pro base URL (no `/run` suffix); loopback unless remote allowed |
| `axis.engine.allowRemoteEndpoint` | `false` | Opt-in before sending Bearer off-machine (**application** scope — workspace cannot enable) |
| `axis.engine.allowPyodide` | `false` | Opt-in chart CSP widen for optional Pyodide calculator (`wasm-unsafe-eval` + `worker-src blob:`). Bars-in only; Wasm assets not shipped |
| `axis.chart.useMockBars` | `false` | Opt-in mock/fixture bars for chart + run. Default **false** uses real history via datafeed |
| `axis.chart.historyBars` | `1500` | Default history window (clamped ≤20000) |
| `axis.datafeed.url` | `http://127.0.0.1:5003` | Local `@hoox-sh/axis-datafeed` base (`GET /datafeed/ohlcv`); remote needs `axis.engine.allowRemoteEndpoint` |
| `axis.worker.url` | `https://worker.axis.hoox.sh` | Live ticket mint + WS upgrade origin |
| `axis.live.enabled` | `true` | Disable to make `axis.liveStart` a no-op |
| `axis.plugins.allowUrlInstall` | `false` | Allow remote plugin installs |
| `axis.mcp.stdio` | `true` | Advertise the AXIS MCP stdio server |
| `axis.mcp.command` | `""` | Absolute path / command for the AXIS CLI (**application** scope) |
| `axis.mcp.allowNpx` | `false` | Allow `npx -y @hoox-sh/axis-cli` fallback (**application** scope) |

**Real history (default):** start `@hoox-sh/axis-datafeed` on `:5003`. Chart
clears then paints fetched bars (`chart.full` seq above handshake); runs fail
clearly if fetch fails (no empty `/run` body, no silent mock). Set
`axis.chart.useMockBars` to **true** only for offline/fixture dogfood.

Secrets are **not** settings — use the `axis.secrets.*` commands above.

## Webview CSP

Chart and Results/Strategy webviews share a paint-only CSP (host proxies network):

| Directive | Value |
| --- | --- |
| `default-src` | `'none'` |
| `script-src` | `${webview.cspSource}` (no inline script) |
| `style-src` | `${webview.cspSource} 'unsafe-inline'` |
| `img-src` | `${webview.cspSource} data: blob:` |
| `connect-src` | `'none'` |

When **`axis.engine.allowPyodide`** is enabled (default **false**), the **chart**
webview only adds `'wasm-unsafe-eval'` to `script-src` and
`worker-src blob: ${webview.cspSource}`. Results/Strategy stay paint-only.
Pyodide remains a bars-in calculator stub (`LOCAL_PYODIDE_VERSION = '0.29.5'`);
multi-MB Wasm is not packaged in the VSIX yet.

Full matrix vs the AXIS PWA and the Pyodide enable path:
[docs/csp-matrix.md](./docs/csp-matrix.md). Do not change runtime CSP without
updating that doc.

## Develop

Requirements: [Bun](https://bun.sh) `1.4.4`, Node 22 (esbuild / Vite / vsce
shell-outs), and VS Code `^1.95.0` for the electron suite.

```bash
bun install

bun run compile                    # host esbuild + all Vite webviews
bun run compile:webview            # webviews only
bun run watch                      # host esbuild watch
bun run watch:webview              # chart Vite watch
bun run check                      # tsc host + every webview
bun run test:unit                  # bun:test
bun run test:coverage              # unit + lcov under coverage/
bun run test:coverage:gate         # coverage + BASELINE/protocol ratchet
bun run test                       # @vscode/test-electron (needs PYNE VSIX)
bun run package                    # → axis-ide-<version>.vsix
bun run pack:package               # → pack/axis-<version>.vsix
bun run verify                     # check + coverage gate
```

### Build layout

| Artifact | Path | Notes |
| --- | --- | --- |
| Extension host bundle | **`out/extension.js`** | Produced by `esbuild.host.mjs`. **Do not move the host entry to `dist/`.** |
| Chart webview assets | **`dist/webview/chart/`** | Vite build (`compile:webview:chart`); CSP HTML is host-generated. |
| Results webview assets | **`dist/webview/results/`** | Shared Results/Strategy Vite bundle (`compile:webview:results`). |
| Studio webviews | **`dist/webview/<studio>/`** | One Vite config per activity-bar / panel studio. |

### Electron tests

Electron tests need `hoox-sh.pyne` installed into the downloaded VS Code. By
default the harness globs `pyne-vscode-*.vsix` from a sibling `pynescript` /
`pyne` checkout. Override with
`AXIS_IDE_PYNE_VSIX=/path/to/pyne-vscode-….vsix`. In CI (`CI` /
`GITHUB_ACTIONS`), a missing or failed install **hard-fails**.

## Repository layout

```text
.
├── src/                  # extension host (TypeScript)
├── webview/              # one Vite project per webview
├── media/                # icons, builtin catalog, activity art
├── scripts/              # coverage gate
├── docs/                 # CSP matrix + design/plan notes
├── pack/                 # hoox-sh.axis extension pack
├── fixtures/             # sample *.axis.json
├── .github/workflows/    # CI + release
└── out/ dist/ coverage/  # build output (gitignored)
```

## CI / release

- `.github/workflows/ci.yml` — Bun unit tests + coverage gate, `@vscode/test-electron`
  under xvfb, VSIX packaging on `main` / tags / dispatch.
- `.github/workflows/release.yml` — on `v*` tags: builds both VSIX files, attaches
  them to the GitHub Release, and publishes to the Marketplace / Open VSX when
  `VSCE_PAT` / `OVSX_PAT` are configured.
- Maintainer publishing guide: [PUBLISH.md](./PUBLISH.md).

## License

GNU Affero General Public License **version 3 only** (SPDX:
`AGPL-3.0-only`). See [LICENSE](./LICENSE) and [NOTICE](./NOTICE) (lists
**TradingView Lightweight Charts™** Apache-2.0 and other third-party
components). File headers must not say “or later”. Sister extension
`hoox-sh.pyne` remains AGPL-3.0-or-later — do not relicense it.

This extension was extracted from the AXIS monorepo
([`hoox-sh/axis`](https://github.com/hoox-sh/axis)) with its commit history
preserved.
