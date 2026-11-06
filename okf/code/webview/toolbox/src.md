---
type: "Code Module"
title: "webview/toolbox/src"
description: "Toolbox studio webview on the shared runtime + studio. protocol."
resource: "webview/toolbox/src"
tags: [code, toolbox, webview]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-06T03:02:18Z
sources:
  - id: tree
    resource: "webview/toolbox/src"
    title: "webview/toolbox/src"
    author: process:git
okf_lock: generated
---

# Role

Toolbox studio webview on the shared runtime + studio. protocol. Host posts studio.init / studio.set with view:'toolbox' and a composite data payload { activeTab, tabs: { colors, symbols } }. The active tab is owned client-side; switching emits a studio.action selectTab to the host and persists through setState. View → host actions: selectTab, revealColorLine, copyColorText, refreshColors, insertSymbol, copySymbolText.

# Files

* `main.ts`

# Other files

* `style.css`

# Packages

`@axis-shared/components`, `@axis-shared/studio`, `@axis-shared/studio-protocol`

# Depends on

* [webview/toolbox/src/tabs](/code/webview/toolbox/src/tabs.md)

# Nested

* [webview/toolbox/src/tabs](/code/webview/toolbox/src/tabs.md)
