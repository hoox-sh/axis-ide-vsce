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
import type { OhlcvBar } from '../host/mock-bars';
import {
  PYODIDE_DISABLED_ERROR,
  RunOrchestrator,
  UNSUPPORTED_ENGINE_ERROR,
  mapEngineResponse,
  type ChartNotifyMessage,
  type FetchLike,
  type RunDeps,
  type RunDiagnostic,
  type RunRequest,
} from './index';

const PRO_KEY = 'pyn_abcdefghijklmnopqrstuvwxyz0123456789';

const BARS: OhlcvBar[] = [
  { time: 1_700_000_000, open: 100, high: 101, low: 99, close: 100, volume: 1 },
];

function mockFetch(
  handler: (url: string, init?: Parameters<FetchLike>[1]) => {
    ok: boolean;
    status: number;
    body: string;
  },
): FetchLike {
  return async (url, init) => {
    const res = handler(url, init);
    return {
      ok: res.ok,
      status: res.status,
      text: async () => res.body,
    };
  };
}

function makeDeps(overrides?: {
  proKey?: string | undefined;
  workerKey?: string | undefined;
  fetchImpl?: FetchLike;
  missingProKey?: boolean;
  missingWorkerKey?: boolean;
}): {
  deps: RunDeps;
  charts: ChartNotifyMessage[];
  lines: string[];
  diagnostics: { uri?: string; items: RunDiagnostic[] }[];
} {
  const charts: ChartNotifyMessage[] = [];
  const lines: string[] = [];
  const diagnostics: { uri?: string; items: RunDiagnostic[] }[] = [];

  const fetchImpl =
    overrides?.fetchImpl ??
    mockFetch(() => ({
      ok: true,
      status: 200,
      body: JSON.stringify({
        status: 'success',
        plots: [1, 2, 3],
        series: { plot_0: [1, 2, 3] },
      }),
    }));

  const deps: RunDeps = {
    secrets: {
      async getProKey() {
        if (overrides?.missingProKey) return undefined;
        if (overrides && Object.prototype.hasOwnProperty.call(overrides, 'proKey')) {
          return overrides.proKey;
        }
        return PRO_KEY;
      },
      async getWorkerKey() {
        if (overrides?.missingWorkerKey) return undefined;
        if (overrides && Object.prototype.hasOwnProperty.call(overrides, 'workerKey')) {
          return overrides.workerKey;
        }
        return undefined;
      },
    },
    endpoint: 'http://127.0.0.1:5002',
    fetchImpl,
    bus: {
      notifyChart(message) {
        charts.push(message);
      },
    },
    output: {
      appendLine(line) {
        lines.push(line);
      },
    },
    diagnostics: {
      set(uri, items) {
        diagnostics.push({ uri, items: [...items] });
      },
    },
  };

  return { deps, charts, lines, diagnostics };
}

function baseReq(partial?: Partial<RunRequest>): RunRequest {
  return {
    script: '//@version=5\nindicator("t")\nplot(close)',
    uri: 'file:///tmp/t.pyne',
    mode: 'auto',
    focus: true,
    bars: BARS,
    seriesKey: 'binance|spot|BTC/USDT|1m',
    engineId: 'server',
    baseSeq: 1,
    ...partial,
  };
}

describe('RunOrchestrator', () => {
  test('success: paints chart.full with seq > baseSeq and seriesKey', async () => {
    const orch = new RunOrchestrator();
    const { deps, charts, lines, diagnostics } = makeDeps();
    let seenAuth = '';
    let seenApiKey = '';
    deps.fetchImpl = mockFetch((_url, init) => {
      seenAuth = init?.headers?.Authorization ?? '';
      seenApiKey = init?.headers?.['X-API-Key'] ?? '';
      return {
        ok: true,
        status: 200,
        body: JSON.stringify({ status: 'success', plots: [9], series: {} }),
      };
    });

    const outcome = await orch.run(baseReq({ baseSeq: 1 }), deps);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(seenAuth).toBe(`Bearer ${PRO_KEY}`);
    expect(seenApiKey).toBe(PRO_KEY);
    expect(outcome.seq).toBe(2); // baseSeq 1 + 1 — avoids handshake collision
    expect(outcome.runId).toBe(`run-${outcome.epoch}`);

    const full = charts.find((m) => m.type === 'chart.full');
    expect(full?.type).toBe('chart.full');
    if (full?.type === 'chart.full') {
      expect(full.payload.bars).toEqual(BARS);
      expect(full.payload.plots).toEqual([9]);
      expect(full.payload.seq).toBe(2);
      expect(full.seriesKey).toBe('binance|spot|BTC/USDT|1m');
    }
    // Success clears diagnostics for the run URI only (empty set).
    expect(diagnostics.some((d) => d.uri === 'file:///tmp/t.pyne' && d.items.length === 0)).toBe(
      true,
    );
    expect(lines.some((l) => l.includes('run ok'))).toBe(true);
  });

  test('success publish keeps drawings and plots on chart.full', async () => {
    const orch = new RunOrchestrator();
    const { deps, charts } = makeDeps({
      fetchImpl: mockFetch(() => ({
        ok: true,
        status: 200,
        body: JSON.stringify({
          status: 'success',
          plots: [9],
          series: { plot_0: [9] },
          drawings: [{ id: 'd1' }],
        }),
      })),
    });

    const outcome = await orch.run(baseReq(), deps);
    expect(outcome.ok).toBe(true);
    const full = charts.find((m) => m.type === 'chart.full');
    expect(full?.type).toBe('chart.full');
    if (full?.type === 'chart.full') {
      expect(full.payload.drawings).toEqual([{ id: 'd1' }]);
      expect(full.payload.plots).toEqual([9]);
    }
  });

  test('success chart.full carries plot_meta, inputs, window, strategy', async () => {
    let seenBody: Record<string, unknown> = {};
    const orch = new RunOrchestrator();
    const { deps, charts } = makeDeps({
      fetchImpl: mockFetch((_url, init) => {
        seenBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        return {
          ok: true,
          status: 200,
          body: JSON.stringify({
            status: 'success',
            plots: [1],
            series: { sma: [1], __equity: [100, 110] },
            plot_meta: { sma: { kind: 'plot', style: 'histogram' } },
            inputs: [{ title: 'Length', type: 'int', value: 14 }],
            window: { from_bar: 0, to_bar: 1, total_bars: 10 },
            times: [1_700_000_000],
            events: [{ kind: 'entry', id: 'L', bar_time: 1_700_000_000, ohlc: [1, 1, 1, 1] }],
            alerts: [{ message: 'a' }],
            script_type: 'strategy',
          }),
        };
      }),
    });
    const outcome = await orch.run(baseReq({ inputs: { Length: 14 } }), deps);
    expect(outcome.ok).toBe(true);
    expect(seenBody.inputs).toEqual({ Length: 14 });
    const full = charts.find((m) => m.type === 'chart.full');
    expect(full?.type).toBe('chart.full');
    if (full?.type === 'chart.full') {
      expect(full.payload.plotMeta).toEqual({ sma: { kind: 'plot', style: 'histogram' } });
      expect(full.payload.window).toEqual({ fromBar: 0, toBar: 1, totalBars: 10 });
      const strategy = full.payload.strategy as { trades: Array<{ id: string }> } | undefined;
      expect(strategy?.trades[0]?.id).toBe('L');
      expect(full.payload.inputs).toEqual([{ title: 'Length', type: 'int', value: 14 }]);
      expect(full.payload.alerts).toEqual([{ message: 'a' }]);
    }
  });

  test('HTTP error: sets diagnostics for URI; never paints chart.full', async () => {
    const orch = new RunOrchestrator();
    const { deps, charts, lines, diagnostics } = makeDeps({
      fetchImpl: mockFetch(() => ({
        ok: false,
        status: 400,
        body: JSON.stringify({
          status: 'error',
          code: 'COMPILE',
          message: 'syntax error',
          errors: [{ message: 'unexpected token', line: 2, column: 1 }],
        }),
      })),
    });

    const outcome = await orch.run(baseReq(), deps);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe('error');
    expect(charts.some((m) => m.type === 'chart.full')).toBe(false);
    const diag = diagnostics.find((d) => d.items.length > 0);
    expect(diag?.uri).toBe('file:///tmp/t.pyne');
    expect(diag?.items[0]?.message).toBe('unexpected token');
    expect(lines.some((l) => l.includes('run error'))).toBe(true);
  });

  test('error message containing Pro key is scrubbed from outcome/output', async () => {
    const orch = new RunOrchestrator();
    const { deps, charts, lines, diagnostics } = makeDeps({
      fetchImpl: mockFetch(() => ({
        ok: false,
        status: 400,
        body: JSON.stringify({
          status: 'error',
          message: `bad ${PRO_KEY}`,
          errors: [{ message: `syntax ${PRO_KEY}` }],
        }),
      })),
    });
    const outcome = await orch.run(baseReq(), deps);
    expect(outcome.ok).toBe(false);
    expect(charts.some((m) => m.type === 'chart.full')).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error ?? '').not.toContain(PRO_KEY);
    }
    expect(JSON.stringify(diagnostics)).not.toContain(PRO_KEY);
    expect(lines.join('\n')).not.toContain(PRO_KEY);
  });

  test('stale epoch: later run wins; earlier completion is dropped', async () => {
    const orch = new RunOrchestrator();
    const charts1: ChartNotifyMessage[] = [];
    const charts2: ChartNotifyMessage[] = [];
    const lines: string[] = [];

    let releaseSlow: (() => void) | undefined;
    const slowGate = new Promise<void>((resolve) => {
      releaseSlow = resolve;
    });

    const slowFetch: FetchLike = async (_url, init) => {
      await slowGate;
      if (init?.signal?.aborted) {
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      }
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ status: 'success', plots: ['slow'], series: {} }),
      };
    };
    const fastFetch: FetchLike = async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ status: 'success', plots: ['fast'], series: {} }),
    });

    const sharedDiag = { set() {} };

    const depsSlow: RunDeps = {
      secrets: {
        async getProKey() {
          return PRO_KEY;
        },
        async getWorkerKey() {
          return undefined;
        },
      },
      endpoint: 'http://127.0.0.1:5002',
      fetchImpl: slowFetch,
      bus: {
        notifyChart(m) {
          charts1.push(m);
        },
      },
      output: {
        appendLine(l) {
          lines.push(l);
        },
      },
      diagnostics: sharedDiag,
    };
    const depsFast: RunDeps = {
      ...depsSlow,
      fetchImpl: fastFetch,
      bus: {
        notifyChart(m) {
          charts2.push(m);
        },
      },
    };

    const p1 = orch.run(baseReq({ focus: true, baseSeq: 1 }), depsSlow);
    await Promise.resolve();
    await Promise.resolve();

    const o2 = await orch.run(baseReq({ focus: true, baseSeq: 1 }), depsFast);
    expect(o2.ok).toBe(true);
    releaseSlow?.();
    const o1 = await p1;
    expect(o1.ok).toBe(false);
    if (!o1.ok) expect(['stale', 'aborted']).toContain(o1.reason);
    expect(charts1.some((m) => m.type === 'chart.full')).toBe(false);
    expect(charts2.some((m) => m.type === 'chart.full')).toBe(true);
  });

  test('absent Pro key is not an error: run goes out keyless with X-AXIS-Client: ide', async () => {
    const orch = new RunOrchestrator();
    let called = false;
    let seenAuth: string | undefined = 'unset';
    let seenClient: string | undefined;
    const { deps, diagnostics } = makeDeps({
      missingProKey: true,
      missingWorkerKey: true,
      fetchImpl: async (_url, init) => {
        called = true;
        seenAuth = init?.headers?.Authorization;
        seenClient = init?.headers?.['X-AXIS-Client'];
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: 'success', plots: [1], series: {} }),
        };
      },
    });
    const outcome = await orch.run(baseReq(), deps);
    expect(called).toBe(true);
    expect(seenAuth).toBeUndefined();
    expect(seenClient).toBe('ide');
    expect(outcome.ok).toBe(true);
    expect(diagnostics.flatMap((d) => d.items)).toHaveLength(0);
  });

  test('engine error containing Pro key is scrubbed from output/diagnostics', async () => {
    const orch = new RunOrchestrator();
    const { deps, lines, diagnostics } = makeDeps({
      fetchImpl: mockFetch(() => ({
        ok: false,
        status: 500,
        body: JSON.stringify({
          status: 'error',
          message: `engine blew up with ${PRO_KEY}`,
        }),
      })),
    });
    const outcome = await orch.run(baseReq(), deps);
    expect(outcome.ok).toBe(false);
    expect(lines.join('\n')).not.toContain(PRO_KEY);
    expect(JSON.stringify(diagnostics)).not.toContain(PRO_KEY);
  });

  test('aborted signal before fetch returns aborted with no paint and no fetch', async () => {
    const orch = new RunOrchestrator();
    let called = false;
    const ac = new AbortController();
    ac.abort();
    const { deps, charts } = makeDeps({
      fetchImpl: async () => {
        called = true;
        return { ok: true, status: 200, text: async () => '{}' };
      },
    });
    const outcome = await orch.run(baseReq({ signal: ac.signal }), deps);
    expect(called).toBe(false);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('aborted');
    expect(charts.some((m) => m.type === 'chart.full')).toBe(false);
  });

  test('abortAll aborts in-flight fetch and does not paint', async () => {
    const orch = new RunOrchestrator();
    let fetchStarted = false;
    let sawAbort = false;
    const { deps, charts } = makeDeps({
      fetchImpl: async (_url, init) => {
        fetchStarted = true;
        await new Promise<void>((resolve) => {
          const onAbort = () => {
            sawAbort = true;
            resolve();
          };
          if (init?.signal?.aborted) {
            onAbort();
            return;
          }
          init?.signal?.addEventListener('abort', onAbort, { once: true });
        });
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      },
    });
    const p = orch.run(baseReq(), deps);
    await Promise.resolve();
    await Promise.resolve();
    orch.abortAll();
    const outcome = await p;
    expect(fetchStarted).toBe(true);
    expect(sawAbort).toBe(true);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(['aborted', 'error', 'stale']).toContain(outcome.reason);
    expect(charts.some((m) => m.type === 'chart.full')).toBe(false);
  });

  test('unsupported engine id is rejected without fetch', async () => {
    const orch = new RunOrchestrator();
    let called = false;
    const { deps } = makeDeps({
      fetchImpl: async () => {
        called = true;
        return { ok: true, status: 200, text: async () => '{}' };
      },
    });
    const outcome = await orch.run(baseReq({ engineId: 'pyne-worker' }), deps);
    expect(called).toBe(false);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toBe(UNSUPPORTED_ENGINE_ERROR);
  });

  test('empty endpoint falls back to default', async () => {
    const orch = new RunOrchestrator();
    let seen = '';
    const { deps } = makeDeps({
      fetchImpl: mockFetch((url) => {
        seen = url;
        return {
          ok: true,
          status: 200,
          body: JSON.stringify({ status: 'success', plots: [] }),
        };
      }),
    });
    deps.endpoint = '   ';
    const ac = new AbortController();
    const outcome = await orch.run(baseReq({ signal: ac.signal }), deps);
    expect(outcome.ok).toBe(true);
    expect(seen).toBe('http://127.0.0.1:5002/run');
    expect(orch.currentSeq).toBeGreaterThan(0);
    expect(orch.currentEpoch).toBeGreaterThan(0);
  });

  test('invalid Pro key shape is rejected', async () => {
    const orch = new RunOrchestrator();
    const { deps, diagnostics } = makeDeps({ proKey: 'pyn_tooshort' });
    const outcome = await orch.run(baseReq(), deps);
    expect(outcome.ok).toBe(false);
    expect(diagnostics.some((d) => d.items.length > 0)).toBe(true);
  });

  test('invalid Worker key shape is rejected without fetch', async () => {
    const orch = new RunOrchestrator();
    let called = false;
    const { deps, diagnostics } = makeDeps({
      missingProKey: true,
      workerKey: 'pn_tooshort',
      fetchImpl: async () => {
        called = true;
        return { ok: true, status: 200, text: async () => '{}' };
      },
    });
    const outcome = await orch.run(baseReq(), deps);
    expect(called).toBe(false);
    expect(outcome.ok).toBe(false);
    expect(diagnostics.some((d) => d.items.length > 0)).toBe(true);
  });

  test('top-level throw is caught and scrubbed', async () => {
    const orch = new RunOrchestrator();
    const { deps } = makeDeps();
    deps.secrets.getProKey = async () => {
      throw new Error(`leak ${PRO_KEY}`);
    };
    deps.diagnostics.set = () => {
      throw new Error('diag fail');
    };
    const outcome = await orch.run(baseReq(), deps);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error ?? '').not.toContain(PRO_KEY);
      expect(outcome.error).toMatch(/leak/i);
    }
  });

  test('error with empty diagnostics list still sets a fallback diagnostic', async () => {
    const orch = new RunOrchestrator();
    const { deps, diagnostics } = makeDeps({
      fetchImpl: mockFetch(() => ({
        ok: true,
        status: 200,
        body: JSON.stringify({ status: 'error' }),
      })),
    });
    const outcome = await orch.run(baseReq(), deps);
    expect(outcome.ok).toBe(false);
    expect(diagnostics.some((d) => d.items.length > 0)).toBe(true);
  });

  test('stale inside catch after throw still reports stale', async () => {
    const orch = new RunOrchestrator();
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const lines: string[] = [];
    const deps: RunDeps = {
      secrets: {
        async getProKey() {
          await gate;
          throw new Error('late fail');
        },
        async getWorkerKey() {
          return undefined;
        },
      },
      endpoint: 'http://127.0.0.1:5002',
      bus: { notifyChart() {} },
      output: {
        appendLine(l) {
          lines.push(l);
        },
      },
      diagnostics: { set() {} },
    };
    const p1 = orch.run(baseReq(), deps);
    await Promise.resolve();
    void orch
      .run(baseReq(), {
        ...deps,
        secrets: {
          async getProKey() {
            return PRO_KEY;
          },
          async getWorkerKey() {
            return undefined;
          },
        },
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: 'success', plots: [] }),
        }),
      })
      .catch(() => undefined);
    await Promise.resolve();
    await Promise.resolve();
    release();
    const o1 = await p1;
    expect(o1.ok).toBe(false);
    if (!o1.ok) expect(['stale', 'aborted']).toContain(o1.reason);
  });

  test('safeLog swallows output failures', async () => {
    const orch = new RunOrchestrator();
    const { deps } = makeDeps();
    deps.output.appendLine = () => {
      throw new Error('output closed');
    };
    // Should not throw out of run despite logging failures.
    const outcome = await orch.run(baseReq({ engineId: 'pyne-worker' }), deps);
    expect(outcome.ok).toBe(false);
  });

  test('abortAll is idempotent when idle', () => {
    const orch = new RunOrchestrator();
    expect(() => orch.abortAll()).not.toThrow();
    expect(() => orch.abortAll()).not.toThrow();
  });

  test('aborted after fetch returns aborted and does not paint', async () => {
    const orch = new RunOrchestrator();
    const ac = new AbortController();
    const { deps, charts } = makeDeps({
      fetchImpl: async () => {
        ac.abort();
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: 'success', plots: [] }),
        };
      },
    });
    const outcome = await orch.run(baseReq({ signal: ac.signal }), deps);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('aborted');
    expect(charts.some((m) => m.type === 'chart.full')).toBe(false);
  });

  test('stale after getProKey drops without fetch', async () => {
    const orch = new RunOrchestrator();
    const lines: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    let fetched = false;
    const deps: RunDeps = {
      secrets: {
        async getProKey() {
          await gate;
          return PRO_KEY;
        },
        async getWorkerKey() {
          return undefined;
        },
      },
      endpoint: 'http://127.0.0.1:5002',
      fetchImpl: async () => {
        fetched = true;
        return { ok: true, status: 200, text: async () => '{}' };
      },
      bus: { notifyChart() {} },
      output: {
        appendLine(l) {
          lines.push(l);
        },
      },
      diagnostics: { set() {} },
    };
    const p1 = orch.run(baseReq(), deps);
    await Promise.resolve();
    const o2 = await orch.run(baseReq(), {
      ...deps,
      secrets: {
        async getProKey() {
          return PRO_KEY;
        },
        async getWorkerKey() {
          return undefined;
        },
      },
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 'success', plots: [] }),
      }),
    });
    expect(o2.ok).toBe(true);
    release();
    const o1 = await p1;
    expect(o1.ok).toBe(false);
    if (!o1.ok) expect(['stale', 'aborted']).toContain(o1.reason);
    expect(lines.some((l) => l.includes('drop stale') || l.includes('aborted'))).toBe(true);
    void fetched;
  });

  test('worker key alone is accepted when Pro key missing', async () => {
    const workerKey = `pn_${'ab'.repeat(24)}`;
    const orch = new RunOrchestrator();
    let seenAuth = '';
    let seenApiKey = '';
    const { deps, charts } = makeDeps({
      missingProKey: true,
      workerKey,
      fetchImpl: mockFetch((_url, init) => {
        seenAuth = init?.headers?.Authorization ?? '';
        seenApiKey = init?.headers?.['X-API-Key'] ?? '';
        return {
          ok: true,
          status: 200,
          body: JSON.stringify({ status: 'success', plots: [1] }),
        };
      }),
    });
    const outcome = await orch.run(baseReq(), deps);
    expect(outcome.ok).toBe(true);
    expect(seenAuth).toBe(`Bearer ${workerKey}`);
    expect(seenApiKey).toBe(workerKey);
    expect(charts.some((m) => m.type === 'chart.full')).toBe(true);
  });

  test('POSTs timeframe and from_bar/to_bar when provided', async () => {
    let seenBody: Record<string, unknown> = {};
    const orch = new RunOrchestrator();
    const { deps } = makeDeps({
      fetchImpl: mockFetch((_url, init) => {
        seenBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        return {
          ok: true,
          status: 200,
          body: JSON.stringify({ status: 'success', plots: [1], series: {} }),
        };
      }),
    });
    const outcome = await orch.run(
      baseReq({ timeframe: '5m', fromBar: 2, toBar: 9 }),
      deps,
    );
    expect(outcome.ok).toBe(true);
    expect(seenBody.timeframe).toBe('5m');
    expect(seenBody.from_bar).toBe(2);
    expect(seenBody.to_bar).toBe(9);
  });

  test('dumps capped engine logs including log.info onto the run channel', async () => {
    const orch = new RunOrchestrator();
    const { deps, lines } = makeDeps({
      fetchImpl: mockFetch(() => ({
        ok: true,
        status: 200,
        body: JSON.stringify({
          status: 'success',
          plots: [1],
          series: {},
          logs: [
            { level: 'info', message: 'hello from pine' },
            { msg: 'via-msg' },
            { text: 'via-text', severity: 'warning' },
            { level: 'error' },
            { foo: 1 },
            'log.info already-a-string',
            '  ',
            42,
            null,
          ],
        }),
      })),
    });
    const outcome = await orch.run(baseReq(), deps);
    expect(outcome.ok).toBe(true);
    expect(lines.some((l) => l === 'log.info hello from pine')).toBe(true);
    expect(lines.some((l) => l === 'log.info via-msg')).toBe(true);
    expect(lines.some((l) => l === 'log.warning via-text')).toBe(true);
    expect(lines.some((l) => l === 'log.error')).toBe(true);
    expect(lines.some((l) => l === 'log.info already-a-string')).toBe(true);
  });

  test('dumps engine logs on error and scrubs secrets in log lines', async () => {
    const orch = new RunOrchestrator();
    const { deps, lines } = makeDeps({
      fetchImpl: mockFetch(() => ({
        ok: false,
        status: 400,
        body: JSON.stringify({
          status: 'error',
          message: 'compile failed',
          logs: [{ level: 'info', message: `key ${PRO_KEY}` }],
        }),
      })),
    });
    const outcome = await orch.run(baseReq(), deps);
    expect(outcome.ok).toBe(false);
    expect(lines.some((l) => l.startsWith('log.info key '))).toBe(true);
    expect(lines.join('\n')).not.toContain(PRO_KEY);
  });

  test('pyodide engine runs calculator without fetch and paints chart.full', async () => {
    let called = false;
    const orch = new RunOrchestrator();
    const { deps, charts, lines } = makeDeps({
      fetchImpl: async () => {
        called = true;
        return { ok: true, status: 200, text: async () => '{}' };
      },
    });
    deps.pyodideAllowed = true;
    deps.runPyodide = async () => {
      const mapped = mapEngineResponse({
        status: 'success',
        plots: { close: [100] },
        series: { close: [100] },
      });
      mapped.meta.wheel = 'hoox_pyne-0.7.0';
      return mapped;
    };
    const outcome = await orch.run(baseReq({ engineId: 'pyodide' }), deps);
    expect(called).toBe(false);
    expect(outcome.ok).toBe(true);
    expect(charts.some((m) => m.type === 'chart.full')).toBe(true);
    expect(lines.some((l) => l === 'engine=pyodide wheel=hoox_pyne-0.7.0 uploaded=0')).toBe(true);
    const full = charts.find((m) => m.type === 'chart.full');
    const look = (full?.payload as { lookahead?: { tainted?: boolean; static?: boolean } })?.lookahead;
    expect(look?.static).toBe(true);
    expect(look?.tainted).toBe(false);
  });

  test('lookahead_on script stamps chart.full.lookahead tainted', async () => {
    const orch = new RunOrchestrator();
    const { deps, charts } = makeDeps();
    deps.pyodideAllowed = true;
    deps.runPyodide = async () =>
      mapEngineResponse({ status: 'success', plots: { close: [1] }, series: { close: [1] } });
    const outcome = await orch.run(
      baseReq({
        engineId: 'pyodide',
        script: '//@version=6\nindicator("x")\nrequest.security(syminfo.tickerid, "D", close)\n',
      }),
      deps,
    );
    expect(outcome.ok).toBe(true);
    const full = charts.find((m) => m.type === 'chart.full');
    const look = (full?.payload as { lookahead?: { tainted?: boolean; hits?: unknown[] } })?.lookahead;
    expect(look?.tainted).toBe(true);
    expect((look?.hits ?? []).length).toBeGreaterThan(0);
  });

  test('pyodide engine respects abort before calculator', async () => {
    let called = false;
    const orch = new RunOrchestrator();
    const ac = new AbortController();
    ac.abort();
    const { deps } = makeDeps({
      fetchImpl: async () => {
        called = true;
        return { ok: true, status: 200, text: async () => '{}' };
      },
    });
    deps.pyodideAllowed = true;
    deps.runPyodide = async () => {
      called = true;
      return mapEngineResponse({ status: 'success', plots: [] });
    };
    const outcome = await orch.run(baseReq({ engineId: 'pyodide', signal: ac.signal }), deps);
    expect(called).toBe(false);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('aborted');
  });

  test('pyodide run forwards inputs and fills declarations the engine omitted', async () => {
    let seen: Record<string, unknown> | undefined;
    const orch = new RunOrchestrator();
    const { deps, charts } = makeDeps();
    deps.pyodideAllowed = true;
    deps.runPyodide = async (req) => {
      seen = req.inputs;
      return mapEngineResponse({ status: 'success', plots: { close: [1] }, series: { close: [1] } });
    };
    const script = 'indicator("t")\nlen = input.int(14, "Length")\nplot(close)\n';
    const outcome = await orch.run(baseReq({ engineId: 'pyodide', script, inputs: { Length: 9 } }), deps);
    expect(outcome.ok).toBe(true);
    expect(seen).toEqual({ Length: 9 });
    const full = charts.find((m) => m.type === 'chart.full');
    const inputs = (full?.payload as { inputs?: Array<{ title: string; value: unknown }> } | undefined)
      ?.inputs;
    expect(inputs).toEqual([
      expect.objectContaining({ title: 'Length', type: 'int', value: 9, defval: 14 }),
    ]);
  });

  test('empty input object is filled; a present map or a non-object is kept', async () => {
    const script = 'indicator("t")\nlen = input.int(14, "Length")\nplot(close)\n';
    const orch = new RunOrchestrator();
    const empty = makeDeps();
    empty.deps.pyodideAllowed = true;
    empty.deps.runPyodide = async () => {
      const mapped = mapEngineResponse({ status: 'success', plots: { close: [1] }, series: { close: [1] } });
      mapped.inputs = {};
      return mapped;
    };
    const filled = await orch.run(baseReq({ engineId: 'pyodide', script }), empty.deps);
    expect(filled.ok).toBe(true);
    const filledFull = empty.charts.find((m) => m.type === 'chart.full');
    const filledInputs = (
      filledFull?.payload as { inputs?: Array<{ title: string; value: unknown }> } | undefined
    )?.inputs;
    expect(filledInputs).toEqual([
      expect.objectContaining({ title: 'Length', type: 'int', value: 14 }),
    ]);

    const kept = new RunOrchestrator();
    const present = makeDeps();
    present.deps.pyodideAllowed = true;
    present.deps.runPyodide = async () => {
      const mapped = mapEngineResponse({ status: 'success', plots: { close: [1] }, series: { close: [1] } });
      mapped.inputs = { Length: 21 };
      return mapped;
    };
    await kept.run(baseReq({ engineId: 'pyodide', script }), present.deps);
    const presentFull = present.charts.find((m) => m.type === 'chart.full');
    const presentInputs = (presentFull?.payload as { inputs?: unknown } | undefined)?.inputs;
    expect(presentInputs).toEqual({ Length: 21 });

    const scalar = new RunOrchestrator();
    const raw = makeDeps();
    raw.deps.pyodideAllowed = true;
    raw.deps.runPyodide = async () => {
      const mapped = mapEngineResponse({ status: 'success', plots: { close: [1] }, series: { close: [1] } });
      mapped.inputs = 3;
      return mapped;
    };
    await scalar.run(baseReq({ engineId: 'pyodide', script }), raw.deps);
    const scalarFull = raw.charts.find((m) => m.type === 'chart.full');
    const scalarInputs = (scalarFull?.payload as { inputs?: unknown } | undefined)?.inputs;
    expect(scalarInputs).toBe(3);
  });

  test('pyodide load failure falls back to the local subset', async () => {
    const orch = new RunOrchestrator();
    const { deps, charts, lines } = makeDeps();
    deps.pyodideAllowed = true;
    deps.runPyodide = async () =>
      mapEngineResponse({ status: 'error', error: 'cdn down', error_kind: 'load' });
    const outcome = await orch.run(
      baseReq({ engineId: 'pyodide', script: 'indicator("t")\nplot(close)\n' }),
      deps,
    );
    expect(outcome.ok).toBe(true);
    expect(lines.some((l) => l.includes('engine=local-subset uploaded=0'))).toBe(true);
    const full = charts.find((m) => m.type === 'chart.full');
    const plots = (full?.payload as { plots?: Record<string, number[]> } | undefined)?.plots;
    expect(plots?.close).toEqual([100]);
  });

  test('pyodide engine without flag is disabled without fetch', async () => {
    let called = false;
    const orch = new RunOrchestrator();
    const { deps } = makeDeps({
      fetchImpl: async () => {
        called = true;
        return { ok: true, status: 200, text: async () => '{}' };
      },
    });
    const outcome = await orch.run(baseReq({ engineId: 'pyodide' }), deps);
    expect(called).toBe(false);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toBe(PYODIDE_DISABLED_ERROR);
  });
});
