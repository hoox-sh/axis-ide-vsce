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
 * Plugins studio wire layer on the `studio.*` namespace of axis.webview.v1
 * (frozen Phase-1 contract). Pure — no vscode. Never throws — hostile
 * getters / arrays-where-objects return defaults or null.
 *
 * Host → view: `studio.init` carrying
 * `{ view: 'plugins', data: { plugins, active, flags } }` and `studio.set`
 * carrying `{ view: 'plugins', data: { active, flags } }` — the exact
 * fields the old flat `plugins.init` / `plugins.state` messages carried,
 * preserved verbatim. View → host: `studio.ready` and `studio.action`
 * (`activate`) — the old flat payload fields move into `args`.
 */

import type { StudioRegistration } from '../views/studio-registry';
import { parseActivePluginsV1 } from './active';
import {
  PLUGIN_KINDS,
  type ActivePluginsV1,
  type PluginKind,
} from './types';

/** `view` value for every Plugins studio envelope — exactly `'plugins'`. */
export const PLUGINS_STUDIO_VIEW = 'plugins';

/** VS Code view id of the Plugins studio (`axis.plugins`). */
export const PLUGINS_STUDIO_VIEW_ID = 'axis.plugins';

export type PluginsFlags = {
  allowPyodide: boolean;
  liveEnabled: boolean;
  allowUrlInstall: boolean;
};

export type PluginCardExtra = Record<string, string | boolean | number | null>;

export type PluginCard = {
  id: string;
  name: string;
  kind: PluginKind;
  builtIn: boolean;
  description?: string;
  extra?: PluginCardExtra;
};

/**
 * `studio.init` data — the exact `plugins` / `active` / `flags` fields the
 * old flat `plugins.init` message carried, preserved verbatim.
 */
export type PluginsInitData = {
  plugins: PluginCard[];
  active: ActivePluginsV1;
  flags: PluginsFlags;
};

/**
 * `studio.set` data — the exact `active` / `flags` fields the old flat
 * `plugins.state` message carried, preserved verbatim.
 */
export type PluginsStateData = {
  active: ActivePluginsV1;
  flags: PluginsFlags;
};

export const DEFAULT_PLUGINS_FLAGS: PluginsFlags = {
  allowPyodide: false,
  liveEnabled: false,
  allowUrlInstall: false,
};

export const PLUGIN_KIND_ROLES: Record<PluginKind, string> = {
  source: 'Historical OHLCV',
  stream: 'Live bars',
  engine: 'Pine runtime',
  storage: 'Script library backend',
  dataset: 'On-chain dataset',
  component: 'Host contribution (no Solid mount)',
};

const PYODIDE_ENGINE_ID = 'pyodide';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPluginKind(raw: unknown): raw is PluginKind {
  return typeof raw === 'string' && (PLUGIN_KINDS as readonly string[]).includes(raw);
}

function copyFlags(): PluginsFlags {
  return {
    allowPyodide: false,
    liveEnabled: false,
    allowUrlInstall: false,
  };
}

function readBoolFlag(raw: Record<string, unknown>, key: string): boolean {
  try {
    return raw[key] === true;
  } catch {
    return false;
  }
}

/** Parse flags object (never throws). Arrays / non-objects → defaults. */
export function parsePluginsFlags(raw: unknown): PluginsFlags {
  if (!isPlainObject(raw)) return copyFlags();
  return {
    allowPyodide: readBoolFlag(raw, 'allowPyodide'),
    liveEnabled: readBoolFlag(raw, 'liveEnabled'),
    allowUrlInstall: readBoolFlag(raw, 'allowUrlInstall'),
  };
}

/** Kind-specific `extra` bag for the plugins studio UI. */
export function extraForPluginCard(
  kind: PluginKind,
  id: string,
  flags: PluginsFlags,
): PluginCardExtra {
  try {
    const extra: PluginCardExtra = {
      role: PLUGIN_KIND_ROLES[kind] ?? '',
    };
    if (kind === 'stream') {
      extra.liveEnabled = flags.liveEnabled === true;
      extra.live = flags.liveEnabled === true;
    }
    if (kind === 'engine') {
      const pluginId = typeof id === 'string' ? id.trim() : '';
      if (pluginId === PYODIDE_ENGINE_ID && flags.allowPyodide !== true) {
        extra.flagOff = true;
      }
    }
    return extra;
  } catch {
    return { role: '' };
  }
}

/** Build one card from a registry descriptor (never throws). */
export function pluginCardFromDescriptor(
  raw: unknown,
  flags: PluginsFlags,
): PluginCard | null {
  try {
    if (!isPlainObject(raw)) return null;
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    const kindRaw = raw.kind;
    if (!id || !isPluginKind(kindRaw)) return null;
    const nameRaw = raw.name;
    const name =
      typeof nameRaw === 'string' && nameRaw.trim() ? nameRaw.trim() : id;
    const card: PluginCard = {
      id,
      name,
      kind: kindRaw,
      builtIn: raw.builtIn === true,
      extra: extraForPluginCard(kindRaw, id, flags),
    };
    if (raw.description != null) {
      const description = String(raw.description);
      if (description) card.description = description;
    }
    return card;
  } catch {
    return null;
  }
}

/** Map registry.listAll() → PluginCard[] (never throws). */
export function buildPluginCards(
  list: unknown,
  flags: PluginsFlags,
): PluginCard[] {
  try {
    if (!Array.isArray(list)) return [];
    const out: PluginCard[] = [];
    for (const item of list) {
      const card = pluginCardFromDescriptor(item, flags);
      if (card) out.push(card);
    }
    return out;
  } catch {
    return [];
  }
}

/** `studio.init` data builder (the old `plugins.init` payload, verbatim). */
export function pluginsInitData(
  plugins: unknown,
  active: unknown,
  flags: unknown,
): PluginsInitData {
  const parsedFlags = parsePluginsFlags(flags);
  const cards = Array.isArray(plugins)
    ? buildPluginCards(plugins, parsedFlags)
    : [];
  return {
    plugins: cards,
    active: parseActivePluginsV1(active),
    flags: parsedFlags,
  };
}

/** `studio.set` data builder (the old `plugins.state` payload, verbatim). */
export function pluginsStateData(active: unknown, flags: unknown): PluginsStateData {
  return {
    active: parseActivePluginsV1(active),
    flags: parsePluginsFlags(flags),
  };
}

/**
 * Old `decodePluginsWebToHost` activate validation, moved onto
 * `studio.action` args: `args.kind` must be a plugin kind and `args.id` a
 * non-empty trimmed string. Null otherwise — invalid activates are
 * ignored, never thrown.
 */
export function pluginsActivateFromArgs(args: unknown): { kind: PluginKind; id: string } | null {
  try {
    if (!isPlainObject(args)) return null;
    const kindRaw = args.kind;
    const idRaw = args.id;
    if (typeof kindRaw !== 'string' || typeof idRaw !== 'string') return null;
    const kind = kindRaw.trim();
    const id = idRaw.trim();
    if (!id || !isPluginKind(kind)) return null;
    return { kind, id };
  } catch {
    return null;
  }
}

/**
 * Trusted studio DOM for the Plugins shell body — the exact markup the old
 * plugins HTML builder emitted between the theme-classed `<body>` and the
 * script tag. The webview replaces this root's content on first paint;
 * inline scripts are refused by the shell regardless.
 */
export function buildPluginsStudioBody(): string {
  return `<div id="plugins-root" class="plugins-root" data-axis-plugins-host="1">
    <header class="plugins-root__header">
      <h1 class="plugins-root__title">Plugins</h1>
    </header>
  </div>`;
}

/** Host behavior the Plugins studio registration wires behind `studio.action`. */
export interface PluginsStudioHandlers {
  /** `studio.action activate` — activate one plugin kind/id. */
  activate(kind: PluginKind, id: string): void | Promise<void>;
  /** Current studio state — feeds the `studio.init` handshake ack. */
  state(): PluginsInitData;
}

/**
 * Build the Plugins `StudioRegistration` (enhancement plan §5 Phase 2).
 * Pure data + dispatch: the shim supplies the vscode-backed handlers, the
 * generic provider owns the shell, the ready handshake, and encoding.
 */
export function pluginsStudioRegistration(
  handlers: PluginsStudioHandlers,
): StudioRegistration {
  return {
    id: PLUGINS_STUDIO_VIEW,
    title: 'Plugins',
    viewId: PLUGINS_STUDIO_VIEW_ID,
    retainContextWhenHidden: true,
    buildBody: buildPluginsStudioBody,
    actions: {
      activate: async (args) => {
        const activation = pluginsActivateFromArgs(args);
        if (!activation) return;
        await handlers.activate(activation.kind, activation.id);
        handlers.state();
      },
    },
    restore: () => handlers.state(),
  };
}
