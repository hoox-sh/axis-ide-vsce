---
type: "Document"
title: "AXIS task/plan conventions + VS Code trading-IDE prior art"
description: "Sources: .opencode/plans/ (esp. final/, data-plane-redesign-.mdx), .opencode/tmp/tasks/ (engine-redesign + live-session-status + aggregate schema scan), task-management skill…"
resource: "docs/plans/research/task-format-prior-art.md"
tags: [doc, docs, plans, research]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-06T03:02:18Z
sources:
  - id: tree
    resource: "docs/plans/research/task-format-prior-art.md"
    title: "docs/plans/research/task-format-prior-art.md"
    author: process:git
okf_lock: generated
---

# Source

Repo path `docs/plans/research/task-format-prior-art.md`.

# Outline

* JOB A — Task / plan file conventions
  * Layout (two layers)
  * MDX plan structure
  * task.json schema (feature root)
  * subtaskNN.json schema
  * Validation rules (from skill; enforce when authoring)
  * Authoring conventions distilled
* Prior Art
  * 1. Pine / trading language extensions (Marketplace + Open VSX)
  * 2. Chart-in-editor prior art (Lightweight Charts + webview)
  * 3. Jupyter-in-VS Code architecture (language + kernels + webview panels)
  * 4. Copilot Chat participants / AI surface
  * 5. Packaging: single VSIX vs extension pack vs extensionDependencies
  * 6. Webview + Lightweight Charts implementation checklist
  * 7. Packaging recommendation (concrete)
