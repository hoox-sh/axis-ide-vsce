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
 * Alerts studio-local protocol layer on the shared `studio.*` namespace of
 * axis.webview.v1. Envelope encode/decode lives in ONE place —
 * webview/shared/studio-protocol → src/protocol/codec — shared by host and
 * view. This file owns the alerts `data` shape (the alerts-studio-model
 * snapshot, the old flat `alerts.set` payload verbatim as `data`) and the
 * frozen action set the host accepts: add | toggle | remove — nothing
 * else. Flashes arrive as `studio.notice` (level + message).
 */

import {
  HOST_TO_VIEW,
  decode,
  decodeStudioData,
  encodeStudioAction,
  encodeStudioReady,
  type AxisEnvelope,
  type StudioActionPayload,
  type StudioNoticePayload,
  type StudioReadyPayload,
} from '@axis-shared/studio-protocol';
import {
  ALERTS_REMOVED,
  ALERTS_TITLE_REQUIRED,
  buildAlertsSnapshot,
  type AlertsSnapshot,
} from '../../../src/views/alerts-studio-model';

export { ALERTS_REMOVED, ALERTS_TITLE_REQUIRED };
export type { AlertsSnapshot };

/** Studio view id — the `axis.alerts` VS Code view (frozen contract). */
export const ALERTS_VIEW = 'alerts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Never-throw decode of studio.init / studio.set envelopes addressed to the
 * alerts view. The `data` slice runs through `buildAlertsSnapshot` — the
 * same sanitize pass the old flat decoder ran its payload through. A
 * data-less studio.init paints the empty snapshot, matching the old
 * decoder treating a payload-less `alerts.set` as an empty list.
 */
export function decodeAlertsSnapshot(raw: unknown): AlertsSnapshot | null {
  const message = decodeStudioData(raw);
  if (!message || message.view !== ALERTS_VIEW) return null;
  const entries = isRecord(message.data) ? message.data.entries : undefined;
  return buildAlertsSnapshot(entries);
}

/** One decoded `studio.notice` addressed to the alerts view. */
export interface AlertsNotice {
  level: string;
  message: string;
}

/**
 * Never-throw decode of a `studio.notice` envelope addressed to the alerts
 * view — the old `alerts.flash` text plus the explicit level the host now
 * sends (error for `ALERTS_TITLE_REQUIRED`, info otherwise, exactly the
 * class the old text comparison picked).
 */
export function decodeAlertsNotice(raw: unknown): AlertsNotice | null {
  const result = decode(raw);
  if (!result.ok) return null;
  if (result.envelope.type !== HOST_TO_VIEW.StudioNotice) return null;
  const payload = result.envelope.payload as StudioNoticePayload;
  if (payload.view !== ALERTS_VIEW) return null;
  return { level: payload.level, message: payload.message };
}

/** studio.ready for the alerts view — no capabilities, as before. */
export function encodeAlertsReady(): AxisEnvelope<StudioReadyPayload> {
  return encodeStudioReady(ALERTS_VIEW);
}

/** studio.action `add` — old `alerts.add` args verbatim (title + optional condition). */
export function encodeAlertsAdd(
  title: string,
  condition?: string,
): AxisEnvelope<StudioActionPayload> {
  return encodeStudioAction(ALERTS_VIEW, 'add', condition ? { title, condition } : { title });
}

/** studio.action `toggle` — flip `enabled` on one stored row (old `alerts.toggle` args verbatim). */
export function encodeAlertsToggle(id: string): AxisEnvelope<StudioActionPayload> {
  return encodeStudioAction(ALERTS_VIEW, 'toggle', { id });
}

/** studio.action `remove` — delete one stored row (old `alerts.remove` args verbatim). */
export function encodeAlertsRemove(id: string): AxisEnvelope<StudioActionPayload> {
  return encodeStudioAction(ALERTS_VIEW, 'remove', { id });
}
