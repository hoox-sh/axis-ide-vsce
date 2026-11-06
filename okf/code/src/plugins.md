---
type: "Code Module"
title: "src/plugins"
description: "Plugins registry host + Workers probe registration."
resource: "src/plugins"
tags: [code, plugins]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-06T03:02:18Z
sources:
  - id: tree
    resource: "src/plugins"
    title: "src/plugins"
    author: process:git
okf_lock: generated
---

# Files

* `activate-command.test.ts`
* `activate-command.ts` — ACTIVATE_PLUGIN_COMMAND, ActivatePluginArg, parseActivatePluginArg, registerActivatePluginCommand, runActivatePluginCommand
* `active.test.ts`
* `active.ts` — ACTIVE_PLUGINS_WORKSPACE_STATE_KEY, ActivePluginsV1, DEFAULT_ACTIVE_PLUGINS_V1, WorkspaceStateHelpers, createMemoryWorkspaceState, isActivePlugin, parseActivePluginsV1, readActivePlugins, workspaceStateFromContext, writeActivePlugin
* `builtins.ts` — BUILTIN_COMPONENT_IDS, BUILTIN_DATASET_IDS, BUILTIN_ENGINE_IDS, BUILTIN_PLUGIN_DESCRIPTORS, BUILTIN_SOURCE_IDS, BUILTIN_STORAGE_IDS, BUILTIN_STREAM_IDS, builtinIdsForKind
* `events.test.ts`
* `events.ts` — ActivePluginsListener, ChartPluginIds, chartPluginsFromActive, notifyActivePlugins, resetActivePluginsEventsForTests, subscribeActivePlugins
* `index.test.ts`
* `index.ts` — ACTIVATE_PLUGIN_COMMAND, ACTIVE_PLUGINS_WORKSPACE_STATE_KEY, ActivePluginsListener, ActivePluginsV1, BUILTIN_ENGINE_IDS, BUILTIN_PLUGIN_DESCRIPTORS, BUILTIN_SOURCE_IDS, ChartPluginIds, DEFAULT_ACTIVE_PLUGINS_V1, EMPTY_PLUGINS_V1, GlobalStateHelpers, HostPluginRegistry
* `kind-tree-model.test.ts`
* `kind-tree-model.ts` — ACTIVATE_PLUGIN_COMMAND, KindViewDeps, PLUGIN_KIND_VIEW_IDS, PluginKindViewId
* `kind-views.test.ts`
* `kind-views.ts` — KindViewRegistrar, bindKindViewDeps, callKindViewRefresh, registerPluginKindViews, safeCallKindViewRegistrar
* `persist.ts` — createMemoryGlobalState, parsePluginsV1, readPluginsV1, sanitizeInstalledPluginMeta, writePluginsV1
* `plugins-html.test.ts`
* `plugins-html.ts` — PluginsHtmlOptions, buildPluginsWebviewHtml, escapeHtmlAttr, htmlHasInlineScript
* `plugins-messages.test.ts`
* `plugins-messages.ts` — DEFAULT_PLUGINS_FLAGS, PLUGINS_STUDIO_VIEW, PLUGINS_STUDIO_VIEW_ID, PLUGIN_KIND_ROLES, PluginCard, PluginCardExtra, PluginsFlags, PluginsInitData, PluginsStateData, PluginsStudioHandlers, buildPluginCards, buildPluginsStudioBody
* `plugins-panel.test.ts`
* `plugins-panel.ts` — PLUGINS_WEBVIEW_VIEW_ID, PluginsWebviewViewProvider, readPluginsFlags, registerPluginsWebviewView
* `plugins-webview-ui.test.ts`
* `registry.test.ts`
* `registry.ts` — HostPluginRegistry, PLUGIN_KINDS, _resetHostPluginRegistryForTests, builtinIdsForKind, ensureBuiltinsRegistered, getHostPluginRegistry, pluginKey
* `status-bar.test.ts`
* `status-bar.ts` — BuildStatusMenuOptions, FormatPluginsStatusTextOptions, PLUGINS_STATUS_BAR_ID, PLUGINS_STATUS_BAR_NAME, PLUGINS_STATUS_BAR_PRIORITY, PLUGINS_STATUS_FLASH_MS, PLUGINS_STATUS_MENU_COMMAND, PLUGINS_STATUS_MENU_IDS, PluginsStatusMenuId, PluginsStatusMenuItem, RefreshPluginsStatusBarOptions, _resetPluginsStatusBarForTests
* `tree-model.ts` — PLUGINS_VIEW_ID, PluginTreeNode, pluginsKindChildren, pluginsRootChildren
* `tree.ts` — PLUGINS_VIEW_ID, PluginsTreeProvider, pluginsKindChildren, pluginsRootChildren, registerPluginsTreeView
* `types.ts` — ACTIVE_PLUGINS_WORKSPACE_STATE_KEY, ActivePluginsV1, DEFAULT_ACTIVE_PLUGINS_V1, EMPTY_PLUGINS_V1, GlobalStateHelpers, InstalledPluginMeta, PLUGINS_GLOBAL_STATE_KEY, PLUGIN_KINDS, PluginDescriptor, PluginKind, WorkspaceStateHelpers, pluginKey

# Other files

* `kind-views-contributes.fragment.json`
* `plugins-workers-contributes.fragment.json`
* `status-bar-contributes.fragment.json`

# Packages

`bun:test`, `node:fs`, `node:os`, `node:path`, `vscode`

# Depends on

* [src/editors](/code/src/editors.md)
* [src/host](/code/src/host.md)
* [src/protocol](/code/src/protocol.md)
* [src/views](/code/src/views.md)
* [webview/plugins/src](/code/webview/plugins/src.md)

# Used by

* [src](/code/src.md)
* [src/editors](/code/src/editors.md)
* [src/plugins/views](/code/src/plugins/views.md)

# Nested

* [src/plugins/views](/code/src/plugins/views.md)
