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
  LOCAL_ENGINE_PACKAGE,
  LOCAL_ENGINE_VENV_DIR,
  isSupportedPython,
  parsePythonVersion,
  type ProvisionCommandResult,
  type ProvisionRun,
  provisionLocalEngine,
  venvConsoleScript,
  venvPip,
} from './provision';

const joinPath = (...parts: string[]): string => parts.join('/');
const PY312 = { code: 0, stdout: 'Python 3.12.4' };

function sequenceRun(
  steps: Array<ProvisionCommandResult | Error>,
): { run: ProvisionRun; calls: Array<{ command: string; args: string[] }> } {
  const calls: Array<{ command: string; args: string[] }> = [];
  let index = 0;
  return {
    calls,
    run: async (command, args) => {
      calls.push({ command, args });
      const step = steps[Math.min(index, steps.length - 1)];
      index += 1;
      if (step instanceof Error) throw step;
      return step;
    },
  };
}

function baseOptions(overrides: Partial<Parameters<typeof provisionLocalEngine>[0]> = {}) {
  return {
    python: 'python3',
    venvDir: `/storage/${LOCAL_ENGINE_VENV_DIR}`,
    run: sequenceRun([]).run,
    exists: async () => true,
    joinPath,
    platform: 'linux',
    ...overrides,
  };
}

describe('venv paths', () => {
  test('linux uses bin/', () => {
    expect(venvConsoleScript('/v', 'linux', joinPath)).toBe('/v/bin/pyne-backend');
    expect(venvPip('/v', 'linux', joinPath)).toBe('/v/bin/pip');
  });

  test('win32 uses Scripts/*.exe', () => {
    expect(venvConsoleScript('/v', 'win32', joinPath)).toBe('/v/Scripts/pyne-backend.exe');
    expect(venvPip('/v', 'win32', joinPath)).toBe('/v/Scripts/pip.exe');
  });
});

describe('provisionLocalEngine', () => {
  test('returns the existing console script without running pip', async () => {
    const run = sequenceRun([]);
    const logs: string[] = [];
    const result = await provisionLocalEngine(
      baseOptions({ run: run.run, log: (line) => logs.push(line) }),
    );

    expect(result).toEqual({
      ok: true,
      command: `/storage/${LOCAL_ENGINE_VENV_DIR}/bin/pyne-backend`,
      venvDir: `/storage/${LOCAL_ENGINE_VENV_DIR}`,
    });
    expect(run.calls).toEqual([]);
    expect(logs[0]).toContain('already provisioned');
  });

  test('creates a venv, upgrades pip, and installs the backend', async () => {
    let probes = 0;
    const run = sequenceRun([
      PY312,
      { code: 0 },
      { code: 0 },
      { code: 0, stdout: 'Successfully installed hoox-pyne-backend' },
    ]);
    const result = await provisionLocalEngine(
      baseOptions({
        run: run.run,
        exists: async () => {
          probes += 1;
          return probes > 1;
        },
      }),
    );

    expect(result.ok).toBe(true);
    expect(run.calls).toEqual([
      { command: 'python3', args: ['--version'] },
      { command: 'python3', args: ['-m', 'venv', `/storage/${LOCAL_ENGINE_VENV_DIR}`] },
      { command: `/storage/${LOCAL_ENGINE_VENV_DIR}/bin/pip`, args: ['install', '--upgrade', 'pip'] },
      { command: `/storage/${LOCAL_ENGINE_VENV_DIR}/bin/pip`, args: ['install', LOCAL_ENGINE_PACKAGE] },
    ]);
  });

  test('continues when the pip upgrade fails', async () => {
    let probes = 0;
    const run = sequenceRun([
      PY312,
      { code: 0 },
      { code: 1, stderr: 'old pip' },
      { code: 0 },
    ]);
    const logs: string[] = [];
    const result = await provisionLocalEngine(
      baseOptions({
        run: run.run,
        exists: async () => {
          probes += 1;
          return probes > 1;
        },
        log: (line) => logs.push(line),
      }),
    );

    expect(result.ok).toBe(true);
    expect(logs.some((l) => l.includes('pip upgrade failed'))).toBe(true);
  });

  test('reports a venv failure with stderr detail', async () => {
    const run = sequenceRun([PY312, { code: 2, stderr: 'no ensurepip' }]);
    const result = await provisionLocalEngine(
      baseOptions({ run: run.run, exists: async () => false }),
    );

    expect(result).toEqual({ ok: false, step: 'venv', error: 'no ensurepip' });
  });

  test('reports a venv failure without output as the exit code', async () => {
    const run = sequenceRun([PY312, { code: 7 }]);
    const result = await provisionLocalEngine(
      baseOptions({ run: run.run, exists: async () => false }),
    );

    expect(result).toEqual({ ok: false, step: 'venv', error: 'command exited with code 7' });
  });

  test('reports a pip failure with stdout detail', async () => {
    let probes = 0;
    const run = sequenceRun([PY312, { code: 0 }, { code: 0 }, { code: 1, stdout: 'no network' }]);
    const result = await provisionLocalEngine(
      baseOptions({
        run: run.run,
        exists: async () => {
          probes += 1;
          return probes > 1;
        },
      }),
    );

    expect(result).toEqual({ ok: false, step: 'pip', error: 'no network' });
  });

  test('reports a missing console script after a successful install', async () => {
    const run = sequenceRun([PY312, { code: 0 }, { code: 0 }, { code: 0 }]);
    const result = await provisionLocalEngine(
      baseOptions({ run: run.run, exists: async () => false }),
    );

    expect(result).toEqual({
      ok: false,
      step: 'verify',
      error: `installed ${LOCAL_ENGINE_PACKAGE} but /storage/${LOCAL_ENGINE_VENV_DIR}/bin/pyne-backend is missing`,
    });
  });

  test('honours a packageSpec override', async () => {
    let probes = 0;
    const run = sequenceRun([PY312, { code: 0 }, { code: 0 }, { code: 0 }]);
    await provisionLocalEngine(
      baseOptions({
        run: run.run,
        packageSpec: 'hoox-pyne-backend==1.2.3',
        exists: async () => {
          probes += 1;
          return probes > 1;
        },
      }),
    );

    expect(run.calls[3].args).toEqual(['install', 'hoox-pyne-backend==1.2.3']);
  });

  test('reports a thrown runner error', async () => {
    const run = sequenceRun([new Error('python missing')]);
    const result = await provisionLocalEngine(
      baseOptions({ run: run.run, exists: async () => false }),
    );

    expect(result).toEqual({ ok: false, step: 'python', error: 'python missing' });
  });

  test('stringifies a non-Error throw', async () => {
    const result = await provisionLocalEngine(
      baseOptions({
        run: async () => {
          throw 'boom';
        },
        exists: async () => false,
      }),
    );

    expect(result).toEqual({ ok: false, step: 'python', error: 'boom' });
  });

  test('rejects a Python minor above the Numba window', async () => {
    const run = sequenceRun([{ code: 0, stdout: 'Python 3.14.0' }]);
    const result = await provisionLocalEngine(
      baseOptions({ run: run.run, exists: async () => false }),
    );

    expect(result).toEqual({
      ok: false,
      step: 'python',
      error: 'python3 is Python 3.14; use 3.10–3.13 (set axis.engine.local.python).',
    });
  });

  test('rejects an unparseable Python version', async () => {
    const run = sequenceRun([{ code: 0, stdout: 'not a version' }]);
    const result = await provisionLocalEngine(
      baseOptions({ run: run.run, exists: async () => false }),
    );

    expect(result).toEqual({
      ok: false,
      step: 'python',
      error: 'could not read a Python version from python3',
    });
  });

  test('labels a throw during venv creation as the venv step', async () => {
    const run = sequenceRun([PY312, new Error('venv boom')]);
    const result = await provisionLocalEngine(
      baseOptions({ run: run.run, exists: async () => false }),
    );

    expect(result).toEqual({ ok: false, step: 'venv', error: 'venv boom' });
  });

  test('labels a throw during pip as the pip step', async () => {
    const run = sequenceRun([PY312, { code: 0 }, new Error('pip boom')]);
    const result = await provisionLocalEngine(
      baseOptions({ run: run.run, exists: async () => false }),
    );

    expect(result).toEqual({ ok: false, step: 'pip', error: 'pip boom' });
  });

  test('labels a throw during verification as the verify step', async () => {
    let probes = 0;
    const run = sequenceRun([PY312, { code: 0 }, { code: 0 }, { code: 0 }]);
    const result = await provisionLocalEngine(
      baseOptions({
        run: run.run,
        exists: async () => {
          probes += 1;
          if (probes === 1) return false;
          throw new Error('verify boom');
        },
      }),
    );

    expect(result).toEqual({ ok: false, step: 'verify', error: 'verify boom' });
  });
});

describe('python version gate', () => {
  test('parses stdout and stderr forms', () => {
    expect(parsePythonVersion('Python 3.12.4')).toEqual({ major: 3, minor: 12 });
    expect(parsePythonVersion('Python 3.10')).toEqual({ major: 3, minor: 10 });
    expect(parsePythonVersion('')).toBeUndefined();
    expect(parsePythonVersion('garbage')).toBeUndefined();
  });

  test('accepts 3.10 through 3.13 only', () => {
    expect(isSupportedPython({ major: 3, minor: 10 })).toBe(true);
    expect(isSupportedPython({ major: 3, minor: 13 })).toBe(true);
    expect(isSupportedPython({ major: 3, minor: 9 })).toBe(false);
    expect(isSupportedPython({ major: 3, minor: 14 })).toBe(false);
    expect(isSupportedPython({ major: 2, minor: 7 })).toBe(false);
  });
});
