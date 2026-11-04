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
import { htmlHasInlineScript } from './studio-html';
import {
  buildColorsStudioBody,
  colorsDataFromEditor,
  colorsDocumentTriggersRefresh,
  colorsRevealIndex,
  COLORS_STUDIO_TITLE,
  COLORS_STUDIO_VIEW_ID,
  type ColorsEditorLike,
} from './colors-studio';

/** Fake pine editor matching the structural slice the scan reads. */
function editor(text: string, overrides: Partial<ColorsEditorLike['document']> = {}): ColorsEditorLike {
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

describe('colors studio registration constants', () => {
  test('view id and title match the package.json contributes', () => {
    expect(COLORS_STUDIO_VIEW_ID).toBe('axis.colors');
    expect(COLORS_STUDIO_TITLE).toBe('Colors');
  });
});

describe('buildColorsStudioBody', () => {
  test('emits the exact old colors-html body markup the webview depends on', () => {
    const body = buildColorsStudioBody();
    expect(body).toContain('<section id="colors-root" class="colors-root" data-axis-colors-host="1" aria-label="Colors">');
    expect(body).toContain('<header class="colors-header">');
    expect(body).toContain('<h1 class="colors-title">Colors</h1>');
    expect(body).toContain('<span id="colors-count" class="colors-count">0</span>');
    expect(body).toContain('<span id="colors-source" class="colors-source" title=""></span>');
    expect(body).toContain(
      '<button type="button" id="colors-refresh" class="colors-refresh" title="Re-scan the active editor">Refresh</button>',
    );
    expect(body).toContain('<label class="colors-search-label" for="colors-search">Search</label>');
    expect(body).toContain(
      '<input id="colors-search" class="colors-search" type="search" placeholder="Filter by raw text" autocomplete="off" spellcheck="false" aria-label="Filter colors by raw text" />',
    );
    expect(body).toContain('<div class="colors-filters" role="group" aria-label="Color kind filter">');
    expect(body).toContain(
      '<button type="button" class="colors-chip" data-kind="all" aria-pressed="true">All</button>',
    );
    expect(body).toContain(
      '<button type="button" class="colors-chip" data-kind="hex" aria-pressed="false">Hex</button>',
    );
    expect(body).toContain(
      '<button type="button" class="colors-chip" data-kind="named" aria-pressed="false">Named</button>',
    );
    expect(body).toContain(
      '<button type="button" class="colors-chip" data-kind="rgb-new" aria-pressed="false">rgb/new</button>',
    );
    expect(body).toContain('<p id="colors-empty" class="colors-empty" role="status">No colors in this script</p>');
    expect(body).toContain(
      '<ul id="colors-list" class="colors-list" aria-label="Colors in this script" tabindex="0"></ul>',
    );
    expect(body.trimEnd().endsWith('</section>')).toBe(true);
    expect(body.startsWith('<section')).toBe(true);
    expect(htmlHasInlineScript(body)).toBe(false);
  });
});

describe('colorsDataFromEditor', () => {
  test('scans the active Pine editor (the old scanActive)', () => {
    const data = colorsDataFromEditor(editor('color.red\n#fff'));
    expect(data).toEqual({
      colors: [
        { line: 1, column: 1, raw: 'color.red', swatch: '#FF0000' },
        { line: 2, column: 1, raw: '#fff', swatch: '#fff' },
      ],
      sourceLabel: 'rsi.pyne',
    });
  });

  test('accepts the pine language id and empty sources', () => {
    expect(colorsDataFromEditor(editor('', { languageId: 'pine' }))).toEqual({
      colors: [],
      sourceLabel: 'rsi.pyne',
    });
    expect(colorsDataFromEditor(null)).toEqual({
      colors: [],
      sourceLabel: 'No Pine editor',
    });
    expect(colorsDataFromEditor(undefined)).toEqual({
      colors: [],
      sourceLabel: 'No Pine editor',
    });
  });

  test('non-Pine editors post the empty scan with the No Pine editor label', () => {
    expect(colorsDataFromEditor(editor('color.red', { languageId: 'python' }))).toEqual({
      colors: [],
      sourceLabel: 'No Pine editor',
    });
  });

  test('falls back to uri.fsPath when the file name is blank', () => {
    const data = colorsDataFromEditor(editor('#fff', { fileName: '' }));
    expect(data.sourceLabel).toBe('rsi.pyne');
  });

  test('hostile editors throw like the old inline scan (callers wrap)', () => {
    const hostile = {
      get document(): never {
        throw new Error('doc');
      },
    };
    expect(() => colorsDataFromEditor(hostile as never)).toThrow('doc');
    const hostileText = editor('color.red', {
      getText(): string {
        throw new Error('text');
      },
    });
    expect(() => colorsDataFromEditor(hostileText)).toThrow('text');
  });
});

describe('colorsDocumentTriggersRefresh', () => {
  test('only the active Pine editor document triggers a rescan', () => {
    const pine = editor('color.red');
    const other = editor('color.red', { fileName: '/tmp/other.pyne' });
    expect(colorsDocumentTriggersRefresh(pine, pine.document)).toBe(true);
    expect(colorsDocumentTriggersRefresh(pine, other.document)).toBe(false);
    expect(colorsDocumentTriggersRefresh(null, pine.document)).toBe(false);
    expect(colorsDocumentTriggersRefresh(undefined, pine.document)).toBe(false);
    expect(colorsDocumentTriggersRefresh(editor('x', { languageId: 'python' }), undefined)).toBe(
      false,
    );
  });
});

describe('colorsRevealIndex', () => {
  test('clamps the 1-based line into a 0-based index (the old reveal clamp)', () => {
    expect(colorsRevealIndex(1, 5)).toBe(0);
    expect(colorsRevealIndex(3, 5)).toBe(2);
    expect(colorsRevealIndex(99, 3)).toBe(2);
    expect(colorsRevealIndex(0, 5)).toBe(0);
    expect(colorsRevealIndex(2, 1)).toBe(0);
    expect(colorsRevealIndex(5, 0)).toBe(0);
    expect(colorsRevealIndex(4, 4)).toBe(3);
  });
});
