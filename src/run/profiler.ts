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
 * Inline run profiler.
 *
 * Times AXIS run stages — engine POST, chart paint, delta apply, bar step — and
 * keeps a small ring buffer of the last N completed runs so the statusbar popup
 * can surface recent timings. Host-side only; never touches secrets.
 *
 * The module is vscode-free so it stays unit-testable under `bun test`: the
 * caller supplies an `enabledReader` (default `true`, matching the
 * `axis.profiler.enabled` setting default). `extension.ts` wires a reader that
 * reads `axis.profiler.enabled` from workspace configuration. `toggle()` flips
 * the effective enabled state at runtime.
 */

export const PROFILER_SETTING = 'axis.profiler.enabled';
export const PROFILER_DEFAULT = true;
export const PROFILE_RING_SIZE = 10;

export interface RunProfile {
  engineMs: number;
  paintMs: number;
  deltaMs: number;
  stepMs: number;
  totalMs: number;
  runId: string;
  epoch: number;
  ts: number;
}

export type EnabledReader = () => boolean;

function defaultEnabledReader(): boolean {
  return PROFILER_DEFAULT;
}

function nowMs(): number {
  return Date.now();
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

/**
 * Time one run stage, recording elapsed ms into `current[field]`. Records on
 * success or failure. Disabled / no current run = passthrough, never throws on
 * its own (fn's own errors still propagate).
 */
type StageField = 'engineMs' | 'paintMs' | 'deltaMs' | 'stepMs' | 'totalMs';

function timeStage<T>(
  current: RunProfile | undefined,
  field: StageField,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  if (!current) return fn();
  // `const` preserves the narrowed `RunProfile` type inside the closures below.
  const cur = current;
  const start = nowMs();
  const out = fn();
  if (isPromiseLike(out)) {
    return (out as Promise<T>).then(
      (value: T): T => {
        cur[field] += nowMs() - start;
        return value;
      },
      (error: unknown): never => {
        cur[field] += nowMs() - start;
        throw error;
      },
    );
  }
  cur[field] += nowMs() - start;
  return out;
}

export class Profiler {
  private readonly reader: EnabledReader;
  private readonly size: number;
  private readonly ring: RunProfile[] = [];
  private current: RunProfile | undefined;
  private started = 0;
  private forced: boolean | undefined = undefined;

  constructor(reader: EnabledReader = defaultEnabledReader, size = PROFILE_RING_SIZE) {
    this.reader = reader;
    this.size = Math.max(1, size);
  }

  /** Whether profiling is active. Honors `axis.profiler.enabled` (default true) unless `setEnabled`/`toggle` overrode it. */
  get enabled(): boolean {
    if (this.forced !== undefined) return this.forced;
    return this.reader();
  }

  /** Force profiling on/off at runtime (used by `axis.profiler.toggle`). */
  setEnabled(enabled: boolean): void {
    this.forced = enabled;
  }

  /** Flip the effective enabled state at runtime. */
  async toggle(): Promise<void> {
    this.setEnabled(!this.enabled);
  }

  /** Begin timing a run. Resets stage counters; call `endRun` to finalize. */
  startRun(epoch: number, runId: string): void {
    this.current = {
      engineMs: 0,
      paintMs: 0,
      deltaMs: 0,
      stepMs: 0,
      totalMs: 0,
      runId,
      epoch,
      ts: nowMs(),
    };
    this.started = nowMs();
  }

  /** Finalize the current run (wall-clock total), store it in the ring, return it. */
  endRun(): RunProfile | undefined {
    const profile = this.current;
    if (!profile) return undefined;
    profile.totalMs = nowMs() - this.started;
    this.ring.push(profile);
    if (this.ring.length > this.size) {
      this.ring.shift();
    }
    this.current = undefined;
    return profile;
  }

  /** Last completed run's profile, or undefined. */
  getLast(): RunProfile | undefined {
    return this.ring[this.ring.length - 1];
  }

  /** Recent completed runs, most recent last. */
  recent(): readonly RunProfile[] {
    return this.ring;
  }

  /** Clear the ring and any in-flight run. */
  clear(): void {
    this.ring.length = 0;
    this.current = undefined;
  }

  /** Time the engine POST stage. Disabled / no run = passthrough, never throws on its own. */
  timeEngine<T>(fn: () => T | Promise<T>): T | Promise<T> {
    if (!this.enabled) return fn();
    const current = this.current;
    return timeStage(current, 'engineMs', fn);
  }

  /** Time the chart paint stage (chart.full post). */
  timePaint<T>(fn: () => T | Promise<T>): T | Promise<T> {
    if (!this.enabled) return fn();
    const current = this.current;
    return timeStage(current, 'paintMs', fn);
  }

  /** Time the chart delta apply stage. */
  timeDelta<T>(fn: () => T | Promise<T>): T | Promise<T> {
    if (!this.enabled) return fn();
    const current = this.current;
    return timeStage(current, 'deltaMs', fn);
  }

  /** Time the bar step / continue stage. */
  timeStep<T>(fn: () => T | Promise<T>): T | Promise<T> {
    if (!this.enabled) return fn();
    const current = this.current;
    return timeStage(current, 'stepMs', fn);
  }
}
