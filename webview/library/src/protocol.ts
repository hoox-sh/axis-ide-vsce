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
 * Library studio-local protocol layer on the shared `studio.*` namespace of
 * axis.webview.v1. Envelope encode/decode lives in ONE place —
 * webview/shared/studio-protocol → src/protocol/codec — shared by host and
 * view. This file owns the library `data` shape (`{ cards, catalogError }`
 * on studio.init / studio.set — the old `library.init` payload verbatim)
 * and the frozen action set the host accepts: apply | copy — nothing else.
 */

import {
  decodeStudioData,
  encodeStudioAction,
  encodeStudioReady,
  type AxisEnvelope,
  type StudioActionPayload,
  type StudioReadyPayload,
} from '@axis-shared/studio-protocol';
import type { LibraryCard, LibraryKind } from './state';

/** Studio view id — the `axis.library` VS Code view (frozen contract). */
export const LIBRARY_VIEW = 'library';

/** `data` payload of studio.init / studio.set for the library view. */
export interface LibraryViewState {
  cards: LibraryCard[];
  catalogError: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readString(raw: Record<string, unknown>, key: string): string {
  try {
    const value = raw[key];
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

function cardFromUnknown(raw: unknown): LibraryCard | null {
  if (!isRecord(raw)) return null;
  const id = readString(raw, 'id').trim();
  if (!id) return null;
  let tags: string[] = [];
  try {
    const value = raw.tags;
    if (Array.isArray(value)) {
      tags = value.filter((item): item is string => typeof item === 'string' && item.length > 0);
    }
  } catch {
    tags = [];
  }
  let kind: LibraryKind = 'indicator';
  try {
    if (raw.kind === 'strategy') kind = 'strategy';
  } catch {
    kind = 'indicator';
  }
  let overlay = false;
  try {
    overlay = raw.overlay === true;
  } catch {
    overlay = false;
  }
  return {
    id,
    title: readString(raw, 'title').trim() || id,
    shorttitle: readString(raw, 'shorttitle').trim() || id,
    description: readString(raw, 'description'),
    category: readString(raw, 'category'),
    categoryLabel: readString(raw, 'categoryLabel'),
    kind,
    overlay,
    covers: readString(raw, 'covers'),
    tags,
  };
}

/**
 * Validate the `data` slice of a library studio.init / studio.set envelope.
 * Field semantics identical to the previous ad-hoc decode: `catalogError`
 * defaults to '', `cards` validate individually, invalid cards drop.
 */
function libraryStateFrom(value: unknown): LibraryViewState | null {
  if (!isRecord(value)) return null;
  let catalogError = '';
  try {
    catalogError = typeof value.catalogError === 'string' ? value.catalogError : '';
  } catch {
    catalogError = '';
  }
  const cards: LibraryCard[] = [];
  try {
    const list = value.cards;
    if (Array.isArray(list)) {
      for (const item of list) {
        const card = cardFromUnknown(item);
        if (card) cards.push(card);
      }
    }
  } catch {
    return { cards: [], catalogError };
  }
  return { cards, catalogError };
}

/**
 * Never-throw decode of studio.init / studio.set envelopes addressed to the
 * library view. A data-less studio.init returns null so the caller keeps its
 * current state (matching the pre-migration flow, where the catalog only
 * ever arrived inside a full host payload).
 */
export function decodeLibrarySet(raw: unknown): LibraryViewState | null {
  const message = decodeStudioData(raw);
  if (!message || message.view !== LIBRARY_VIEW || message.data === undefined) return null;
  return libraryStateFrom(message.data);
}

/** studio.ready for the library view — no capabilities, as before. */
export function encodeLibraryReady(): AxisEnvelope<StudioReadyPayload> {
  return encodeStudioReady(LIBRARY_VIEW);
}

/** studio.action `apply` — open the builtin's Pine source (old `library.apply`). */
export function encodeLibraryApply(id: string): AxisEnvelope<StudioActionPayload> {
  return encodeStudioAction(LIBRARY_VIEW, 'apply', { id });
}

/** studio.action `copy` — copy the builtin id via the host clipboard. */
export function encodeLibraryCopy(id: string): AxisEnvelope<StudioActionPayload> {
  return encodeStudioAction(LIBRARY_VIEW, 'copy', { id });
}
