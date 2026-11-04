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
 * Symbols studio registration module (enhancement plan §5 Phase 2): the pure
 * pieces the generic provider needs from the symbols panel — the webview
 * body markup the old `symbols-html.ts` shell carried (ids/classes are the
 * contract with `webview/symbols/src/main.ts`), the VS Code view id, and
 * the insert-position helper the insert action reads off the active editor.
 * Pure — no vscode.
 */

/** VS Code view id — the `axis.symbols` panel view (package.json twin). */
export const SYMBOLS_STUDIO_VIEW_ID = 'axis.symbols';

/** Human title — the package.json view-name twin. */
export const SYMBOLS_STUDIO_TITLE = 'Symbols';

/** Structural slice of a cursor position (`vscode.Position` shape). */
export interface SymbolsPositionLike {
  line: unknown;
  character: unknown;
}

/** Structural slice of `vscode.Selection` the insert action reads. */
export interface SymbolsSelectionLike {
  active?: SymbolsPositionLike | null;
}

/** Structural slice of `vscode.TextEditor` the insert action reads. */
export interface SymbolsEditorLike {
  selections?: readonly SymbolsSelectionLike[] | null;
  selection?: SymbolsSelectionLike | null;
}

/**
 * Body markup for the Symbols studio — byte-identical to the body section
 * the old `symbols-html.ts` shell emitted (the generic `buildStudioHtml`
 * wraps it with the same CSP shell and script tag). The live region carries
 * the local "Inserted" / "Copied" announcements and `#symbols-root` is the
 * mount the webview script builds its shell into.
 */
export function buildSymbolsStudioBody(): string {
  return `<div id="symbols-live" class="symbols-live" role="status" aria-live="polite" aria-atomic="true"></div>
  <div id="symbols-root" class="symbols-root" data-axis-symbols-host="1"></div>`;
}

/**
 * Cursor positions to insert at — the old panel's `insertPositions`:
 * every distinct `selection.active` across the editor's selections,
 * deduped by `line:character`, falling back to the primary selection.
 * A hostile editor throws exactly like the old inline helper did (the
 * panel wraps the call). Callers pass the position type they read back
 * (`vscode.Position` in the panel).
 */
export function symbolsInsertPositions<T extends SymbolsPositionLike = SymbolsPositionLike>(
  editor: SymbolsEditorLike | null | undefined,
): T[] {
  const selections = editor?.selections?.length ? editor.selections : [editor?.selection];
  const seen = new Set<string>();
  const positions: T[] = [];
  for (const selection of selections) {
    const at = selection?.active;
    if (!at) continue;
    const key = `${at.line}:${at.character}`;
    if (seen.has(key)) continue;
    seen.add(key);
    positions.push(at as T);
  }
  return positions;
}
