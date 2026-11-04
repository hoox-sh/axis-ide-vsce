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

import { afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resetLoggerForTests, setLogSink } from '../host/logger';
import { HOST_TO_VIEW, VIEW_TO_HOST, decode, encode } from '../protocol';

type Registration = {
  id: string;
  provider: unknown;
  options?: { webviewOptions?: { retainContextWhenHidden?: boolean } };
};

type G = {
  __axisWatchlistRegistrations?: Registration[];
  __axisWatchlistRegisterThrow?: boolean;
  __axisWatchlistThemeKind?: number;
};

function g(): G {
  return globalThis as G;
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
    return new Uri(join(base?.fsPath ?? '', ...parts));
  }
  toString() {
    return `file://${this.fsPath}`;
  }
}

const ColorThemeKind = { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 };

const vscodeApi = {
  ColorThemeKind,
  Uri,
  window: {
    get activeColorTheme() {
      return { kind: g().__axisWatchlistThemeKind ?? ColorThemeKind.Dark };
    },
    registerWebviewViewProvider: (
      id: string,
      provider: unknown,
      options?: { webviewOptions?: { retainContextWhenHidden?: boolean } },
    ) => {
      if (g().__axisWatchlistRegisterThrow) throw new Error('register');
      g().__axisWatchlistRegistrations?.push({ id, provider, options });
      return { dispose() {} };
    },
  },
};

mock.module('vscode', () => ({
  get ColorThemeKind() {
    return vscodeApi.ColorThemeKind;
  },
  get Uri() {
    return vscodeApi.Uri;
  },
  get window() {
    return vscodeApi.window;
  },
}));

type PanelMod = typeof import('./watchlist-panel');

let panel: PanelMod;

beforeAll(async () => {
  // Quiet router drops for the hostile-input cases below.
  setLogSink(() => {});
  panel = await import('./watchlist-panel');
});

/** Shape of one posted studio.init / studio.set envelope. */
type PostedEnvelope = {
  v: number;
  type: string;
  payload: { view: string; data: Record<string, unknown> };
};

function posted(bucket: unknown[]): PostedEnvelope[] {
  return bucket as PostedEnvelope[];
}

function makeAssets(): string {
  const root = mkdtempSync(join(tmpdir(), 'axis-watchlist-wv-'));
  const dir = join(root, 'dist', 'webview', 'watchlist');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'main.js'), '/* watchlist */');
  writeFileSync(join(dir, 'main.css'), '/* css */');
  return root;
}

function makeWebview() {
  let html = '';
  let messageHandler: ((raw: unknown) => unknown) | undefined;
  const out: unknown[] = [];
  let shown: { preserveFocus?: boolean } = {};
  const webview = {
    cspSource: 'https://csp.test',
    options: {} as { enableScripts?: boolean; localResourceRoots?: Array<{ fsPath: string }> },
    asWebviewUri: (u: { fsPath: string }) => ({
      toString: () => `https://webview.test/${u.fsPath.split('/').pop()}`,
    }),
    postMessage: (msg: unknown) => {
      out.push(msg);
      return true;
    },
    onDidReceiveMessage(cb: (raw: unknown) => unknown) {
      messageHandler = cb;
      return { dispose() {} };
    },
    get html() {
      return html;
    },
    set html(value: string) {
      html = value;
    },
  };
  let disposeHandler: (() => void) | undefined;
  const view = {
    webview,
    onDidDispose(cb: () => void) {
      disposeHandler = cb;
      return { dispose() {} };
    },
    show(preserveFocus?: boolean) {
      shown = { preserveFocus };
    },
  };
  return {
    webview,
    view,
    out,
    getShown: () => shown,
    getHandler: () => messageHandler,
    fireDispose: () => disposeHandler?.(),
  };
}

/** workspaceState store the panel mutates through read/writeWatchlistV1. */
function makeState(initial: Record<string, unknown>) {
  const store = new Map<string, unknown>(Object.entries(initial));
  let failWrites = false;
  const state = {
    get: <T>(key: string) => (store.has(key) ? (store.get(key) as T) : undefined),
    update: (key: string, value: unknown) => {
      if (failWrites) throw new Error('update');
      store.set(key, value);
      return Promise.resolve();
    },
    read: () => store,
    failNextWrites() {
      failWrites = true;
    },
  };
  return state;
}

function makeContext(root: string, workspaceState: ReturnType<typeof makeState>) {
  return {
    subscriptions: [] as Array<{ dispose(): void }>,
    extensionUri: Uri.file(root),
    workspaceState,
  };
}

beforeEach(() => {
  g().__axisWatchlistRegistrations = [];
  g().__axisWatchlistRegisterThrow = false;
  g().__axisWatchlistThemeKind = ColorThemeKind.Dark;
});

describe('registerWatchlistStudio wiring', () => {
  test('registers axis.watchlist with retainContextWhenHidden true', () => {
    const context = makeContext('/tmp', makeState({}));
    const provider = panel.registerWatchlistStudio(context as never);
    expect(provider).toBeInstanceOf(panel.WatchlistStudioProvider);
    expect(g().__axisWatchlistRegistrations).toHaveLength(1);
    expect(g().__axisWatchlistRegistrations?.[0]?.id).toBe('axis.watchlist');
    expect(
      g().__axisWatchlistRegistrations?.[0]?.options?.webviewOptions?.retainContextWhenHidden,
    ).toBe(true);
    expect(context.subscriptions).toHaveLength(1);

    // hostile host: registerStudioView returns undefined and the wrapper survives
    g().__axisWatchlistRegisterThrow = true;
    const hostile = panel.registerWatchlistStudio(makeContext('/tmp', makeState({})) as never);
    expect(() => hostile.postSnapshot()).not.toThrow();
    expect(() => hostile.reveal()).not.toThrow();
    g().__axisWatchlistRegisterThrow = false;
  });

  test('shell body + theme class come from the generic provider', () => {
    const state = makeState({ 'axis.watchlist.v1': { symbols: ['BTCUSDT'], selected: 'BTCUSDT' } });
    const provider = new panel.WatchlistStudioProvider(
      makeContext(makeAssets(), state) as never,
    );
    const inner = g().__axisWatchlistRegistrations?.at(-1)?.provider as {
      resolveWebviewView(view: unknown): void;
    };
    const w = makeWebview();
    inner.resolveWebviewView(w.view);
    expect(w.webview.options.enableScripts).toBe(true);
    expect(w.webview.html).toContain('id="watchlist-root"');
    expect(w.webview.html).toContain('data-axis-watchlist-host="1"');
    expect(w.webview.html).toContain("connect-src 'none'");
    expect(w.webview.html).toContain('class="vscode-dark"');

    g().__axisWatchlistThemeKind = ColorThemeKind.Light;
    const w2 = makeWebview();
    inner.resolveWebviewView(w2.view);
    expect(w2.webview.html).toContain('class="vscode-light"');
  });
});

describe('watchlist studio message flow', () => {
  test('studio.ready handshake answers with studio.init carrying the snapshot', () => {
    const state = makeState({ 'axis.watchlist.v1': { symbols: ['BTCUSDT'], selected: 'BTCUSDT' } });
    new panel.WatchlistStudioProvider(makeContext(makeAssets(), state) as never);
    const inner = g().__axisWatchlistRegistrations?.at(-1)?.provider as {
      resolveWebviewView(view: unknown): void;
    };
    const w = makeWebview();
    inner.resolveWebviewView(w.view);
    expect(w.out).toHaveLength(0);

    const handler = w.getHandler();
    expect(handler).toBeTypeOf('function');
    handler?.(encode(VIEW_TO_HOST.StudioReady, { view: 'watchlist' }));
    expect(w.out).toHaveLength(1);
    const init = posted(w.out)[0];
    expect(init.v).toBe(1);
    expect(init.type).toBe(HOST_TO_VIEW.StudioInit);
    expect(init.payload.view).toBe('watchlist');
    expect(init.payload.data).toEqual({
      count: 1,
      selected: 'BTCUSDT',
      focusSymbol: 'BTCUSDT',
      focusPriceText: '100.00',
      placeholder: true,
      rows: [
        { symbol: 'BTCUSDT', priceText: '100.00', selected: true, placeholder: true },
      ],
    });
    expect(decode(w.out[0]).ok).toBe(true);

    // another studio's ready never reaches this panel
    handler?.(encode(VIEW_TO_HOST.StudioReady, { view: 'colors' }));
    expect(w.out).toHaveLength(1);
  });

  test('studio.action add writes workspaceState, notifies, and posts studio.set', async () => {
    const state = makeState({ 'axis.watchlist.v1': { symbols: ['BTCUSDT'], selected: 'BTCUSDT' } });
    const persisted: unknown[] = [];
    const provider = new panel.WatchlistStudioProvider(makeContext(makeAssets(), state) as never, {
      onPersisted(next) {
        persisted.push(next);
      },
    });
    expect(provider).toBeInstanceOf(panel.WatchlistStudioProvider);
    const inner = g().__axisWatchlistRegistrations?.at(-1)?.provider as {
      resolveWebviewView(view: unknown): void;
    };
    const w = makeWebview();
    inner.resolveWebviewView(w.view);

    const handler = w.getHandler();
    handler?.(
      encode(VIEW_TO_HOST.StudioAction, {
        view: 'watchlist',
        action: 'add',
        args: { symbol: ' eth usdt ' },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(state.read().get('axis.watchlist.v1')).toEqual({
      symbols: ['BTCUSDT', 'ETHUSDT'],
      selected: 'ETHUSDT',
    });
    expect(persisted).toEqual([{ symbols: ['BTCUSDT', 'ETHUSDT'], selected: 'ETHUSDT' }]);
    expect(w.out).toHaveLength(1);
    const set = posted(w.out)[0];
    expect(set.type).toBe(HOST_TO_VIEW.StudioSet);
    expect(set.payload.view).toBe('watchlist');
    expect(set.payload.data).toEqual({
      count: 2,
      selected: 'ETHUSDT',
      focusSymbol: 'ETHUSDT',
      focusPriceText: '100.00',
      placeholder: true,
      rows: [
        { symbol: 'BTCUSDT', priceText: '100.00', selected: false, placeholder: true },
        { symbol: 'ETHUSDT', priceText: '100.00', selected: true, placeholder: true },
      ],
    });
  });

  test('remove and select actions mutate through the same path', async () => {
    const state = makeState({ 'axis.watchlist.v1': { symbols: ['BTCUSDT'], selected: 'BTCUSDT' } });
    new panel.WatchlistStudioProvider(makeContext(makeAssets(), state) as never);
    const inner = g().__axisWatchlistRegistrations?.at(-1)?.provider as {
      resolveWebviewView(view: unknown): void;
    };
    const w = makeWebview();
    inner.resolveWebviewView(w.view);
    const handler = w.getHandler();

    handler?.(
      encode(VIEW_TO_HOST.StudioAction, {
        view: 'watchlist',
        action: 'select',
        args: { symbol: 'btcusdt' },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(state.read().get('axis.watchlist.v1')).toEqual({
      symbols: ['BTCUSDT'],
      selected: 'BTCUSDT',
    });

    handler?.(
      encode(VIEW_TO_HOST.StudioAction, {
        view: 'watchlist',
        action: 'remove',
        args: { symbol: 'BTCUSDT' },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(state.read().get('axis.watchlist.v1')).toEqual({ symbols: [], selected: null });
    const last = posted(w.out).at(-1);
    expect(last?.type).toBe(HOST_TO_VIEW.StudioSet);
    expect(last?.payload.data).toEqual({
      count: 0,
      selected: null,
      focusSymbol: null,
      focusPriceText: '—',
      placeholder: true,
      rows: [],
    });
  });

  test('empty or hostile symbols and unknown actions are ignored', async () => {
    const state = makeState({ 'axis.watchlist.v1': { symbols: ['BTCUSDT'], selected: 'BTCUSDT' } });
    new panel.WatchlistStudioProvider(makeContext(makeAssets(), state) as never);
    const inner = g().__axisWatchlistRegistrations?.at(-1)?.provider as {
      resolveWebviewView(view: unknown): void;
    };
    const w = makeWebview();
    inner.resolveWebviewView(w.view);
    const handler = w.getHandler();
    expect(w.out).toHaveLength(0);

    handler?.(
      encode(VIEW_TO_HOST.StudioAction, { view: 'watchlist', action: 'add', args: { symbol: ' ' } }),
    );
    handler?.(encode(VIEW_TO_HOST.StudioAction, { view: 'watchlist', action: 'add' }));
    handler?.(encode(VIEW_TO_HOST.StudioAction, { view: 'watchlist', action: 'nope' }));
    handler?.(encode(VIEW_TO_HOST.StudioAction, { view: 'colors', action: 'add' }));
    // old flat wire is now undecodable
    handler?.({ type: 'watchlist.add', symbol: 'ETHUSDT' });
    handler?.(null);
    handler?.('x');
    await Promise.resolve();
    await Promise.resolve();
    expect(state.read().get('axis.watchlist.v1')).toEqual({
      symbols: ['BTCUSDT'],
      selected: 'BTCUSDT',
    });
    expect(w.out).toHaveLength(0);
  });

  test('a failed write reposts the re-read state instead of the mutation', async () => {
    const state = makeState({ 'axis.watchlist.v1': { symbols: ['BTCUSDT'], selected: 'BTCUSDT' } });
    new panel.WatchlistStudioProvider(makeContext(makeAssets(), state) as never);
    const inner = g().__axisWatchlistRegistrations?.at(-1)?.provider as {
      resolveWebviewView(view: unknown): void;
    };
    const w = makeWebview();
    inner.resolveWebviewView(w.view);
    state.failNextWrites();

    w.getHandler()?.(
      encode(VIEW_TO_HOST.StudioAction, {
        view: 'watchlist',
        action: 'add',
        args: { symbol: 'ETHUSDT' },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(w.out).toHaveLength(1);
    const set = posted(w.out)[0];
    expect(set.type).toBe(HOST_TO_VIEW.StudioSet);
    expect(set.payload.data).toEqual({
      count: 1,
      selected: 'BTCUSDT',
      focusSymbol: 'BTCUSDT',
      focusPriceText: '100.00',
      placeholder: true,
      rows: [{ symbol: 'BTCUSDT', priceText: '100.00', selected: true, placeholder: true }],
    });
  });
});

describe('WatchlistStudioProvider push helpers', () => {
  test('postSnapshot, setQuoteFeed, and reveal drive the generic provider', () => {
    const state = makeState({
      'axis.watchlist.v1': { symbols: ['BTCUSDT'], selected: 'BTCUSDT' },
    });
    const provider = new panel.WatchlistStudioProvider(
      makeContext(makeAssets(), state) as never,
    );
    const inner = g().__axisWatchlistRegistrations?.at(-1)?.provider as {
      resolveWebviewView(view: unknown): void;
    };
    const w = makeWebview();
    inner.resolveWebviewView(w.view);

    provider.postSnapshot();
    expect(w.out).toHaveLength(1);
    expect(posted(w.out)[0]?.type).toBe(HOST_TO_VIEW.StudioSet);
    expect(posted(w.out)[0]?.payload.view).toBe('watchlist');

    provider.setQuoteFeed({
      getQuote: (symbol) => ({ tickPrice: 1234.5, barClose: 1, streamState: 'open' }),
    });
    const live = posted(w.out).at(-1);
    expect(live?.payload.data).toMatchObject({
      placeholder: false,
      rows: [{ symbol: 'BTCUSDT', priceText: '1234.50', selected: true, placeholder: false }],
    });

    provider.reveal();
    expect(w.getShown().preserveFocus).toBe(true);
  });

  test('a live feed wired at construction is not the placeholder', () => {
    const state = makeState({ 'axis.watchlist.v1': { symbols: ['BTCUSDT'], selected: null } });
    new panel.WatchlistStudioProvider(makeContext(makeAssets(), state) as never, {
      quoteFeed: { getQuote: () => ({ tickPrice: 1, barClose: 2, streamState: 'closed' }) },
    });
    const inner = g().__axisWatchlistRegistrations?.at(-1)?.provider as {
      resolveWebviewView(view: unknown): void;
    };
    const w = makeWebview();
    inner.resolveWebviewView(w.view);
    w.getHandler()?.(encode(VIEW_TO_HOST.StudioReady, { view: 'watchlist' }));
    const init = posted(w.out)[0];
    expect(init.payload.data).toMatchObject({ placeholder: false });
  });
});

afterEach(() => {
  resetLoggerForTests();
});

