---
type: AgentInstructions
title: AXIS IDE — Agent Guide
scope: axis-ide-vsce repository
description: Compact, high-signal guidance for AI agents working on the AXIS IDE VS Code extension.
resource: https://github.com/hoox-sh/axis-ide-vsce
tags: [agent, axis-ide, vscode-extension, pine, pyne]
sources:
  - id: pkg
    title: package.json
    resource: ./package.json
  - id: csp
    title: Webview CSP matrix
    resource: ./docs/csp-matrix.md
  - id: design
    title: AXIS VS Code extension design
    resource: ./docs/plans/axis-vscode-extension-design.md
  - id: publish
    title: Publishing guide
    resource: ./PUBLISH.md
  - id: contrib
    title: Contributing guide
    resource: ./CONTRIBUTING.md
  - id: vscode-api
    title: Visual Studio Code Extension API
    resource: https://code.visualstudio.com/api/references/vscode-api
  - id: vscode-webview
    title: VS Code Webview guide
    resource: https://code.visualstudio.com/api/extension-guides/webview
  - id: vsce
    title: VSCE packaging and publishing
    resource: https://github.com/microsoft/vscode-vsce
---

# AGENTS.md — AXIS IDE

Compact guide for AI agents working in **axis-ide-vsce**.

## What this is

**AXIS IDE** (`hoox-sh.axis-ide`) is a VS Code extension that runs Pine Script™ / PYNE beside the editor with AXIS charts, results, profiler, activity-bar studios, live sessions, and MCP/Copilot tooling. It hard-depends on **PYNE Language Support** (`hoox-sh.pyne`) and is part of the HOOX open trading stack.

The optional **AXIS Trading Pack** (`hoox-sh.axis`) lives in `pack/`.

## Quick commands

Use **`bun run <script>`** from the repository root. Do **not** use `bun --cwd <dir> run <script>` — on current Bun it can exit `0` without executing.

```bash
bun install
bun run compile                 # esbuild host + all Vite webviews
bun run compile:webview         # webviews only
bun run watch                   # host esbuild watch
bun run check                   # tsc host + every webview
bun run lint                    # biome check (linter only; formatter disabled)
bun run test:unit               # bun:test --isolate
bun run test:coverage:gate      # coverage + BASELINE/protocol ratchet
bun run test                    # @vscode/test-electron (needs PYNE VSIX)
bun run package                 # → axis-ide-<ver>.vsix
bun run pack:package            # → pack/axis-<ver>.vsix
bun run verify                  # check + coverage gate
```

Run a single unit file:

```bash
bun test --isolate src/protocol/protocol.test.ts
```

Electron tests need `hoox-sh.pyne` installed into the downloaded VS Code. By default they glob `pyne-vscode-*.vsix` from a sibling `pynescript` / `pyne` checkout. Override with `AXIS_IDE_PYNE_VSIX=/path/to/pyne-vscode-….vsix`. In CI (`CI` / `GITHUB_ACTIONS`), a missing or failed install **hard-fails**.

## Recommended verification order

For local pre-commit confidence:

```bash
bun run lint
bun run check
bun run test:coverage:gate
bun run compile
bun run package
```

## Layout

| Path | Role |
|------|------|
| `src/extension.ts` | Extension entry / activation |
| `src/editors/` | `axis.chart` custom editor, chart documents, drawings |
| `src/run/` | Run orchestration, Pro HTTP, results/profiler stores |
| `src/live/` | Worker ticket mint, WebSocket bridge, status |
| `src/host/` | HistoryClient (datafeed), builtins, apply-builtin, mock bars |
| `src/views/` | TreeViews + WebviewView panels |
| `src/plugins/` | Plugin registry, studios, status bar |
| `src/mcp/` | MCP server definition provider + LM tools |
| `src/protocol/` | Typed `axis.webview.v1` host↔webview envelopes |
| `src/secrets/` | SecretStorage key validation, set, clear |
| `src/test/` | `@vscode/test-electron` harness (not Bun) |
| `webview/<studio>/` | One Vite project per studio; builds to `dist/webview/<studio>/` |
| `media/` | Icons, activity art, builtins catalog |
| `pack/` | Extension pack manifest only |
| `out/` | Host bundle `out/extension.js` (gitignored) |
| `dist/webview/` | Webview bundles (gitignored; VSIX allowlist in `.vscodeignore`) |

Host output is intentionally `out/`; webview output is `dist/webview/`. Do not move the host entry to `dist/`.

## Hard constraints

- **Secrets**: `pn_…` / `pyn_…` keys live only in `ExtensionContext.secrets`.
  - Worker key regex: `/^pn_[a-f0-9]{48}$/`.[^pkg]
  - Pro key shape: `pyn_` + 20–508 `[A-Za-z0-9_-]`.[^pkg]
  - Never add key material to settings, logs, fixtures, output channels, or webview messages.
  - Status bar shows **set/missing** only — never values.[^design]
- **No plaintext key settings**: there are no `axis.worker.apiKey` / `axis.pro.apiKey` configuration properties. Use the `axis.secrets.*` commands.[^design]
- **Webview CSP**: paint-only by default: `default-src 'none'`, `connect-src 'none'`, `script-src ${webview.cspSource}` (no inline script). The host proxies all network.[^csp] [^vscode-webview]
- **CSP widening**: only the chart webview widens, and only when `axis.engine.allowPyodide` is `true` (`'wasm-unsafe-eval'` + `worker-src blob:`). Pyodide is bars-in only; multi-MB Wasm is not shipped. Results/Strategy stay paint-only. Update `docs/csp-matrix.md` before any runtime CSP change.[^csp]
- **Pine parity**: never invent `TV.*`, `TradingView.*`, `pine.*`, or fake Pine builtins. Engine output kinds are exactly `plot`, `hline`, `bgcolor`, `plotshape`, `plotchar`, `plotarrow`.[^contrib]
- **Native editor only** for Pine; the chart is a `CustomEditorProvider` on `*.axis.json`. Do not register a default custom editor on `*.pyne`.[^design]
- **No LSP fork**; PYNE is an id-only `extensionDependencies` edge.[^pkg]
- **License**: AGPL-3.0-only. Headers must say “version 3 only,” not “or later.” Do not relicense PYNE (AGPL-3.0-or-later).[^pkg]
- Do not commit `node_modules/`, `out/`, `dist/`, `coverage/`, `.vscode-test/`, `*.vsix`, or local `.env` files.

## Security / network posture

- `axis.engine.endpoint` and `axis.datafeed.url` default to loopback. Remote URLs require `axis.engine.allowRemoteEndpoint`, which is **application scope** — workspace settings cannot enable it.[^pkg]
- `axis.mcp.command` and `axis.mcp.allowNpx` are also **application scope**; workspace settings cannot redirect the stdio child that receives `AXIS_API_KEY`.[^pkg]
- MCP CLI resolution is soft-fail: `axis.mcp.command` override → `which axis` → `npx -y @hoox-sh/axis-cli` only if `axis.mcp.allowNpx` is `true`. Default `allowNpx` is `false`.[^design]
- Live tickets: `GET /api/ws/live?issue=ticket` → upgrade WS `/api/ws/live?ticket=...`. Never use a `?key=` query string with a long-lived `pn_` key.[^design]

## Testing & coverage

- Unit tests use `bun:test` with `--isolate`.
- Coverage gate `test:coverage:gate` enforces:
  - `src/protocol/` **100%** lines (hard fail).
  - Pure-host files under `src/protocol|host|secrets|editors|run|views|live|plugins|mcp/` at the **BASELINE** floor (currently **100%**; see `scripts/check-coverage.mjs`).[^pkg]
  - `test:coverage` emits `coverage/lcov.info`.
- Electron suite (`bun run test`) compiles via `tsconfig.tests.json` and runs `@vscode/test-electron` under `src/test/`. It needs the PYNE VSIX path as described above.

## Changelog & release

1. Add bullets under `## [Unreleased]` in `CHANGELOG.md` for every meaningful change.
2. Before release: move Unreleased to `## [X.Y.Z] — YYYY-MM-DD`, bump root `package.json` `version` (and `pack/package.json` when the pack changes).
3. Commit on a clean `main`.
4. Tag annotated: `git tag -a vX.Y.Z -m "AXIS IDE vX.Y.Z"` and push the tag.
5. `.github/workflows/release.yml` builds both VSIX files, attaches them to the GitHub Release, and publishes IDE then pack when `VSCE_PAT` / `OVSX_PAT` secrets exist.[^publish]

## Commit conventions

Conventional commits: `feat:`, `fix:`, `perf:`, `docs:`, `refactor:`, `test:`, `ci:`, `chore:`. One logical change per commit. Never commit secrets or build output.

## Cross-references

| Product | Repo | Docs |
|---------|------|------|
| HOOX | `hoox-sh/hoox` | `docs.hoox.sh` |
| PYNE | `hoox-sh/pyne` | `hoox.sh/pyne/docs` |
| AXIS PWA | `hoox-sh/axis` | `hoox.sh/axis/docs` |
