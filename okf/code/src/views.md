---
type: "Code Module"
title: "src/views"
description: "src/views contains alerts-html.test.ts, alerts-html.ts, alerts-messages.test.ts, and 72 more files."
resource: "src/views"
tags: [code, views]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-06T03:02:18Z
sources:
  - id: tree
    resource: "src/views"
    title: "src/views"
    author: process:git
okf_lock: generated
---

# Files

* `alerts-html.test.ts`
* `alerts-html.ts` — AlertsHtmlOptions, buildAlertsWebviewHtml, escapeHtmlAttr, htmlHasInlineScript
* `alerts-messages.test.ts`
* `alerts-messages.ts` — ALERTS_NOTICE_ERROR, ALERTS_NOTICE_INFO, ALERTS_STUDIO_VIEW, AlertsAddArgs, alertsAddFromArgs, alertsIdFromArgs
* `alerts-panel.test.ts`
* `alerts-panel.ts` — ALERTS_STUDIO_VIEW_ID, AlertsStudioWebviewViewProvider, registerAlertsStudio
* `alerts-studio-model.test.ts`
* `alerts-studio-model.ts` — ALERTS_REMOVED, ALERTS_TITLE_REQUIRED, AlertsSnapshot, AlertsStudioEntry, buildAlertsSnapshot, formatAlertsSummary
* `alerts-studio.test.ts`
* `alerts-studio.ts` — buildAlertsStudioBody
* `alerts.test.ts`
* `alerts.ts` — ALERTS_ADD_COMMAND, ALERTS_REMOVE_COMMAND, ALERTS_STORAGE_KEY, ALERTS_VIEW_ID, AlertEntry, AlertTreeNode, AlertsTreeProvider, AlertsUi, EMPTY_ALERTS_V1, RegisterAlertsViewResult, WorkspaceStateHelpers, addAlert
* `colors-messages.test.ts`
* `colors-messages.ts` — COLORS_STUDIO_VIEW, ColorHit, ColorKind, ColorsStudioData, MAX_COLORS_COPY_TEXT, NAMED_COLOR_SWATCH, PINE_EDITOR_LANGUAGE_IDS, colorKind, colorsCopyTextFromArgs, colorsRevealLineFromArgs, colorsStudioData, isPineEditorLanguage
* `indicators.ts` — INDICATORS_VIEW_ID, IndicatorsTreeNode, IndicatorsTreeProvider, indicatorsRootChildren
* `layers-html.test.ts`
* `layers-html.ts` — buildLayersWebviewHtmlBody
* `layers-messages.test.ts`
* `layers-messages.ts` — LAYERS_ACTION_OPEN_CHART, LAYERS_SOURCE_CLOSED, LAYERS_SOURCE_OPEN, LAYERS_STUDIO_VIEW, LAYER_SECTION_EMPTY, LAYER_SECTION_ROLES, LAYER_SECTION_TITLES, LayerSectionTitle, LayersRow, LayersSection, LayersSnapshot, LayersSnapshotInput
* `layers-panel.test.ts`
* `layers-panel.ts` — LayersStudioProvider, registerLayersStudio
* `layers.ts` — LAYERS_VIEW_ID, LAYER_SECTION_ORDER, LayerSectionTitle, LayersTreeNode, LayersTreeProvider, layersRootChildren, layersSectionChildren
* `library-html.test.ts`
* `library-html.ts` — libraryStudioBody
* `library-messages.test.ts`
* `library-messages.ts` — LIBRARY_STUDIO_VIEW, LibraryCard, LibraryKind, LibraryStudioData, buildLibraryBody, parseLibraryActionArgs, toLibraryCards, toLibraryStudioData
* `library-panel.test.ts`
* `library-panel.ts` — LibraryWebviewViewProvider, registerLibraryStudio
* `library.ts` — LIBRARY_VIEW_ID, LibraryTreeNode, LibraryTreeProvider, libraryRootChildren
* `logs-messages.test.ts`
* `logs-messages.ts` — LOGS_EMPTY, LOGS_FILTERED_EMPTY, LOGS_STUDIO_VIEW, LOG_ROW_CAP, LogFilter, LogLevel, LogLevelCounts, LogRow, MAX_LOG_COPY_TEXT, attachLogsStore, buildLogsBody, countLogLevels
* `run-output-messages.test.ts`
* `run-output-messages.ts` — EMPTY_RUN_HINT, EMPTY_RUN_TITLE, ERROR_RUN_HINT, NO_RUN_FOCUSED, NO_STRATEGY_HINT, NO_STRATEGY_REPORT, RUN_OUTPUT_STUDIO_VIEW, RUN_OUTPUT_TITLE, RUN_OUTPUT_VIEW_ID, ResultsMetaChip, ResultsRow, ResultsStatus
* `run-output-studio.test.ts`
* `run-output-studio.ts` — RUN_OUTPUT_STUDIO_ID, RunOutputHostSurfaces, buildRunOutputStudioBody, createRunOutputRegistration, registerRunOutput
* `scripts-html.test.ts`
* `scripts-html.ts` — ScriptsHtmlOptions, buildScriptsWebviewHtml, escapeHtmlAttr, htmlHasInlineScript
* `scripts-messages.test.ts`
* `scripts-messages.ts` — SCRIPTS_APPLY_BUILTIN_COMMAND, SCRIPTS_EMPTY_RUN, SCRIPTS_OPEN_CHART_COMMAND, SCRIPTS_RUN_COMMAND, SCRIPTS_STUDIO_VIEW, SCRIPTS_STUDIO_VIEW_ID, SCRIPTS_SUGGESTION_MAX, ScriptRunCard, ScriptRunStatus, ScriptSuggestion, ScriptsSnapshot, ScriptsStudioData
* `scripts-panel.ts` — ResultsFocusLike, SCRIPTS_VIEW_ID, ScriptsStudioProvider, notifyScriptsStudio, pushScriptsRunCard, registerScriptsStudio
* `studio-html.test.ts`
* `studio-html.ts` — StudioHtmlOptions, buildStudioHtml, escapeHtmlAttr, htmlHasInlineScript
* `studio-provider.test.ts`
* `studio-provider.ts` — StudioContextLike, StudioProviderDeps, StudioViewHost, StudioViewProvider, StudioWebviewLike, StudioWebviewViewLike, registerStudioView
* `studio-registry.test.ts`
* `studio-registry.ts` — StudioRegistration, getStudio, listStudios, registerStudio
* `studio-router.test.ts`
* `studio-router.ts` — StudioActionContext, StudioActionHandler, StudioMessageRouter, StudioReadyHandler, StudioRoute, StudioRouterSink
* `symbols-messages.test.ts`
* `symbols-messages.ts` — AxisSymbol, MAX_SYMBOL_TEXT, SYMBOLS_STUDIO_VIEW, SYMBOL_CATEGORIES, SYMBOL_CATEGORY_LABELS, SymbolCategory, SymbolsStudioData, filterSymbols, isSymbolCategory, listSymbols, symbolCategoryLabel, symbolsStudioData
* `toolbox-messages.test.ts`
* `toolbox-messages.ts` — AxisSymbol, ColorHit, ColorKind, ColorsStudioData, MAX_COLORS_COPY_TEXT, MAX_SYMBOL_TEXT, NAMED_COLOR_SWATCH, PINE_EDITOR_LANGUAGE_IDS, SYMBOL_CATEGORIES, SYMBOL_CATEGORY_LABELS, SymbolCategory, SymbolsStudioData
* `toolbox-studio.test.ts`
* `toolbox-studio.ts` — TOOLBOX_STUDIO_TITLE, TOOLBOX_STUDIO_VIEW, TOOLBOX_STUDIO_VIEW_ID, ToolboxContextLike, ToolboxEditorLike, ToolboxInsertPositionLike, ToolboxInsertSelectionLike, ToolboxInsertTextEditorLike, ToolboxPanelDeps, ToolboxRegisterHost, ToolboxStudioData, ToolboxTab
* `trees.test.ts`
* `trees.ts` — INDICATORS_VIEW_ID, IndicatorsTreeProvider, LAYERS_VIEW_ID, LAYER_SECTION_ORDER, LIBRARY_VIEW_ID, LayersTreeProvider, LibraryTreeProvider, indicatorsRootChildren, layersRootChildren, layersSectionChildren, libraryRootChildren, registerAxisTreeViews
* `watchlist-html.test.ts`
* `watchlist-html.ts` — buildWatchlistWebviewHtmlBody
* `watchlist-messages.test.ts`
* `watchlist-messages.ts` — WATCHLIST_STUDIO_ACTIONS, WATCHLIST_STUDIO_VIEW, buildWatchlistBody, parseWatchlistSymbolArgs
* `watchlist-panel.test.ts`
* `watchlist-panel.ts` — WatchlistStudioOptions, WatchlistStudioProvider, registerWatchlistStudio
* `watchlist-studio-model.test.ts`
* `watchlist-studio-model.ts` — WATCHLIST_MOCK_CLOSE, WatchlistQuoteSource, WatchlistStudioRow, WatchlistStudioSnapshot, WatchlistStudioState, buildWatchlistSnapshot, normalizeWatchlistSymbol, parseWatchlistStudioState
* `watchlist.test.ts`
* `watchlist.ts` — EMPTY_WATCHLIST_V1, MOCK_PLACEHOLDER_CLOSE, QuoteFeed, QuoteStatusLabel, RegisterWatchlistResult, WATCHLIST_COMMANDS, WATCHLIST_STATE_KEY, WATCHLIST_VIEW_ID, WatchlistTreeNode, WatchlistTreeProvider, WatchlistUi, WatchlistV1
* `workers-html.test.ts`
* `workers-html.ts` — WorkersHtmlOptions, buildWorkersWebviewHtml, escapeHtmlAttr, htmlHasInlineScript
* `workers-messages.test.ts`
* `workers-messages.ts` — WORKERS_STUDIO_VIEW, WORKERS_STUDIO_VIEW_ID, WorkerStudioCard, WorkersStudioCounts, WorkersStudioHandlers, WorkersStudioSnapshot, WorkersStudioStatus, buildWorkersStudioBody, countsFromWorkerCards, parseWorkersStudioData, workersProbeIdFromArgs, workersStudioData
* `workers-panel.ts` — WORKERS_STUDIO_VIEW_ID, WorkersStudioWebviewProvider, registerWorkersStudio
* `workers-studio-model.test.ts`
* `workers-studio-model.ts` — WORKERS_STUDIO_STATUSES, WorkerStudioCard, WorkersStudioCounts, WorkersStudioSnapshot, WorkersStudioStatus, buildWorkersCards, countsFromWorkerCards, displayWorkerEndpoint, parseWorkersStudioData, shortWorkerErrorLabel, workersStudioSnapshot
* `workers.test.ts`
* `workers.ts` — PROBE_ALL_COMMAND, ProbeFetchLike, ProbeWorkerOpts, WORKERS_VIEW_ID, WORKER_CATALOG, WorkerCatalogEntry, WorkerHealthStatus, WorkerId, WorkerProbeResult, WorkerProbeStrategy, WorkerTreeNode, WorkersOverviewSnapshot

# Other files

* `alerts-contributes.fragment.json`
* `tree-contributes.fragment.json`
* `watchlist-contributes.fragment.json`

# Packages

`bun:test`, `node:fs`, `node:os`, `node:path`, `node:util`, `vscode`

# Depends on

* [src/editors](/code/src/editors.md)
* [src/host](/code/src/host.md)
* [src/protocol](/code/src/protocol.md)
* [src/run](/code/src/run.md)

# Used by

* [src](/code/src.md)
* [src/editors](/code/src/editors.md)
* [src/plugins](/code/src/plugins.md)
* [webview/alerts/src](/code/webview/alerts/src.md)
* [webview/workers/src](/code/webview/workers/src.md)
