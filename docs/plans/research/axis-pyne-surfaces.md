# AXIS VS Code extension — surface inventory

Research date: 2026-11-02  
Workspace roots: `/mnt/data/home/jango/Git/axis`, `/mnt/data/home/jango/Git/pynescript/vscode-extension`  
Goal: exact inventory for designing an AXIS VS Code extension that clones the AXIS PWA as an IDE inside VS Code.

---

## 1. PYNE vscode-extension inventory

**Identity**

| Field | Value |
|-------|-------|
| Extension id | `hoox-sh.pyne` |
| Package name | `pyne` |
| Display name | PYNE Language Support |
| Version (tree) | `0.5.4` |
| Publisher | `hoox-sh` |
| License | AGPL-3.0-or-later |
| Engines | `vscode ^1.91.0` |
| Extension kind | `workspace` |
| Main | `./out/extension.js` |
| Source entry | `/mnt/data/home/jango/Git/pynescript/vscode-extension/src/extension.ts` |
| Latest VSIX | `pyne-vscode-0.5.4.vsix` (also 0.3.17–0.5.3 present) |

### Activation events (`package.json`)

```
workspaceContains:**/*.pyne
workspaceContains:**/*.pine
workspaceContains:**/*.pinev5
workspaceContains:**/*.pinev6
```

Note: tests open a `pinescript` untitled doc to force activation; there is **no** `onLanguage:pinescript` in `activationEvents` today (language open still activates via VS Code language association once a `.pyne`/`.pine` file is present, but activation list is workspace-contains only).

### Contributes

**Languages**

- id: `pinescript`
- aliases: PYNE, pyne, pinescript, Pine
- extensions: `.pyne`, `.pine`, `.pinev5`, `.pinev6`, `.pinescript`
- configuration: `./language-configuration.json`
- grammar: `./syntaxes/pinescript.tmLanguage.json` (`source.pinescript`)
- snippets: `./snippets/pine.code-snippets`

**Themes**

- `AXIS Void` → `themes/axis-void-color-theme.json`
- `Hoox Signal` → `themes/hoox-signal-color-theme.json`
- `PYNE Volt` → `themes/pyne-volt-color-theme.json`

**Views / viewContainers / webviews**

- **None.** No TreeView, WebviewPanel, or custom sidebar.

**ConfigurationDefaults**

- `[pinescript]`: semantic highlighting on, bracket pair colorization, tabSize 4, spaces, wordBasedSuggestions off, defaultFormatter `hoox-sh.pyne`, insertFinalNewline

### Commands (`COMMANDS` in `src/extension.ts` + `contributes.commands`)

| Command id | Title |
|------------|-------|
| `pynescript.restartServer` | Restart Language Server |
| `pynescript.formatDocument` | Format Document |
| `pynescript.showLspOutput` | Show Language Server Output |
| `pynescript.showLspCommand` | Show Resolved LSP Launch Command |
| `pynescript.convertToV6` | Convert to Pine v6 |
| `pynescript.diagnosticsToggle` | Toggle Diagnostics |
| `pynescript.completionToggle` | Toggle Completion |
| `pynescript.inlayHintsToggle` | Toggle Inlay Hints |
| `pynescript.foldingToggle` | Toggle Folding |
| `pynescript.colorPreviewToggle` | Toggle Color Preview |
| `pynescript.toggleHover` | Toggle Hover |
| `pynescript.toggleSignatureHelp` | Toggle Signature Help |
| `pynescript.toggleSemanticTokens` | Toggle Semantic Tokens |
| `pynescript.toggleDocumentHighlight` | Toggle Document Highlight |
| `pynescript.toggleLinkedEditing` | Toggle Linked Editing |
| `pynescript.toggleSelectionRange` | Toggle Selection Range |
| `pynescript.toggleDocumentLink` | Toggle Document Links |
| `pynescript.toggleCodeAction` | Toggle Code Actions |
| `pynescript.toggleFormatOnSave` | Toggle Format on Save |
| `pynescript.openDocumentLink` | Open Document Link |
| `pynescript.runOnPro` | Run on Pro |
| `pynescript.installLanguageServer` | Install Language Server |
| `pynescript.installBackend` | Install Backend (Pro API) |
| `pynescript.startBackend` | Start Backend |
| `pynescript.testBackend` | Test Backend Connection |
| `pynescript.selectSyntax` | Select Syntax Highlighting (registered; also in commandPalette) |
| `pynescript.selectTheme` | present in `COMMANDS` const but workbench theme switching is **disabled** |

### Settings keys (`pynescript.*`)

**Appearance:** `syntaxHighlighting` (`none`\|`void`\|`signal`\|`volt`, default `void`)

**LSP:** `lsp.enabled`, `lsp.command` (default `auto`), `lsp.python` (default `python3`), `lsp.args`

**Editor features:** `formatting.enabled`, `formatOnSave.enabled`, `diagnostics.enabled`, `diagnostics.severity`, `diagnostics.style`, `diagnostics.semantic`, `completion.snippets`, `hover.enabled`, `inlayHints.parameters`, `signatureHelp.enabled`, `semanticTokens.enabled`, `documentHighlight.enabled`, `linkedEditing.enabled`, `selectionRange.enabled`, `documentLink.enabled`, `codeAction.enabled`

**Install:** `install.autoInstall`, `install.autoPrompt`, `install.package` (default `hoox-pyne[lsp]`), `install.python`, `install.args`, `install.createVenv`, `install.venv`

**Pro & backend:** `pro.enabled`, `pro.apiKey` (password, **plain settings storage**), `backend.url` (default `http://127.0.0.1:5002`), `backend.useHosted`, `backend.hostedUrl` (default `https://pynescript.online`), `backend.package` (default `hoox-pyne[pro,lsp]`), `backend.path`

### How it talks to LSP / Pro API

1. **Language server (stdio, never HTTP)**  
   - Client: `vscode-languageclient` `LanguageClient` id `pyne-lsp`  
   - Launch resolve (`resolveLspLaunch`): configured path → `pyne-lsp` PATH → `pynescript-lsp` PATH → `python -m pynescript.langserver`  
   - Docker mode: `lsp.command === "docker"` + `lsp.args` with `${workspaceFolder}` expansion  
   - `initializationOptions` / live `workspace/didChangeConfiguration` via `serverSettings()`: formatting, snippets, diagnostics, style/semantic diagnostics, inlayHintsParameters  
   - Client middleware gates hover/signature/highlights/selection/links/codeActions/semanticTokens/linkedEditing from settings without restart  
   - Document selector: `{ language: 'pinescript', scheme: 'file'|'untitled' }`  
   - Output channel: `PYNE Language Server`  
   - Status bar: `PYNE LSP` → `pynescript.showLspOutput`

2. **Pro API (plain `fetch`)**  
   - `resolveBackendUrl()`: hosted `backend.hostedUrl` if `backend.useHosted`, else `backend.url`  
   - `pynescript.runOnPro` → `POST {url}/run` with body `{ script, data: [one synthetic OHLCV bar], symbol: 'CHART', mode: 'auto' }`, optional `Authorization: Bearer {pro.apiKey}`  
   - `pynescript.testBackend` → `GET {url}/health`  
   - `pynescript.startBackend` → Terminal `python -m backend.app` from checkout with `backend/app.py`  
   - Install helpers: pip `hoox-pyne[lsp]` / `hoox-pyne[pro,lsp]`, PEP 668 venv under extension `globalStorageUri`

### Packaging

- Build: `esbuild.mjs` bundles `src/extension.ts` → `out/extension.js` (external `vscode`, CJS, node18, sourcemap)  
- Scripts: `compile`, `watch`, `package` → `npx @vscode/vsce package --no-dependencies --no-git-tag-version --out pyne-vscode-<ver>.vsix`  
- `vscode:prepublish` → compile  
- Dependency: only `vscode-languageclient ^11` (bundled into VSIX)

### Tests

- `/mnt/data/home/jango/Git/pynescript/vscode-extension/src/test/extension.test.ts`  
- `/mnt/data/home/jango/Git/pynescript/vscode-extension/src/test/runTest.ts`  
- Runner: `@vscode/test-electron` via `npm test` → `tsc` + compile + `node out/test/runTest.js`  
- Asserts package identity, all command ids, all setting keys, snippets, language extensions, activation, command registration

### Files that matter

```
/mnt/data/home/jango/Git/pynescript/vscode-extension/package.json
/mnt/data/home/jango/Git/pynescript/vscode-extension/src/extension.ts
/mnt/data/home/jango/Git/pynescript/vscode-extension/esbuild.mjs
/mnt/data/home/jango/Git/pynescript/vscode-extension/language-configuration.json
/mnt/data/home/jango/Git/pynescript/vscode-extension/syntaxes/pinescript.tmLanguage.json
/mnt/data/home/jango/Git/pynescript/vscode-extension/snippets/pine.code-snippets
/mnt/data/home/jango/Git/pynescript/vscode-extension/themes/{axis-void,hoox-signal,pyne-volt}-color-theme.json
/mnt/data/home/jango/Git/pynescript/vscode-extension/FEATURES.md
/mnt/data/home/jango/Git/pynescript/vscode-extension/README.md
/mnt/data/home/jango/Git/pynescript/vscode-extension/src/test/{extension.test.ts,runTest.ts}
/mnt/data/home/jango/Git/pynescript/vscode-extension/media/{icon.png,icon-512.png,header-tagline.png}
```

**Gap vs AXIS IDE:** PYNE ext is language-only (LSP + Run on Pro + themes). No chart, store, workers manager, library, drawings, MCP host, or webviews.

---

## 2. AXIS app surface map (IDE parity)

Stack (from shell memory + `docs/architecture/overview.mdx`): SolidJS + Vite + **TradingView lightweight-charts** + **CodeMirror 6** (not Monaco) + Tailwind 4 void theme + optional Tauri + MCP. Pine via PYNE (server / worker / Pyodide).

Entry: `src/index.tsx` → `src/app.tsx` (boot: `registerBuiltins`, `restoreInstalledPlugins`, load symbol, prefetch Pyodide, `startMcpHost`).

### 2.1 Editor — PWA vs VS Code TextEditor

| PWA surface | Path / exports | VS Code replacement |
|-------------|----------------|---------------------|
| CodeMirror host | `src/editor/PyneEditor.tsx` (`pyneScript`, `voidEditorExtensions`, `pyneLspExtensions`) | **Native TextEditor** + PYNE LSP (`hoox-sh.pyne`) |
| Pane chrome | `src/editor/EditorPane.tsx`, `tabbed-editor.tsx`, `EditorApp.tsx` | Editor groups / custom editor optional |
| Language intel | `pyne-lsp.ts`, `pyne-lsp-client.ts`, `editor-intel.ts`, `preevaluate.ts`, `diagnostics.ts` | Problems panel + PYNE middleware; AXIS pre-eval can stay optional host service |
| Outline / minimap | `function-outline.ts`, `FunctionOutline.tsx`, `minimap.ts`; store `editorRightRail` | VS Code Outline / Minimap |
| Format / convert | `pine-format.ts`, `pine-convert.ts` | PYNE Format / Convert to v6 |
| Builtins JSON | `src/editor/data/pyne-builtins.json` | Already used by LSP package; keep sync scripts |
| Run bridge | Mod-Enter → `onRun`; `editor-bridge.ts` popout | Command `axis.run` / reuse `indicators/runner.runAndApply` |
| Script logs | `ScriptLogsPane.tsx` | Output channel or Results webview |
| Problems UI | `src/ui/EditorProblems.tsx`, `editor-problems.ts` | **native Problems** |

**Verdict:** Editor buffer, diagnostics, completion, format, convert → **native VS Code + PYNE ext**. AXIS-specific run/profiler/inline-debug gutters either become decorations or stay webview-adjacent.

### 2.2 Chart / panes / toolbars / library / alerts / studio / MCP / plugins

| Surface | Primary modules | Native VS Code? | Webview? |
|---------|-----------------|-----------------|----------|
| Chart workspace | `src/chart/ChartWorkspace.tsx`, `ChartHost.tsx`, `pane-manager.ts`, `v1/chart-host.ts` | No (LWC + imperative DOM) | **Must webview** |
| Series / live append | `series-factory.ts`, `live-append.ts`, `heavy-data.ts` | No | Webview |
| Drawing toolbar | `DrawingToolbar.tsx`, `chart/drawings/**`, store `drawingUi` | Partial TreeView for tools list | **Must webview** for SVG overlay + LWC |
| Script drawings | `pyne-drawings.ts`, `indicators/apply-drawings.ts` | No | Webview |
| Results / strategy | `ui/ResultsModal.tsx`, `StrategyReport.tsx`, `EquityChart.tsx`, `results/*` | Output/WebviewView | Prefer webview (equity chart) |
| Indicator / Scripts panel | `indicators/IndicatorPanel.tsx`, `IndicatorCard.tsx` | TreeView possible | Optional |
| Library | `ui/ScriptLibraryPanel.tsx`, `ui/library/*` | TreeView + FS / SecretStorage backends | Optional chrome |
| Layers | `ui/LayerPanel.tsx`, `ui/layers/*` | TreeView | Optional |
| Alerts | `ui/AlertsPanel.tsx`, `src/alerts/*` (`engine.ts`, `tick.ts`, `webhook.ts`, …) | TreeView + notifications | Form in webview or QuickPick |
| DSM / Data | `ui/DataSourceManagerPanel.tsx`, `data/*` | TreeView jobs | Heavy UI webview |
| Watchlist / quote | `ui/Watchlist.tsx`, `ui/extras/quote.ts` (`displayedLastPrice`) | TreeView | Quote card can be status bar |
| Studio pages | `ui/studio/*` — Settings, Runtime, Wire, Workers, Plugins (`STUDIO_PAGES`) | Settings UI / Webview | Settings can be native config + webview for Wire |
| Workers Manager | `ui/workers/WorkersPage.tsx`, `src/workers/*` | TreeView + Terminal for install | Probe UI webview optional |
| MCP host | `src/mcp/*` — `startMcpHost`, `APP_CAPABILITIES`, bridge | **Native MCP** / contribute MCP provider; bridge needs live session | Host can run in extension host |
| Plugins Manager | `ui/plugins/PluginsPage.tsx`, `src/plugins/*` | TreeView + URL install | Config forms |
| Command palette | `ui/CommandPalette.tsx`, `ui/command-registry.ts` | **native Command Palette** | — |
| Topbar / status HUD | `ui/Topbar.tsx`, `StatusBar.tsx`, `ConnectionHud.tsx`, `McpHud.tsx` | StatusBarItem | — |
| System logs | `ui/SystemLogs.tsx` | **Output channel** | — |
| On-chain | `ui/OnChainPanel.tsx`, `src/onchain/*` | TreeView | Panel webview |
| Themes | `src/theme/*`, `ui/ThemePanel.tsx` | Workbench themes (PYNE already ships AXIS Void) | Chart theme in webview |

### 2.3 Store shape (`src/store`)

| File | Role |
|------|------|
| `src/store/types.ts` | `AppState`, `Bar`, `Pane`, `Indicator`, `ActivePlugins`, `DrawingUi`, `TelemetryState`, … |
| `src/store/index.ts` | Solid `createStore`; `STORAGE_KEY = 'pynescript.axis.v1'`; `persist` / `setLastRun` / `setActivePlugin` / notify |
| `src/store/live-frame.ts` | Live frame helpers |

Key `AppState` fields (persisted vs ephemeral per module header):

- Market: `symbol`, `interval`, `exchange`, `historyBars`, `rollingWindowBars`, `autoload`, `datasetPersistence`
- Plugins: `source`, `engine`, `endpoint`, `activePlugins`, `provider`, `pluginsConfig` (secrets stripped)
- Chart: `bars` (ephemeral), `chartDataGen`, `chartType`, panes, scales, `chartTheme`, `strategyUi`
- Scripts: `scripts: Indicator[]`, runResults / lastRun (focus rules in editor-results memory)
- Live: `live.active` hydrates false; `feeds`, `scriptStatus` ephemeral
- Panels: `editor`, `watchlist`, `indicatorPanel`, `layerPanel`, `alertsPanel`, `resultsPanel`, `logsPanel`, …
- Editor prefs: `editorRightRail`, `editorIntel`, profiler/inline-debug flags
- Telemetry / notifications / shortcuts / extras

For VS Code: map durable prefs → `workspaceState` / `globalState` / `SecretStorage`; keep reactive chart state inside webview or extension-host store mirroring `AppState`.

### 2.4 Worker / Pyodide / run pipeline entry points

| Concern | Path | Key exports |
|---------|------|-------------|
| Run pipeline | `src/indicators/runner.ts` | `runScript`, `runAndApply`, `probeEndpoint`, `RunOptions` |
| Apply slices | `apply-*.ts`, `reapply.ts`, `detach.ts`, `run-cache.ts` | chart apply |
| Engines | `src/engines/catalog.ts` | `serverEngine`, `pyneWorkerEngine`, `pyodideEngine`, `BUILTIN_ENGINES`, `LOCAL_PYODIDE_VERSION = '0.29.5'`, `DEFAULT_PYNE_WORKER_ENDPOINT` |
| Engine runner glue | `src/engines/runner.ts`, `engine-ws.ts`, `live-sessions.ts`, `data-sessions.ts` | WS `/ws/run`, sessions |
| Pyodide worker | `src/workers/pyodide.worker.ts`, `pyodide-runtime.ts`, `pyodide-client.ts`, `pyodide-protocol.ts` | in-browser Python |
| Assets | `public/pyodide/v0.29.5/`, `public/vendor/pynescript-*-py3-none-any.whl`, `pyodide/pynescript_runtime.py` | must ship or fetch |
| Sync scripts | `scripts/sync-pyne-wheel.sh`, `scripts/sync-pyne-builtins.sh`, `scripts/fetch-pyodide.sh` | keep versions aligned |
| Workers catalog | `src/workers/catalog.ts` | `LOCAL_AXIS_WORKER_BASE = http://127.0.0.1:8787`, `DEFAULT_PYNE_PRO_BASE`, `WORKER_CATALOG` |
| Probes | `src/workers/probe.ts` | `probeWorker`, `probeAllWorkers` |

### 2.5 MUST stay webview vs SHOULD use native VS Code

**MUST webview (or equivalent browser canvas)**

- Lightweight Charts host + multi-pane layout (`ChartHost` / `PaneManager` invariant: Solid must not reconcile pane root)
- Drawing SVG overlay + toolbar chrome over chart
- Equity curve / strategy visual report
- Pyodide WebWorker + COOP/COEP/wasm (if offline engine in-extension)
- Dense Solid studio Wire / architecture visualizer (optional)

**SHOULD native VS Code**

| Feature | VS Code API |
|---------|-------------|
| Pine editing | TextEditor + `hoox-sh.pyne` |
| Diagnostics | Problems / DiagnosticCollection |
| Script / system logs | OutputChannel |
| Library / layers / indicators / alerts lists | TreeView |
| Secrets (Worker `pn_`, Pro `pyn_`, git PAT) | **SecretStorage** (improve on PYNE plain-text `pro.apiKey`) |
| Backend / wrangler / pip | Terminal |
| Commands / shell layouts | commands + keybindings |
| Settings | `contributes.configuration` |
| MCP | MCP server definition / `axis mcp` CLI stdio |
| File open of `.pyne` | workspace FS (replace docked CodeMirror) |

---

## 3. Existing AXIS packages reusable by an extension

Under `/mnt/data/home/jango/Git/axis/packages/`:

### `@hoox-sh/axis-cli` (`packages/cli`)

- Version `0.3.6`, bin `axis` / `axis-cli`
- Commands (from `src/index.ts`): `install`, `doctor`, `setup`, `deploy`, `secrets`/`secret`, `health`, `prewarm`, `usage`, `keys`, `dev`, `whoami`, `mcp`
- Useful for extension: `axis mcp` stdio proxy, `axis doctor`/`health`, `axis keys`, `axis secret`
- Path: `/mnt/data/home/jango/Git/axis/packages/cli/`

### `@hoox-sh/axis-datafeed` (`packages/datafeed`)

- Version `0.1.0`, private Bun sidecar
- Mirrors PYNE datafeed gateway: `/datafeed/ohlcv`, `/datafeed/markets`, WS `/datafeed/watch`, session credentials, `/health`
- Default port `5003` (`DATAFEED_PORT`)
- Path: `/mnt/data/home/jango/Git/axis/packages/datafeed/`

### Not separate packages (but reusable modules)

These live in `src/` and are importable if the extension bundles them or hosts the PWA:

- `src/plugins/{registry,types,loader,bootstrap,active}.ts` — plugin contracts
- `src/engines/catalog.ts` — engines (server/worker/pyodide)
- `src/indicators/runner.ts` + builtins catalog
- `src/mcp/*` — capability catalog + dispatch (needs store hooks)
- `src/storage/vault.ts` — secret API shape (`putSecret`/`getSecret`/`forgetSecret`)
- `src/workers/*` — worker probe catalog
- `worker/` — Cloudflare Worker (deployed separately; not an npm package)
- `src-tauri/` — desktop precedent (webview host), not VS Code

Root `package.json` is private; no published `@hoox-sh/axis-core` yet — extension would either embed a built PWA webview (`dist/`) or extract shared TS modules into a new package.

---

## 4. Plugin / extension model AXIS already has

### Registry contract (`src/plugins/types.ts`)

Kinds: `source` | `stream` | `engine` | `storage` | `dataset` | `component` (phase 2 reserved)

Shared: `PluginBase` (`id`, `name`, `kind`, `configSchema`, `capabilities`, …)

| Kind | Required API |
|------|----------------|
| source | `fetchHistorical(SourceOpts) → Bar[]` |
| stream | `start(StreamOpts) → stop()` |
| engine | `family`, `isReady()`, `run(EngineOpts) → RunResult` |
| storage | `list/read/write/remove` (+ optional draft/version/results) |
| dataset | `fetchDataset` |
| component | `slots` + `mount` (manager-tab, results-tab, topbar-action, settings-section) |

`pluginKey(kind, id)` → `` `${kind}:${id}` ``

### Public API (`src/plugins/index.ts`)

Exports: `registry`, `PluginRegistry`, `ensureBuiltins`, `registerBuiltins`, `getActiveSource|Stream|Engine|Storage…`, `loadPluginFromUrl`, `restoreInstalledPlugins`, `removePlugin`, `getInstalledPlugins`, `PLUGINS_KEY`, storage service helpers.

### Persistence

- Installed dynamic plugins: `localStorage` key `pynescript.axis.plugins.v1` (see `plugins/README.md`)
- Active selection in store `activePlugins` + flat `source` / `engine` / `live.streamId`
- Examples under `public/plugins/`: `example-coingecko-source.js`, `example-tiny-pyne-engine.js`, `example-cf-do-stream.js`, `axis-pine-agent.js`

### Built-in catalogs

- Sources / streams / engines / storage / onchain registered via `registerBuiltins` → catalogs under `src/sources`, `src/streams`, `src/engines/catalog.ts`, `src/storage/catalog.ts`
- Script library builtins: `src/indicators/builtins/` — `BUILTIN_SCRIPTS`, `listBuiltinCategories`, `applyBuiltinScript`, categories (ma, oscillators, trend, volatility, volume, channels, pivots, strategies, drawings)
- Docs: `docs/plugins/{contracts,registry,sources,streams,engines,storage,datasets,dynamic-loader,pyne-agent}.mdx`

### Layers model

Docked Library (`ScriptLibraryPanel`) + Layers (`LayerPanel`): scripts, panes, overlays, on-chain, drawings; detach via `detachIndicatorFromChart` (not library delete alone).

---

## 5. Constraints (from memory topics + code)

### CSP (`axis-csp` + `public/_headers`)

- Enforced CSP: `script-src 'self' nonce wasm-unsafe-eval https://pyne-agent-worker.cryptolinx.workers.dev`
- `connect-src 'self' https: wss:` (+ localhost)
- `worker-src 'self' blob:`; COOP `same-origin`; COEP `credentialless`
- VS Code webview has its **own** CSP (`webview.cspSource`); embedding AXIS `dist/` needs a dedicated webview HTML CSP allowing LWC, workers, wasm, and connect to Pro/Worker/exchanges
- Cloudflare Page Shield Report-Only noise is PWA-hosting specific

### Secret vault (`axis-secret-vault` + `src/storage/vault.ts`)

- App state key: `pynescript.axis.v1` — **must strip** `apiKey` from `pluginsConfig` on persist
- Vault: memory → `sessionStorage` (`axis.session-secret.*`) → durable `localStorage` `axis.secret-vault.v1`
- API: `putSecret`, `getSecret`, `forgetSecret`
- Exchange CEX credentials: RAM-only
- MCP must not echo secrets
- **VS Code:** prefer `ExtensionContext.secrets` over PYNE’s plain `pynescript.pro.apiKey` setting

### Workers Manager (`axis-workers`)

- Local probe `LOCAL_AXIS_WORKER_BASE = http://127.0.0.1:8787`; `ERR_CONNECTION_REFUSED` expected when wrangler down
- Catalog covers AXIS Worker, PYNE Pro, Pyodide, SW, agent worker origins

### Quote last price (`axis-quote-price`)

- `displayedLastPrice` in `src/ui/extras/quote.ts`: last bar close unless stream plane `open` (then live tick); connecting/degraded/closed/error → bar close

### Library / layers (`axis-library-layers`)

- Library delete ≠ chart detach; layers order Scripts → Panes → Overlays → On-chain → Drawings; price pane visibility locked

### Editor results focus (`axis-editor-results`)

- `setLastRun(..., { focus })`: silent/live re-runs write `runResults` only; focused lastRun unchanged unless `focus:true`
- Results MCP `results.get` returns focus id’s lastRun, not necessarily `newestRunId`

### Drawing toolbar (`axis-drawing-toolbar`)

- Dock left/top/float; style bar independent; persist on `drawingUi`; chrome math `chart/drawings/toolbar/chrome.ts`

### Pyodide (`axis-pyodide`)

- Locked `LOCAL_PYODIDE_VERSION 0.29.5`; vendor numpy + `pynescript` wheel; bump filenames in `engines/catalog.ts`, `pyodide-runtime.ts`, tests

### PYNE API (`pynescript-api`)

- Live WS needs gunicorn **gthread**, workers=1; series key `exchange|market|SYMBOL|interval`; Pro keys `pyn_…`; AXIS Worker keys `pn_…`
- Extension Run-on-Pro is synthetic one-bar; full market/live is AXIS/datafeed/MCP territory

### Shell / license (`axis-shell`)

- AGPL-3.0-**only** for AXIS; lightweight-charts Apache-2.0; do not rebrand as TradingView; builtins are first-party Pine

### MCP (`axis-mcp`)

- In-app: `src/mcp` — `APP_CAPABILITIES`, bridge ticket (no `pn_` in query), Worker Streamable HTTP
- CLI: `axis mcp` / `axis mcp config`
- App-plane needs connected PWA tab; Worker-plane does not

---

## 6. Suggested AXIS VS Code extension shape (derived, not invented APIs)

1. **Depend on / recommend** `hoox-sh.pyne` for language surface (do not fork LSP).
2. **Contribute** webview editor/panel hosting chart+drawings (load AXIS build or shared runtime).
3. **Contribute** TreeViews: Library, Layers, Indicators, Alerts, Workers.
4. **Contribute** Output channels: AXIS System, AXIS Script Logs, AXIS Run.
5. **SecretStorage** for Worker/Pro/git keys; configuration for endpoints mirroring `pynescript.backend.*` + AXIS worker URL.
6. **Terminal** integration for `axis` CLI / local Pro / wrangler.
7. **MCP**: register `axis mcp` (and keep `pyne-mcp` for language agents).
8. Reuse `@hoox-sh/axis-cli` and optionally spawn `@hoox-sh/axis-datafeed`.

---

## Reuse matrix

| Feature | PWA module | VS Code native? | Webview? | PYNE ext overlap |
|---------|------------|-----------------|----------|------------------|
| Pine buffer edit | `editor/PyneEditor.tsx` (CM6) | **Yes** TextEditor | No | **Full** (`pinescript` lang + LSP) |
| Diagnostics / Problems | `editor/diagnostics.ts`, `ui/EditorProblems.tsx` | **Yes** Problems | No | **Full** |
| Format / Convert v6 | `pine-format.ts`, `pine-convert.ts` | **Yes** | No | **Full** (`formatDocument`, `convertToV6`) |
| Completions / hover / inlay | `pyne-lsp.ts`, `editor-intel.ts` | **Yes** | No | **Full** |
| Themes (void/signal/volt) | `theme/*`, `cm-void.ts` | **Yes** workbench + token colors | Chart tokens separate | **Full** contributed themes + `syntaxHighlighting` |
| Snippets | CM / palette | **Yes** | No | **Full** |
| Run script (batch) | `indicators/runner.ts` → engines | Command + Output | Results UI yes | **Partial** (`runOnPro` synthetic bar only) |
| Live `/ws/live` / series | `engines/live-sessions.ts`, streams | Extension host WS | Chart paint yes | **None** |
| Chart panes / LWC | `chart/ChartHost.tsx`, `pane-manager.ts` | No | **Must** | **None** |
| Drawing tools overlay | `DrawingToolbar.tsx`, `drawings/*` | Tool list TreeView optional | **Must** | **None** |
| Strategy report / equity | `ResultsModal`, `StrategyReport`, `EquityChart` | No | **Yes** | **None** |
| Script logs / Results focus | `ScriptLogsPane`, `setLastRun` | OutputChannel | Optional | **None** |
| Indicator list / cards | `IndicatorPanel.tsx` | TreeView | Optional | **None** |
| Script library | `ScriptLibraryPanel.tsx`, `storage/service.ts` | TreeView + FS | Optional | **None** |
| Layers panel | `LayerPanel.tsx` | TreeView | Optional | **None** |
| Alerts | `alerts/*`, `AlertsPanel.tsx` | TreeView + Notifications | Forms optional | **None** |
| Watchlist / quote | `Watchlist.tsx`, `extras/quote.ts` | TreeView / StatusBar | Optional | **None** |
| DSM / datasets | `DataSourceManagerPanel`, `data/*` | TreeView jobs | Heavy UI yes | **None** |
| Studio Settings | `ui/settings/SettingsPage.tsx` | **Yes** contributes.configuration | Complex tabs optional | **Partial** backend/pro keys |
| Runtime / Wire | `ui/runtime/*`, `ui/wire/*` | Partial | **Yes** for Wire | **None** |
| Workers Manager | `workers/*`, `ui/workers/*` | TreeView + Terminal | Optional | **Partial** (Install/Start Backend) |
| Plugin Manager | `plugins/*`, `PluginsPage.tsx` | TreeView | Config yes | **None** |
| Built-in scripts | `indicators/builtins/*` | TreeView data | Apply→webview | **None** |
| MCP host / bridge | `mcp/host.ts`, `bridge.ts`, `catalog.ts` | **Yes** MCP + CLI | Needs session | **Planned** pyne-mcp separate |
| Secret vault | `storage/vault.ts` | **Yes** SecretStorage | No | **Weak** (plain `pro.apiKey`) |
| Pyodide engine | `engines/catalog.ts` `pyodideEngine`, `workers/pyodide*` | Possible in webview/extension host | **Likely** | **None** |
| Server / pyne-worker engines | `serverEngine`, `pyneWorkerEngine` | Extension host fetch/WS | Chart yes | **Partial** Pro URL settings |
| AXIS CLI | `packages/cli` | Terminal / tasks | No | **None** (sister) |
| Local datafeed sidecar | `packages/datafeed` | Terminal spawn | No | **None** |
| CSP / wasm | `public/_headers` | Webview CSP | **Must configure** | N/A |
| Status HUD / Live chip | `StatusBar.tsx`, `hud-model.ts` | StatusBarItem | No | Status `PYNE LSP` only |
| Command palette intents | `CommandPalette.tsx` | **Yes** | No | PYNE commands only |
| Desktop shell precedent | `src-tauri/`, `src/desktop/` | — | Webview host pattern | **None** |

---

*End of inventory. All APIs and paths were read from the trees above; nothing invented.*
