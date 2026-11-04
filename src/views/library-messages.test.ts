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
import type { BuiltinCatalogEntry } from '../host/builtins';
import { encode, VIEW_TO_HOST } from '../protocol';
import { buildStudioHtml, htmlHasInlineScript } from './studio-html';
import {
  LIBRARY_STUDIO_VIEW,
  buildLibraryBody,
  parseLibraryActionArgs,
  toLibraryCards,
  toLibraryStudioData,
  type LibraryCard,
} from './library-messages';

const CSP_SOURCE = 'https://csp.example.vscode-webview.test';

function entry(partial: Partial<BuiltinCatalogEntry> & { id: string }): BuiltinCatalogEntry {
  return {
    id: partial.id,
    title: partial.title ?? 'Title',
    shorttitle: partial.shorttitle ?? 'ST',
    description: partial.description ?? 'desc',
    category: partial.category ?? 'moving-average',
    categoryLabel: partial.categoryLabel ?? 'Moving averages',
    kind: partial.kind ?? 'indicator',
    overlay: partial.overlay ?? false,
    covers: partial.covers ?? 'covers',
    tags: partial.tags ?? ['ma'],
    code: partial.code ?? '//@version=6\nindicator("SECRET")',
  };
}

describe('toLibraryCards', () => {
  test('strips code and copies display fields', () => {
    const cards = toLibraryCards([
      entry({
        id: 'sma',
        title: 'AXIS SMA',
        shorttitle: 'SMA',
        description: 'Simple moving average',
        category: 'moving-average',
        categoryLabel: 'Moving averages',
        kind: 'indicator',
        overlay: true,
        covers: 'Simple moving average',
        tags: ['ma', 'sma'],
        code: 'SECRET_PINE_SOURCE',
      }),
    ]);
    expect(cards).toEqual([
      {
        id: 'sma',
        title: 'AXIS SMA',
        shorttitle: 'SMA',
        description: 'Simple moving average',
        category: 'moving-average',
        categoryLabel: 'Moving averages',
        kind: 'indicator',
        overlay: true,
        covers: 'Simple moving average',
        tags: ['ma', 'sma'],
      },
    ]);
    expect(cards[0]).not.toHaveProperty('code');
    expect(JSON.stringify(cards)).not.toContain('SECRET_PINE_SOURCE');
  });

  test('strategy kind, blank title fallback, non-string tags skipped', () => {
    const raw = entry({
      id: '  macd  ',
      title: '   ',
      shorttitle: '',
      kind: 'strategy',
      overlay: false,
      description: '',
      tags: ['ok', '', 1, 'two'] as unknown as string[],
    });
    (raw as { covers: unknown }).covers = 4;
    (raw as { category: unknown }).category = null;
    const cards = toLibraryCards([raw]);
    expect(cards[0]?.id).toBe('macd');
    expect(cards[0]?.title).toBe('macd');
    expect(cards[0]?.shorttitle).toBe('macd');
    expect(cards[0]?.kind).toBe('strategy');
    expect(cards[0]?.overlay).toBe(false);
    expect(cards[0]?.tags).toEqual(['ok', 'two']);
    expect(cards[0]?.covers).toBe('');
    expect(cards[0]?.category).toBe('');
    expect(cards[0]?.description).toBe('');
  });

  test('skips non-records, empty ids, and hostile field getters', () => {
    const throwId = {
      get id(): string {
        throw new Error('id');
      },
    };
    const throwTitle = {
      id: 'kept',
      get title(): string {
        throw new Error('title');
      },
      get shorttitle(): string {
        throw new Error('short');
      },
      get description(): string {
        throw new Error('desc');
      },
      get category(): string {
        throw new Error('cat');
      },
      get categoryLabel(): string {
        throw new Error('label');
      },
      get covers(): string {
        throw new Error('covers');
      },
      get kind(): string {
        throw new Error('kind');
      },
      get overlay(): boolean {
        throw new Error('overlay');
      },
      get tags(): string[] {
        throw new Error('tags');
      },
      code: 'NO_LEAK',
    };
    const cards = toLibraryCards([
      null,
      1,
      'x',
      { id: '   ' },
      { id: '' },
      throwId,
      throwTitle,
    ] as unknown as BuiltinCatalogEntry[]);
    expect(cards).toEqual([
      {
        id: 'kept',
        title: 'kept',
        shorttitle: 'kept',
        description: '',
        category: '',
        categoryLabel: '',
        kind: 'indicator',
        overlay: false,
        covers: '',
        tags: [],
      },
    ] satisfies LibraryCard[]);
    expect(JSON.stringify(cards)).not.toContain('NO_LEAK');
  });

  test('non-array and hostile iteration return []', () => {
    expect(toLibraryCards(null as never)).toEqual([]);
    expect(toLibraryCards(undefined as never)).toEqual([]);
    expect(toLibraryCards({} as never)).toEqual([]);
    expect(toLibraryCards('sma' as never)).toEqual([]);
    const hostile = new Proxy([entry({ id: 'a' })], {
      get(target, prop, receiver) {
        if (prop === Symbol.iterator) throw new Error('iter');
        return Reflect.get(target, prop, receiver);
      },
    });
    expect(toLibraryCards(hostile as never)).toEqual([]);
  });

  test('kind other than strategy stays indicator; tags non-array is empty', () => {
    const raw = entry({ id: 'rsi', kind: 'indicator', tags: 'ma' as unknown as string[] });
    (raw as { kind: unknown }).kind = 'nope';
    (raw as { overlay: unknown }).overlay = 1;
    const [card] = toLibraryCards([raw]);
    expect(card?.kind).toBe('indicator');
    expect(card?.overlay).toBe(false);
    expect(card?.tags).toEqual([]);
  });
});

describe('toLibraryStudioData', () => {
  test('init and set data carry cards without code (old library.init payload verbatim)', () => {
    const scripts = [entry({ id: 'ema', title: 'AXIS EMA', code: 'PINE_BODY' })];
    const data = toLibraryStudioData(scripts, 'disk missing');
    expect(data).toEqual({
      cards: [expect.objectContaining({ id: 'ema', title: 'AXIS EMA' })],
      catalogError: 'disk missing',
    });
    expect(JSON.stringify(data)).not.toContain('PINE_BODY');
    expect(toLibraryStudioData(scripts, '').catalogError).toBe('');
    expect(toLibraryStudioData(scripts, 3 as never).catalogError).toBe('');
    expect(toLibraryStudioData(scripts).catalogError).toBe('');
    expect(toLibraryStudioData(null as never)).toEqual({ cards: [], catalogError: '' });
  });
});

describe('parseLibraryActionArgs', () => {
  test('old library.apply / library.copy id validation, moved into args', () => {
    expect(parseLibraryActionArgs({ id: '  sma  ' })).toBe('sma');
    expect(parseLibraryActionArgs({ id: 'ema' })).toBe('ema');
    // ready carried no id and is not an action arg shape
    expect(parseLibraryActionArgs(undefined)).toBeNull();
    expect(parseLibraryActionArgs(null)).toBeNull();
    expect(parseLibraryActionArgs([])).toBeNull();
    expect(parseLibraryActionArgs('sma')).toBeNull();
    expect(parseLibraryActionArgs(1)).toBeNull();
    expect(parseLibraryActionArgs({})).toBeNull();
    expect(parseLibraryActionArgs({ cards: [] })).toBeNull();
    expect(parseLibraryActionArgs({ id: '' })).toBeNull();
    expect(parseLibraryActionArgs({ id: '   ' })).toBeNull();
    expect(parseLibraryActionArgs({ id: 4 })).toBeNull();
    expect(parseLibraryActionArgs({ id: { id: 'sma' } })).toBeNull();
  });

  test('never throws on hostile args getters', () => {
    expect(
      parseLibraryActionArgs({
        get id(): string {
          throw new Error('id');
        },
      }),
    ).toBeNull();
  });

  test('old library.apply / library.copy ride studio.action with the id in args', () => {
    const apply = encode(VIEW_TO_HOST.StudioAction, {
      view: LIBRARY_STUDIO_VIEW,
      action: 'apply',
      args: { id: 'sma' },
    });
    expect(parseLibraryActionArgs(apply.payload.args)).toBe('sma');
    const copy = encode(VIEW_TO_HOST.StudioAction, {
      view: LIBRARY_STUDIO_VIEW,
      action: 'copy',
      args: { id: 'ema' },
    });
    expect(parseLibraryActionArgs(copy.payload.args)).toBe('ema');
  });
});

describe('buildLibraryBody', () => {
  test('carries the live region and the mount the webview JS depends on', () => {
    const body = buildLibraryBody();
    expect(body).toContain('id="library-root"');
    expect(body).toContain('data-axis-library-host="1"');
    expect(body).toContain('id="library-live"');
    expect(body).toContain('aria-live="polite"');
    expect(body).toContain('aria-atomic="true"');
    expect(body).toContain('Loading builtin scripts');
    expect(htmlHasInlineScript(body)).toBe(false);
  });

  test('feeds the generic shell: nonce on script-src, plugins style-src', () => {
    const nonce = 'Abc123';
    const html = buildStudioHtml({
      cspSource: CSP_SOURCE,
      nonce,
      scriptUri: `${CSP_SOURCE}/main.js`,
      styleUri: `${CSP_SOURCE}/main.css`,
      bodyClass: 'vscode-dark',
      bodyHtml: buildLibraryBody(),
    });
    // re-homed from library-html.test.ts (library kept its nonce shell)
    expect(html).toContain(`script-src 'nonce-${nonce}' ${CSP_SOURCE}`);
    expect(html).not.toContain("script-src 'unsafe-inline'");
    expect(html).toContain(`style-src ${CSP_SOURCE} 'unsafe-inline'`);
    expect(html).not.toContain(`style-src 'nonce-${nonce}'`);
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("base-uri 'none'");
    expect(html).toContain("form-action 'none'");
    expect(html).toContain(`img-src ${CSP_SOURCE} data: blob:`);
    expect(html).toContain(`nonce="${nonce}" src="${CSP_SOURCE}/main.js"`);
    expect(html).toContain('id="library-root"');
    expect(html).toContain('id="library-live"');
    expect(htmlHasInlineScript(html)).toBe(false);
  });
});
