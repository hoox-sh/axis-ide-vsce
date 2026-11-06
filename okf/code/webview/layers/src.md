---
type: "Code Module"
title: "webview/layers/src"
description: "AXIS Layers webview on the shared runtime + studio. protocol."
resource: "webview/layers/src"
tags: [code, layers, webview]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-06T03:02:18Z
sources:
  - id: tree
    resource: "webview/layers/src"
    title: "webview/layers/src"
    author: process:git
okf_lock: generated
---

# Role

AXIS Layers webview on the shared runtime + studio. protocol. Built with ax- components: the top header uses ax-header, each section is an ax-panel, rows are ax-row, and empty sections use ax-empty. Open chart posts studio.action openChart (old layers.openChart).

# Files

* `main.ts`
* `protocol.ts` — LAYERS_ACTION_OPEN_CHART, LAYERS_VIEW, decodeLayersSet, encodeLayersOpenChart, encodeLayersReady
* `render.ts` — LayersDom, buildTopHeader, paintLayers, queryLayersDom, renderSections
* `state.ts` — LAYER_TITLES, LayerTitle, LayersRowView, LayersSectionView, LayersViewState, SOURCE_CLOSED, SOURCE_OPEN, coerceSnapshot, initialLayersView

# Other files

* `style.css`

# Packages

`@axis-shared/components`, `@axis-shared/studio`, `@axis-shared/studio-protocol`
