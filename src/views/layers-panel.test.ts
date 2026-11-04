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

type EditorCb = () => void;
type DocEventCb = (event: { document: unknown }) => void;

type G = {
  __axisLayersRegistrations?: Registration[];
  __axisLayersRegisterThrow?: boolean;
  __axisLayersThemeKind?: number;
  __axisLayersCommands?: string[];
  __axisLayersEditor?: unknown;
  __axisLayersDocs?: Array<{ uri: { toString(): string }; getText(): string; fileName: string }>;
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

let activeEditorCb: EditorCb | undefined;
let visibleEditorsCb: EditorCb | undefined;
let openDocCb: EditorCb | undefined;
let closeDocCb: EditorCb | undefined;
let changeDocCb: DocEventCb | undefined;
let tabsCb: EditorCb | undefined;

const vscodeApi = {
  ColorThemeKind,
  Uri,
  commands: {
    executeCommand: (id: string) => {
      g().__axisLayersCommands?.push(id);
      return Promise.resolve(undefined);
    },
  },
  window: {
    get activeColorTheme() {
      return { kind: g().__axisLayersThemeKind ?? ColorThemeKind.Dark };
    },
    get activeTextEditor() {
      return g().__axisLayersEditor as unknown;
    },
    get visibleTextEditors() {
      return [] as unknown[];
    },
    get tabGroups() {
      return {
        all: [],
        onDidChangeTabs(cb: EditorCb) {
          tabsCb = cb;
          return { dispose() {} };
        },
      };
    },
    onDidChangeActiveTextEditor(cb: EditorCb) {
      activeEditorCb = cb;
      return { dispose() {} };
    },
    onDidChangeVisibleTextEditors(cb: EditorCb) {
      visibleEditorsCb = cb;
      return { dispose() {} };
    },
    registerWebviewViewProvider: (
      id: string,
      provider: unknown,
      options?: { webviewOptions?: { retainContextWhenHidden?: boolean } },
    ) => {
      if (g().__axisLayersRegisterThrow) throw new Error('register');
      g().__axisLayersRegistrations?.push({ id, provider, options });
      return { dispose() {} };
    },
  },
  workspace: {
    get textDocuments() {
      return g().__axisLayersDocs ?? [];
    },
    onDidOpenTextDocument(cb: EditorCb) {
      openDocCb = cb;
      return { dispose() {} };
    },
    onDidCloseTextDocument(cb: EditorCb) {
      closeDocCb = cb;
      return { dispose() {} };
    },
    onDidChangeTextDocument(cb: DocEventCb) {
      changeDocCb = cb;
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
  get commands() {
    return vscodeApi.commands;
  },
  get window() {
    return vscodeApi.window;
  },
  get workspace() {
    return vscodeApi.workspace;
  },
  // `layers-panel` feature-detects the tab-input classes for open-chart tabs.
  TabInputCustom: class TabInputCustom {
    constructor(public readonly uri: unknown) {}
  },
  TabInputText: class TabInputText {
    constructor(public readonly uri: unknown) {}
  },
}));

type PanelMod = typeof import('./layers-panel');

let panel: PanelMod;

beforeAll(async () => {
  setLogSink(() => {});
  panel = await import('./layers-panel');
});

type PostedEnvelope = {
  v: number;
  type: string;
  payload: { view: string; data?: Record<string, unknown> };
};

function posted(bucket: unknown[]): PostedEnvelope[] {
  return bucket as PostedEnvelope[];
}

function makeAssets(): string {
  const root = mkdtempSync(join(tmpdir(), 'axis-layers-wv-'));
  const dir = join(root, 'dist', 'webview', 'layers');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'main.js'), '/* layers */');
  writeFileSync(join(dir, 'main.css'), '/* css */');
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

function chartDoc(text: string) {
  return {
    fileName: '/tmp/rsi.axis.json',
    uri: Uri.file('/tmp/rsi.axis.json'),
    getText: () => text,
    languageId: 'json',
  };
}

function makeContext(root: string) {
  return {
    subscriptions: [] as Array<{ dispose(): void }>,
    extensionUri: Uri.file(root),
  };
}

beforeEach(() => {
  g().__axisLayersRegistrations = [];
  g().__axisLayersRegisterThrow = false;
  g().__axisLayersThemeKind = ColorThemeKind.Dark;
  g().__axisLayersCommands = [];
  g().__axisLayersEditor = undefined;
  g().__axisLayersDocs = [];
  activeEditorCb = undefined;
  visibleEditorsCb = undefined;
  openDocCb = undefined;
  closeDocCb = undefined;
  changeDocCb = undefined;
  tabsCb = undefined;
});

afterEach(() => {
  resetLoggerForTests();
});

describe('registerLayersStudio wiring', () => {
  test('registers axis.layers with retainContextWhenHidden true and subscribes', () => {
    const context = makeContext('/tmp');
    const provider = panel.registerLayersStudio(context as never);
    expect(provider).toBeInstanceOf(panel.LayersStudioProvider);
    expect(g().__axisLayersRegistrations).toHaveLength(1);
    expect(g().__axisLayersRegistrations?.[0]?.id).toBe('axis.layers');
    expect(
      g().__axisLayersRegistrations?.[0]?.options?.webviewOptions?.retainContextWhenHidden,
    ).toBe(true);
    // registration disposable + 5 editor/doc events + live-doc + tabs
    expect(context.subscriptions.length).toBe(8);
    expect(tabsCb).toBeTypeOf('function');

    g().__axisLayersRegisterThrow = true;
    expect(panel.registerLayersStudio(makeContext('/tmp') as never)).toBeUndefined();
    g().__axisLayersRegisterThrow = false;
  });

  test('shell body and theme class come from the generic provider', () => {
    const context = makeContext(makeAssets());
    panel.registerLayersStudio(context as never);
    const inner = g().__axisLayersRegistrations?.at(-1)?.provider as {
      resolveWebviewView(view: unknown): void;
    };
    const w = makeWebview();
    inner.resolveWebviewView(w.view);
    expect(w.webview.options.enableScripts).toBe(true);
    expect(w.webview.html).toContain('id="layers-root"');
    expect(w.webview.html).toContain('data-axis-layers-host="1"');
    expect(w.webview.html).toContain('id="layers-open-chart"');
    expect(w.webview.html).toContain("connect-src 'none'");
    expect(w.webview.html).toContain('class="vscode-dark"');
    expect(w.webview.html).not.toContain('nonce=');

    g().__axisLayersThemeKind = ColorThemeKind.Light;
    const w2 = makeWebview();
    inner.resolveWebviewView(w2.view);
    expect(w2.webview.html).toContain('class="vscode-light"');
  });
});

describe('layers studio message flow', () => {
  test('studio.ready acks data-less and the async read posts the closed snapshot', async () => {
    panel.registerLayersStudio(makeContext(makeAssets()) as never);
    const inner = g().__axisLayersRegistrations?.at(-1)?.provider as {
      resolveWebviewView(view: unknown): void;
    };
    const w = makeWebview();
    inner.resolveWebviewView(w.view);
    expect(w.out).toHaveLength(0);

    const handler = w.getHandler();
    handler?.(encode(VIEW_TO_HOST.StudioReady, { view: 'layers' }));
    // data-less studio.init ack (the webview ignores it; the old panel never
    // posted at resolve either)
    expect(w.out).toHaveLength(1);
    const init = posted(w.out)[0];
    expect(init.type).toBe(HOST_TO_VIEW.StudioInit);
    expect(init.payload).toEqual({ view: 'layers' });
    expect(decode(w.out[0]).ok).toBe(true);

    // the old layers.ready async refresh, now posting studio.set
    await Promise.resolve();
    await Promise.resolve();
    expect(w.out).toHaveLength(2);
    const set = posted(w.out)[1];
    expect(set.type).toBe(HOST_TO_VIEW.StudioSet);
    expect(set.payload.view).toBe('layers');
    expect(set.payload.data).toMatchObject({
      chartOpen: false,
      total: 0,
      source: 'no chart open',
    });

    // another studio's ready never refreshes this panel
    handler?.(encode(VIEW_TO_HOST.StudioReady, { view: 'colors' }));
    expect(w.out).toHaveLength(2);
  });

  test('an open chart document feeds the Scripts section rows', async () => {
    const doc = chartDoc('{"symbol":"BTCUSDT","scripts":["sma","ema"],"drawings":[]}');
    g().__axisLayersDocs = [doc];
    g().__axisLayersEditor = { document: doc };
    panel.registerLayersStudio(makeContext(makeAssets()) as never);
    const inner = g().__axisLayersRegistrations?.at(-1)?.provider as {
      resolveWebviewView(view: unknown): void;
    };
    const w = makeWebview();
    inner.resolveWebviewView(w.view);
    w.getHandler()?.(encode(VIEW_TO_HOST.StudioReady, { view: 'layers' }));
    await Promise.resolve();
    await Promise.resolve();
    const set = posted(w.out).find(
      (item) => item.type === HOST_TO_VIEW.StudioSet,
    ) as PostedEnvelope;
    expect(set.payload.data).toMatchObject({
      chartOpen: true,
      source: 'from the open chart',
      total: 2,
    });
    const sections = (set.payload.data as { sections: Array<{ title: string; count: number }> })
      .sections;
    expect(sections.find((item) => item.title === 'Scripts')?.count).toBe(2);
  });

  test('studio.action openChart runs the axis.openChart command', () => {
    panel.registerLayersStudio(makeContext(makeAssets()) as never);
    const inner = g().__axisLayersRegistrations?.at(-1)?.provider as {
      resolveWebviewView(view: unknown): void;
    };
    const w = makeWebview();
    inner.resolveWebviewView(w.view);
    const handler = w.getHandler();

    handler?.(
      encode(VIEW_TO_HOST.StudioAction, { view: 'layers', action: 'openChart' }),
    );
    expect(g().__axisLayersCommands).toEqual(['axis.openChart']);

    // unknown action / foreign view / old flat wire never reach the command
    handler?.(encode(VIEW_TO_HOST.StudioAction, { view: 'layers', action: 'nope' }));
    handler?.(encode(VIEW_TO_HOST.StudioAction, { view: 'colors', action: 'openChart' }));
    handler?.({ type: 'layers.openChart' });
    handler?.(null);
    expect(g().__axisLayersCommands).toEqual(['axis.openChart']);
  });

  test('editor and document events re-post through the epoch guard', async () => {
    panel.registerLayersStudio(makeContext(makeAssets()) as never);
    const provider = g().__axisLayersRegistrations?.at(-1)?.provider as {
      resolveWebviewView(view: unknown): void;
    };
    const w = makeWebview();
    provider.resolveWebviewView(w.view);

    activeEditorCb?.();
    await Promise.resolve();
    await Promise.resolve();
    const sets = posted(w.out).filter((item) => item.type === HOST_TO_VIEW.StudioSet);
    expect(sets.length).toBeGreaterThanOrEqual(1);

    changeDocCb?.({ document: chartDoc('{"scripts":[]}') });
    await Promise.resolve();
    await Promise.resolve();
    expect(posted(w.out).filter((item) => item.type === HOST_TO_VIEW.StudioSet).length).toBe(
      sets.length + 1,
    );

    // non-chart document changes never bump; the four other events each do
    const before = posted(w.out).length;
    changeDocCb?.({ document: { fileName: 'x.pyne', uri: Uri.file('/tmp/x.pyne') } });
    await Promise.resolve();
    await Promise.resolve();
    expect(posted(w.out).length).toBe(before);
    // Four events in one tick coalesce through the epoch guard into a single
    // post — the guard exists precisely to collapse bursts like this.
    openDocCb?.();
    closeDocCb?.();
    visibleEditorsCb?.();
    tabsCb?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(posted(w.out).length).toBe(before + 1);
  });
});
