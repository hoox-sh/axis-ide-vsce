---
type: "Code Module"
title: "src/plugins/views"
description: "src/plugins/views contains component.test.ts, component.ts, dataset.test.ts, and 9 more files."
resource: "src/plugins/views"
tags: [code, plugins, views]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-06T03:02:18Z
sources:
  - id: tree
    resource: "src/plugins/views"
    title: "src/plugins/views"
    author: process:git
okf_lock: generated
---

# Files

* `component.test.ts`
* `component.ts` — ACTIVATE_PLUGIN_COMMAND, COMPONENT_PLUGINS_VIEW_ID, ComponentPluginTreeNode, ComponentPluginsTreeProvider, KindViewDeps, componentRootChildren, registerComponentPluginsView
* `dataset.test.ts`
* `dataset.ts` — ACTIVATE_PLUGIN_COMMAND, DATASET_PLUGINS_VIEW_ID, DatasetPluginTreeNode, DatasetPluginsTreeProvider, KindViewDeps, datasetRootChildren, registerDatasetPluginsView
* `engine.test.ts`
* `engine.ts` — ACTIVATE_PLUGIN_COMMAND, ENGINE_PLUGINS_VIEW_ID, EnginePluginTreeNode, EnginePluginsTreeProvider, KindViewDeps, PLUGIN_KIND_VIEW_IDS, engineRootChildren, readAllowPyodide, registerEnginePluginsView
* `source.test.ts`
* `source.ts` — KindViewDeps, SOURCE_PLUGINS_VIEW_ID, SourcePluginTreeNode, SourcePluginsTreeProvider, registerSourcePluginsView
* `storage.test.ts`
* `storage.ts` — ACTIVATE_PLUGIN_COMMAND, KindViewDeps, PLUGIN_KIND_VIEW_IDS, STORAGE_PLUGINS_VIEW_ID, StoragePluginTreeNode, StoragePluginsTreeProvider, registerStoragePluginsView, storageRootChildren
* `stream.test.ts`
* `stream.ts` — KindViewDeps, STREAM_PLUGINS_VIEW_ID, StreamPluginTreeNode, StreamPluginsTreeProvider, registerStreamPluginsView

# Other files

* `dataset-component-contributes.fragment.json`
* `engine-storage-contributes.fragment.json`
* `source-stream-contributes.fragment.json`

# Packages

`bun:test`, `node:fs`, `node:path`, `vscode`

# Depends on

* [src/plugins](/code/src/plugins.md)
