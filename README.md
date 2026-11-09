# AXIS IDE

**VS Code extension** that brings a lightweight [AXIS](https://hoox.sh/axis) chart
beside Pine / PYNE buffers — **core: chart custom editor + Pyodide engine + simple option/example for launching PYNE worker on Cloudflare or auto-wired Pro**.

| | |
| --- | --- |
| **Extension id** | `hoox-sh.axis-ide` |
| **Repository** | [hoox-sh/axis-ide-vsce](https://github.com/hoox-sh/axis-ide-vsce) |
| **License** | [AGPL-3.0-only](./LICENSE) |
| **Hard dependency** | [`hoox-sh.pyne`](https://marketplace.visualstudio.com/items?itemName=hoox-sh.pyne) (PYNE Language Support) — **recommended ≥ 0.5.8** |
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
code --install-extension axis-ide-<version>.vsix
```

The optional **AXIS Trading Pack** (`hoox-sh.axis-pack`) installs PYNE + AXIS IDE
together:

```bash
bun run pack:package                  # → pack/axis-pack-<version>.vsix
code --install-extension pack/axis-pack-<version>.vsix
```

## Status

Lightweight **core** (no activity-bar studios):

- **AXIS Chart** custom editor on `*.axis.json` (paint-only CSP webview + bundled Lightweight Charts; mock, datafeed, or workspace CSV)
- **AXIS: Open Chart** opens or creates sibling `*.axis.json`
- **AXIS: Run Script** (`Ctrl/Cmd+Enter`) → **Pyodide by default** (`axis.engine.allowPyodide`) or remote `/run` (Pro auto-wired or self-hosted CF PYNE worker). Banner `engine=pyodide … uploaded=0`
- **AXIS: Pick Data** — symbol, timeframe, mock / datafeed / **workspace CSV** (`barsPath` on `*.axis.json`)
- **Get Started** walkthrough `axis.firstPlot` (`fixtures/orb.pine`)
- Run surfaces via output channel + chart webview (paint-only). **Live-safe** hides overlays when static lookahead grep fires (not a live-taint proof)
- Secrets (Pro + worker) via SecretStorage only — never settings
- Pyodide 0.29.5 from jsDelivr into `globalStorage` (Wasm **not** in the VSIX)
- Bar debugger: DAP type **`axis-bar`** (not `pyne`) — bar-step, chart-bar breakpoints, click a strategy trade to seek

See "Lightweight PYNE Options" below for Pro / worker details.

## Lightweight PYNE Options

AXIS IDE keeps execution simple: chart + local Pyodide + one of two remote paths.

**Pyodide (local, default on):** `axis.engine.allowPyodide` defaults **true**. AXIS loads **Pyodide 0.29.5** from the official jsDelivr CDN (`https://cdn.jsdelivr.net/pyodide/v0.29.5/full/`) in the extension host — Wasm is **not** in the VSIX. After the first fetch, `pyodide.mjs` is cached in extension `globalStorage` (airplane-mode after that first fetch). `ready` is true only after a `1+1` smoke **and** a pynescript Runtime smoke. The host micropip-installs a trusted `hoox-pyne` wheel (`media/pyodide/`, optional `axis.engine.pyodideWheelUrl`, or sibling `pynescript/dist`) plus `antlr4-python3-runtime`, then `media/pyodide/pynescript_runtime.py` calls `pynescript.runtime.Runtime.run` — the same envelope as Flask/worker POST `/run`. Source is not uploaded (`engine=pyodide … uploaded=0`). Not in Wasm: Numba compile, Cloudflare R2, cron. The chart CSP widens (`wasm-unsafe-eval` + `worker-src blob:` + jsDelivr `connect-src`/`script-src`) so a blob worker can fetch the same origin. Set the flag **false** to force remote `/run` only. See `docs/competitive/axis-capability-list.md`.

### Pro (free)

- Command **AXIS: Set Pro API Key** (`axis.secrets.setProKey`)
- Stores only in `ExtensionContext.secrets` (validated `pyn_` shape; empty input clears).
- Optional: configure `axis.engine.endpoint` (default loopback or Pro host) + `axis.engine.allowRemoteEndpoint` (application scope) for off-loopback.
- **Auto-wired** (prominent): when a valid Pro key is present, run orchestration POSTs to `${endpoint}/run` using `Authorization: Bearer <key>`. No extra commands or settings for the key.
- No status bar in the lightweight core (keys never shown).
- Clear via **AXIS: Clear Stored Secrets**.

**Keys are never settings** — no `axis.*.apiKey` in configuration. Run paths read SecretStorage only.

### Cloudflare PYNE Worker (self-hosted)

Deploy a minimal PYNE worker to Cloudflare using the open template at https://github.com/hoox-sh/axis (or hoox-sh/pyne examples); set worker key via secrets (if auth required); point engine to it. Auto-wired when key present. Worker enforces its own auth via CF secrets / env vars if desired.

**Quick start (minimal stub — /run contract only):**

```bash
npm create cloudflare@latest my-pyne-worker -- --yes
cd my-pyne-worker
# edit src/index.js (or index.ts + build) for /run handler
wrangler deploy
```

Minimal worker handling the IDE's `/run`:

```js
// src/index.js
export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method === 'POST' && url.pathname === '/run') {
      const body = await req.json();
      const { script, data = [], mode = 'auto', symbol = 'CHART' } = body;

      // Integrate real PYNE execution here (e.g. Pyodide server-side,
      // @hoox-sh/pyne wasm, or proxy to engine). Example stub result:
      const result = {
        status: 'success',
        plots: [],
        series: {},
        events: [],
        diagnostics: [],
        logs: [{ level: 'info', message: `stub: ${script.slice(0, 20)}...`, line: 1 }],
        meta: { transport: 'rest' },
        // drawings, profile, etc. as produced by engine
      };
      return Response.json(result);
    }

    return new Response('not found', { status: 404 });
  },
};
```

**Deploy & wire:**

- `wrangler deploy` → get `https://my-pyne-worker.<acct>.workers.dev`
- In VS Code settings (or workspace): `axis.engine.endpoint` = that URL
- For remote: also enable `axis.engine.allowRemoteEndpoint: true` (app scope)
- Run Script will now target your worker (no Pro key needed for this path; worker can enforce its own auth via CF secrets / env if desired).

**Rules:**
- **Never** store `pn_` / `pyn_` keys in IDE settings, `settings.json`, logs, or the worker example source.
- If worker needs a key, put it in `wrangler secret put ...` (accessed via `env.XXX`).
- The IDE never puts keys on query strings.

See source `src/run/engine-http.ts` for the exact request/response shapes the `/run` handler must accept/return. (Source is the contract reference.)

## Activation

Activates on commands and when the workspace contains AXIS/Pine sources. Pine
globs intentionally match the PYNE language extension list: `*.pyne`, `*.pine`,
`*.pinev5`, `*.pinev6`, `*.pinescript`, plus `*.axis.json`.

## Commands

| Command | Id |
| --- | --- |
| AXIS: Open Chart | `axis.openChart` (open/create sibling `*.axis.json`) |
| AXIS: Run Script | `axis.runScript` (Ctrl/Cmd+Enter on Pine / `.pyne` / `.pine`) |
| AXIS: Stop Run | `axis.stopRun` (title-bar swap while a run is in flight) |
| AXIS: Run Script (Silent) | `axis.runScriptSilent` |
| AXIS: Show Run Output | `axis.showRunOutput` |
| AXIS: Pick Data | `axis.pickData` (symbol / timeframe / mock / datafeed / workspace CSV) |
| AXIS: Start Bar Debug | `axis.debug.start` (DAP type `axis-bar`) |
| AXIS: Step Bar | `axis.debug.stepBar` |
| AXIS: Toggle Bar Breakpoint | `axis.debug.toggleBarBreakpoint` |
| AXIS: Open First-Plot Fixture | `axis.openWalkthroughFixture` |
| AXIS: Set Pro API Key | `axis.secrets.setProKey` |
| AXIS: Set Worker API Key (CF) | `axis.secrets.setWorkerKey` |
| AXIS: Clear Stored Secrets | `axis.secrets.clear` (Pro + Worker) |

### SecretStorage UX (`axis.secrets.*`)

Keys live only in `ExtensionContext.secrets` (VS Code SecretStorage):

| Slot | Prefix / shape | Commands |
| --- | --- | --- |
| Pro API key | `pyn_` + 20–508 `[A-Za-z0-9_-]` | `axis.secrets.setProKey` |
| Worker API key (CF) | `pn_[a-f0-9]{48}` | `axis.secrets.setWorkerKey` |
| | — | `axis.secrets.clear` (confirm; Pro + Worker) |

- Set flows use `showInputBox({ password: true })`; invalid input is rejected **before** store.
- Empty input on a set command clears that slot.
- Commands confirm set/cleared — never key material, no status bar.
- Keys are **never** `contributes.configuration` properties.
- Run paths read SecretStorage only.

## Settings

| Setting | Default | Notes |
| --- | --- | --- |
| `axis.telemetry.offline` | `true` | Keep product telemetry off |
| `axis.engine.id` | `server` | Engine mode |
| `axis.engine.endpoint` | `http://127.0.0.1:5002` | Base for Pro / worker `/run` (no `/run` suffix); remote needs allow |
| `axis.engine.allowRemoteEndpoint` | `false` | Opt-in before sending to non-loopback (**application** scope) |
| `axis.engine.allowPyodide` | `true` | Local Pyodide 0.29.5 calculator (CDN Wasm cached in `globalStorage`; not in VSIX). Set false for `/run` only |
| `axis.chart.useMockBars` | `false` | Opt-in mock bars |
| `axis.chart.historyBars` | `1500` | History window |
| `axis.datafeed.url` | `http://127.0.0.1:5003` | Datafeed base (remote needs allow) |

Secrets are **not** settings — use the `axis.secrets.*` commands above.

Real history / datafeed docs pruned for lightweight focus; see Pro / worker section for remote.

## Webview CSP

Chart webview is paint-only by default (host proxies network). See full matrix:

[docs/csp-matrix.md](./docs/csp-matrix.md).

When `axis.engine.allowPyodide` is true the chart webview widens for Wasm + jsDelivr; others unchanged.

## Develop

Requirements: [Bun](https://bun.sh) `1.4.4`, Node 22 (esbuild / Vite / vsce
shell-outs), and VS Code `^1.95.0` for the electron suite.

```bash
bun install

bun run compile                    # host esbuild + Vite webviews (chart primary)
bun run compile:webview            # webviews only
bun run watch                      # host esbuild watch
bun run check                      # tsc host + every webview
bun run test:unit                  # bun:test
bun run test:coverage:gate         # coverage + BASELINE/protocol ratchet
bun run test                       # @vscode/test-electron (needs PYNE VSIX)
bun run package                    # → axis-ide-<version>.vsix
bun run pack:package               # → pack/axis-pack-<version>.vsix
bun run verify                     # check + coverage gate
```

### Build layout

| Artifact | Path | Notes |
| --- | --- | --- |
| Extension host bundle | **`out/extension.js`** | Produced by `esbuild.host.mjs`. **Do not move the host entry to `dist/`.** |
| Chart webview assets | **`dist/webview/chart/`** | Vite build (primary) |
| (minimal other webviews if retained for core) | `dist/webview/<...>/` | Kept minimal for core |

### Electron tests

Electron tests need `hoox-sh.pyne` installed into the downloaded VS Code. By
default the harness globs `pyne-vscode-*.vsix` from a sibling `pynescript` /
`pyne` checkout. Override with
`AXIS_IDE_PYNE_VSIX=/path/to/pyne-vscode-….vsix`. In CI (`CI` /
`GITHUB_ACTIONS`), a missing or failed install **hard-fails**.

## Repository layout

```text
.
├── src/                  # extension host (TypeScript) — core: editors (chart), run, host, protocol, secrets
├── webview/              # Vite projects (chart primary)
├── media/                # icon, walkthrough, trusted Pyodide wheels
├── scripts/              # coverage gate
├── docs/                 # CSP matrix + lightweight notes
├── pack/                 # hoox-sh.axis-pack extension pack
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
