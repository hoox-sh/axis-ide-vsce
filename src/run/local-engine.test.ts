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
import type { FetchLike } from './engine-http';
import {
  LOCAL_ENGINE_DEFAULT_COMMAND,
  LOCAL_ENGINE_HEALTH_PATH,
  LOCAL_ENGINE_HOST,
  LocalEngine,
  type LocalEngineOptions,
  type LocalEngineProcess,
  type LocalEngineSpawnOptions,
} from './local-engine';

type Listener = (...args: unknown[]) => void;

function makeProc(pid?: number): {
  proc: LocalEngineProcess;
  kills: string[];
  emit: (event: 'exit' | 'error', ...args: unknown[]) => void;
} {
  const listeners = new Map<string, Listener[]>();
  const kills: string[] = [];
  const proc: LocalEngineProcess = {
    pid,
    kill(signal?: string | number) {
      kills.push(String(signal));
      return true;
    },
    once(event, listener) {
      const list = listeners.get(event) ?? [];
      list.push(listener);
      listeners.set(event, list);
      return proc;
    },
  };
  return {
    proc,
    kills,
    emit(event, ...args) {
      for (const listener of listeners.get(event) ?? []) listener(...args);
    },
  };
}

function okFetch(ok = true): FetchLike {
  return async () => ({ ok, status: ok ? 200 : 503, text: async () => '' });
}

function sequenceFetch(steps: Array<boolean | Error>): { fetch: FetchLike; calls: string[] } {
  const calls: string[] = [];
  let index = 0;
  return {
    calls,
    fetch: async (url) => {
      calls.push(url);
      const step = steps[Math.min(index, steps.length - 1)];
      index += 1;
      if (step instanceof Error) throw step;
      return { ok: step, status: step ? 200 : 503, text: async () => '' };
    },
  };
}

const sleep = async (): Promise<void> => {};

function baseOptions(overrides: Partial<LocalEngineOptions> = {}) {
  const { proc, kills, emit } = makeProc(4242);
  const spawns: Array<{ command: string; args: string[]; options: LocalEngineSpawnOptions }> = [];
  return {
    proc,
    kills,
    emit,
    spawns,
    options: {
      command: LOCAL_ENGINE_DEFAULT_COMMAND,
      findFreePort: async () => 51234,
      spawn: (command: string, args: string[], options: LocalEngineSpawnOptions) => {
        spawns.push({ command, args, options });
        return proc;
      },
      fetchImpl: okFetch(),
      sleep,
      readyTimeoutMs: 1000,
      pollIntervalMs: 10,
      ...overrides,
    },
  };
}

describe('LocalEngine', () => {
  test('boots on an ephemeral loopback port and reports ready', async () => {
    const { options, spawns, kills } = baseOptions();
    const logs: string[] = [];
    options.log = (line: string) => logs.push(line);
    const engine = new LocalEngine(options);

    expect(engine.endpoint()).toBeUndefined();
    const status = await engine.start();

    expect(status).toEqual({
      state: 'ready',
      port: 51234,
      endpoint: `http://${LOCAL_ENGINE_HOST}:51234`,
      pid: 4242,
    });
    expect(engine.endpoint()).toBe(`http://${LOCAL_ENGINE_HOST}:51234`);
    expect(engine.status().state).toBe('ready');
    expect(spawns).toHaveLength(1);
    expect(spawns[0].command).toBe(LOCAL_ENGINE_DEFAULT_COMMAND);
    expect(spawns[0].args).toEqual([]);
    expect(spawns[0].options.env).toEqual({
      HOST: LOCAL_ENGINE_HOST,
      PORT: '51234',
    });
    expect(spawns[0].options.cwd).toBeUndefined();
    expect(kills).toEqual([]);
    expect(logs).toEqual([
      `local engine starting on http://${LOCAL_ENGINE_HOST}:51234`,
      `local engine ready on http://${LOCAL_ENGINE_HOST}:51234`,
    ]);
  });

  test('honours a configured port and passes args, cwd, and env', async () => {
    const { options, spawns } = baseOptions({
      command: 'python3',
      args: ['-m', 'backend'],
      cwd: '/repo',
      env: { PYNE_DEBUG: '1' },
      port: 6001,
      findFreePort: async () => {
        throw new Error('should not be called');
      },
    });
    const engine = new LocalEngine(options);

    const status = await engine.start();

    expect(status.state).toBe('ready');
    expect(spawns[0]).toEqual({
      command: 'python3',
      args: ['-m', 'backend'],
      options: {
        cwd: '/repo',
        env: { PYNE_DEBUG: '1', HOST: LOCAL_ENGINE_HOST, PORT: '6001' },
      },
    });
  });

  test('retries /health until the sidecar answers', async () => {
    const { options } = baseOptions({
      fetchImpl: sequenceFetch([new Error('ECONNREFUSED'), false, true]).fetch,
    });
    const engine = new LocalEngine(options);

    const status = await engine.start();

    expect(status.state).toBe('ready');
  });

  test('times out and kills the sidecar when /health never answers', async () => {
    const { options, kills } = baseOptions({
      fetchImpl: okFetch(false),
      readyTimeoutMs: 30,
      pollIntervalMs: 10,
    });
    const engine = new LocalEngine(options);

    const status = await engine.start();

    expect(status).toEqual({
      state: 'error',
      error: 'local engine did not become ready within 30ms',
    });
    expect(kills).toEqual(['SIGTERM']);
    expect(engine.endpoint()).toBeUndefined();
  });

  test('reports a spawn failure without throwing', async () => {
    const { options } = baseOptions({
      spawn: () => {
        throw new Error('ENOENT pyne-backend');
      },
    });
    const engine = new LocalEngine(options);

    const status = await engine.start();

    expect(status).toEqual({ state: 'error', error: 'ENOENT pyne-backend' });
  });

  test('reports a port lookup failure', async () => {
    const { options } = baseOptions({
      findFreePort: async () => {
        throw 'no ports';
      },
    });
    const engine = new LocalEngine(options);

    const status = await engine.start();

    expect(status).toEqual({ state: 'error', error: 'no ports' });
  });

  test('stops waiting when the child emits error', async () => {
    const { options, emit, kills } = baseOptions({
      fetchImpl: async () => {
        emit('error', new Error('spawn EACCES'));
        return { ok: false, status: 503, text: async () => '' };
      },
    });
    const engine = new LocalEngine(options);

    const status = await engine.start();

    expect(status).toEqual({ state: 'error', error: 'spawn EACCES' });
    expect(kills).toEqual(['SIGTERM']);
  });

  test('stops waiting when the child exits early', async () => {
    const { options, emit, kills } = baseOptions({
      fetchImpl: async () => {
        emit('exit', 1, null);
        return { ok: false, status: 503, text: async () => '' };
      },
    });
    const engine = new LocalEngine(options);

    const status = await engine.start();

    expect(status).toEqual({
      state: 'error',
      error: 'local engine exited (code=1 signal=null)',
    });
    expect(kills).toEqual(['SIGTERM']);
  });

  test('stop() kills the child and ignores its later exit event', async () => {
    const { options, emit, kills } = baseOptions();
    const engine = new LocalEngine(options);
    await engine.start();

    engine.stop();
    emit('exit', 0, 'SIGTERM');

    expect(engine.status()).toEqual({ state: 'stopped' });
    expect(kills).toEqual(['SIGTERM']);
  });

  test('stop() is safe before start and when kill throws', async () => {
    const { options } = baseOptions();
    const engine = new LocalEngine(options);
    engine.stop();
    expect(engine.status()).toEqual({ state: 'stopped' });

    const { options: killOptions, proc } = baseOptions();
    const started = new LocalEngine(killOptions);
    await started.start();
    proc.kill = () => {
      throw new Error('gone');
    };
    started.stop();
    expect(started.status()).toEqual({ state: 'stopped' });
  });

  test('start() is idempotent while booting and after ready', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { options, spawns } = baseOptions({
      fetchImpl: async () => {
        await gate;
        return { ok: true, status: 200, text: async () => '' };
      },
    });
    const engine = new LocalEngine(options);

    const first = engine.start();
    const second = engine.start();
    release?.();
    const [a, b] = await Promise.all([first, second]);
    const third = await engine.start();

    expect(a.state).toBe('ready');
    expect(b).toEqual(a);
    expect(third).toEqual(a);
    expect(spawns).toHaveLength(1);
  });

  test('stop() during port lookup cancels before spawn', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const spawns: string[] = [];
    const engine = new LocalEngine({
      command: LOCAL_ENGINE_DEFAULT_COMMAND,
      findFreePort: async () => {
        await gate;
        return 1234;
      },
      spawn: (command) => {
        spawns.push(command);
        return makeProc(1).proc;
      },
      fetchImpl: okFetch(),
      sleep,
    });

    const pending = engine.start();
    engine.stop();
    release();
    const status = await pending;

    expect(status).toEqual({ state: 'stopped' });
    expect(spawns).toEqual([]);
  });

  test('stop() during spawn cancels before the health probe', async () => {
    const { proc, kills } = makeProc(9);
    let engine: LocalEngine | undefined;
    const { options } = baseOptions();
    options.spawn = () => {
      engine?.stop();
      return proc;
    };
    engine = new LocalEngine(options);

    const status = await engine.start();

    expect(status).toEqual({ state: 'stopped' });
    expect(kills).toEqual(['SIGTERM']);
  });

  test('stop() while /health is pending kills the child and stays stopped', async () => {
    const { options, kills } = baseOptions();
    let engine: LocalEngine | undefined;
    options.fetchImpl = async () => {
      engine?.stop();
      return { ok: false, status: 503, text: async () => '' };
    };
    engine = new LocalEngine(options);

    const status = await engine.start();

    expect(status).toEqual({ state: 'stopped' });
    expect(kills).toEqual(['SIGTERM']);
  });

  test('emits lifecycle transitions', async () => {
    const states: string[] = [];
    const { options } = baseOptions({
      onStateChange: (status) => states.push(status.state),
    });
    const engine = new LocalEngine(options);

    await engine.start();
    engine.stop();

    expect(states).toEqual(['starting', 'ready', 'stopped']);
  });

  test('a throwing state callback does not break boot', async () => {
    const { options } = baseOptions({
      onStateChange: () => {
        throw new Error('host callback');
      },
    });
    const engine = new LocalEngine(options);

    const status = await engine.start();

    expect(status.state).toBe('ready');
  });

  test('restarts after stop()', async () => {
    const { options, spawns } = baseOptions();
    const engine = new LocalEngine(options);
    await engine.start();
    engine.stop();
    const status = await engine.start();

    expect(status.state).toBe('ready');
    expect(spawns).toHaveLength(2);
  });

  test('defaults fetch and sleep when not injected', async () => {
    const original = globalThis.fetch;
    const urls: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request) => {
      urls.push(String(url));
      return { ok: true, status: 200, text: async () => '' } as Response;
    }) as typeof fetch;
    try {
      const { proc } = makeProc(undefined);
      const engine = new LocalEngine({
        command: LOCAL_ENGINE_DEFAULT_COMMAND,
        findFreePort: async () => 7000,
        spawn: () => proc,
        readyTimeoutMs: 2,
        pollIntervalMs: 0,
      });

      const status = await engine.start();

      expect(status).toEqual({
        state: 'ready',
        port: 7000,
        endpoint: `http://${LOCAL_ENGINE_HOST}:7000`,
        pid: undefined,
      });
      expect(urls).toEqual([`http://${LOCAL_ENGINE_HOST}:7000${LOCAL_ENGINE_HEALTH_PATH}`]);
    } finally {
      globalThis.fetch = original;
    }
  });

  test('defaults to a real timer between probes', async () => {
    const original = globalThis.fetch;
    let probes = 0;
    globalThis.fetch = (async () => {
      probes += 1;
      return { ok: probes > 1, status: probes > 1 ? 200 : 503, text: async () => '' } as Response;
    }) as typeof fetch;
    try {
      const { options } = baseOptions({
        fetchImpl: undefined,
        sleep: undefined,
        readyTimeoutMs: 5,
        pollIntervalMs: 1,
      });
      const engine = new LocalEngine(options);

      const status = await engine.start();

      expect(status.state).toBe('ready');
      expect(probes).toBe(2);
    } finally {
      globalThis.fetch = original;
    }
  });

  test('waits one poll before the first successful probe', async () => {
    const sleeps: number[] = [];
    const { options } = baseOptions({
      fetchImpl: sequenceFetch([false, true]).fetch,
      sleep: async (ms: number) => {
        sleeps.push(ms);
      },
      readyTimeoutMs: 1000,
      pollIntervalMs: 25,
    });
    const engine = new LocalEngine(options);

    await engine.start();

    expect(sleeps).toEqual([25]);
  });

  test('omits log output when no sink is supplied', async () => {
    const { options } = baseOptions();
    const engine = new LocalEngine(options);
    const status = await engine.start();
    expect(status.state).toBe('ready');
  });
});
