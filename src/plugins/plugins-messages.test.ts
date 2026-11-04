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

import { describe, expect, test } from 'bun:test';
import { htmlHasInlineScript } from '../editors/chart-html';
import { HOST_TO_VIEW, PROTOCOL_VERSION, VIEW_TO_HOST, decode, encode } from '../protocol';
import { DEFAULT_ACTIVE_PLUGINS_V1 } from './types';
import {
  DEFAULT_PLUGINS_FLAGS,
  PLUGINS_STUDIO_VIEW,
  PLUGINS_STUDIO_VIEW_ID,
  PLUGIN_KIND_ROLES,
  buildPluginCards,
  buildPluginsStudioBody,
  extraForPluginCard,
  parsePluginsFlags,
  pluginCardFromDescriptor,
  pluginsActivateFromArgs,
  pluginsInitData,
  pluginsStateData,
  pluginsStudioRegistration,
  type PluginsStudioHandlers,
} from './plugins-messages';

function hostileGet(key: string): Record<string, unknown> {
  return {
    get [key]() {
      throw new Error(`get ${key}`);
    },
  };
}

describe('plugins-messages', () => {
  test('studio identity constants match the axis.plugins view', () => {
    expect(PLUGINS_STUDIO_VIEW).toBe('plugins');
    expect(PLUGINS_STUDIO_VIEW_ID).toBe('axis.plugins');
  });

  test('parsePluginsFlags defaults and explicit true', () => {
    expect(parsePluginsFlags(undefined)).toEqual(DEFAULT_PLUGINS_FLAGS);
    expect(parsePluginsFlags(null)).toEqual(DEFAULT_PLUGINS_FLAGS);
    expect(parsePluginsFlags([])).toEqual(DEFAULT_PLUGINS_FLAGS);
    expect(parsePluginsFlags('nope')).toEqual(DEFAULT_PLUGINS_FLAGS);
    expect(
      parsePluginsFlags({
        allowPyodide: true,
        liveEnabled: true,
        allowUrlInstall: true,
      }),
    ).toEqual({
      allowPyodide: true,
      liveEnabled: true,
      allowUrlInstall: true,
    });
    expect(parsePluginsFlags({ allowPyodide: 1, liveEnabled: 'yes' })).toEqual(
      DEFAULT_PLUGINS_FLAGS,
    );
    expect(parsePluginsFlags(hostileGet('allowPyodide')).allowPyodide).toBe(false);
    expect(parsePluginsFlags(hostileGet('liveEnabled')).liveEnabled).toBe(false);
    expect(parsePluginsFlags(hostileGet('allowUrlInstall')).allowUrlInstall).toBe(
      false,
    );
  });

  test('extraForPluginCard roles and pyodide flagOff', () => {
    const off = DEFAULT_PLUGINS_FLAGS;
    const on = {
      allowPyodide: true,
      liveEnabled: true,
      allowUrlInstall: true,
    };
    expect(extraForPluginCard('source', 'binance-rest', off)).toEqual({
      role: PLUGIN_KIND_ROLES.source,
    });
    expect(extraForPluginCard('stream', 'binance-ws', off).liveEnabled).toBe(false);
    expect(extraForPluginCard('stream', 'binance-ws', off).live).toBe(false);
    expect(extraForPluginCard('stream', 'binance-ws', on).liveEnabled).toBe(true);
    expect(extraForPluginCard('stream', 'binance-ws', on).live).toBe(true);
    expect(extraForPluginCard('engine', 'pyodide', off).flagOff).toBe(true);
    expect(extraForPluginCard('engine', 'pyodide', on).flagOff).toBeUndefined();
    expect(extraForPluginCard('engine', 'server', off).flagOff).toBeUndefined();
    expect(extraForPluginCard('storage', 'local', off).role).toBe(
      PLUGIN_KIND_ROLES.storage,
    );
    expect(extraForPluginCard('dataset', 'defillama-tvl', off).role).toBe(
      PLUGIN_KIND_ROLES.dataset,
    );
    expect(extraForPluginCard('component', 'example-slot', off).role).toBe(
      PLUGIN_KIND_ROLES.component,
    );
    expect(extraForPluginCard('nope' as never, 'x', off).role).toBe('');
    const boomFlags = {
      get liveEnabled(): boolean {
        throw new Error('live');
      },
      allowPyodide: false,
      allowUrlInstall: false,
    };
    expect(extraForPluginCard('stream', 'binance-ws', boomFlags).role).toBe('');
  });

  test('pluginCardFromDescriptor and buildPluginCards', () => {
    const flags = parsePluginsFlags({ liveEnabled: true });
    expect(pluginCardFromDescriptor(null, flags)).toBeNull();
    expect(pluginCardFromDescriptor([], flags)).toBeNull();
    expect(pluginCardFromDescriptor({ id: '', kind: 'source' }, flags)).toBeNull();
    expect(pluginCardFromDescriptor({ id: 'x', kind: 'nope' }, flags)).toBeNull();
    expect(
      pluginCardFromDescriptor(
        { id: '  binance-rest  ', kind: 'source', builtIn: true },
        flags,
      ),
    ).toEqual({
      id: 'binance-rest',
      name: 'binance-rest',
      kind: 'source',
      builtIn: true,
      extra: { role: PLUGIN_KIND_ROLES.source },
    });
    const withName = pluginCardFromDescriptor(
      {
        id: 'okx-rest',
        name: '  OKX  ',
        kind: 'source',
        description: 'REST',
      },
      flags,
    );
    expect(withName?.name).toBe('OKX');
    expect(withName?.description).toBe('REST');
    expect(withName?.builtIn).toBe(false);

    const pyodide = pluginCardFromDescriptor(
      { id: 'pyodide', name: 'Pyodide', kind: 'engine', builtIn: true },
      DEFAULT_PLUGINS_FLAGS,
    );
    expect(pyodide?.extra?.flagOff).toBe(true);

    expect(buildPluginCards(undefined, flags)).toEqual([]);
    expect(buildPluginCards({}, flags)).toEqual([]);
    expect(
      buildPluginCards(
        [{ id: 'local', name: 'Local', kind: 'storage', builtIn: true }, { id: 'bad' }],
        flags,
      ).map((c) => c.id),
    ).toEqual(['local']);

    const hostileId = {
      get id() {
        throw new Error('id');
      },
      kind: 'source',
    };
    expect(pluginCardFromDescriptor(hostileId, flags)).toBeNull();

    const iter: unknown[] = [];
    Object.defineProperty(iter, Symbol.iterator, {
      value() {
        throw new Error('iter');
      },
    });
    expect(buildPluginCards(iter, flags)).toEqual([]);
  });

  test('pluginsInitData / pluginsStateData never throw', () => {
    const init = pluginsInitData(
      [
        {
          id: 'binance-ws',
          name: 'Binance WS',
          kind: 'stream',
          builtIn: true,
        },
      ],
      { source: 'okx-rest', apiKey: 'secret' },
      { liveEnabled: true },
    );
    expect(init.plugins[0]?.extra?.liveEnabled).toBe(true);
    expect(init.active.source).toBe('okx-rest');
    expect((init.active as { apiKey?: string }).apiKey).toBeUndefined();
    expect(init.flags.liveEnabled).toBe(true);

    expect(pluginsInitData({}, null, []).plugins).toEqual([]);
    expect(pluginsInitData(null, [], null).active.source).toBe(
      DEFAULT_ACTIVE_PLUGINS_V1.source,
    );

    const state = pluginsStateData({ engine: 'pyne-worker' }, { allowPyodide: true });
    expect(state.active.engine).toBe('pyne-worker');
    expect(state.flags.allowPyodide).toBe(true);

    expect(() => pluginsInitData(hostileGet('x'), hostileGet('y'), hostileGet('z'))).not.toThrow();
    expect(() => pluginsStateData(hostileGet('active'), hostileGet('flags'))).not.toThrow();
  });

  test('pluginsInitData rides the studio.init envelope and survives the JSON wire', () => {
    const data = pluginsInitData(
      [{ id: 'pyodide', name: 'Pyodide', kind: 'engine', builtIn: true }],
      { source: 'binance-rest' },
      { allowPyodide: false },
    );
    const envelope = encode(HOST_TO_VIEW.StudioInit, { view: PLUGINS_STUDIO_VIEW, data });
    expect(envelope.v).toBe(PROTOCOL_VERSION);
    const decoded = decode(JSON.parse(JSON.stringify(envelope)));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.envelope.type).toBe(HOST_TO_VIEW.StudioInit);
    expect(decoded.envelope.payload).toEqual({ view: 'plugins', data });

    const setData = pluginsStateData({ engine: 'server' }, {});
    const setEnvelope = encode(HOST_TO_VIEW.StudioSet, { view: PLUGINS_STUDIO_VIEW, data: setData });
    const setDecoded = decode(JSON.parse(JSON.stringify(setEnvelope)));
    expect(setDecoded.ok).toBe(true);
  });

  test('pluginsActivateFromArgs keeps the old activate validation', () => {
    expect(pluginsActivateFromArgs({ kind: 'source', id: 'okx-rest' })).toEqual({
      kind: 'source',
      id: 'okx-rest',
    });
    expect(pluginsActivateFromArgs({ kind: '  source  ', id: '  okx-rest  ' })).toEqual({
      kind: 'source',
      id: 'okx-rest',
    });
    expect(pluginsActivateFromArgs({ kind: 'source', id: '' })).toBeNull();
    expect(pluginsActivateFromArgs({ kind: 'source', id: '   ' })).toBeNull();
    expect(pluginsActivateFromArgs({ kind: 'nope', id: 'x' })).toBeNull();
    expect(pluginsActivateFromArgs({ kind: 1, id: 'x' })).toBeNull();
    expect(pluginsActivateFromArgs({ id: 'x' })).toBeNull();
    expect(pluginsActivateFromArgs({ kind: 'source' })).toBeNull();
    expect(pluginsActivateFromArgs(undefined)).toBeNull();
    expect(pluginsActivateFromArgs(null)).toBeNull();
    expect(pluginsActivateFromArgs([])).toBeNull();
    expect(pluginsActivateFromArgs('x')).toBeNull();
    expect(pluginsActivateFromArgs({})).toBeNull();
    expect(pluginsActivateFromArgs(hostileGet('kind'))).toBeNull();
    const kindBoom = {
      get kind() {
        throw new Error('kind');
      },
      id: 'x',
    };
    expect(pluginsActivateFromArgs(kindBoom)).toBeNull();
  });
});

describe('buildPluginsStudioBody', () => {
  test('emits the exact root the Plugins webview renders into', () => {
    const handlers: PluginsStudioHandlers = {
      activate: () => {},
      state: () => pluginsInitData([], {}, {}),
    };
    const body = pluginsStudioRegistration(handlers).buildBody?.();
    expect(body).toContain('id="plugins-root"');
    expect(body).toContain('class="plugins-root"');
    expect(body).toContain('data-axis-plugins-host="1"');
    expect(body).toContain('class="plugins-root__header"');
    expect(body).toContain('class="plugins-root__title"');
    expect(body).toContain('Plugins</h1>');
    expect(body).not.toContain('webview-ui-toolkit');
    expect(body).not.toContain('vscode-elements');
    expect(htmlHasInlineScript(body ?? '')).toBe(false);
    expect(buildPluginsStudioBody()).toBe(body);
  });
});

describe('pluginsStudioRegistration', () => {
  function makeHandlers() {
    const calls: string[] = [];
    const handlers: PluginsStudioHandlers = {
      activate: (kind, id) => {
        calls.push(`activate:${kind}:${id}`);
      },
      state: () => {
        calls.push('state');
        return pluginsInitData([], { source: 'binance-rest' }, {});
      },
    };
    return { handlers, calls };
  }

  test('registers the axis.plugins studio with retained context', () => {
    const { handlers } = makeHandlers();
    const entry = pluginsStudioRegistration(handlers);
    expect(entry.id).toBe('plugins');
    expect(entry.title).toBe('Plugins');
    expect(entry.viewId).toBe('axis.plugins');
    expect(entry.retainContextWhenHidden).toBe(true);
    expect(Object.keys(entry.actions)).toEqual(['activate']);
  });

  test('studio.action activate dispatches to the handler with validated args', async () => {
    const { handlers, calls } = makeHandlers();
    const entry = pluginsStudioRegistration(handlers);
    await entry.actions.activate?.(
      { kind: ' source ', id: ' okx-rest ' },
      { view: 'plugins', action: 'activate' },
    );
    await entry.actions.activate?.(
      { kind: 'nope', id: 'x' },
      { view: 'plugins', action: 'activate' },
    );
    await entry.actions.activate?.(undefined, { view: 'plugins', action: 'activate' });
    expect(calls).toEqual(['activate:source:okx-rest', 'state']);
  });

  test('restore feeds the studio.init handshake with the current catalog', () => {
    const { handlers } = makeHandlers();
    const entry = pluginsStudioRegistration(handlers);
    expect(entry.restore?.()).toEqual({
      plugins: [],
      active: { ...DEFAULT_ACTIVE_PLUGINS_V1, source: 'binance-rest' },
      flags: DEFAULT_PLUGINS_FLAGS,
    });
  });

  test('action names and data ride the studio.* envelopes verbatim', () => {
    const activateEnvelope = encode(VIEW_TO_HOST.StudioAction, {
      view: PLUGINS_STUDIO_VIEW,
      action: 'activate',
      args: { kind: 'engine', id: 'pyodide' },
    });
    const readyEnvelope = encode(VIEW_TO_HOST.StudioReady, { view: PLUGINS_STUDIO_VIEW });
    const decodedActivate = decode(JSON.parse(JSON.stringify(activateEnvelope)));
    const decodedReady = decode(JSON.parse(JSON.stringify(readyEnvelope)));
    expect(decodedActivate.ok && decodedReady.ok).toBe(true);
    if (!decodedActivate.ok) return;
    expect(decodedActivate.envelope.payload).toEqual({
      view: 'plugins',
      action: 'activate',
      args: { kind: 'engine', id: 'pyodide' },
    });
  });
});
