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
import { defaultChartDocument } from './chart-document';
import { handleChartWebviewMessage } from './chart-messages';
import { buildChartSession } from '../host/chart-session';
import { HOST_TO_VIEW, VIEW_TO_HOST, decode, encode } from '../protocol';
import { LineStyle } from 'lightweight-charts';
import {
  applyPlotOverlays,
  chartLayoutOptions,
  createChartPainter,
  mapPlotLineStyle,
  overlayPriceScaleId,
  shapeMarkersFromPlots,
  strategyMarkersFromTrades,
  toFillBandPoints,
  toOhlcOverlayPoints,
} from '../../webview/chart/src/paint';
import { createDrawingOverlay } from '../../webview/chart/src/drawings';
import {
  applyChartHostMessage,
  applyPlotWindow,
  classifyDeltaSeq,
  initialChartState,
  mergeBarTail,
  normalizeBars,
  normalizeEngineDrawings,
  normalizeInputs,
  normalizePlotLines,
  normalizeStrategy,
  pickChartPlugins,
  pluginChipSpecs,
  reduceChartMessage,
  resolvePlotPaintKind,
} from '../../webview/chart/src/state';

describe('chart.full encode → decode → reducer apply', () => {
  test('session full round-trips into webview reducer bars', () => {
    const doc = {
      ...defaultChartDocument(),
      symbol: 'BTC/USDT',
      exchange: 'binance',
      historyBars: 50,
    };
    const session = buildChartSession({ doc, useMockBars: true, seq: 1 });

    const env = encode(HOST_TO_VIEW.ChartFull, session.full);
    const decoded = decode(env);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    const payload = decoded.envelope.payload as Record<string, unknown>;
    let state = initialChartState();
    state = reduceChartMessage(state, 'chart.init', {
      theme: 'void',
      seriesKey: session.seriesKey,
      panes: doc.panes,
      cssVars: {},
    });
    expect(state.bars).toEqual([]);
    state = reduceChartMessage(state, decoded.envelope.type, payload);

    expect(state.ready).toBe(true);
    expect(state.seriesKey).toBe('binance|spot|BTC/USDT|1m');
    expect(state.seq).toBe(1);
    expect(state.bars).toHaveLength(50);
    expect(session.bars).toHaveLength(50);
    const applied = state.bars[0];
    const expected = session.bars[0];
    expect(applied).toBeDefined();
    expect(expected).toBeDefined();
    if (!applied || !expected) return;
    expect(applied.time).toBeTypeOf('number');
    expect(applied).toEqual({
      time: expected.time,
      open: expected.open,
      high: expected.high,
      low: expected.low,
      close: expected.close,
      volume: expected.volume,
    });
    expect(applied.high).toBeGreaterThanOrEqual(Math.max(applied.open, applied.close));
  });

  test('second chart.full replaces series; empty full clears', () => {
    let state = initialChartState();
    state = reduceChartMessage(state, 'chart.full', {
      bars: [{ time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 1 }],
      seq: 1,
    });
    expect(state.bars).toHaveLength(1);

    state = reduceChartMessage(state, 'chart.full', {
      bars: [
        { time: 10, open: 2, high: 3, low: 1, close: 2.5, volume: 2 },
        { time: 11, open: 2.5, high: 4, low: 2, close: 3, volume: 3 },
      ],
      seq: 2,
    });
    expect(state.seq).toBe(2);
    expect(state.bars).toHaveLength(2);
    const first = state.bars[0];
    expect(first).toBeDefined();
    if (!first) return;
    expect(first.time).toBe(10);

    state = reduceChartMessage(state, 'chart.init', {
      theme: 'void',
      seriesKey: 'x',
      panes: [],
      cssVars: {},
    });
    expect(state.bars).toEqual([]);
    expect(state.seq).toBe(0);

    state = reduceChartMessage(state, 'chart.full', { bars: [], seq: 3 });
    expect(state.bars).toEqual([]);
    expect(state.seq).toBe(3);
  });

  test('handshake handler returns init + full envelopes', () => {
    const doc = {
      ...defaultChartDocument(),
      symbol: 'SOL/USDT',
      exchange: 'binance',
      historyBars: 40,
    };
    const session = buildChartSession({ doc, useMockBars: true });
    const ready = encode(VIEW_TO_HOST.WebviewReady, {
      view: 'chart',
      capabilities: ['chart-full'],
    });
    const result = handleChartWebviewMessage(ready, () => ({
      init: session.init,
      full: session.full,
    }));
    expect(result.kind).toBe('init');
    if (result.kind !== 'init') return;
    expect(result.envelope.type).toBe(HOST_TO_VIEW.ChartInit);
    expect(result.full.type).toBe(HOST_TO_VIEW.ChartFull);
    expect((result.full.payload as { bars: unknown[] }).bars).toHaveLength(40);
  });

  test('normalizeBars accepts short keys and ignores garbage', () => {
    const bars = normalizeBars([
      { t: 1, o: 1, h: 2, l: 0.5, c: 1.5, v: 10 },
      { time: 2, open: 1, high: 1, low: 1, close: 1 },
      null,
      { open: 1 },
    ]);
    expect(bars).toHaveLength(2);
    expect(bars[0]).toEqual({
      time: 1,
      open: 1,
      high: 2,
      low: 0.5,
      close: 1.5,
      volume: 10,
    });
  });

  test('reducer ignores unknown types', () => {
    const state = reduceChartMessage(initialChartState(), 'nope', {});
    expect(state).toEqual(initialChartState());
  });

  test('chart.full lookahead static grep is stored (not a live-safe proof)', () => {
    const state = reduceChartMessage(initialChartState(), 'chart.full', {
      bars: [{ time: 1, open: 1, high: 1, low: 1, close: 1 }],
      seq: 1,
      lookahead: {
        static: true,
        tainted: true,
        hits: [{ kind: 'lookahead_on', line: 2, col: 0, text: 'lookahead_on' }],
        note: 'Static grep overlay — not dynamic taint, not a live-safe proof.',
      },
    });
    expect(state.lookahead?.tainted).toBe(true);
    expect(state.lookahead?.static).toBe(true);
    expect(state.lookahead?.hits[0]?.kind).toBe('lookahead_on');
  });

  test('chart.debugCursor sets debugBarIndex overlay (not a studio)', () => {
    const state = reduceChartMessage(initialChartState(), 'chart.debugCursor', { barIndex: 4 });
    expect(state.debugBarIndex).toBe(4);
    const cleared = reduceChartMessage(state, 'chart.debugCursor', { barIndex: 'x' });
    expect(cleared.debugBarIndex).toBeNull();
  });

  test('chart.init / host.run.status plugin fields are inert (lightweight core)', () => {
    let state = initialChartState();
    state = reduceChartMessage(state, 'chart.init', {
      theme: 'void',
      seriesKey: 'binance|spot|BTC/USDT|1m',
      panes: [],
      cssVars: {},
      plugins: { source: 'binance-rest', engine: 'server', extra: 'drop' },
    });
    // pickChartPlugins may still parse wire payload for forward-compat, but chips are gone
    expect(state.plugins).toEqual({ source: 'binance-rest', engine: 'server' });
    expect(state.bars).toEqual([]);

    state = reduceChartMessage(state, 'chart.full', {
      bars: [{ time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 1 }],
      seq: 1,
    });
    expect(state.bars).toHaveLength(1);
    const barsBefore = state.bars;

    const status = applyChartHostMessage(state, 'host.run.status', {
      epoch: 0,
      state: 'plugins',
      plugins: { source: 'okx-rest', stream: 'binance-ws', engine: 'pyodide', storage: 'local' },
    });
    expect(status.requestReload).toBe(false);
    expect(status.state.bars).toBe(barsBefore);
    expect(status.state.seq).toBe(1);
    expect(status.state.plugins).toEqual({
      source: 'okx-rest',
      stream: 'binance-ws',
      engine: 'pyodide',
      storage: 'local',
    });

    const noPlugins = applyChartHostMessage(status.state, 'host.run.status', {
      epoch: 1,
      state: 'running',
    });
    expect(noPlugins.state.plugins).toEqual(status.state.plugins);
    expect(noPlugins.state.bars).toBe(status.state.bars);

    const badPlugins = applyChartHostMessage(status.state, 'host.run.status', {
      epoch: 2,
      state: 'plugins',
      plugins: ['x'],
    });
    expect(badPlugins.state.plugins).toEqual(status.state.plugins);

    // HUD chips removed — always empty
    expect(pluginChipSpecs(status.state.plugins)).toEqual([]);
    expect(pluginChipSpecs(undefined)).toEqual([]);
    expect(pluginChipSpecs({})).toEqual([]);
    expect(pluginChipSpecs({ source: '  ' })).toEqual([]);
    expect(pickChartPlugins(['x'])).toBeUndefined();
    expect(pickChartPlugins(null)).toBeUndefined();
    expect(pickChartPlugins({ source: 'mexc-rest', stream: 1 })).toEqual({ source: 'mexc-rest' });

    const reinit = reduceChartMessage(status.state, 'chart.init', {
      theme: 'void',
      seriesKey: 'x',
      panes: [],
      cssVars: {},
    });
    expect(reinit.plugins).toEqual(status.state.plugins);
    expect(reinit.bars).toEqual([]);

    const emptyPlugins = reduceChartMessage(reinit, 'chart.init', {
      theme: 'void',
      seriesKey: 'x',
      panes: [],
      cssVars: {},
      plugins: {},
    });
    expect(emptyPlugins.plugins).toEqual({});

    const hostile: Record<string, unknown> = { epoch: 0, state: 'plugins' };
    Object.defineProperty(hostile, 'plugins', {
      get() {
        throw new Error('boom-plugins');
      },
    });
    expect(() => applyChartHostMessage(status.state, 'host.run.status', hostile)).not.toThrow();
  });
});

describe('chart.delta merge + seq gap → requestReload', () => {
  const b = (t: number) => ({
    time: t,
    open: 1,
    high: 2,
    low: 0.5,
    close: 1.5,
    volume: 1,
  });

  test('continuous delta merges tail at baseIndex', () => {
    let state = initialChartState();
    state = reduceChartMessage(state, 'chart.full', {
      bars: [b(1), b(2), b(3)],
      seq: 10,
    });
    const tip = applyChartHostMessage(state, 'chart.delta', {
      baseIndex: 2,
      tail: [{ ...b(3), close: 1.8 }],
      seq: 11,
    });
    expect(tip.requestReload).toBe(false);
    expect(tip.state.seq).toBe(11);
    expect(tip.state.bars).toHaveLength(3);
    expect(tip.state.bars[2]?.close).toBe(1.8);

    const append = applyChartHostMessage(tip.state, 'chart.delta', {
      baseIndex: 3,
      tail: [b(4)],
      seq: 12,
    });
    expect(append.requestReload).toBe(false);
    expect(append.state.bars).toHaveLength(4);
    expect(append.state.bars[3]?.time).toBe(4);
  });

  test('seq gap and delta-before-full set requestReload; duplicate no-ops', () => {
    let state = initialChartState();
    const before = applyChartHostMessage(state, 'chart.delta', {
      baseIndex: 0,
      tail: [b(1)],
      seq: 1,
    });
    expect(before.requestReload).toBe(true);
    expect(before.state.bars).toEqual([]);

    state = reduceChartMessage(state, 'chart.full', { bars: [b(1)], seq: 5 });
    const gap = applyChartHostMessage(state, 'chart.delta', {
      baseIndex: 0,
      tail: [b(9)],
      seq: 9,
    });
    expect(gap.requestReload).toBe(true);
    expect(gap.state.seq).toBe(5);

    const dup = applyChartHostMessage(state, 'chart.delta', {
      baseIndex: 0,
      tail: [b(1)],
      seq: 5,
    });
    expect(dup.requestReload).toBe(false);
    expect(dup.state).toEqual(state);
  });

  test('unsafe baseIndex / malformed delta handling', () => {
    let state = reduceChartMessage(initialChartState(), 'chart.full', {
      bars: [b(1)],
      seq: 1,
    });
    const badBase = applyChartHostMessage(state, 'chart.delta', {
      baseIndex: 5,
      tail: [b(2)],
      seq: 2,
    });
    expect(badBase.requestReload).toBe(true);

    const malformed = applyChartHostMessage(state, 'chart.delta', { seq: 2 });
    expect(malformed.requestReload).toBe(false);
    expect(malformed.state).toEqual(state);

    expect(classifyDeltaSeq(1, 2)).toBe('continuous');
    expect(classifyDeltaSeq(1, 1)).toBe('duplicate');
    expect(classifyDeltaSeq(1, 3)).toBe('gap');
    expect(classifyDeltaSeq(0, 1)).toBe('gap');
    expect(mergeBarTail([b(1)], 0, [b(9)])).toEqual([b(9)]);
    expect(mergeBarTail([b(1)], -1, [b(9)])).toBeNull();
  });

  test('chart.full plots become overlay lines aligned to bars', () => {
    const init = reduceChartMessage(initialChartState(), 'chart.init', {
      theme: 'void',
      seriesKey: 'binance|spot|BTC/USDT|1m',
      panes: [],
      cssVars: {},
    });
    expect(init.plots).toEqual([]);
    const withPlots = reduceChartMessage(init, 'chart.full', {
      bars: [b(1), b(2), b(3)],
      plots: { sma: [10, 11, 12], ema: [9, null, 11] },
      seq: 2,
    });
    expect(withPlots.plots).toEqual([
      { id: 'sma', values: [10, 11, 12], kind: 'line' },
      { id: 'ema', values: [9, null, 11], kind: 'line' },
    ]);
    expect(normalizePlotLines([1, 2, 3])).toEqual([
      { id: 'plot', values: [1, 2, 3], kind: 'line' },
    ]);
    expect(normalizePlotLines(undefined, { rsi: [30, 40] })).toEqual([
      { id: 'rsi', values: [30, 40], kind: 'line' },
    ]);
    expect(chartLayoutOptions().attributionLogo).toBe(false);
    expect(chartLayoutOptions().textColor).toBe('#e8eaee');
    expect(chartLayoutOptions().textColor.includes('var(')).toBe(false);
  });

  test('chart.delta encode → decode → reducer apply', () => {
    const env = encode(HOST_TO_VIEW.ChartDelta, {
      baseIndex: 1,
      tail: [b(2)],
      seq: 2,
      plots: { x: [1] },
    });
    const decoded = decode(env);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    const state = reduceChartMessage(initialChartState(), 'chart.full', {
      bars: [b(1), b(2)],
      seq: 1,
    });
    const out = applyChartHostMessage(
      state,
      decoded.envelope.type,
      decoded.envelope.payload as Record<string, unknown>,
    );
    expect(out.requestReload).toBe(false);
    expect(out.state.seq).toBe(2);
    expect(out.state.bars).toHaveLength(2);
    expect(out.state.bars[1]?.time).toBe(2);
  });

  test('resolvePlotPaintKind maps engine kind/style', () => {
    expect(resolvePlotPaintKind({ kind: 'hline' })).toBe('hline');
    expect(resolvePlotPaintKind({ kind: 'bgcolor' })).toBe('bgcolor');
    expect(resolvePlotPaintKind({ kind: 'barcolor' })).toBe('barcolor');
    expect(resolvePlotPaintKind({ kind: 'plotshape' })).toBe('shape');
    expect(resolvePlotPaintKind({ kind: 'plotchar' })).toBe('shape');
    expect(resolvePlotPaintKind({ kind: 'plotarrow' })).toBe('shape');
    expect(resolvePlotPaintKind({ style: 'histogram' })).toBe('histogram');
    expect(resolvePlotPaintKind({ style: 'plot.style_columns' })).toBe('histogram');
    expect(resolvePlotPaintKind({ style: 'stepline' })).toBe('step');
    expect(resolvePlotPaintKind({ style: 'area' })).toBe('area');
    expect(resolvePlotPaintKind({ style: 'areabr' })).toBe('area');
    expect(resolvePlotPaintKind({ style: 'linebr' })).toBe('line');
    expect(resolvePlotPaintKind({ style: 'line' })).toBe('line');
    expect(resolvePlotPaintKind({ kind: 'fill' })).toBe('fill');
    expect(resolvePlotPaintKind({ kind: 'plotbar' })).toBe('plotbar');
    expect(resolvePlotPaintKind({ kind: 'plotcandle' })).toBe('plotcandle');
    expect(resolvePlotPaintKind({ style: 'bars' })).toBe('plotbar');
    expect(resolvePlotPaintKind({ style: 'candles' })).toBe('plotcandle');
  });

  test('normalizePlotLines copies fill/ohlc edges and linestyle/offset/show_last', () => {
    const plots = normalizePlotLines(
      undefined,
      {
        mid: [1, 2, 3, 4],
        upper: [2, 3, 4, 5],
        lower: [0, 1, 2, 3],
        px: [10, 11, 12, 13],
        'px.open': [9, 10, 11, 12],
        'px.high': [11, 12, 13, 14],
        'px.low': [8, 9, 10, 11],
        brs: [10, 11, 12, 13],
        'brs.open': [9, 10, 11, 12],
        'brs.high': [11, 12, 13, 14],
        'brs.low': [8, 9, 10, 11],
      },
      {
        mid: { kind: 'plot', linestyle: 'plot.linestyle_dotted', offset: 1, show_last: 2 },
        band: { kind: 'fill', plot1: 'upper', plot2: 'lower', color: '#00ff00' },
        px: { kind: 'plotcandle', open: 'px.open', high: 'px.high', low: 'px.low', wickcolor: '#111' },
        brs: { kind: 'plotbar', style: 'bars' },
      },
    );
    const mid = plots.find((p) => p.id === 'mid');
    expect(mid?.linestyle).toBe('plot.linestyle_dotted');
    expect(mid?.offset).toBe(1);
    expect(mid?.showLast).toBe(2);
    const band = plots.find((p) => p.id === 'band');
    expect(band?.kind).toBe('fill');
    expect(band?.plot1).toBe('upper');
    expect(band?.plot2).toBe('lower');
    expect(band?.values).toEqual([2, 3, 4, 5]);
    expect(band?.fillLower).toEqual([0, 1, 2, 3]);
    const cdl = plots.find((p) => p.id === 'px');
    expect(cdl?.kind).toBe('plotcandle');
    expect(cdl?.open).toEqual([9, 10, 11, 12]);
    expect(cdl?.high).toEqual([11, 12, 13, 14]);
    expect(cdl?.low).toEqual([8, 9, 10, 11]);
    expect(cdl?.wickcolor).toBe('#111');
    expect(plots.some((p) => p.id === 'px.open')).toBe(false);
    expect(plots.find((p) => p.id === 'brs')?.kind).toBe('plotbar');
  });

  test('applyPlotWindow honours offset and show_last', () => {
    expect(applyPlotWindow([10, 20, 30, 40], 1)).toEqual([null, 10, 20, 30]);
    expect(applyPlotWindow([10, 20, 30, 40], -1)).toEqual([20, 30, 40, null]);
    expect(applyPlotWindow([10, 20, 30, 40], 0, 2)).toEqual([null, null, 30, 40]);
    expect(applyPlotWindow([10, 20, 30, 40], 1, 2)).toEqual([null, null, 20, 30]);
  });

  test('mapPlotLineStyle maps pine tokens', () => {
    expect(mapPlotLineStyle('plot.linestyle_solid')).toBe(LineStyle.Solid);
    expect(mapPlotLineStyle('hline.style_dashed')).toBe(LineStyle.Dashed);
    expect(mapPlotLineStyle('linestyle_dotted')).toBe(LineStyle.Dotted);
    expect(mapPlotLineStyle(undefined, LineStyle.Dashed)).toBe(LineStyle.Dashed);
  });

  test('chart.full maps plot_meta, engine drawings, inputs, strategy, window', () => {
    const state = reduceChartMessage(initialChartState(), 'chart.full', {
      bars: [b(1), b(2)],
      series: { sma: [1, 2], bg: ['#112233', '#223344'] },
      plotMeta: {
        sma: { kind: 'plot', style: 'histogram', color: '#22d3ee' },
        bg: { kind: 'bgcolor' },
      },
      drawings: [{ type: 'line', t1: 1, p1: 2, t2: 2, p2: 3, color: '#fff' }],
      inputs: [{ title: 'Length', type: 'int', value: 14, defval: 9 }],
      strategy: {
        trades: [{ id: 'long', kind: 'entry', time: 1, price: 10, direction: 'long' }],
        stats: { trades: 1, entries: 1, exits: 0 },
        equity: [100, 110],
      },
      times: [1, 2],
      window: { from_bar: 0, to_bar: 1, total_bars: 500 },
      alerts: [{ message: 'x' }, { message: 'y' }],
      seq: 4,
    });
    expect(state.plots.find((p) => p.id === 'sma')?.kind).toBe('histogram');
    expect(state.plots.find((p) => p.id === 'bg')?.kind).toBe('bgcolor');
    expect(state.engineDrawings).toEqual([
      { type: 'line', t1: 1, p1: 2, t2: 2, p2: 3, color: '#fff' },
    ]);
    expect(state.inputs).toEqual([{ title: 'Length', type: 'int', value: 14, defval: 9 }]);
    expect(state.strategy?.trades).toHaveLength(1);
    expect(state.strategy?.equity).toEqual([100, 110]);
    expect(state.window).toEqual({ fromBar: 0, toBar: 1, totalBars: 500 });
    expect(state.alertsCount).toBe(2);
    expect(state.drawings).toEqual([]);
  });

  test('user trendlines stay when engine drawings arrive; user batch replaces', () => {
    const withUser = reduceChartMessage(initialChartState(), 'chart.init', {
      theme: 'void',
      seriesKey: 'k',
      panes: [],
      cssVars: {},
      drawings: [
        {
          id: 'tl1',
          tool: 'trendline',
          points: [
            { time: 1, price: 1 },
            { time: 2, price: 2 },
          ],
        },
      ],
    });
    expect(withUser.drawings).toHaveLength(1);
    const engine = reduceChartMessage(withUser, 'chart.full', {
      bars: [b(1)],
      drawings: [{ type: 'label', t1: 1, p1: 2, text: 'hi' }],
      seq: 2,
    });
    expect(engine.drawings).toHaveLength(1);
    expect(engine.engineDrawings).toEqual([{ type: 'label', t1: 1, p1: 2, text: 'hi' }]);
    const userBatch = reduceChartMessage(engine, 'chart.full', {
      bars: [b(1)],
      drawings: [],
      seq: 3,
    });
    expect(userBatch.drawings).toEqual([]);
  });

  test('normalize helpers skip hostile / empty extras', () => {
    expect(normalizeEngineDrawings([{ tool: 'trendline' }, { type: 'box', t1: 1, p1: 2, t2: 3, p2: 4 }])).toEqual([
      { type: 'box', t1: 1, p1: 2, t2: 3, p2: 4 },
    ]);
    expect(normalizeEngineDrawings('nope')).toEqual([]);
    expect(normalizeInputs({ Length: 9, On: true })).toEqual([
      { title: 'Length', type: 'number', value: 9 },
      { title: 'On', type: 'boolean', value: true },
    ]);
    expect(normalizeInputs([])).toEqual([]);
    expect(normalizeStrategy({ trades: [{ id: 'x' }] })).toBeUndefined();
    expect(normalizeStrategy({ trades: [{ id: 'x', kind: 'entry' }], equity: [1, 2] })?.stats.entries).toBe(1);
  });

  test('strategy and shape markers from envelope extras', () => {
    const markers = strategyMarkersFromTrades({
      trades: [
        { id: 'L', kind: 'entry', direction: 'long', time: 1 },
        { id: 'S', kind: 'entry', direction: 'short', time: 2 },
        { id: 'X', kind: 'exit', time: 3 },
      ],
      stats: { trades: 3, entries: 2, exits: 1 },
    });
    expect(markers).toHaveLength(3);
    expect(markers[0]?.shape).toBe('arrowUp');
    expect(markers[1]?.shape).toBe('arrowDown');
    expect(markers[2]?.shape).toBe('circle');
    const shapes = shapeMarkersFromPlots(
      [b(1), b(2)],
      [{ id: 'sig', values: [1, 0], kind: 'shape', location: 'belowbar', char: '↓' }],
    );
    expect(shapes).toHaveLength(1);
    expect(shapes[0]?.shape).toBe('arrowDown');
    expect(shapes[0]?.text).toBe('↓');
    const bare = shapeMarkersFromPlots([b(1)], [{ id: 'sig', values: [1], kind: 'shape' }]);
    expect(bare).toHaveLength(1);
    expect(bare[0]?.text).toBe('');
    expect(bare[0]?.color).toBe('#a78bfa');
  });

  test('stub painter records plot kinds and strategy trade count', () => {
    if (typeof document === 'undefined') return;
    const host = document.createElement('div');
    const ph = document.createElement('p');
    ph.className = 'chart-host__placeholder';
    host.append(ph);
    const painter = createChartPainter(host);
    painter.apply({
      ...initialChartState(),
      ready: true,
      theme: 'void',
      seriesKey: 'binance|spot|BTC/USDT|1m',
      bars: [b(1), b(2)],
      plots: [
        { id: 'sma', values: [1, 2], kind: 'histogram' },
        { id: 'hl', values: [1.5, 1.5], kind: 'hline' },
      ],
      strategy: {
        trades: [{ id: 'L', kind: 'entry', time: 1, price: 1 }],
        stats: { trades: 1, entries: 1, exits: 0 },
      },
      engineDrawings: [{ type: 'line', t1: 1, p1: 1, t2: 2, p2: 2 }],
      seq: 7,
    });
    expect(host.getAttribute('data-axis-plot-kinds')).toBe('histogram,hline');
    expect(host.getAttribute('data-axis-strategy-trades')).toBe('1');
    expect(host.getAttribute('data-axis-engine-drawings')).toBe('1');
    expect(host.getAttribute('data-axis-plot-count')).toBe('2');
    painter.dispose();
  });

  test('applyPlotOverlays paints fill, plotbar, plotcandle and honours linestyle/offset/show_last', () => {
    const bars = [b(1), b(2), b(3), b(4)];
    const added: Array<{ type: unknown; opts: Record<string, unknown>; data: unknown[] }> = [];
    const chart = {
      addSeries(type: unknown, opts: Record<string, unknown>) {
        const rec: { type: unknown; opts: Record<string, unknown>; data: unknown[] } = {
          type,
          opts,
          data: [],
        };
        added.push(rec);
        return {
          setData(data: unknown[]) {
            rec.data = data;
          },
          applyOptions(next: Record<string, unknown>) {
            Object.assign(rec.opts, next);
          },
        };
      },
      removeSeries() {},
      priceScale() {
        return { applyOptions() {} };
      },
    };
    const priceLines: Array<Record<string, unknown>> = [];
    const candle = {
      createPriceLine(opts: Record<string, unknown>) {
        priceLines.push(opts);
        return opts;
      },
      removePriceLine() {},
    };
    const band = normalizePlotLines(
      undefined,
      { upper: [2, 3, 4, 5], lower: [0, 1, 2, 3] },
      { cloud: { kind: 'fill', plot1: 'upper', plot2: 'lower', color: '#22d3ee' } },
    );
    const ohlcPlots = normalizePlotLines(
      undefined,
      {
        px: [10, 11, 12, 13],
        'px.open': [9, 10, 11, 12],
        'px.high': [11, 12, 13, 14],
        'px.low': [8, 9, 10, 11],
        brs: [10, 11, 12, 13],
        'brs.open': [9, 10, 11, 12],
        'brs.high': [11, 12, 13, 14],
        'brs.low': [8, 9, 10, 11],
        sma: [1, 2, 3, 4],
      },
      {
        px: { kind: 'plotcandle', color: '#26a69a' },
        brs: { kind: 'plotbar', color: '#ef5350' },
        sma: { kind: 'plot', linestyle: 'dotted', offset: 1, show_last: 2 },
        hl: { kind: 'hline', linestyle: 'hline.style_dotted' },
      },
    );
    const hl = { id: 'hl', values: [1.5, 1.5, 1.5, 1.5], kind: 'hline' as const, linestyle: 'hline.style_dotted' };
    applyPlotOverlays(
      chart as never,
      candle as never,
      new Map(),
      [],
      bars,
      [...band, ...ohlcPlots, hl],
    );

    const types = added.map((a) => a.type);
    expect(types).toContain(added.find((a) => a.opts.title === 'cloud')?.type);
    expect(added.some((a) => a.opts.title === 'cloud')).toBe(true);
    expect(added.some((a) => a.opts.title === 'px')).toBe(true);
    expect(added.some((a) => a.opts.title === 'brs')).toBe(true);
    expect(added.some((a) => a.opts.title === 'sma')).toBe(true);

    const sma = added.find((a) => a.opts.title === 'sma');
    expect(sma?.opts.lineStyle).toBe(LineStyle.Dotted);
    expect(sma?.data).toEqual([
      { time: 3, value: 2 },
      { time: 4, value: 3 },
    ]);

    expect(priceLines[0]?.lineStyle).toBe(LineStyle.Dotted);
    expect(priceLines[0]?.price).toBe(1.5);

    const px = ohlcPlots.find((p) => p.id === 'px');
    expect(px).toBeDefined();
    if (!px) return;
    const ohlc = toOhlcOverlayPoints(bars, px);
    expect(ohlc[0]).toEqual({ time: 1, open: 9, high: 11, low: 8, close: 10 });

    const fill = band.find((p) => p.id === 'cloud');
    expect(fill).toBeDefined();
    if (!fill) return;
    const fillPts = toFillBandPoints(bars, fill);
    expect(fillPts[0]).toEqual({
      time: 1,
      open: 2,
      high: 2,
      low: 0,
      close: 0,
      color: '#22d3ee',
    });
    const cloud = added.find((a) => a.opts.title === 'cloud');
    expect(cloud?.data[0]).toEqual({ time: 1, value: 2, color: '#22d3ee' });
    const cloudBand = added.find((a) => a.opts.title === 'cloud:band');
    expect(cloudBand?.data[0]).toMatchObject({ time: 1, open: 2, high: 2, low: 0, close: 0 });
    const bandColor = (cloudBand?.data[0] as { color?: string } | undefined)?.color ?? '';
    expect(bandColor.startsWith('rgba(')).toBe(true);
    const order = added.map((a) => String(a.opts.title));
    expect(order.indexOf('cloud')).toBeLessThan(order.indexOf('sma'));
    expect(order.indexOf('cloud')).toBeLessThan(order.indexOf('px'));
    const pxSeries = added.find((a) => a.opts.title === 'px');
    expect(pxSeries?.opts.upColor).toBe('#26a69a');
    expect(pxSeries?.opts.downColor).not.toBe(pxSeries?.opts.upColor);
    const brsSeries = added.find((a) => a.opts.title === 'brs');
    expect(brsSeries?.opts.upColor).not.toBe(brsSeries?.opts.downColor);
  });

  test('equity and off-price histograms do not use the candle scale', () => {
    const bars = [b(1), b(2), b(3), b(4)];
    const added: Array<{ opts: Record<string, unknown> }> = [];
    const scales: string[] = [];
    const chart = {
      addSeries(_type: unknown, opts: Record<string, unknown>) {
        const rec = { opts, data: [] as unknown[] };
        added.push(rec);
        return {
          setData(data: unknown[]) {
            rec.data = data;
          },
          applyOptions(next: Record<string, unknown>) {
            Object.assign(rec.opts, next);
          },
        };
      },
      removeSeries() {},
      priceScale(id: string) {
        scales.push(id);
        return { applyOptions() {} };
      },
    };
    const candle = {
      createPriceLine() {
        return {};
      },
      removePriceLine() {},
    };
    const near = { id: 'cols', values: [1, 1.2, 1.1, 1.4], kind: 'histogram' as const, color: '#60a5fa' };
    const volume = { id: 'vol', values: [1000, 2000, 1500, 1800], kind: 'histogram' as const, color: '#60a5fa' };
    const equity = { id: '__equity', values: [10000, 10050, 10020, 10100], kind: 'line' as const, color: '#e7e5e4' };
    const sma = { id: 'sma', values: [1, 1.2, 1.1, 1.3], kind: 'line' as const, color: '#22d3ee' };
    expect(overlayPriceScaleId(near, bars)).toBeUndefined();
    expect(overlayPriceScaleId(volume, bars)).toBe('osc');
    expect(overlayPriceScaleId(equity, bars)).toBe('equity');
    expect(overlayPriceScaleId(sma, bars)).toBeUndefined();
    applyPlotOverlays(chart as never, candle as never, new Map(), [], bars, [volume, near, equity, sma]);
    const equitySeries = added.find((a) => a.opts.priceScaleId === 'equity');
    expect(equitySeries?.opts.lastValueVisible).toBe(false);
    expect(equitySeries?.opts.priceLineVisible).toBe(false);
    expect(equitySeries?.opts.lineStyle).toBe(LineStyle.LargeDashed);
    expect(added.find((a) => a.opts.title === 'sma')?.opts.priceScaleId).toBeUndefined();
    expect(added.find((a) => a.opts.title === 'cols')?.opts.priceScaleId).toBeUndefined();
    expect(added.find((a) => a.opts.title === 'vol')?.opts.priceScaleId).toBe('osc');
    expect(scales).toContain('equity');
    expect(scales).toContain('osc');
    const areaChart = {
      addSeries(_type: unknown, opts: Record<string, unknown>) {
        const rec = { opts, data: [] as unknown[] };
        added.push(rec);
        return {
          setData(data: unknown[]) {
            rec.data = data;
          },
          applyOptions() {},
        };
      },
      removeSeries() {},
      priceScale() {
        return { applyOptions() {} };
      },
    };
    applyPlotOverlays(areaChart as never, candle as never, new Map(), [], bars, [
      { id: 'band', values: [1, 1.2, 1.4, 1.1], kind: 'area', color: '#34d399' },
      sma,
    ]);
    const area = added.find((a) => a.opts.title === 'band');
    expect(String(area?.opts.topColor)).toMatch(/^rgba\(/);
    expect(area?.opts.topColor).not.toBe('#34d399');
    expect(area?.opts.relativeGradient).toBe(true);
  });

  test('drawing overlay keeps stroke, label contrast, and box fill', () => {
    if (typeof document === 'undefined') return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const overlay = createDrawingOverlay(svg, () => ({
      toChartPoint: () => null,
      toPixel: (point) => ({ x: point.time, y: point.price }),
    }));
    overlay.redraw(
      [
        {
          id: 'tl',
          tool: 'trendline',
          points: [
            { time: 10, price: 20 },
            { time: 30, price: 40 },
          ],
        },
      ],
      null,
      [
        { type: 'line', t1: 1, p1: 2, t2: 3, p2: 4, color: '#000000', style: 'dashed' },
        { type: 'box', t1: 5, p1: 6, t2: 15, p2: 16, bgcolor: '#22d3ee', color: '#22d3ee' },
        { type: 'label', t1: 8, p1: 9, text: 'Hi', textcolor: '#111111' },
        {
          type: 'polyline',
          points: [
            { time: 1, price: 1 },
            { time: 2, price: 2 },
            { time: 3, price: 1 },
          ],
        },
        {
          type: 'linefill',
          t1: 0,
          p1: 0,
          t2: 10,
          p2: 0,
          t3: 0,
          p3: 10,
          t4: 10,
          p4: 10,
          color: '#60a5fa',
        },
      ],
    );
    expect(svg.querySelector('.drawing-overlay__line')).not.toBeNull();
    expect(svg.querySelector('.drawing-overlay__hit')).not.toBeNull();
    expect(svg.querySelectorAll('.drawing-overlay__handle').length).toBeGreaterThanOrEqual(2);
    const box = svg.querySelector('.drawing-overlay__box');
    expect(box?.getAttribute('fill')).toBe('rgba(34,211,238,0.18)');
    expect(box?.getAttribute('stroke')?.toLowerCase()).toBe('#22d3ee');
    const label = svg.querySelector('.drawing-overlay__label');
    expect(label?.textContent).toBe('Hi');
    expect(label?.getAttribute('fill')?.toLowerCase()).toBe('#e8eaee');
    expect(svg.querySelector('.drawing-overlay__label-bg')).not.toBeNull();
    expect(svg.querySelector('.drawing-overlay__fill')?.getAttribute('fill')).toBe('rgba(96,165,250,0.2)');
    const dashed = [...svg.querySelectorAll('.drawing-overlay__engine')].find((el) =>
      el.getAttribute('stroke-dasharray'),
    );
    expect(dashed?.getAttribute('stroke')?.toLowerCase()).toBe('#e8eaee');
    expect(dashed?.getAttribute('stroke-dasharray')).toBe('5 4');
    const classes = [...svg.children].map((node) => node.getAttribute('class'));
    expect(classes.indexOf('drawing-overlay__box')).toBeLessThan(classes.lastIndexOf('drawing-overlay__line'));
    overlay.dispose();
    expect(svg.childNodes.length).toBe(0);
  });
});
