# Copyright (C) 2026 jango_blockchained
# SPDX-License-Identifier: AGPL-3.0-only

# OKF bundle

## Abstract

`okf/` is an [Open Knowledge Format](https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md) v0.2 bundle. It is the compiled map of this repo: one concept per source directory and per doc, with imports already linked. Agents read `okf/index.md` and then one concept instead of searching the tree.

## Refresh

The pre-commit hook (`.githooks/`, installed by `bun install` via the `prepare` script) runs the pipeline against the git index and stages the generated bundle into the commit. Unstaged edits, including unstaged edits to curated playbooks, are not part of that commit's bundle.

```bash
bun run okf:enrich    # draft, link, and lint from the working tree
bun run okf:check     # fail if the committed bundle would change
bun run okf:lint      # conformance errors and producer warnings
bun run okf:query plugins components
bun run okf:context webview/shared
```

A directory path resolves to that concept. A file path resolves to the deepest directory concept that contains it. Query terms match path segments and the file names listed on a concept. The curated agent guide lives in `okf/playbooks/` (`agent-instructions.md`, `design.md`, `security-model.md`, `build-pipeline.md`, `testing-strategy.md`).

`OKF_SKIP=1` skips the hook refresh. CI runs `okf:check`, so a commit that bypasses the hook still cannot merge a stale bundle.

Generated concepts (`okf_lock: generated`) are replaced when their sources change. Curated playbooks (`okf_lock: human`) are kept. Put hand-written knowledge in `okf/playbooks/` with that lock. The draft records exports, imports, and the first non-license comment. It does not call a model.

## Layout

| Path | Role |
| --- | --- |
| `okf/index.md` | Bundle root. Declares `okf_version: "0.2"`. |
| `okf/log.md` | Newest-first compile history. |
| `okf/code/` | One concept per source directory (`src/`, `scripts/`, `webview/`). |
| `okf/docs/` | Outlines of `docs/`. |
| `okf/playbooks/` | Curated agent guide (`okf_lock: human`). |
| `okf/repository/` | README, contributing, security, and publishing notes. |
| `scripts/okf/` | Compiler, linter, and query CLI. |

## Exclusions

Code roots: `src/`, `scripts/`, `webview/`. Standalone docs: `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `PUBLISH.md`. Everything else (`pack/`, `fixtures/`, `media/`, build output) is outside the bundle. Gitignored local files (`AGENTS.md`, `DESIGN.md`, `.opencode/`) are never part of the bundle, matching the axis repo's posture. `okf/` ships in git but is excluded from the VSIX by `.vscodeignore`.
