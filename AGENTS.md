# AGENTS.md — AXIS IDE

Compact guide for AI agents working in **axis-ide-vsce**.

## What this is

**AXIS IDE** is the VS Code extension (`hoox-sh.axis-ide`) that runs Pine
Script™ / PYNE beside the editor with AXIS charts, results, profiler, studios,
live sessions, and MCP/Copilot tooling. It hard-depends on **PYNE Language
Support** (`hoox-sh.pyne`) and is part of the HOOX open trading stack.

The optional **AXIS Trading Pack** (`hoox-sh.axis`) lives in `pack/`.

This repo was extracted from the AXIS monorepo (`hoox-sh/axis`) with history
preserved. It is **independent** of TradingView, Inc. Pine Script™ and
TradingView® are trademarks of TradingView, Inc.

## Quick commands

```bash
bun install
bun run compile                 # esbuild host + all Vite webviews
bun run check                   # tsc host + webviews
bun run test:unit               # bun:test
bun run test:coverage:gate      # coverage + BASELINE/protocol ratchet
bun run test                    # @vscode/test-electron (needs PYNE VSIX)
bun run package                 # → axis-ide-<ver>.vsix
bun run pack:package            # → pack/axis-<ver>.vsix
bun run lint                    # biome check
bun run verify                  # check + coverage gate
```

Use **`bun run <script>`** (not `bun --cwd … run`). On current Bun,
`bun --cwd <dir> run <script>` can exit 0 without executing.

## Layout

| Path | Role |
|------|------|
| `src/extension.ts` | Extension entry / activation |
| `src/editors/` | `axis.chart` custom editor, chart documents, drawings |
| `src/run/` | Run orchestration, Pro HTTP, results/profiler stores |
| `src/live/` | Worker ticket mint, WebSocket bridge, status |
| `src/host/` | HistoryClient (datafeed), builtins, apply-builtin |
| `src/views/` | TreeViews + WebviewView panels |
| `src/plugins/` | Plugin registry, studios, status bar |
| `src/mcp/` | MCP server definition provider + LM tools |
| `src/protocol/` | Typed `axis.webview.v1` host↔webview envelopes |
| `src/secrets/` | SecretStorage key validation/set/clear |
| `src/test/` | `@vscode/test-electron` harness (not Bun) |
| `webview/<studio>/` | One Vite project per webview |
| `media/` | Icons, activity art, builtins catalog |
| `pack/` | Extension pack manifest only |
| `docs/` | CSP matrix + design/plan notes |
| `out/` | Host bundle (gitignored) |
| `dist/webview/` | Webview bundles (gitignored) |

## Hard constraints

- **Secrets**: `pn_…` / `pyn_…` live only in `ExtensionContext.secrets`. Never
  add settings, logs, fixtures, or webview messages containing key material.
- **Webview CSP**: paint-only by default (`connect-src 'none'`); the host proxies
  network. Update `docs/csp-matrix.md` before changing runtime CSP.
- **Pine parity**: never invent `TV.*`, `TradingView.*`, `pine.*`, or fake Pine
  builtins. Engine output kinds are `plot`, `hline`, `bgcolor`, `plotshape`,
  `plotchar`, `plotarrow`.
- **Native editor only** for Pine; the chart is a `CustomEditorProvider` on
  `*.axis.json`. Do not register a default custom editor on `*.pyne`.
- **No LSP fork**; PYNE is an id-only `extensionDependencies` edge.
- **License**: AGPL-3.0-only. Headers must not say “or later”. Do not relicense
  PYNE (AGPL-3.0-or-later).
- Do not commit `node_modules/`, `out/`, `dist/`, `coverage/`, `.vscode-test/`,
  `*.vsix`, or local `.env` files.

## Changelog & release

1. Add bullets under `## [Unreleased]` in `CHANGELOG.md` for every meaningful
   change.
2. Before release: move Unreleased to `## [X.Y.Z] — YYYY-MM-DD`, bump the root
   `package.json` `version` (and `pack/package.json` when the pack changes).
3. Commit on a clean `main`.
4. Tag annotated: `git tag -a vX.Y.Z -m "AXIS IDE vX.Y.Z"` and push the tag.
5. `.github/workflows/release.yml` builds both VSIX files, attaches them to the
   GitHub Release, and publishes when `VSCE_PAT` / `OVSX_PAT` secrets exist.
   Publish order is IDE first, then pack — see `PUBLISH.md`.

## Commit

Conventional commits (`feat:`, `fix:`, `perf:`, `docs:`, `refactor:`, `test:`,
`ci:`, `chore:`). One logical change per commit. Never commit secrets or build
output.
