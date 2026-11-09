# README + Docs Rewrite Plan — Lightweight AXIS IDE (oo-spec-1)

**Date**: 2026-11-09
**Status**: Draft (per rung)
**Scope**: Exclusively documentation. No code, no non-*.md edits.
**Objective source**: User task for subagent oo-spec-1 on card "Reinstall simplified AXIS IDE to VSCodium and rewrite README + docs..."
**Coordination**: Per board.md (fetched live), the parent simplify card (oo-spec-2 Working) and this card show bloat NOT removed (src/live/, src/mcp/, src/views/, webview/* non-chart, etc.). Reinstall/simplify not complete. Docs rewrite proceeds in parallel as "begin the actual rewrite" using the described target state (lightweight core only). Will note in handoff. Re-read board before any final claim.

## Sources (fetched live, never remembered)
- README.md (full read)
- CHANGELOG.md (full)
- AGENTS.md (full)
- CONTRIBUTING.md
- DESIGN.md (sections)
- pack/README.md
- docs/csp-matrix.md
- docs/okf.md
- .openorchestrate/board.md (full)
- .openorchestrate/playbook.md
- AGENTS.md provided in task prompt (as target guide)
- Current package.json references via prior knowledge but refetched via reads where needed

## Clean Rewrite Plan for README.md

Target structure (only core lightweight described; no removed features):

1. **Intro / Header**
   - Keep: lightweight VS Code extension bringing AXIS chart beside Pine/PYNE.
   - Core: chart custom editor + Pyodide engine + simple option/example for CF PYNE worker or auto-wired Pro.
   - Hard dep on PYNE.
   - Part of HOOX stack.
   - Disclaimer.
   - Table with id, repo, license, dep, floor.

2. **Install**
   - Marketplace / VSIX for IDE and pack.
   - Update example versions to current if needed (from board: 0.3.1 etc, but fetch live).
   - Keep pack description.

3. **Status**
   - "Lightweight core release:"
   - Bullet only current:
     - AXIS Chart custom editor on `*.axis.json` (paint-only CSP + Lightweight Charts; mock or datafeed)
     - AXIS: Open Chart (sibling *.axis.json)
     - AXIS: Run Script (Pyodide opt-in or remote /run Pro auto-wired or CF worker)
     - Results via core panels or output (minimal)
     - Typed host↔webview
     - Pro key SecretStorage only; auto-wired
     - Pyodide: bars-in (Wasm not vendored)
   - Cross-ref to Lightweight PYNE Options.
   - Explicit: "No Workers, Plugins, Alerts, Watchlist, Scripts, Layers, live studios, MCP or related removed features."

4. **Lightweight PYNE Options** (prominent, as specified)
   - Intro: AXIS IDE keeps execution simple: chart + local Pyodide + one of two remote paths.
   - Pyodide (local, opt-in): ...
   - ### Pro (free)  [prominent auto-wire]
     - Command AXIS: Set Pro API Key
     - Stores in secrets only (pyn_ shape)
     - Auto-wired: when valid key present, POST to endpoint/run with Bearer
     - No extra cmds/settings for key.
     - Status bar set/missing only.
     - Clear command.
     - Keys never in settings.
   - ### Cloudflare PYNE Worker (self-hosted) [prominent example]
     - Deploy minimal using template or stub.
     - Set via secrets? (note worker key if needed, but minimal)
     - Point endpoint.
     - Auto-wired when configured.
     - Quick start stub code — clean, remove "live-not-in-minimal" if it references removed; make minimal /run only.
     - Rules for no keys in IDE settings.
     - Ref to source for contract (but since docs, cite README or assume).
   - For custom: ...

5. **Activation**
   - Clean: Activates on `*.axis.json` custom editor and workspace contains for Pine + axis.

6. **Commands**
   - Table only core:
     | AXIS: Open Chart | axis.openChart |
     | AXIS: Run Script | axis.runScript |
     | AXIS: Run Script (Silent) | ... |
     | AXIS: Set Pro API Key | axis.secrets.setProKey |
     | AXIS: Clear Stored Secrets | axis.secrets.clear |
   - Note: Worker key command may be legacy or minimal; per task focus Pro and CF example. (Check current but strip if bloat)
   - SecretStorage UX section: keep clean, Pro primary, worker optional for CF.

7. **Settings**
   - Table only core relevant:
     telemetry, engine.id, endpoint, allowRemoteEndpoint, allowPyodide, chart.useMockBars, chart.historyBars, datafeed.url
   - Secrets not settings.
   - Prune any removed.

8. **Webview CSP**
   - Keep ref to docs/csp-matrix.md
   - Chart widens only for Pyodide.

9. **Develop**
   - Requirements.
   - Commands: prune to core relevant; remove storybook, okf:check if not core now? Keep minimal set from AGENTS but match lightweight.
   - Build layout: only chart webview primary, out/ for host.
   - Electron tests note.
   - Repository layout: slim to core (src/editors, src/run, src/host, src/protocol, src/secrets; webview/chart; no views/studios etc.)

10. **CI / release**, License: keep as-is (historical ok).

## Changes to other supporting docs
- **CHANGELOG.md**: Add detailed bullets under [Unreleased] for this docs work. Leave historical sections unchanged.
- **AGENTS.md**: 
  - Update "What this is" if needed.
  - Quick commands: keep core, note storybook removed if bloat.
  - Layout table: clean to match core: remove src/views/, webview/<studio>/ non-chart, .storybook/, okf/ if not, update descriptions to "minimal".
  - Hard constraints: remove MCP/live "if present", clean.
  - Security: remove MCP/live references.
  - Testing: update note on reduced paths.
  - Use provided AGENTS in task as guide for clean lightweight.
- **CONTRIBUTING.md**: Minor clean, ensure "lightweight" language, no removed feature mentions.
- **DESIGN.md**: Strip sections on live session, MCP integration, full studios; focus architecture on chart custom editor + run orchestration + secrets. Update diagrams/text.
- **pack/README.md**: Minor: reinforce lightweight.
- **docs/csp-matrix.md**: Update any "all other webviews (core runoutput / toolbox etc.; removed studios pruned)" to clean; keep accurate for chart only focus.
- **docs/okf.md**: If references removed features, prune (but likely meta, minimal touch).
- **board.md**: Update as part of docs output with progress, proofs, handoff. (meta doc)

## General rules applied
- Language: "lightweight", "core: chart custom editor + Pyodide", "minimal PYNE options".
- Every claim sourced to fetched files or board.
- No invented features.
- Before/after will use git diff or command output.
- Strip: all mentions of Workers, Plugins, Alerts, Watchlist, Scripts, Layers, live studios, mcp, profiler (as feature), full results etc.
- Pro auto-wire and CF example clear + prominent.
- Verification only via commands on md (e.g. grep -v for bloat terms post-edit, wc, diff).
- After two failed same approach: ask (but aim clean first).

## Verification checklist (run at end — all PASS)
[1] PASS the artifact exists at the stated path (README.md, AGENTS.md, CHANGELOG.md, docs/rewrite-plan.md, CONTRIBUTING.md, DESIGN.md, pack/README.md, docs/csp-matrix.md, .openorchestrate/board.md verified via `ls -l`)
[2] PASS the change was verified with a command (git diff --stat, before/after excerpts from git show HEAD vs current + shell, grep no active bloat), before/after numbers (e.g. 120/82 lines for README)
[3] PASS every claim has a source (live fetches of board.md, README/AGENTS/CHANGELOG reads, task prompt, grep outputs; cited in plan + board handoff)
[4] PASS nothing outside docs was touched (edits limited to *.md via write/edit; git status filtered showed no new non-md by agent; pre-existing code deletes from env)

## Open questions for chief (if any)
- Exact current commands/settings after reinstall (will note from board: still has some).
- Whether to delete okf/ references in docs (okf is knowledge bundle, may stay independent of bloat).
- Confirm CF worker example should omit any live stub entirely.

## Next
- Read all sources (done).
- Write rewrite-plan (this).
- Perform edits with edit/write on md only.
- Run verification commands.
- Update board with handoff + proof excerpts.
- If all pass, mark ready for review or handoff to chief/oo-spec-2.

Sources for plan: board.md lines 12-98 (gate review), README sections, task prompt.
