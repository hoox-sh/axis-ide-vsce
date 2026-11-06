---
type: "Code Module"
title: "webview/scripts/src"
description: "AXIS Scripts studio on the shared runtime + studio. protocol."
resource: "webview/scripts/src"
tags: [code, scripts, webview]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-06T03:02:18Z
sources:
  - id: tree
    resource: "webview/scripts/src"
    title: "webview/scripts/src"
    author: process:git
okf_lock: generated
---

# Role

AXIS Scripts studio on the shared runtime + studio. protocol. Host posts studio.init / studio.set with data { snapshot }; buttons post studio.action run / openChart / apply; notices arrive as studio.notice. UI is built entirely from ax- components on the client. The host shell (scripts-html.ts) only needs to provide scripts-root; the original ids and classes it emits are replaced on first render.

# Files

* `main.ts`
* `protocol.ts` — SCRIPTS_VIEW, ScriptRunCard, ScriptRunStatus, ScriptSuggestion, ScriptsStudioState, ScriptsViewSnapshot, decodeScriptsStudioData, decodeScriptsStudioNotice, encodeScriptsApply, encodeScriptsOpenChart, encodeScriptsReady, encodeScriptsRun

# Other files

* `style.css`

# Packages

`@axis-shared/components`, `@axis-shared/studio`

# Depends on

* [webview/shared](/code/webview/shared.md)
