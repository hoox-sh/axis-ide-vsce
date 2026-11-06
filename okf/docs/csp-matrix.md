---
type: "Document"
title: "AXIS IDE webview CSP matrix"
description: "Audit against design KD-6 / CSP matrix (Task 25 + Task 27). Do not widen runtime CSP."
resource: "docs/csp-matrix.md"
tags: [csp-matrix, doc, docs]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-06T03:02:18Z
sources:
  - id: tree
    resource: "docs/csp-matrix.md"
    title: "docs/csp-matrix.md"
    author: process:git
okf_lock: generated
---

# Source

Repo path `docs/csp-matrix.md`.

# Outline

* Enforced (chart + all panel/activity webviews) — default
* vs AXIS PWA (public/headers)
* Optional widen (axis.engine.allowPyodide — off by default)

# Mentions

* [src/editors](/code/src/editors.md)
* [src/host](/code/src/host.md)
* [src/views](/code/src/views.md)
