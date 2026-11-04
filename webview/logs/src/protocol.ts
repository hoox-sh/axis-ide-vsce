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
 * Logs studio-local protocol layer on the shared `studio.*` namespace of
 * axis.webview.v1. Envelope encode/decode lives in ONE place —
 * webview/shared/studio-protocol → src/protocol/codec — shared by host and
 * view. This file owns the logs `data` shape (`{ rows, runId, status }`
 * on studio.init / studio.set — the old `logs.set` payload verbatim) and
 * the frozen action set the host accepts: reveal | copy — nothing else.
 * Filters stay local (the old `logs.filter` message was host-ignored).
 */

import {
  decodeStudioData,
  encodeStudioAction,
  encodeStudioReady,
  type AxisEnvelope,
  type StudioActionPayload,
  type StudioReadyPayload,
} from '@axis-shared/studio-protocol';
import { filterLogs, type LogRow } from '../../../src/views/logs-messages';

export type { LogRow };

/** Studio view id — the `axis.logs` VS Code view (frozen contract). */
export const LOGS_VIEW = 'logs';

export type LogsViewState = {
  rows: LogRow[];
  runId: string | null;
  status: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Validate the `data` slice of a logs studio.init / studio.set envelope.
 * Field semantics identical to the previous ad-hoc decode: rows re-validate
 * individually through `filterLogs`, runId / status trim or drop.
 */
function logsStateFrom(value: unknown): LogsViewState | null {
  if (!isRecord(value)) return null;
  return {
    rows: filterLogs(value.rows, 'all'),
    runId: textOrNull(value.runId),
    status: textOrNull(value.status),
  };
}

/**
 * Never-throw decode of studio.init / studio.set envelopes addressed to the
 * logs view. A data-less studio.init returns null so the caller keeps its
 * current state (matching the pre-migration flow, where rows only ever
 * arrived inside a full host payload).
 */
export function decodeLogsSet(raw: unknown): LogsViewState | null {
  const message = decodeStudioData(raw);
  if (!message || message.view !== LOGS_VIEW || message.data === undefined) return null;
  return logsStateFrom(message.data);
}

/** studio.ready for the logs view — no capabilities, as before. */
export function encodeLogsReady(): AxisEnvelope<StudioReadyPayload> {
  return encodeStudioReady(LOGS_VIEW);
}

/** studio.action `reveal` — reveal the 1-based source line (old `logs.reveal`). */
export function encodeLogsReveal(line: number): AxisEnvelope<StudioActionPayload> {
  return encodeStudioAction(LOGS_VIEW, 'reveal', { line });
}

/** studio.action `copy` — copy the message via the host clipboard (old `logs.copy`). */
export function encodeLogsCopy(text: string): AxisEnvelope<StudioActionPayload> {
  return encodeStudioAction(LOGS_VIEW, 'copy', { text });
}
