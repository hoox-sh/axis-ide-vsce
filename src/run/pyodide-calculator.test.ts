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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ALLOW_PYODIDE_SETTING,
  LOCAL_PYODIDE_VERSION,
  PYODIDE_CDN_INDEX,
  PYODIDE_PINE_WHEEL_NEXT,
} from '../host/pyodide-profile';
import { createPyodideCalculator, type PyodideRuntime } from './pyodide-calculator';
import { PYODIDE_RUNTIME_SMOKE } from './pyodide-runtime-bridge';

const BARS = [{ time: 1_700_000_000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 9 }];

const FIXTURE = readFileSync(
  join(import.meta.dir, '../../fixtures/pyodide-strategy.pine'),
  'utf8',
);

function envelope(extra?: Record<string, unknown>): string {
  return JSON.stringify({
    status: 'success',
    plots: { close: [1.5], sma2: [null] },
    series: { close: [1.5], sma2: [null] },
    plot_meta: {
      close: { kind: 'plot', title: 'close' },
      sma2: { kind: 'plot', title: 'sma2' },
    },
    strategy: { trades: [{ id: 'L', kind: 'entry' }], stats: { trades: 1, entries: 1, exits: 0 } },
    window: { bars: 1, total_bars: 1 },
    script_name: 'axis pyodide fixture',
    script_type: 'strategy',
    ...extra,
  });
}

function mockRuntime(opts?: {
  onePlusOne?: unknown;
  smoke?: unknown;
  runJson?: string;
  throwOnCall?: boolean;
}): PyodideRuntime {
  const store = new Map<string, string>();
  return {
    runPython: (code: string) => {
      if (code === '1+1') return opts?.onePlusOne ?? 2;
      if (code === PYODIDE_RUNTIME_SMOKE) return opts?.smoke ?? true;
      if (code.startsWith('run_script(')) {
        if (opts?.throwOnCall) throw new Error('globals missing');
        return opts?.runJson ?? envelope();
      }
      return code;
    },
    runPythonAsync: async (code: string) => {
      if (code === '1+1') return opts?.onePlusOne ?? 2;
      return code;
    },
    globals: {
      set: (k, v) => {
        store.set(k, String(v));
      },
      delete: (k) => {
        store.delete(k);
      },
    },
  };
}

describe('pyodide calculator session', () => {
  test('flag off never loads and is not ready', async () => {
    let loads = 0;
    const calc = createPyodideCalculator({
      load: async () => {
        loads += 1;
        return mockRuntime();
      },
    });
    const off = calc.status(false);
    expect(off.ready).toBe(false);
    expect(off.reason).toContain(ALLOW_PYODIDE_SETTING);
    const run = await calc.run(false, { script: FIXTURE, bars: BARS });
    expect(run.status).toBe('error');
    expect(loads).toBe(0);
    expect((await calc.ensureLoaded(false)).ready).toBe(false);
  });

  test('flag on is not ready until Wasm + Runtime smoke', async () => {
    const calc = createPyodideCalculator({
      load: async (indexURL) => {
        expect(indexURL).toBe(PYODIDE_CDN_INDEX);
        return mockRuntime();
      },
    });
    const pending = calc.status(true);
    expect(pending.ready).toBe(false);
    expect(pending.reason).toContain(PYODIDE_CDN_INDEX);
    const loaded = await calc.ensureLoaded(true);
    expect(loaded.ready).toBe(true);
    expect(loaded.version).toBe(LOCAL_PYODIDE_VERSION);
    expect(loaded.reason).toMatch(/Runtime ready/i);
    expect(calc.status(true).ready).toBe(true);
  });

  test('run after mock Runtime paints fixture strategy onto /run envelope', async () => {
    const calc = createPyodideCalculator({ load: async () => mockRuntime() });
    const result = await calc.run(true, { script: FIXTURE, bars: BARS, mode: 'interpret' });
    expect(result.status).toBe('success');
    expect(result.series.close).toEqual([1.5]);
    expect(result.plotMeta).toEqual({
      close: { kind: 'plot', title: 'close' },
      sma2: { kind: 'plot', title: 'sma2' },
    });
    expect(result.scriptName).toBe('axis pyodide fixture');
    expect(result.scriptType).toBe('strategy');
    expect(result.meta.wheel).toBe('hoox_pyne-0.6.29');
  });

  test('failed 1+1 keeps ready false; reset retries; wheel smoke fail is wheel kind', async () => {
    let n = 0;
    const calc = createPyodideCalculator({
      load: async () => {
        n += 1;
        if (n === 1) return mockRuntime({ onePlusOne: 3 });
        return mockRuntime();
      },
    });
    const bad = await calc.ensureLoaded(true);
    expect(bad.ready).toBe(false);
    expect(bad.reason).toMatch(/smoke/i);
    calc.reset();
    const ok = await calc.ensureLoaded(true);
    expect(ok.ready).toBe(true);
    expect(n).toBe(2);

    const wheel = createPyodideCalculator({
      load: async () => mockRuntime({ smoke: false }),
    });
    const st = await wheel.ensureLoaded(true);
    expect(st.ready).toBe(false);
    expect(st.reason).toContain(PYODIDE_PINE_WHEEL_NEXT);
    const failedRun = await wheel.run(true, { script: FIXTURE, bars: BARS });
    expect(failedRun.status).toBe('error');
    expect(failedRun.errorKind).toBe('wheel');
  });

  test('load throw is surfaced; abort before/after load is error', async () => {
    const calc = createPyodideCalculator({
      load: async () => {
        throw new Error('cdn down');
      },
    });
    const st = await calc.ensureLoaded(true);
    expect(st.ready).toBe(false);
    expect(st.reason).toContain('cdn down');
    const failedRun = await calc.run(true, { script: FIXTURE, bars: BARS });
    expect(failedRun.status).toBe('error');
    expect(failedRun.errorKind).toBe('load');

    const aborted = new AbortController();
    aborted.abort();
    const r1 = await calc.run(true, { script: FIXTURE, bars: BARS, signal: aborted.signal });
    expect(r1.status).toBe('error');
    expect(String(r1.error)).toMatch(/abort/i);

    const ok = createPyodideCalculator({ load: async () => mockRuntime() });
    await ok.ensureLoaded(true);
    const late = new AbortController();
    late.abort();
    const r2 = await ok.run(true, { script: FIXTURE, bars: BARS, signal: late.signal });
    expect(r2.status).toBe('error');

    const ready = createPyodideCalculator({ load: async () => mockRuntime() });
    await ready.ensureLoaded(true);
    let abortReads = 0;
    const flip = {
      get aborted() {
        abortReads += 1;
        return abortReads > 1;
      },
    } as AbortSignal;
    const r3 = await ready.run(true, { script: FIXTURE, bars: BARS, signal: flip });
    expect(r3.status).toBe('error');
    expect(r3.errorKind).toBe('aborted');
  });

  test('concurrent ensureLoaded shares one boot; abort during load fails closed', async () => {
    let loads = 0;
    const calc = createPyodideCalculator({
      load: async () => {
        loads += 1;
        await Promise.resolve();
        return mockRuntime();
      },
    });
    const [a, b] = await Promise.all([calc.ensureLoaded(true), calc.ensureLoaded(true)]);
    expect(a.ready).toBe(true);
    expect(b.ready).toBe(true);
    expect(loads).toBe(1);

    const ac = new AbortController();
    const calc2 = createPyodideCalculator({
      load: async () => {
        ac.abort();
        return mockRuntime();
      },
    });
    const aborted = await calc2.ensureLoaded(true, ac.signal);
    expect(aborted.ready).toBe(false);
    expect(aborted.reason).toMatch(/abort/i);
  });

  test('sync runPython smoke works when async is absent; BigInt 2 is ok', async () => {
    const calc = createPyodideCalculator({
      load: async () => ({
        runPython: (code: string) => {
          if (code === '1+1') return 2n;
          if (code === PYODIDE_RUNTIME_SMOKE) return true;
          return envelope();
        },
        globals: { set: () => {}, delete: () => {} },
      }),
    });
    expect((await calc.ensureLoaded(true)).ready).toBe(true);
  });

  test('toString-able smoke value 2 is accepted', async () => {
    const calc = createPyodideCalculator({
      load: async () => ({
        runPython: (code: string) => (code === PYODIDE_RUNTIME_SMOKE ? true : envelope()),
        runPythonAsync: async (code: string) =>
          code === '1+1' ? { toString: () => '2' } : code,
        globals: { set: () => {}, delete: () => {} },
      }),
    });
    expect((await calc.ensureLoaded(true)).ready).toBe(true);
  });

  test('numeric string smoke 2 is accepted; other values fail', async () => {
    const ok = createPyodideCalculator({
      load: async () => ({
        runPython: (code: string) => {
          if (code === '1+1') return '2';
          if (code === PYODIDE_RUNTIME_SMOKE) return true;
          return envelope();
        },
        globals: { set: () => {}, delete: () => {} },
      }),
    });
    expect((await ok.ensureLoaded(true)).ready).toBe(true);
    const bad = createPyodideCalculator({
      load: async () => ({
        runPython: () => ({}),
      }),
    });
    expect((await bad.ensureLoaded(true)).ready).toBe(false);
  });

  test('install hook runs; non-JSON Runtime payload maps to error; missing globals is runtime', async () => {
    let installed = false;
    const calc = createPyodideCalculator({
      load: async () => mockRuntime({ runJson: 'not-json' }),
      install: async () => {
        installed = true;
      },
    });
    const r = await calc.run(true, { script: FIXTURE, bars: BARS, inputs: { Length: 2 } });
    expect(installed).toBe(true);
    expect(r.status).toBe('error');

    const missing = createPyodideCalculator({
      load: async () => ({
        runPython: (code: string) => {
          if (code === '1+1') return 2;
          if (code === PYODIDE_RUNTIME_SMOKE) return true;
          throw new Error('no globals');
        },
      }),
    });
    const r2 = await missing.run(true, { script: FIXTURE, bars: BARS });
    expect(r2.status).toBe('error');
    expect(r2.errorKind).toBe('runtime');
  });

  test('abort during install is wheel error; retry after wasm keeps one load', async () => {
    let loads = 0;
    const ac = new AbortController();
    const calc = createPyodideCalculator({
      load: async () => {
        loads += 1;
        return mockRuntime();
      },
      install: async () => {
        ac.abort();
        throw new Error('Aborted');
      },
    });
    const st = await calc.ensureLoaded(true, ac.signal);
    expect(st.ready).toBe(false);
    expect(loads).toBe(1);
    const again = createPyodideCalculator({
      load: async () => {
        loads += 1;
        return mockRuntime();
      },
    });
    await again.ensureLoaded(true);
    expect((await again.ensureLoaded(true)).ready).toBe(true);
  });
});
