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
 * Toolbox studio host messages — the consolidated `axis.toolbox` panel that
 * merges the legacy `axis.colors` and `axis.symbols` views. The data model,
 * action args validators, and color-palette helpers live here; the VS Code
 * glue lives in `toolbox-studio.ts`. Everything is pure-host (no vscode).
 *
 * Host → view: the generic studio provider encodes `studio.init` /
 * `studio.set` carrying `{ view: 'toolbox', data }` where `data` is
 * `{ activeTab, tabs: { colors, symbols } }`. Both tab payloads preserve the
 * exact legacy `colors.set` / `symbols.set` shapes (`ColorsStudioData` and
 * `SymbolsStudioData`).
 *
 * View → host: the shared router decodes `studio.ready` / `studio.action`;
 * the toolbox action namespace is: selectTab, revealColorLine, copyColorText,
 * refreshColors, insertSymbol, copySymbolText.
 */

import {
  MAX_COLORS_COPY_TEXT,
  NAMED_COLOR_SWATCH,
  PINE_EDITOR_LANGUAGE_IDS,
  colorKind,
  colorsCopyTextFromArgs,
  colorsRevealLineFromArgs,
  colorsStudioData,
  isPineEditorLanguage,
  pineSourceLabel,
  scanColors,
  type ColorHit,
  type ColorKind,
  type ColorsStudioData,
} from './colors-messages';
import {
  MAX_SYMBOL_TEXT,
  SYMBOL_CATEGORIES,
  SYMBOL_CATEGORY_LABELS,
  filterSymbols,
  isSymbolCategory,
  listSymbols,
  symbolCategoryLabel,
  symbolsStudioData,
  symbolsTextFromArgs,
  type AxisSymbol,
  type SymbolCategory,
  type SymbolsStudioData,
} from './symbols-messages';

/** Wire view id for the consolidated Toolbox studio. */
export const TOOLBOX_STUDIO_VIEW = 'toolbox';

/** Tabs owned by the toolbox. */
export type ToolboxTab = 'colors' | 'symbols';

/** Composite `studio.init` / `studio.set` data for `axis.toolbox`. */
export interface ToolboxStudioData {
  activeTab: ToolboxTab;
  tabs: {
    colors: ColorsStudioData;
    symbols: SymbolsStudioData;
  };
}

/**
 * Rich color row exposed to the consolidated webview renderer. The wire
 * payload stays `ColorsStudioData`; this is a host-side view-model helper.
 */
export interface ToolboxColorRow extends ColorHit {
  /** Client-side chip filter. */
  kind: ColorKind;
  /** True when the swatch is safe to paint in the DOM. */
  safe: boolean;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Safe CSS color whitelist (matches `webview/colors/src/protocol.ts`).
 * Raw / unresolved literals remain paintable as code, not background-color.
 */
const SAFE_SWATCH =
  /^(?:#[0-9A-Fa-f]{3}|#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{8}|rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)|rgba\(\d{1,3}, \d{1,3}, \d{1,3}, (?:0|1|0\.\d{1,3})\))$/;

/** True when a swatch string is safe to apply as a CSS background-color. */
export function isSafeSwatch(value: string): boolean {
  return SAFE_SWATCH.test(value);
}

/**
 * Translate a flat color scan into the view-model rows the consolidated
 * toolbox renderer expects. Each row keeps the legacy `ColorHit` fields and
 * adds `kind` / `safe` derived values. This never mutates the input.
 */
export function toolboxColorRows(colors: readonly ColorHit[]): ToolboxColorRow[] {
  const out: ToolboxColorRow[] = [];
  for (const hit of colors) {
    out.push({
      line: hit.line,
      column: hit.column,
      raw: hit.raw,
      swatch: hit.swatch,
      kind: colorKind(hit.raw),
      safe: isSafeSwatch(hit.swatch),
    });
  }
  return out;
}

/**
 * Build the composite `studio.set` / `studio.init` data for the toolbox.
 * `activeTab` defaults to `'colors'` when omitted or invalid; the tab payloads
 * are deep copies so later host mutation does not leak into the webview.
 */
export function buildToolboxStudioData(
  colorsData: ColorsStudioData,
  symbolsData: SymbolsStudioData,
  activeTab?: ToolboxTab,
): ToolboxStudioData {
  return {
    activeTab: activeTab === 'symbols' ? 'symbols' : 'colors',
    tabs: {
      colors: colorsStudioData(colorsData.colors, colorsData.sourceLabel),
      symbols: symbolsStudioData(symbolsData.symbols, symbolsData.query, symbolsData.category),
    },
  };
}

/**
 * Validate a `selectTab` action argument. Only the two toolbox tabs are
 * accepted; anything else becomes `null` and is ignored by the handler.
 */
export function toolboxSelectTabFromArgs(args: unknown): ToolboxTab | null {
  try {
    if (!isPlainObject(args)) return null;
    const tab = args.tab;
    if (tab === 'colors' || tab === 'symbols') return tab;
    return null;
  } catch {
    return null;
  }
}

/**
 * Validate `revealColorLine` action args: a 1-based integer line.
 * Invalid args are `null`. Never throws.
 */
export function toolboxRevealColorLineFromArgs(args: unknown): number | null {
  return colorsRevealLineFromArgs(args);
}

/**
 * Validate `copyColorText` action args: a non-empty string capped at
 * `MAX_COLORS_COPY_TEXT`. Invalid args are `null`.
 */
export function toolboxCopyColorTextFromArgs(args: unknown): string | null {
  return colorsCopyTextFromArgs(args);
}

/**
 * Validate `refreshColors` action args. The action accepts no arguments or an
 * empty object; any other shape is rejected (`false`).
 */
export function toolboxRefreshColorsFromArgs(args: unknown): boolean {
  try {
    if (args === undefined) return true;
    return isPlainObject(args) && Object.keys(args).length === 0;
  } catch {
    return false;
  }
}

/**
 * Validate `insertSymbol` action args: a non-empty string capped at
 * `MAX_SYMBOL_TEXT`. Invalid args are `null`.
 */
export function toolboxInsertSymbolFromArgs(args: unknown): string | null {
  return symbolsTextFromArgs(args);
}

/**
 * Validate `copySymbolText` action args: a non-empty string capped at
 * `MAX_SYMBOL_TEXT`. Invalid args are `null`.
 */
export function toolboxCopySymbolTextFromArgs(args: unknown): string | null {
  return symbolsTextFromArgs(args);
}

// Re-export the legacy shapes and helpers so callers can import everything
// toolbox-related from one module. This keeps extension.ts and the webview
// protocol bridge free of direct colors/symbols imports during consolidation.
export {
  colorKind,
  colorsCopyTextFromArgs,
  colorsRevealLineFromArgs,
  colorsStudioData,
  isPineEditorLanguage,
  pineSourceLabel,
  scanColors,
  filterSymbols,
  isSymbolCategory,
  listSymbols,
  symbolCategoryLabel,
  symbolsStudioData,
  symbolsTextFromArgs,
};
export {
  MAX_COLORS_COPY_TEXT,
  MAX_SYMBOL_TEXT,
  NAMED_COLOR_SWATCH,
  PINE_EDITOR_LANGUAGE_IDS,
  SYMBOL_CATEGORIES,
  SYMBOL_CATEGORY_LABELS,
};
export type { AxisSymbol, ColorHit, ColorKind, ColorsStudioData, SymbolCategory, SymbolsStudioData };

/** Default symbols payload for the toolbox (full catalog, no filter). */
export function toolboxSymbolsData(): SymbolsStudioData {
  return symbolsStudioData(listSymbols(), '', '');
}

/** Structural slice of `vscode.TextEditor` the color scan reads. */
export interface ToolboxEditorLike {
  document: {
    languageId: unknown;
    getText(): string;
    fileName: string;
    uri: { fsPath: string };
  };
}

/**
 * Scan the active editor for the Colors tab. A non-Pine or missing editor
 * yields the empty scan with the `No Pine editor` source label.
 */
export function toolboxColorsDataFromEditor(
  editor: ToolboxEditorLike | null | undefined,
): ColorsStudioData {
  const pine = editor && isPineEditorLanguage(editor.document.languageId) ? editor : undefined;
  const source = pine ? pine.document.getText() : '';
  const sourceLabel = pine
    ? pineSourceLabel(pine.document.fileName || pine.document.uri.fsPath)
    : 'No Pine editor';
  return colorsStudioData(scanColors(source), sourceLabel);
}

/**
 * Build the full toolbox data from the active editor. The Symbols tab always
 * starts unfiltered; the Colors tab reflects the active Pine editor.
 */
export function toolboxDataFromEditor(
  editor: ToolboxEditorLike | null | undefined,
  activeTab?: ToolboxTab,
): ToolboxStudioData {
  return buildToolboxStudioData(toolboxColorsDataFromEditor(editor), toolboxSymbolsData(), activeTab);
}

/**
 * Refresh guard: document edits should rescan only when the changed document
 * is the active Pine editor's document.
 */
export function toolboxDocumentTriggersRefresh(
  editor: ToolboxEditorLike | null | undefined,
  document: unknown,
): boolean {
  if (!editor) return false;
  if (editor.document !== document) return false;
  return isPineEditorLanguage(editor.document.languageId);
}

/** Structural slice of a cursor position. */
export interface ToolboxPositionLike {
  line: unknown;
  character: unknown;
}

/** Structural slice of `vscode.Selection` the insert action reads. */
export interface ToolboxSelectionLike {
  active?: ToolboxPositionLike | null;
}

/** Structural slice of `vscode.TextEditor` the insert action reads. */
export interface ToolboxInsertEditorLike {
  selections?: readonly ToolboxSelectionLike[] | null;
  selection?: ToolboxSelectionLike | null;
}

/**
 * Cursor positions to insert at — every distinct `selection.active` across
 * the editor's selections, deduped by `line:character`, falling back to the
 * primary selection. Mirrors the historical `symbolsInsertPositions` helper.
 */
export function toolboxInsertPositions<T extends ToolboxPositionLike = ToolboxPositionLike>(
  editor: ToolboxInsertEditorLike | null | undefined,
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
