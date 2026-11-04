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
 * Alerts studio wire layer on the `axis.webview.v1` `studio.*` envelopes
 * (enhancement plan §5 Phase 2). Pure — no vscode; the snapshot model
 * lives in `alerts-studio-model.ts` (shared with the webview) and the
 * storage/commands in `alerts.ts`.
 *
 * Host → view: the generic studio provider encodes `studio.init` /
 * `studio.set` carrying `{ view: 'alerts', data }` where `data` is the
 * `AlertsSnapshot` (the old flat `alerts.set` payload, verbatim), and
 * `studio.notice` for the old `alerts.flash` texts (level + message).
 * View → host: the shared router decodes `studio.ready` / `studio.action`;
 * the add/toggle/remove action `args` keep the old flat-message validation
 * from `parseAlertsStudioMessage` (`alertsAddFromArgs` / `alertsIdFromArgs`).
 */

/** `view` value for every Alerts studio envelope — exactly `'alerts'`. */
export const ALERTS_STUDIO_VIEW = 'alerts';

/**
 * `studio.notice` level for a blocking validation problem — the old
 * `alerts.flash` the webview painted with its error class
 * (`text === ALERTS_TITLE_REQUIRED`).
 */
export const ALERTS_NOTICE_ERROR = 'error';

/** `studio.notice` level for a transient success note (old info flash). */
export const ALERTS_NOTICE_INFO = 'info';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** One validated `add` action intent (the old `alerts.add` fields). */
export interface AlertsAddArgs {
  /** Trimmed title; `''` when absent/non-string (the panel flashes). */
  title: string;
  /** Trimmed condition; omitted when blank/non-string, like the old parser. */
  condition?: string;
}

/**
 * Old `parseAlertsStudioMessage` `alerts.add` validation, moved into
 * `studio.action` `args`: trimmed `title` (kept even when blank so the
 * panel can flash `ALERTS_TITLE_REQUIRED` without writing) and an optional
 * trimmed `condition`. Non-object args are null — dropped like the old
 * parser's null return. Never throws.
 */
export function alertsAddFromArgs(args: unknown): AlertsAddArgs | null {
  try {
    if (!isRecord(args)) return null;
    const title = typeof args.title === 'string' ? args.title.trim() : '';
    const conditionText = args.condition;
    const condition =
      typeof conditionText === 'string' && conditionText.trim()
        ? conditionText.trim()
        : undefined;
    return condition !== undefined ? { title, condition } : { title };
  } catch {
    // hostile args getters — drop the action
    return null;
  }
}

/**
 * Old `parseAlertsStudioMessage` `alerts.toggle` / `alerts.remove` id
 * validation, moved into `studio.action` `args`: a non-empty trimmed `id`.
 * Blank / missing ids are null — dropped like the old parser. Never throws.
 */
export function alertsIdFromArgs(args: unknown): string | null {
  try {
    if (!isRecord(args)) return null;
    const id = typeof args.id === 'string' ? args.id.trim() : '';
    return id.length > 0 ? id : null;
  } catch {
    // hostile args getters — drop the action
    return null;
  }
}
