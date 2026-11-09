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
 * Scripts studio messages and snapshot shaping on the `studio.*` namespace
 * of axis.webview.v1 (frozen Phase-1 contract). Pure — no vscode.
 * Never throws. Never copies Pine `code`.
 *
 * Host → view: `studio.init` / `studio.set` carrying
 * `{ view: 'scripts', data: { snapshot } }` — the exact `snapshot` field the
 * old flat `scripts.set` message carried, preserved verbatim. View → host:
 * `studio.ready` and `studio.action` (`run` | `openChart` | `apply`) — the
 * old flat payload fields move into `args`.
 */

import type { StudioRegistration } from './studio-registry';
import { scrubSecrets } from '../run/scrub';

/** Command ids confirmed in package.json (do not invent aliases). */
export const SCRIPTS_RUN_COMMAND = 'axis.runScript';
export const SCRIPTS_OPEN_CHART_COMMAND = 'axis.openChart';
export const SCRIPTS_APPLY_BUILTIN_COMMAND = 'axis.applyBuiltin';

export const SCRIPTS_SUGGESTION_MAX = 8;

export const SCRIPTS_EMPTY_RUN =
  'Run a Pine Script™ (Ctrl+Enter)';

/** `view` value for every Scripts studio envelope — exactly `'scripts'`. */
export const SCRIPTS_STUDIO_VIEW = 'scripts';

/** VS Code view id of the Scripts studio (`axis.indicators`). */
export const SCRIPTS_STUDIO_VIEW_ID = 'axis.indicators';

export type ScriptRunStatus = 'ok' | 'error';

/** Last-run card. `status` is ok/error (results store `success` maps to ok). */
export type ScriptRunCard = {
  title: string;
  symbol: string;
  interval: string;
  mode: string;
  status: ScriptRunStatus;
  error: string;
  at: number;
};

/** Builtin suggestion row. No Pine source. */
export type ScriptSuggestion = {
  id: string;
  title: string;
  kind: string;
  category: string;
};

export type ScriptsSnapshot = {
  lastRun: ScriptRunCard | null;
  suggestions: ScriptSuggestion[];
  /** Orchestrator epoch when the run record carries one; otherwise null. */
  epoch: number | null;
};

/**
 * `studio.init` / `studio.set` data — the exact `snapshot` field the old
 * flat `scripts.set` message carried, preserved verbatim.
 */
export interface ScriptsStudioData {
  snapshot: ScriptsSnapshot;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string {
  try {
    const value = record[key];
    if (typeof value !== 'string') return '';
    return value.trim();
  } catch {
    return '';
  }
}

function readFinite(record: Record<string, unknown>, key: string): number | null {
  try {
    const value = record[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return value;
  } catch {
    return null;
  }
}

function readMeta(record: Record<string, unknown>): Record<string, unknown> | null {
  try {
    const meta = record.meta;
    if (!isPlainObject(meta)) return null;
    return meta;
  } catch {
    return null;
  }
}

function readMetaString(record: Record<string, unknown>, key: string): string {
  const meta = readMeta(record);
  if (!meta) return '';
  return readString(meta, key);
}

/** Unwrap `{ lastRun }` snapshots. A null `lastRun` is not a run record. */
export function unwrapRunRecord(raw: unknown): Record<string, unknown> | null {
  if (!isPlainObject(raw)) return null;
  try {
    if ('lastRun' in raw) {
      const nested = raw.lastRun;
      if (!isPlainObject(nested)) return null;
      return nested;
    }
  } catch {
    return null;
  }
  return raw;
}

function fromSeriesKey(seriesKey: string): { symbol: string; interval: string } {
  if (!seriesKey) return { symbol: '', interval: '' };
  const parts = seriesKey.split('|');
  if (parts.length >= 4) {
    return { symbol: parts[2].trim(), interval: parts[3].trim() };
  }
  return { symbol: '', interval: '' };
}

function readAt(record: Record<string, unknown>): number {
  const created = readFinite(record, 'createdAt');
  if (created != null && created > 0) return created;
  const at = readFinite(record, 'at');
  if (at != null && at > 0) return at;
  const meta = readMeta(record);
  if (!meta) return 0;
  const metaAt = readFinite(meta, 'at');
  if (metaAt != null && metaAt > 0) return metaAt;
  const metaCreated = readFinite(meta, 'createdAt');
  if (metaCreated != null && metaCreated > 0) return metaCreated;
  return 0;
}

function hasRunSignal(record: Record<string, unknown>): boolean {
  if (readString(record, 'id')) return true;
  if (readString(record, 'title')) return true;
  if (readString(record, 'seriesKey')) return true;
  if (readString(record, 'status')) return true;
  if (readString(record, 'engineId')) return true;
  if (readMetaString(record, 'script_name')) return true;
  if (readMetaString(record, 'title')) return true;
  if (readAt(record) > 0) return true;
  return false;
}

function readStatus(record: Record<string, unknown>, error: string): ScriptRunStatus {
  const status = readString(record, 'status').toLowerCase();
  if (status === 'error' || status === 'err') return 'error';
  if (status === 'success' || status === 'ok') return 'ok';
  if (error) return 'error';
  return 'ok';
}

/** Map a results lastRun (or snapshot) to a card. Null when it is not a run. */
export function scriptRunCardFromLastRun(raw: unknown): ScriptRunCard | null {
  const record = unwrapRunRecord(raw);
  if (!record) return null;
  if (!hasRunSignal(record)) return null;
  const series = fromSeriesKey(readString(record, 'seriesKey'));
  const title =
    readMetaString(record, 'script_name') ||
    readMetaString(record, 'title') ||
    readMetaString(record, 'name') ||
    readString(record, 'title') ||
    readString(record, 'id') ||
    'Script';
  const symbol = readMetaString(record, 'symbol') || series.symbol;
  const interval =
    readMetaString(record, 'interval') ||
    readMetaString(record, 'timeframe') ||
    series.interval;
  const mode =
    readMetaString(record, 'mode') ||
    readString(record, 'mode') ||
    readString(record, 'engineId');
  const error = scrubSecrets(readString(record, 'error'));
  return {
    title,
    symbol,
    interval,
    mode,
    status: readStatus(record, error),
    error,
    at: readAt(record),
  };
}

/** Epoch from the run record or its meta, when present. */
export function readRunEpoch(raw: unknown): number | null {
  const record = unwrapRunRecord(raw);
  if (!record) return null;
  const direct = readFinite(record, 'epoch');
  if (direct != null && direct >= 0) return direct;
  const meta = readMeta(record);
  if (!meta) return null;
  const epoch = readFinite(meta, 'epoch');
  if (epoch != null && epoch >= 0) return epoch;
  const runEpoch = readFinite(meta, 'runEpoch');
  if (runEpoch != null && runEpoch >= 0) return runEpoch;
  return null;
}

/** One catalog row → suggestion. Drops `code` and any other source field. */
export function scriptSuggestionFromEntry(raw: unknown): ScriptSuggestion | null {
  if (!isPlainObject(raw)) return null;
  const id = readString(raw, 'id');
  if (!id) return null;
  const title = readString(raw, 'title') || id;
  const kind = readString(raw, 'kind') || 'indicator';
  const category = readString(raw, 'categoryLabel') || readString(raw, 'category');
  return { id, title, kind, category };
}

function collectSuggestions(raw: unknown): ScriptSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const out: ScriptSuggestion[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (out.length >= SCRIPTS_SUGGESTION_MAX) break;
    const suggestion = scriptSuggestionFromEntry(row);
    if (!suggestion) continue;
    if (seen.has(suggestion.id)) continue;
    seen.add(suggestion.id);
    out.push(suggestion);
  }
  return out;
}

/** `{ lastRun, suggestions }` → webview snapshot. Caps suggestions at 8. Never throws. */
export function buildScriptsSnapshot(input: unknown): ScriptsSnapshot {
  if (!isPlainObject(input)) return { lastRun: null, suggestions: [], epoch: null };
  let lastRaw: unknown = null;
  try {
    lastRaw = input.lastRun;
  } catch {
    lastRaw = null;
  }
  let suggestionsRaw: unknown = null;
  try {
    suggestionsRaw = input.suggestions;
  } catch {
    suggestionsRaw = null;
  }
  return {
    lastRun: scriptRunCardFromLastRun(lastRaw),
    suggestions: collectSuggestions(suggestionsRaw),
    epoch: readRunEpoch(lastRaw),
  };
}

/**
 * `studio.init` / `studio.set` data builder — the old flat `scripts.set`
 * message's `snapshot` field, wrapped verbatim. Never throws.
 */
export function scriptsStudioData(
  lastRun: unknown,
  suggestions: readonly ScriptSuggestion[],
): ScriptsStudioData {
  return {
    snapshot: buildScriptsSnapshot({ lastRun, suggestions }),
  };
}

/**
 * Old `readApplyId` validation, moved onto `studio.action` args: the
 * trimmed `args.id` (or a legacy nested `args.payload.id`), '' when absent
 * or not a string. Invalid apply actions are ignored, never thrown.
 */
export function scriptsApplyIdFromArgs(args: unknown): string {
  if (!isPlainObject(args)) return '';
  return readApplyId(args);
}

function readApplyId(raw: Record<string, unknown>): string {
  const top = readString(raw, 'id');
  if (top) return top;
  try {
    const payload = raw.payload;
    if (!isPlainObject(payload)) return '';
    return readString(payload, 'id');
  } catch {
    return '';
  }
}

/** `studio.notice` message text — the old `scripts.notice` text validation. */
export function scriptsNoticeMessage(text: unknown): string {
  const value = typeof text === 'string' ? text.trim() : '';
  return value;
}

/**
 * Trusted studio DOM for the Scripts shell body — the exact markup the old
 * `scripts-html.ts` builder emitted between the theme-classed `<body>` and
 * the script tag (webview JS depends on these ids/classes). Inline scripts
 * are refused by the shell; this body carries none.
 */
export function buildScriptsStudioBody(): string {
  return `<div id="scripts-root" class="scripts-root" data-axis-scripts-host="1">
    <header class="scripts-header">
      <h1 class="scripts-title">Scripts</h1>
    </header>
    <section class="scripts-card" aria-labelledby="scripts-last-heading">
      <h2 class="scripts-card__title" id="scripts-last-heading">Last run</h2>
      <p class="scripts-empty" id="scripts-empty">${SCRIPTS_EMPTY_RUN}</p>
      <dl class="scripts-dl" id="scripts-last" hidden>
        <dt>Script</dt><dd id="scripts-title"></dd>
        <dt>Symbol</dt><dd id="scripts-symbol"></dd>
        <dt>Interval</dt><dd id="scripts-interval"></dd>
        <dt>Mode</dt><dd id="scripts-mode"></dd>
        <dt>Status</dt><dd id="scripts-status"></dd>
        <dt id="scripts-error-label">Error</dt><dd id="scripts-error"></dd>
        <dt>When</dt><dd id="scripts-at"></dd>
        <dt id="scripts-epoch-label">Epoch</dt><dd id="scripts-epoch"></dd>
      </dl>
      <button type="button" class="ax-btn ax-btn--primary ax-btn--md scripts-btn" id="scripts-run">
        <span class="ax-btn__icon" aria-hidden="true">
          <svg class="scripts-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path fill="currentColor" d="M4 2.5v11l10-5.5L4 2.5z"/>
          </svg>
        </span>
        <span class="ax-btn__label">Run</span>
      </button>
    </section>
    <section class="scripts-card" aria-labelledby="scripts-chart-heading">
      <h2 class="scripts-card__title" id="scripts-chart-heading">Chart</h2>
      <p class="scripts-card__copy">Chart beside the editor.</p>
      <button type="button" class="ax-btn ax-btn--primary ax-btn--md scripts-btn" id="scripts-open-chart">
        <span class="ax-btn__icon" aria-hidden="true">
          <svg class="scripts-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path fill="currentColor" d="M2 13V3h2v8h10v2H2zm3-3 2.2-3 1.8 2.2L12 5l2 1.2-4.2 5.2-2-2.4L7 11 5 8.2V10z"/>
          </svg>
        </span>
        <span class="ax-btn__label">Open chart</span>
      </button>
    </section>
    <section class="scripts-card" aria-labelledby="scripts-suggest-heading">
      <h2 class="scripts-card__title" id="scripts-suggest-heading">Suggestions</h2>
      <ul class="scripts-list" id="scripts-suggestions"></ul>
    </section>
    <p class="scripts-live" id="scripts-live" aria-live="polite"></p>
  </div>`;
}

/** Host behavior the Scripts studio registration wires behind `studio.action`. */
export interface ScriptsStudioHandlers {
  /** `studio.action run` — start a run of the active Pine editor. */
  run(): void | Promise<void>;
  /** `studio.action openChart` — open the sibling chart document. */
  openChart(): void | Promise<void>;
  /** `studio.action apply` — apply one builtin id as untitled Pine. */
  apply(id: string): void | Promise<void>;
  /** Current studio state — feeds the `studio.init` handshake ack. */
  snapshot(): ScriptsStudioData;
}

/**
 * Build the Scripts `StudioRegistration` (enhancement plan §5 Phase 2).
 * Pure data + dispatch: the shim supplies the vscode-backed handlers, the
 * generic provider owns the shell, the ready handshake, and encoding.
 */
export function scriptsStudioRegistration(handlers: ScriptsStudioHandlers): StudioRegistration {
  return {
    id: SCRIPTS_STUDIO_VIEW,
    title: 'Scripts',
    viewId: SCRIPTS_STUDIO_VIEW_ID,
    retainContextWhenHidden: true,
    buildBody: buildScriptsStudioBody,
    actions: {
      run: async () => {
        await handlers.run();
        handlers.snapshot();
      },
      openChart: async () => {
        await handlers.openChart();
        handlers.snapshot();
      },
      apply: async (args) => {
        const id = scriptsApplyIdFromArgs(args);
        if (!id) return;
        await handlers.apply(id);
        handlers.snapshot();
      },
    },
    restore: () => handlers.snapshot(),
  };
}
