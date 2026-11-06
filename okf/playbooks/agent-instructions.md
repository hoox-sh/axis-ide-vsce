---
okf_lock: human
type: AgentInstructions
title: AXIS IDE — Agent Instructions
description: High-signal guidance for agents working in axis-ide-vsce. Every line answers 'Would an agent likely miss this without help?'.
resource: https://github.com/hoox-sh/axis-ide-vsce
tags: [agent, axis-ide, commands, constraints, security]
sources:
  - id: pkg
    title: package.json
    resource: ../../package.json
  - id: csp
    title: Webview CSP matrix
    resource: ../../docs/csp-matrix.md
  - id: design
    title: AXIS VS Code extension design
    resource: ../../docs/plans/axis-vscode-extension-design.md
  - id: publish
    title: Publishing guide
    resource: ../../PUBLISH.md
  - id: contrib
    title: Contributing guide
    resource: ../../CONTRIBUTING.md
  - id: agents-md
    title: Repository AGENTS.md
    resource: ../../AGENTS.md
---

# AXIS IDE — Agent Instructions

## Identity

This repo is **axis-ide-vsce**, the VS Code extension `hoox-sh.axis-ide`. It runs Pine Script™ / PYNE beside the editor with AXIS charts, results, profiler, live sessions, and MCP/Copilot tools. It hard-depends on `hoox-sh.pyne` (PYNE Language Support).[^pkg]

## Commands that prevent guessing

Use `bun run <script>` from the repo root. Do **not** use `bun --cwd <dir> run <script>` — current Bun can exit `0` without running.[^agents-md]

```bash
bun run check
bun run test:coverage:gate
bun run compile
bun run package
bun run lint
```

Single unit test:

```bash
bun test --isolate src/protocol/protocol.test.ts
```

## Order matters

```bash
bun run lint
bun run check
bun run test:coverage:gate
bun run compile
bun run package
```

## Electron test gotcha

`bun run test` runs `@vscode/test-electron`. It needs the `hoox-sh.pyne` VSIX installed into the downloaded VS Code. It looks for `pyne-vscode-*.vsix` in a sibling `pynescript`/`pyne` checkout by default. Override with `AXIS_IDE_PYNE_VSIX`. In CI it hard-fails without it.[^agents-md]

## Hard constraints

- Secrets (`pn_…` / `pyn_…`) live only in `ExtensionContext.secrets`. No settings, no logs, no fixtures, no webview messages.[^design]
- Worker key regex `/^pn_[a-f0-9]{48}$/`; Pro key shape `pyn_` + 20–508 `[A-Za-z0-9_-]`.[^pkg]
- Webviews are paint-only by default (`connect-src 'none'`). Host proxies all network.[^csp]
- Update `docs/csp-matrix.md` before any runtime CSP change. Only the chart webview widens, and only under `axis.engine.allowPyodide`.[^csp]
- Never invent `TV.*`, `TradingView.*`, `pine.*` APIs. Engine output kinds are exactly `plot`, `hline`, `bgcolor`, `plotshape`, `plotchar`, `plotarrow`.[^contrib]
- Native editor only for Pine; chart is a `CustomEditorProvider` on `*.axis.json`. Do not register a custom editor on `*.pyne`.[^design]
- No LSP fork; PYNE is an id-only `extensionDependencies` edge.[^pkg]
- License is AGPL-3.0-only; headers must say “version 3 only,” not “or later.”[^pkg]

## Security posture

- `axis.engine.allowRemoteEndpoint` is application-scope; workspace settings cannot enable remote Pro endpoints.[^pkg]
- `axis.mcp.command` and `axis.mcp.allowNpx` are application-scope; workspace settings cannot redirect the stdio child.[^pkg]
- Remote URLs require explicit user opt-in; default endpoints are loopback.[^design]

## Release checklist

1. Update `CHANGELOG.md` under `## [Unreleased]`.
2. Move Unreleased to `## [X.Y.Z] — YYYY-MM-DD` and bump `package.json` `version` (and `pack/package.json` if the pack changes).
3. Commit clean `main`.
4. Annotated tag: `git tag -a vX.Y.Z -m "AXIS IDE vX.Y.Z"`.
5. Release workflow builds both VSIX files and publishes IDE then pack when secrets exist.[^publish]

## Related concepts

- [design.md](/playbooks/design.md)
- [security-model.md](/playbooks/security-model.md)
- [build-pipeline.md](/playbooks/build-pipeline.md)
- [testing-strategy.md](/playbooks/testing-strategy.md)
