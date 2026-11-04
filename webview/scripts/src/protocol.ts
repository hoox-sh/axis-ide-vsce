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
 * Scripts studio-local protocol layer on the shared `studio.*` namespace of
 * axis.webview.v1. Envelope encode/decode lives in ONE place —
 * webview/shared/studio-protocol → src/protocol/codec — shared by host and
 * view. This file owns the scripts `data` shape (`data.snapshot` on
 * studio.init / studio.set, the exact field the old flat `scripts.set`
 * message carried) and the frozen action set the host accepts:
 * run | openChart | apply — nothing else.
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
} from '../../shared/studio-protocol';

/** Studio view id — the `axis.indicators` VS Code view (frozen contract). */
export const SCRIPTS_VIEW = 'scripts';

export type ScriptRunStatus = 'ok' | 'error';

export type ScriptRunCard = {
  title: string;
  symbol: string;
  interval: string;
  mode: string;
  status: ScriptRunStatus;
  error: string;
  at: number;
};

export type ScriptSuggestion = {
  id: string;
  title: string;
  kind: string;
  category: string;
};

export type ScriptsViewSnapshot = {
  lastRun: ScriptRunCard | null;
  suggestions: ScriptSuggestion[];
  epoch: number | null;
};

/** One decoded studio.init / studio.set addressed to the scripts view. */
export interface ScriptsStudioState {
  kind: 'init' | 'set';
  snapshot: ScriptsViewSnapshot;
}

const SUGGESTION_MAX = 8;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function textOf(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cardFrom(raw: unknown): ScriptRunCard | null {
  if (!isPlainObject(raw)) return null;
  const title = textOf(raw.title);
  if (!title && !textOf(raw.symbol) && !textOf(raw.status)) return null;
  const status: ScriptRunStatus = raw.status === 'error' ? 'error' : 'ok';
  const at = typeof raw.at === 'number' && Number.isFinite(raw.at) ? raw.at : 0;
  return {
    title: title || 'Script',
    symbol: textOf(raw.symbol),
    interval: textOf(raw.interval),
    mode: textOf(raw.mode),
    status,
    error: textOf(raw.error),
    at,
  };
}

function suggestionsFrom(raw: unknown): ScriptSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const out: ScriptSuggestion[] = [];
  for (const row of raw) {
    if (out.length >= SUGGESTION_MAX) break;
    if (!isPlainObject(row)) continue;
    const id = textOf(row.id);
    if (!id) continue;
    out.push({
      id,
      title: textOf(row.title) || id,
      kind: textOf(row.kind) || 'indicator',
      category: textOf(row.category),
    });
  }
  return out;
}

function snapshotFrom(raw: unknown): ScriptsViewSnapshot {
  if (!isPlainObject(raw)) {
    return { lastRun: null, suggestions: [], epoch: null };
  }
  const epoch =
    typeof raw.epoch === 'number' && Number.isFinite(raw.epoch) && raw.epoch >= 0
      ? raw.epoch
      : null;
  return {
    lastRun: cardFrom(raw.lastRun),
    suggestions: suggestionsFrom(raw.suggestions),
    epoch,
  };
}

/**
 * Never-throw decode of studio.init / studio.set envelopes addressed to the
 * scripts view. Field semantics identical to the previous ad-hoc decode:
 * the snapshot rides `data.snapshot`, with the old `raw.snapshot ?? raw`
 * tolerance kept; a data-less studio.init returns null so the caller keeps
 * its current state.
 */
export function decodeScriptsStudioData(raw: unknown): ScriptsStudioState | null {
  const message = decodeStudioData(raw);
  if (!message || message.view !== SCRIPTS_VIEW || message.data === undefined) return null;
  const data = message.data;
  const source = isPlainObject(data) && isPlainObject(data.snapshot) ? data.snapshot : data;
  return { kind: message.kind, snapshot: snapshotFrom(source) };
}

/**
 * Never-throw decode of a studio.notice envelope addressed to the scripts
 * view; null for anything else. The old `scripts.notice` text rides
 * `payload.message`.
 */
export function decodeScriptsStudioNotice(raw: unknown): string | null {
  const result = decode(raw);
  if (!result.ok) return null;
  if (result.envelope.type !== HOST_TO_VIEW.StudioNotice) return null;
  const payload = result.envelope.payload as StudioNoticePayload;
  if (payload.view !== SCRIPTS_VIEW) return null;
  return typeof payload.message === 'string' ? payload.message : '';
}

/** studio.ready for the scripts view — no capabilities, as before. */
export function encodeScriptsReady(): AxisEnvelope<StudioReadyPayload> {
  return encodeStudioReady(SCRIPTS_VIEW);
}

/** studio.action `run` — run the active Pine editor (no args, as before). */
export function encodeScriptsRun(): AxisEnvelope<StudioActionPayload> {
  return encodeStudioAction(SCRIPTS_VIEW, 'run');
}

/** studio.action `openChart` — open the sibling chart document (no args). */
export function encodeScriptsOpenChart(): AxisEnvelope<StudioActionPayload> {
  return encodeStudioAction(SCRIPTS_VIEW, 'openChart');
}

/** studio.action `apply` — apply one builtin id; the old flat `id` field rides `args`. */
export function encodeScriptsApply(id: string): AxisEnvelope<StudioActionPayload> {
  return encodeStudioAction(SCRIPTS_VIEW, 'apply', { id });
}
