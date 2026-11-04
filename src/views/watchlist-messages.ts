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
 * Watchlist studio shell body + `studio.*` wire helpers (the studio had no
 * messages module before the migration). Pure — no vscode.
 *
 * Wire mapping from the old flat protocol:
 * - host → view `{ type: 'watchlist.snapshot', snapshot }` became
 *   `studio.init` / `studio.set` carrying `{ view, data }` where `data` is
 *   the exact snapshot object the old message carried in its `snapshot`
 *   field, preserved verbatim (`buildWatchlistSnapshot` still builds it).
 * - view → host `{ type: 'watchlist.ready' }` became `studio.ready`
 *   `{ view: 'watchlist' }`.
 * - view → host `{ type: 'watchlist.add' | 'watchlist.remove' |
 *   'watchlist.select', symbol }` became `studio.action`
 *   `{ view: 'watchlist', action, args: { symbol } }` — the old payload
 *   field moved into `args` verbatim.
 */

import { normalizeWatchlistSymbol } from './watchlist-studio-model';

/** `view` value for every Watchlist studio envelope — exactly `'watchlist'`. */
export const WATCHLIST_STUDIO_VIEW = 'watchlist';

/** `action` names the host accepts on the Watchlist studio. */
export const WATCHLIST_STUDIO_ACTIONS = ['add', 'remove', 'select'] as const;

/**
 * Old `watchlist.add` / `watchlist.remove` / `watchlist.select` validation,
 * moved into `args`: the symbol must normalize (upper-case, whitespace
 * stripped) to a non-empty ticker. Missing / invalid args are ignored
 * exactly like the old parser returned `{ ok: false, reason: 'empty-symbol' }`.
 * Never throws.
 */
export function parseWatchlistSymbolArgs(args: unknown): string | null {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return null;
  let raw: unknown;
  try {
    raw = (args as Record<string, unknown>).symbol;
  } catch {
    return null;
  }
  const symbol = normalizeWatchlistSymbol(raw);
  return symbol.length > 0 ? symbol : null;
}

/**
 * Trusted studio DOM for the shell body (the exact markup the old
 * `watchlist-html.ts` builder emitted between `<body>` and the script tag;
 * the webview JS depends on those ids/classes).
 */
export function buildWatchlistBody(): string {
  return `<div id="watchlist-root" class="watchlist-root" data-axis-watchlist-host="1">
    <header class="watchlist-header">
      <div class="watchlist-header__title">
        <svg class="watchlist-mark" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path fill="currentColor" d="M2 3.5h12v1.2H2zm0 4h8v1.2H2zm0 4h10v1.2H2z"/>
        </svg>
        <h1 class="watchlist-title">Watchlist</h1>
      </div>
      <p class="watchlist-header__meta" id="watchlist-count">0 symbols</p>
      <p class="watchlist-header__meta" id="watchlist-selected">No symbol selected</p>
      <p class="watchlist-price" id="watchlist-price">—</p>
      <span class="watchlist-badge" id="watchlist-badge" hidden>placeholder</span>
    </header>
    <form id="watchlist-add-form" class="watchlist-add" autocomplete="off">
      <label class="watchlist-add__label" for="watchlist-symbol-input">Add symbol</label>
      <input id="watchlist-symbol-input" class="watchlist-input" type="text" placeholder="BTCUSDT" spellcheck="false" />
      <button type="submit" id="watchlist-add" class="watchlist-btn watchlist-btn--primary">Add</button>
    </form>
    <p class="watchlist-empty" id="watchlist-empty">Add a ticker such as BTCUSDT. The status bar still follows the selected symbol.</p>
    <ul id="watchlist-rows" class="watchlist-rows"></ul>
    <div id="watchlist-live" class="watchlist-live" aria-live="polite" aria-atomic="true"></div>
  </div>`;
}
