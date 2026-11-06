---
okf_lock: human
type: Guide
title: AXIS IDE — Testing Strategy
description: Unit tests, coverage ratchet, and electron integration testing for axis-ide-vsce.
resource: https://github.com/hoox-sh/axis-ide-vsce
tags: [testing, coverage, bun-test, vscode-test-electron, axis-ide]
sources:
  - id: pkg
    title: package.json
    resource: ../../package.json
  - id: cov
    title: Coverage gate script
    resource: ../../scripts/check-coverage.mjs
  - id: ts-tests
    title: Test TypeScript config
    resource: ../../tsconfig.tests.json
  - id: agents-md
    title: Repository AGENTS.md
    resource: ../../AGENTS.md
---

# AXIS IDE — Testing Strategy

## Layers

| Layer | Tool | Command |
|-------|------|---------|
| Unit | `bun:test` | `bun run test:unit` |
| Coverage | `bun:test --coverage` | `bun run test:coverage` |
| Gate | `scripts/check-coverage.mjs` | `bun run test:coverage:gate` |
| Electron | `@vscode/test-electron` | `bun run test` |

Run a single unit file:

```bash
bun test --isolate src/protocol/protocol.test.ts
```

## Coverage ratchet

- `src/protocol/`: **100%** lines, hard fail.
- Pure-host scope (`src/protocol|host|secrets|editors|run|views|live|plugins|mcp/`): **BASELINE** floor, currently **100%**.
- Package overall: aspirational 80%, printed but not enforced.
- `check-coverage.mjs` also checks that every INCLUDE file on disk appears in `coverage/lcov.info`.[^cov]

## Electron tests

- Compiled via `tsconfig.tests.json`.
- Requires `hoox-sh.pyne` VSIX in the downloaded VS Code.
- Default lookup: sibling `pynescript`/`pyne` checkout, glob `pyne-vscode-*.vsix`.
- Override: `AXIS_IDE_PYNE_VSIX=/path/to/pyne-vscode-….vsix`.
- CI hard-fails if PYNE install fails.[^agents-md]

## Writing guidance

- Test pure helpers independently of VS Code APIs.
- Use mock bars for offline test data.
- Never add secrets to fixtures.
- Prefer deterministic assertions.

## Related concepts

- [design.md](/playbooks/design.md)
- [build-pipeline.md](/playbooks/build-pipeline.md)
- [security-model.md](/playbooks/security-model.md)
