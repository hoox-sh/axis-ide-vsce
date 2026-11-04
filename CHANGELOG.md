# Changelog

All notable changes to **AXIS IDE** (`hoox-sh.axis-ide`) and the **AXIS Trading
Pack** (`hoox-sh.axis`). This repository was extracted from the AXIS monorepo
with its commit history preserved.

## [Unreleased]

### Added

- Standalone repository layout: extension at the root, extension pack under
  `pack/`.
- CI (unit + coverage gate + electron + VSIX artifacts), tag-driven release
  workflow with optional Marketplace / Open VSX publishing.
- Dependabot, issue templates, PR template, CODEOWNERS, security and
  contribution docs.

### Fixed

- Electron `compile-tests` type error where `assert.deepStrictEqual` narrowed
  the activity-view id list and rejected forbidden plugin view ids.

### Changed

- Repository / bugs / QnA links now point at `hoox-sh/axis-ide-vsce`.
- Build and test commands no longer use monorepo `--cwd packages/…` paths.
- `.vscodeignore` excludes repo-only docs, `pack/`, and CI files from the VSIX.

## [0.1.0] — 2026-11-04

### Added

- AXIS Chart custom editor (`*.axis.json`), Open Chart, Run Script
  (`Ctrl/Cmd+Enter`), and Run Script (Silent).
- Results / Strategy panel webviews with focus rules and Focus Results.
- Activity-bar studios: Library, Layers, Scripts, Watchlist, Alerts, Plugins,
  Workers; panel studios: Results, Strategy, Profiler, Colors, Symbols, Logs.
- SecretStorage-backed Worker / Pro key commands and status bar marks.
- Live session bridge (Worker ticket mint + WebSocket), on-save run modes.
- MCP server definition provider and Copilot language-model tools.
- Bundled builtins catalog, profiler decorations, colors/symbols contributions.
- Coverage ratchet (`test:coverage:gate`) and `@vscode/test-electron` suite.
- AXIS Trading Pack (`hoox-sh.axis`) bundling PYNE + AXIS IDE.
