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
import {
  callPyodideRunScript,
  installPynescriptRuntime,
  PYODIDE_RUNTIME_SMOKE,
  pyodideRuntimeSmokeOk,
  type PyodideBridgeRuntime,
} from './pyodide-runtime-bridge';

describe('pyodide runtime bridge', () => {
  test('smoke helper accepts true/1/True', () => {
    expect(pyodideRuntimeSmokeOk(true)).toBe(true);
    expect(pyodideRuntimeSmokeOk(1)).toBe(true);
    expect(pyodideRuntimeSmokeOk('True')).toBe(true);
    expect(pyodideRuntimeSmokeOk(false)).toBe(false);
    expect(PYODIDE_RUNTIME_SMOKE).toContain('run_script');
  });

  test('install micropip then runtime source', async () => {
    const installed: string[] = [];
    let ran = '';
    const py: PyodideBridgeRuntime = {
      runPython: (code) => {
        ran = code;
        return true;
      },
      runPythonAsync: async (code) => {
        ran = code;
      },
      loadPackage: async (name) => {
        installed.push(`pkg:${name}`);
      },
      pyimport: () => ({
        install: async (url, keepGoing, deps) => {
          installed.push(`${url}|${String(keepGoing)}|${String(deps)}`);
        },
      }),
    };
    await installPynescriptRuntime(py, {
      wheelUrl: 'file:///w.whl',
      antlrUrl: 'file:///a.whl',
      runtimeSource: 'def run_script():\n  pass\n',
    });
    expect(installed[0]).toBe('pkg:micropip');
    expect(installed.some((s) => s.startsWith('file:///a.whl'))).toBe(true);
    expect(installed.some((s) => s.startsWith('file:///w.whl'))).toBe(true);
    expect(ran).toContain('run_script');
  });

  test('install rejects empty wheel, html runtime, missing micropip', async () => {
    const bare: PyodideBridgeRuntime = { runPython: () => 0 };
    await expect(installPynescriptRuntime(bare, { wheelUrl: '', runtimeSource: 'x' })).rejects.toThrow(
      /empty/i,
    );
    await expect(
      installPynescriptRuntime(bare, { wheelUrl: 'file:///w.whl', runtimeSource: '<!doctype html>' }),
    ).rejects.toThrow(/HTML/i);
    await expect(
      installPynescriptRuntime(bare, { wheelUrl: 'file:///w.whl', runtimeSource: 'x' }),
    ).rejects.toThrow(/loadPackage/);
    const noInstall: PyodideBridgeRuntime = {
      runPython: () => 0,
      loadPackage: async () => {},
      pyimport: () => ({ install: undefined as unknown as (url: string) => Promise<void> }),
    };
    await expect(
      installPynescriptRuntime(noInstall, { wheelUrl: 'file:///w.whl', runtimeSource: 'x' }),
    ).rejects.toThrow(/micropip.install/);
  });

  test('callPyodideRunScript uses globals JSON and optional inputs', () => {
    const keys: string[] = [];
    const deleted: string[] = [];
    let call = '';
    const py: PyodideBridgeRuntime = {
      runPython: (code) => {
        call = code;
        return '{"status":"success"}';
      },
      globals: {
        set: (k) => {
          keys.push(k);
        },
        delete: (k) => {
          deleted.push(k);
        },
      },
    };
    const out = callPyodideRunScript(py, 'plot(close)', [{ close: 1 }], 'interpret', { Length: 2 });
    expect(out).toContain('success');
    expect(call).toContain('run_script');
    expect(keys).toContain('_axis_inputs_json');
    expect(deleted).toContain('_axis_script_json');
  });

  test('callPyodideRunScript requires globals; delete throw is swallowed', () => {
    expect(() =>
      callPyodideRunScript({ runPython: () => '' }, 'x', [], 'interpret'),
    ).toThrow(/globals.set/);
    const py: PyodideBridgeRuntime = {
      runPython: () => '{}',
      globals: {
        set: () => {},
        delete: () => {
          throw new Error('nope');
        },
      },
    };
    expect(callPyodideRunScript(py, 'x', [], 'auto')).toBe('{}');
  });

  test('install uses sync runPython when async missing', async () => {
    let src = '';
    const py: PyodideBridgeRuntime = {
      runPython: (code) => {
        src = code;
      },
      loadPackage: async () => {},
      pyimport: () => ({ install: async () => {} }),
    };
    await installPynescriptRuntime(py, { wheelUrl: 'file:///w.whl', runtimeSource: 'print(1)' });
    expect(src).toBe('print(1)');
  });
});
