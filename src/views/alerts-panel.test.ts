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

type RegisteredProvider = {
  resolveWebviewView(view: unknown): void;
};

type G = {
  __axisAlertsRegistrations?: Array<{
    id: string;
    options?: { webviewOptions?: { retainContextWhenHidden?: boolean } };
    provider?: RegisteredProvider;
  }>;
  __axisAlertsRegisterThrow?: boolean;
  __axisAlertsThemeKind?: number;
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

let commandCbs: Map<string, () => unknown> = new Map();
let inputBoxValues: string[] = [];
let infoMessages: string[] = [];

const vscodeApi = {
  ColorThemeKind,
  Uri,
  commands: {
    registerCommand: (id: string, cb: () => unknown) => {
      commandCbs.set(id, cb);
      return { dispose() {} };
    },
  },
  window: {
    get activeColorTheme() {
      return { kind: g().__axisAlertsThemeKind ?? ColorThemeKind.Dark };
    },
    registerWebviewViewProvider: (
      id: string,
      provider: unknown,
      options?: { webviewOptions?: { retainContextWhenHidden?: boolean } },
    ) => {
      if (g().__axisAlertsRegisterThrow) throw new Error('register');
      g().__axisAlertsRegistrations?.push({ id, options, provider: provider as RegisteredProvider });
      return { dispose() {} };
    },
    showInputBox: () => Promise.resolve(inputBoxValues.shift()),
    showQuickPick: () => Promise.resolve(undefined),
    showInformationMessage: (message: string) => {
      infoMessages.push(message);
      return undefined;
    },
    showWarningMessage: () => undefined,
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
}));

type PanelMod = typeof import('./alerts-panel');
type AlertsMod = typeof import('./alerts');

let panel: PanelMod;
let alerts: AlertsMod;

beforeAll(async () => {
  // Quiet router logging for the hostile-input cases below.
  setLogSink(() => {});
  alerts = await import('./alerts');
  panel = await import('./alerts-panel');
});

type PostedEnvelope = {
  v: number;
  type: string;
  payload: { view: string; data?: unknown; level?: string; message?: string };
};

function posted(bucket: unknown[]): PostedEnvelope[] {
  return bucket as PostedEnvelope[];
}

/** Drain the async add/toggle/remove chains (workspaceState writes). */
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function makeAssets(): string {
  const root = mkdtempSync(join(tmpdir(), 'axis-alerts-wv-'));
  const dir = join(root, 'dist', 'webview', 'alerts');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'main.js'), '/* alerts */');
  writeFileSync(join(dir, 'main.css'), '/* css */');
  return root;
}

function makeWebview() {
  let html = '';
  let messageHandler: ((raw: unknown) => unknown) | undefined;
  const out: unknown[] = [];
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
  };
  return {
    webview,
    view,
    out,
    getHandler: () => messageHandler,
    dispose: () => disposeHandler?.(),
  };
}

/** Context whose workspaceState is the real memory memento from alerts.ts. */
function makeContext(root: string) {
  const memory = alerts.createMemoryWorkspaceState();
  return {
    subscriptions: [] as Array<{ dispose(): void }>,
    extensionUri: Uri.file(root),
    workspaceState: memory,
    memory,
  };
}

/** registerAlertsStudio + resolve the registered provider against a webview. */
function makeStudio(root: string) {
  const context = makeContext(root);
  const colors = panel.registerAlertsStudio(context as never);
  const provider = g().__axisAlertsRegistrations?.at(-1)?.provider;
  const w = makeWebview();
  provider?.resolveWebviewView(w.view);
  const handler = w.getHandler();
  handler?.(encode(VIEW_TO_HOST.StudioReady, { view: 'alerts' }));
  return { context, provider, colors, w, handler };
}

beforeEach(() => {
  commandCbs = new Map();
  inputBoxValues = [];
  infoMessages = [];
  g().__axisAlertsRegistrations = [];
  g().__axisAlertsRegisterThrow = false;
  g().__axisAlertsThemeKind = ColorThemeKind.Dark;
});

describe('registerAlertsStudio', () => {
  test('wires the add/remove commands and the retained view registration', () => {
    expect(panel.ALERTS_STUDIO_VIEW_ID).toBe('axis.alerts');
    const context = makeContext('/tmp');
    const provider = panel.registerAlertsStudio(context as never);
    expect(provider).toBeInstanceOf(panel.AlertsStudioWebviewViewProvider);
    expect(g().__axisAlertsRegistrations).toHaveLength(1);
    expect(g().__axisAlertsRegistrations?.[0]?.id).toBe('axis.alerts');
    expect(
      g().__axisAlertsRegistrations?.[0]?.options?.webviewOptions?.retainContextWhenHidden,
    ).toBe(true);
    // 2 commands (registerAlertsView) + 1 view registration (registerStudioView).
    expect(context.subscriptions).toHaveLength(3);
    expect(commandCbs.has('axis.alerts.add')).toBe(true);
    expect(commandCbs.has('axis.alerts.remove')).toBe(true);
  });

  test('a failed view registration never throws and postSnapshot no-ops', () => {
    g().__axisAlertsRegisterThrow = true;
    const context = makeContext('/tmp');
    const provider = panel.registerAlertsStudio(context as never);
    expect(() => provider.postSnapshot()).not.toThrow();
    expect(context.subscriptions).toHaveLength(2);
    g().__axisAlertsRegisterThrow = false;
  });
});

describe('AlertsStudioWebviewViewProvider resolve + handshake', () => {
  test('resolve builds the nonce-free shell; ready answers with the snapshot', () => {
    const context = makeContext(makeAssets());
    const memory = context.memory;
    memory.update('axis.alerts.v1', [
      { id: 'a1', title: 'BTC above 100k', condition: 'close > 100000', enabled: true },
    ]);
    new panel.AlertsStudioWebviewViewProvider(context as never, memory);
    const registered = g().__axisAlertsRegistrations?.at(-1);
    const w = makeWebview();
    registered?.provider?.resolveWebviewView(w.view);

    expect(w.webview.options.enableScripts).toBe(true);
    expect(w.webview.options.localResourceRoots?.[0]?.fsPath).toContain(
      join('dist', 'webview', 'alerts'),
    );
    const html = w.webview.html;
    expect(html).toContain('id="alerts-root"');
    expect(html).toContain('data-axis-alerts-host="1"');
    expect(html).toContain("script-src https://csp.test");
    expect(html).not.toContain('nonce=');
    expect(html).toContain("connect-src 'none'");
    expect(w.out).toHaveLength(0);

    w.getHandler()?.(encode(VIEW_TO_HOST.StudioReady, { view: 'alerts' }));
    expect(w.out).toHaveLength(1);
    const first = posted(w.out)[0];
    expect(first.type).toBe(HOST_TO_VIEW.StudioInit);
    expect(first.payload.view).toBe('alerts');
    expect(first.payload.data).toEqual({
      total: 1,
      enabled: 1,
      summary: '1 alerts, 1 enabled',
      entries: [{ id: 'a1', title: 'BTC above 100k', condition: 'close > 100000', enabled: true }],
    });
    expect(decode(w.out[0]).ok).toBe(true);
  });

  test('an empty store answers the handshake with the empty snapshot', () => {
    const { w } = makeStudio(makeAssets());
    const first = posted(w.out)[0];
    expect(first.payload.data).toEqual({
      total: 0,
      enabled: 0,
      summary: '0 alerts, 0 enabled',
      entries: [],
    });
  });
});

describe('AlertsStudioWebviewViewProvider actions', () => {
  test('add persists a titled alert and pushes a fresh snapshot', async () => {
    const { context, w, handler } = makeStudio(makeAssets());
    handler?.(
      encode(VIEW_TO_HOST.StudioAction, { view: 'alerts', action: 'add', args: { title: ' T ' } }),
    );
    await flush();
    const stored = alerts.readAlertsV1(context.memory);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.title).toBe('T');
    expect(posted(w.out).at(-1)?.type).toBe(HOST_TO_VIEW.StudioSet);
    expect(
      (posted(w.out).at(-1)?.payload.data as { total: number } | undefined)?.total,
    ).toBe(1);

    handler?.(
      encode(VIEW_TO_HOST.StudioAction, {
        view: 'alerts',
        action: 'add',
        args: { title: 'Y', condition: ' close > 1 ' },
      }),
    );
    await flush();
    const stored2 = alerts.readAlertsV1(context.memory);
    expect(stored2).toHaveLength(2);
    expect(stored2[1]?.condition).toBe('close > 1');
  });

  test('add with an empty title flashes the Title required notice without writing', async () => {
    const { context, w, handler } = makeStudio(makeAssets());
    handler?.(encode(VIEW_TO_HOST.StudioAction, { view: 'alerts', action: 'add', args: {} }));
    await flush();
    expect(alerts.readAlertsV1(context.memory)).toHaveLength(0);
    const notice = posted(w.out).at(-1);
    expect(notice?.type).toBe(HOST_TO_VIEW.StudioNotice);
    expect(notice?.payload).toEqual({
      view: 'alerts',
      level: 'error',
      message: 'Title required',
    });

    // an add action without args is dropped silently (old null-parse path)
    handler?.(encode(VIEW_TO_HOST.StudioAction, { view: 'alerts', action: 'add' }));
    await flush();
    expect(posted(w.out).length).toBe(2);
  });

  test('toggle flips the stored row and pushes a fresh snapshot', async () => {
    const context = makeContext('/tmp');
    context.memory.update('axis.alerts.v1', [{ id: 'a1', title: 'A', enabled: true }]);
    new panel.AlertsStudioWebviewViewProvider(context as never, context.memory);
    const registered = g().__axisAlertsRegistrations?.at(-1);
    const w = makeWebview();
    registered?.provider?.resolveWebviewView(w.view);
    const handler = w.getHandler();
    handler?.(encode(VIEW_TO_HOST.StudioReady, { view: 'alerts' }));

    handler?.(
      encode(VIEW_TO_HOST.StudioAction, { view: 'alerts', action: 'toggle', args: { id: 'a1' } }),
    );
    await flush();
    expect(alerts.readAlertsV1(context.memory)[0]?.enabled).toBe(false);
    expect(posted(w.out).at(-1)?.type).toBe(HOST_TO_VIEW.StudioSet);

    // blank ids are dropped; unknown ids still re-sync without changing rows
    handler?.(encode(VIEW_TO_HOST.StudioAction, { view: 'alerts', action: 'toggle', args: { id: ' ' } }));
    await flush();
    handler?.(
      encode(VIEW_TO_HOST.StudioAction, { view: 'alerts', action: 'toggle', args: { id: 'nope' } }),
    );
    await flush();
    expect(alerts.readAlertsV1(context.memory)[0]?.enabled).toBe(false);
    expect(
      (
        posted(w.out).at(-1)?.payload.data as
          | { entries: Array<{ enabled: boolean }> }
          | undefined
      )?.entries[0]?.enabled,
    ).toBe(false);
  });

  test('remove deletes the row and flashes Removed; unknown ids only re-sync', async () => {
    const context = makeContext('/tmp');
    context.memory.update('axis.alerts.v1', [{ id: 'a1', title: 'A', enabled: true }]);
    new panel.AlertsStudioWebviewViewProvider(context as never, context.memory);
    const registered = g().__axisAlertsRegistrations?.at(-1);
    const w = makeWebview();
    registered?.provider?.resolveWebviewView(w.view);
    const handler = w.getHandler();
    handler?.(encode(VIEW_TO_HOST.StudioReady, { view: 'alerts' }));

    handler?.(
      encode(VIEW_TO_HOST.StudioAction, { view: 'alerts', action: 'remove', args: { id: 'nope' } }),
    );
    await flush();
    expect(alerts.readAlertsV1(context.memory)).toHaveLength(1);
    expect(posted(w.out).at(-1)?.type).toBe(HOST_TO_VIEW.StudioSet);
    expect(
      posted(w.out).filter((m) => (m as { type: string }).type === HOST_TO_VIEW.StudioNotice),
    ).toHaveLength(0);

    handler?.(
      encode(VIEW_TO_HOST.StudioAction, { view: 'alerts', action: 'remove', args: { id: 'a1' } }),
    );
    await flush();
    expect(alerts.readAlertsV1(context.memory)).toHaveLength(0);
    const notice = posted(w.out).at(-1);
    expect(notice?.type).toBe(HOST_TO_VIEW.StudioNotice);
    expect(notice?.payload).toEqual({ view: 'alerts', level: 'info', message: 'Removed' });
  });

  test('junk messages never crash the handler and post nothing new', () => {
    const { w, handler } = makeStudio(makeAssets());
    const before = w.out.length;
    handler?.(null);
    handler?.([]);
    handler?.('x');
    handler?.({ type: 'alerts.add', title: 'X' });
    handler?.({ type: 'alerts.ready' });
    // wrong view and unknown actions never reach the handlers
    handler?.(encode(VIEW_TO_HOST.StudioAction, { view: 'colors', action: 'add' }));
    handler?.(encode(VIEW_TO_HOST.StudioAction, { view: 'alerts', action: 'nope' }));
    expect(w.out.length).toBe(before);
  });

  test('dispose clears the view; later messages and postSnapshot are no-ops', () => {
    const { w, handler, colors } = makeStudio(makeAssets());
    w.dispose();
    const before = w.out.length;
    handler?.(encode(VIEW_TO_HOST.StudioReady, { view: 'alerts' }));
    colors.postSnapshot();
    expect(w.out.length).toBe(before);
  });
});

describe('tree.refresh monkey-patch', () => {
  test('the add command flows through the patched refresh and posts studio.set', async () => {
    const context = makeContext('/tmp');
    panel.registerAlertsStudio(context as never);
    const registered = g().__axisAlertsRegistrations?.at(-1);
    const w = makeWebview();
    registered?.provider?.resolveWebviewView(w.view);
    w.getHandler()?.(encode(VIEW_TO_HOST.StudioReady, { view: 'alerts' }));
    const before = w.out.length;

    // runAddAlertCommand: title InputBox → condition InputBox → add + refresh.
    inputBoxValues = ['From command', ''];
    await Promise.resolve(commandCbs.get('axis.alerts.add')?.());
    expect(alerts.readAlertsV1(context.memory)).toHaveLength(1);
    expect(alerts.readAlertsV1(context.memory)[0]?.title).toBe('From command');
    expect(w.out.length).toBe(before + 1);
    expect(posted(w.out).at(-1)?.type).toBe(HOST_TO_VIEW.StudioSet);
    expect(infoMessages.some((m) => m.includes('added'))).toBe(true);
  });
});
