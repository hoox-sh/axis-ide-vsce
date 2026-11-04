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

import { afterEach, describe, expect, test } from 'bun:test';
import type { WebviewView } from 'vscode';
import { resetLoggerForTests, setLogSink } from '../host/logger';
import { encode } from '../protocol/codec';
import { HOST_TO_VIEW, VIEW_TO_HOST } from '../protocol/types';
import { StudioMessageRouter } from './studio-router';
import type { StudioRegistration } from './studio-registry';
import {
  registerStudioView,
  StudioViewProvider,
  type StudioContextLike,
  type StudioProviderDeps,
  type StudioViewHost,
  type StudioWebviewLike,
  type StudioWebviewViewLike,
} from './studio-provider';

const CSP_SOURCE = 'https://csp.test';

interface DepOverrides {
  files?: Set<string>;
  theme?: string;
  nonce?: string;
  fsPathThrows?: boolean;
  themeThrows?: boolean;
}

function makeDeps(overrides: DepOverrides = {}): StudioProviderDeps {
  const files =
    overrides.files ?? new Set<string>(['/ext/dist/webview/colors/main.js']);
  const deps: StudioProviderDeps = {
    extensionUri: { fsPath: '/ext' },
    joinPath: (base, ...parts) => ({
      fsPath: `${(base as { fsPath: string }).fsPath}/${parts.join('/')}`,
    }),
    fsPath: (uri) => {
      if (overrides.fsPathThrows) throw new Error('fsPath');
      return (uri as { fsPath: string }).fsPath;
    },
    assetExists: (path) => files.has(path),
    themeBodyClass: () => {
      if (overrides.themeThrows) throw new Error('theme');
      return overrides.theme ?? 'vscode-dark';
    },
  };
  if (overrides.nonce !== undefined) {
    const nonce = overrides.nonce;
    deps.createNonce = () => nonce;
  }
  return deps;
}

interface WebviewOverrides {
  postThrows?: boolean;
  htmlThrows?: 'first' | 'always';
  asWebviewThrows?: boolean;
  stateThrows?: boolean;
}

function makeWebview(overrides: WebviewOverrides = {}) {
  const posted: unknown[] = [];
  let messageHandler: ((raw: unknown) => unknown) | undefined;
  let disposeListener: (() => void) | undefined;
  let state: unknown;
  let htmlValue = '';
  let htmlSets = 0;
  const shown: { preserveFocus?: boolean } = { preserveFocus: undefined };

  const webview: StudioWebviewLike = {
    cspSource: CSP_SOURCE,
    options: {},
    asWebviewUri: (uri) => {
      if (overrides.asWebviewThrows) throw new Error('asWebviewUri');
      return { toString: () => `https://wv.test${(uri as { fsPath: string }).fsPath}` };
    },
    postMessage: (message) => {
      if (overrides.postThrows) throw new Error('post');
      posted.push(message);
      return true;
    },
    onDidReceiveMessage: (listener) => {
      messageHandler = listener;
      return { dispose() {} };
    },
    get html() {
      return htmlValue;
    },
    set html(value: string) {
      htmlSets += 1;
      if (overrides.htmlThrows === 'always' || (overrides.htmlThrows === 'first' && htmlSets === 1)) {
        throw new Error('html');
      }
      htmlValue = value;
    },
    getState: () => {
      if (overrides.stateThrows) throw new Error('state');
      return state;
    },
    setState: (next) => {
      if (overrides.stateThrows) throw new Error('state');
      state = next;
    },
  };

  const view: StudioWebviewViewLike = {
    webview,
    show(preserveFocus?: boolean) {
      shown.preserveFocus = preserveFocus;
    },
    onDidDispose: (listener) => {
      disposeListener = listener;
      return { dispose() {} };
    },
  };

  return {
    webview,
    view,
    posted,
    shown,
    getHandler: () => messageHandler,
    fireDispose: () => disposeListener?.(),
  };
}

interface ActionCall {
  args: Record<string, unknown> | undefined;
  ctx: { view: string; action: string };
}

function makeEntry(overrides: Partial<StudioRegistration> = {}) {
  const calls: ActionCall[] = [];
  const entry: StudioRegistration = {
    id: 'colors',
    title: 'Colors',
    viewId: 'axis.colors',
    retainContextWhenHidden: false,
    bodyClass: 'axis-colors',
    actions: {
      copy: (args, ctx) => calls.push({ args, ctx }),
    },
    buildBody: () => '<section id="colors-root" class="colors-root" data-axis-colors-host="1"></section>',
    restore: () => ({ colors: [] }),
    ...overrides,
  };
  return { entry, calls };
}

afterEach(() => {
  resetLoggerForTests();
});

describe('StudioViewProvider resolveStudioView', () => {
  test('resolveWebviewView forwards the vscode entry to resolveStudioView', () => {
    const { entry } = makeEntry();
    const provider = new StudioViewProvider(entry, makeDeps());
    const w = makeWebview();
    // The public vscode entry only ever sees a real WebviewView; cast the
    // shim and assert the forward resolves exactly like the narrow entry.
    provider.resolveWebviewView(w.view as unknown as WebviewView);
    expect(w.webview.options.enableScripts).toBe(true);
    expect(w.webview.html).toContain('<!DOCTYPE html>');
  });

  test('enables scripts, pins the asset root, and builds the nonce shell', () => {
    const { entry } = makeEntry();
    const provider = new StudioViewProvider(
      entry,
      makeDeps({ nonce: 'n0nce', theme: 'vscode-light', files: new Set([
        '/ext/dist/webview/colors/main.js',
        '/ext/dist/webview/colors/main.css',
      ]) }),
    );
    const w = makeWebview();
    provider.resolveStudioView(w.view);

    expect(w.webview.options.enableScripts).toBe(true);
    expect(w.webview.options.localResourceRoots?.[0]).toEqual({
      fsPath: '/ext/dist/webview/colors',
    });
    const html = w.webview.html;
    expect(html).toContain(`script-src 'nonce-n0nce' ${CSP_SOURCE}`);
    expect(html).toContain('nonce="n0nce" src="https://wv.test/ext/dist/webview/colors/main.js"');
    expect(html).toContain('href="https://wv.test/ext/dist/webview/colors/main.css"');
    expect(html).toContain('class="vscode-light axis-colors"');
    expect(html).toContain('<section id="colors-root"');
    expect(html).toContain('<noscript>AXIS panels need JavaScript enabled.</noscript>');
    expect(html).toContain("connect-src 'none'");
  });

  test('nonce-free shell, css fallback swap, and no-bodyClass defaults', () => {
    const { entry } = makeEntry({
      buildBody: undefined,
      restore: undefined,
      bodyClass: undefined,
    });
    const provider = new StudioViewProvider(entry, makeDeps());
    const w = makeWebview();
    provider.resolveStudioView(w.view);

    const html = w.webview.html;
    expect(html).toContain(`script-src ${CSP_SOURCE}`);
    expect(html).not.toContain('nonce=');
    // main.css missing → the script URI with the extension swapped.
    expect(html).toContain('href="https://wv.test/ext/dist/webview/colors/main.css"');
    expect(html).toContain('class="vscode-dark"');
    expect(html).not.toContain('id="colors-root"');
  });

  test('theme failure and a non-string entry bodyClass degrade safely', () => {
    const { entry } = makeEntry({ bodyClass: 7 as never });
    const provider = new StudioViewProvider(entry, makeDeps({ themeThrows: true }));
    const w = makeWebview();
    provider.resolveStudioView(w.view);
    expect(w.webview.html).toContain('class="vscode-dark"');
  });

  test('a throwing joinPath degrades to an empty asset root, never throws', () => {
    const { entry } = makeEntry();
    const deps = makeDeps();
    const provider = new StudioViewProvider(entry, {
      ...deps,
      joinPath: () => {
        throw new Error('joinPath-boom');
      },
    });
    const w = makeWebview();
    expect(() => provider.resolveStudioView(w.view)).not.toThrow();
    expect(w.webview.options.enableScripts).toBe(true);
    expect(w.webview.options.localResourceRoots).toEqual([]);
    expect(w.webview.html).toContain('assets missing at unknown');
  });

  test('missing assets render the fallback message; fsPath throw degrades the same way', () => {
    const { entry } = makeEntry();
    const provider = new StudioViewProvider(entry, makeDeps({ files: new Set() }));
    const w = makeWebview();
    expect(() => provider.resolveStudioView(w.view)).not.toThrow();
    expect(w.webview.html).toContain('AXIS colors webview assets missing at /ext/dist/webview/colors/main.js');
    expect(w.webview.html).toContain('bun run compile:webview');

    const throwing = new StudioViewProvider(entry, makeDeps({ fsPathThrows: true }));
    const w2 = makeWebview();
    expect(() => throwing.resolveStudioView(w2.view)).not.toThrow();
    expect(w2.webview.html).toContain('assets missing at unknown');
  });

  test('asWebviewUri failure and non-Error buildBody failures fall back', () => {
    const { entry } = makeEntry();
    const provider = new StudioViewProvider(entry, makeDeps());
    const w = makeWebview({ asWebviewThrows: true });
    expect(() => provider.resolveStudioView(w.view)).not.toThrow();
    expect(w.webview.html).toContain('asWebviewUri');

    const { entry: boom } = makeEntry({
      buildBody: (() => {
        throw 'boom-body';
      }) as () => string,
    });
    const boomProvider = new StudioViewProvider(boom, makeDeps());
    const w2 = makeWebview();
    boomProvider.resolveStudioView(w2.view);
    expect(w2.webview.html).toContain('boom-body');
  });

  test('a css-only fsPath failure falls back to the script swap', () => {
    const { entry } = makeEntry();
    const deps = makeDeps({
      files: new Set(['/ext/dist/webview/colors/main.js', '/ext/dist/webview/colors/main.css']),
    });
    deps.fsPath = (uri) => {
      if ((uri as { fsPath: string }).fsPath.endsWith('.css')) throw new Error('css-fs');
      return (uri as { fsPath: string }).fsPath;
    };
    const provider = new StudioViewProvider(entry, deps);
    const w = makeWebview();
    provider.resolveStudioView(w.view);
    expect(w.webview.html).toContain('href="https://wv.test/ext/dist/webview/colors/main.css"');
  });

  test('html setter failures are swallowed (first-set and always)', () => {
    const { entry } = makeEntry();
    const first = new StudioViewProvider(entry, makeDeps());
    const wf = makeWebview({ htmlThrows: 'first' });
    expect(() => first.resolveStudioView(wf.view)).not.toThrow();
    expect(wf.webview.html).toContain('html');

    const always = new StudioViewProvider(entry, makeDeps({ files: new Set() }));
    const wa = makeWebview({ htmlThrows: 'always' });
    expect(() => always.resolveStudioView(wa.view)).not.toThrow();
    expect(wa.webview.html).toBe('');
  });

  test('a hostile view never throws out of resolve', () => {
    const { entry } = makeEntry();
    const provider = new StudioViewProvider(entry, makeDeps());
    expect(() => provider.resolveStudioView(null as never)).not.toThrow();
    expect(provider.postInit()).toBe(false);
  });
});

describe('StudioViewProvider message flow', () => {
  test('studio.ready handshake ack posts studio.init with restore data', () => {
    const { entry } = makeEntry();
    const provider = new StudioViewProvider(entry, makeDeps());
    const w = makeWebview();
    provider.resolveStudioView(w.view);

    const handler = w.getHandler();
    expect(handler).toBeTypeOf('function');
    handler?.(encode(VIEW_TO_HOST.StudioReady, { view: 'colors', capabilities: ['copy'] }));
    expect(w.posted.length).toBe(1);
    const init = w.posted[0] as {
      v: number;
      type: string;
      payload: { view: string; data?: unknown };
    };
    expect(init.v).toBe(1);
    expect(init.type).toBe(HOST_TO_VIEW.StudioInit);
    expect(init.payload.view).toBe('colors');
    expect(init.payload.data).toEqual({ colors: [] });
  });

  test('restore returning undefined, missing, or throwing acks without data', () => {
    const warned: string[] = [];
    setLogSink((level, message) => {
      if (level === 'warn') warned.push(message);
    });

    const { entry: undefEntry } = makeEntry({ restore: () => undefined });
    const undef = new StudioViewProvider(undefEntry, makeDeps());
    const wu = makeWebview();
    undef.resolveStudioView(wu.view);
    wu.getHandler()?.(encode(VIEW_TO_HOST.StudioReady, { view: 'colors' }));
    expect((wu.posted[0] as { payload: unknown }).payload).toEqual({ view: 'colors' });

    const { entry: absentEntry } = makeEntry({ restore: undefined });
    const absent = new StudioViewProvider(absentEntry, makeDeps());
    const wa = makeWebview();
    absent.resolveStudioView(wa.view);
    wa.getHandler()?.(encode(VIEW_TO_HOST.StudioReady, { view: 'colors' }));
    expect((wa.posted[0] as { payload: unknown }).payload).toEqual({ view: 'colors' });

    const { entry: boomEntry } = makeEntry({
      restore: (() => {
        throw 'restore-boom';
      }) as () => unknown,
    });
    const boom = new StudioViewProvider(boomEntry, makeDeps());
    const wb = makeWebview();
    boom.resolveStudioView(wb.view);
    wb.getHandler()?.(encode(VIEW_TO_HOST.StudioReady, { view: 'colors' }));
    expect((wb.posted[0] as { payload: unknown }).payload).toEqual({ view: 'colors' });
    expect(warned.some((line) => line.includes('restore() failed: restore-boom'))).toBe(true);
  });

  test('studio.action routes to the entry handler with args and context', () => {
    const drops: string[] = [];
    setLogSink((level, message) => {
      if (level === 'warn') drops.push(message);
    });
    const { entry, calls } = makeEntry();
    const provider = new StudioViewProvider(entry, makeDeps());
    const w = makeWebview();
    provider.resolveStudioView(w.view);

    w.getHandler()?.(
      encode(VIEW_TO_HOST.StudioAction, { view: 'colors', action: 'copy', args: { text: '#fff' } }),
    );
    expect(calls).toEqual([{ args: { text: '#fff' }, ctx: { view: 'colors', action: 'copy' } }]);

    // Unknown view / unknown action / foreign traffic never reach the handler.
    w.getHandler()?.(encode(VIEW_TO_HOST.StudioAction, { view: 'nope', action: 'copy' }));
    w.getHandler()?.(encode(VIEW_TO_HOST.StudioAction, { view: 'colors', action: 'nope' }));
    w.getHandler()?.(encode(VIEW_TO_HOST.WebviewReady, { view: 'chart' }));
    expect(calls.length).toBe(1);
    expect(drops.some((line) => line.includes('unregistered view: nope'))).toBe(true);
    expect(drops.some((line) => line.includes('no handler on colors'))).toBe(true);
  });

  test('a hostile router never breaks the message handler', () => {
    const { entry } = makeEntry();
    const hostile = {
      register: () => () => {},
      handle: () => {
        throw new Error('router');
      },
    } as unknown as StudioMessageRouter;
    const provider = new StudioViewProvider(entry, makeDeps(), hostile);
    const w = makeWebview();
    provider.resolveStudioView(w.view);
    expect(() => w.getHandler()?.('anything')).not.toThrow();
  });
});

describe('StudioViewProvider pushes and state', () => {
  test('postStudioSet / postStudioNotice encode and post', () => {
    const { entry } = makeEntry();
    const provider = new StudioViewProvider(entry, makeDeps());
    const w = makeWebview();
    provider.resolveStudioView(w.view);

    expect(provider.postStudioSet({ rows: [] })).toBe(true);
    const set = w.posted.at(-1) as { type: string; payload: { view: string; data: unknown } };
    expect(set.type).toBe(HOST_TO_VIEW.StudioSet);
    expect(set.payload).toEqual({ view: 'colors', data: { rows: [] } });

    expect(provider.postStudioNotice('info', 'stream connected')).toBe(true);
    const notice = w.posted.at(-1) as {
      type: string;
      payload: { view: string; level: string; message: string };
    };
    expect(notice.type).toBe(HOST_TO_VIEW.StudioNotice);
    expect(notice.payload).toEqual({ view: 'colors', level: 'info', message: 'stream connected' });
  });

  test('codec refusals and dead views return false', () => {
    const { entry } = makeEntry();
    const provider = new StudioViewProvider(entry, makeDeps());
    const w = makeWebview();
    provider.resolveStudioView(w.view);
    expect(provider.postStudioNotice('', 'nope')).toBe(false);
    expect(provider.postStudioNotice('info', '')).toBe(false);

    const dead = new StudioViewProvider(makeEntry().entry, makeDeps());
    expect(dead.postStudioSet(1)).toBe(false);
    expect(dead.postStudioNotice('info', 'x')).toBe(false);
    expect(dead.postInit()).toBe(false);

    const boomPost = new StudioViewProvider(entry, makeDeps());
    const wb = makeWebview({ postThrows: true });
    boomPost.resolveStudioView(wb.view);
    expect(boomPost.postStudioSet(1)).toBe(false);
  });

  test('persistWebviewState / readWebviewState round-trip and tolerate hostile stores', () => {
    const { entry } = makeEntry();
    const provider = new StudioViewProvider(entry, makeDeps());
    const w = makeWebview();
    provider.resolveStudioView(w.view);
    expect(provider.readWebviewState()).toBeUndefined();
    provider.persistWebviewState({ tab: 'summary' });
    expect(provider.readWebviewState()).toEqual({ tab: 'summary' });

    const hostile = new StudioViewProvider(entry, makeDeps());
    const wh = makeWebview({ stateThrows: true });
    hostile.resolveStudioView(wh.view);
    expect(() => hostile.persistWebviewState({})).not.toThrow();
    expect(hostile.readWebviewState()).toBeUndefined();

    const detached = new StudioViewProvider(entry, makeDeps());
    detached.persistWebviewState({});
    expect(detached.readWebviewState()).toBeUndefined();
  });

  test('reveal shows the view and tolerates disposal', () => {
    const { entry } = makeEntry();
    const provider = new StudioViewProvider(entry, makeDeps());
    provider.reveal(true);
    const w = makeWebview();
    provider.resolveStudioView(w.view);
    provider.reveal(true);
    expect(w.shown.preserveFocus).toBe(true);
    provider.reveal();
    expect(w.shown.preserveFocus).toBeUndefined();
    w.view.show = () => {
      throw new Error('show');
    };
    expect(() => provider.reveal()).not.toThrow();
  });

  test('dispose unregisters the route and clears the view; hostile disposers never throw', () => {
    const warned: string[] = [];
    setLogSink((level, message) => {
      if (level === 'warn') warned.push(message);
    });
    const { entry } = makeEntry();
    const provider = new StudioViewProvider(entry, makeDeps());
    const w = makeWebview();
    provider.resolveStudioView(w.view);
    provider.dispose();
    expect(provider.postStudioSet(1)).toBe(false);
    w.getHandler()?.(encode(VIEW_TO_HOST.StudioReady, { view: 'colors' }));
    expect(w.posted.length).toBe(0);
    expect(warned.some((line) => line.includes('unregistered view: colors'))).toBe(true);

    const hostile = {
      register: () => () => {
        throw new Error('unregister');
      },
      handle: () => {},
    } as unknown as StudioMessageRouter;
    const hostileProvider = new StudioViewProvider(entry, makeDeps(), hostile);
    expect(() => hostileProvider.dispose()).not.toThrow();
  });

  test('onDidDispose clears only the current view instance', () => {
    const { entry } = makeEntry();
    const provider = new StudioViewProvider(entry, makeDeps());
    const w1 = makeWebview();
    provider.resolveStudioView(w1.view);
    const w2 = makeWebview();
    provider.resolveStudioView(w2.view);

    w1.fireDispose();
    expect(provider.postStudioSet(1)).toBe(true);
    w2.fireDispose();
    expect(provider.postStudioSet(1)).toBe(false);
  });
});

describe('registerStudioView', () => {
  test('applies the entry retainContextWhenHidden and pushes the subscription', () => {
    const registrations: Array<{
      id: string;
      options?: { webviewOptions?: { retainContextWhenHidden?: boolean } };
    }> = [];
    const host: StudioViewHost = {
      registerWebviewViewProvider: (id, _provider, options) => {
        registrations.push({ id, options });
        return { dispose() {} };
      },
    };
    const context: StudioContextLike = { subscriptions: [] };

    const retained = registerStudioView(
      makeEntry({ retainContextWhenHidden: true, id: 'library', viewId: 'axis.library' }).entry,
      makeDeps(),
      host,
      context,
    );
    expect(retained).toBeInstanceOf(StudioViewProvider);
    expect(registrations[0]?.id).toBe('axis.library');
    expect(registrations[0]?.options?.webviewOptions?.retainContextWhenHidden).toBe(true);

    registerStudioView(
      makeEntry({ retainContextWhenHidden: false, id: 'colors', viewId: 'axis.colors' }).entry,
      makeDeps(),
      host,
      context,
    );
    expect(registrations[1]?.id).toBe('axis.colors');
    expect(registrations[1]?.options?.webviewOptions?.retainContextWhenHidden).toBe(false);
    expect(context.subscriptions.length).toBe(2);
  });

  test('forwards a shared router so all studios dispatch through one instance', () => {
    const shared = new StudioMessageRouter();
    const host: StudioViewHost = {
      registerWebviewViewProvider: () => ({ dispose() {} }),
    };
    const { entry, calls } = makeEntry();
    const provider = registerStudioView(entry, makeDeps(), host, { subscriptions: [] }, shared);
    expect(provider).toBeDefined();
    shared.handle(encode(VIEW_TO_HOST.StudioAction, { view: 'colors', action: 'copy' }));
    expect(calls.length).toBe(1);
  });

  test('host or subscription failures return undefined (uncontributed view / test host)', () => {
    const boomHost: StudioViewHost = {
      registerWebviewViewProvider: () => {
        throw new Error('register');
      },
    };
    expect(
      registerStudioView(makeEntry().entry, makeDeps(), boomHost, { subscriptions: [] }),
    ).toBeUndefined();

    const pushBoomContext: StudioContextLike = { subscriptions: [] };
    pushBoomContext.subscriptions.push = () => {
      throw new Error('push');
    };
    const calmHost: StudioViewHost = {
      registerWebviewViewProvider: () => ({ dispose() {} }),
    };
    expect(
      registerStudioView(makeEntry().entry, makeDeps(), calmHost, pushBoomContext),
    ).toBeUndefined();
  });
});
