---
type: Reference
title: Architecture
description: The project shape and the OpenOrchestrate team.
tags: [architecture, openorchestrate]
status: stable
---

# Architecture

axis-ide uses OpenOrchestrate. Languages: TypeScript, JavaScript.

## Runtime surfaces

VS Code extension (`hoox-sh.axis-ide`) that runs the AXIS charting IDE beside
Pine / PYNE buffers: run orchestration, charts, results, and live sessions
inside the editor. Requires the `hoox-sh.pyne` language extension.

- **Entry points:** the extension host plus compiled webview bundles
  (`compile:webview`, `compile:webview:*`).
- **Run:** `bun run package` builds `axis-ide-<version>.vsix`; install with
  `code --install-extension`. Use `bun run watch` while developing.
- **Verify:** `./scripts/verify.sh` runs `bun run lint`, `bun run check`, and
  `bun run test`.

## The team

| Seat | Title | Agent |
| --- | --- | --- |
| Chief | Chief of Staff | `oo-chief` |
| Ops | Head of Operations | `oo-ops` |
| Checker | Quality Gate | `oo-checker` |
| Docs | Head of Docs | `oo-spec-1` |
| Engineering | Head of Engineering | `oo-spec-2` |
| Misc | General Desk | `oo-misc` |

## The board

The board lives at `.openorchestrate/board.md`. It has five statuses:
Todo, Working, Blocked, Ready for Review, Done. A card moves to Done only with proof.

## Related

- [Development](/development.md)
- [Security](/security.md)
