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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PYODIDE_PINE_WHEEL_NEXT } from '../host/pyodide-profile';
import { declarePineInputs, evaluateMinimalSubset } from './pyodide-subset';

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

  test('walkthrough fixture: input length, source, assignment, and plot color', () => {
    const script = readFileSync(join(import.meta.dir, '../../fixtures/orb.pine'), 'utf8');
    const declared = declarePineInputs(script);
    expect(declared.map((d) => d.title)).toEqual(['Length', 'Source']);
    expect(declared[0]).toMatchObject({ type: 'int', value: 14, defval: 14 });
    const r = evaluateMinimalSubset(script, BARS);
    expect(r.status).toBe('success');
    expect(r.script_name).toBe('AXIS first plot');
    expect(r.plots.SMA).toEqual([null, null, null]);
    expect(r.plot_meta.SMA?.color?.toLowerCase()).toBe('#939fff');
    expect(r.inputs?.[0]?.title).toBe('Length');
    const shorter = evaluateMinimalSubset(script, BARS, { Length: 2, Source: 'open' });
    expect(shorter.plots.SMA).toEqual([null, 10.5, 11.5]);
    expect(shorter.inputs?.find((d) => d.title === 'Length')?.value).toBe(2);
  });

  test('strategy.entry on bar_index paints one trade and an equity curve', () => {
    const script = readFileSync(join(import.meta.dir, '../../fixtures/pyodide-strategy.pine'), 'utf8');
    const r = evaluateMinimalSubset(script, BARS);
    expect(r.status).toBe('success');
    expect(r.script_type).toBe('strategy');
    expect(r.plots.close).toEqual([11, 12, 13]);
    expect(r.plots.sma2).toEqual([null, 11.5, 12.5]);
    expect(r.events?.[0]).toMatchObject({ kind: 'entry', id: 'L', direction: 'long', bar_index: 0 });
    expect(r.series.__equity).toEqual([0, 1, 2]);
  });

  test('named inputs, aliases, nested args, overrides, and a hostile declaration', () => {
    const script = [
      'indicator("forms")',
      'len = input.int(title="Length", defval=max(1, 2), tooltip="tip")',
      'mult = input.float(1.5, "Mult")',
      'badF = input.float(nope, "BadF")',
      'name = input.string(title="Name")',
      'srcIn = input.source(title="Src", defval="open")',
      'on = input.bool(true, "On")',
      'input.float(2.5, "Bare")',
      'lenBroken = input.int(14, "Open"',
      'src = close',
      'copy = src',
      'label = input.string("x", "Label")',
      'ma = ta.sma(close, label)',
      'plot(copy, "c", color=color.blue)',
      'plot(close, "plain", color=color.nope)',
      'plot(ma, "bad")',
    ].join('\n');

    const declared = declarePineInputs(script);
    expect(declared.find((d) => d.title === 'Length')).toMatchObject({ type: 'int', value: 0 });
    expect(declared.find((d) => d.title === 'Mult')).toMatchObject({ type: 'float', value: 1.5 });
    expect(declared.find((d) => d.title === 'BadF')).toMatchObject({ type: 'float', value: 0 });
    expect(declared.find((d) => d.title === 'Name')).toMatchObject({ type: 'string', value: '' });
    expect(declared.find((d) => d.title === 'Src')).toMatchObject({ type: 'source', value: 'close' });
    expect(declared.find((d) => d.title === 'Bare')).toMatchObject({ type: 'float', value: 2.5 });
    expect(declared.find((d) => d.title === 'Open')).toBeUndefined();

    const painted = evaluateMinimalSubset(script, BARS);
    expect(painted.status).toBe('success');
    expect(painted.plots.c).toEqual([11, 12, 13]);
    expect(painted.plot_meta.c?.color).toBe('#8b9cff');
    expect(painted.plot_meta.plain?.color).toBeUndefined();
    expect(painted.plots.bad).toBeUndefined();
    expect(painted.error_kind).toBe('partial');

    expect(declarePineInputs(script, { On: false }).find((d) => d.title === 'On')?.value).toBe(false);
    expect(declarePineInputs(script, { On: 'true' }).find((d) => d.title === 'On')?.value).toBe(true);
    expect(declarePineInputs(script, { On: 'false' }).find((d) => d.title === 'On')?.value).toBe(false);
    expect(declarePineInputs(script, { On: 'maybe' }).find((d) => d.title === 'On')?.value).toBe(true);
    expect(declarePineInputs(script, { Length: '9' }).find((d) => d.title === 'Length')?.value).toBe(9);
    expect(declarePineInputs(script, { Mult: '2.5' }).find((d) => d.title === 'Mult')?.value).toBe(2.5);
    expect(declarePineInputs(script, { Length: 'nope' }).find((d) => d.title === 'Length')?.value).toBe(0);
    expect(declarePineInputs(script, { Name: 'axis' }).find((d) => d.title === 'Name')?.value).toBe('axis');
    expect(declarePineInputs(script, { Name: 3 }).find((d) => d.title === 'Name')?.value).toBe(3);
    expect(declarePineInputs(script, { Name: true }).find((d) => d.title === 'Name')?.value).toBe(true);
    expect(declarePineInputs(script, { Name: null }).find((d) => d.title === 'Name')?.value).toBe('');

    const hostile = {
      toString() {
        throw new Error('boom');
      },
    };
    expect(declarePineInputs(hostile as unknown as string)).toEqual([]);
  });
});
