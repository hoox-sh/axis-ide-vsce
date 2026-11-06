---
type: "Code Module"
title: "webview/library/src"
description: "AXIS Library studio on the shared runtime + studio. protocol: studio.ready → studio.init / studio.set carrying { cards, catalogError }."
resource: "webview/library/src"
tags: [code, library, webview]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-06T03:02:18Z
sources:
  - id: tree
    resource: "webview/library/src"
    title: "webview/library/src"
    author: process:git
okf_lock: generated
---

# Role

AXIS Library studio on the shared runtime + studio. protocol: studio.ready → studio.init / studio.set carrying { cards, catalogError }. Card click copies the id (1.2s "Copied"). Apply posts studio.action apply. Renderers are built from ax- components via ./render.

# Files

* `main.ts`
* `protocol.ts` — LIBRARY_VIEW, LibraryViewState, decodeLibrarySet, encodeLibraryApply, encodeLibraryCopy, encodeLibraryReady
* `render.ts` — LibraryHandlers, buildLibraryView, kindSvg, libraryMarkSvg, searchSvg
* `state.ts` — COPY_FLASH_MS, CategoryOption, LibraryCard, LibraryKind, LibraryKindFilter, LibraryViewState, PersistedLibraryUi, applyCatalog, categoryKey, categoryOptions, clearFilters, filteredCards

# Other files

* `style.css`

# Packages

`@axis-shared/clipboard`, `@axis-shared/components`, `@axis-shared/studio`, `@axis-shared/studio-protocol`
