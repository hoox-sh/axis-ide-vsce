---
type: "Code Module"
title: "src/host"
description: "src/host contains apply-builtin.test.ts, apply-builtin.ts, builtins.test.ts, and 25 more files."
resource: "src/host"
tags: [code, host]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-09T00:22:47Z
sources:
  - id: tree
    resource: "src/host"
    title: "src/host"
    author: process:git
okf_lock: generated
---

# Files

* `apply-builtin.test.ts`
* `apply-builtin.ts` — APPLY_BUILTIN_COMMAND, APPLY_BUILTIN_EMPTY_MESSAGE, APPLY_BUILTIN_LOAD_FAILED_PREFIX, ApplyBuiltinResult, ApplyBuiltinStatus, ApplyBuiltinUi, BuiltinQuickPickItem, builtinQuickPickItems, registerApplyBuiltin, runApplyBuiltin
* `builtins.test.ts`
* `builtins.ts` — BUILTIN_CATALOG_RELATIVE, BUILTIN_CATALOG_SCHEMA, BuiltinCatalog, BuiltinCatalogEntry, BuiltinKind, CatalogLoadErr, CatalogLoadOk, CatalogLoadResult, ReadFileUtf8, builtinCatalogPath, filterBuiltinCatalog, getBuiltinById
* `chart-session.test.ts`
* `chart-session.ts` — CHART_HANDSHAKE_SEQ, CHART_HISTORY_SEQ, ChartSessionOptions, ChartSessionSnapshot, SeriesKeyFields, buildChartSession, buildSeriesKey, resolveMockBarCount
* `history-client.test.ts`
* `history-client.ts` — DATAFEED_TIMEOUT_MS, DEFAULT_DATAFEED_URL, FetchHistoricalRequest, FetchHistoricalResult, HistoryFetchLike, REMOTE_DATAFEED_DENIED, checkDatafeedUrl, fetchHistorical, mapDatafeedBar, mapDatafeedBars
* `inline-debug-decorations.ts` — registerInlineDebugDecorations
* `inline-debug.test.ts`
* `inline-debug.ts` — INLINE_DEBUG_CHIP_MAX, INLINE_DEBUG_MAX_ANNOTATIONS, InlineDebugAnnotation, InlineDebugLevel, InlineDebugSource, collectInlineDebug, parseSourceLine, redactInlineDebugText, truncateInlineDebugChip
* `logger.test.ts`
* `logger.ts` — LogSink, isDebugProtocol, logDebug, logError, logInfo, logProtocolReject, logWarn, resetLoggerForTests, setDebugProtocol, setLogSink
* `mock-bars.test.ts`
* `mock-bars.ts` — GenerateMockBarsOptions, MOCK_BARS_CAP, MOCK_BARS_DEFAULT, MOCK_BARS_END_TIME, OhlcvBar, clampMockBarCount, createPrng, generateMockBars, hashSeed, intervalToSeconds
* `open-chart.test.ts`
* `open-chart.ts` — OPEN_CHART_NO_PINE_MESSAGE, OPEN_CHART_VIEW_COLUMN_BESIDE, PINE_FILE_SUFFIXES, PINE_LANGUAGE_ID, SiblingChartOptions, defaultChartDocumentForPine, isPineFilePath, openChartEditorOptions, planSiblingChartOpen, serializeSiblingChartDocument, siblingAxisJsonPath
* `profile-lines.test.ts`
* `profile-lines.ts` — ProfileLineStat, formatPct, hotProfileLineNumbers, normalizeProfileLines, profileLineTooltip
* `profiler-decorations.ts` — registerProfilerDecorations
* `pyodide-profile.test.ts`
* `pyodide-profile.ts` — ALLOW_PYODIDE_SETTING, LOCAL_PYODIDE_VERSION, PYODIDE_CALCULATOR_PROFILE, PyodideEngineProfile, PyodideRuntimeStatus, isPyodideAllowed, pyodideRuntimeStatus
* `quote.test.ts`
* `quote.ts` — QuoteSnapshot, displayedLastPrice, formatQuotePrice, resolveDisplayedQuotePrice, streamAllowsLivePrice
* `run-on-save.test.ts`
* `run-on-save.ts` — DEFAULT_RUN_ON_SAVE, RUN_ON_SAVE_MODES, RunOnSaveMode, parseRunOnSave
* `series-key.test.ts`
* `series-key.ts` — CatalogSymbol, FALLBACK_PAIR_CATALOG, SeriesKeyFields, buildSeriesKey, currentSeriesKey, pairFormSymbol, parseSeriesKey

# Other files

* `apply-builtin-contributes.fragment.json`

# Packages

`bun:test`, `node:fs`, `node:path`, `vscode`

# Depends on

* [src/editors](/code/src/editors.md)
* [src/http](/code/src/http.md)
* [src/protocol](/code/src/protocol.md)
* [src/run](/code/src/run.md)

# Used by

* [src](/code/src.md)
* [src/editors](/code/src/editors.md)
* [src/plugins](/code/src/plugins.md)
* [src/run](/code/src/run.md)
* [src/test](/code/src/test.md)
* [src/views](/code/src/views.md)
