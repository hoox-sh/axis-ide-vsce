# AXIS task/plan conventions + VS Code trading-IDE prior art

Research date: 2026-11-02  
Sources: `.opencode/plans/` (esp. `final/`, `data-plane-redesign-*.mdx`), `.opencode/tmp/tasks/` (engine-redesign + live-session-status + aggregate schema scan), task-management skill (`~/.opencode/skills/task-management/SKILL.md`), marketplace / Open VSX / VS Code docs.

---

## JOB A — Task / plan file conventions

### Layout (two layers)

| Layer | Path (AXIS) | Role |
| --- | --- | --- |
| Human plan / tasklist | `.opencode/plans/*.mdx` and `.opencode/plans/final/{plan,tasklist}.mdx` | Narrative architecture, phase tables, decisions, supersession |
| Machine tracker | `.opencode/tmp/tasks/{feature-slug}/` (skill docs say `.tmp/tasks/`; AXIS keeps them under `.opencode/tmp/tasks/`) | `task.json` + `subtask_NN.json` for CLI / agents |

CLI (from skill):

```bash
bash /mnt/data/home/jango/.opencode/skills/task-management/router.sh status <feature>
bash .../router.sh next <feature>
bash .../router.sh validate <feature>
bash .../router.sh complete <feature> <seq> "summary"
```

Authoritative final docs for the engine redesign explicitly point machine trackers at the JSON dir and mark older MDX as superseded (`final/plan.mdx` §1, `final/tasklist.mdx` intro).

---

### MDX plan structure

**Common file header (all examined plans/tasklists):**

1. AGPL-3.0-only copyright / SPDX block (lines 1–18 style).
2. YAML frontmatter between `---`:
   - `title:`
   - `description:`
3. H1 matching the title.
4. Optional callout quoting authority / supersession (`> **Authoritative.** …`).

**`final/plan.mdx` section pattern (canonical “big plan”):**

| § | Content |
| --- | --- |
| 1 Supersession record | Table of older plan files → status (`Superseded` / `Folded in`) + disposition |
| 2 Objective | Bullet goals / non-negotiables |
| 3 Locked decisions | Numbered decisions |
| 4 Best-approach validation | Research table (question / verdict / evidence) |
| 5 Profile / architecture matrix | Tables + rules |
| 6 Wire / protocol | Message shapes, mermaid sequence |
| 7 Lifecycle / verification | Status machine, reconnect matrix |
| 8 Kept work from prior plans | Mapping table |
| 9 Phase plan | Phase / goal / exit; parallelism + rollback notes |
| 10 Decisions on open questions | Accepted Q&A |
| 11 Reference index | File:line anchors into code |

**`data-plane-redesign-plan.mdx` (older “phase plan” pattern):** Abstract → Motivation → Non-goals → Guiding principles → Phase N sections with per-task tables (`Task | Description | Files touched | Validation`) → Done criteria checklist.

**`final/tasklist.mdx` / `data-plane-redesign-tasks.mdx` (human tasklist):**

- Status vocabulary declared up front (final uses `pending` / `in_progress` / `completed` / `blocked`; older data-plane used `todo` / `in-progress` / `done` / `blocked` — prefer final/JSON vocabulary).
- Optional mapping section (old task IDs → disposition → final IDs).
- Phased tables with columns:
  - Final style: `ID | Task | Status | Depends on | Parallel | Validation`
  - Older style: `ID | Task | Status | Depends on | Validation`
- Done-criteria checklist (`- [ ] …`).
- Pointer to machine-readable tracker + example CLI invocations.

IDs in MDX tasklists are human labels (`F-01`, `0.1`, `1.6`). JSON subtasks use zero-padded `seq` (`"01"`) and ids `{feature}-{seq}`.

---

### `task.json` schema (feature root)

**Required / always present (14/14 features scanned):**

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Feature slug; must match directory name |
| `name` | string | Human title |
| `status` | string | Observed: `active`, `completed` (skill also documents lifecycle around these) |
| `objective` | string | One-paragraph goal |
| `context_files` | string[] | Specs / conventions agents must follow |
| `reference_files` | string[] | Existing code / docs to consult |
| `exit_criteria` | string[] | Feature-level “done when” |
| `subtask_count` | number | Must equal number of `subtask_*.json` files |
| `completed_count` | number | Updated by CLI `complete` |
| `created_at` | ISO-8601 string | |

**Optional / observed:**

| Field | Presence | Notes |
| --- | --- | --- |
| `completed_at` | 11/14 | `null` while active; ISO when done |
| `rollback_notes` | 2/14 | e.g. engine-redesign |
| `bounded_context` | 2/14 | e.g. redesign2 `"engine-data-plane"` |
| `module` | 2/14 | Short module tag |
| `related_adrs` | 1/14 | Array (may be empty) |
| `updated_at` | 1/14 | ISO timestamp |

**Example — small feature (`live-session-status/task.json`):**

```json
{
  "id": "live-session-status",
  "name": "Live session status (GET /session/<id>)",
  "status": "completed",
  "objective": "Reconcile local live-session bookkeeping against the engine before tick/append, and expose bars/idle/TTL.",
  "context_files": ["AGENTS.md"],
  "reference_files": ["src/engines/live-sessions.ts"],
  "exit_criteria": [
    "Subtask acceptance criteria met",
    "bun run test passes",
    "bunx tsc --noEmit clean",
    "Stale local sessions are detected before a tick is attempted"
  ],
  "subtask_count": 2,
  "completed_count": 2,
  "created_at": "2026-10-13T23:43:18.106Z",
  "completed_at": "2026-10-14T00:12:11.785Z"
}
```

**Example — large feature extras (`engine-redesign/task.json`):** same core fields plus rich `objective`, long `context_files` / `reference_files`, and `rollback_notes`.

---

### `subtask_NN.json` schema

**Always present (116/116):**

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | `{feature-slug}-{seq}` (e.g. `engine-redesign-01`, `live-session-status-02`) |
| `seq` | string | Zero-padded `"01"`, `"02"`, … |
| `title` | string | Short imperative title |
| `status` | string | Skill: `pending` \| `in_progress` \| `completed` \| `blocked`. Observed also: `done` (13 legacy) — prefer skill enum |
| `depends_on` | string[] | **Seq strings** of other subtasks (`["01","04"]`), not full ids; `[]` if none |
| `parallel` | boolean | Eligible to run alongside other ready parallel tasks |
| `suggested_agent` | string | Observed: `CoderAgent` / `coder-agent`, `TestEngineer`, `DocWriter`, `BuildAgent` |
| `context_files` | string[] | May be empty |
| `reference_files` | string[] | May be empty |
| `acceptance_criteria` | string[] | Required by `validate` |
| `deliverables` | string[] | Paths or artifact names; required by `validate` |

**Common optional (runtime / execution):**

| Field | Presence | Notes |
| --- | --- | --- |
| `validation_commands` | 77/116 | e.g. `["bun run test", "bun run typecheck"]` |
| `rollback_notes` | 77/116 | How to undo if the subtask ships |
| `agent_id` | 87/116 | Usually `null` until claimed |
| `started_at` | 91/116 | ISO or `null` |
| `completed_at` | 91/116 | ISO or `null` |
| `completion_summary` | 91/116 | Filled by `complete`; one factual sentence |
| `bounded_context` / `module` | 6/116 | Rare tagging |

**Example — small (`live-session-status/subtask_01.json`):**

```json
{
  "id": "live-session-status-01",
  "seq": "01",
  "title": "getSessionStatus() + reconcile before tick/append",
  "status": "completed",
  "depends_on": [],
  "parallel": false,
  "agent_id": null,
  "suggested_agent": "coder-agent",
  "context_files": [],
  "reference_files": [],
  "acceptance_criteria": [
    "GET {endpoint}/session/{id} parsed to { sessionId, bars, idleMs, ttlMs, mode }",
    "A 404/expired status drops the memo so the next run recreates the session",
    "Best-effort: any failure keeps existing behaviour"
  ],
  "deliverables": [
    "src/engines/live-sessions.ts",
    "tests/live-session-status.test.ts"
  ],
  "started_at": null,
  "completed_at": "2026-10-14T00:09:04.647Z",
  "completion_summary": "Added getSessionStatus() (typed ok/gone/unknown) + throttled idle reconciliation..."
}
```

**Example — engine-redesign style (adds validation + rollback):**

```json
{
  "id": "engine-redesign-09",
  "seq": "09",
  "title": "Wire new engine behind feature flag; freeze serverEngine as legacy",
  "status": "completed",
  "depends_on": ["04", "05", "06", "08"],
  "parallel": false,
  "suggested_agent": "CoderAgent",
  "context_files": ["src/engine/index.ts", "src/engines/catalog.ts"],
  "reference_files": [],
  "acceptance_criteria": [
    "Feature flag routes evaluation to the new stream engine when set",
    "serverEngine remains untouched as the legacy path; flag off is byte-for-byte current behavior",
    "No runtime wiring leaks into the default path"
  ],
  "deliverables": ["src/engine/index.ts", "src/engines/catalog.ts"],
  "validation_commands": ["bun run test", "bun run typecheck"],
  "rollback_notes": "Flip flag off; revert to legacy serverEngine in one commit.",
  "agent_id": null,
  "started_at": null,
  "completed_at": "2026-10-16T17:11:21.458Z",
  "completion_summary": "Stream engine behind localStorage feature flag + routeEngineRun..."
}
```

---

### Validation rules (from skill; enforce when authoring)

- `task.id` == feature directory slug.
- `subtask_count` == number of `subtask_*.json`.
- Subtask `id` starts with feature name; `seq` unique zero-padded.
- `depends_on` entries exist, no cycles, no self-deps.
- Every subtask has non-empty `acceptance_criteria` and `deliverables`.
- Status ∈ `{pending, in_progress, completed, blocked}`.

### Authoring conventions distilled

1. Write / update MDX plan + tasklist under `.opencode/plans/` (frontmatter + AGPL header).
2. Create `.opencode/tmp/tasks/{slug}/task.json` + atomic `subtask_NN.json` (one verifiable outcome each).
3. Prefer `validation_commands` + `rollback_notes` on non-trivial subtasks (engine-redesign pattern).
4. Keep MDX IDs mappable to JSON seqs (`F-09` ↔ `subtask_09.json`).
5. Mark completion only via CLI/`completion_summary`, not by editing status alone without summary.
6. Supersede, don’t delete: final plan keeps a disposition table for older MDX.

---

## Prior Art

Patterns that matter for shipping **language support + webview chart + results panel** as one VSIX **or** as an extension pack with **PYNE language server + AXIS IDE UI**.

### 1. Pine / trading language extensions (Marketplace + Open VSX)

There is **no official TradingView VS Code extension**. The market is crowded with language-only (or language + lint) extensions; **none embed a full chart IDE comparable to AXIS**.

| Extension | ID / URL | What it ships | Chart UI? |
| --- | --- | --- | --- |
| Pine Script (popular highlighter) | [JeylaniB.pinescript](https://marketplace.visualstudio.com/items?itemName=JeylaniB.pinescript) | Syntax, snippets, hovers | No |
| Pine Script Syntax Highlighter | [ex-codes.pine-script-syntax-highlighter](https://marketplace.visualstudio.com/items?itemName=ex-codes.pine-script-syntax-highlighter) (~86k installs) | Highlight, completion, hover, offline diagnostics, themes | No |
| Pine Script VS Code (LSP + TV lint API) | [kaigouthro.pinescript-vscode](https://marketplace.visualstudio.com/items?itemName=kaigouthro.pinescript-vscode) | Language server, real-time lint via TradingView API | No |
| Pine Script v6 | [TradesDontLie.pinescript-v6-vscode](https://marketplace.visualstudio.com/items?itemName=TradesDontLie.pinescript-v6-vscode) | v6 LSP, local static analysis + remote lint | No |
| Pine Script Pro | [revanthpobala.pine-script-pro](https://marketplace.visualstudio.com/items?itemName=revanthpobala.pine-script-pro) · [Open VSX](https://open-vsx.org/extension/revanthpobala/pine-script-pro) | WASM parser, static analysis | No |
| Pine Script v6 IDE Tools | [jpantsjoha/pinescript-vscode-extension](https://github.com/jpantsjoha/pinescript-vscode-extension) · [Open VSX](https://open-vsx.org/extension/jpantsjoha/pinescript-v6-extension) | Validator + IntelliSense + CLI + MCP; dual-publish Marketplace/Open VSX | No |
| pine-tools | [folknor/pine-tools](https://github.com/folknor/pine-tools) | LSP + CLI linter + MCP + VSIX | No |
| **PYNE Language Support (HOOX)** | [hoox-sh.pyne on Open VSX](https://open-vsx.org/extension/hoox-sh/pyne) | `.pyne`/`.pine` highlighting, diagnostics, hover, format, themes; powered by `hoox-pyne` | No (sister to AXIS PWA) |

**Takeaway:** language support is a solved, separable product. Chart + run + results is the missing piece AXIS would add; do not reinvent Pine LSP if `hoox-sh.pyne` already covers it.

### 2. Chart-in-editor prior art (Lightweight Charts + webview)

- **TradingView Lightweight Charts** — Apache-2.0 canvas library; browser/DOM only (not Node). Docs: https://tradingview.github.io/lightweight-charts/docs · GitHub: https://github.com/tradingview/lightweight-charts  
  Suitable for VS Code **webview** (same constraint as AXIS PWA). Bundle the **standalone** build into the webview webpack/esbuild graph; keep extension-host code free of DOM chart imports.

- **MiniBT Charts** — concrete marketplace example of **strategy charts inside VS Code editor tabs**:  
  https://marketplace.visualstudio.com/items?itemName=MiniBtMaster.minibt-charts · https://open-vsx.org/extension/MiniBtMaster/minibt-charts  
  Pattern: spawn local Python process → wait for `/healthz` → embed **iframe** of pylightcharts/bokeh web UI (or inject static HTML). Native PyQt windows **cannot** embed; they auto-rewrite to the web renderer. Results/logs go to an Output channel. This is the closest “trading IDE chart tab” precedent.

- **Backtest Manager** — https://open-vsx.org/extension/woung717/backtest-manager — Python backtest engines + visual results; again language/runtime outside the editor, UI via extension views.

### 3. Jupyter-in-VS Code architecture (language + kernels + webview panels)

Canonical split for a heavy IDE extension ([vscode-jupyter wiki](https://github.com/microsoft/vscode-jupyter/wiki/Source-Code-Organization)):

| Layer | Responsibility |
| --- | --- |
| Extension host | Kernels, execution, file I/O, VS Code API |
| Notebooks / controllers | Editor integration |
| **Separate webview build** | Variable / Data / Plot viewers (React); own webpack entry |
| Message bridge | Typed postMessage; for widgets, **proxy kernel** syncs host ↔ renderer |

Lessons for AXIS IDE:

- Chart webview = separate compile unit (like Jupyter plot viewer).
- Run engine (PYNE API / local worker) stays on the host side; webview receives snapshot/delta frames (mirrors AXIS stream wire).
- Expose a small public API if other extensions should drive runs (Jupyter’s `@vscode/jupyter-extension` pattern).

Custom editors / webviews: https://code.visualstudio.com/api/extension-guides/webview · custom editor contribution for “open chart for this script” UX.

### 4. Copilot Chat participants / AI surface

- Historical API: contribute `chatParticipants` + `vscode.chat.createChatParticipant` — sample https://github.com/microsoft/vscode-extension-samples/tree/main/chat-sample  
- Docs now mark **chat participants deprecated** for new Copilot harness work; prefer **agent plugins + MCP tools/apps** + extension tools for editor context: https://code.visualstudio.com/api/extension-guides/chat  

For AXIS/PYNE: existing **MCP servers** (pyne, axis) already match the recommended direction better than a bespoke `@axis` chat participant. Optional later: LanguageModelTool wrappers around compile/run/chart-focus.

### 5. Packaging: single VSIX vs extension pack vs `extensionDependencies`

From the [extension manifest](https://code.visualstudio.com/api/references/extension-manifest):

| Mechanism | Meaning | When to use |
| --- | --- | --- |
| **Single VSIX** | One extension contributes languages + views + webviews + commands | Tightly coupled MVP; one version matrix; simplest install |
| **`extensionDependencies`** | Hard dependency: dependent extension **will not activate** until dependency is installed; dependency loads first | AXIS IDE **requires** PYNE language features to be meaningful |
| **`extensionPack`** | Soft bundle: installing the pack installs listed extensions; members remain independently manageable; pack should **not** imply functional coupling alone | “AXIS Trading Pack” = PYNE + AXIS IDE (+ optional themes) for one-click install; category `Extension Packs` |

Microsoft rule of thumb: *If B needs A to function → `extensionDependencies`. If you only want co-install UX → `extensionPack`.* Packs often **also** list the same IDs users expect, but the hard edge belongs on the IDE extension.

#### Recommended packaging for PYNE + AXIS IDE

**Preferred (split products, pack for UX):**

```
hoox-sh.pyne              # Language support / LSP / grammar (already on Open VSX)
hoox-sh.axis-ide          # Webview chart + results panel + run/debug commands
hoox-sh.axis-pack         # extensionPack: ["hoox-sh.pyne", "hoox-sh.axis-ide"]
```

On `hoox-sh.axis-ide` `package.json`:

```json
{
  "name": "axis-ide",
  "publisher": "hoox-sh",
  "displayName": "AXIS IDE",
  "categories": ["Visualization", "Debuggers", "Other"],
  "extensionDependencies": ["hoox-sh.pyne"],
  "extensionKind": ["ui", "workspace"],
  "contributes": {
    "viewsContainers": { "panel": [{ "id": "axis", "title": "AXIS", "icon": "media/axis.svg" }] },
    "views": {
      "axis": [
        { "type": "webview", "id": "axis.results", "name": "Results" }
      ]
    },
    "customEditors": [
      {
        "viewType": "axis.chart",
        "displayName": "AXIS Chart",
        "selector": [{ "filenamePattern": "*.{pine,pyne}" }],
        "priority": "option"
      }
    ],
    "commands": [
      { "command": "axis.runScript", "title": "AXIS: Run Script" },
      { "command": "axis.openChart", "title": "AXIS: Open Chart" }
    ]
  }
}
```

On the pack:

```json
{
  "name": "axis-pack",
  "publisher": "hoox-sh",
  "displayName": "AXIS Trading Pack",
  "categories": ["Extension Packs"],
  "extensionPack": ["hoox-sh.pyne", "hoox-sh.axis-ide"]
}
```

**When a single VSIX is better:** early private dogfood, unpublished internal builds, or if PYNE LSP is not separately versioned yet. Cost: megabyte webview + language server in one artifact; slower installs; harder independent release cadence.

**Dual-publish:** follow Pine v6 IDE Tools — Marketplace **and** [Open VSX](https://open-vsx.org/) so Cursor / Windsurf / VSCodium work (PYNE already on Open VSX).

### 6. Webview + Lightweight Charts implementation checklist

1. **Two bundles:** `extension.js` (Node/host) and `webview/main.js` (browser); never import `lightweight-charts` from the host.
2. Prefer **asWebviewUri** + `localResourceRoots` for chart assets; CSP `script-src` / `style-src` aligned with AXIS CSP lessons.
3. Host owns PYNE HTTP/WS; webview speaks a narrow message protocol (`init`, `full`, `delta`, `theme`, `selection`) — same spirit as AXIS StreamLiveWire / Jupyter plot viewer.
4. Results panel = `WebviewView` in the panel area; chart = `WebviewPanel` or `CustomTextEditor` beside the script.
5. Theme sync: listen `onDidChangeActiveColorTheme` and push CSS variables / LWC layout options.
6. For live sessions, reuse AXIS engine frame contract rather than inventing a second wire.

### 7. Packaging recommendation (concrete)

| Goal | Choice |
| --- | --- |
| Public “install AXIS trading IDE” | **Extension pack** `hoox-sh.axis-pack` |
| Ensure chart UI always has language support | **`extensionDependencies`: `["hoox-sh.pyne"]`** on `axis-ide` |
| Fast internal iteration | Single combined VSIX OK; split before Marketplace |
| AI / agent surface | MCP (existing) > new chat participant |
| Chart tech | Lightweight Charts in webview (proven by AXIS PWA + MiniBT’s web path) |

Gap vs prior art: competitors stop at **edit/lint**. AXIS’s differentiator is **run + stream + chart + results inside the editor**, packaged beside (not instead of) PYNE language support.
