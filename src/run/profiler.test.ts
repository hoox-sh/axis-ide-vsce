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
  PROFILER_DEFAULT,
  PROFILER_SETTING,
  PROFILE_RING_SIZE,
  Profiler,
  type RunProfile,
} from './profiler';

function makeProfile(overrides?: Partial<RunProfile>): RunProfile {
  return {
    engineMs: 0,
    paintMs: 0,
    deltaMs: 0,
    stepMs: 0,
    totalMs: 0,
    runId: 'run-1',
    epoch: 1,
    ts: 0,
    ...overrides,
  };
}

describe('Profiler', () => {
  test('constants', () => {
    expect(PROFILER_SETTING).toBe('axis.profiler.enabled');
    expect(PROFILER_DEFAULT).toBe(true);
    expect(PROFILE_RING_SIZE).toBe(10);
  });

  test('enabled defaults true', () => {
    expect(new Profiler().enabled).toBe(true);
  });

  test('enabled reads the provided reader', () => {
    expect(new Profiler(() => false).enabled).toBe(false);
    expect(new Profiler(() => true).enabled).toBe(true);
  });

  test('setEnabled overrides the reader', () => {
    const p = new Profiler(() => true);
    p.setEnabled(false);
    expect(p.enabled).toBe(false);
    p.setEnabled(true);
    expect(p.enabled).toBe(true);
  });

  test('toggle flips enabled state', async () => {
    const p = new Profiler(() => true);
    expect(p.enabled).toBe(true);
    await p.toggle();
    expect(p.enabled).toBe(false);
    await p.toggle();
    expect(p.enabled).toBe(true);
  });

  test('toggle from a disabled reader', async () => {
    const p = new Profiler(() => false);
    expect(p.enabled).toBe(false);
    await p.toggle();
    expect(p.enabled).toBe(true);
    await p.toggle();
    expect(p.enabled).toBe(false);
  });

  test('startRun/endRun/getLast record a profile', () => {
    const p = new Profiler(() => true);
    p.startRun(7, 'run-7');
    expect(p.getLast()).toBeUndefined();
    const out = p.endRun();
    expect(out).toBeDefined();
    expect(out!.runId).toBe('run-7');
    expect(out!.epoch).toBe(7);
    expect(typeof out!.totalMs).toBe('number');
    expect(out!.totalMs).toBeGreaterThanOrEqual(0);
    expect(p.getLast()!.runId).toBe('run-7');
  });

  test('endRun with no current run returns undefined', () => {
    const p = new Profiler(() => true);
    expect(p.endRun()).toBeUndefined();
    expect(p.getLast()).toBeUndefined();
  });

  test('timeEngine records ms for an async engine POST', async () => {
    const p = new Profiler(() => true);
    p.startRun(1, 'run-1');
    let saw: string | undefined;
    const result = await p.timeEngine(async () => {
      saw = 'engine';
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(saw).toBe('engine');
    const prof = p.endRun()!;
    expect(typeof prof.engineMs).toBe('number');
    expect(prof.engineMs).toBeGreaterThanOrEqual(0);
  });

  test('timeEngine is a no-op passthrough when disabled', async () => {
    const p = new Profiler(() => false);
    p.startRun(1, 'run-1');
    const result = await p.timeEngine(async () => 'ok');
    expect(result).toBe('ok');
    expect(p.endRun()!.engineMs).toBe(0);
  });

  test('timeEngine is a no-op passthrough with no current run', async () => {
    const p = new Profiler(() => true);
    const result = await p.timeEngine(async () => 'ok');
    expect(result).toBe('ok');
  });

  test('timeEngine failure propagates and still records elapsed', async () => {
    const p = new Profiler(() => true);
    p.startRun(1, 'run-1');
    await expect(
      p.timeEngine(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const prof = p.endRun()!;
    expect(typeof prof.engineMs).toBe('number');
    expect(prof.engineMs).toBeGreaterThanOrEqual(0);
  });

  test('timePaint/timeDelta/timeStep record ms', async () => {
    const p = new Profiler(() => true);
    p.startRun(1, 'run-1');
    await p.timePaint(async () => {
      await null;
      return 1;
    });
    await p.timeDelta(async () => 2);
    p.timeStep(() => 3);
    const prof = p.endRun()!;
    expect(typeof prof.paintMs).toBe('number');
    expect(prof.paintMs).toBeGreaterThanOrEqual(0);
    expect(typeof prof.deltaMs).toBe('number');
    expect(prof.deltaMs).toBeGreaterThanOrEqual(0);
    expect(typeof prof.stepMs).toBe('number');
    expect(prof.stepMs).toBeGreaterThanOrEqual(0);
  });

  test('timePaint/timeStep are no-op passthrough when disabled', () => {
    const p = new Profiler(() => false);
    p.startRun(1, 'run-1');
    expect(p.timePaint(() => 'painted')).toBe('painted');
    expect(p.timeStep(() => 'stepped')).toBe('stepped');
    const prof = p.endRun()!;
    expect(prof.paintMs).toBe(0);
    expect(prof.stepMs).toBe(0);
  });

  test('ring buffer keeps last N', () => {
    const p = new Profiler(() => true, 3);
    for (let i = 1; i <= 5; i++) {
      p.startRun(i, `run-${i}`);
      p.endRun();
    }
    const recent = p.recent();
    expect(recent.length).toBe(3);
    expect(recent.map((r) => r.runId)).toEqual(['run-3', 'run-4', 'run-5']);
    expect(p.getLast()!.runId).toBe('run-5');
  });

  test('clear resets ring and current run', () => {
    const p = new Profiler(() => true);
    p.startRun(1, 'run-1');
    p.endRun();
    expect(p.getLast()).toBeDefined();
    p.clear();
    expect(p.getLast()).toBeUndefined();
    expect(p.recent().length).toBe(0);
    p.startRun(2, 'run-2');
    expect(p.endRun()!.runId).toBe('run-2');
  });
});
