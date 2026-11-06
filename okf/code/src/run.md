---
type: "Code Module"
title: "src/run"
description: "Resolve bars + seriesKey for a run from an optional sibling chart doc (PR-06b)."
resource: "src/run"
tags: [code, run]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-06T03:02:18Z
sources:
  - id: tree
    resource: "src/run"
    title: "src/run"
    author: process:git
okf_lock: generated
---

# Files

* `chart-bus.test.ts`
* `chart-bus.ts` — ChartDeltaNotify, ChartFullNotify, ChartNotifyHandler, ChartNotifyMessage, getLastChartFull, notifyChart, resetChartBusForTests, subscribeChartNotify
* `endpoint.test.ts`
* `endpoint.ts` — BAD_ENDPOINT_SCHEME, EndpointCheck, HttpBaseUrlOptions, REMOTE_ENDPOINT_DENIED, checkEngineEndpoint, checkHttpBaseUrl
* `engine-http.test.ts`
* `engine-http.ts` — DEFAULT_ENGINE_ENDPOINT, ENGINE_REMOTE_DENIED, ENGINE_RUN_TIMEOUT_MS, EngineCompileDiagnostic, EngineHttpRequest, EngineRunResult, FetchLike, MISSING_API_KEY_ERROR, MISSING_ENDPOINT_ERROR, RunMode, barsForPine, combineAbortSignals
* `index.ts` — BAD_ENDPOINT_SCHEME, DEFAULT_ENGINE_ENDPOINT, MISSING_API_KEY_ERROR, MISSING_ENDPOINT_ERROR, MISSING_PRO_KEY_ERROR, ProfilerStore, REMOTE_ENDPOINT_DENIED, ResultsFocusStore, RunOrchestrator, UNSUPPORTED_ENGINE_ERROR, attachProfiler, barsForPine
* `orchestrator.test.ts`
* `orchestrator.ts` — MISSING_PRO_KEY_ERROR, RunDeps, RunDiagnostic, RunDiagnostics, RunMode, RunOrchestrator, RunOutcome, RunOutput, RunRequest, RunSecrets, UNSUPPORTED_ENGINE_ERROR
* `profiler-store.test.ts`
* `profiler-store.ts` — ProfilerHotLine, ProfilerListener, ProfilerPhase, ProfilerRunInput, ProfilerSnapshot, ProfilerStore, attachProfiler, countPlots, countSeries, encodeProfilerSet, pickPhases, profileLineCount
* `results-store.test.ts`
* `results-store.ts` — MAX_RUN_RESULTS, PublishInput, ResultsFocusChangeReason, ResultsFocusListener, ResultsFocusSnapshot, ResultsFocusStore, RunResultRecord, copyRunRecord, pickStrategyReport
* `run-context.test.ts`
* `run-context.ts` — ResolveRunContextResult, ResolvedRunContext, RunContextSettings, resolveRunContext
* `scrub.test.ts`
* `scrub.ts` — scrubSecrets

# Packages

`bun:test`

# Depends on

* [src/editors](/code/src/editors.md)
* [src/host](/code/src/host.md)
* [src/protocol](/code/src/protocol.md)
* [src/secrets](/code/src/secrets.md)

# Used by

* [src](/code/src.md)
* [src/editors](/code/src/editors.md)
* [src/host](/code/src/host.md)
* [src/live](/code/src/live.md)
* [src/mcp](/code/src/mcp.md)
* [src/views](/code/src/views.md)
