---
type: "Code Module"
title: "src/live"
description: "src/live contains bridge.test.ts, bridge.ts, chart-fanout.test.ts, and 12 more files."
resource: "src/live"
tags: [code, live]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-09T00:22:47Z
sources:
  - id: tree
    resource: "src/live"
    title: "src/live"
    author: process:git
okf_lock: generated
---

# Files

* `bridge.test.ts`
* `bridge.ts` — LiveFrameHandler, LiveOutput, LiveSecrets, LiveSessionBridge, LiveSessionBridgeDeps, LiveStartResult, LiveStatusListener, LiveWebSocket, LiveWebSocketConstructor, createLiveSessionBridge, prepareLiveConnectUrl
* `chart-fanout.test.ts`
* `chart-fanout.ts` — LiveChartFanout, LiveChartFanoutDeps, LiveChartNotify, createLiveChartFanout
* `commands.test.ts`
* `commands.ts` — LIVE_COMMANDS, LiveCommandDisposable, LiveCommandHandlers, LiveCommandId, LiveCommandRegistrar, liveCommandHandlers, registerLiveCommands
* `frames.test.ts`
* `frames.ts` — NormalizedWireFrame, WireFrameKind, normalizeLiveFrame, seriesKeyFromFrameId, toChartDeltaPayload, toChartFullPayload
* `index.ts` — DEFAULT_WORKER_URL, LIVE_COMMANDS, LIVE_TICKET_TTL_S, LIVE_WS_PATH, LiveSessionBridge, LiveTicketError, MCP_BRIDGE_PATH, assertSafeLiveWsUrl, checkWorkerUrl, createLiveChartFanout, createLiveResumeStub, createLiveSessionBridge
* `resume.test.ts`
* `resume.ts` — LiveResumeReason, LiveResumeResult, LiveResumeStub, LiveResumeStubDeps, createLiveResumeStub
* `status.test.ts`
* `status.ts` — LiveHudInput, LiveHudState, LiveStatusLabel, LiveWireStatus, formatLiveStatus, resolveLiveHud
* `ticket.test.ts`
* `ticket.ts` — DEFAULT_WORKER_URL, LIVE_TICKET_TTL_S, LIVE_WS_PATH, LiveProxy, LiveTicketError, MCP_BRIDGE_PATH, MintLiveTicketOpts, assertSafeLiveWsUrl, checkWorkerUrl, isLiveTicketError, liveTicketRetryable, looksLikeWorkerEndpoint

# Other files

* `live-contributes.fragment.json`

# Packages

`bun:test`, `node:fs`, `node:path`

# Depends on

* [src/http](/code/src/http.md)
* [src/protocol](/code/src/protocol.md)
* [src/run](/code/src/run.md)
* [src/secrets](/code/src/secrets.md)

# Used by

* [src](/code/src.md)
* [src/mcp](/code/src/mcp.md)
