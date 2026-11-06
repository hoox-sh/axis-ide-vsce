---
type: "Code Module"
title: "src/protocol"
description: "Schema version for every axis.webview.v1 envelope."
resource: "src/protocol"
tags: [code, protocol]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-06T03:02:18Z
sources:
  - id: tree
    resource: "src/protocol"
    title: "src/protocol"
    author: process:git
okf_lock: generated
---

# Files

* `codec.ts` — decode, encode, isHostToView, isViewToHost
* `index.ts` — ALL_MESSAGE_TYPES, HOST_TO_VIEW, HOST_TO_VIEW_TYPES, KNOWN_TYPES, PROTOCOL_ERROR_CODES, PROTOCOL_VERSION, SECTION_6_MESSAGE_TYPES, VIEW_TO_HOST, VIEW_TO_HOST_TYPES, WEBVIEW_VIEWS, WEBVIEW_VIEW_SET, decode
* `protocol.test.ts`
* `types.ts` — ALL_MESSAGE_TYPES, AxisEnvelope, ChartDeltaPayload, ChartDrawingApplyPayload, ChartFullPayload, ChartInitPayload, ChartPluginsPayload, ChartRequestReloadPayload, ChartThemePayload, ChartViewportPayload, DecodeErr, DecodeOk

# Packages

`bun:test`

# Used by

* [src/editors](/code/src/editors.md)
* [src/host](/code/src/host.md)
* [src/live](/code/src/live.md)
* [src/plugins](/code/src/plugins.md)
* [src/run](/code/src/run.md)
* [src/views](/code/src/views.md)
* [webview/shared](/code/webview/shared.md)
