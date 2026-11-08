---
okf_lock: human
type: Design
title: AXIS IDE — Design
description: Architecture, package boundaries, host↔webview protocol, execution flow, and MCP/Copilot integration for axis-ide-vsce.
resource: https://github.com/hoox-sh/axis-ide-vsce
tags: [design, architecture, vscode-extension, axis-ide]
sources:
  - id: pkg
    title: package.json
    resource: ../../package.json
  - id: design-doc
    title: AXIS VS Code extension design document
    resource: ../../docs/plans/axis-vscode-extension-design.md
  - id: csp
    title: Webview CSP matrix
    resource: ../../docs/csp-matrix.md
  - id: publish
    title: Publishing guide
    resource: ../../PUBLISH.md
  - id: agents-md
    title: Repository AGENTS.md
    resource: ../../AGENTS.md
  - id: design-md
    title: Repository DESIGN.md
    resource: ../../DESIGN.md
---

# AXIS IDE — Design

## Purpose

Bridge VS Code, the PYNE Pine engine, and AXIS runtime surfaces so traders can author, run, and visualize Pine scripts inside the editor.

## Package boundaries

| Package | Path | Id | Notes |
|---------|------|-----|-------|
| AXIS IDE | repo root | `hoox-sh.axis-ide` | Hard-depends on `hoox-sh.pyne`. |
| AXIS Trading Pack | `pack/` | `hoox-sh.axis-pack` | `extensionPack` of PYNE + IDE. Manifest-only. |

## Architecture

```text
VS Code host (src/)
  ├─ extension.ts — activation
  ├─ editors/ — CustomEditorProvider for axis.chart
  ├─ run/ — Pro HTTP, orchestration, results/profiler stores
  ├─ live/ — Worker ticket + WebSocket bridge
  ├─ host/ — HistoryClient, builtins, mock bars
  ├─ views/ — TreeViews + WebviewView panels
  ├─ plugins/ — plugin registry, studios, status bar
  ├─ mcp/ — MCP provider + LM tools
  ├─ secrets/ — SecretStorage UX
  └─ protocol/ — axis.webview.v1 typed envelopes
        │
        └─→ Webview studios (webview/<studio>/, Vite-vanilla)
```

The host is bundled by esbuild to `out/extension.js` as CommonJS. Each webview studio has its own Vite project producing `dist/webview/<studio>/main.{js,css}`.[^pkg]

## Execution flow

1. `axis.openChart` creates/opens a sibling `*.axis.json` next to the active Pine file.[^design-doc]
2. `axis.runScript` (Ctrl/Cmd+Enter on pinescript) POSTs the buffer to the Pro engine endpoint with bars from the datafeed or mock bars.[^pkg]
3. `axis.liveStart` mints a ticket via `GET /api/ws/live?issue=ticket` and upgrades to `/api/ws/live?ticket=…`.[^design-doc]
4. Results/strategy panels reflect the focused run.

## Activation events

Declared in `package.json`: `onCustomEditor:axis.chart`, `workspaceContains` globs for `*.axis.json` / `*.pyne` / `*.pine*` / `*.pinescript`, plus commands and view ids. No `onStartupFinished`.[^pkg]

## Host↔webview protocol

`src/protocol/` defines `axis.webview.v1` envelopes. Protocol files are coverage-gated at **100%** because drift breaks both sides of the contract.[^agents-md]

## MCP / Copilot

- `src/mcp/` registers an `McpServerDefinitionProvider` advertising an AXIS CLI stdio server.
- `contributes.languageModelTools` defines five tools registered with `vscode.lm.registerTool`.
- Both feature-detect VS Code API availability and soft-fail on older builds.[^pkg]

## Related concepts

- [security-model.md](/playbooks/security-model.md)
- [build-pipeline.md](/playbooks/build-pipeline.md)
- [testing-strategy.md](/playbooks/testing-strategy.md)
