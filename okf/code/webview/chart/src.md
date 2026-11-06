---
type: "Code Module"
title: "webview/chart/src"
description: "AXIS chart webview: ready handshake → chart.init / chart.full / chart.delta."
resource: "webview/chart/src"
tags: [chart, code, webview]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-06T03:02:18Z
sources:
  - id: tree
    resource: "webview/chart/src"
    title: "webview/chart/src"
    author: process:git
okf_lock: generated
---

# Files

* `drawings.ts` — ChartPoint, CoordAdapter, DrawingOverlay, TOOL_TRENDLINE, TrendlinePlacer, createDrawingOverlay, createLwcCoordAdapter, createTrendlinePlacer, nextDrawingId
* `main.ts`
* `paint.ts` — ChartPainter, chartLayoutOptions, createChartPainter
* `protocol.ts` — PROTOCOL_VERSION, WebviewDecodeErr, WebviewDecodeOk, WebviewDecodeResult, decodeHostMessage, pickChartInitFields
* `state.ts` — ChartBar, ChartPlotLine, ChartPlugins, ChartReduceOutcome, ChartViewState, UserDrawing, applyChartHostMessage, classifyDeltaSeq, initialChartState, isUserDrawingBatch, mergeBarTail, normalizeBar

# Other files

* `style.css`

# Packages

`lightweight-charts`

# Used by

* [src/editors](/code/src/editors.md)
