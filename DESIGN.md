---
type: Design
title: AXIS IDE Design
scope: axis-ide-vsce VS Code extension and AXIS Trading Pack
description: High-level design of the AXIS IDE VS Code extension — architecture, package boundaries, host↔webview protocol, security model, build pipeline, and testing strategy.
resource: https://github.com/hoox-sh/axis-ide-vsce
tags: [design, axis-ide, vscode-extension, architecture, security]
sources:
  - id: pkg
    title: package.json
    resource: ./package.json
  - id: design
    title: AXIS VS Code extension design document
    resource: ./docs/plans/axis-vscode-extension-design.md
  - id: csp
    title: Webview CSP matrix
    resource: ./docs/csp-matrix.md
  - id: publish
    title: Publishing guide
    resource: ./PUBLISH.md
  - id: agents
    title: Agent instructions
    resource: ./AGENTS.md
  - id: vscode-api
    title: Visual Studio Code Extension API
    resource: https://code.visualstudio.com/api/references/vscode-api
  - id: vscode-lmtools
    title: VS Code language model tools
    resource: https://code.visualstudio.com/api/extension-guides/ai/tools
  - id: vscode-mcp
    title: VS Code MCP server definition providers
    resource: https://code.visualstudio.com/api/extension-guides/ai/mcp
  - id: vsce
    title: VSCE packaging and publishing
    resource: https://github.com/microsoft/vscode-vsce
---

# DESIGN — AXIS IDE

## Purpose

AXIS IDE brings the AXIS charting workflow into VS Code: run Pine Script™ / PYNE scripts beside the editor, render charts, results, and profiler data, and orchestrate live sessions. The extension is the bridge between the editor, the PYNE engine, and the AXIS runtime surfaces.

## Scope

- Repository root: VS Code extension `hoox-sh.axis-ide`.
- `pack/`: optional extension pack `hoox-sh.axis` that bundles PYNE Language Support + AXIS IDE.
- Out of scope: the PYNE language engine (`hoox-sh/pyne`), the AXIS charting PWA (`hoox-sh/axis`), and the HOOX execution mesh (`hoox-sh/hooX`). This extension consumes them over documented interfaces.

## Package boundaries

| Package | Path | Extension id | Manifest edge |
|---------|------|--------------|---------------|
| AXIS IDE | repository root | `hoox-sh.axis-ide` | `extensionDependencies: ["hoox-sh.pyne"]` |
| AXIS Trading Pack | `pack/` | `hoox-sh.axis` | `extensionPack: ["hoox-sh.pyne", "hoox-sh.axis-ide"]` |

The pack VSIX is manifest-only; it does not rebundle PYNE or the IDE.[^publish]

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                        VS Code host                           │
│  src/extension.ts                                             │
│    ├─ commands (run, open chart, secrets, live, plugins, …)  │
│    ├─ custom editor provider for axis.chart                 │
│    ├─ TreeView / WebviewView providers                      │
│    ├─ run orchestration + Pro HTTP + datafeed proxy          │
│    ├─ SecretStorage-backed keys + status bar                │
│    └─ MCP server definition provider + LM tools              │
└───────────────────┬─────────────────────────────────────────┘
                    │ axis.webview.v1 envelopes (typed)
┌───────────────────▼─────────────────────────────────────────┐
│                     Webview studios                           │
│  webview/<studio>/ — one Vite project per studio            │
│    ├─ chart                                                        │
│    ├─ results   (shared results + strategy panels)                 │
│    ├─ plugins / library / layers / scripts / watchlist / alerts  │
│    ├─ workers / colors / symbols / logs / profiler                 │
│    └─ paint-only CSP; host proxies network                         │
└─────────────────────────────────────────────────────────────┘
```

### Host bundle

- Entry: `src/extension.ts`.
- Bundler: esbuild to `out/extension.js` as CommonJS, platform `node`, target `node18`. `vscode` is external.
- The host intentionally stays in `out/`; webviews intentionally build to `dist/webview/`.

### Webview bundles

- One Vite config per studio under `webview/<studio>/vite.config.ts`.
- Each studio produces `dist/webview/<studio>/main.js` and `main.css`.
- `.vscodeignore` allowlists only those two files per studio; source maps and directories are excluded from the VSIX.[^pkg]

### Host↔webview protocol

`src/protocol/` defines typed envelopes for `axis.webview.v1`. All messages between host and webviews pass through this codec. Protocol files are coverage-gated at **100%** because a single drift breaks both sides of the contract.[^agents]

## Entry points and activation

`package.json` declares `main: ./out/extension.js` and activation through:

- `onCustomEditor:axis.chart`
- `workspaceContains:**/*.axis.json`, `*.pyne`, `*.pine`, `*.pinev5`, `*.pinev6`, `*.pinescript`
- Explicit commands and view ids.

No `onStartupFinished` event is used.[^pkg]

## Execution flow

1. **Open chart**: `axis.openChart` creates or opens a sibling `*.axis.json` next to the active Pine file (e.g. `rsi.pyne` → `rsi.axis.json`).[^design]
2. **Run script**: `axis.runScript` (Ctrl/Cmd+Enter on `pinescript`) sends the buffer to the configured Pro engine endpoint (`axis.engine.endpoint`). By default the engine receives bars from the local datafeed (`axis.datafeed.url`). With `axis.chart.useMockBars` true, deterministic fixture bars are used instead.
3. **Live session**: `axis.liveStart` mints a ticket via `GET /api/ws/live?issue=ticket` and upgrades to a WebSocket at `/api/ws/live?ticket=…`.[^design]
4. **Results focus**: runs publish summaries to the Results / Strategy panels; `axis.focusResults` retargets the active run.

## Security model

### Secrets

API keys are **never** extension settings. They live in `vscode.ExtensionContext.secrets`:

- Worker key: `/^pn_[a-f0-9]{48}$/`
- Pro key: `pyn_` + 20–508 `[A-Za-z0-9_-]`

Validation happens before storage. Empty input clears a slot. Output channels redact key prefixes.[^design]

### Network posture

- Pro endpoint and datafeed default to loopback (`http://127.0.0.1:5002` / `:5003`). Remote URLs require the application-scope setting `axis.engine.allowRemoteEndpoint`.[^pkg]
- `axis.mcp.command` and `axis.mcp.allowNpx` are application-scope; workspace settings cannot redirect the stdio child.[^pkg]

### Webview CSP

Webviews are paint-only. Default CSP:

- `default-src 'none'`
- `script-src ${webview.cspSource}`
- `style-src ${webview.cspSource} 'unsafe-inline'`
- `img-src ${webview.cspSource} data: blob:`
- `connect-src 'none'`

The host is the only network caller. Chart CSP widens only for the optional Pyodide calculator under `axis.engine.allowPyodide`.[^csp]

## MCP / Copilot integration

- `src/mcp/` implements an `McpServerDefinitionProvider` that advertises an AXIS CLI stdio server when `axis.mcp.stdio` is true.[^vscode-mcp]
- `contributes.languageModelTools` defines five tools (`axis_run_script`, `axis_get_results_focus`, `axis_chart_snapshot_meta`, `axis_get_run_logs`, `axis_get_profiler`) registered at runtime with `vscode.lm.registerTool`.[^vscode-lmtools]
- Both features feature-detect `lm.registerMcpServerDefinitionProvider` / `lm.registerTool` and soft-fail on older VS Code builds.

## Build and packaging

```bash
bun run compile      # host esbuild + all Vite webviews
bun run package      # VSIX via @vscode/vsce --no-dependencies
bun run pack:package # pack VSIX
```

`--no-dependencies` is used because `node_modules` is excluded from the VSIX. Runtime dependencies (e.g. `lightweight-charts`) are bundled by Vite into the chart webview.[^vsce]

## Testing strategy

| Layer | Tool | Notes |
|-------|------|-------|
| Unit | `bun:test --isolate` | Host code, protocol codecs, stores, helpers |
| Coverage gate | `scripts/check-coverage.mjs` | Protocol 100%; pure-host scoped files at BASELINE (currently 100%) |
| Integration | `@vscode/test-electron` | Requires PYNE VSIX; runs under `src/test/` |

CI runs the coverage gate and the electron suite under xvfb, then builds both VSIX files on `main`, tags, and dispatch.[^publish]

## Cross-references

| Product | Repo | Public docs |
|---------|------|-------------|
| HOOX | `hoox-sh/hoox` | `docs.hoox.sh` |
| PYNE | `hoox-sh/pyne` | `hoox.sh/pyne/docs` |
| AXIS PWA | `hoox-sh/axis` | `hoox.sh/axis/docs` |
