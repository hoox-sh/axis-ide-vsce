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
import { encode, HOST_TO_VIEW, VIEW_TO_HOST } from '../protocol';
import { buildStudioHtml, htmlHasInlineScript } from './studio-html';
import {
  WATCHLIST_STUDIO_ACTIONS,
  WATCHLIST_STUDIO_VIEW,
  buildWatchlistBody,
  parseWatchlistSymbolArgs,
} from './watchlist-messages';

const CSP_SOURCE = 'https://csp.example.vscode-webview.test';

describe('buildWatchlistBody', () => {
  test('carries every id/class the webview JS depends on', () => {
    const body = buildWatchlistBody();
    expect(body).toContain('id="watchlist-root"');
    expect(body).toContain('data-axis-watchlist-host="1"');
    expect(body).toContain('id="watchlist-count"');
    expect(body).toContain('id="watchlist-selected"');
    expect(body).toContain('id="watchlist-price"');
    expect(body).toContain('id="watchlist-badge"');
    expect(body).toContain('>placeholder</span>');
    expect(body).toContain('id="watchlist-symbol-input"');
    expect(body).toContain('id="watchlist-add"');
    expect(body).toContain('id="watchlist-empty"');
    expect(body).toContain('BTCUSDT');
    expect(body).toContain('status bar still follows the selected symbol');
    expect(body).toContain('id="watchlist-live"');
    expect(body).toContain('aria-live="polite"');
    expect(body).toContain('<svg');
    expect(body).toContain('aria-atomic="true"');
    expect(htmlHasInlineScript(body)).toBe(false);
  });

  test('feeds the generic shell: cspSource scripts, connect-src none, theme class', () => {
    const html = buildStudioHtml({
      cspSource: CSP_SOURCE,
      scriptUri: `${CSP_SOURCE}/main.js`,
      styleUri: `${CSP_SOURCE}/main.css`,
      bodyClass: 'vscode-dark',
      bodyHtml: buildWatchlistBody(),
    });
    // re-homed from watchlist-html.test.ts (nonce-free builder → nonce-free shell)
    expect(html).toContain(`script-src ${CSP_SOURCE}`);
    expect(html).not.toContain("script-src 'unsafe-inline'");
    expect(html).toContain(`style-src ${CSP_SOURCE} 'unsafe-inline'`);
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("base-uri 'none'");
    expect(html).toContain("form-action 'none'");
    expect(html).toContain(`img-src ${CSP_SOURCE} data: blob:`);
    expect(html).toContain('id="watchlist-root"');
    expect(html).toContain('class="vscode-dark"');
    expect(html).not.toContain('nonce=');
    expect(htmlHasInlineScript(html)).toBe(false);
  });
});

describe('watchlist studio wire', () => {
  test('view id and frozen action set', () => {
    expect(WATCHLIST_STUDIO_VIEW).toBe('watchlist');
    expect([...WATCHLIST_STUDIO_ACTIONS]).toEqual(['add', 'remove', 'select']);
  });

  test('old watchlist.add / remove / select payloads decode from studio.action args', () => {
    for (const action of WATCHLIST_STUDIO_ACTIONS) {
      const envelope = encode(VIEW_TO_HOST.StudioAction, {
        view: WATCHLIST_STUDIO_VIEW,
        action,
        args: { symbol: ' btc usdt ' },
      });
      expect(parseWatchlistSymbolArgs(envelope.payload.args)).toBe('BTCUSDT');
    }
  });

  test('parseWatchlistSymbolArgs keeps the old empty-symbol rejection', () => {
    expect(parseWatchlistSymbolArgs(undefined)).toBeNull();
    expect(parseWatchlistSymbolArgs(null)).toBeNull();
    expect(parseWatchlistSymbolArgs('BTCUSDT')).toBeNull();
    expect(parseWatchlistSymbolArgs(['BTCUSDT'])).toBeNull();
    expect(parseWatchlistSymbolArgs({})).toBeNull();
    expect(parseWatchlistSymbolArgs({ symbol: '   ' })).toBeNull();
    expect(parseWatchlistSymbolArgs({ symbol: 1 })).toBeNull();
    expect(parseWatchlistSymbolArgs({ symbol: 'ETHUSDT' })).toBe('ETHUSDT');
  });

  test('never throws on hostile args getters', () => {
    expect(
      parseWatchlistSymbolArgs({
        get symbol(): string {
          throw new Error('symbol');
        },
      }),
    ).toBeNull();
  });

  test('studio.init / studio.set payloads address the watchlist view', () => {
    const snapshot = { count: 0, selected: null, focusSymbol: null, focusPriceText: '—', placeholder: true, rows: [] };
    const init = encode(HOST_TO_VIEW.StudioInit, {
      view: WATCHLIST_STUDIO_VIEW,
      data: snapshot,
    });
    expect(init.payload.data).toBe(snapshot);
    const set = encode(HOST_TO_VIEW.StudioSet, {
      view: WATCHLIST_STUDIO_VIEW,
      data: snapshot,
    });
    expect(set.payload.data).toBe(snapshot);
  });
});
