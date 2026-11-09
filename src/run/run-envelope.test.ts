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
import { mapEngineResponse } from './engine-http';
import {
  attachRunEnvelope,
  chartFullFromRunResult,
  extractStrategy,
  strategyTradesCsv,
} from './run-envelope';

describe('run envelope extras', () => {
  test('mapEngineResponse copies plot_meta, inputs, times, window, alerts, error_kind', () => {
    const r = mapEngineResponse({
      status: 'success',
      plots: [1, 2],
      series: { sma: [1, 2], __equity: [100, 110] },
      plot_meta: { sma: { kind: 'plot', style: 'histogram', title: 'sma' } },
      inputs: [{ title: 'Length', type: 'int', value: 14, default: 14 }],
      alerts: [{ message: 'x' }],
      times: [1_700_000_000_000, 1_700_000_060_000],
      window: { from_bar: 0, to_bar: 1, bars: 2, total_bars: 500 },
      events: [
        {
          kind: 'entry',
          id: 'long',
          direction: 'long',
          qty: 1,
          bar_time: 1_700_000_000_000,
          bar_index: 0,
          ohlc: [1, 2, 0.5, 1.5],
          comment: 'in',
        },
      ],
      drawings: [{ type: 'line', t1: 1, p1: 2, t2: 3, p2: 4 }],
      script_type: 'strategy',
      script_name: 'Demo',
      overlay: true,
    });
    expect(r.status).toBe('success');
    expect(r.plotMeta).toEqual({ sma: { kind: 'plot', style: 'histogram', title: 'sma' } });
    expect(Array.isArray(r.inputs)).toBe(true);
    expect(r.alerts).toEqual([{ message: 'x' }]);
    expect(r.times).toEqual([1_700_000_000, 1_700_000_060]);
    expect(r.window).toEqual({ fromBar: 0, toBar: 1, bars: 2, totalBars: 500 });
    expect(r.scriptType).toBe('strategy');
    expect(r.scriptName).toBe('Demo');
    expect(r.overlay).toBe(true);
    expect(r.strategy?.trades).toHaveLength(1);
    expect(r.strategy?.trades[0]?.kind).toBe('entry');
    expect(r.strategy?.trades[0]?.price).toBe(1.5);
    expect(r.strategy?.equity).toEqual([100, 110]);
    expect(r.strategy?.stats.entries).toBe(1);
    expect(r.strategy?.stats.netProfit).toBe(10);
  });

  test('error_kind is copied on failure', () => {
    const r = mapEngineResponse({
      status: 'error',
      error: 'parse failed',
      error_kind: 'parse',
    });
    expect(r.status).toBe('error');
    expect(r.errorKind).toBe('parse');
  });

  test('extractStrategy skips indicators without trades or equity', () => {
    expect(extractStrategy({ events: [], series: { close: [1] } })).toBeUndefined();
    expect(
      extractStrategy({
        script_type: 'strategy',
        events: [{ kind: 'cancel', id: 'x' }],
      })?.trades,
    ).toEqual([]);
  });

  test('extractStrategy never throws on hostile events', () => {
    const raw: Record<string, unknown> = { events: [] };
    Object.defineProperty(raw, 'events', {
      get() {
        throw new Error('boom');
      },
    });
    expect(extractStrategy(raw)).toBeUndefined();
  });

  test('chartFullFromRunResult forwards extras; csv quotes commas', () => {
    const result = mapEngineResponse({
      status: 'ok',
      plots: [1],
      series: { plot: [1] },
      plot_meta: { plot: { kind: 'hline' } },
      inputs: { Length: 9 },
      times: [10],
      window: { from_bar: -5 },
      events: [
        { kind: 'exit', id: 'a,b', comment: 'say "hi"', qty: 2, bar_time: 10, ohlc: [1, 1, 1, 1] },
      ],
      script_type: 'strategy',
    });
    const full = chartFullFromRunResult(result, [{ time: 10 }], 3);
    expect(full.seq).toBe(3);
    expect(full.plotMeta).toEqual({ plot: { kind: 'hline' } });
    expect(full.inputs).toEqual({ Length: 9 });
    expect(full.times).toEqual([10]);
    expect(full.window).toEqual({ fromBar: -5 });
    expect(full.strategy?.trades[0]?.id).toBe('a,b');
    const csv = strategyTradesCsv(result.strategy?.trades ?? []);
    expect(csv.startsWith('id,kind,direction,qty,time,price,comment')).toBe(true);
    expect(csv).toContain('"a,b"');
    expect(csv).toContain('"say ""hi"""');
  });

  test('attachRunEnvelope never throws when extras getters explode', () => {
    const base = mapEngineResponse({ status: 'ok', plots: [] });
    const raw: Record<string, unknown> = {};
    Object.defineProperty(raw, 'plot_meta', {
      get() {
        throw new Error('boom');
      },
    });
    expect(() => attachRunEnvelope(base, raw)).not.toThrow();
  });

  test('overlay false and object-shaped equity still map', () => {
    const r = mapEngineResponse({
      status: 'ok',
      overlay: false,
      series: { __equity: [{ value: 10 }, { v: 12 }] },
      events: [{ kind: 'entry', id: 'e', bar_time: 10, price: 1 }],
    });
    expect(r.overlay).toBe(false);
    expect(r.strategy?.equity).toEqual([10, 12]);
  });

  test('attachRunEnvelope ignores non-objects for extras', () => {
    const base = mapEngineResponse({ status: 'ok', plots: [] });
    const out = attachRunEnvelope(base, {
      plot_meta: 'nope',
      inputs: 3,
      alerts: { x: 1 },
      times: [null, 'x'],
      window: [],
      error_kind: '  ',
    } as unknown as Record<string, unknown>);
    expect(out.plotMeta).toBeUndefined();
    expect(out.inputs).toBeUndefined();
    expect(out.alerts).toBeUndefined();
    expect(out.times).toBeUndefined();
    expect(out.window).toBeUndefined();
    expect(out.errorKind).toBeUndefined();
  });

  test('empty window, nameless trade, non-numeric ohlc close, object samples without value', () => {
    const r = mapEngineResponse({
      status: 'ok',
      plots: [{ foo: 1 }],
      series: { __equity: ['nope', { foo: 1 }] },
      window: {},
      events: [{ kind: 'entry', id: '  ', ohlc: [1, 2, 3, 'x'] }],
    });
    expect(r.window).toBeUndefined();
    expect(r.strategy?.trades[0]?.id).toBe('t0');
    expect(r.strategy?.trades[0]?.price).toBeUndefined();
    expect(r.strategy?.equity).toBeUndefined();
  });
});
