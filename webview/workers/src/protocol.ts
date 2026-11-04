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
 * Workers studio-local protocol layer on the shared `studio.*` namespace of
 * axis.webview.v1. Envelope encode/decode lives in ONE place —
 * webview/shared/studio-protocol → src/protocol/codec — shared by host and
 * view. The `data` validation (cards / counts / probed — the exact fields
 * the old flat workers.init / workers.state messages carried) lives in the
 * host model and is imported cross-boundary, following the logs/alerts
 * pattern. Frozen action set: probe | probeAll — nothing else.
 */

import {
  decodeStudioData,
  encodeStudioAction,
  encodeStudioReady,
  type AxisEnvelope,
  type StudioActionPayload,
  type StudioReadyPayload,
} from '../../shared/studio-protocol';
import {
  WORKERS_STUDIO_VIEW,
  parseWorkersStudioData,
  type WorkerStudioCard,
  type WorkersStudioCounts,
  type WorkersStudioSnapshot,
} from '../../../src/views/workers-messages';

export { WORKERS_STUDIO_VIEW };
export type { WorkerStudioCard, WorkersStudioCounts, WorkersStudioSnapshot };

/** One decoded studio.init / studio.set addressed to the workers view. */
export interface WorkersStudioState {
  kind: 'init' | 'set';
  cards: WorkerStudioCard[];
  counts: WorkersStudioCounts;
  probed: boolean;
}

/**
 * Never-throw decode of studio.init / studio.set envelopes addressed to the
 * workers view. Spoofed counts are ignored — counts are derived from cards
 * by the shared model validator. Null for foreign views, decode failures,
 * and hostile data.
 */
export function decodeWorkersStudioData(raw: unknown): WorkersStudioState | null {
  const message = decodeStudioData(raw);
  if (!message || message.view !== WORKERS_STUDIO_VIEW || message.data === undefined) {
    return null;
  }
  const snapshot: WorkersStudioSnapshot | null = parseWorkersStudioData(message.data);
  if (!snapshot) return null;
  return {
    kind: message.kind,
    cards: snapshot.cards,
    counts: snapshot.counts,
    probed: snapshot.probed,
  };
}

/** studio.ready for the workers view — no capabilities, as before. */
export function encodeWorkersReady(): AxisEnvelope<StudioReadyPayload> {
  return encodeStudioReady(WORKERS_STUDIO_VIEW);
}

/** studio.action `probeAll` — probe every catalog worker (no args, as before). */
export function encodeWorkersProbeAll(): AxisEnvelope<StudioActionPayload> {
  return encodeStudioAction(WORKERS_STUDIO_VIEW, 'probeAll');
}

/** studio.action `probe` — the old flat `id` field rides `args`. */
export function encodeWorkersProbe(id: string): AxisEnvelope<StudioActionPayload> {
  return encodeStudioAction(WORKERS_STUDIO_VIEW, 'probe', { id });
}
