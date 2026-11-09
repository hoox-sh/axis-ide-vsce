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
  AXIS_BAR_DAP_TYPE,
  AxisBarDebugSession,
  formatPineValue,
  type DapEvent,
  type DapResponse,
} from './bar-adapter';

const BARS = [
  { time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 9 },
  { time: 2, open: 1.5, high: 2.5, low: 1, close: null, volume: 8 },
  { time: 3, open: 2, high: 3, low: 1.5, close: 2.2, volume: 7 },
];

function req(command: string, seq = 1, args?: unknown) {
  return { seq, type: 'request' as const, command, arguments: args };
}

function responses(msgs: ReturnType<AxisBarDebugSession['handle']>): DapResponse[] {
  return msgs.filter((m): m is DapResponse => m.type === 'response');
}

function events(msgs: ReturnType<AxisBarDebugSession['handle']>): DapEvent[] {
  return msgs.filter((m): m is DapEvent => m.type === 'event');
}

function firstResponse(msgs: ReturnType<AxisBarDebugSession['handle']>): DapResponse {
  const list = responses(msgs);
  const first = list[0];
  if (!first) throw new Error('expected a DAP response');
  return first;
}

describe('AXIS bar DAP (type axis-bar, not pyne)', () => {
  test('DAP type is axis-bar', () => {
    expect(AXIS_BAR_DAP_TYPE).toBe('axis-bar');
    expect(AXIS_BAR_DAP_TYPE).not.toBe('pyne');
  });

  test('formatPineValue maps null/NaN to na', () => {
    expect(formatPineValue(null)).toBe('na');
    expect(formatPineValue(undefined)).toBe('na');
    expect(formatPineValue(Number.NaN)).toBe('na');
    expect(formatPineValue(1.5)).toBe('1.5');
    expect(formatPineValue('x')).toBe('x');
  });

  test('initialize advertises stepBack; launch stops on entry and syncs cursor', () => {
    const cursors: number[] = [];
    const s = new AxisBarDebugSession((i) => {
      cursors.push(i);
    });
    const init = s.handle(req('initialize'));
    const initRes = firstResponse(init);
    expect(initRes.success).toBe(true);
    expect((initRes.body as { supportsStepBack?: boolean }).supportsStepBack).toBe(true);
    expect(events(init).some((e) => e.event === 'initialized')).toBe(true);

    const launch = s.handle(
      req('launch', 2, { bars: BARS, series: { close: [1.5, null, 2.2] }, stopOnEntry: true }),
    );
    expect(s.currentBar).toBe(0);
    expect(events(launch).some((e) => e.event === 'stopped')).toBe(true);
    expect(cursors).toEqual([0]);
  });

  test('next/stepBack move one bar; variables show na for null close', () => {
    const s = new AxisBarDebugSession();
    s.handle(req('launch', 1, { bars: BARS, series: { sma: [null, 1.5, 1.85] } }));
    s.handle(req('next', 2));
    expect(s.currentBar).toBe(1);
    const vars = s.handle(req('variables', 3, { variablesReference: 1000 }));
    const names = (firstResponse(vars).body as { variables: Array<{ name: string; value: string }> }).variables;
    const close = names.find((v) => v.name === 'close');
    expect(close?.value).toBe('na');
    const series = s.handle(req('variables', 4, { variablesReference: 2000 }));
    const sma = (
      firstResponse(series).body as { variables: Array<{ name: string; value: string }> }
    ).variables.find((v) => v.name === 'sma');
    expect(sma?.value).toBe('1.5');
    s.handle(req('stepBack', 5));
    expect(s.currentBar).toBe(0);
  });

  test('chart-bar breakpoint: continue stops on toggled bar', () => {
    const s = new AxisBarDebugSession();
    s.handle(req('launch', 1, { bars: BARS }));
    expect(s.toggleBarBreakpoint(2)).toBe(true);
    expect(s.barBreakpointSet()).toEqual([2]);
    const cont = s.handle(req('continue', 2));
    expect(s.currentBar).toBe(2);
    expect(events(cont).some((e) => (e.body as { reason?: string }).reason === 'breakpoint')).toBe(true);
    expect(s.toggleBarBreakpoint(2)).toBe(false);
  });

  test('line breakpoints verify; continue with line BP stops every bar', () => {
    const s = new AxisBarDebugSession();
    s.handle(req('launch', 1, { bars: BARS }));
    const set = s.handle(req('setBreakpoints', 2, { breakpoints: [{ line: 3 }, { line: 0 }] }));
    const bps = (firstResponse(set).body as { breakpoints: Array<{ line: number }> }).breakpoints;
    expect(bps).toEqual([{ line: 3, verified: true }]);
    s.handle(req('continue', 3));
    expect(s.currentBar).toBe(1);
  });

  test('threads/stack/scopes/pause/disconnect; ignore garbage; unknown command fails', () => {
    const s = new AxisBarDebugSession();
    expect(s.handle({ nope: true })).toEqual([]);
    s.handle(req('launch', 1, { bars: BARS }));
    expect(firstResponse(s.handle(req('threads', 2))).success).toBe(true);
    expect(firstResponse(s.handle(req('stackTrace', 3))).success).toBe(true);
    expect(firstResponse(s.handle(req('scopes', 4))).success).toBe(true);
    expect(firstResponse(s.handle(req('variables', 5, { variablesReference: 9 }))).success).toBe(true);
    expect(events(s.handle(req('pause', 6))).some((e) => e.event === 'stopped')).toBe(true);
    expect(firstResponse(s.handle(req('disconnect', 7))).success).toBe(true);
    expect(firstResponse(s.handle(req('nope', 8))).success).toBe(false);
    expect(s.toggleBarBreakpoint(-1)).toBe(false);
    const empty = new AxisBarDebugSession();
    empty.handle(req('launch', 1, { bars: [] }));
    empty.handle(req('next', 2));
    expect(empty.currentBar).toBe(0);
    expect(empty.barCount).toBe(0);
    empty.handle(req('continue', 3));
    expect(empty.currentBar).toBe(0);

    const end = new AxisBarDebugSession();
    end.handle(req('launch', 1, { bars: BARS }));
    expect(end.barCount).toBe(3);
    const toEnd = end.handle(req('continue', 2));
    expect(end.currentBar).toBe(2);
    expect(events(toEnd).some((e) => (e.body as { reason?: string }).reason === 'end')).toBe(true);
    end.handle(req('next', 3));
    expect(end.currentBar).toBe(2);
  });

  test('seekToBar jumps to trade bar and stops with reason', () => {
    const s = new AxisBarDebugSession();
    s.handle(req('launch', 1, { bars: BARS, stopOnEntry: false }));
    const msgs = s.seekToBar(2, 'trade');
    expect(s.currentBar).toBe(2);
    expect(events(msgs).some((e) => (e.body as { reason?: string }).reason === 'trade')).toBe(true);
    s.seekToBar(99, 'goto');
    expect(s.currentBar).toBe(2);
    s.seekToBar(-3, 'goto');
    expect(s.currentBar).toBe(0);
  });

  test('cursor listener throw is swallowed', () => {
    const s = new AxisBarDebugSession(() => {
      throw new Error('boom');
    });
    expect(() => s.handle(req('launch', 1, { bars: BARS }))).not.toThrow();
  });
});
