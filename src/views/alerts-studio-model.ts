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
 * Pure Alerts studio snapshot model, shared by the host panel and the
 * webview (the webview imports this module directly).
 * Does not import alerts.ts (that module loads vscode).
 * Row rules match sanitizeAlertEntry: trim id/title, drop blanks and duplicate ids,
 * condition only when a non-empty string, enabled is false only when strictly false.
 * The studio.* action args validation lives in alerts-messages.ts.
 */

export const ALERTS_TITLE_REQUIRED = 'Title required';
export const ALERTS_REMOVED = 'Removed';

export type AlertsStudioEntry = {
  id: string;
  title: string;
  enabled: boolean;
  condition?: string;
};

export type AlertsSnapshot = {
  total: number;
  enabled: number;
  /** Header text: `N alerts, M enabled`. */
  summary: string;
  entries: AlertsStudioEntry[];
};

export function formatAlertsSummary(total: number, enabled: number): string {
  return `${total} alerts, ${enabled} enabled`;
}

function emptyAlertsSnapshot(): AlertsSnapshot {
  return {
    total: 0,
    enabled: 0,
    summary: formatAlertsSummary(0, 0),
    entries: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** One row, or null. Throws only if a property getter throws. */
function sanitizeStudioEntry(raw: unknown): AlertsStudioEntry | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!id || !title) return null;
  const conditionText = raw.condition;
  const condition =
    typeof conditionText === 'string' && conditionText.trim()
      ? conditionText.trim()
      : undefined;
  const enabled = raw.enabled === false ? false : true;
  if (condition !== undefined) return { id, title, condition, enabled };
  return { id, title, enabled };
}

/**
 * Counts + cleaned rows for the Alerts webview.
 * Never throws. Non-arrays and hostile iterators become an empty snapshot.
 */
export function buildAlertsSnapshot(entries: unknown): AlertsSnapshot {
  try {
    if (!Array.isArray(entries)) return emptyAlertsSnapshot();
    const out: AlertsStudioEntry[] = [];
    const seen = new Set<string>();
    let enabled = 0;
    for (const raw of entries) {
      try {
        const entry = sanitizeStudioEntry(raw);
        if (!entry || seen.has(entry.id)) continue;
        seen.add(entry.id);
        if (entry.enabled) enabled += 1;
        out.push(entry);
      } catch {
        continue;
      }
    }
    return {
      total: out.length,
      enabled,
      summary: formatAlertsSummary(out.length, enabled),
      entries: out,
    };
  } catch {
    return emptyAlertsSnapshot();
  }
}
