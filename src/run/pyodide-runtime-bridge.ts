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
 * Micropip-install a trusted wheel and call ``run_script`` without interpolating
 * JSON into Python (null/true would NameError).
 */

export const PYODIDE_RUNTIME_SMOKE = 'callable(run_script)';

export type PyodideBridgeRuntime = {
  runPython: (code: string) => unknown;
  runPythonAsync?: (code: string) => Promise<unknown>;
  loadPackage?: (name: string) => Promise<unknown>;
  pyimport?: (name: string) => {
    install: (url: string, keepGoing?: boolean, deps?: boolean) => Promise<unknown>;
  };
  globals?: {
    set: (key: string, value: unknown) => void;
    delete?: (key: string) => void;
  };
};

export type InstallPynescriptOpts = {
  wheelUrl: string;
  antlrUrl?: string;
  runtimeSource: string;
};

function truthySmoke(value: unknown): boolean {
  return value === true || value === 1 || value === 'True' || value === 'true';
}

/** True after Runtime + run_script are importable. */
export function pyodideRuntimeSmokeOk(value: unknown): boolean {
  return truthySmoke(value);
}

export async function installPynescriptRuntime(
  py: PyodideBridgeRuntime,
  opts: InstallPynescriptOpts,
): Promise<void> {
  const wheel = String(opts.wheelUrl ?? '').trim();
  if (!wheel) throw new Error('Pyodide wheel URL is empty');
  const src = String(opts.runtimeSource ?? '').trim();
  if (!src || src.startsWith('<!')) {
    throw new Error('pynescript_runtime.py is empty or HTML');
  }
  if (typeof py.loadPackage !== 'function' || typeof py.pyimport !== 'function') {
    throw new Error('Pyodide runtime missing loadPackage/pyimport (cannot micropip)');
  }
  await py.loadPackage('micropip');
  const micropip = py.pyimport('micropip');
  if (typeof micropip?.install !== 'function') {
    throw new Error('micropip.install missing');
  }
  const antlr = typeof opts.antlrUrl === 'string' ? opts.antlrUrl.trim() : '';
  if (antlr) {
    await micropip.install(antlr, false, false);
  }
  await micropip.install(wheel, false, false);
  if (typeof py.runPythonAsync === 'function') {
    await py.runPythonAsync(src);
  } else {
    py.runPython(src);
  }
}

/**
 * Invoke in-Python ``run_script`` via globals JSON (same pattern as AXIS PWA).
 * Returns the JSON string Runtime produced.
 */
export function callPyodideRunScript(
  py: PyodideBridgeRuntime,
  script: string,
  bars: unknown,
  mode: string,
  inputs?: Record<string, unknown>,
): string {
  const keys = ['_axis_script_json', '_axis_bars_json', '_axis_mode_json'];
  const g = py.globals;
  if (!g || typeof g.set !== 'function') {
    throw new Error('Pyodide runtime missing globals.set');
  }
  g.set('_axis_script_json', JSON.stringify(script ?? ''));
  g.set('_axis_bars_json', JSON.stringify(bars ?? []));
  g.set('_axis_mode_json', JSON.stringify(mode ?? 'interpret'));
  let call =
    'run_script(__import__("json").loads(_axis_script_json), ' +
    '__import__("json").loads(_axis_bars_json), ' +
    '__import__("json").loads(_axis_mode_json)';
  if (inputs !== undefined) {
    g.set('_axis_inputs_json', JSON.stringify(inputs));
    keys.push('_axis_inputs_json');
    call += ', None, __import__("json").loads(_axis_inputs_json)';
  }
  call += ')';
  try {
    return String(py.runPython(call));
  } finally {
    for (const key of keys) {
      try {
        g.delete?.(key);
      } catch {
        // best-effort
      }
    }
  }
}
