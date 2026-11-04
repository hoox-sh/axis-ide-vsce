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
  buildSymbolsStudioBody,
  symbolsInsertPositions,
  SYMBOLS_STUDIO_TITLE,
  SYMBOLS_STUDIO_VIEW_ID,
  type SymbolsPositionLike,
} from './symbols-studio';

describe('symbols studio registration constants', () => {
  test('view id and title match the package.json contributes', () => {
    expect(SYMBOLS_STUDIO_VIEW_ID).toBe('axis.symbols');
    expect(SYMBOLS_STUDIO_TITLE).toBe('Symbols');
  });
});

describe('buildSymbolsStudioBody', () => {
  test('emits the exact old symbols-html body markup the webview depends on', () => {
    const body = buildSymbolsStudioBody();
    expect(body).toContain(
      '<div id="symbols-live" class="symbols-live" role="status" aria-live="polite" aria-atomic="true"></div>',
    );
    expect(body).toContain(
      '<div id="symbols-root" class="symbols-root" data-axis-symbols-host="1"></div>',
    );
    expect(body.startsWith('<div id="symbols-live"')).toBe(true);
    expect(body.trimEnd().endsWith('</div>')).toBe(true);
    expect(body).not.toContain('onclick=');
    expect(htmlHasInlineScript(body)).toBe(false);
  });
});

describe('symbolsInsertPositions', () => {
  type P = { line: number; character: number };

  const at = (line: number, character: number): SymbolsPositionLike => ({ line, character });

  test('returns every distinct selection active position', () => {
    const positions = symbolsInsertPositions<P>({
      selections: [
        { active: at(1, 0) },
        { active: at(2, 5) },
        { active: at(1, 0) },
        { active: undefined },
        {},
        null,
      ],
      selection: { active: at(9, 9) },
    });
    expect(positions).toEqual([
      { line: 1, character: 0 },
      { line: 2, character: 5 },
    ]);
  });

  test('falls back to the primary selection when selections is empty or missing', () => {
    expect(symbolsInsertPositions<P>({ selection: { active: at(3, 1) } })).toEqual([
      { line: 3, character: 1 },
    ]);
    expect(
      symbolsInsertPositions<P>({ selections: [], selection: { active: at(4, 2) } }),
    ).toEqual([{ line: 4, character: 2 }]);
    expect(symbolsInsertPositions<P>({ selections: null, selection: null })).toEqual([]);
    expect(symbolsInsertPositions<P>(null)).toEqual([]);
    expect(symbolsInsertPositions<P>(undefined)).toEqual([]);
  });

  test('missing actives yield no positions (the caller warns)', () => {
    expect(symbolsInsertPositions<P>({})).toEqual([]);
    expect(symbolsInsertPositions<P>({ selection: {} })).toEqual([]);
  });
});
