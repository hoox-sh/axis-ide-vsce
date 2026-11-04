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
  __axisLogsRegistrations?: Registration[];
  __axisLogsRegisterThrow?: boolean;
  __axisLogsThemeKind?: number;
  __axisLogsEditor?: TestEditor | null;
  __axisLogsClipboard?: string[];
  __axisLogsClipboardThrow?: boolean;
  __axisLogsInfos?: string[];
  __axisLogsWarnings?: string[];
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

class Position {
  line: number;
  character: number;
  constructor(line: number, character: number) {
    this.line = line;
    this.character = character;
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

const vscodeApi = {
  ColorThemeKind,
  Uri,
  Position,
  Range,
  Selection,
  TextEditorRevealType,
  env: {
    clipboard: {
      async writeText(text: string) {
        if (g().__axisLogsClipboardThrow) throw new Error('clipboard');
        g().__axisLogsClipboard?.push(text);
      },
    },
  },
  window: {
    get activeColorTheme() {
      return { kind: g().__axisLogsThemeKind ?? ColorThemeKind.Dark };
    },
    get activeTextEditor() {
      return g().__axisLogsEditor ?? undefined;
    },
    showInformationMessage: (message: string) => {
      g().__axisLogsInfos?.push(message);
      return undefined;
    },
    showWarningMessage: (message: string) => {
      g().__axisLogsWarnings?.push(message);
      return undefined;
    },
    registerWebviewViewProvider: (
      id: string,
      provider: unknown,
      options?: { webviewOptions?: { retainContextWhenHidden?: boolean } },
    ) => {
      if (g().__axisLogsRegisterThrow) throw new Error('register');
      g().__axisLogsRegistrations?.push({ id, provider, options });
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
  get Position() {
    return vscodeApi.Position;
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
}));

type PanelMod = typeof import('./logs-panel');

let panel: PanelMod;

beforeAll(async () => {
  setLogSink(() => {});
  panel = await import('./logs-panel');
});

type PostedEnvelope = {
  v: number;
  type: string;
  payload: { view: string; data?: { rows?: unknown[]; runId?: unknown; status?: unknown } };
};

function posted(bucket: unknown[]): PostedEnvelope[] {
  return bucket as PostedEnvelope[];
}

function makeAssets(): string {
  const root = mkdtempSync(join(tmpdir(), 'axis-logs-wv-'));
  const dir = join(root, 'dist', 'webview', 'logs');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'main.js'), '/* logs */');
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

/** ResultsFocusStore stand-in: getLastRun + subscribe, like attachProfiler sees. */
function makeStore(initial: unknown) {
  let current = initial;
  const listeners = new Set<(snap: unknown) => void>();
  return {
    getLastRun: () => current,
    subscribe(listener: (snap: unknown) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit(lastRun: unknown) {
      for (const listener of listeners) listener({ lastRun });
    },
    set(next: unknown) {
      current = next;
    },
  };
}

function makeContext(root: string) {
  return {
    subscriptions: [] as Array<{ dispose(): void }>,
    extensionUri: Uri.file(root),
  };
}

function makeEditor(languageId: string): TestEditor {
  const text = 'plot(close)';
  return {
    document: {
      languageId,
      lineCount: 3,
      fileName: '/tmp/rsi.pyne',
      uri: { fsPath: '/tmp/rsi.pyne' },
      getText: () => text,
      lineAt: (index: number) => ({ range: { start: index, end: index } }),
    },
    selection: undefined,
    revealRange(range: unknown, type: unknown) {
      revealed.push({ range: range as { start: unknown; end: unknown }, type });
    },
  };
}

beforeEach(() => {
  revealed = [];
  g().__axisLogsRegistrations = [];
  g().__axisLogsRegisterThrow = false;
  g().__axisLogsThemeKind = ColorThemeKind.Dark;
  g().__axisLogsEditor = null;
  g().__axisLogsClipboard = [];
  g().__axisLogsClipboardThrow = false;
  g().__axisLogsInfos = [];
  g().__axisLogsWarnings = [];
});

afterEach(() => {
  resetLoggerForTests();
});

describe('registerLogsPanel wiring', () => {
  test('registers axis.logs with retainContextWhenHidden false', () => {
    const context = makeContext(makeAssets());
    const provider = panel.registerLogsPanel(context as never, makeStore(null));
    expect(provider).toBeInstanceOf(panel.LogsWebviewViewProvider);
    expect(g().__axisLogsRegistrations).toHaveLength(1);
    expect(g().__axisLogsRegistrations?.[0]?.id).toBe('axis.logs');
    expect(
      g().__axisLogsRegistrations?.[0]?.options?.webviewOptions?.retainContextWhenHidden,
    ).toBe(false);
    // registration disposable + the dispose wrapper
    expect(context.subscriptions).toHaveLength(2);

    provider?.dispose();
    g().__axisLogsRegisterThrow = true;
    expect(
      panel.registerLogsPanel(makeContext('/tmp') as never, makeStore(null)),
    ).toBeDefined();
    g().__axisLogsRegisterThrow = false;
  });

  test('shell body and theme class come from the generic provider', () => {
    const context = makeContext(makeAssets());
    panel.registerLogsPanel(context as never, makeStore(null));
    const inner = g().__axisLogsRegistrations?.at(-1)?.provider as {
      resolveWebviewView(view: unknown): void;
    };
    const w = makeWebview();
    inner.resolveWebviewView(w.view);
    expect(w.webview.options.enableScripts).toBe(true);
    expect(w.webview.html).toContain('id="logs-root"');
    expect(w.webview.html).toContain('data-axis-logs-host="1"');
    expect(w.webview.html).toContain('id="logs-list"');
    expect(w.webview.html).toContain('No log lines for the last run');
    expect(w.webview.html).toContain("connect-src 'none'");
    expect(w.webview.html).toContain('class="vscode-dark"');
    expect(w.webview.html).not.toContain('nonce=');

    g().__axisLogsThemeKind = ColorThemeKind.Light;
    const w2 = makeWebview();
    inner.resolveWebviewView(w2.view);
    expect(w2.webview.html).toContain('class="vscode-light"');
  });
});

describe('logs studio message flow', () => {
  test('studio.ready handshake answers with studio.init carrying the record', () => {
    const store = makeStore({ id: 'run-1', status: 'ok', logs: ['hello', 'line 2'] });
    panel.registerLogsPanel(makeContext(makeAssets()) as never, store);
    const inner = g().__axisLogsRegistrations?.at(-1)?.provider as {
      resolveWebviewView(view: unknown): void;
    };
    const w = makeWebview();
    inner.resolveWebviewView(w.view);
    expect(w.out).toHaveLength(0);

    const handler = w.getHandler();
    handler?.(encode(VIEW_TO_HOST.StudioReady, { view: 'logs' }));
    expect(w.out).toHaveLength(1);
    const init = posted(w.out)[0];
    expect(init.v).toBe(1);
    expect(init.type).toBe(HOST_TO_VIEW.StudioInit);
    expect(init.payload.view).toBe('logs');
    expect(init.payload.data).toEqual({
      rows: [
        { level: 'info', message: 'hello', line: null, time: null },
        { level: 'info', message: 'line 2', line: 2, time: null },
      ],
      runId: 'run-1',
      status: 'ok',
    });
    expect(decode(w.out[0]).ok).toBe(true);

    // another studio's ready never reaches this panel
    handler?.(encode(VIEW_TO_HOST.StudioReady, { view: 'watchlist' }));
    expect(w.out).toHaveLength(1);
  });

  test('results-store changes re-post as studio.set', () => {
    const store = makeStore({ id: 'run-1', logs: ['one'] });
    panel.registerLogsPanel(makeContext(makeAssets()) as never, store);
    const inner = g().__axisLogsRegistrations?.at(-1)?.provider as {
      resolveWebviewView(view: unknown): void;
    };
    const w = makeWebview();
    inner.resolveWebviewView(w.view);

    store.emit({ id: 'run-2', status: 'error', logs: ['two'] });
    expect(w.out).toHaveLength(1);
    const set = posted(w.out)[0];
    expect(set.type).toBe(HOST_TO_VIEW.StudioSet);
    expect(set.payload.view).toBe('logs');
    expect(set.payload.data).toMatchObject({ runId: 'run-2', status: 'error' });
    expect(set.payload.data?.rows).toHaveLength(1);
  });

  test('dispose stops the results subscription', () => {
    const store = makeStore({ id: 'run-1', logs: ['one'] });
    const provider = panel.registerLogsPanel(makeContext(makeAssets()) as never, store);
    const inner = g().__axisLogsRegistrations?.at(-1)?.provider as {
      resolveWebviewView(view: unknown): void;
    };
    const w = makeWebview();
    inner.resolveWebviewView(w.view);
    provider?.dispose();

    store.emit({ id: 'run-2', logs: ['two'] });
    expect(w.out).toHaveLength(0);
  });
});

describe('logs studio actions', () => {
  test('studio.action reveal routes args.line into the active Pine editor', () => {
    g().__axisLogsEditor = makeEditor('pinescript');
    panel.registerLogsPanel(makeContext(makeAssets()) as never, makeStore(null));
    const inner = g().__axisLogsRegistrations?.at(-1)?.provider as {
      resolveWebviewView(view: unknown): void;
    };
    const w = makeWebview();
    inner.resolveWebviewView(w.view);
    const handler = w.getHandler();

    handler?.(
      encode(VIEW_TO_HOST.StudioAction, { view: 'logs', action: 'reveal', args: { line: 2 } }),
    );
    expect(revealed).toHaveLength(1);
    expect(revealed[0]?.range.start).toBeInstanceOf(Position);
    expect(revealed[0]?.type).toBe(TextEditorRevealType.InCenter);
    expect(g().__axisLogsEditor?.selection).toBeInstanceOf(Selection);

    // clamping: line 99 with 3 lines → last index
    handler?.(
      encode(VIEW_TO_HOST.StudioAction, { view: 'logs', action: 'reveal', args: { line: 99 } }),
    );
    expect(revealed[1]?.range.start).toEqual(new Position(2, 0));

    // invalid lines, missing args, and non-Pine editors never reveal
    handler?.(
      encode(VIEW_TO_HOST.StudioAction, { view: 'logs', action: 'reveal', args: { line: 0 } }),
    );
    handler?.(encode(VIEW_TO_HOST.StudioAction, { view: 'logs', action: 'reveal' }));
    expect(revealed).toHaveLength(2);

    g().__axisLogsEditor = makeEditor('python');
    handler?.(
      encode(VIEW_TO_HOST.StudioAction, { view: 'logs', action: 'reveal', args: { line: 1 } }),
    );
    expect(revealed).toHaveLength(2);
    expect(g().__axisLogsInfos).toEqual([
      'No active Pine script editor to reveal that line.',
    ]);
  });

  test('studio.action copy routes args.text to the host clipboard', async () => {
    panel.registerLogsPanel(makeContext(makeAssets()) as never, makeStore(null));
    const inner = g().__axisLogsRegistrations?.at(-1)?.provider as {
      resolveWebviewView(view: unknown): void;
    };
    const w = makeWebview();
    inner.resolveWebviewView(w.view);
    const handler = w.getHandler();

    handler?.(
      encode(VIEW_TO_HOST.StudioAction, { view: 'logs', action: 'copy', args: { text: 'row' } }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(g().__axisLogsClipboard).toEqual(['row']);

    // invalid text never reaches the clipboard
    handler?.(
      encode(VIEW_TO_HOST.StudioAction, { view: 'logs', action: 'copy', args: { text: '' } }),
    );
    handler?.(encode(VIEW_TO_HOST.StudioAction, { view: 'logs', action: 'copy' }));
    handler?.(encode(VIEW_TO_HOST.StudioAction, { view: 'logs', action: 'nope' }));
    handler?.(encode(VIEW_TO_HOST.StudioAction, { view: 'colors', action: 'copy' }));
    // old flat wire is now undecodable
    handler?.({ type: 'logs.copy', text: 'x' });
    handler?.(null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(g().__axisLogsClipboard).toEqual(['row']);

    // clipboard failure surfaces the warning, never a throw
    g().__axisLogsClipboardThrow = true;
    expect(() =>
      handler?.(
        encode(VIEW_TO_HOST.StudioAction, { view: 'logs', action: 'copy', args: { text: 'y' } }),
      ),
    ).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(g().__axisLogsWarnings).toEqual(['AXIS: Could not copy the log text.']);
  });
});
