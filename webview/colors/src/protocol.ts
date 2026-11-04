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
 * Colors studio-local protocol layer on the shared `studio.*` namespace of
 * axis.webview.v1. Envelope encode/decode lives in ONE place —
 * webview/shared/studio-protocol → src/protocol/codec — shared by host and
 * view. This file owns the colors `data` shape (`data` on studio.init /
 * studio.set) and the frozen action set the host accepts:
 * reveal | copy | refresh — nothing else.
 */

import {
  decodeStudioData,
  encodeStudioAction,
  encodeStudioReady,
  type AxisEnvelope,
  type StudioActionPayload,
  type StudioReadyPayload,
} from '@axis-shared/studio-protocol';

/** Studio view id — the `axis.colors` VS Code view (frozen contract). */
export const COLORS_VIEW = 'colors';

/** Chip filter kinds used by the Colors webview (client-side). */
export type ColorKindFilter = 'all' | 'hex' | 'named' | 'rgb-new';

/** Allowed chip values — also the accepted filter domain of the shared filter machine. */
export const COLOR_KIND_FILTERS: readonly ColorKindFilter[] = [
  'all',
  'hex',
  'named',
  'rgb-new',
];

/** One scanned color occurrence as validated by the view. */
export interface ColorRow {
  line: number;
  column: number;
  raw: string;
  swatch: string;
}

/** `data` payload of studio.init / studio.set for the colors view. */
export interface ColorsViewState {
  colors: ColorRow[];
  sourceLabel: string;
}

const SAFE_SWATCH =
  /^(?:#[0-9A-Fa-f]{3}|#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{8}|rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)|rgba\(\d{1,3}, \d{1,3}, \d{1,3}, (?:0|1|0\.\d{1,3})\))$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** True when the swatch is safe to assign to `element.style.backgroundColor`. */
export function isSafeSwatch(value: string): boolean {
  return SAFE_SWATCH.test(value);
}

/** Client-side kind chip for a scanned raw literal. */
export function colorKindOf(raw: string): Exclude<ColorKindFilter, 'all'> {
  const text = raw.trim();
  if (text.startsWith('#')) return 'hex';
  if (/^color\.(rgb|new)\b/i.test(text)) return 'rgb-new';
  return 'named';
}

function rowFrom(value: unknown): ColorRow | null {
  if (!isPlainObject(value)) return null;
  const line = value.line;
  const column = value.column;
  if (typeof line !== 'number' || !Number.isInteger(line) || line < 1) return null;
  if (typeof column !== 'number' || !Number.isInteger(column) || column < 1) return null;
  if (typeof value.raw !== 'string' || value.raw.length === 0) return null;
  if (typeof value.swatch !== 'string' || value.swatch.length === 0) return null;
  return { line, column, raw: value.raw, swatch: value.swatch };
}

/**
 * Validate the `data` slice of a colors studio.init / studio.set envelope.
 * Field semantics identical to the previous ad-hoc decode: `sourceLabel`
 * defaults to '', `colors` rows validate individually, invalid rows drop.
 */
function colorsStateFrom(value: unknown): ColorsViewState | null {
  if (!isPlainObject(value)) return null;
  const sourceLabel = typeof value.sourceLabel === 'string' ? value.sourceLabel : '';
  const colors: ColorRow[] = [];
  if (Array.isArray(value.colors)) {
    for (const item of value.colors) {
      const row = rowFrom(item);
      if (row) colors.push(row);
    }
  }
  return { colors, sourceLabel };
}

/**
 * Never-throw decode of studio.init / studio.set envelopes addressed to the
 * colors view. A data-less studio.init (no initial state) returns null so the
 * caller keeps its current state — matching the pre-migration flow, where
 * state only ever arrived inside a full host payload.
 */
export function decodeColorsSet(raw: unknown): ColorsViewState | null {
  const message = decodeStudioData(raw);
  if (!message || message.view !== COLORS_VIEW || message.data === undefined) return null;
  return colorsStateFrom(message.data);
}

/** studio.ready for the colors view — no capabilities, as before. */
export function encodeColorsReady(): AxisEnvelope<StudioReadyPayload> {
  return encodeStudioReady(COLORS_VIEW);
}

/** studio.action `refresh` — re-scan the active Pine editor (no args, as before). */
export function encodeColorsRefresh(): AxisEnvelope<StudioActionPayload> {
  return encodeStudioAction(COLORS_VIEW, 'refresh');
}

/** studio.action `reveal` — reveal the 1-based source line in the editor. */
export function encodeColorsReveal(line: number): AxisEnvelope<StudioActionPayload> {
  return encodeStudioAction(COLORS_VIEW, 'reveal', { line });
}

/** studio.action `copy` — copy the raw literal via the host clipboard. */
export function encodeColorsCopy(text: string): AxisEnvelope<StudioActionPayload> {
  return encodeStudioAction(COLORS_VIEW, 'copy', { text });
}
