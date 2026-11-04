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
 * Layers studio-local protocol layer on the shared `studio.*` namespace of
 * axis.webview.v1. Envelope encode/decode lives in ONE place —
 * webview/shared/studio-protocol → src/protocol/codec — shared by host and
 * view. This file owns the layers `data` shape (the snapshot on
 * studio.init / studio.set — the old `layers.set` payload verbatim) and the
 * frozen action set the host accepts: openChart — nothing else.
 */

import {
  decodeStudioData,
  encodeStudioAction,
  encodeStudioReady,
  type AxisEnvelope,
  type StudioActionPayload,
  type StudioReadyPayload,
} from '@axis-shared/studio-protocol';
import { coerceSnapshot, type LayersViewState } from './state';

/** Studio view id — the `axis.layers` VS Code view (frozen contract). */
export const LAYERS_VIEW = 'layers';

/** `action` name the Open chart button posts (old `layers.openChart`). */
export const LAYERS_ACTION_OPEN_CHART = 'openChart';

/**
 * Never-throw decode of studio.init / studio.set envelopes addressed to the
 * layers view. A data-less studio.init (the ready handshake ack — the old
 * panel never posted at resolve time either) returns null so the caller
 * keeps its initial empty view.
 */
export function decodeLayersSet(raw: unknown): LayersViewState | null {
  const message = decodeStudioData(raw);
  if (!message || message.view !== LAYERS_VIEW || message.data === undefined) return null;
  return coerceSnapshot(message.data);
}

/** studio.ready for the layers view — no capabilities, as before. */
export function encodeLayersReady(): AxisEnvelope<StudioReadyPayload> {
  return encodeStudioReady(LAYERS_VIEW);
}

/** studio.action `openChart` — open a chart beside the active editor. */
export function encodeLayersOpenChart(): AxisEnvelope<StudioActionPayload> {
  return encodeStudioAction(LAYERS_VIEW, LAYERS_ACTION_OPEN_CHART);
}
