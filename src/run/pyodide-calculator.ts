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

/**
 * Bars-in Pyodide calculator: CDN load → smoke `1+1` → micropip Runtime → /run envelope.
 */

import {
  ALLOW_PYODIDE_SETTING,
  PYODIDE_CDN_INDEX,
  PYODIDE_PINE_WHEEL_NEXT,
  type PyodideRuntimeStatus,
  pyodideRuntimeStatus,
} from '../host/pyodide-profile';
import type { OhlcvBar } from '../host/mock-bars';
import { barsForPine, mapEngineResponse, type EngineRunResult, type RunMode } from './engine-http';
import {
  callPyodideRunScript,
  PYODIDE_RUNTIME_SMOKE,
  pyodideRuntimeSmokeOk,
  type PyodideBridgeRuntime,
} from './pyodide-runtime-bridge';
import { pyodideWheelBannerName } from './pyodide-wheel';

/** Narrow runtime surface used after `loadPyodide`. */
export type PyodideRuntime = PyodideBridgeRuntime;

export type PyodideLoadFn = (indexURL: string) => Promise<PyodideRuntime>;

export type PyodideInstallFn = (py: PyodideRuntime) => Promise<void>;

export type PyodideRunRequest = {
  script: string;
  bars: OhlcvBar[];
  mode?: RunMode;
  signal?: AbortSignal;
  inputs?: Record<string, unknown>;
};

function smokeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  if (value != null && typeof value === 'object' && 'toString' in value) {
    const n = Number(String(value));
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function smokeOnePlusOne(py: PyodideRuntime): Promise<void> {
  let raw: unknown;
  if (typeof py.runPythonAsync === 'function') {
    raw = await py.runPythonAsync('1+1');
  } else {
    raw = py.runPython('1+1');
  }
  if (smokeNumber(raw) !== 2) {
    throw new Error(`Pyodide smoke 1+1 failed (got ${String(raw)})`);
  }
}

function parseRuntimeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return { status: 'error', error: `Pyodide Runtime returned non-JSON: ${raw.slice(0, 200)}`, error_kind: 'runtime' };
  }
}

export type PyodideCalculator = {
  status(allowed: boolean): PyodideRuntimeStatus;
  ensureLoaded(allowed: boolean, signal?: AbortSignal): Promise<PyodideRuntimeStatus>;
  run(allowed: boolean, req: PyodideRunRequest): Promise<EngineRunResult>;
  reset(): void;
};

/** Create a session. `load` is injected (tests mock; host uses CDN). */
export function createPyodideCalculator(opts: {
  load: PyodideLoadFn;
  install?: PyodideInstallFn;
}): PyodideCalculator {
  let wasmLoaded = false;
  let runtimeReady = false;
  let error: string | undefined;
  let booting: Promise<void> | null = null;
  let runtime: PyodideRuntime | null = null;

  const loadState = () => ({ wasmLoaded, runtimeReady, error });

  async function boot(signal?: AbortSignal): Promise<void> {
    if (runtime && wasmLoaded && runtimeReady) return;
    if (signal?.aborted) throw new Error('Aborted');
    if (!runtime || !wasmLoaded) {
      const py = await opts.load(PYODIDE_CDN_INDEX);
      if (signal?.aborted) throw new Error('Aborted');
      await smokeOnePlusOne(py);
      runtime = py;
      wasmLoaded = true;
      error = undefined;
    }
    const py = runtime;
    if (!py) throw new Error('Pyodide runtime missing after load');
    try {
      if (opts.install) await opts.install(py);
      if (signal?.aborted) throw new Error('Aborted');
      const smoke = py.runPython(PYODIDE_RUNTIME_SMOKE);
      if (!pyodideRuntimeSmokeOk(smoke)) {
        throw new Error(PYODIDE_PINE_WHEEL_NEXT);
      }
      runtimeReady = true;
      error = undefined;
    } catch (e) {
      runtimeReady = false;
      error = e instanceof Error ? e.message : String(e);
    }
  }

  async function ensureLoaded(allowed: boolean, signal?: AbortSignal): Promise<PyodideRuntimeStatus> {
    if (!allowed) {
      wasmLoaded = false;
      runtimeReady = false;
      runtime = null;
      error = undefined;
      return pyodideRuntimeStatus(false);
    }
    if (wasmLoaded && runtimeReady && runtime) return pyodideRuntimeStatus(true, loadState());
    try {
      booting ??= boot(signal).finally(() => {
        booting = null;
      });
      await booting;
    } catch (e) {
      wasmLoaded = false;
      runtimeReady = false;
      runtime = null;
      error = e instanceof Error ? e.message : String(e);
    }
    return pyodideRuntimeStatus(true, loadState());
  }

  return {
    status(allowed: boolean): PyodideRuntimeStatus {
      if (!allowed) return pyodideRuntimeStatus(false);
      return pyodideRuntimeStatus(true, loadState());
    },
    ensureLoaded,
    async run(allowed: boolean, req: PyodideRunRequest): Promise<EngineRunResult> {
      const t0 = Date.now();
      if (!allowed) {
        const msg = `${ALLOW_PYODIDE_SETTING} is false`;
        return mapEngineResponse(
          { status: 'error', error: msg, error_kind: 'disabled' },
          { ms: Date.now() - t0 },
        );
      }
      if (req.signal?.aborted) {
        return mapEngineResponse(
          { status: 'error', error: 'Aborted', error_kind: 'aborted' },
          { ms: Date.now() - t0 },
        );
      }
      const st = await ensureLoaded(true, req.signal);
      if (!st.ready || !runtime) {
        return mapEngineResponse(
          { status: 'error', error: st.reason, error_kind: wasmLoaded ? 'wheel' : 'load' },
          { ms: Date.now() - t0 },
        );
      }
      if (req.signal?.aborted) {
        return mapEngineResponse(
          { status: 'error', error: 'Aborted', error_kind: 'aborted' },
          { ms: Date.now() - t0 },
        );
      }
      try {
        const json = callPyodideRunScript(
          runtime,
          req.script,
          barsForPine(req.bars),
          req.mode || 'interpret',
          req.inputs,
        );
        const mapped = mapEngineResponse(parseRuntimeJson(json), { ms: Date.now() - t0 });
        mapped.meta.wheel = pyodideWheelBannerName();
        return mapped;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return mapEngineResponse(
          { status: 'error', error: msg, error_kind: 'runtime' },
          { ms: Date.now() - t0 },
        );
      }
    },
    reset(): void {
      wasmLoaded = false;
      runtimeReady = false;
      error = undefined;
      runtime = null;
      booting = null;
    },
  };
}
