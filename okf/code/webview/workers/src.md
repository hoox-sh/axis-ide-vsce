---
type: "Code Module"
title: "webview/workers/src"
description: "AXIS Workers studio on the shared runtime + studio. protocol."
resource: "webview/workers/src"
tags: [code, webview, workers]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-06T03:02:18Z
sources:
  - id: tree
    resource: "webview/workers/src"
    title: "webview/workers/src"
    author: process:git
okf_lock: generated
---

# Role

AXIS Workers studio on the shared runtime + studio. protocol. Host posts studio.init / studio.set with data { cards, counts, probed }; buttons post studio.action probe / probeAll.

# Files

* `main.ts`
* `protocol.ts` — WORKERS_STUDIO_VIEW, WorkerStudioCard, WorkersStudioCounts, WorkersStudioSnapshot, WorkersStudioState, decodeWorkersStudioData, encodeWorkersProbe, encodeWorkersProbeAll, encodeWorkersReady

# Other files

* `style.css`

# Packages

`@axis-shared/components`, `@axis-shared/dom`, `@axis-shared/studio`

# Depends on

* [src/views](/code/src/views.md)
* [webview/shared](/code/webview/shared.md)
