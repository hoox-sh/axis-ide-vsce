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
- `webview/shared/` source-only webview runtime and design system
  (Phase 0 groundwork, no behavior change): `--axis-*` design tokens with
  VS Code semantic variables first, base theme/motion/component CSS layers,
  a typed `acquireVsCodeApi()` singleton, DOM/announce/clipboard/filter
  helpers, the `createStudio()` lifecycle runtime, first-pass `ax-*`
  component builders, and a shared
  `createStudioViteConfig()` factory. The Colors studio pilots the
  `@axis-shared` alias (inert until a studio imports it).
- `axis.webview.v1` protocol extended with a generic `studio.*` namespace
  (`studio.init`, `studio.set`, `studio.notice`, `studio.ready`,
  `studio.action`) so every studio can share one codec, one error-code
  table, and one 100%-covered test suite. Additive only — existing
  `chart.*` / `results.*` / `host.*` branches are untouched.
- Colors studio migrated end-to-end onto the shared runtime and the
  `studio.*` protocol (pilot for the webview consolidation): the webview
  side runs on `createStudio()` + shared DOM/filter helpers and inlines
  the `--axis-*` design system; the host side encodes/decodes through the
  single codec bridge (`webview/shared/studio-protocol.ts`). Wire format
  is now `studio.init`/`studio.set`/`studio.ready`/`studio.action` with
  the old payload shapes preserved verbatim; behavior and visuals are
  unchanged.
- Generic studio host infrastructure (Phase 2 groundwork, not yet wired):
  `buildStudioHtml()` (single paint-only CSP shell, byte-identical CSP to
  the current builders), a generic `StudioViewProvider`, a
  `StudioMessageRouter` (decode → route by view/action, errors logged and
  dropped), and a `StudioRegistration` registry — all pure-host with 100%
  line coverage.

### Fixed

- Electron `compile-tests` type error where `assert.deepStrictEqual` narrowed
  the activity-view id list and rejected forbidden plugin view ids.
- Activation no longer throws on VS Code builds without
  `lm.registerMcpServerDefinitionProvider` / `lm.registerTool`; both features
  are feature-detected and soft-fail while the rest of the extension activates.

### Changed

- Repository / bugs / QnA links now point at `hoox-sh/axis-ide-vsce`.
- Build and test commands no longer use monorepo `--cwd packages/…` paths.
- `.vscodeignore` excludes repo-only docs, `pack/`, CI files, and internal
  contributes fragments from the VSIX.

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
