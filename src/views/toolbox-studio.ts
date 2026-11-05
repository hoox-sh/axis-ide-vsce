// Copyright (C) 2026 jango_blockchained
//
// This file is part of AXIS IDE (hoox-sh.axis-ide).
//
// AXIS IDE is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, version 3 of the License only.
//
// AXIS IDE is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with AXIS IDE.  If not, see <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Toolbox studio registration module — pure-host structural helpers and the
 * `StudioRegistration` for the consolidated `axis.toolbox` view. The VS Code
 * panel wrapper that consumes this registration will be added in a follow-up
 * PR that updates `src/extension.ts` (kept untouched in this subtask).
 *
 * This module intentionally mirrors `colors-studio.ts` and `symbols-studio.ts`:
 * view id, body markup, editor scan helpers, and insert-position logic. The
 * concrete clipboard / editor actions are injected through `ToolboxPanelDeps`
 * so the registration object remains testable without a `vscode` runtime.
 */

import { registerStudioView, type StudioProviderDeps, type StudioViewHost, type StudioViewProvider } from './studio-provider';
import {
  TOOLBOX_STUDIO_VIEW,
  buildToolboxStudioData,
  toolboxColorsDataFromEditor,
  toolboxCopyColorTextFromArgs,
  toolboxCopySymbolTextFromArgs,
  toolboxDataFromEditor,
  toolboxDocumentTriggersRefresh,
  toolboxInsertPositions,
  toolboxInsertSymbolFromArgs,
  toolboxRevealColorLineFromArgs,
  toolboxSelectTabFromArgs,
  toolboxSymbolsData,
  type ToolboxEditorLike,
  type ToolboxInsertEditorLike,
  type ToolboxPositionLike,
  type ToolboxSelectionLike,
  type ToolboxStudioData,
  type ToolboxTab,
} from './toolbox-messages';
import type { StudioRegistration } from './studio-registry';

/** VS Code view id — the `axis.toolbox` panel view (package.json twin). */
export const TOOLBOX_STUDIO_VIEW_ID = 'axis.toolbox';

/** Human title — the package.json view-name twin. */
export const TOOLBOX_STUDIO_TITLE = 'Toolbox';

/** Structural slice of `vscode.Position` used by the insert helper. */
export interface ToolboxInsertPositionLike extends ToolboxPositionLike {}

/** Structural slice of `vscode.Selection` used by the insert helper. */
export interface ToolboxInsertSelectionLike extends ToolboxSelectionLike {}

/** Structural slice of `vscode.TextEditor` used by the insert helper. */
export interface ToolboxInsertTextEditorLike extends ToolboxInsertEditorLike {}

/**
 * Body markup for the Toolbox studio. The consolidated webview mounts into
 * `#toolbox-root` and renders the Colors/Symbols tabs client-side.
 */
export function buildToolboxStudioBody(): string {
  return `<section id="toolbox-root" class="toolbox-root" data-axis-toolbox-host="1" aria-label="Toolbox">
  <div class="toolbox-shell">
    <nav class="toolbox-tabs" role="tablist" aria-label="Toolbox tabs">
      <button type="button" class="toolbox-tab" role="tab" data-tab="colors" aria-selected="true" aria-controls="toolbox-panel-colors">Colors</button>
      <button type="button" class="toolbox-tab" role="tab" data-tab="symbols" aria-selected="false" aria-controls="toolbox-panel-symbols">Symbols</button>
    </nav>
    <div class="toolbox-panels">
      <div id="toolbox-panel-colors" class="toolbox-panel" role="tabpanel" aria-label="Colors tab"></div>
      <div id="toolbox-panel-symbols" class="toolbox-panel" role="tabpanel" aria-label="Symbols tab" hidden></div>
    </div>
  </div>
</section>`;
}

/**
 * Scan the active editor for the toolbox. Colors tab uses the Pine editor;
 * Symbols tab always starts with the full symbol catalog.
 */
export function toolboxDataFromActiveEditor(
  editor: ToolboxEditorLike | null | undefined,
  activeTab?: ToolboxTab,
): ToolboxStudioData {
  return toolboxDataFromEditor(editor, activeTab);
}

/** Refresh guard: only the active Pine document triggers a color rescan. */
export function toolboxDocumentNeedsRefresh(
  editor: ToolboxEditorLike | null | undefined,
  document: unknown,
): boolean {
  return toolboxDocumentTriggersRefresh(editor, document);
}

/**
 * Cursor positions to insert a symbol at — every distinct `selection.active`
 * across the editor's selections, deduped by `line:character`, falling back to
 * the primary selection. Reusable by host commands.
 */
export function toolboxInsertSymbolPositions<T extends ToolboxInsertPositionLike = ToolboxInsertPositionLike>(
  editor: ToolboxInsertTextEditorLike | null | undefined,
): T[] {
  return toolboxInsertPositions<T>(editor);
}

/**
 * Injected dependencies for the consolidated toolbox actions. Keeping these
 * explicit lets `buildToolboxStudioRegistration` stay pure-host and testable;
 * the panel wrapper will provide real `vscode` implementations.
 */
export interface ToolboxPanelDeps {
  /** Reveal a 1-based line in the active Pine editor. */
  revealColorLine(line: number): void;
  /** Copy a color literal to the clipboard. */
  copyColorText(text: string): void;
  /** Rescan the active editor and post the result to the webview. */
  refreshColors(): void;
  /** Insert a symbol at the current cursor(s). */
  insertSymbolText(text: string): void;
  /** Copy a symbol character to the clipboard. */
  copySymbolText(text: string): void;
  /** Current composite data for the `restore()` handshake. */
  restore(): ToolboxStudioData;
}

/**
 * Build the `StudioRegistration` consumed by the generic provider. All VS Code
 * side effects are supplied by `deps`; this factory is pure-host and covered.
 */
export function buildToolboxStudioRegistration(deps: ToolboxPanelDeps): StudioRegistration {
  return {
    id: TOOLBOX_STUDIO_VIEW,
    title: TOOLBOX_STUDIO_TITLE,
    viewId: TOOLBOX_STUDIO_VIEW_ID,
    retainContextWhenHidden: false,
    buildBody: buildToolboxStudioBody,
    actions: {
      selectTab: () => {
        // Tab switching is handled by the webview; the host accepts the action
        // so the router does not log an unknown action.
      },
      revealColorLine: (args) => {
        const line = toolboxRevealColorLineFromArgs(args);
        if (line !== null) deps.revealColorLine(line);
      },
      copyColorText: (args) => {
        const text = toolboxCopyColorTextFromArgs(args);
        if (text !== null) deps.copyColorText(text);
      },
      refreshColors: () => {
        deps.refreshColors();
      },
      insertSymbol: (args) => {
        const text = toolboxInsertSymbolFromArgs(args);
        if (text !== null) deps.insertSymbolText(text);
      },
      copySymbolText: (args) => {
        const text = toolboxCopySymbolTextFromArgs(args);
        if (text !== null) deps.copySymbolText(text);
      },
    },
    restore: () => deps.restore(),
  };
}

/**
 * Default composite data source for the panel wrapper. Mirrors the legacy
 * handshake payloads: Colors tab reflects the active Pine editor, Symbols tab
 * ships the full catalog.
 */
export function defaultToolboxRestore(
  editor: ToolboxEditorLike | null | undefined,
  activeTab?: ToolboxTab,
): ToolboxStudioData {
  return buildToolboxStudioData(
    toolboxColorsDataFromEditor(editor),
    toolboxSymbolsData(),
    activeTab,
  );
}

/** Minimal context surface required by `registerToolbox`. */
export interface ToolboxContextLike {
  subscriptions: Array<{ dispose(): void }>;
}

/** Host surface required by `registerToolbox`. */
export interface ToolboxRegisterHost extends StudioViewHost {}

/**
 * `registerToolbox` is the future `extension.ts` surface: it wires the
 * consolidated toolbox studio through the generic provider. The concrete VS
 * Code implementations of `deps` will be assembled by the panel wrapper in the
 * follow-up PR. Kept pure-host here so it is fully testable.
 */
export function registerToolbox(
  entry: StudioRegistration,
  deps: StudioProviderDeps,
  host: ToolboxRegisterHost,
  context: ToolboxContextLike,
): StudioViewProvider | undefined {
  return registerStudioView(entry, deps, host, context);
}

// Re-export the structural helpers so callers can import everything toolbox
// from this module without reaching into `toolbox-messages`.
export {
  TOOLBOX_STUDIO_VIEW,
  toolboxColorsDataFromEditor,
  toolboxCopyColorTextFromArgs,
  toolboxCopySymbolTextFromArgs,
  toolboxDataFromEditor,
  toolboxDocumentTriggersRefresh,
  toolboxInsertPositions,
  toolboxInsertSymbolFromArgs,
  toolboxRevealColorLineFromArgs,
  toolboxSelectTabFromArgs,
  toolboxSymbolsData,
};
export type { ToolboxEditorLike, ToolboxStudioData, ToolboxTab };
