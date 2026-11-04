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
 * Colors studio registration module (enhancement plan §5 Phase 2): the pure
 * pieces the generic provider needs from the colors panel — the webview
 * body markup the old `colors-html.ts` shell carried (ids/classes are the
 * contract with `webview/colors/src/main.ts`), the VS Code view id, and the
 * structural editor helpers the panel shim wires into `restore()` and the
 * reveal action. Pure — no vscode.
 */

import {
  colorsStudioData,
  isPineEditorLanguage,
  pineSourceLabel,
  scanColors,
  type ColorsStudioData,
} from './colors-messages';

/** VS Code view id — the `axis.colors` panel view (package.json twin). */
export const COLORS_STUDIO_VIEW_ID = 'axis.colors';

/** Human title — the package.json view-name twin. */
export const COLORS_STUDIO_TITLE = 'Colors';

/** Structural slice of `vscode.TextEditor` the colors scan reads. */
export interface ColorsEditorLike {
  document: {
    languageId: unknown;
    getText(): string;
    fileName: string;
    uri: { fsPath: string };
  };
}

/**
 * Body markup for the Colors studio — byte-identical to the body section
 * the old `colors-html.ts` shell emitted (the generic `buildStudioHtml`
 * wraps it with the same CSP shell, theme class, and script tag). The
 * webview JS depends on every id/class/aria attribute below.
 */
export function buildColorsStudioBody(): string {
  return `<section id="colors-root" class="colors-root" data-axis-colors-host="1" aria-label="Colors">
    <header class="colors-header">
      <div class="colors-header__top">
        <h1 class="colors-title">Colors</h1>
        <p class="colors-meta">
          <span id="colors-count" class="colors-count">0</span>
          <span id="colors-source" class="colors-source" title=""></span>
        </p>
        <button type="button" id="colors-refresh" class="colors-refresh" title="Re-scan the active editor">Refresh</button>
      </div>
      <label class="colors-search-label" for="colors-search">Search</label>
      <input id="colors-search" class="colors-search" type="search" placeholder="Filter by raw text" autocomplete="off" spellcheck="false" aria-label="Filter colors by raw text" />
      <div class="colors-filters" role="group" aria-label="Color kind filter">
        <button type="button" class="colors-chip" data-kind="all" aria-pressed="true">All</button>
        <button type="button" class="colors-chip" data-kind="hex" aria-pressed="false">Hex</button>
        <button type="button" class="colors-chip" data-kind="named" aria-pressed="false">Named</button>
        <button type="button" class="colors-chip" data-kind="rgb-new" aria-pressed="false">rgb/new</button>
      </div>
    </header>
    <p id="colors-empty" class="colors-empty" role="status">No colors in this script</p>
    <ul id="colors-list" class="colors-list" aria-label="Colors in this script" tabindex="0"></ul>
  </section>`;
}

/**
 * Scan one editor for the Colors studio data (the old panel's `scanActive`).
 * A non-Pine or missing editor yields the empty scan with the
 * `No Pine editor` source label; a hostile editor throws exactly like the
 * old inline scan did (the callers wrap). Pure — the panel passes
 * `vscode.window.activeTextEditor`.
 */
export function colorsDataFromEditor(editor: ColorsEditorLike | null | undefined): ColorsStudioData {
  const pine =
    editor && isPineEditorLanguage(editor.document.languageId) ? editor : undefined;
  const source = pine ? pine.document.getText() : '';
  const sourceLabel = pine
    ? pineSourceLabel(pine.document.fileName || pine.document.uri.fsPath)
    : 'No Pine editor';
  return colorsStudioData(scanColors(source), sourceLabel);
}

/**
 * Old `refreshIfDocument` guard: document edits rescan only when the
 * changed document IS the active Pine editor's document.
 */
export function colorsDocumentTriggersRefresh(
  editor: ColorsEditorLike | null | undefined,
  document: unknown,
): boolean {
  if (!editor) return false;
  if (editor.document !== document) return false;
  return isPineEditorLanguage(editor.document.languageId);
}

/**
 * Clamp a 1-based source line to a valid 0-based line index for
 * `document.lineAt` (the old reveal clamp, verbatim).
 */
export function colorsRevealIndex(line: number, lineCount: number): number {
  const last = Math.max(0, lineCount - 1);
  return Math.min(Math.max(0, line - 1), last);
}
