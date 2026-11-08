---
okf_lock: human
type: Guide
title: AXIS IDE — Build Pipeline
description: esbuild, Vite, VSIX packaging, CI, and release workflow for axis-ide-vsce.
resource: https://github.com/hoox-sh/axis-ide-vsce
tags: [build, ci, vscode-extension, esbuild, vite, axis-ide]
sources:
  - id: pkg
    title: package.json
    resource: ../../package.json
  - id: esbuild
    title: Host esbuild script
    resource: ../../esbuild.host.mjs
  - id: vsce
    title: VSCE
    resource: https://github.com/microsoft/vscode-vsce
  - id: ci
    title: CI workflow
    resource: ../../.github/workflows/ci.yml
  - id: release
    title: Release workflow
    resource: ../../.github/workflows/release.yml
  - id: publish
    title: Publishing guide
    resource: ../../PUBLISH.md
---

# AXIS IDE — Build Pipeline

## Host bundle

`esbuild.host.mjs` bundles `src/extension.ts` → `out/extension.js`:

- Format: CommonJS
- Platform: node, target node18
- External: `vscode`
- Sourcemaps enabled, no minification
- Entry stays in `out/`; do not move to `dist/`.

## Webview bundles

Each studio under `webview/<studio>/` has its own `vite.config.ts`. The root `compile:webview` script builds all of them in sequence into `dist/webview/<studio>/main.{js,css}`.[^pkg]

## VSIX packaging

```bash
bun run compile
bun run package        # axis-ide-<ver>.vsix
bun run pack:package   # pack/axis-pack-<ver>.vsix
```

VSCE runs with `--no-dependencies` because `node_modules` is excluded. Runtime dependencies (e.g. `lightweight-charts`) are bundled by Vite into the chart webview. `.vscodeignore` allowlists only the runtime artifacts.[^vsce]

## CI / release

- `ci.yml`: install → `test:coverage:gate` → install PYNE VSIX → electron tests under xvfb → package both VSIX on `main`/tags/dispatch.
- `release.yml`: on `v*` tags or dispatch, build both VSIX, attach to GitHub Release, then publish IDE then pack to Marketplace/Open VSX when `VSCE_PAT` / `OVSX_PAT` exist.[^publish]

## Related concepts

- [design.md](/playbooks/design.md)
- [testing-strategy.md](/playbooks/testing-strategy.md)
