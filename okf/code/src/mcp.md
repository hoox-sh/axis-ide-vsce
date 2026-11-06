---
type: "Code Module"
title: "src/mcp"
description: "src/mcp contains lm-tools.test.ts, lm-tools.ts, provider.test.ts, and 3 more files."
resource: "src/mcp"
tags: [code, mcp]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-06T03:02:18Z
sources:
  - id: tree
    resource: "src/mcp"
    title: "src/mcp"
    author: process:git
okf_lock: generated
---

# Files

* `lm-tools.test.ts`
* `lm-tools.ts` — AxisRunScriptInput, ChartSnapshotMeta, HotLineSummary, LM_TOOL_NAMES, LastRunSummary, LmLogRow, LmRunScriptResult, LmToolName, LmToolsDeps, ProfilerLmPayload, ResultsFocusLmPayload, RunLogsLmPayload
* `provider.test.ts`
* `provider.ts` — MCP_COMMANDS, MCP_PROVIDER_ID, MCP_SOFT_FAIL_ACTION, MCP_SOFT_FAIL_MESSAGE, MCP_STDIO_LABEL, McpConfigReader, ProvideMcpDefinitionsDeps, SoftFailUi, buildMcpStdioArgs, buildMcpStdioEnv, formatMcpConfigSnippet, normalizeWorkerBaseUrl
* `resolve-cli.test.ts`
* `resolve-cli.ts` — AXIS_CLI_NAME, AXIS_CLI_NPX_PACKAGE, AxisCliResolution, ResolveAxisCliConfig, ResolveAxisCliOptions, WhichFn, defaultWhich, resolveAxisCli

# Other files

* `lm-tools-contributes.fragment.json`
* `mcp-contributes.fragment.json`

# Packages

`bun:test`, `node:child_process`, `node:fs`, `node:path`, `node:util`, `vscode`

# Depends on

* [src/live](/code/src/live.md)
* [src/run](/code/src/run.md)
* [src/secrets](/code/src/secrets.md)

# Used by

* [src](/code/src.md)
