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
import { HOST_TO_VIEW } from '../protocol/types';
import { ProfilerStore } from '../run/profiler-store';
import { ResultsFocusStore } from '../run/results-store';
import type { StudioContextLike, StudioProviderDeps, StudioViewHost } from './studio-provider';
import type { StudioWebviewLike, StudioWebviewViewLike } from './studio-provider';
import {
  RUN_OUTPUT_STUDIO_ID,
  buildRunOutputStudioBody,
  createRunOutputRegistration,
  registerRunOutput,
  type RunOutputHostSurfaces,
} from './run-output-studio';

function makeDeps(): StudioProviderDeps {
  return {
    extensionUri: { fsPath: '/ext' },
    joinPath: (base, ...parts) => ({
      fsPath: `${(base as { fsPath: string }).fsPath}/${parts.join('/')}`,
    }),
    fsPath: (uri) => (uri as { fsPath: string }).fsPath,
    assetExists: (path) => path.endsWith('main.js') || path.endsWith('main.css'),
    themeBodyClass: () => 'vscode-dark',
  };
}

function makeWebview(): {
  webview: StudioWebviewLike;
  view: StudioWebviewViewLike;
  posted: unknown[];
} {
  const posted: unknown[] = [];
  const webview: StudioWebviewLike = {
    cspSource: 'https://csp.test',
    options: {},
    asWebviewUri: (uri) => ({ toString: () => `https://wv.test${(uri as { fsPath: string }).fsPath}` }),
    postMessage: (message) => {
      posted.push(message);
      return true;
    },
    onDidReceiveMessage: () => ({ dispose() {} }),
    get html() {
      return '';
    },
    set html(_value: string) {},
    getState: () => undefined,
    setState: () => {},
  };
  const view: StudioWebviewViewLike = {
    webview,
    show: () => {},
    onDidDispose: () => ({ dispose() {} }),
  };
  return { webview, view, posted };
}

function makeHost(view: StudioWebviewViewLike): StudioViewHost {
  return {
    registerWebviewViewProvider: (_id, provider) => {
      provider.resolveWebviewView(view as never);
      return { dispose() {} };
    },
  };
}

function makeSurfaces(): RunOutputHostSurfaces & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    copyText: (text) => calls.push({ method: 'copyText', text }),
    focusRun: (runId) => calls.push({ method: 'focusRun', runId }),
    revealProfilerLine: (line) => calls.push({ method: 'revealProfilerLine', line }),
    revealLogLine: (line) => calls.push({ method: 'revealLogLine', line }),
    copyLogText: (text) => calls.push({ method: 'copyLogText', text }),
  };
}

describe('buildRunOutputStudioBody', () => {
  test('contains every structural id the webview expects', () => {
    const body = buildRunOutputStudioBody();
    expect(body).toContain('id="runoutput-root"');
    expect(body).toContain('data-axis-runoutput-host="1"');
    expect(body).toContain('data-tab="summary"');
    expect(body).toContain('data-tab="strategy"');
    expect(body).toContain('data-tab="profiler"');
    expect(body).toContain('data-tab="logs"');
    expect(body).toContain('id="runoutput-panels"');
  });
});

describe('createRunOutputRegistration', () => {
  function makeStore(lastRun?: unknown) {
    const store = new ResultsFocusStore();
    if (lastRun) {
      store.publish({ ...(lastRun as Record<string, unknown>), focus: true } as never);
    }
    return store;
  }

  test('returns the expected registration shape', () => {
    const store = makeStore({ status: 'success', id: 'run-1' });
    const profiler = new ProfilerStore();
    const surfaces = makeSurfaces();
    const reg = createRunOutputRegistration(store, profiler, surfaces);

    expect(reg.id).toBe(RUN_OUTPUT_STUDIO_ID);
    expect(reg.viewId).toBe('axis.runOutput');
    expect(reg.title).toBe('Run Output');
    expect(reg.retainContextWhenHidden).toBe(false);
    expect(reg.buildBody?.()).toContain('runoutput-root');
    expect(reg.restore?.()).toBeDefined();
  });

  test('action handlers call surfaces with parsed args', () => {
    const store = makeStore({ status: 'success', id: 'run-1' });
    const profiler = new ProfilerStore();
    const surfaces = makeSurfaces();
    const reg = createRunOutputRegistration(store, profiler, surfaces);

    reg.actions.copyId?.({ runId: 'run-1 ' }, { view: 'runoutput', action: 'copyId' });
    reg.actions.focusRun?.({ runId: 'run-2' }, { view: 'runoutput', action: 'focusRun' });
    reg.actions.revealProfilerLine?.({ line: 7 }, { view: 'runoutput', action: 'revealProfilerLine' });
    reg.actions.copyRunId?.({ runId: 'run-3' }, { view: 'runoutput', action: 'copyRunId' });
    reg.actions.revealLogLine?.({ line: 9 }, { view: 'runoutput', action: 'revealLogLine' });
    reg.actions.copyLogText?.({ text: 'log line' }, { view: 'runoutput', action: 'copyLogText' });
    reg.actions.selectTab?.({ tab: 'logs' }, { view: 'runoutput', action: 'selectTab' });

    expect(surfaces.calls).toEqual([
      { method: 'copyText', text: 'run-1' },
      { method: 'focusRun', runId: 'run-2' },
      { method: 'revealProfilerLine', line: 7 },
      { method: 'copyText', text: 'run-3' },
      { method: 'revealLogLine', line: 9 },
      { method: 'copyLogText', text: 'log line' },
    ]);
  });

  test('action handlers ignore invalid args', () => {
    const store = makeStore({ status: 'success', id: 'run-1' });
    const profiler = new ProfilerStore();
    const surfaces = makeSurfaces();
    const reg = createRunOutputRegistration(store, profiler, surfaces);

    reg.actions.copyId?.({}, { view: 'runoutput', action: 'copyId' });
    reg.actions.focusRun?.({ runId: 123 }, { view: 'runoutput', action: 'focusRun' });
    reg.actions.revealProfilerLine?.({ line: 0 }, { view: 'runoutput', action: 'revealProfilerLine' });

    expect(surfaces.calls).toEqual([]);
  });
});

describe('registerRunOutput', () => {
  test('registers the view and posts updates on store changes', () => {
    const store = new ResultsFocusStore();
    const profiler = new ProfilerStore();
    const surfaces = makeSurfaces();
    const { view, posted } = makeWebview();
    const context: StudioContextLike = { subscriptions: [] };

    const provider = registerRunOutput(context, makeDeps(), makeHost(view), store, surfaces, profiler);
    expect(provider).toBeDefined();
    // Generic provider pushes the registration disposable; registerRunOutput adds
    // the store-subscription disposable.
    expect(context.subscriptions.length).toBe(2);

    store.publish({ status: 'success', focus: true } as never);
    const lastSet = posted.at(-1) as { type: string; payload: { view: string; data: unknown } } | undefined;
    expect(lastSet?.type).toBe(HOST_TO_VIEW.StudioSet);
    expect(lastSet?.payload.view).toBe('runoutput');
  });

  test('reuses an injected profiler store and posts on profiler updates', () => {
    const store = new ResultsFocusStore();
    const profiler = new ProfilerStore();
    const surfaces = makeSurfaces();
    const { view, posted } = makeWebview();
    const context: StudioContextLike = { subscriptions: [] };

    const provider = registerRunOutput(context, makeDeps(), makeHost(view), store, surfaces, profiler);
    expect(provider).toBeDefined();

    profiler.recordFromRun({ id: 'run-p', status: 'success', engineId: 'e', seriesKey: 's' });
    const lastSet = posted.at(-1) as { type: string; payload: { view: string } } | undefined;
    expect(lastSet?.type).toBe(HOST_TO_VIEW.StudioSet);
    expect(lastSet?.payload.view).toBe('runoutput');
  });

  test('creates a default profiler store when none is provided', () => {
    const store = new ResultsFocusStore();
    const surfaces = makeSurfaces();
    const { view } = makeWebview();
    const context: StudioContextLike = { subscriptions: [] };

    const provider = registerRunOutput(context, makeDeps(), makeHost(view), store, surfaces);
    expect(provider).toBeDefined();
  });

  test('returns undefined when registration fails', () => {
    const store = new ResultsFocusStore();
    const surfaces = makeSurfaces();
    const host: StudioViewHost = {
      registerWebviewViewProvider: () => {
        throw new Error('register');
      },
    };
    const provider = registerRunOutput(
      { subscriptions: [] },
      makeDeps(),
      host,
      store,
      surfaces,
    );
    expect(provider).toBeUndefined();
  });

  test('tolerates a hostile context subscriptions.push', () => {
    const store = new ResultsFocusStore();
    const surfaces = makeSurfaces();
    const { view } = makeWebview();
    const context: StudioContextLike = {
      subscriptions: [],
    };
    Object.defineProperty(context.subscriptions, 'push', {
      value: () => {
        throw new Error('push');
      },
    });

    const provider = registerRunOutput(context, makeDeps(), makeHost(view), store, surfaces);
    expect(provider).toBeDefined();
  });

  test('disposal tolerates throwing unsubscribe functions', () => {
    const store = new ResultsFocusStore();
    const surfaces = makeSurfaces();
    const { view } = makeWebview();
    const context: StudioContextLike = { subscriptions: [] };
    const storeWithBadUnsub = {
      getResultsSetPayload: () => store.getResultsSetPayload(),
      subscribe: () => () => {
        throw new Error('unsub');
      },
    };

    const provider = registerRunOutput(context, makeDeps(), makeHost(view), storeWithBadUnsub, surfaces);
    expect(provider).toBeDefined();

    // The run-output subscription is the last one added; dispose it to exercise
    // the unsubscribe error guards.
    const disposer = context.subscriptions.at(-1);
    expect(() => disposer?.dispose()).not.toThrow();
  });

  test('disposal tolerates results and profiler unsubscribe both throwing', () => {
    const surfaces = makeSurfaces();
    const { view } = makeWebview();
    const context: StudioContextLike = { subscriptions: [] };
    const badStore = {
      getResultsSetPayload: () => ({ lastRun: null, focusId: null, strategyReport: null }),
      subscribe: () => () => {
        throw new Error('unsub-results');
      },
    };
    const badProfiler = {
      getSnapshot: () => null,
      subscribe: () => () => {
        throw new Error('unsub-profiler');
      },
    } as unknown as ProfilerStore;

    const provider = registerRunOutput(context, makeDeps(), makeHost(view), badStore, surfaces, badProfiler);
    expect(provider).toBeDefined();
    const disposer = context.subscriptions.at(-1);
    expect(() => disposer?.dispose()).not.toThrow();
  });
});

