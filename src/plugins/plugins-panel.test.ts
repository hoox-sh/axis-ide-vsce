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

import { afterEach, beforeAll, describe, expect, mock, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resetLoggerForTests, setLogSink } from '../host/logger';
import { HOST_TO_VIEW, VIEW_TO_HOST, encode } from '../protocol';

type G = {
  __axisAllowPyodide?: unknown;
  __axisLiveEnabled?: unknown;
  __axisAllowUrlInstall?: unknown;
  __axisEngineCfgThrow?: boolean;
  __axisCfgThrow?: string | true;
  __axisCfgGetThrow?: string;
  __axisRegisterWvThrow?: boolean;
  __axisThemeKind?: number;
  __axisThemeThrow?: boolean;
  __axisWebviewRegistrations?: Array<{
    id: string;
    options?: { webviewOptions?: { retainContextWhenHidden?: boolean } };
  }>;
};

function g(): G {
  return globalThis as G;
}

class EventEmitter {
  event = () => ({ dispose() {} });
  fire(_v?: unknown) {}
}

class TreeItem {
  label: string;
  collapsibleState: number;
  constructor(label: string, collapsibleState = 0) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

class LanguageModelTextPart {
  value: string;
  constructor(value: string) {
    this.value = value;
  }
}

class LanguageModelToolResult {
  content: unknown[];
  constructor(content: unknown[]) {
    this.content = content;
  }
}

class MarkdownString {
  value: string;
  constructor(value = '') {
    this.value = value;
  }
}

class McpStdioServerDefinition {
  label: string;
  command: string;
  args: string[];
  env: Record<string, string | number | null>;
  constructor(
    label: string,
    command: string,
    args: string[] = [],
    env: Record<string, string | number | null> = {},
  ) {
    this.label = label;
    this.command = command;
    this.args = args;
    this.env = env;
  }
}

class Uri {
  fsPath: string;
  constructor(fsPath: string) {
    this.fsPath = fsPath;
  }
  static file(p: string) {
    return new Uri(p);
  }
  static joinPath(base: { fsPath?: string }, ...parts: string[]) {
    const root = base?.fsPath ?? '';
    if (root === '/throw-fs') {
      return {
        get fsPath(): string {
          throw new Error('fsPath');
        },
      };
    }
    return new Uri(join(root, ...parts));
  }
  toString() {
    return `file://${this.fsPath}`;
  }
}

const ColorThemeKind = {
  Light: 1,
  Dark: 2,
  HighContrast: 3,
  HighContrastLight: 4,
};

const vscodeApi = {
  ColorThemeKind,
  Uri,
  EventEmitter,
  TreeItem,
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  StatusBarAlignment: { Left: 1, Right: 2 },
  LanguageModelTextPart,
  LanguageModelToolResult,
  MarkdownString,
  McpStdioServerDefinition,
  window: {
    get activeColorTheme() {
      if (g().__axisThemeThrow) throw new Error('theme');
      return { kind: g().__axisThemeKind ?? ColorThemeKind.Dark };
    },
    showWarningMessage: (_message: string) => undefined,
    createTreeView: (id: string, options?: { showCollapseAll?: boolean }) => {
      const bucket = (globalThis as { __axisPluginKindTreeViews?: Array<{ id: string }> })
        .__axisPluginKindTreeViews;
      if (bucket) bucket.push({ id, showCollapseAll: options?.showCollapseAll });
      return { dispose() {} };
    },
    registerWebviewViewProvider: (
      id: string,
      _provider: unknown,
      options?: { webviewOptions?: { retainContextWhenHidden?: boolean } },
    ) => {
      if (g().__axisRegisterWvThrow) throw new Error('register');
      const bucket = g().__axisWebviewRegistrations;
      if (bucket) bucket.push({ id, options });
      return { dispose() {} };
    },
    createStatusBarItem: () => ({
      text: '',
      tooltip: '',
      show() {},
      dispose() {},
    }),
  },
  workspace: {
    getConfiguration(section?: string) {
      if (g().__axisEngineCfgThrow === true) throw new Error('cfg');
      if (g().__axisCfgThrow === true || g().__axisCfgThrow === section) {
        throw new Error('cfg');
      }
      return {
        get(key: string, def?: unknown) {
          if (g().__axisCfgGetThrow === `${section}.${key}`) {
            throw new Error('get');
          }
          if (section === 'axis.engine' && key === 'allowPyodide') {
            return g().__axisAllowPyodide;
          }
          if (section === 'axis.live' && key === 'enabled') {
            return g().__axisLiveEnabled;
          }
          if (section === 'axis.plugins' && key === 'allowUrlInstall') {
            return g().__axisAllowUrlInstall;
          }
          return def;
        },
      };
    },
  },
  commands: {
    registerCommand: () => ({ dispose() {} }),
  },
  lm: {
    registerMcpServerDefinitionProvider: () => ({ dispose() {} }),
    registerTool: () => ({ dispose() {} }),
  },
};

mock.module('vscode', () => ({
  QuickPickItemKind: { Separator: -1, Default: 0 },
  LanguageModelTextPart,
  LanguageModelToolResult,
  MarkdownString,
  McpStdioServerDefinition,
  get ColorThemeKind() {
    return vscodeApi.ColorThemeKind;
  },
  get Uri() {
    return vscodeApi.Uri;
  },
  get EventEmitter() {
    return vscodeApi.EventEmitter;
  },
  get TreeItem() {
    return vscodeApi.TreeItem;
  },
  get TreeItemCollapsibleState() {
    return vscodeApi.TreeItemCollapsibleState;
  },
  get StatusBarAlignment() {
    return vscodeApi.StatusBarAlignment;
  },
  get window() {
    return vscodeApi.window;
  },
  get workspace() {
    return vscodeApi.workspace;
  },
  get commands() {
    return vscodeApi.commands;
  },
  get lm() {
    return vscodeApi.lm;
  },
}));

type PanelMod = typeof import('./plugins-panel');
type RegistryMod = typeof import('./registry');
type ActiveMod = typeof import('./active');

let panel: PanelMod;
let registryMod: RegistryMod;
let activeMod: ActiveMod;

beforeAll(async () => {
  panel = await import('./plugins-panel');
  registryMod = await import('./registry');
  activeMod = await import('./active');
});

afterEach(() => {
  resetLoggerForTests();
});

function makeAssets(withCss: boolean): string {
  const root = mkdtempSync(join(tmpdir(), 'axis-plugins-wv-'));
  const dir = join(root, 'dist', 'webview', 'plugins');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'main.js'), '/* plugins */');
  if (withCss) writeFileSync(join(dir, 'main.css'), '/* css */');
  return root;
}

function makeWebview(opts?: {
  asWebviewUri?: (u: { fsPath: string }) => { toString(): string };
  postMessage?: (msg: unknown) => Thenable<boolean> | boolean;
  htmlThrow?: boolean;
  htmlThrowAlways?: boolean;
}) {
  const order: string[] = [];
  let html = '';
  let htmlSets = 0;
  let messageHandler: ((raw: unknown) => unknown) | undefined;
  const posted: unknown[] = [];
  const webview = {
    cspSource: 'https://csp.test',
    options: {} as {
      enableScripts?: boolean;
      localResourceRoots?: Array<{ fsPath: string }>;
    },
    asWebviewUri:
      opts?.asWebviewUri ??
      ((u: { fsPath: string }) => ({
        toString: () => `https://webview.test/${u.fsPath.split('/').pop()}`,
      })),
    postMessage:
      opts?.postMessage ??
      ((msg: unknown) => {
        posted.push(msg);
        return true;
      }),
    onDidReceiveMessage(cb: (raw: unknown) => unknown) {
      order.push('onDidReceiveMessage');
      messageHandler = cb;
      return { dispose() {} };
    },
    get html() {
      return html;
    },
    set html(value: string) {
      htmlSets += 1;
      order.push('html');
      if (opts?.htmlThrowAlways || (opts?.htmlThrow && htmlSets === 1)) {
        throw new Error('html');
      }
      html = value;
    },
  };
  let disposeHandler: (() => void) | undefined;
  const view = {
    webview,
    show(preserveFocus?: boolean) {
      (view as { shown?: boolean }).shown = preserveFocus === true;
    },
    onDidDispose(cb: () => void) {
      disposeHandler = cb;
      return { dispose() {} };
    },
    shown: false,
  };
  return { webview, view, order, posted, getHandler: () => messageHandler, dispose: () => disposeHandler?.() };
}

function makeContext(extensionPath: string) {
  return { subscriptions: [] as Array<{ dispose(): void }>, extensionUri: Uri.file(extensionPath) };
}

/** One studio envelope as posted by the generic provider. */
interface StudioPosted {
  v: number;
  type: string;
  payload: { view: string; data?: Record<string, unknown> };
}

function asStudioPosted(raw: unknown): StudioPosted {
  return raw as StudioPosted;
}

describe('PluginsWebviewViewProvider', () => {
  test('constants and register retainContextWhenHidden', () => {
    expect(panel.PLUGINS_WEBVIEW_VIEW_ID).toBe('axis.plugins');
    g().__axisWebviewRegistrations = [];
    g().__axisRegisterWvThrow = false;
    const mem = activeMod.createMemoryWorkspaceState();
    const reg = new registryMod.HostPluginRegistry();
    const provider = panel.registerPluginsWebviewView(makeContext('/tmp') as never, reg, mem);
    expect(provider).toBeInstanceOf(panel.PluginsWebviewViewProvider);
    expect(provider.register()).toBe(provider);
    const rec = g().__axisWebviewRegistrations?.[0];
    expect(rec?.id).toBe('axis.plugins');
    expect(rec?.options?.webviewOptions?.retainContextWhenHidden).toBe(true);

    g().__axisRegisterWvThrow = true;
    expect(() =>
      panel.registerPluginsWebviewView(makeContext('/tmp') as never, reg, mem),
    ).not.toThrow();
    g().__axisRegisterWvThrow = false;
  });

  test('resolve sets options, handler before html, theme classes, css present/absent', () => {
    const mem = activeMod.createMemoryWorkspaceState();
    const reg = registryMod.ensureBuiltinsRegistered(new registryMod.HostPluginRegistry());

    g().__axisThemeKind = ColorThemeKind.Light;
    const withCss = makeAssets(true);
    const provider = new panel.PluginsWebviewViewProvider(
      makeContext(withCss) as never,
      reg,
      mem,
    );
    provider.register();
    const a = makeWebview();
    expect(() => provider.resolveWebviewView(a.view as never)).not.toThrow();
    expect(a.order[0]).toBe('onDidReceiveMessage');
    expect(a.order[1]).toBe('html');
    expect(a.webview.options.enableScripts).toBe(true);
    expect(a.webview.options.localResourceRoots?.[0]?.fsPath).toContain(
      join('dist', 'webview', 'plugins'),
    );
    expect(a.webview.html).toContain('id="plugins-root"');
    expect(a.webview.html).toContain('data-axis-plugins-host="1"');
    expect(a.webview.html).toContain('class="vscode-light"');
    expect(a.webview.html).toContain('https://webview.test/main.css');

    g().__axisThemeKind = ColorThemeKind.HighContrast;
    const noCss = makeAssets(false);
    const provider2 = new panel.PluginsWebviewViewProvider(
      makeContext(noCss) as never,
      reg,
      mem,
    );
    provider2.register();
    const b = makeWebview();
    provider2.resolveWebviewView(b.view as never);
    expect(b.webview.html).toContain('class="vscode-high-contrast"');
    expect(b.webview.html).toContain('main.css');

    g().__axisThemeKind = ColorThemeKind.HighContrastLight;
    const provider3 = new panel.PluginsWebviewViewProvider(
      makeContext(withCss) as never,
      reg,
      mem,
    );
    provider3.register();
    const c = makeWebview();
    provider3.resolveWebviewView(c.view as never);
    expect(c.webview.html).toContain('class="vscode-high-contrast-light"');

    g().__axisThemeKind = ColorThemeKind.Dark;
    const d = makeWebview();
    provider3.resolveWebviewView(d.view as never);
    expect(d.webview.html).toContain('class="vscode-dark"');

    g().__axisThemeThrow = true;
    const e = makeWebview();
    provider3.resolveWebviewView(e.view as never);
    expect(e.webview.html).toContain('class="vscode-dark"');
    g().__axisThemeThrow = false;
  });

  test('missing assets and html setter failures never throw', () => {
    const mem = activeMod.createMemoryWorkspaceState();
    const reg = new registryMod.HostPluginRegistry();
    const provider = new panel.PluginsWebviewViewProvider(
      makeContext('/no-such-axis-plugins-assets') as never,
      reg,
      mem,
    );
    provider.register();
    const a = makeWebview();
    expect(() => provider.resolveWebviewView(a.view as never)).not.toThrow();
    expect(a.webview.html).toContain('assets missing');

    const withCss = makeAssets(true);
    const okProvider = new panel.PluginsWebviewViewProvider(
      makeContext(withCss) as never,
      reg,
      mem,
    );
    okProvider.register();
    const boom = makeWebview({ htmlThrow: true });
    expect(() => okProvider.resolveWebviewView(boom.view as never)).not.toThrow();
    expect(boom.webview.html.length).toBeGreaterThan(0);

    const always = makeWebview({ htmlThrowAlways: true });
    expect(() => provider.resolveWebviewView(always.view as never)).not.toThrow();

    const throwFs = new panel.PluginsWebviewViewProvider(
      makeContext('/throw-fs') as never,
      reg,
      mem,
    );
    throwFs.register();
    const fsView = makeWebview();
    expect(() => throwFs.resolveWebviewView(fsView.view as never)).not.toThrow();
    // Detailed-but-sanitized fallback (same as the old per-studio builders):
    // the missing-assets reason is surfaced, the raw error is not.
    expect(fsView.webview.html).toContain('assets missing at unknown');

    const asThrow = makeWebview({
      asWebviewUri: () => {
        throw 'nope';
      },
    });
    const okProv = new panel.PluginsWebviewViewProvider(
      makeContext(withCss) as never,
      reg,
      mem,
    );
    okProv.register();
    expect(() => okProv.resolveWebviewView(asThrow.view as never)).not.toThrow();
    expect(asThrow.webview.html).toContain('nope');
  });

  test('ready posts init with extras; activate posts state and refresh', async () => {
    const mem = activeMod.createMemoryWorkspaceState();
    const reg = registryMod.ensureBuiltinsRegistered(new registryMod.HostPluginRegistry());
    g().__axisAllowPyodide = false;
    g().__axisLiveEnabled = true;
    g().__axisAllowUrlInstall = true;
    let refreshes = 0;
    const withCss = makeAssets(true);
    const provider = new panel.PluginsWebviewViewProvider(
      makeContext(withCss) as never,
      reg,
      mem,
      () => {
        refreshes += 1;
      },
    );
    provider.register();
    const w = makeWebview();
    provider.resolveWebviewView(w.view as never);
    const handler = w.getHandler();
    expect(handler).toBeTypeOf('function');
    await handler?.(encode(VIEW_TO_HOST.StudioReady, { view: 'plugins' }));
    const init = asStudioPosted(w.posted[0]);
    expect(init.v).toBe(1);
    expect(init.type).toBe(HOST_TO_VIEW.StudioInit);
    expect(init.payload.view).toBe('plugins');
    const data = init.payload.data as {
      plugins: Array<{ id: string; kind: string; extra?: Record<string, unknown> }>;
      flags: { allowPyodide: boolean; liveEnabled: boolean; allowUrlInstall: boolean };
    };
    expect(data.flags).toEqual({
      allowPyodide: false,
      liveEnabled: true,
      allowUrlInstall: true,
    });
    const source = data.plugins.find((p) => p.kind === 'source');
    const stream = data.plugins.find((p) => p.kind === 'stream');
    const pyodide = data.plugins.find((p) => p.id === 'pyodide');
    const storage = data.plugins.find((p) => p.kind === 'storage');
    const dataset = data.plugins.find((p) => p.kind === 'dataset');
    const component = data.plugins.find((p) => p.kind === 'component');
    expect(source?.extra?.role).toBe('Historical OHLCV');
    expect(stream?.extra?.role).toBe('Live bars');
    expect(stream?.extra?.liveEnabled).toBe(true);
    expect(pyodide?.extra?.role).toBe('Pine runtime');
    expect(pyodide?.extra?.flagOff).toBe(true);
    expect(storage?.extra?.role).toBe('Script library backend');
    expect(dataset?.extra?.role).toBe('On-chain dataset');
    expect(component).toBeUndefined();

    await handler?.(
      encode(VIEW_TO_HOST.StudioAction, {
        view: 'plugins',
        action: 'activate',
        args: { kind: 'source', id: 'okx-rest' },
      }),
    );
    // Activation is async (awaitable handler); drain the microtask queue.
    await new Promise((r) => setTimeout(r, 0));
    expect(refreshes).toBe(1);
    expect(activeMod.isActivePlugin(mem, 'source', 'okx-rest')).toBe(true);
    const state = asStudioPosted(w.posted[1]);
    expect(state.type).toBe(HOST_TO_VIEW.StudioSet);
    expect((state.payload.data as { active: { source?: string } }).active.source).toBe(
      'okx-rest',
    );

    // Unknown types, junk, and invalid activate args are logged-and-dropped.
    await handler?.({ type: 'nope' });
    await handler?.([]);
    await handler?.(
      encode(VIEW_TO_HOST.StudioAction, {
        view: 'plugins',
        action: 'activate',
        args: { kind: 'nope', id: 'x' },
      }),
    );
    await handler?.(
      encode(VIEW_TO_HOST.StudioAction, { view: 'nope', action: 'activate' }),
    );
    expect(w.posted.length).toBe(2);

    const boomPost = makeWebview({
      postMessage: () => {
        throw new Error('post');
      },
    });
    provider.resolveWebviewView(boomPost.view as never);
    expect(() =>
      boomPost.getHandler()?.(encode(VIEW_TO_HOST.StudioReady, { view: 'plugins' })),
    ).not.toThrow();
    expect(() =>
      boomPost
        .getHandler()
        ?.(
          encode(VIEW_TO_HOST.StudioAction, {
            view: 'plugins',
            action: 'activate',
            args: { kind: 'source', id: 'okx-rest' },
          }),
        ),
    ).not.toThrow();
    expect(() => provider.postState()).not.toThrow();
  });

  test('flags config throws, listAll throws, reveal, postState', async () => {
    const mem = activeMod.createMemoryWorkspaceState();
    const withCss = makeAssets(true);
    g().__axisCfgThrow = 'axis.engine';
    g().__axisLiveEnabled = false;
    g().__axisAllowUrlInstall = false;
    expect(panel.readPluginsFlags().allowPyodide).toBe(false);
    g().__axisCfgThrow = undefined;
    g().__axisCfgGetThrow = 'axis.live.enabled';
    expect(panel.readPluginsFlags().liveEnabled).toBe(false);
    g().__axisCfgGetThrow = undefined;

    const hostileReg = {
      listAll() {
        throw new Error('list');
      },
    };
    const provider = new panel.PluginsWebviewViewProvider(
      makeContext(withCss) as never,
      hostileReg as never,
      mem,
    );
    provider.register();
    const w = makeWebview();
    provider.resolveWebviewView(w.view as never);
    await w.getHandler()?.(encode(VIEW_TO_HOST.StudioReady, { view: 'plugins' }));
    const init = asStudioPosted(w.posted[0]);
    expect(init.type).toBe(HOST_TO_VIEW.StudioInit);
    expect((init.payload.data as { plugins: unknown[] }).plugins).toEqual([]);

    expect(() => provider.reveal()).not.toThrow();
    expect(w.view.shown).toBe(true);
    w.view.show = () => {
      throw new Error('show');
    };
    expect(() => provider.reveal()).not.toThrow();

    provider.postState();
    expect(asStudioPosted(w.posted[1]).type).toBe(HOST_TO_VIEW.StudioSet);

    // Hostile refreshTrees callback: the activation failure is swallowed and
    // state still posts (the catch in PluginsWebviewViewProvider.activate).
    const boomTrees = new panel.PluginsWebviewViewProvider(
      makeContext(withCss) as never,
      new registryMod.HostPluginRegistry() as never,
      mem,
      () => {
        throw new Error('trees-boom');
      },
    );
    boomTrees.register();
    const tw = makeWebview();
    boomTrees.resolveWebviewView(tw.view as never);
    await tw.getHandler()?.(encode(VIEW_TO_HOST.StudioReady, { view: 'plugins' }));
    expect(() =>
      tw.getHandler()?.(
        encode(VIEW_TO_HOST.StudioAction, {
          view: 'plugins',
          action: 'activate',
          args: { kind: 'source', id: 'okx-rest' },
        }),
      ),
    ).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(asStudioPosted(tw.posted.at(-1)).type).toBe(HOST_TO_VIEW.StudioSet);

    const other = makeWebview();
    provider.resolveWebviewView(other.view as never);
    w.dispose();
    provider.postState();
    expect(asStudioPosted(other.posted[0]).type).toBe(HOST_TO_VIEW.StudioSet);
    other.dispose();
    expect(() => provider.postState()).not.toThrow();
    expect(() => provider.reveal()).not.toThrow();

    const cssThrow = makeWebview({
      asWebviewUri: (u) => {
        if (String(u.fsPath).endsWith('main.css')) {
          throw new Error('css');
        }
        return { toString: () => `https://webview.test/${u.fsPath.split('/').pop()}` };
      },
    });
    const cssProv = new panel.PluginsWebviewViewProvider(
      makeContext(withCss) as never,
      new registryMod.HostPluginRegistry() as never,
      mem,
    );
    cssProv.register();
    expect(() => cssProv.resolveWebviewView(cssThrow.view as never)).not.toThrow();
    expect(cssThrow.webview.html).toContain('main.css');
  });

  test('css existsSync throw uses script-derived href; resolve outer catch', () => {
    const mem = activeMod.createMemoryWorkspaceState();
    const withCss = makeAssets(true);
    const origJoin = Uri.joinPath;
    Uri.joinPath = ((base: { fsPath?: string }, ...parts: string[]) => {
      if (parts[parts.length - 1] === 'main.css' && base.fsPath === withCss) {
        return {
          get fsPath(): string {
            throw new Error('css fs');
          },
        };
      }
      return origJoin(base, ...parts);
    }) as typeof Uri.joinPath;
    try {
      const provider = new panel.PluginsWebviewViewProvider(
        makeContext(withCss) as never,
        new registryMod.HostPluginRegistry() as never,
        mem,
      );
      provider.register();
      const w = makeWebview();
      expect(() => provider.resolveWebviewView(w.view as never)).not.toThrow();
      expect(w.webview.html).toContain('main.css');
    } finally {
      Uri.joinPath = origJoin;
    }

    const provider = new panel.PluginsWebviewViewProvider(
      makeContext(withCss) as never,
      new registryMod.HostPluginRegistry() as never,
      mem,
    );
    provider.register();
    expect(() =>
      provider.resolveWebviewView({
        get webview(): never {
          throw new Error('view');
        },
      } as never),
    ).not.toThrow();
  });

  test('decode failures and unknown actions are logged-and-dropped, never thrown', async () => {
    const drops: string[] = [];
    setLogSink((level, message) => {
      if (level === 'warn') drops.push(message);
    });
    const mem = activeMod.createMemoryWorkspaceState();
    const reg = registryMod.ensureBuiltinsRegistered(new registryMod.HostPluginRegistry());
    const withCss = makeAssets(true);
    const provider = new panel.PluginsWebviewViewProvider(
      makeContext(withCss) as never,
      reg,
      mem,
    );
    provider.register();
    const w = makeWebview();
    provider.resolveWebviewView(w.view as never);
    const handler = w.getHandler();
    expect(() => handler?.('garbage')).not.toThrow();
    expect(() => handler?.(null)).not.toThrow();
    expect(() => handler?.(encode(VIEW_TO_HOST.StudioAction, { view: 'plugins', action: 'nope' }))).not.toThrow();
    expect(drops.some((line) => line.includes('studio router dropped a message'))).toBe(true);
    expect(drops.some((line) => line.includes('no handler on plugins'))).toBe(true);
    expect(w.posted.length).toBe(0);
  });
});
