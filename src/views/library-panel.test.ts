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
  __axisLibraryRegistrations?: Registration[];
  __axisLibraryRegisterThrow?: boolean;
  __axisLibraryThemeKind?: number;
  __axisLibraryClipboard?: string[];
  __axisLibraryWarnings?: string[];
  __axisLibraryInfos?: string[];
  __axisLibraryErrors?: string[];
  __axisLibraryCommands?: string[];
  __axisLibraryOpenedDocs?: Array<{ content: string; languageId: string }>;
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
  commands: {
    executeCommand: (id: string) => {
      g().__axisLibraryCommands?.push(id);
      return Promise.resolve(undefined);
    },
  },
  env: {
    clipboard: {
      async writeText(text: string) {
        g().__axisLibraryClipboard?.push(text);
      },
    },
  },
  window: {
    get activeColorTheme() {
      return { kind: g().__axisLibraryThemeKind ?? ColorThemeKind.Dark };
    },
    showErrorMessage: (message: string) => {
      g().__axisLibraryErrors?.push(message);
      return undefined;
    },
    showInformationMessage: (message: string) => {
      g().__axisLibraryInfos?.push(message);
      return undefined;
    },
    showTextDocument: () => Promise.resolve(undefined),
    registerWebviewViewProvider: (
      id: string,
      provider: unknown,
      options?: { webviewOptions?: { retainContextWhenHidden?: boolean } },
    ) => {
      if (g().__axisLibraryRegisterThrow) throw new Error('register');
      g().__axisLibraryRegistrations?.push({ id, provider, options });
      return { dispose() {} };
    },
  },
  workspace: {
    openTextDocument: (opts: { content: string; languageId: string }) => {
      g().__axisLibraryOpenedDocs?.push(opts);
      return Promise.resolve({ ...opts });
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
  get commands() {
    return vscodeApi.commands;
  },
  get env() {
    return vscodeApi.env;
  },
  get window() {
    return vscodeApi.window;
  },
  get workspace() {
    return vscodeApi.workspace;
  },
}));

type PanelMod = typeof import('./library-panel');

let panel: PanelMod;

beforeAll(async () => {
  setLogSink(() => {});
  panel = await import('./library-panel');
});

type PostedEnvelope = {
  v: number;
  type: string;
  payload: { view: string; data: { cards: Array<Record<string, unknown>>; catalogError: string } };
};

function posted(bucket: unknown[]): PostedEnvelope[] {
  return bucket as PostedEnvelope[];
}

/** Minimal valid catalog: schema axis.builtins.v1 + one usable script. */
function makeCatalogRoot(ids: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'axis-library-wv-'));
  const dir = join(root, 'dist', 'webview', 'library');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'main.js'), '/* library */');
  writeFileSync(join(dir, 'main.css'), '/* css */');
  const catalogDir = join(root, 'media', 'builtins');
  mkdirSync(catalogDir, { recursive: true });
  const scripts = ids.map((id) => ({
    id,
    title: `AXIS ${id.toUpperCase()}`,
    shorttitle: id.toUpperCase(),
    kind: 'indicator',
    overlay: false,
    code: `//@version=6\nindicator("${id}")`,
  }));
  writeFileSync(
    join(catalogDir, 'catalog.json'),
    JSON.stringify({ schema: 'axis.builtins.v1', scripts }),
  );
  return root;
}

function makeWebview() {
  let html = '';
  let messageHandler: ((raw: unknown) => unknown) | undefined;
  const out: unknown[] = [];
  const webview = {
    cspSource: 'https://csp.test',
    options: {} as { enableScripts?: boolean },
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
  const view = {
    webview,
    onDidDispose(_cb: () => void) {
      return { dispose() {} };
    },
  };
  return { webview, view, out, getHandler: () => messageHandler };
}

function makeContext(root: string) {
  return {
    subscriptions: [] as Array<{ dispose(): void }>,
    extensionUri: Uri.file(root),
    extensionPath: root,
  };
}

beforeEach(() => {
  g().__axisLibraryRegistrations = [];
  g().__axisLibraryRegisterThrow = false;
  g().__axisLibraryThemeKind = ColorThemeKind.Dark;
  g().__axisLibraryClipboard = [];
  g().__axisLibraryWarnings = [];
  g().__axisLibraryInfos = [];
  g().__axisLibraryErrors = [];
  g().__axisLibraryCommands = [];
  g().__axisLibraryOpenedDocs = [];
});

afterEach(() => {
  resetLoggerForTests();
});

describe('registerLibraryStudio wiring', () => {
  test('registers axis.library with retainContextWhenHidden true', () => {
    const context = makeContext(makeCatalogRoot(['sma']));
    panel.registerLibraryStudio(context as never);
    expect(g().__axisLibraryRegistrations).toHaveLength(1);
    expect(g().__axisLibraryRegistrations?.[0]?.id).toBe('axis.library');
    expect(
      g().__axisLibraryRegistrations?.[0]?.options?.webviewOptions?.retainContextWhenHidden,
    ).toBe(true);
    expect(context.subscriptions).toHaveLength(1);

    g().__axisLibraryRegisterThrow = true;
    expect(() =>
      panel.registerLibraryStudio(makeContext('/tmp') as never),
    ).not.toThrow();
    g().__axisLibraryRegisterThrow = false;
  });

  test('shell body, nonce shell, and theme class come from the generic provider', () => {
    const context = makeContext(makeCatalogRoot(['sma']));
    new panel.LibraryWebviewViewProvider(context as never);
    const inner = g().__axisLibraryRegistrations?.at(-1)?.provider as {
      resolveWebviewView(view: unknown): void;
    };
    const w = makeWebview();
    inner.resolveWebviewView(w.view);
    expect(w.webview.options.enableScripts).toBe(true);
    expect(w.webview.html).toContain('id="library-root"');
    expect(w.webview.html).toContain('data-axis-library-host="1"');
    expect(w.webview.html).toContain('id="library-live"');
    expect(w.webview.html).toContain("script-src 'nonce-");
    expect(w.webview.html).toContain('nonce=');
    expect(w.webview.html).toContain("connect-src 'none'");
    expect(w.webview.html).toContain('class="vscode-dark"');

    g().__axisLibraryThemeKind = ColorThemeKind.HighContrast;
    const w2 = makeWebview();
    inner.resolveWebviewView(w2.view);
    expect(w2.webview.html).toContain('class="vscode-high-contrast"');
  });
});

describe('library studio message flow', () => {
  test('studio.ready handshake answers with studio.init carrying code-free cards', () => {
    const context = makeContext(makeCatalogRoot(['sma', 'ema']));
    new panel.LibraryWebviewViewProvider(context as never);
    const inner = g().__axisLibraryRegistrations?.at(-1)?.provider as {
      resolveWebviewView(view: unknown): void;
    };
    const w = makeWebview();
    inner.resolveWebviewView(w.view);
    expect(w.out).toHaveLength(0);

    const handler = w.getHandler();
    handler?.(encode(VIEW_TO_HOST.StudioReady, { view: 'library' }));
    expect(w.out).toHaveLength(1);
    const init = posted(w.out)[0];
    expect(init.v).toBe(1);
    expect(init.type).toBe(HOST_TO_VIEW.StudioInit);
    expect(init.payload.view).toBe('library');
    expect(init.payload.data.catalogError).toBe('');
    expect(init.payload.data.cards.map((card) => card.id)).toEqual(['sma', 'ema']);
    expect(JSON.stringify(init)).not.toContain('indicator("sma")');
    expect(decode(w.out[0]).ok).toBe(true);

    // another studio's ready never reaches this panel
    handler?.(encode(VIEW_TO_HOST.StudioReady, { view: 'watchlist' }));
    expect(w.out).toHaveLength(1);
  });

  test('a missing catalog surfaces as the catalogError data field', () => {
    const root = makeCatalogRoot(['sma']);
    const context = makeContext(join(root, 'gone'));
    new panel.LibraryWebviewViewProvider(context as never);
    const inner = g().__axisLibraryRegistrations?.at(-1)?.provider as {
      resolveWebviewView(view: unknown): void;
    };
    const w = makeWebview();
    inner.resolveWebviewView(w.view);
    w.getHandler()?.(encode(VIEW_TO_HOST.StudioReady, { view: 'library' }));
    const init = posted(w.out)[0];
    expect(init.payload.data.cards).toEqual([]);
    expect(init.payload.data.catalogError).toContain('AXIS builtins catalog');
  });

  test('studio.action apply opens the untitled Pine document for the id', async () => {
    const context = makeContext(makeCatalogRoot(['sma']));
    new panel.LibraryWebviewViewProvider(context as never);
    const inner = g().__axisLibraryRegistrations?.at(-1)?.provider as {
      resolveWebviewView(view: unknown): void;
    };
    const w = makeWebview();
    inner.resolveWebviewView(w.view);
    const handler = w.getHandler();

    handler?.(
      encode(VIEW_TO_HOST.StudioAction, {
        view: 'library',
        action: 'apply',
        args: { id: ' sma ' },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(g().__axisLibraryOpenedDocs).toHaveLength(1);
    expect(g().__axisLibraryOpenedDocs[0]?.content).toContain('indicator("sma")');
    expect(g().__axisLibraryInfos).toEqual(['AXIS: Applied builtin "AXIS SMA".']);

    // unknown id falls back to the builtin picker
    handler?.(
      encode(VIEW_TO_HOST.StudioAction, {
        view: 'library',
        action: 'apply',
        args: { id: 'nope' },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(g().__axisLibraryInfos.at(-1)).toContain('is not in the offline catalog');
    expect(g().__axisLibraryCommands).toEqual(['axis.applyBuiltin']);
  });

  test('studio.action copy routes the id to the host clipboard; bad ids are ignored', async () => {
    const context = makeContext(makeCatalogRoot(['sma']));
    new panel.LibraryWebviewViewProvider(context as never);
    const inner = g().__axisLibraryRegistrations?.at(-1)?.provider as {
      resolveWebviewView(view: unknown): void;
    };
    const w = makeWebview();
    inner.resolveWebviewView(w.view);
    const handler = w.getHandler();

    handler?.(
      encode(VIEW_TO_HOST.StudioAction, {
        view: 'library',
        action: 'copy',
        args: { id: 'sma' },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(g().__axisLibraryClipboard).toEqual(['sma']);

    handler?.(
      encode(VIEW_TO_HOST.StudioAction, { view: 'library', action: 'copy', args: { id: '' } }),
    );
    handler?.(encode(VIEW_TO_HOST.StudioAction, { view: 'library', action: 'copy' }));
    handler?.(encode(VIEW_TO_HOST.StudioAction, { view: 'library', action: 'nope' }));
    handler?.(encode(VIEW_TO_HOST.StudioAction, { view: 'colors', action: 'copy' }));
    // old flat wire is now undecodable
    handler?.({ type: 'library.copy', id: 'ema' });
    handler?.(null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(g().__axisLibraryClipboard).toEqual(['sma']);
  });
});
