---
type: "Document"
title: "Research Brief: Newest VS Code Extension APIs for AXIS IDE"
description: "Scope: Build a full “AXIS IDE” inside VS Code (chart panes, results/strategy panes, custom editors, webviews, proposed APIs)."
resource: "docs/plans/research/vscode-apis.md"
tags: [doc, docs, plans, research]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-06T03:02:18Z
sources:
  - id: tree
    resource: "docs/plans/research/vscode-apis.md"
    title: "docs/plans/research/vscode-apis.md"
    author: process:git
okf_lock: generated
---

# Source

Repo path `docs/plans/research/vscode-apis.md`.

# Outline

* 1. Custom Editors API — when to use vs WebviewPanel
  * API surface (stable)
  * Custom Editor vs WebviewPanel
* 2. WebviewView vs WebviewPanel vs Custom Editor
* 3. Proposed / stable APIs (selected)
  * Notebook controllers & renderers — stable
  * Chat participants — deprecated for new Copilot work (2026)
  * Language Model Tools — stable (vscode.lm)
  * MCP in VS Code — full spec support (2025+), extension registration finalized
  * Multi-root workspace — stable
  * Auxiliary window / editor groups — stable UX since 1.85; API via open targets
  * Status bar — stable
  * TreeView — stable
  * Test API — stable (since 1.59)
  * Terminal API — stable (+ shell integration)
  * SecretStorage — stable
  * AuthenticationProvider — stable
* 4. Extension packing
* 5. Newest UX patterns (workbench)
* 6. Webview performance & security constraints
* 7. Recommended testing
* Recommended stack for AXIS IDE extension

# Mentions

* [scripts](/code/scripts.md)
