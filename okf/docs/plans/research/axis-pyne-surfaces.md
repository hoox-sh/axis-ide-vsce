---
type: "Document"
title: "AXIS VS Code extension — surface inventory"
description: "Workspace roots: /mnt/data/home/jango/Git/axis, /mnt/data/home/jango/Git/pynescript/vscode-extension."
resource: "docs/plans/research/axis-pyne-surfaces.md"
tags: [doc, docs, plans, research]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-06T03:02:18Z
sources:
  - id: tree
    resource: "docs/plans/research/axis-pyne-surfaces.md"
    title: "docs/plans/research/axis-pyne-surfaces.md"
    author: process:git
okf_lock: generated
---

# Source

Repo path `docs/plans/research/axis-pyne-surfaces.md`.

# Outline

* 1. PYNE vscode-extension inventory
  * Activation events (package.json)
  * Contributes
  * Commands (COMMANDS in src/extension.ts + contributes.commands)
  * Settings keys (pynescript.)
  * How it talks to LSP / Pro API
  * Packaging
  * Tests
  * Files that matter
* 2. AXIS app surface map (IDE parity)
  * 2.1 Editor — PWA vs VS Code TextEditor
  * 2.2 Chart / panes / toolbars / library / alerts / studio / MCP / plugins
  * 2.3 Store shape (src/store)
  * 2.4 Worker / Pyodide / run pipeline entry points
  * 2.5 MUST stay webview vs SHOULD use native VS Code
* 3. Existing AXIS packages reusable by an extension
  * @hoox-sh/axis-cli (packages/cli)
  * @hoox-sh/axis-datafeed (packages/datafeed)
  * Not separate packages (but reusable modules)
* 4. Plugin / extension model AXIS already has
  * Registry contract (src/plugins/types.ts)
  * Public API (src/plugins/index.ts)
  * Persistence
  * Built-in catalogs
  * Layers model
* 5. Constraints (from memory topics + code)
  * CSP (axis-csp + public/headers)
  * Secret vault (axis-secret-vault + src/storage/vault.ts)
  * Workers Manager (axis-workers)
  * Quote last price (axis-quote-price)
  * Library / layers (axis-library-layers)
  * Editor results focus (axis-editor-results)
  * Drawing toolbar (axis-drawing-toolbar)
  * Pyodide (axis-pyodide)
  * PYNE API (pynescript-api)
  * Shell / license (axis-shell)
  * MCP (axis-mcp)
* 6. Suggested AXIS VS Code extension shape (derived, not invented APIs)
* Reuse matrix

# Mentions

* [scripts](/code/scripts.md)
* [src](/code/src.md)
* [src/mcp](/code/src/mcp.md)
* [src/plugins](/code/src/plugins.md)
* [src/test](/code/src/test.md)
