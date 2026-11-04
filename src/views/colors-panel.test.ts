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

import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setLogSink } from '../host/logger';
import { HOST_TO_VIEW, VIEW_TO_HOST, decode, encode } from '../protocol';

type EditorDoc = {
  languageId: string;
  lineCount: number;
  fileName: string;
  uri: { fsPath: string };
  getText: () => string;
  lineAt: (index: number) => { range: { start: unknown; end: unknown } };
};

type TestEditor = {
  document: EditorDoc;
  selection?: unknown;
  revealRange: (range: unknown, type: unknown) => void;
};

type G = {
  __axisColorsRegistrations?: Array<{
    id: string;
    options?: { webviewOptions?: { retainContextWhenHidden?: boolean } };
  }>;
  __axisColorsRegisterThrow?: boolean;
  __axisColorsThemeKind?: number;
  __axisColorsEditor?: TestEditor | null;
  __axisColorsEditorThrow?: boolean;
  __axisColorsClipboard?: string[];
  __axisColorsClipboardThrow?: boolean;
  __axisColorsWarnings?: string[];
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

class Range {
  start: unknown;
  end: unknown;
  constructor(start: unknown, end: unknown) {
    this.start = start;
    this.end = end;
  }
}

class Selection extends Range {}

const TextEditorRevealType = { InCenter: 2 };
const ColorThemeKind = { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 };

let revealed: Array<{ range: { start: unknown; end: unknown }; type: unknown }> = [];
let activeEditorCb: (() => void) | undefined;
let docChangeCb: ((event: { document: unknown }) => void) | undefined;

const vscodeApi = {
  ColorThemeKind,
  Uri,
  Range,
  Selection,
  TextEditorRevealType,
  env: {
    clipboard: {
      async writeText(text: string) {
        if (g().__axisColorsClipboardThrow) throw new Error('clipboard');
        g().__axisColorsClipboard?.push(text);
      },
    },
  },
  window: {
    get activeColorTheme() {
      return { kind: g().__axisColorsThemeKind ?? ColorThemeKind.Dark };
    },
    get activeTextEditor() {
      if (g().__axisColorsEditorThrow) throw new Error('editor');
      return g().__axisColorsEditor ?? undefined;
    },
    showWarningMessage: (message: string) => {
      g().__axisColorsWarnings?.push(message);
      return undefined;
    },
    registerWebviewViewProvider: (
      id: string,
      _provider: unknown,
      options?: { webviewOptions?: { retainContextWhenHidden?: boolean } },
    ) => {
      if (g().__axisColorsRegisterThrow) throw new Error('register');
      g().__axisColorsRegistrations?.push({ id, options });
      return { dispose() {} };
    },
    onDidChangeActiveTextEditor: (cb: () => void) => {
      activeEditorCb = cb;
      return { dispose() {} };
    },
  },
  workspace: {
    onDidChangeTextDocument: (cb: (event: { document: unknown }) => void) => {
      docChangeCb = cb;
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
  get Range() {
    return vscodeApi.Range;
  },
  get Selection() {
    return vscodeApi.Selection;
  },
  get TextEditorRevealType() {
    return vscodeApi.TextEditorRevealType;
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

type PanelMod = typeof import('./colors-panel');

let panel: PanelMod;

beforeAll(async () => {
  // Quiet protocol-reject logging for the hostile-input cases below.
  setLogSink(() => {});
  panel = await import('./colors-panel');
});

/** Shape of one posted `studio.init` / `studio.set` envelope. */
type PostedEnvelope = {
  v: number;
  type: string;
  payload: { view: string; data: { colors: unknown[]; sourceLabel: string } };
};

function posted(bucket: unknown[]): PostedEnvelope[] {
  return bucket as PostedEnvelope[];
}

function makeAssets(): string {
  const root = mkdtempSync(join(tmpdir(), 'axis-colors-wv-'));
  const dir = join(root, 'dist', 'webview', 'colors');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'main.js'), '/* colors */');
  writeFileSync(join(dir, 'main.css'), '/* css */');
  return root;
}

function makeEditor(languageId: string, text: string): TestEditor {
  return {
    document: {
      languageId,
      lineCount: text.split('\n').length,
      fileName: '/tmp/scripts/rsi.pyne',
      uri: { fsPath: '/tmp/scripts/rsi.pyne' },
      getText: () => text,
      lineAt: (index: number) => ({ range: { start: index, end: index } }),
    },
    selection: undefined,
    revealRange(range: unknown, type: unknown) {
      revealed.push({ range: range as { start: unknown; end: unknown }, type });
    },
  };
}

function makeWebview(opts?: { postThrow?: boolean; asWebviewUriThrow?: unknown }) {
  const order: string[] = [];
  let html = '';
  let messageHandler: ((raw: unknown) => unknown) | undefined;
  const out: unknown[] = [];
  const webview = {
    cspSource: 'https://csp.test',
    options: {} as { enableScripts?: boolean; localResourceRoots?: Array<{ fsPath: string }> },
    asWebviewUri:
      opts?.asWebviewUriThrow !== undefined
        ? () => {
            throw opts.asWebviewUriThrow;
          }
        : (u: { fsPath: string }) => ({
            toString: () => `https://webview.test/${u.fsPath.split('/').pop()}`,
          }),
    postMessage: (msg: unknown) => {
      if (opts?.postThrow) throw new Error('post');
      out.push(msg);
      return true;
    },
    onDidReceiveMessage(cb: (raw: unknown) => unknown) {
      order.push('onDidReceiveMessage');
      messageHandler = cb;
      return { dispose() {} };
    },
    get html() {
      return html;
    },
    set html(value: string) {
      order.push('html');
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
  };
  return {
    webview,
    view,
    order,
    out,
    getHandler: () => messageHandler,
    dispose: () => disposeHandler?.(),
  };
}

function makeContext(root: string) {
  return { subscriptions: [] as Array<{ dispose(): void }>, extensionUri: Uri.file(root) };
}

beforeEach(() => {
  revealed = [];
  activeEditorCb = undefined;
  docChangeCb = undefined;
  g().__axisColorsRegistrations = [];
  g().__axisColorsRegisterThrow = false;
  g().__axisColorsThemeKind = ColorThemeKind.Dark;
  g().__axisColorsEditor = null;
  g().__axisColorsEditorThrow = false;
  g().__axisColorsClipboard = [];
  g().__axisColorsClipboardThrow = false;
  g().__axisColorsWarnings = [];
});

describe('ColorsPanelProvider', () => {
  test('view id and register wiring (retainContextWhenHidden false)', () => {
    expect(panel.COLORS_VIEW_ID).toBe('axis.colors');
    const context = makeContext('/tmp');
    const provider = panel.registerColorsPanel(context as never);
    expect(provider).toBeInstanceOf(panel.ColorsPanelProvider);
    expect(g().__axisColorsRegistrations).toHaveLength(1);
    expect(g().__axisColorsRegistrations?.[0]?.id).toBe('axis.colors');
    expect(
      g().__axisColorsRegistrations?.[0]?.options?.webviewOptions?.retainContextWhenHidden,
    ).toBe(false);
    expect(context.subscriptions).toHaveLength(3);
    expect(activeEditorCb).toBeTypeOf('function');
    expect(docChangeCb).toBeTypeOf('function');

    g().__axisColorsRegisterThrow = true;
    expect(() => panel.registerColorsPanel(makeContext('/tmp') as never)).not.toThrow();
    g().__axisColorsRegisterThrow = false;
  });

  test('resolve posts studio.init with the active Pine scan', () => {
    g().__axisColorsEditor = makeEditor('pinescript', 'color.red\n#fff');
    const provider = new panel.ColorsPanelProvider(makeContext(makeAssets()) as never);
    const w = makeWebview();
    provider.resolveWebviewView(w.view as never);
    expect(w.order[0]).toBe('onDidReceiveMessage');
    expect(w.order[1]).toBe('html');
    expect(w.webview.options.enableScripts).toBe(true);
    expect(w.webview.options.localResourceRoots?.[0]?.fsPath).toContain(
      join('dist', 'webview', 'colors'),
    );
    expect(w.webview.html).toContain('id="colors-root"');
    expect(w.webview.html).toContain("connect-src 'none'");
    expect(w.out).toHaveLength(1);
    const first = posted(w.out)[0];
    expect(first.v).toBe(1);
    expect(first.type).toBe('studio.init');
    expect(first.payload.view).toBe('colors');
    expect(first.payload.data).toEqual({
      colors: [
        { line: 1, column: 1, raw: 'color.red', swatch: '#FF0000' },
        { line: 2, column: 1, raw: '#fff', swatch: '#fff' },
      ],
      sourceLabel: 'rsi.pyne',
    });
    // the posted envelope is codec-valid (webview decode side)
    expect(decode(w.out[0]).ok).toBe(true);
  });

  test('resolve without a Pine editor posts an empty init', () => {
    const provider = new panel.ColorsPanelProvider(makeContext(makeAssets()) as never);
    const w = makeWebview();
    provider.resolveWebviewView(w.view as never);
    const first = posted(w.out)[0];
    expect(first.type).toBe('studio.init');
    expect(first.payload.data).toEqual({ colors: [], sourceLabel: 'No Pine editor' });

    g().__axisColorsEditor = makeEditor('python', 'x = "#fff"');
    const w2 = makeWebview();
    provider.resolveWebviewView(w2.view as never);
    expect(posted(w2.out)[0]?.payload.data).toEqual({
      colors: [],
      sourceLabel: 'No Pine editor',
    });
  });

  test('theme kinds map to html body classes', () => {
    const provider = new panel.ColorsPanelProvider(makeContext(makeAssets()) as never);
    for (const [kind, body] of [
      [ColorThemeKind.Light, 'vscode-light'],
      [ColorThemeKind.HighContrast, 'vscode-high-contrast'],
      [ColorThemeKind.HighContrastLight, 'vscode-high-contrast-light'],
      [ColorThemeKind.Dark, 'vscode-dark'],
      [99, 'vscode-dark'],
    ] as const) {
      g().__axisColorsThemeKind = kind;
      const w = makeWebview();
      provider.resolveWebviewView(w.view as never);
      expect(w.webview.html).toContain(`class="${body}"`);
    }
  });

  test('studio.ready handshake answers with studio.set', () => {
    g().__axisColorsEditor = makeEditor('pinescript', 'color.red');
    const provider = new panel.ColorsPanelProvider(makeContext(makeAssets()) as never);
    const w = makeWebview();
    provider.resolveWebviewView(w.view as never);
    expect(w.out).toHaveLength(1);
    const handler = w.getHandler();
    expect(handler).toBeTypeOf('function');

    handler?.(encode(VIEW_TO_HOST.StudioReady, { view: 'colors' }));
    expect(w.out).toHaveLength(2);
    const second = posted(w.out)[1];
    expect(second.type).toBe('studio.set');
    expect(second.payload.view).toBe('colors');
    expect(second.payload.data).toEqual({
      colors: [{ line: 1, column: 1, raw: 'color.red', swatch: '#FF0000' }],
      sourceLabel: 'rsi.pyne',
    });

    // capabilities are accepted without changing behavior
    handler?.(encode(VIEW_TO_HOST.StudioReady, { view: 'colors', capabilities: ['copy'] }));
    expect(w.out).toHaveLength(3);

    // another studio's ready never refreshes this panel
    handler?.(encode(VIEW_TO_HOST.StudioReady, { view: 'watchlist' }));
    expect(w.out).toHaveLength(3);
  });

  test('studio.action refresh rescans and posts studio.set', () => {
    g().__axisColorsEditor = makeEditor('pinescript', 'color.red');
    const provider = new panel.ColorsPanelProvider(makeContext(makeAssets()) as never);
    const w = makeWebview();
    provider.resolveWebviewView(w.view as never);
    const handler = w.getHandler();

    g().__axisColorsEditor = makeEditor('pinescript', '#abc');
    handler?.(encode(VIEW_TO_HOST.StudioAction, { view: 'colors', action: 'refresh' }));
    expect(w.out).toHaveLength(2);
    const last = posted(w.out)[1];
    expect(last.type).toBe('studio.set');
    expect(last.payload.data).toEqual({
      colors: [{ line: 1, column: 1, raw: '#abc', swatch: '#abc' }],
      sourceLabel: 'rsi.pyne',
    });

    // wrong view is ignored
    handler?.(encode(VIEW_TO_HOST.StudioAction, { view: 'symbols', action: 'refresh' }));
    // unknown action is ignored
    handler?.(encode(VIEW_TO_HOST.StudioAction, { view: 'colors', action: 'nope' }));
    expect(w.out).toHaveLength(2);
  });

  test('studio.action reveal routes args.line into the active Pine editor', () => {
    g().__axisColorsEditor = makeEditor('pinescript', 'color.red\n#fff\nplot(close)');
    const provider = new panel.ColorsPanelProvider(makeContext(makeAssets()) as never);
    const w = makeWebview();
    provider.resolveWebviewView(w.view as never);
    const handler = w.getHandler();

    handler?.(
      encode(VIEW_TO_HOST.StudioAction, { view: 'colors', action: 'reveal', args: { line: 2 } }),
    );
    expect(revealed).toHaveLength(1);
    expect(revealed[0]?.range.start).toBe(1);
    expect(revealed[0]?.type).toBe(TextEditorRevealType.InCenter);
    expect(g().__axisColorsEditor?.selection).toBeInstanceOf(Selection);

    // clamping: line 99 with 3 lines → last index
    handler?.(
      encode(VIEW_TO_HOST.StudioAction, { view: 'colors', action: 'reveal', args: { line: 99 } }),
    );
    expect(revealed[1]?.range.start).toBe(2);

    // invalid lines and missing args never reveal
    handler?.(
      encode(VIEW_TO_HOST.StudioAction, { view: 'colors', action: 'reveal', args: { line: 0 } }),
    );
    handler?.(
      encode(VIEW_TO_HOST.StudioAction, { view: 'colors', action: 'reveal', args: { line: 1.5 } }),
    );
    handler?.(encode(VIEW_TO_HOST.StudioAction, { view: 'colors', action: 'reveal' }));
    expect(revealed).toHaveLength(2);

    // non-Pine editor → no reveal
    g().__axisColorsEditor = makeEditor('python', 'color.red');
    handler?.(
      encode(VIEW_TO_HOST.StudioAction, { view: 'colors', action: 'reveal', args: { line: 1 } }),
    );
    expect(revealed).toHaveLength(2);

    // no editor → no reveal, no throw
    g().__axisColorsEditor = null;
    expect(() =>
      handler?.(
        encode(VIEW_TO_HOST.StudioAction, { view: 'colors', action: 'reveal', args: { line: 1 } }),
      ),
    ).not.toThrow();
    expect(revealed).toHaveLength(2);
  });

  test('studio.action copy routes args.text to the host clipboard', async () => {
    const provider = new panel.ColorsPanelProvider(makeContext(makeAssets()) as never);
    const w = makeWebview();
    provider.resolveWebviewView(w.view as never);
    const handler = w.getHandler();

    handler?.(
      encode(VIEW_TO_HOST.StudioAction, { view: 'colors', action: 'copy', args: { text: '#fff' } }),
    );
    await Promise.resolve();
    expect(g().__axisColorsClipboard).toEqual(['#fff']);

    // invalid text never reaches the clipboard
    handler?.(
      encode(VIEW_TO_HOST.StudioAction, { view: 'colors', action: 'copy', args: { text: '' } }),
    );
    handler?.(
      encode(VIEW_TO_HOST.StudioAction, {
        view: 'colors',
        action: 'copy',
        args: { text: 'x'.repeat(257) },
      }),
    );
    handler?.(encode(VIEW_TO_HOST.StudioAction, { view: 'colors', action: 'copy' }));
    await Promise.resolve();
    expect(g().__axisColorsClipboard).toEqual(['#fff']);

    // clipboard failure surfaces a warning, never a throw
    g().__axisColorsClipboardThrow = true;
    expect(() =>
      handler?.(
        encode(VIEW_TO_HOST.StudioAction, {
          view: 'colors',
          action: 'copy',
          args: { text: '#abc' },
        }),
      ),
    ).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(g().__axisColorsWarnings).toEqual(['AXIS: Could not copy the color.']);
    g().__axisColorsClipboardThrow = false;
  });

  test('decode failures never crash the handler and post nothing', () => {
    g().__axisColorsEditor = makeEditor('pinescript', 'color.red');
    const provider = new panel.ColorsPanelProvider(makeContext(makeAssets()) as never);
    const w = makeWebview();
    provider.resolveWebviewView(w.view as never);
    const handler = w.getHandler();
    expect(w.out).toHaveLength(1);

    // old flat wire (unknown types now)
    handler?.({ type: 'colors.ready' });
    handler?.({ type: 'colors.reveal', line: 1 });
    handler?.({ type: 'colors.refresh' });
    // bad envelope / version / ts / payload
    handler?.(null);
    handler?.([]);
    handler?.('x');
    handler?.(undefined);
    handler?.({ v: 99, type: 'studio.ready', payload: { view: 'colors' }, ts: 1 });
    handler?.({ v: 1, type: 'studio.ready', payload: { view: 'colors' } });
    handler?.({
      v: 1,
      type: 'studio.action',
      payload: { view: 'colors', action: 'reveal', args: [] },
      ts: 1,
    });
    // hostile getters
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('boom');
        },
      },
    );
    expect(() => handler?.(hostile)).not.toThrow();
    // echoed host→view envelope is rejected too
    handler?.(encode(HOST_TO_VIEW.StudioSet, { view: 'colors', data: null }));
    // unrelated view→host types are ignored
    handler?.(encode(VIEW_TO_HOST.ResultsFocus, { runId: 'r1' }));
    handler?.(encode(VIEW_TO_HOST.WebviewReady, { view: 'chart', capabilities: [] }));

    expect(w.out).toHaveLength(1);
    expect(revealed).toHaveLength(0);
    expect(g().__axisColorsClipboard).toEqual([]);
  });

  test('editor and document change events rescan through studio.set', () => {
    g().__axisColorsEditor = makeEditor('pinescript', 'color.red');
    const provider = panel.registerColorsPanel(makeContext(makeAssets()) as never);
    const w = makeWebview();
    provider.resolveWebviewView(w.view as never);
    expect(w.out).toHaveLength(1);

    activeEditorCb?.();
    expect(w.out).toHaveLength(2);
    expect(posted(w.out)[1]?.type).toBe('studio.set');

    docChangeCb?.({ document: g().__axisColorsEditor?.document });
    expect(w.out).toHaveLength(3);

    docChangeCb?.({ document: makeEditor('pinescript', 'x').document });
    expect(w.out).toHaveLength(3);

    // non-Pine active editor still posts the empty set
    g().__axisColorsEditor = makeEditor('python', 'color.red');
    activeEditorCb?.();
    expect(posted(w.out).at(-1)?.payload.data).toEqual({
      colors: [],
      sourceLabel: 'No Pine editor',
    });

    // hostile editor host never throws out of the event callback
    g().__axisColorsEditorThrow = true;
    expect(() => activeEditorCb?.()).not.toThrow();
    expect(() => docChangeCb?.({ document: {} })).not.toThrow();
    g().__axisColorsEditorThrow = false;
  });

  test('dispose clears the view; later messages and refreshes are no-ops', () => {
    g().__axisColorsEditor = makeEditor('pinescript', 'color.red');
    const provider = new panel.ColorsPanelProvider(makeContext(makeAssets()) as never);
    const w = makeWebview();
    provider.resolveWebviewView(w.view as never);
    const handler = w.getHandler();
    w.dispose();
    const before = w.out.length;

    handler?.(encode(VIEW_TO_HOST.StudioReady, { view: 'colors' }));
    provider.refresh();
    provider.refreshIfDocument({} as never);
    expect(w.out.length).toBe(before);
  });

  test('missing assets and html failures never throw', () => {
    const provider = new panel.ColorsPanelProvider(
      makeContext('/no-such-axis-colors-assets') as never,
    );
    const w = makeWebview();
    expect(() => provider.resolveWebviewView(w.view as never)).not.toThrow();
    expect(w.webview.html).toContain('assets missing');
    expect(w.out).toHaveLength(1);

    const ok = new panel.ColorsPanelProvider(makeContext(makeAssets()) as never);
    expect(() => ok.resolveWebviewView(null as never)).not.toThrow();

    const boom = makeWebview({ asWebviewUriThrow: 'nope <&>' });
    const okProv = new panel.ColorsPanelProvider(makeContext(makeAssets()) as never);
    expect(() => okProv.resolveWebviewView(boom.view as never)).not.toThrow();
    expect(boom.webview.html).toContain('nope');
    expect(boom.webview.html).not.toContain('<&>');
  });

  test('throwing postMessage never escapes resolve or the message handler', () => {
    const provider = new panel.ColorsPanelProvider(makeContext(makeAssets()) as never);
    const w = makeWebview({ postThrow: true });
    expect(() => provider.resolveWebviewView(w.view as never)).not.toThrow();
    const handler = w.getHandler();
    expect(() => handler?.(encode(VIEW_TO_HOST.StudioReady, { view: 'colors' }))).not.toThrow();
    expect(() => provider.refresh()).not.toThrow();
  });
});
