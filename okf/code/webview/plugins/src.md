---
type: "Code Module"
title: "webview/plugins/src"
description: "AXIS Plugins studio on the shared runtime + studio. protocol."
resource: "webview/plugins/src"
tags: [code, plugins, webview]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-06T03:02:18Z
sources:
  - id: tree
    resource: "webview/plugins/src"
    title: "webview/plugins/src"
    author: process:git
okf_lock: generated
---

# Role

AXIS Plugins studio on the shared runtime + studio. protocol. Host posts studio.init (catalog + active + flags) / studio.set (active + flags); the view posts studio.ready and studio.action activate.

# Files

* `main.ts`
* `protocol.ts` — ActivePluginsMap, KIND_TABS, KindTab, PLUGINS_VIEW, PLUGIN_KINDS, PluginCard, PluginExtra, PluginKind, PluginsFlags, PluginsStudioState, decodePluginsStudioMessage, encodePluginsActivate
* `render.ts` — escapeHtml, kindIconNode, kindIconSvg, pluginsViewHtml, renderActiveChips, renderPluginCard, renderPluginsBody
* `state.ts` — ACTIVATE_FLASH_CLASS, ACTIVATE_FLASH_MS, ActiveChip, COPIED_LABEL, COPY_FLASH_MS, COPY_ID_LABEL, ClassListLike, CopyFlash, EMPTY_KIND_COPY, ExtraFact, FilterCount, FlashTextTarget

# Other files

* `style.css`

# Packages

`@axis-shared/components`, `@axis-shared/dom`, `@axis-shared/studio`

# Depends on

* [webview/shared](/code/webview/shared.md)

# Used by

* [src/plugins](/code/src/plugins.md)
