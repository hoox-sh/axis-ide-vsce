---
type: "Code Module"
title: "webview/runoutput/src"
description: "Run Output studio webview on the shared runtime + studio. protocol."
resource: "webview/runoutput/src"
tags: [code, runoutput, webview]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-06T03:02:18Z
sources:
  - id: tree
    resource: "webview/runoutput/src"
    title: "webview/runoutput/src"
    author: process:git
okf_lock: generated
---

# Role

Run Output studio webview on the shared runtime + studio. protocol. Host posts studio.init / studio.set with view:'runoutput' and a composite data payload containing the Summary, Strategy, Profiler and Logs tabs. The active tab is owned client-side; switching emits no host action. View → host actions: copyId, focusRun, revealProfilerLine, copyRunId, revealLogLine, copyLogText.

# Files

* `main.ts`

# Other files

* `style.css`

# Packages

`@axis-shared/components`, `@axis-shared/studio`, `@axis-shared/studio-protocol`

# Depends on

* [webview/runoutput/src/tabs](/code/webview/runoutput/src/tabs.md)

# Nested

* [webview/runoutput/src/tabs](/code/webview/runoutput/src/tabs.md)
