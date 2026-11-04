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
 * Plugins studio-local protocol layer on the shared `studio.*` namespace
 * of axis.webview.v1. Envelope encode/decode lives in ONE place —
 * webview/shared/studio-protocol → src/protocol/codec — shared by host and
 * view. This file owns the plugins view-local card/active/flags
 * normalization and the frozen action set the host accepts: activate —
 * nothing else. Strict envelopes only: the lenient flat-JSON tolerance of
 * the previous ad-hoc decoder is gone.
 */

import {
  decodeStudioData,
  encodeStudioAction,
  encodeStudioReady,
  type AxisEnvelope,
  type StudioActionPayload,
  type StudioReadyPayload,
} from '../../shared/studio-protocol';

/** Studio view id — the `axis.plugins` VS Code view (frozen contract). */
export const PLUGINS_VIEW = 'plugins';

export type PluginKind =
  | 'source'
  | 'stream'
  | 'engine'
  | 'storage'
  | 'dataset'
  | 'component';

export const PLUGIN_KINDS: readonly PluginKind[] = [
  'source',
  'stream',
  'engine',
  'storage',
  'dataset',
  'component',
] as const;

export type KindTab = 'all' | PluginKind;

export const KIND_TABS: readonly KindTab[] = ['all', ...PLUGIN_KINDS] as const;

export type PluginExtra = {
  role?: string;
  live?: string | boolean;
  pyodide?: string | boolean;
  storage?: string | boolean;
  onChain?: string | boolean;
  noSolid?: string | boolean;
  flagOff?: boolean;
};

export type PluginCard = {
  id: string;
  name: string;
  kind: PluginKind;
  builtIn: boolean;
  description: string;
  extra: PluginExtra;
};

export type ActivePluginsMap = {
  source?: string;
  stream?: string;
  engine?: string;
  storage?: string;
  dataset?: string;
  component?: string;
};

export type PluginsFlags = {
  allowPyodide?: boolean;
};

/** One decoded studio.init / studio.set addressed to the plugins view. */
export interface PluginsStudioState {
  kind: 'init' | 'set';
  /** The studio `data` record — `plugins` / `active` / `flags` fields. */
  data: Record<string, unknown>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isPluginKind(value: unknown): value is PluginKind {
  return typeof value === 'string' && (PLUGIN_KINDS as readonly string[]).includes(value);
}

export function isKindTab(value: unknown): value is KindTab {
  return value === 'all' || isPluginKind(value);
}

function extraString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const t = value.trim();
    return t ? t : undefined;
  }
  return undefined;
}

function extraBoolOrString(value: unknown): string | boolean | undefined {
  if (typeof value === 'boolean') return value;
  return extraString(value);
}

/** Normalize one catalog card; skip entries missing id/kind. */
export function normalizePluginCard(raw: unknown): PluginCard | null {
  try {
    if (!isPlainObject(raw)) return null;
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    if (!id || !isPluginKind(raw.kind)) return null;
    const name =
      typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : id;
    const description =
      typeof raw.description === 'string' ? raw.description.trim() : '';
    const extraRaw = isPlainObject(raw.extra) ? raw.extra : {};
    const extra: PluginExtra = {};
    const role = extraString(extraRaw.role);
    if (role) extra.role = role;
    const live = extraBoolOrString(extraRaw.live);
    if (live !== undefined) extra.live = live;
    const pyodide = extraBoolOrString(extraRaw.pyodide);
    if (pyodide !== undefined) extra.pyodide = pyodide;
    const storage = extraBoolOrString(extraRaw.storage);
    if (storage !== undefined) extra.storage = storage;
    const onChain = extraBoolOrString(extraRaw.onChain ?? extraRaw['on-chain']);
    if (onChain !== undefined) extra.onChain = onChain;
    const noSolid = extraBoolOrString(extraRaw.noSolid ?? extraRaw['no-solid']);
    if (noSolid !== undefined) extra.noSolid = noSolid;
    if (extraRaw.flagOff === true) extra.flagOff = true;
    return {
      id,
      name,
      kind: raw.kind,
      builtIn: raw.builtIn === true,
      description,
      extra,
    };
  } catch {
    return null;
  }
}

export function normalizePlugins(raw: unknown): PluginCard[] {
  try {
    if (!Array.isArray(raw)) return [];
    const out: PluginCard[] = [];
    for (const entry of raw) {
      const card = normalizePluginCard(entry);
      if (card) out.push(card);
    }
    return out;
  } catch {
    return [];
  }
}

export function normalizeActive(raw: unknown): ActivePluginsMap {
  const out: ActivePluginsMap = {};
  try {
    if (!isPlainObject(raw)) return out;
    for (const kind of PLUGIN_KINDS) {
      const id = raw[kind];
      if (typeof id === 'string' && id.trim()) out[kind] = id.trim();
    }
  } catch {
    return out;
  }
  return out;
}

export function normalizeFlags(raw: unknown): PluginsFlags {
  const out: PluginsFlags = {};
  try {
    if (!isPlainObject(raw)) return out;
    if (typeof raw.allowPyodide === 'boolean') out.allowPyodide = raw.allowPyodide;
  } catch {
    return out;
  }
  return out;
}

/**
 * Never-throw decode of studio.init / studio.set envelopes addressed to the
 * plugins view. Strict: the envelope must decode through the shared codec,
 * carry the plugins view, and a plain-object `data` record. Null for
 * anything else.
 */
export function decodePluginsStudioMessage(raw: unknown): PluginsStudioState | null {
  const message = decodeStudioData(raw);
  if (!message || message.view !== PLUGINS_VIEW) return null;
  if (!isPlainObject(message.data)) return null;
  return { kind: message.kind, data: message.data };
}

/** studio.ready for the plugins view — no capabilities, as before. */
export function encodePluginsReady(): AxisEnvelope<StudioReadyPayload> {
  return encodeStudioReady(PLUGINS_VIEW);
}

/** studio.action `activate` — the old flat `kind` / `id` fields ride `args`. */
export function encodePluginsActivate(
  kind: unknown,
  id: unknown,
): AxisEnvelope<StudioActionPayload> | null {
  try {
    if (!isPluginKind(kind)) return null;
    if (typeof id !== 'string') return null;
    const trimmed = id.trim();
    if (!trimmed) return null;
    return encodeStudioAction(PLUGINS_VIEW, 'activate', { kind, id: trimmed });
  } catch {
    return null;
  }
}
