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
import { PYODIDE_PINE_WHEEL_NEXT } from '../host/pyodide-profile';
import { evaluateMinimalSubset } from './pyodide-subset';

const BARS = [
  { time: 1_700_000_000, open: 10, high: 12, low: 9, close: 11, volume: 1 },
  { time: 1_700_000_060, open: 11, high: 13, low: 10, close: 12, volume: 2 },
  { time: 1_700_000_120, open: 12, high: 14, low: 11, close: 13, volume: 3 },
];

describe('pyodide minimal subset', () => {
  test('plot(close) maps named series and times', () => {
    const r = evaluateMinimalSubset('//@version=5\nindicator("t")\nplot(close)', BARS);
    expect(r.status).toBe('success');
    expect(r.plots.close).toEqual([11, 12, 13]);
    expect(r.series.close).toEqual([11, 12, 13]);
    expect(r.plot_meta.close).toEqual({ kind: 'plot', title: 'close' });
    expect(r.script_name).toBe('t');
    expect(r.times).toEqual([1_700_000_000, 1_700_000_060, 1_700_000_120]);
    expect(r.window).toEqual({ bars: 3, total_bars: 3 });
    expect(r.overlay).toBe(true);
  });

  test('plot(ta.sma(close, 2)) and title= ', () => {
    const r = evaluateMinimalSubset(
      'indicator("SMA")\nplot(ta.sma(close, 2), title="fast")',
      BARS,
    );
    expect(r.status).toBe('success');
    expect(r.plots.fast).toEqual([null, 11.5, 12.5]);
    expect(r.script_name).toBe('SMA');
  });

  test('unsupported pine is an honest error, not a fake success', () => {
    const r = evaluateMinimalSubset('//@version=5\nindicator("x")\nplot(ta.ema(close, 9))', BARS);
    expect(r.status).toBe('error');
    expect(r.error_kind).toBe('unsupported');
    expect(r.error).toContain(PYODIDE_PINE_WHEEL_NEXT);
  });

  test('duplicate titles are uniqued; unknown extra plot is partial', () => {
    const r = evaluateMinimalSubset('plot(close)\nplot(close)\nplot(ta.ema(close, 2))', BARS);
    expect(r.status).toBe('success');
    expect(r.plots.close).toEqual([11, 12, 13]);
    expect(r.plots.close_2).toEqual([11, 12, 13]);
    expect(r.error_kind).toBe('partial');
  });

  test('plot(open) + positional title; strategy name; empty bars; bad sma length', () => {
    const named = evaluateMinimalSubset('strategy("s1")\nplot(open, "o")', BARS);
    expect(named.status).toBe('success');
    expect(named.plots.o).toEqual([10, 11, 12]);
    expect(named.script_name).toBe('s1');

    const empty = evaluateMinimalSubset('plot(close)', []);
    expect(empty.status).toBe('success');
    expect(empty.plots.close).toEqual([]);
    expect(empty.window).toEqual({ bars: 0, total_bars: 0 });

    const badLen = evaluateMinimalSubset('plot(sma(close, 0))', BARS);
    expect(badLen.status).toBe('success');
    expect(badLen.plots.sma0).toEqual([null, null, null]);

    const crlf = evaluateMinimalSubset('plot(close)\r\nplot(volume)', BARS);
    expect(crlf.plots.volume).toEqual([1, 2, 3]);

    const coerced = evaluateMinimalSubset('plot(close)', undefined as unknown as []);
    expect(coerced.status).toBe('success');
    expect(coerced.plots.close).toEqual([]);
  });

  test('strips comments; sma of a null bar is null', () => {
    const r = evaluateMinimalSubset('/* plot(close) */\nplot(high, title="h")', BARS);
    expect(r.plots.h).toEqual([12, 13, 14]);
    expect(r.plots.close).toBeUndefined();
    const gappy = evaluateMinimalSubset('plot(sma(close, 2))', [
      { time: 1, open: 1, high: 1, low: 1, close: 10, volume: 1 },
      { time: 2, open: 1, high: 1, low: 1, close: Number.NaN, volume: 1 },
    ]);
    expect(gappy.plots.sma2).toEqual([null, null]);
  });
});
