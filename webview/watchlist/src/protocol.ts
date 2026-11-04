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
 * Watchlist studio-local protocol layer on the shared `studio.*` namespace
 * of axis.webview.v1. Envelope encode/decode lives in ONE place —
 * webview/shared/studio-protocol → src/protocol/codec — shared by host and
 * view. This file owns the watchlist `data` shape (the snapshot on
 * studio.init / studio.set) and the frozen action set the host accepts:
 * add | remove | select — nothing else.
 *
 * Wire mapping: host posts the old `watchlist.snapshot` payload verbatim as
 * `data`; the old `watchlist.add` / `remove` / `select` symbol field rides
 * in `studio.action` `args.symbol`.
 */

import {
  decodeStudioData,
  encodeStudioAction,
  encodeStudioReady,
  type AxisEnvelope,
  type StudioActionPayload,
  type StudioReadyPayload,
} from '@axis-shared/studio-protocol';

/** Studio view id — the `axis.watchlist` VS Code view (frozen contract). */
export const WATCHLIST_VIEW = 'watchlist';

export type WatchlistRowView = {
  symbol: string;
  priceText: string;
  selected: boolean;
  placeholder: boolean;
};

export type WatchlistViewSnapshot = {
  count: number;
  selected: string | null;
  focusSymbol: string | null;
  focusPriceText: string;
  placeholder: boolean;
  rows: WatchlistRowView[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Same rule as the host normalizer: upper-case, strip whitespace, else empty. */
export function normalizeWatchlistSymbol(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

function textOf(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function rowFrom(raw: unknown): WatchlistRowView | null {
  if (!isPlainObject(raw)) return null;
  const symbol = normalizeWatchlistSymbol(raw.symbol);
  if (!symbol) return null;
  return {
    symbol,
    priceText: textOf(raw.priceText, '—'),
    selected: raw.selected === true,
    placeholder: raw.placeholder === true,
  };
}

/** Defensive snapshot. Bad rows are dropped. Never throws. */
export function snapshotFromPayload(raw: unknown): WatchlistViewSnapshot {
  try {
    if (!isPlainObject(raw)) {
      return {
        count: 0,
        selected: null,
        focusSymbol: null,
        focusPriceText: '—',
        placeholder: true,
        rows: [],
      };
    }
    const rows: WatchlistRowView[] = [];
    if (Array.isArray(raw.rows)) {
      for (const row of raw.rows) {
        const parsed = rowFrom(row);
        if (parsed) rows.push(parsed);
      }
    }
    const selectedNorm = normalizeWatchlistSymbol(raw.selected);
    const selected = selectedNorm && rows.some((row) => row.symbol === selectedNorm) ? selectedNorm : null;
    const focusNorm = normalizeWatchlistSymbol(raw.focusSymbol);
    let focusSymbol: string | null = null;
    if (focusNorm && rows.some((row) => row.symbol === focusNorm)) {
      focusSymbol = focusNorm;
    } else if (selected) {
      focusSymbol = selected;
    } else if (rows.length > 0) {
      focusSymbol = rows[0]!.symbol;
    }
    let focusPriceText = '—';
    if (focusSymbol) {
      for (const row of rows) {
        if (row.symbol === focusSymbol) {
          focusPriceText = row.priceText;
          break;
        }
      }
    }
    return {
      count: rows.length,
      selected,
      focusSymbol,
      focusPriceText,
      placeholder: raw.placeholder === true,
      rows,
    };
  } catch {
    return {
      count: 0,
      selected: null,
      focusSymbol: null,
      focusPriceText: '—',
      placeholder: true,
      rows: [],
    };
  }
}

/**
 * Never-throw decode of studio.init / studio.set envelopes addressed to the
 * watchlist view. A data-less studio.init returns null so the caller keeps
 * its current state (the old flow only ever applied full snapshots).
 */
export function decodeWatchlistSet(raw: unknown): WatchlistViewSnapshot | null {
  const message = decodeStudioData(raw);
  if (!message || message.view !== WATCHLIST_VIEW || message.data === undefined) return null;
  return snapshotFromPayload(message.data);
}

/** studio.ready for the watchlist view — no capabilities, as before. */
export function encodeWatchlistReady(): AxisEnvelope<StudioReadyPayload> {
  return encodeStudioReady(WATCHLIST_VIEW);
}

/** studio.action `add` — append the normalized ticker (old `watchlist.add`). */
export function encodeWatchlistAdd(symbol: string): AxisEnvelope<StudioActionPayload> {
  return encodeStudioAction(WATCHLIST_VIEW, 'add', { symbol });
}

/** studio.action `remove` — drop the ticker (old `watchlist.remove`). */
export function encodeWatchlistRemove(symbol: string): AxisEnvelope<StudioActionPayload> {
  return encodeStudioAction(WATCHLIST_VIEW, 'remove', { symbol });
}

/** studio.action `select` — make the ticker the status-bar focus. */
export function encodeWatchlistSelect(symbol: string): AxisEnvelope<StudioActionPayload> {
  return encodeStudioAction(WATCHLIST_VIEW, 'select', { symbol });
}
