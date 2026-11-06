---
type: "Code Module"
title: "src/editors"
description: "src/editors contains chart-document.test.ts, chart-document.ts, chart-drawings.test.ts, and 10 more files."
resource: "src/editors"
tags: [code, editors]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-06T03:02:18Z
sources:
  - id: tree
    resource: "src/editors"
    title: "src/editors"
    author: process:git
okf_lock: generated
---

# Files

* `chart-document.test.ts`
* `chart-document.ts` — AxisChartDocV1, AxisChartPaneV1, CHART_SCHEMA, CHART_VIEW_TYPE, HISTORY_BARS_MIN, ParseChartErr, ParseChartOk, ParseChartResult, defaultChartDocument, normalizeChartDocument, parseChartDocument, serializeChartDocument
* `chart-drawings.test.ts`
* `chart-drawings.ts` — ChartDrawingPoint, CommittedTrendlineDrawing, DRAWING_TOOL_TRENDLINE, DrawingToolId, appendDrawingToDoc, isUserDrawingBatch, normalizeCommittedDrawing, normalizeDrawingPoint, normalizeUserDrawings
* `chart-editor.ts` — AxisChartDocument, ChartEditorProviderOptions, registerChartEditorProvider
* `chart-full-roundtrip.test.ts`
* `chart-html.test.ts`
* `chart-html.ts` — ChartHtmlOptions, buildChartCspDirectives, buildChartWebviewHtml, escapeHtmlAttr, htmlHasInlineScript
* `chart-live-doc.test.ts`
* `chart-live-doc.ts` — ChartLiveDocInput, ChartLiveDocListener, ChartLiveDocSnapshot, clearChartLiveDoc, getChartLiveDoc, mergeChartDoc, setChartLiveDoc, subscribeChartLiveDoc
* `chart-messages.test.ts`
* `chart-messages.ts` — CHART_INIT_CSS_VAR_KEYS, ChartHandshakeSession, ChartMessageHandle, buildChartInitStub, copyChartPlugins, defaultChartCssVars, handleChartWebviewMessage
* `webview-protocol.test.ts`

# Other files

* `drawings-contributes.fragment.json`

# Packages

`bun:test`, `node:fs`, `node:path`, `vscode`

# Depends on

* [src/host](/code/src/host.md)
* [src/plugins](/code/src/plugins.md)
* [src/protocol](/code/src/protocol.md)
* [src/run](/code/src/run.md)
* [src/views](/code/src/views.md)
* [webview/chart/src](/code/webview/chart/src.md)

# Used by

* [src](/code/src.md)
* [src/host](/code/src/host.md)
* [src/plugins](/code/src/plugins.md)
* [src/run](/code/src/run.md)
* [src/test](/code/src/test.md)
* [src/views](/code/src/views.md)
