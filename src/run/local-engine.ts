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
 * Managed local PYNE engine (sidecar) — pure lifecycle logic.
 *
 * The host supplies `spawn`, `findFreePort`, `fetchImpl`, and `sleep`, so this
 * module stays free of `vscode` / `node:child_process` and is unit-testable at
 * the same 100% floor as the rest of `src/run/`.
 *
 * Transport is the existing loopback `/run` HTTP contract: the sidecar binds
 * `127.0.0.1:<ephemeral>`, the host polls `GET /health`, then
 * `RunOrchestrator` talks to it through `postEngineRun` unchanged.
 */

import type { FetchLike } from './engine-http';

/** Host loopback bind address. Never expose the sidecar on 0.0.0.0. */
export const LOCAL_ENGINE_HOST = '127.0.0.1';

/** Readiness probe path on `pyne-backend` (and Pro). */
export const LOCAL_ENGINE_HEALTH_PATH = '/health';

/** Console script shipped by the `hoox-pyne-backend` wheel. */
export const LOCAL_ENGINE_DEFAULT_COMMAND = 'pyne-backend';

/** First import of Numba can be slow; give the sidecar room before failing. */
export const LOCAL_ENGINE_READY_TIMEOUT_MS = 60_000;

/** Health poll cadence while the sidecar boots. */
export const LOCAL_ENGINE_POLL_INTERVAL_MS = 250;

export type LocalEngineStatus =
  | { state: 'stopped' }
  | { state: 'starting'; port?: number }
  | { state: 'ready'; port: number; endpoint: string; pid?: number }
  | { state: 'error'; error: string };

/** Minimal ChildProcess surface (Node `child_process.spawn` satisfies it). */
export type LocalEngineProcess = {
  pid?: number;
  kill(signal?: string | number): boolean;
  once(event: 'exit' | 'error', listener: (...args: unknown[]) => void): unknown;
};

export type LocalEngineSpawnOptions = {
  cwd?: string;
  env: Record<string, string | undefined>;
};

/** Host wrapper should merge `process.env` into `options.env`. */
export type LocalEngineSpawnFn = (
  command: string,
  args: string[],
  options: LocalEngineSpawnOptions,
) => LocalEngineProcess;

export type LocalEngineOptions = {
  /** `pyne-backend`, `python3`, or an absolute interpreter path. */
  command: string;
  /** Args after the command (`['-m', 'backend']` for a checkout). */
  args?: string[];
  /** Working directory (repo checkout) or undefined for an installed wheel. */
  cwd?: string;
  /** Extra environment; `HOST` / `PORT` are added by this module. */
  env?: Record<string, string | undefined>;
  /** Preferred port. `0` / omitted → ask `findFreePort`. */
  port?: number;
  /** Required: pick a free loopback port (host uses `node:net`). */
  findFreePort: () => Promise<number>;
  /** Required: process factory (host uses `node:child_process`). */
  spawn: LocalEngineSpawnFn;
  /** Health probe. Defaults to `globalThis.fetch`. */
  fetchImpl?: FetchLike;
  /** Poll delay. Defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
  readyTimeoutMs?: number;
  pollIntervalMs?: number;
  /** Best-effort line sink for boot/error messages (host → OutputChannel). */
  log?: (line: string) => void;
  /** Fired on every lifecycle transition (host status bar). */
  onStateChange?: (status: LocalEngineStatus) => void;
};

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function defaultFetch(url: string, init?: Parameters<FetchLike>[1]): ReturnType<FetchLike> {
  return globalThis.fetch(url, init);
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

/**
 * Own one `pyne-backend` process.
 *
 * `start()` is idempotent and concurrency-safe: a second call while booting
 * joins the in-flight promise instead of spawning a second server.
 */
export class LocalEngine {
  private state: LocalEngineStatus = { state: 'stopped' };
  private proc: LocalEngineProcess | undefined;
  private starting: Promise<LocalEngineStatus> | undefined;
  private intentionalStop = false;

  constructor(private readonly opts: LocalEngineOptions) {}

  /** Current lifecycle state (never throws). */
  status(): LocalEngineStatus {
    return this.state;
  }

  private setState(status: LocalEngineStatus): void {
    this.state = status;
    try {
      this.opts.onStateChange?.(status);
    } catch {
      // a host callback must never break the lifecycle
    }
  }

  /** Base URL only while ready; callers must not assume it is stable. */
  endpoint(): string | undefined {
    return this.state.state === 'ready' ? this.state.endpoint : undefined;
  }

  /** Boot the sidecar once and wait for `/health`. Never throws. */
  async start(): Promise<LocalEngineStatus> {
    if (this.state.state === 'ready') return this.state;
    if (this.starting) return this.starting;
    const pending = this.doStart().finally(() => {
      this.starting = undefined;
    });
    this.starting = pending;
    return pending;
  }

  /** Terminate the sidecar (best-effort) and reset to `stopped`. */
  stop(): void {
    this.intentionalStop = true;
    this.stopProcess();
    this.setState({ state: 'stopped' });
  }

  private async doStart(): Promise<LocalEngineStatus> {
    this.intentionalStop = false;
    this.stopProcess();
    try {
      const port =
        typeof this.opts.port === 'number' && this.opts.port > 0
          ? this.opts.port
          : await this.opts.findFreePort();
      // `stop()` can land while the port lookup is in flight.
      if (this.intentionalStop) {
        this.setState({ state: 'stopped' });
        return this.state;
      }
      const endpoint = `http://${LOCAL_ENGINE_HOST}:${port}`;
      this.setState({ state: 'starting', port });
      this.opts.log?.(`local engine starting on ${endpoint}`);

      const proc = this.opts.spawn(this.opts.command, this.opts.args ?? [], {
        ...(this.opts.cwd ? { cwd: this.opts.cwd } : {}),
        env: {
          ...this.opts.env,
          HOST: LOCAL_ENGINE_HOST,
          PORT: String(port),
        },
      });
      this.proc = proc;
      this.watchProcess(proc);
      if (this.intentionalStop) {
        this.stopProcess();
        this.setState({ state: 'stopped' });
        return this.state;
      }

      const ready = await this.waitForHealth(endpoint);
      if (this.intentionalStop) {
        this.stopProcess();
        this.setState({ state: 'stopped' });
        return this.state;
      }
      if (!ready) {
        this.stopProcess();
        return this.state;
      }

      this.setState({ state: 'ready', port, endpoint, pid: proc.pid });
      this.opts.log?.(`local engine ready on ${endpoint}`);
      return this.state;
    } catch (e) {
      const error = errorMessage(e);
      this.setState({ state: 'error', error });
      this.stopProcess();
      this.opts.log?.(`local engine failed: ${error}`);
      return this.state;
    }
  }

  private watchProcess(proc: LocalEngineProcess): void {
    proc.once('error', (err) => {
      if (this.intentionalStop) return;
      this.setState({ state: 'error', error: errorMessage(err) });
    });
    proc.once('exit', (code, signal) => {
      if (this.intentionalStop) return;
      const detail = `local engine exited (code=${String(code ?? 'null')} signal=${String(signal ?? 'null')})`;
      this.setState({ state: 'error', error: detail });
      this.opts.log?.(detail);
    });
  }

  private async waitForHealth(endpoint: string): Promise<boolean> {
    const timeout = this.opts.readyTimeoutMs ?? LOCAL_ENGINE_READY_TIMEOUT_MS;
    const interval = this.opts.pollIntervalMs ?? LOCAL_ENGINE_POLL_INTERVAL_MS;
    const attempts = Math.max(1, Math.ceil(timeout / Math.max(1, interval)));
    const fetchImpl = this.opts.fetchImpl ?? defaultFetch;
    const sleep = this.opts.sleep ?? defaultSleep;
    const url = `${endpoint}${LOCAL_ENGINE_HEALTH_PATH}`;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (this.intentionalStop) return false;
      if (this.state.state === 'error') return false;
      if (await this.healthy(url, fetchImpl)) return true;
      if (attempt < attempts - 1) await sleep(interval);
    }

    if (this.intentionalStop) return false;
    this.setState({
      state: 'error',
      error: `local engine did not become ready within ${timeout}ms`,
    });
    return false;
  }

  private async healthy(url: string, fetchImpl: FetchLike): Promise<boolean> {
    try {
      const res = await fetchImpl(url);
      return res.ok;
    } catch {
      return false;
    }
  }

  private stopProcess(): void {
    const proc = this.proc;
    this.proc = undefined;
    if (!proc) return;
    try {
      proc.kill('SIGTERM');
    } catch {
      // already gone
    }
  }
}
