---
type: "Document"
title: "AXIS IDE — VS Code Extension Design"
description: "AXIS today is a SolidJS + Vite charting PWA (/mnt/data/home/jango/Git/axis) that runs Pine Script™ via PYNE engines (Pro API, Cloudflare Worker, Pyodide), paints TradingView…"
resource: "docs/plans/axis-vscode-extension-design.md"
tags: [axis-vscode-extension-design, doc, docs, plans]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-06T03:02:18Z
sources:
  - id: tree
    resource: "docs/plans/axis-vscode-extension-design.md"
    title: "docs/plans/axis-vscode-extension-design.md"
    author: process:git
okf_lock: generated
---

# Source

Repo path `docs/plans/axis-vscode-extension-design.md`.

# Outline

* Overview
* Background & Motivation
  * Current state
  * Pain points this solves
  * Evidence cited
* Goals & Non-Goals
  * Goals
  * Non-Goals
* Key Decisions
* Proposed Design
  * 1. Packaging topology
  * 2. Architecture (host ↔ webview ↔ engines)
  * 3. UI mapping (native-first)
  * 4. Activation & lifecycle
  * 5. Chart document model
  * 6. Message protocol axis.webview.v1
  * 7. Run sequence
  * 7.1 Results focus rules (normative)
  * 8. Live tick sequence
  * 9. Plugins on the host
  * 10. Pyodide / calculator profile (later phase)
* API / Interface Changes
  * Exact package.json contribution sketches
  * Host public commands (stable ids)
  * MCP provider behavior + CLI resolution (KD-9)
  * LM tools registration sketch
* Data Model Changes
  * Extension state
  * Migration strategy
  * No VS Code settings.json secrets
* Alternatives Considered
  * A1. Single combined VSIX (PYNE LSP + AXIS IDE)
  * A2. Embed full AXIS PWA dist/ in one WebviewPanel
  * A3. Custom editor default on .pyne (visual + text)
  * A4. New Chat Participant @axis
  * A5. Extract @hoox-sh/axis-runtime on day one
  * A6. NotebookController + custom NotebookRenderer for backtest MIME
  * A7. Separate git repository for vscode-axis-ide
* Security & Privacy Considerations
  * Threat model (abridged)

# Mentions

* [scripts](/code/scripts.md)
* [src](/code/src.md)
* [src/editors](/code/src/editors.md)
* [src/host](/code/src/host.md)
* [src/mcp](/code/src/mcp.md)
* [src/plugins](/code/src/plugins.md)
* [src/test](/code/src/test.md)
* [src/views](/code/src/views.md)
