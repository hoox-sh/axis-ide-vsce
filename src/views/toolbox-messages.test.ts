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

import { describe, expect, test } from 'bun:test';
import {
  MAX_COLORS_COPY_TEXT,
  MAX_SYMBOL_TEXT,
  NAMED_COLOR_SWATCH,
  PINE_EDITOR_LANGUAGE_IDS,
  SYMBOL_CATEGORIES,
  SYMBOL_CATEGORY_LABELS,
  TOOLBOX_STUDIO_VIEW,
  buildToolboxStudioData,
  colorKind,
  isSafeSwatch,
  toolboxColorRows,
  toolboxColorsDataFromEditor,
  toolboxCopyColorTextFromArgs,
  toolboxCopySymbolTextFromArgs,
  toolboxDataFromEditor,
  toolboxDocumentTriggersRefresh,
  toolboxInsertPositions,
  toolboxInsertSymbolFromArgs,
  toolboxRefreshColorsFromArgs,
  toolboxRevealColorLineFromArgs,
  toolboxSelectTabFromArgs,
  toolboxSymbolsData,
  type ToolboxColorRow,
  type ToolboxEditorLike,
  type ToolboxPositionLike,
  type ToolboxSelectionLike,
} from './toolbox-messages';

describe('toolbox constants and re-exports', () => {
  test('view id and re-exported constants are stable', () => {
    expect(TOOLBOX_STUDIO_VIEW).toBe('toolbox');
    expect(PINE_EDITOR_LANGUAGE_IDS).toEqual(['pinescript', 'pine']);
    expect(SYMBOL_CATEGORIES).toEqual(['arrows', 'shapes', 'box', 'checks', 'stars']);
    expect(Object.keys(NAMED_COLOR_SWATCH)).toHaveLength(17);
    expect(MAX_COLORS_COPY_TEXT).toBe(256);
    expect(MAX_SYMBOL_TEXT).toBe(16);
    expect(SYMBOL_CATEGORY_LABELS.arrows).toBe('Arrows');
  });

  test('color helper re-exports work through the toolbox module', () => {
    expect(colorKind('#fff')).toBe('hex');
    expect(colorKind('color.red')).toBe('named');
  });
});

describe('buildToolboxStudioData', () => {
  test('merges colors and symbols into the composite shape', () => {
    const data = buildToolboxStudioData(
      { colors: [{ line: 1, column: 1, raw: '#fff', swatch: '#fff' }], sourceLabel: 'a.pyne' },
      { symbols: [{ id: 'x', category: 'stars', char: '\u2605', name: 'Star' }], query: 'q', category: 'stars' },
      'colors',
    );
    expect(data).toEqual({
      activeTab: 'colors',
      tabs: {
        colors: { colors: [{ line: 1, column: 1, raw: '#fff', swatch: '#fff' }], sourceLabel: 'a.pyne' },
        symbols: { symbols: [{ id: 'x', category: 'stars', char: '\u2605', name: 'Star' }], query: 'q', category: 'stars' },
      },
    });
  });

  test('defaults activeTab to colors and deep-copies tab payloads', () => {
    const colors = { colors: [{ line: 1, column: 1, raw: '#000', swatch: '#000' }], sourceLabel: 'x' };
    const symbols = { symbols: [], query: '', category: '' };
    const data = buildToolboxStudioData(colors, symbols);
    expect(data.activeTab).toBe('colors');
    data.tabs.colors.sourceLabel = 'mutated';
    expect(colors.sourceLabel).toBe('x');
  });

  test('symbols active is preserved when explicit', () => {
    const data = buildToolboxStudioData(
      { colors: [], sourceLabel: '' },
      { symbols: [], query: '', category: '' },
      'symbols',
    );
    expect(data.activeTab).toBe('symbols');
  });

  test('any non-symbols activeTab falls back to colors', () => {
    expect(
      buildToolboxStudioData(
        { colors: [], sourceLabel: '' },
        { symbols: [], query: '', category: '' },
        'logs' as never,
      ).activeTab,
    ).toBe('colors');
  });
});

describe('toolboxColorRows and isSafeSwatch', () => {
  test('classifies kind and safety for palette rows', () => {
    const rows = toolboxColorRows([
      { line: 1, column: 1, raw: '#fff', swatch: '#fff' },
      { line: 2, column: 1, raw: 'color.red', swatch: '#FF0000' },
      { line: 3, column: 1, raw: 'color.rgb(1,2,3)', swatch: 'rgb(1, 2, 3)' },
      { line: 4, column: 1, raw: 'color.new(#fff, 10)', swatch: 'rgba(255, 255, 255, 0.9)' },
      { line: 5, column: 1, raw: 'color.unknown', swatch: 'color.unknown' },
    ]);
    expect(rows).toEqual([
      { line: 1, column: 1, raw: '#fff', swatch: '#fff', kind: 'hex', safe: true },
      { line: 2, column: 1, raw: 'color.red', swatch: '#FF0000', kind: 'named', safe: true },
      { line: 3, column: 1, raw: 'color.rgb(1,2,3)', swatch: 'rgb(1, 2, 3)', kind: 'rgb-new', safe: true },
      { line: 4, column: 1, raw: 'color.new(#fff, 10)', swatch: 'rgba(255, 255, 255, 0.9)', kind: 'rgb-new', safe: true },
      { line: 5, column: 1, raw: 'color.unknown', swatch: 'color.unknown', kind: 'named', safe: false },
    ] as ToolboxColorRow[]);
  });

  test('isSafeSwatch accepts the CSS forms used by the webview', () => {
    expect(isSafeSwatch('#fff')).toBe(true);
    expect(isSafeSwatch('#aabbcc')).toBe(true);
    expect(isSafeSwatch('#aabbccdd')).toBe(true);
    expect(isSafeSwatch('rgb(1, 2, 3)')).toBe(true);
    expect(isSafeSwatch('rgba(0, 0, 0, 0.5)')).toBe(true);
    expect(isSafeSwatch('rgba(0, 0, 0, 0)')).toBe(true);
    expect(isSafeSwatch('rgba(0, 0, 0, 1)')).toBe(true);
    expect(isSafeSwatch('color.red')).toBe(false);
    expect(isSafeSwatch('#ggg')).toBe(false);
    expect(isSafeSwatch('')).toBe(false);
  });
});

describe('toolbox action args validators', () => {
  test('toolboxSelectTabFromArgs accepts only colors and symbols', () => {
    expect(toolboxSelectTabFromArgs({ tab: 'colors' })).toBe('colors');
    expect(toolboxSelectTabFromArgs({ tab: 'symbols' })).toBe('symbols');
    expect(toolboxSelectTabFromArgs({ tab: 'logs' })).toBeNull();
    expect(toolboxSelectTabFromArgs({})).toBeNull();
    expect(toolboxSelectTabFromArgs(undefined)).toBeNull();
    expect(toolboxSelectTabFromArgs(null)).toBeNull();
    expect(toolboxSelectTabFromArgs([])).toBeNull();
  });

  test('toolboxRevealColorLineFromArgs keeps 1-based integer line validation', () => {
    expect(toolboxRevealColorLineFromArgs({ line: 4 })).toBe(4);
    expect(toolboxRevealColorLineFromArgs({ line: 0 })).toBeNull();
    expect(toolboxRevealColorLineFromArgs({ line: 1.5 })).toBeNull();
    expect(toolboxRevealColorLineFromArgs({ line: '2' })).toBeNull();
    expect(toolboxRevealColorLineFromArgs(undefined)).toBeNull();
  });

  test('toolboxCopyColorTextFromArgs keeps bounded string validation', () => {
    expect(toolboxCopyColorTextFromArgs({ text: '#fff' })).toBe('#fff');
    expect(toolboxCopyColorTextFromArgs({ text: 'x'.repeat(MAX_COLORS_COPY_TEXT) })).toBe(
      'x'.repeat(MAX_COLORS_COPY_TEXT),
    );
    expect(toolboxCopyColorTextFromArgs({ text: '' })).toBeNull();
    expect(toolboxCopyColorTextFromArgs({ text: 'x'.repeat(MAX_COLORS_COPY_TEXT + 1) })).toBeNull();
    expect(toolboxCopyColorTextFromArgs({ text: 1 })).toBeNull();
  });

  test('toolboxRefreshColorsFromArgs accepts no args or an empty object only', () => {
    expect(toolboxRefreshColorsFromArgs(undefined)).toBe(true);
    expect(toolboxRefreshColorsFromArgs({})).toBe(true);
    expect(toolboxRefreshColorsFromArgs(null)).toBe(false);
    expect(toolboxRefreshColorsFromArgs([])).toBe(false);
    expect(toolboxRefreshColorsFromArgs({ force: true })).toBe(false);
    expect(toolboxRefreshColorsFromArgs('refresh')).toBe(false);
    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('keys');
        },
      },
    );
    expect(toolboxRefreshColorsFromArgs(hostile)).toBe(false);
  });

  test('toolboxInsertSymbolFromArgs keeps bounded symbol text validation', () => {
    expect(toolboxInsertSymbolFromArgs({ text: '\u2191' })).toBe('\u2191');
    expect(toolboxInsertSymbolFromArgs({ text: 'x'.repeat(MAX_SYMBOL_TEXT) })).toBe(
      'x'.repeat(MAX_SYMBOL_TEXT),
    );
    expect(toolboxInsertSymbolFromArgs({ text: '' })).toBeNull();
    expect(toolboxInsertSymbolFromArgs({ text: 'x'.repeat(MAX_SYMBOL_TEXT + 1) })).toBeNull();
    expect(toolboxInsertSymbolFromArgs({ text: 1 })).toBeNull();
  });

  test('toolboxCopySymbolTextFromArgs delegates to the shared validator', () => {
    expect(toolboxCopySymbolTextFromArgs({ text: '\u2605' })).toBe('\u2605');
    expect(toolboxCopySymbolTextFromArgs({ text: '' })).toBeNull();
  });

  test('hostile args getters drop the action instead of throwing', () => {
    const hostile = new Proxy(
      {},
      {
        get(_target: unknown, key: string | symbol) {
          if (key === 'tab') throw new Error('boom');
          return undefined;
        },
      },
    );
    expect(() => toolboxSelectTabFromArgs(hostile)).not.toThrow();
    expect(toolboxSelectTabFromArgs(hostile)).toBeNull();
  });
});

describe('toolbox editor helpers', () => {
  function editor(text: string, overrides: Partial<ToolboxEditorLike['document']> = {}): ToolboxEditorLike {
    return {
      document: {
        languageId: 'pinescript',
        getText: () => text,
        fileName: '/tmp/scripts/rsi.pyne',
        uri: { fsPath: '/tmp/scripts/rsi.pyne' },
        ...overrides,
      },
    };
  }

  test('toolboxColorsDataFromEditor scans the active Pine editor', () => {
    expect(toolboxColorsDataFromEditor(editor('color.red\n#fff'))).toEqual({
      colors: [
        { line: 1, column: 1, raw: 'color.red', swatch: '#FF0000' },
        { line: 2, column: 1, raw: '#fff', swatch: '#fff' },
      ],
      sourceLabel: 'rsi.pyne',
    });
  });

  test('toolboxColorsDataFromEditor handles non-Pine and missing editors', () => {
    expect(toolboxColorsDataFromEditor(null)).toEqual({
      colors: [],
      sourceLabel: 'No Pine editor',
    });
    expect(toolboxColorsDataFromEditor(editor('color.red', { languageId: 'python' }))).toEqual({
      colors: [],
      sourceLabel: 'No Pine editor',
    });
  });

  test('toolboxSymbolsData returns the full catalog unfiltered', () => {
    const data = toolboxSymbolsData();
    expect(data.query).toBe('');
    expect(data.category).toBe('');
    expect(data.symbols.length).toBeGreaterThan(0);
  });

  test('toolboxDataFromEditor builds the composite with optional activeTab', () => {
    const full = toolboxDataFromEditor(editor('#abc'), 'symbols');
    expect(full.activeTab).toBe('symbols');
    expect(full.tabs.symbols.symbols.length).toBeGreaterThan(0);
    expect(full.tabs.colors.colors).toEqual([{ line: 1, column: 1, raw: '#abc', swatch: '#abc' }]);
    expect(toolboxDataFromEditor(null).activeTab).toBe('colors');
  });

  test('toolboxDocumentTriggersRefresh guards refresh to the active Pine document', () => {
    const pine = editor('color.red');
    expect(toolboxDocumentTriggersRefresh(pine, pine.document)).toBe(true);
    expect(toolboxDocumentTriggersRefresh(pine, { languageId: 'pinescript' })).toBe(false);
    expect(toolboxDocumentTriggersRefresh(null, pine.document)).toBe(false);
    expect(toolboxDocumentTriggersRefresh(editor('x', { languageId: 'python' }), pine.document)).toBe(false);
  });
});

describe('toolboxInsertPositions', () => {
  const at = (line: number, character: number): ToolboxPositionLike => ({ line, character });

  test('returns distinct active positions from selections', () => {
    const positions = toolboxInsertPositions({
      selections: [
        { active: at(1, 0) },
        { active: at(2, 5) },
        { active: at(1, 0) },
        { active: undefined },
        {},
        null,
      ] as ToolboxSelectionLike[],
      selection: { active: at(9, 9) },
    });
    expect(positions).toEqual([
      { line: 1, character: 0 },
      { line: 2, character: 5 },
    ]);
  });

  test('falls back to the primary selection', () => {
    expect(toolboxInsertPositions({ selection: { active: at(3, 1) } })).toEqual([
      { line: 3, character: 1 },
    ]);
    expect(toolboxInsertPositions({ selections: [], selection: { active: at(4, 2) } })).toEqual([
      { line: 4, character: 2 },
    ]);
    expect(toolboxInsertPositions({ selections: null, selection: null })).toEqual([]);
    expect(toolboxInsertPositions(null)).toEqual([]);
    expect(toolboxInsertPositions(undefined)).toEqual([]);
  });
});
