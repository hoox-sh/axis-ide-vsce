# Research Brief: Newest VS Code Extension APIs for AXIS IDE

**Scope:** Build a full “AXIS IDE” inside VS Code (chart panes, results/strategy panes, custom editors, webviews, proposed APIs).  
**Sources:** Official docs on code.visualstudio.com and github.com/microsoft/vscode (2024–2026). Docs timestamps observed ~2026-10.  
**VS Code context:** Stable ~1.141+ (Oct 2026 era); floating windows since **1.85** (Nov 2023); multi-diff preview since **1.85**.

---

## 1. Custom Editors API — when to use vs `WebviewPanel`

### API surface (stable)

| Provider | Document model | Editing | Typical use |
|---|---|---|---|
| `CustomTextEditorProvider` | VS Code `TextDocument` | Full text undo/save/hot-exit via editor | Text-based formats (JSON/CSV/Pine-like source) with custom UI |
| `CustomReadonlyEditorProvider<T extends CustomDocument>` | Your `CustomDocument` | No undo/save | Previews (charts over immutable dumps, image-like) |
| `CustomEditorProvider<T extends CustomDocument>` | Your `CustomDocument` | You implement edit/save/backup | Binary / complex non-text documents |

**Registration / contribution**

- Contribution: `contributes.customEditors[]` with `viewType`, `displayName`, `selector` (`filenamePattern`), `priority` (`"default"` | `"option"`).
- Activation: `onCustomEditor:VIEW_TYPE`.
- Code: `window.registerCustomEditorProvider(viewType, provider, options?)` where `options` may include `supportsMultipleEditorsPerDocument` and `webviewOptions`.

**Lifecycle (text)**

1. Activation → register provider.  
2. `resolveCustomTextEditor(document: TextDocument, webviewPanel: WebviewPanel, token)`.  
3. One `TextDocument` per resource; each split gets its **own** `WebviewPanel`.  
4. Sync: webview → `WorkspaceEdit` / `workspace.applyEdit`; document → `workspace.onDidChangeTextDocument` → `webview.postMessage` (debounce; avoid update loops).

**Lifecycle (custom document)**

1. `openCustomDocument(uri, openContext, token)` → `CustomDocument`.  
2. `resolveCustomEditor(document, webviewPanel, token)`.  
3. Editable: fire `onDidChangeCustomDocument` with either:
   - `CustomDocumentEditEvent` (`undo` / `redo` / `label`) — preferred, enables undo stack; or  
   - `CustomDocumentContentChangeEvent` — dirty only, **no** undo/redo.  
4. Implement `saveCustomDocument` / `saveCustomDocumentAs` / `revertCustomDocument` / `backupCustomDocument` for hot exit. Prefer not depending on a visible webview for save; if unavoidable, use `retainContextWhenHidden` (costly).

### Custom Editor vs `WebviewPanel`

| | **Custom Editor** | **`window.createWebviewPanel`** |
|---|---|---|
| Bound to a workspace resource / URI | Yes (Reopen With, dirty, save, tabs as `TabInputCustom`) | Optional / none |
| Appears as a real editor tab for a file type | Yes | Editor-area panel, but not a file editor |
| Undo / save / hot exit integration | Yes (via providers above) | You invent it |
| Best for AXIS | Chart/workspace **documents**, strategy scripts with visual mode | Ephemeral tools, wizards, one-off dashboards |

**Rule of thumb:** If the UI is “the editor for this file,” use Custom Editors. If it is “a tool window that happens to use HTML,” use `WebviewPanel` or `WebviewView`.

**Citations:**  
- https://code.visualstudio.com/api/extension-guides/custom-editors (doc dated ~2026-10-28/29)  
- https://code.visualstudio.com/api/references/vscode-api#CustomTextEditorProvider  
- Sample: https://github.com/microsoft/vscode-extension-samples/tree/main/custom-editor-sample  

---

## 2. `WebviewView` vs `WebviewPanel` vs Custom Editor

Webviews are iframes controlled by the extension; same HTML/message/CSP rules apply in all three hosts.

| API | Where it lives | Create / register | Persist across reload | AXIS mapping |
|---|---|---|---|---|
| **`WebviewView`** | Sidebar or Panel view containers | `contributes.views` + `window.registerWebviewViewProvider(viewId, provider, { webviewOptions: { retainContextWhenHidden } })` | View is part of layout; resolve on show | Results list, strategy summary, watchlists, library |
| **`WebviewPanel`** | Editor area as a tab | `window.createWebviewPanel(viewType, title, showOptions, options)` | `registerWebviewPanelSerializer` + `onWebviewPanel:viewType` + webview `setState`/`getState` | Scratch chart lab, detached analytics |
| **Custom Editor** | Editor area **for a resource** | `registerCustomEditorProvider` | Document + editor restore | Primary chart document, visual script editor |

**UX guidance (official):** Prefer native TreeView / commands over webviews; use webviews only when native API is inadequate. Do **not** use an Activity Bar item solely to open an editor-area webview.

**Citations:**  
- https://code.visualstudio.com/api/extension-guides/webview  
- https://code.visualstudio.com/api/ux-guidelines/webviews  
- https://code.visualstudio.com/api/ux-guidelines/views  
- Sample WebviewView: https://github.com/microsoft/vscode-extension-samples/tree/main/webview-view-sample  

---

## 3. Proposed / stable APIs (selected)

### Notebook controllers & renderers — **stable**

- `workspace.registerNotebookSerializer(notebookType, serializer)`  
- `notebooks.createNotebookController(id, notebookType, label)` → `NotebookController` (`executeHandler`, `supportedLanguages`, `createNotebookCellExecution`, `rendererScripts`, `onDidReceiveMessage` / `postMessage`)  
- Contribution: `contributes.notebooks`, `contributes.notebookRenderer` (`entrypoint`, `mimeTypes`, `requiresMessaging`: `always` | `optional` | `never`, `dependencies`)  
- Renderer entry: `ActivationFunction` from `vscode-notebook-renderer`; messaging via `notebooks.createRendererMessaging(rendererId)`  
- Built-in mimetypes include `text/html`, `image/png`, `application/javascript`, etc.; custom mimetypes need a renderer  

**AXIS angle:** Strategy backtest notebooks / rich plot outputs as `NotebookRenderer` (chart MIME) instead of only webview panels.

**Citation:** https://code.visualstudio.com/api/extension-guides/notebook (~2026-10-28)

### Chat participants — **deprecated for new Copilot work** (2026)

- Docs now title: **“Chat participants (deprecated)”**. Not supported in the Copilot harness; API kept for Local harness compatibility.  
- Migrate to: **agent plugins / skills**, **MCP tools**, **MCP Apps**, **extension language-model tools**, custom agents.  

**Citation:** https://code.visualstudio.com/api/extension-guides/ai/chat (and `/api/extension-guides/chat` redirect)

### Language Model Tools — **stable** (`vscode.lm`)

- Contribute: `contributes.languageModelTools[]` (`name`, `displayName`, `modelDescription`, `userDescription`, `toolReferenceName`, `canBeReferencedInPrompt`, `inputSchema`, `when`, `icon`, `tags`).  
- Register: `vscode.lm.registerTool(name, tool)` implementing `LanguageModelTool<T>` with `prepareInvocation` (confirmation) and `invoke` → `LanguageModelToolResult` / `LanguageModelTextPart`.  
- Naming: `{verb}_{noun}` (e.g. `get_strategy_metrics`).  
- One of three tool kinds: built-in, **extension tools**, **MCP tools**. Prefer extension tools when you need VS Code APIs; MCP when cross-host reuse / remote.

**Citation:** https://code.visualstudio.com/api/extension-guides/ai/tools (~2026-10-28)

### MCP in VS Code — **full spec support (2025+), extension registration finalized**

- End-user: `.vscode/mcp.json`, user profile, `vscode:mcp/install?...`, CLI `--add-mcp`, autodiscovery.  
- Transports: `stdio`, Streamable `http`, legacy `sse`.  
- Features: Tools, Prompts (slash), Resources (+ templates), Elicitation, Sampling, OAuth auth, Roots, **MCP Apps** (`ui://` + `text/html;profile=mcp-app`, `@modelcontextprotocol/ext-apps`).  
- Extension API (finalized ~May 2025):  
  - Contribute `contributes.mcpServerDefinitionProviders`  
  - `vscode.lm.registerMcpServerDefinitionProvider(providerId, provider)`  
  - Definitions: `McpStdioServerDefinition`, `McpHttpServerDefinition`  
  - `provideMcpServerDefinitions` / `resolveMcpServerDefinition` / `onDidChangeMcpServerDefinitions`  
- Dev mode in mcp.json: `dev.watch`, `dev.debug` (`node` | `debugpy`).  
- Blog milestones: MCP intro May 2025; full spec June 2025; MCP Apps / ongoing 2026 (AHP 1.0, sandboxing of local MCP in 1.141 era).

**Citations:**  
- https://code.visualstudio.com/api/extension-guides/mcp (aka `/api/extension-guides/ai/mcp`)  
- https://code.visualstudio.com/blogs/2025/05/12/agent-mode-meets-mcp  
- https://code.visualstudio.com/blogs/2025/06/12/full-mcp-spec-support  
- Sample: https://github.com/microsoft/vscode-extension-samples/tree/main/mcp-extension-sample  

### Multi-root workspace — **stable**

- `workspace.workspaceFolders`, `workspace.getWorkspaceFolder(uri)`, `workspace.onDidChangeWorkspaceFolders`  
- Folder-scoped settings via `WorkspaceConfiguration` + `ConfigurationTarget.WorkspaceFolder` / `RelativePattern(folder, glob)`  
- AXIS: one folder per symbol universe / data root; resolve chart datasets relative to folder.

### Auxiliary window / editor groups — **stable UX since 1.85; API via open targets**

- User: drag tab to desktop; commands `workbench.action.moveEditorToNewWindow`, `copyEditorToNewWindow`, move/copy **group** variants. Setting `workbench.editor.dragToOpenWindow`.  
- Internals expose `AUX_WINDOW_GROUP` (−3) alongside `ACTIVE_GROUP` / `SIDE_GROUP` for opening editors/terminals in a new auxiliary window (used by workbench; extensions typically use commands or `showTextDocument` / open APIs with column hints).  
- Floating windows restore position and editors across restart. Custom editors and diffs can be dragged out (post-1.85 improvements).

**Citations:**  
- https://code.visualstudio.com/docs/configure/custom-layout  
- https://code.visualstudio.com/updates/v1_85#_floating-editor-windows  

### Status bar — **stable**

- `window.createStatusBarItem(id?, alignment?, priority?)` → `StatusBarItem` (`text`, `tooltip`, `command`, `backgroundColor`, `show`/`hide`)  
- AXIS: live quote, connection state, run epoch, worker health.

### TreeView — **stable**

- Contribute `views` / `viewsContainers`; implement `TreeDataProvider` (`getChildren`, `getTreeItem`); `window.createTreeView` / `registerTreeDataProvider`  
- View actions, drag-and-drop, sticky scroll in trees (`workbench.tree.enableStickyScroll`, since 1.85)  
- AXIS: script library, layers, datasets (prefer TreeView over WebviewView when list/hierarchy fits).

**Citation:** https://code.visualstudio.com/api/extension-guides/tree-view  

### Test API — **stable** (since 1.59)

- `tests.createTestController(id, label)` → `TestController`  
- `TestItem`, `TestRunProfile` (run/debug/coverage), `TestRun`, coverage APIs  
- AXIS: strategy regression / golden-bar tests in Test Explorer.

**Citation:** https://code.visualstudio.com/api/extension-guides/testing  

### Terminal API — **stable** (+ shell integration)

- `window.createTerminal(options?)` → `Terminal` (`sendText`, `show`, `exitStatus`, editor location options)  
- `TerminalShellIntegration`: `cwd`, `executeCommand(...)`; events `onDidChangeTerminalShellIntegration`, `onDidEndTerminalShellExecution`  
- Activation: `onTerminalProfile`, `onTerminalShellIntegration`  
- AXIS: local workers, data feed CLIs, PYNE runners.

### SecretStorage — **stable**

- `ExtensionContext.secrets`: `SecretStorage` with `get(key)`, `store(key, value)`, `delete(key)`, `onDidChange`; newer builds also expose listing via `keys` (tested ~July 2025).  
- Backed by Electron `safeStorage` (OS crypt) + encrypted blobs in user state DB — **not** a multi-user vault; suitable for API keys / exchange tokens on the developer machine.

**Citation:** vscode.d.ts `SecretStorage`; discussions on storage mechanics (Electron safeStorage).

### AuthenticationProvider — **stable**

- `authentication.registerAuthenticationProvider(id, label, provider, options?)`  
- `AuthenticationProvider`: `getSessions`, `createSession`, `removeSession`, `onDidChangeSessions`  
- Options: `supportsMultipleAccounts`  
- Consumers: `authentication.getSession`, `authentication.getAccounts(providerId)` (accounts API finalized ~Aug 2024)  
- Built-ins: `'github'`, `'microsoft'`  
- AXIS: broker OAuth to data vendors; prefer this over rolling cookies in webviews. MCP OAuth is separate (Accounts → Manage Trusted MCP Servers).

---

## 4. Extension packing

| Concern | Recommendation |
|---|---|
| Package / publish Marketplace | **`@vscode/vsce`** (scoped; old `vsce` deprecated). Node ≥22 for current vsce. `vsce package` / `vsce publish`. Use `--no-dependencies` when fully bundled (pnpm-friendly). |
| Open VSX (Cursor, etc.) | **`ovsx`** CLI: `npx ovsx publish file.vsix -p $OVSX_TOKEN` |
| Extension pack | `package.json` → `"extensionPack": ["publisher.name", ...]` + `"categories": ["Extension Packs"]`. Soft bundle; extensions independently manageable. |
| Hard dependency | `"extensionDependencies": ["publisher.name"]` — required installs. |
| Bundling | Prefer **esbuild** (official bundling guide) or webpack. `external: ['vscode']`, CJS for desktop `main`; browser build for `browser`. Script `vscode:prepublish`. |
| Web vs desktop | Web: `"browser": "./dist/web/extension.js"` (no Node). Desktop: `"main": "./dist/extension.js"`. Dual-entry for both. `extensionKind`: `ui` \| `workspace`. Web host = browser sandbox (vscode.dev / github.dev / Codespaces web). |
| Marketplace tags | vsce tags web extensions, chat participants, language model tools, MCP contributions automatically from manifest. |

**Citations:**  
- https://code.visualstudio.com/api/working-with-extensions/bundling-extension  
- https://code.visualstudio.com/api/extension-guides/web-extensions  
- https://code.visualstudio.com/api/references/extension-manifest  
- https://github.com/microsoft/vscode-vsce  

---

## 5. Newest UX patterns (workbench)

| Feature | Since / notes | AXIS use |
|---|---|---|
| **Secondary Side Bar** | Side Panel lineage from 1.64; now first-class. Toggle `View: Toggle Secondary Side Bar Visibility` (Ctrl+Alt+B). Setting `workbench.secondarySideBar.defaultVisibility`. Users drag views here; Chat often defaults here. Extensions contribute to Primary; users relocate. | Put Chat/agent + AXIS library on opposite sides of chart |
| **Panel maximize** | When panel alignment is Center, chevron **Maximize Panel Size** fills editor area | Maximize results/equity curve panel |
| **Editor tabs → new window** | **1.85** floating / auxiliary windows; drag-out or Move/Copy into New Window | Multi-monitor chart + code |
| **Sticky scroll** | Editor (`editor.stickyScroll.enabled`); trees (`workbench.tree.enableStickyScroll`, 1.85); terminal sticky scroll (1.85, was opt-in) | Deep Pine/script navigation; library trees |
| **Multi-diff** | Preview in **1.85** (`multiDiffEditor.experimental.enabled`); later Tab kind `MultiDiffEditorInput` / `TabInputTextMultiDiff` in API tabs model | Diff strategy versions / run outputs across files |
| **Notebook renderers** | Stable interactive outputs in iframe; kernel messaging | Inline backtest charts |

**Citations:**  
- https://code.visualstudio.com/docs/configure/custom-layout  
- https://code.visualstudio.com/updates/v1_85  
- https://code.visualstudio.com/docs/getstarted/userinterface  

---

## 6. Webview performance & security constraints

1. **CSP (required practice)**  
   - Meta tag e.g. `default-src 'none'; img-src ${webview.cspSource} https:; script-src ${webview.cspSource}; style-src ${webview.cspSource};`  
   - Use `webview.cspSource`; avoid inline scripts/styles; load via `asWebviewUri`.  
2. **`localResourceRoots`** — tighten to extension `media/` (or `[]`); not a complete security boundary alone.  
3. **Message passing** — `webview.postMessage` ↔ `acquireVsCodeApi().postMessage`; JSON-serializable only; validate on both sides; sanitize any user/workspace HTML.  
4. **State**  
   - Prefer **`getState` / `setState`** inside the webview (survives hide; cheap).  
   - **`WebviewPanelSerializer.deserializeWebviewPanel`** + activation `onWebviewPanel:viewType` for process restart.  
   - **`retainContextWhenHidden: true`** only for heavy UIs that cannot restore quickly (keeps iframe alive → **high memory**). Official docs: setState preferred over retainContext.  
5. **Lifecycle** — hidden webviews tear down DOM unless retained; don’t run intervals after `onDidDispose`; `enableScripts` only if needed.  
6. **Theming** — `body.vscode-light|dark|high-contrast`, CSS vars `--vscode-editor-foreground`, etc.  
7. **Charts** — for AXIS high-frequency series: minimize postMessage payload (transfer aggregates, not every tick); debounce document sync; consider OffscreenCanvas/workers **inside** webview; avoid full `webview.html` resets (destroys JS state).

**Citation:** https://code.visualstudio.com/api/extension-guides/webview#content-security-policy and Persistence sections.

---

## 7. Recommended testing

| Layer | Tool | Role |
|---|---|---|
| Integration (Extension Host) | **`@vscode/test-electron`** + **`@vscode/test-cli`** (`vscode-test` script, `.vscode-test.js`) | Real `vscode` API, Mocha; CI with xvfb on Linux |
| Web extension | **`@vscode/test-web`** (`vscode-test-web`, Chromium/Firefox/WebKit) | Browser extension host |
| UI / E2E | **`vscode-extension-tester`** (ExTester, ~8.28.x) + Mocha; optional **ExTester Runner** marketplace extension | Selenium page objects (Activity Bar, webviews, dialogs); screenshots; **c8** coverage via `--coverage` / `-C` |
| Unit | Mocha/Jest + sinon; **jsdom** for webview scripts without host | Fast pure logic / CSP helpers |
| Coverage strategy | c8/nyc on unit + ExTester coverage flag; API tests for providers; smoke UI for chart pane open, panel results, custom editor dirty/save | Gate on critical paths (editor resolve, message protocol, SecretStorage mock) |

**Citations:**  
- https://code.visualstudio.com/api/working-with-extensions/testing-extension  
- https://code.visualstudio.com/api/extension-guides/web-extensions (test-web section)  
- https://www.npmjs.com/package/vscode-extension-tester  
- https://github.com/redhat-developer/vscode-extension-tester/wiki  

---

## Recommended stack for AXIS IDE extension

- **Chart document pane:** `CustomReadonlyEditorProvider` or `CustomEditorProvider` (resource-backed chart workspace) with a high-performance webview; use `CustomTextEditorProvider` for visual editing of text strategy/source files.  
- **Ephemeral chart lab / tools:** `WebviewPanel` + `WebviewPanelSerializer` + `setState`/`getState`; avoid `retainContextWhenHidden` unless profiling demands it.  
- **Results / strategy / library side UI:** prefer `TreeView` + status bar; use `WebviewView` in Panel/Sidebar only for rich HTML (equity curves, fill legends).  
- **Multi-monitor:** rely on auxiliary/floating windows (1.85+); ensure custom editors behave with `supportsMultipleEditorsPerDocument: true` when sync is correct.  
- **AI surface (2026):** do **not** invest in new Chat Participants; contribute `languageModelTools` for deep VS Code integration **and** register AXIS/PYNE via `lm.registerMcpServerDefinitionProvider` (reuse existing MCP). Consider MCP Apps for interactive tool UI in chat.  
- **Notebooks (optional):** `NotebookController` + custom `NotebookRenderer` for backtest MIME outputs.  
- **Secrets / auth:** `context.secrets` for keys; `AuthenticationProvider` or built-in GitHub/Microsoft where applicable.  
- **Packaging:** esbuild dual bundle (`main` + `browser` if web matters), `@vscode/vsce` + `ovsx`, optional `extensionPack` for AXIS + helpers; `extensionDependencies` only for hard requirements.  
- **Quality:** `@vscode/test-electron` + `@vscode/test-web` + ExTester UI smoke; strict webview CSP; message-schema versioning between host and chart iframe.

---

*Generated for AXIS IDE planning. Prefer linked official docs for signature-level drift; vscode.d.ts on `microsoft/vscode` main is the source of truth for exact method lists.*
