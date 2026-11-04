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
 * Symbols studio-local protocol layer on the shared `studio.*` namespace of
 * axis.webview.v1. Envelope encode/decode lives in ONE place —
 * webview/shared/studio-protocol → src/protocol/codec — shared by host and
 * view. This file owns the symbols `data` shape (`data` on studio.init /
 * studio.set — the old flat symbols.set payload fields verbatim) and the
 * frozen action set the host accepts: insert | copy — nothing else.
 */

import {
  decodeStudioData,
  encodeStudioAction,
  encodeStudioReady,
  type AxisEnvelope,
  type StudioActionPayload,
  type StudioReadyPayload,
} from '@axis-shared/studio-protocol';

/** Studio view id — the `axis.symbols` VS Code view (frozen contract). */
export const SYMBOLS_VIEW = 'symbols';

/** One catalog symbol row as validated by the view. */
export interface SymbolRow {
  id: string;
  category: string;
  char: string;
  name: string;
}

/** `data` payload of studio.init / studio.set for the symbols view. */
export interface SymbolsViewState {
  symbols: SymbolRow[];
  query: string;
  category: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Validate one untrusted row (the old `readRow` semantics). */
export function symbolRowFrom(value: unknown): SymbolRow | null {
  if (!isPlainObject(value)) return null;
  const id = value.id;
  const category = value.category;
  const char = value.char;
  const name = value.name;
  if (typeof id !== 'string' || typeof category !== 'string') return null;
  if (typeof char !== 'string' || typeof name !== 'string') return null;
  if (!id || !char || !name) return null;
  return { id, category, char, name };
}

/**
 * Validate the `data` slice of a symbols studio.init / studio.set envelope.
 * Field semantics identical to the previous ad-hoc decode: `query` and
 * `category` default to '', rows validate individually, and a non-array
 * `symbols` drops the whole message like the old decoder did.
 */
function symbolsViewStateFrom(value: unknown): SymbolsViewState | null {
  if (!isPlainObject(value)) return null;
  if (!Array.isArray(value.symbols)) return null;
  const query = typeof value.query === 'string' ? value.query : '';
  const category = typeof value.category === 'string' ? value.category : '';
  const symbols: SymbolRow[] = [];
  for (const item of value.symbols) {
    const row = symbolRowFrom(item);
    if (row) symbols.push(row);
  }
  return { symbols, query, category };
}

/**
 * Never-throw decode of studio.init / studio.set envelopes addressed to the
 * symbols view. A data-less studio.init (no initial state) returns null so
 * the caller keeps its current state — matching the pre-migration flow,
 * where state only ever arrived inside a full host payload.
 */
export function decodeSymbolsSet(raw: unknown): SymbolsViewState | null {
  const message = decodeStudioData(raw);
  if (!message || message.view !== SYMBOLS_VIEW || message.data === undefined) return null;
  return symbolsViewStateFrom(message.data);
}

/** studio.ready for the symbols view — no capabilities (the old webview never sent any). */
export function encodeSymbolsReady(): AxisEnvelope<StudioReadyPayload> {
  return encodeStudioReady(SYMBOLS_VIEW);
}

/** studio.action `insert` — insert the glyph at the cursor (old `symbols.insert` args verbatim). */
export function encodeSymbolsInsert(text: string): AxisEnvelope<StudioActionPayload> {
  return encodeStudioAction(SYMBOLS_VIEW, 'insert', { text });
}

/** studio.action `copy` — copy the glyph via the host clipboard (old `symbols.copy` args verbatim). */
export function encodeSymbolsCopy(text: string): AxisEnvelope<StudioActionPayload> {
  return encodeStudioAction(SYMBOLS_VIEW, 'copy', { text });
}
