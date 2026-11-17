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
 * Provision the managed local engine into an extension-owned venv.
 *
 * Pure orchestration with injected `run` / `exists` / `joinPath` so the unit
 * suite can cover every branch without creating a real venv or touching pip.
 *
 * The host command (`axis.engine.setup`) supplies:
 * - a Python 3.10–3.13 executable (`axis.engine.local.python`, default `python3`)
 * - `context.globalStorageUri/pyne-engine` as the venv root
 * - a `spawn`-backed runner that streams output to the AXIS Run channel
 */

/** Venv directory name under `globalStorageUri`. */
export const LOCAL_ENGINE_VENV_DIR = 'pyne-engine';

/** Distribution that exposes the `pyne-backend` console script. */
export const LOCAL_ENGINE_PACKAGE = 'hoox-pyne-backend';

export type ProvisionCommandResult = {
  code: number;
  stdout?: string;
  stderr?: string;
};

export type ProvisionRun = (
  command: string,
  args: string[],
  options?: { cwd?: string },
) => Promise<ProvisionCommandResult>;

export type ProvisionOptions = {
  /** Python executable used to create the venv. */
  python: string;
  /** Absolute venv directory. */
  venvDir: string;
  /** Override the pip package spec (tests / pinned wheels). */
  packageSpec?: string;
  run: ProvisionRun;
  exists: (path: string) => Promise<boolean>;
  joinPath: (...parts: string[]) => string;
  /** `process.platform` (host) or an explicit value in tests. */
  platform: string;
  log?: (line: string) => void;
  /** Optional progress for the start screen. Never required. */
  onStep?: (step: ProvisionStep, state: 'run' | 'ok' | 'bad', detail?: string) => void;
};

export type ProvisionStep = 'python' | 'venv' | 'pip' | 'verify';

/** Lowest Python the `hoox-pyne[pro]` dependency set supports. */
export const MIN_PYTHON = { major: 3, minor: 10 } as const;

/** Highest tested minor (Numba wheels lag CPython releases). */
export const MAX_PYTHON_MINOR = 13;

export type ProvisionResult =
  | { ok: true; command: string; venvDir: string }
  | { ok: false; step: ProvisionStep; error: string };

/** Path to the `pyne-backend` console script inside a venv. */
export function venvConsoleScript(
  venvDir: string,
  platform: string,
  joinPath: (...parts: string[]) => string,
): string {
  return platform === 'win32'
    ? joinPath(venvDir, 'Scripts', 'pyne-backend.exe')
    : joinPath(venvDir, 'bin', 'pyne-backend');
}

/** Path to `pip` inside a venv. */
export function venvPip(
  venvDir: string,
  platform: string,
  joinPath: (...parts: string[]) => string,
): string {
  return platform === 'win32'
    ? joinPath(venvDir, 'Scripts', 'pip.exe')
    : joinPath(venvDir, 'bin', 'pip');
}

export type PythonVersion = { major: number; minor: number };

/** Parse `Python 3.12.4` from stdout or stderr. Undefined when absent. */
export function parsePythonVersion(raw: string): PythonVersion | undefined {
  const match = /(\d+)\.(\d+)/.exec(String(raw ?? ''));
  if (!match) return undefined;
  return { major: Number(match[1]), minor: Number(match[2]) };
}

/** True for CPython 3.10–3.13 (the Numba-compatible window). */
export function isSupportedPython(version: PythonVersion): boolean {
  return (
    version.major === MIN_PYTHON.major &&
    version.minor >= MIN_PYTHON.minor &&
    version.minor <= MAX_PYTHON_MINOR
  );
}

function failure(
  step: ProvisionStep,
  result: ProvisionCommandResult,
): Extract<ProvisionResult, { ok: false }> {
  const detail = (result.stderr || result.stdout || '').trim();
  return {
    ok: false,
    step,
    error: detail || `command exited with code ${result.code}`,
  };
}

/**
 * Create the venv if needed, install `hoox-pyne-backend`, and verify the
 * console script exists. Never throws.
 */
export async function provisionLocalEngine(opts: ProvisionOptions): Promise<ProvisionResult> {
  const consoleScript = venvConsoleScript(opts.venvDir, opts.platform, opts.joinPath);
  let step: ProvisionStep = 'python';
  try {
    if (await opts.exists(consoleScript)) {
      opts.log?.(`local engine already provisioned: ${consoleScript}`);
      opts.onStep?.('python', 'ok', 'already installed');
      return { ok: true, command: consoleScript, venvDir: opts.venvDir };
    }
    opts.onStep?.('python', 'run');

    const probe = await opts.run(opts.python, ['--version']);
    const version = parsePythonVersion(`${probe.stdout ?? ''} ${probe.stderr ?? ''}`);
    if (!version) {
      opts.onStep?.('python', 'bad', `could not read a Python version from ${opts.python}`);
      return {
        ok: false,
        step: 'python',
        error: `could not read a Python version from ${opts.python}`,
      };
    }
    if (!isSupportedPython(version)) {
      const error = `${opts.python} is Python ${version.major}.${version.minor}; use 3.10–3.13 (set axis.engine.local.python).`;
      opts.onStep?.('python', 'bad', error);
      return {
        ok: false,
        step: 'python',
        error,
      };
    }
    opts.onStep?.('python', 'ok', `${version.major}.${version.minor}`);
    opts.log?.(`using Python ${version.major}.${version.minor} (${opts.python})`);

    opts.log?.(`creating local engine venv: ${opts.venvDir}`);
    step = 'venv';
    opts.onStep?.('venv', 'run');
    const venv = await opts.run(opts.python, ['-m', 'venv', opts.venvDir]);
    if (venv.code !== 0) {
      const failed = failure('venv', venv);
      opts.onStep?.('venv', 'bad', failed.error);
      return failed;
    }
    opts.onStep?.('venv', 'ok');

    step = 'pip';
    opts.onStep?.('pip', 'run');
    const pip = venvPip(opts.venvDir, opts.platform, opts.joinPath);
    // A pip upgrade is best-effort: old pip can still install the wheel.
    const upgraded = await opts.run(pip, ['install', '--upgrade', 'pip']);
    if (upgraded.code !== 0) {
      opts.log?.('pip upgrade failed; continuing with the bundled pip');
    }

    const spec = (opts.packageSpec ?? '').trim() || LOCAL_ENGINE_PACKAGE;
    opts.log?.(`installing ${spec}`);
    const installed = await opts.run(pip, ['install', spec]);
    if (installed.code !== 0) {
      const failed = failure('pip', installed);
      opts.onStep?.('pip', 'bad', failed.error);
      return failed;
    }
    opts.onStep?.('pip', 'ok');

    step = 'verify';
    opts.onStep?.('verify', 'run');
    if (!(await opts.exists(consoleScript))) {
      const error = `installed ${spec} but ${consoleScript} is missing`;
      opts.onStep?.('verify', 'bad', error);
      return {
        ok: false,
        step: 'verify',
        error,
      };
    }
    opts.onStep?.('verify', 'ok');

    opts.log?.(`local engine provisioned: ${consoleScript}`);
    return { ok: true, command: consoleScript, venvDir: opts.venvDir };
  } catch (e) {
    return {
      ok: false,
      step,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
