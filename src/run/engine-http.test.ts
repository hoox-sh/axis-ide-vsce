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
  DEFAULT_ENGINE_ENDPOINT,
  ENGINE_REMOTE_DENIED,
  MISSING_ENDPOINT_ERROR,
  barsForPine,
  mapEngineResponse,
  mapToWorkerTimeframe,
  postEngineRun,
  type FetchLike,
} from './engine-http';

const SAMPLE_BARS: OhlcvBar[] = [
  { time: 1_700_000_000, open: 100, high: 101, low: 99, close: 100.5, volume: 10 },
  { time: 1_700_000_060, open: 100.5, high: 102, low: 100, close: 101, volume: 12 },
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

describe('barsForPine', () => {
  test('converts unix-seconds time to milliseconds', () => {
    const out = barsForPine(SAMPLE_BARS);
    expect(out).toHaveLength(2);
    expect(out[0]?.time).toBe(1_700_000_000_000);
    expect(out[1]?.close).toBe(101);
  });

  test('passes through already-ms timestamps', () => {
    const out = barsForPine([
      { time: 1_700_000_000_000, open: 1, high: 1, low: 1, close: 1, volume: 1 },
    ]);
    expect(out[0]?.time).toBe(1_700_000_000_000);
  });
});

describe('mapEngineResponse', () => {
  test('maps success with plots/series', () => {
    const r = mapEngineResponse({
      status: 'success',
      plots: [1, 2, null],
      series: { close: [1, 2, 3], __skip: [9] },
      events: [{ type: 'x' }],
      drawings: [{ id: 'd1' }],
    });
    expect(r.status).toBe('success');
    expect(r.plots).toEqual([1, 2, null]);
    expect(r.series.close).toEqual([1, 2, 3]);
    expect(r.series.__skip).toBeUndefined();
    expect(r.diagnostics).toEqual([]);
    expect(r.drawings).toEqual([{ id: 'd1' }]);
  });

  test('maps error + diagnostics from errors array', () => {
    const r = mapEngineResponse({
      status: 'error',
      message: 'compile failed',
      code: 'COMPILE',
      errors: [{ message: 'unexpected token', line: 3, column: 5 }],
    });
    expect(r.status).toBe('error');
    expect(r.error).toBe('compile failed');
    expect(r.code).toBe('COMPILE');
    expect(r.diagnostics).toEqual([
      { message: 'unexpected token', line: 3, column: 5, severity: 'error' },
    ]);
  });

  test('coerces string diagnostics and warning/info severities', () => {
    const r = mapEngineResponse({
      status: 'error',
      message: 'failed',
      errors: [
        'plain string err',
        { msg: 'warn me', lineno: 2, col: 4, level: 'warn' },
        { error: 'hint me', row: 9, character: 1, severity: 'hint' },
        { message: 'no coords', line: 'x', column: 'y' }, // non-numeric → undefined
        { message: '  ', line: 'x' }, // skipped — empty message
        42, // skipped — non-object
      ],
    });
    expect(r.diagnostics).toEqual([
      { message: 'plain string err', severity: 'error' },
      { message: 'warn me', line: 2, column: 4, severity: 'warning' },
      { message: 'hint me', line: 9, column: 1, severity: 'info' },
      { message: 'no coords', line: undefined, column: undefined, severity: 'error' },
    ]);
  });

  test('infers error from message when status missing; ok:false; status ok', () => {
    expect(mapEngineResponse({ message: 'nope' }).status).toBe('error');
    expect(mapEngineResponse({ ok: false, error: 'x' }).status).toBe('error');
    expect(mapEngineResponse({ status: 'ok', plots: [] }).status).toBe('success');
    expect(mapEngineResponse({ status: 'failed' }).error).toBeTruthy();
    // Non-string error coerced via String(...)
    expect(mapEngineResponse({ status: 'error', error: 404 }).error).toBe('404');
    // No status / no message → success
    expect(mapEngineResponse({ plots: [1] }).status).toBe('success');
  });

  test('never throws on hostile input', () => {
    const r = mapEngineResponse(null);
    expect(r.status).toBe('error');
    expect(r.error).toContain('invalid');
  });

  test('copies logs (capped, truncated) and profile without inventing line stats', () => {
    const long = `L${'y'.repeat(2000)}`;
    const logs: unknown[] = Array.from({ length: 201 }, (_, i) => (i === 0 ? long : `line-${i}`));
    logs[2] = { message: 'obj', n: 1 };
    const profile = { total_ms: 9, lines: [{ line: 3, ms: 1 }] };
    const r = mapEngineResponse(
      {
        status: 'success',
        plots: [1],
        series: { close: [1] },
        events: [],
        drawings: [{ id: 'd' }],
        logs,
        log: ['ignored-because-logs-wins'],
        profile,
        meta: { profile: { other: true } },
      },
      { ms: 12 },
    );
    expect(r.logs).toHaveLength(200);
    expect(typeof (r.logs as unknown[])[0]).toBe('string');
    expect(((r.logs as string[])[0] ?? '').length).toBe(2000);
    expect((r.logs as unknown[])[1]).toBe('line-1');
    expect((r.logs as unknown[])[199]).toBe('line-199');
    expect(r.meta).toEqual({ ms: 12, transport: 'rest', profile });
    expect(r.meta.profile).toBe(profile);
    expect(r.drawings).toEqual([{ id: 'd' }]);
    expect(r.plots).toEqual([1]);
    expect(mapEngineResponse({ status: 'ok' }).logs).toBeUndefined();
    expect(mapEngineResponse({ status: 'ok' }).meta.profile).toBeUndefined();
  });

  test('falls back to log array and meta.profile; ignores non-objects', () => {
    const fromLog = mapEngineResponse({
      status: 'error',
      message: 'bad',
      logs: 'not-an-array',
      log: ['only-log', 5, { text: 'keep' }],
      profile: ['not-plain'],
      meta: { profile: { fn: 'ma' } },
    });
    expect(fromLog.status).toBe('error');
    expect(fromLog.error).toBe('bad');
    expect(fromLog.logs).toEqual(['only-log', 5, { text: 'keep' }]);
    expect(fromLog.meta.profile).toEqual({ fn: 'ma' });

    const noProfile = mapEngineResponse({
      status: 'ok',
      profile: null,
      meta: ['nope'],
      log: 'nope',
    });
    expect(noProfile.logs).toBeUndefined();
    expect(noProfile.meta.profile).toBeUndefined();

    const nestedMiss = mapEngineResponse({
      status: 'ok',
      profile: 'x',
      meta: { profile: 'nope' },
    });
    expect(nestedMiss.meta.profile).toBeUndefined();

    const emptyLogs = mapEngineResponse({ status: 'ok', logs: [], log: ['hidden'] });
    expect(emptyLogs.logs).toEqual([]);
  });

  test('never throws when status getter throws', () => {
    const raw: Record<string, unknown> = {};
    Object.defineProperty(raw, 'status', {
      get() {
        throw new Error('hostile status');
      },
    });
    const r = mapEngineResponse(raw);
    expect(r.status).toBe('error');
    expect(r.error).toContain('hostile');
  });
});

describe('mapToWorkerTimeframe', () => {
  test('passes worker-style intervals and maps Pine aliases', () => {
    expect(mapToWorkerTimeframe('1m')).toBe('1m');
    expect(mapToWorkerTimeframe('1h')).toBe('1h');
    expect(mapToWorkerTimeframe('1d')).toBe('1d');
    expect(mapToWorkerTimeframe('1M')).toBe('1M');
    expect(mapToWorkerTimeframe('1H')).toBe('1h');
    expect(mapToWorkerTimeframe(' 1D ')).toBe('1d');
    expect(mapToWorkerTimeframe('D')).toBe('1d');
    expect(mapToWorkerTimeframe('60')).toBe('1h');
    expect(mapToWorkerTimeframe('15')).toBe('15m');
    expect(mapToWorkerTimeframe('')).toBeUndefined();
    expect(mapToWorkerTimeframe('  ')).toBeUndefined();
    expect(mapToWorkerTimeframe(undefined)).toBeUndefined();
    expect(mapToWorkerTimeframe(5)).toBeUndefined();
    expect(mapToWorkerTimeframe('nope')).toBeUndefined();
  });
});

describe('postEngineRun', () => {
  test('POSTs /run with Bearer and pine-ms bars', async () => {
    let seenUrl = '';
    let seenAuth = '';
    let seenBody: Record<string, unknown> = {};
    const fetchImpl = mockFetch((url, init) => {
      seenUrl = url;
      seenAuth = init?.headers?.Authorization ?? '';
      seenBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      return {
        ok: true,
        status: 200,
        body: JSON.stringify({ status: 'success', plots: [1], series: {} }),
      };
    });

    const result = await postEngineRun({
      endpoint: DEFAULT_ENGINE_ENDPOINT,
      script: '//@version=5\nindicator("t")\nplot(close)',
      bars: SAMPLE_BARS,
      mode: 'auto',
      apiKey: 'pyn_abcdefghijklmnopqrstuvwxyz0123456789',
      fetchImpl,
    });

    expect(seenUrl).toBe('http://127.0.0.1:5002/run');
    expect(seenAuth).toBe('Bearer pyn_abcdefghijklmnopqrstuvwxyz0123456789');
    expect(seenBody.mode).toBe('auto');
    expect(seenBody.timeframe).toBeUndefined();
    expect(seenBody.from_bar).toBeUndefined();
    expect(seenBody.to_bar).toBeUndefined();
    expect(seenBody.symbol).toBe('CHART');
    const data = seenBody.data as Array<{ time: number }>;
    expect(data[0]?.time).toBe(1_700_000_000_000);
    expect(result.status).toBe('success');
    expect(result.plots).toEqual([1]);
    expect(result.meta.transport).toBe('rest');
  });

  test('POSTs inputs when provided; omits empty map', async () => {
    let seenBody: Record<string, unknown> = {};
    const fetchImpl = mockFetch((_url, init) => {
      seenBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      return {
        ok: true,
        status: 200,
        body: JSON.stringify({ status: 'success', plots: [], series: {} }),
      };
    });
    await postEngineRun({
      endpoint: DEFAULT_ENGINE_ENDPOINT,
      script: 'plot(1)',
      bars: SAMPLE_BARS,
      mode: 'auto',
      inputs: { Length: 14 },
      fetchImpl,
    });
    expect(seenBody.inputs).toEqual({ Length: 14 });
    await postEngineRun({
      endpoint: DEFAULT_ENGINE_ENDPOINT,
      script: 'plot(1)',
      bars: SAMPLE_BARS,
      mode: 'auto',
      inputs: {},
      fetchImpl,
    });
    expect(seenBody.inputs).toBeUndefined();
  });

  test('POSTs timeframe + from_bar/to_bar; omits when unset or unknown', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const fetchImpl = mockFetch((_url, init) => {
      bodies.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
      return {
        ok: true,
        status: 200,
        body: JSON.stringify({ status: 'success', plots: [], series: {} }),
      };
    });
    await postEngineRun({
      endpoint: DEFAULT_ENGINE_ENDPOINT,
      script: 'plot(1)',
      bars: SAMPLE_BARS,
      mode: 'auto',
      timeframe: '1H',
      fromBar: 0,
      toBar: 1,
      fetchImpl,
    });
    expect(bodies[0]?.timeframe).toBe('1h');
    expect(bodies[0]?.from_bar).toBe(0);
    expect(bodies[0]?.to_bar).toBe(1);

    await postEngineRun({
      endpoint: DEFAULT_ENGINE_ENDPOINT,
      script: 'plot(1)',
      bars: SAMPLE_BARS,
      mode: 'auto',
      timeframe: 'nope',
      fromBar: Number.NaN,
      toBar: Number.POSITIVE_INFINITY,
      fetchImpl,
    });
    expect(bodies[1]?.timeframe).toBeUndefined();
    expect(bodies[1]?.from_bar).toBeUndefined();
    expect(bodies[1]?.to_bar).toBeUndefined();
  });

  test('retries once without timeframe on Flask UNKNOWN_FIELDS 400', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    let n = 0;
    const fetchImpl = mockFetch((_url, init) => {
      n += 1;
      bodies.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
      if (n === 1) {
        return {
          ok: false,
          status: 400,
          body: JSON.stringify({
            status: 'error',
            code: 'UNKNOWN_FIELDS',
            message: "Unexpected field(s): ['timeframe'].",
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        body: JSON.stringify({ status: 'success', plots: [1], series: {} }),
      };
    });
    const result = await postEngineRun({
      endpoint: DEFAULT_ENGINE_ENDPOINT,
      script: 'plot(1)',
      bars: SAMPLE_BARS,
      mode: 'auto',
      timeframe: '1m',
      fromBar: 0,
      toBar: 1,
      fetchImpl,
    });
    expect(n).toBe(2);
    expect(bodies[0]?.timeframe).toBe('1m');
    expect(bodies[0]?.from_bar).toBe(0);
    expect(bodies[1]?.timeframe).toBeUndefined();
    expect(bodies[1]?.from_bar).toBe(0);
    expect(bodies[1]?.to_bar).toBe(1);
    expect(result.status).toBe('success');
    expect(result.plots).toEqual([1]);
  });

  test('retries UNKNOWN_FIELDS when only parsed.code is set (success-shaped 400)', async () => {
    let n = 0;
    const fetchImpl = mockFetch(() => {
      n += 1;
      if (n === 1) {
        return {
          ok: false,
          status: 400,
          body: JSON.stringify({ code: 'UNKNOWN_FIELDS', plots: [] }),
        };
      }
      return {
        ok: false,
        status: 400,
        body: JSON.stringify({ status: 'error', code: 'UNKNOWN_FIELDS', message: 'still' }),
      };
    });
    const result = await postEngineRun({
      endpoint: DEFAULT_ENGINE_ENDPOINT,
      script: 'plot(1)',
      bars: SAMPLE_BARS,
      mode: 'auto',
      timeframe: '1m',
      fetchImpl,
    });
    expect(n).toBe(2);
    expect(result.status).toBe('error');
    expect(result.code).toBe('UNKNOWN_FIELDS');
  });

  test('does not retry UNKNOWN_FIELDS when timeframe was not sent', async () => {
    let n = 0;
    const fetchImpl = mockFetch(() => {
      n += 1;
      return {
        ok: false,
        status: 400,
        body: JSON.stringify({
          status: 'error',
          code: 'UNKNOWN_FIELDS',
          message: "Unexpected field(s): ['ohlcv'].",
        }),
      };
    });
    const result = await postEngineRun({
      endpoint: DEFAULT_ENGINE_ENDPOINT,
      script: 'plot(1)',
      bars: SAMPLE_BARS,
      mode: 'auto',
      fetchImpl,
    });
    expect(n).toBe(1);
    expect(result.status).toBe('error');
    expect(result.code).toBe('UNKNOWN_FIELDS');
  });

  test('does not retry non-UNKNOWN 400 even with timeframe', async () => {
    let n = 0;
    const fetchImpl = mockFetch(() => {
      n += 1;
      return {
        ok: false,
        status: 400,
        body: JSON.stringify({
          status: 'error',
          code: 'INVALID_FIELD',
          message: 'Field timeframe bad.',
        }),
      };
    });
    const result = await postEngineRun({
      endpoint: DEFAULT_ENGINE_ENDPOINT,
      script: 'plot(1)',
      bars: SAMPLE_BARS,
      mode: 'auto',
      timeframe: '1m',
      fetchImpl,
    });
    expect(n).toBe(1);
    expect(result.code).toBe('INVALID_FIELD');
  });

  test('skips timeframe retry when the signal is already aborted', async () => {
    const ac = new AbortController();
    let n = 0;
    const fetchImpl = mockFetch(() => {
      n += 1;
      ac.abort();
      return {
        ok: false,
        status: 400,
        body: JSON.stringify({
          status: 'error',
          message: 'UNKNOWN_FIELDS: timeframe',
        }),
      };
    });
    const result = await postEngineRun({
      endpoint: DEFAULT_ENGINE_ENDPOINT,
      script: 'plot(1)',
      bars: SAMPLE_BARS,
      mode: 'auto',
      timeframe: '1d',
      signal: ac.signal,
      fetchImpl,
    });
    expect(n).toBe(1);
    expect(result.status).toBe('error');
  });

  test('maps HTTP error body', async () => {
    const fetchImpl = mockFetch(() => ({
      ok: false,
      status: 401,
      body: JSON.stringify({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'invalid key',
      }),
    }));
    const result = await postEngineRun({
      endpoint: 'https://api.example.test',
      script: 'x',
      bars: SAMPLE_BARS,
      mode: 'auto',
      apiKey: 'pyn_abcdefghijklmnopqrstuvwxyz0123456789',
      allowRemote: true,
      fetchImpl,
    });
    expect(result.status).toBe('error');
    expect(result.httpStatus).toBe(401);
    expect(result.error).toContain('invalid key');
  });

  test('remote endpoint without allowRemote is rejected before fetch', async () => {
    let called = false;
    const fetchImpl: FetchLike = async () => {
      called = true;
      return { ok: true, status: 200, text: async () => '{}' };
    };
    const result = await postEngineRun({
      endpoint: 'https://api.example.test',
      script: 'x',
      bars: SAMPLE_BARS,
      mode: 'auto',
      apiKey: 'pyn_abcdefghijklmnopqrstuvwxyz0123456789',
      fetchImpl,
    });
    expect(called).toBe(false);
    expect(result.status).toBe('error');
    expect(result.error).toBe(ENGINE_REMOTE_DENIED);
  });

  test('malformed endpoint URL is rejected by the loopback gate', async () => {
    let called = false;
    const fetchImpl: FetchLike = async () => {
      called = true;
      return { ok: true, status: 200, text: async () => '{}' };
    };
    const result = await postEngineRun({
      endpoint: 'http://[',
      script: 'x',
      bars: [],
      mode: 'auto',
      apiKey: 'pyn_abcdefghijklmnopqrstuvwxyz0123456789',
      fetchImpl,
    });
    expect(called).toBe(false);
    expect(result.status).toBe('error');
    expect(result.error).toBe(ENGINE_REMOTE_DENIED);
  });

  test('applies an explicit timeoutMs to the request signal', async () => {
    let seenSignal: AbortSignal | undefined;
    const fetchImpl = mockFetch((_url, init) => {
      seenSignal = init?.signal;
      return { ok: true, status: 200, body: JSON.stringify({ status: 'success', plots: [], series: {} }) };
    });
    await postEngineRun({
      endpoint: DEFAULT_ENGINE_ENDPOINT,
      script: 'x',
      bars: [],
      mode: 'auto',
      apiKey: 'pyn_abcdefghijklmnopqrstuvwxyz0123456789',
      timeoutMs: 1234,
      fetchImpl,
    });
    expect(seenSignal).toBeDefined();
  });

  test('empty endpoint returns clear error without fetch', async () => {
    let called = false;
    const fetchImpl: FetchLike = async () => {
      called = true;
      return { ok: true, status: 200, text: async () => '{}' };
    };
    const result = await postEngineRun({
      endpoint: '  ',
      script: 'x',
      bars: [],
      mode: 'auto',
      apiKey: 'pyn_abcdefghijklmnopqrstuvwxyz0123456789',
      fetchImpl,
    });
    expect(called).toBe(false);
    expect(result.status).toBe('error');
    expect(result.error).toBe(MISSING_ENDPOINT_ERROR);
  });

  test('absent apiKey still posts with X-AXIS-Client: ide and no Authorization', async () => {
    let called = false;
    let seenHeaders: Record<string, string> | undefined;
    const fetchImpl: FetchLike = async (_url, init) => {
      called = true;
      seenHeaders = init?.headers;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: 'success', plots: [], series: {} }),
      };
    };
    const result = await postEngineRun({
      endpoint: DEFAULT_ENGINE_ENDPOINT,
      script: 'x',
      bars: SAMPLE_BARS,
      mode: 'auto',
      fetchImpl,
    });
    expect(called).toBe(true);
    expect(seenHeaders?.['X-AXIS-Client']).toBe('ide');
    expect(seenHeaders?.Authorization).toBeUndefined();
    expect(seenHeaders?.['X-API-Key']).toBeUndefined();
    expect(result.status).toBe('success');
  });

  test('stamps X-AXIS-Client: ide on the engine POST when a key is present', async () => {
    let seenHeaders: Record<string, string> | undefined;
    const fetchImpl = mockFetch((_url, init) => {
      seenHeaders = init?.headers;
      return { ok: true, status: 200, body: JSON.stringify({ status: 'success', plots: [] }) };
    });
    await postEngineRun({
      endpoint: DEFAULT_ENGINE_ENDPOINT,
      script: 'x',
      bars: SAMPLE_BARS,
      mode: 'auto',
      apiKey: 'pyn_abcdefghijklmnopqrstuvwxyz0123456789',
      fetchImpl,
    });
    expect(seenHeaders?.['X-AXIS-Client']).toBe('ide');
    expect(seenHeaders?.Authorization).toBe(
      'Bearer pyn_abcdefghijklmnopqrstuvwxyz0123456789',
    );
    expect(seenHeaders?.['X-API-Key']).toBe('pyn_abcdefghijklmnopqrstuvwxyz0123456789');
  });

  test('network failure becomes error result', async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error('ECONNREFUSED');
    };
    const result = await postEngineRun({
      endpoint: DEFAULT_ENGINE_ENDPOINT,
      script: 'x',
      bars: SAMPLE_BARS,
      mode: 'auto',
      apiKey: 'pyn_abcdefghijklmnopqrstuvwxyz0123456789',
      fetchImpl,
    });
    expect(result.status).toBe('error');
    expect(result.error).toContain('ECONNREFUSED');
  });

  test('AbortError maps to Aborted', async () => {
    const fetchImpl: FetchLike = async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    };
    const result = await postEngineRun({
      endpoint: DEFAULT_ENGINE_ENDPOINT,
      script: 'x',
      bars: SAMPLE_BARS,
      mode: 'auto',
      apiKey: 'pyn_abcdefghijklmnopqrstuvwxyz0123456789',
      fetchImpl,
    });
    expect(result.error).toBe('Aborted');
  });

  test('non-JSON body becomes INVALID_RESPONSE error', async () => {
    const fetchImpl = mockFetch(() => ({
      ok: false,
      status: 502,
      body: '<html>bad gateway</html>',
    }));
    const result = await postEngineRun({
      endpoint: DEFAULT_ENGINE_ENDPOINT,
      script: 'x',
      bars: SAMPLE_BARS,
      mode: 'auto',
      apiKey: 'pyn_abcdefghijklmnopqrstuvwxyz0123456789',
      fetchImpl,
    });
    expect(result.status).toBe('error');
    expect(result.error).toMatch(/non-JSON|HTTP 502/i);
  });

  test('HTTP error with success-shaped body is still an error', async () => {
    const fetchImpl = mockFetch(() => ({
      ok: false,
      status: 500,
      body: JSON.stringify({ status: 'success', plots: [1] }),
    }));
    const result = await postEngineRun({
      endpoint: DEFAULT_ENGINE_ENDPOINT,
      script: 'x',
      bars: SAMPLE_BARS,
      mode: 'auto',
      apiKey: 'pyn_abcdefghijklmnopqrstuvwxyz0123456789',
      fetchImpl,
    });
    expect(result.status).toBe('error');
    expect(result.error).toContain('HTTP 500');
  });

  test('trims trailing slash on endpoint', async () => {
    let seen = '';
    const fetchImpl = mockFetch((url) => {
      seen = url;
      return { ok: true, status: 200, body: JSON.stringify({ status: 'ok' }) };
    });
    await postEngineRun({
      endpoint: 'http://127.0.0.1:5002/',
      script: 'x',
      bars: [],
      mode: 'compile',
      apiKey: 'pyn_abcdefghijklmnopqrstuvwxyz0123456789',
      fetchImpl,
    });
    expect(seen).toBe('http://127.0.0.1:5002/run');
  });

  test('empty body maps to invalid engine response', async () => {
    const fetchImpl = mockFetch(() => ({ ok: true, status: 200, body: '   ' }));
    const result = await postEngineRun({
      endpoint: DEFAULT_ENGINE_ENDPOINT,
      script: 'x',
      bars: SAMPLE_BARS,
      mode: 'auto',
      apiKey: 'pyn_abcdefghijklmnopqrstuvwxyz0123456789',
      fetchImpl,
    });
    expect(result.status).toBe('error');
  });

  test('HTTP error success-shaped body prefers parsed.message', async () => {
    const fetchImpl = mockFetch(() => ({
      ok: false,
      status: 503,
      body: JSON.stringify({ status: 'ok', message: 'upstream down' }),
    }));
    const result = await postEngineRun({
      endpoint: DEFAULT_ENGINE_ENDPOINT,
      script: 'x',
      bars: SAMPLE_BARS,
      mode: 'auto',
      apiKey: 'pyn_abcdefghijklmnopqrstuvwxyz0123456789',
      fetchImpl,
    });
    expect(result.status).toBe('error');
    expect(result.error).toBe('upstream down');
  });

  test('HTTP error success-shaped body with empty diagnostics uses fallback', async () => {
    const fetchImpl = mockFetch(() => ({
      ok: false,
      status: 502,
      // success status, no message → mapped.diagnostics empty; msg falls to HTTP 502
      body: JSON.stringify({ status: 'success', plots: [] }),
    }));
    const result = await postEngineRun({
      endpoint: DEFAULT_ENGINE_ENDPOINT,
      script: 'x',
      bars: SAMPLE_BARS,
      mode: 'auto',
      apiKey: 'pyn_abcdefghijklmnopqrstuvwxyz0123456789',
      fetchImpl,
    });
    expect(result.status).toBe('error');
    expect(result.diagnostics).toEqual([
      { message: 'HTTP 502', severity: 'error' },
    ]);
  });

  test('HTTP error success-shaped body keeps existing diagnostics', async () => {
    const fetchImpl = mockFetch(() => ({
      ok: false,
      status: 502,
      body: JSON.stringify({
        status: 'success',
        plots: [],
        errors: ['kept'],
      }),
    }));
    const result = await postEngineRun({
      endpoint: DEFAULT_ENGINE_ENDPOINT,
      script: 'x',
      bars: SAMPLE_BARS,
      mode: 'auto',
      apiKey: 'pyn_abcdefghijklmnopqrstuvwxyz0123456789',
      fetchImpl,
    });
    expect(result.status).toBe('error');
    expect(result.diagnostics[0]?.message).toBe('kept');
  });

  test('barsForPine returns [] for non-array', () => {
    expect(barsForPine(null as unknown as OhlcvBar[])).toEqual([]);
  });
});
