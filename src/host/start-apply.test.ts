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
  HOSTED_UNREACHABLE_MESSAGE,
  LOCAL_FAILED_MESSAGE,
  LOCAL_UNAVAILABLE_MESSAGE,
  READY_MESSAGE,
  SETUP_FAILED_MESSAGE,
  type StartApplyDeps,
  probeHost,
  runStartChoice,
} from './start-apply';
import { HOSTED_ENGINE_URL } from './start-run';

function deps(overrides: Partial<StartApplyDeps> = {}): StartApplyDeps {
  return {
    update: async () => {},
    probe: async () => undefined,
    pyodideBundled: false,
    ...overrides,
  };
}

describe('probeHost', () => {
  test('returns undefined when the host answers', async () => {
    const error = await probeHost('https://pynescript.online', async () => ({ ok: true }), 50);
    expect(error).toBeUndefined();
  });

  test('returns an Error message and a thrown string', async () => {
    const fromError = await probeHost(
      'https://pynescript.online',
      async () => {
        throw new Error('offline');
      },
      50,
    );
    const fromString = await probeHost(
      'https://pynescript.online',
      async () => {
        throw 'down';
      },
      50,
    );
    expect(fromError).toBe('offline');
    expect(fromString).toBe('down');
  });

  test('aborts a fetch that never finishes', async () => {
    const error = await probeHost(
      'https://pynescript.online',
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        }),
      20,
    );
    expect(error).toBe('aborted');
  });
});

describe('runStartChoice', () => {
  test('hosted saves the server endpoint and finishes Ready', async () => {
    const writes: string[] = [];
    const view = await runStartChoice(
      'hosted',
      deps({
        update: async (section, key, value) => {
          writes.push(`${section}.${key}=${String(value)}`);
        },
      }),
      () => {},
    );
    expect(writes).toEqual([
      'axis.engine.mode=server',
      `axis.engine.endpoint=${HOSTED_ENGINE_URL}`,
      'pynescript.backend.useHosted=true',
      `pynescript.backend.hostedUrl=${HOSTED_ENGINE_URL}`,
    ]);
    expect(view.phase).toBe('done');
    expect(view.message).toBe(READY_MESSAGE);
    expect(READY_MESSAGE).toMatch(/Sample candles/i);
    expect(READY_MESSAGE).toMatch(/Pick Data/i);
    expect(READY_MESSAGE).toMatch(/CSV|examples/i);
    expect(READY_MESSAGE).toMatch(/Ctrl\+Enter/);
    expect(view.steps.every((step) => step.state === 'ok')).toBe(true);
  });

  test('a failed PYNE write does not show Ready', async () => {
    const view = await runStartChoice(
      'hosted',
      deps({
        update: async (section) => {
          if (section === 'pynescript') throw 'no pyne';
        },
      }),
      () => {},
    );
    expect(view.phase).toBe('error');
    expect(view.message).toBe(SETUP_FAILED_MESSAGE);
    expect(view.message).not.toBe(READY_MESSAGE);
    expect(view.steps.find((step) => step.id === 'pyne')?.state).toBe('bad');
    expect(view.steps.find((step) => step.id === 'pyne')?.detail).toBe('no pyne');
    expect(view.steps.find((step) => step.id === 'reach')?.state).toBe('ok');
  });

  test('an unreachable host keeps the saved choice and does not show Ready', async () => {
    const writes: string[] = [];
    const view = await runStartChoice(
      'hosted',
      deps({
        update: async (section, key, value) => {
          writes.push(`${section}.${key}=${String(value)}`);
        },
        probe: async () => 'offline',
      }),
      () => {},
    );
    expect(writes[0]).toBe('axis.engine.mode=server');
    expect(writes[1]).toBe(`axis.engine.endpoint=${HOSTED_ENGINE_URL}`);
    expect(view.phase).toBe('error');
    expect(view.message).toBe(HOSTED_UNREACHABLE_MESSAGE);
    expect(view.steps.find((step) => step.id === 'reach')?.state).toBe('bad');
  });

  test('a thrown settings write is the panel error', async () => {
    const view = await runStartChoice(
      'hosted',
      deps({
        update: async () => {
          throw new Error('disk full');
        },
      }),
      () => {},
    );
    expect(view.phase).toBe('error');
    expect(view.message).toBe('disk full');
  });

  test('the editor card selects pyodide and skips a missing bundle', async () => {
    const writes: string[] = [];
    const skipped = await runStartChoice(
      'editor',
      deps({
        update: async (section, key, value) => {
          writes.push(`${section}.${key}=${String(value)}`);
        },
        pyodideBundled: false,
      }),
      () => {},
    );
    expect(writes).toEqual(['axis.engine.allowPyodide=true', 'axis.engine.mode=pyodide']);
    expect(skipped.phase).toBe('done');
    expect(skipped.steps.find((step) => step.id === 'bundle')?.state).toBe('skip');
    const bundled = await runStartChoice('editor', deps({ pyodideBundled: true }), () => {});
    expect(bundled.steps.find((step) => step.id === 'bundle')?.state).toBe('ok');
    expect(bundled.steps.find((step) => step.id === 'bundle')?.detail).toBe(
      'Pyodide is in this extension.',
    );
  });

  test('local failure and a missing installer do not show Ready', async () => {
    const failed = await runStartChoice(
      'local',
      deps({
        setupLocal: async (report) => {
          report('python', 'bad', 'missing');
          return false;
        },
      }),
      () => {},
    );
    expect(failed.phase).toBe('error');
    expect(failed.message).toBe(LOCAL_FAILED_MESSAGE);
    expect(failed.steps.find((step) => step.id === 'python')?.state).toBe('bad');

    const missing = await runStartChoice('local', deps(), () => {});
    expect(missing.phase).toBe('error');
    expect(missing.message).toBe(LOCAL_UNAVAILABLE_MESSAGE);
  });

  test('local success skips steps the installer did not run', async () => {
    const view = await runStartChoice(
      'local',
      deps({
        setupLocal: async (report) => {
          report('python', 'ok', '3.12');
          report('save', 'ok');
          return true;
        },
      }),
      () => {},
    );
    expect(view.phase).toBe('done');
    expect(view.message).toBe(READY_MESSAGE);
    expect(view.steps.find((step) => step.id === 'python')?.state).toBe('ok');
    expect(view.steps.find((step) => step.id === 'pip')?.state).toBe('skip');
  });
});
