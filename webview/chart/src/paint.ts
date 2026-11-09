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
 * Lightweight Charts paint for the chart webview (KD-10 P0–P1).
 * Bundled locally — CSP connect-src none; no CDN.
 */

import {
  AreaSeries,
  BarSeries,
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  LineStyle,
  LineType,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type SeriesMarker,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { ChartBar, ChartPlotLine, ChartViewState, StrategyView } from './state';
import { applyPlotWindow, plotPoints, plotTimeAt } from './state';

const PLOT_COLORS = [
  '#22d3ee',
  '#fbbf24',
  '#a78bfa',
  '#34d399',
  '#fb7185',
  '#60a5fa',
];

/** Layout options — TradingView attribution logo off (VSIX NOTICE already ships). */
export function chartLayoutOptions(): {
  background: { type: ColorType; color: string };
  textColor: string;
  attributionLogo: false;
} {
  return {
    background: { type: ColorType.Solid, color: 'transparent' },
    textColor: 'var(--vscode-editor-foreground, #e0e0e0)',
    attributionLogo: false,
  };
}

export interface ChartCrosshairSample {
  bar: ChartBar | null;
  plots: Array<{ id: string; value: number | null }>;
}

export interface ChartPainter {
  apply(state: ChartViewState): void;
  dispose(): void;
  /** LWC chart API when paint mounted; null on stub path. */
  getChart(): IChartApi | null;
  /** Candlestick series when paint mounted; null on stub path. */
  getSeries(): ISeriesApi<'Candlestick'> | null;
  /** Subscribe to visible-range changes (overlay redraw). Returns disposer. */
  onVisibleRangeChange(cb: () => void): () => void;
  setPlotVisible(id: string, visible: boolean): void;
  lastSample(): ChartCrosshairSample;
  onCrosshair(cb: (sample: ChartCrosshairSample) => void): () => void;
}

function toCandleData(bars: ChartBar[]) {
  return bars.map((b) => ({
    time: b.time as UTCTimestamp,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
  }));
}

type OverlaySeries =
  | ISeriesApi<'Line'>
  | ISeriesApi<'Histogram'>
  | ISeriesApi<'Area'>
  | ISeriesApi<'Bar'>
  | ISeriesApi<'Candlestick'>;

function seriesKindKey(plot: ChartPlotLine, suffix = ''): string {
  return suffix ? `${plot.id}::${plot.kind}::${suffix}` : `${plot.id}::${plot.kind}`;
}

function overlaySkipKind(kind: ChartPlotLine['kind']): boolean {
  return kind === 'hline' || kind === 'barcolor' || kind === 'shape';
}

/** Pine `plot.linestyle_*` / `hline.style_*` → LWC LineStyle. */
export function mapPlotLineStyle(
  linestyle?: string,
  fallback: LineStyle = LineStyle.Solid,
): LineStyle {
  const raw = String(linestyle ?? '')
    .toLowerCase()
    .trim();
  if (!raw) return fallback;
  const leaf = raw.replace(/^.*\./, '').replace(/^linestyle_/, '').replace(/^style_/, '');
  if (leaf.includes('sparse')) return LineStyle.SparseDotted;
  if (leaf.includes('large')) return LineStyle.LargeDashed;
  if (leaf.includes('dot')) return LineStyle.Dotted;
  if (leaf.includes('dash')) return LineStyle.Dashed;
  if (leaf.includes('solid')) return LineStyle.Solid;
  return fallback;
}

function colorWithAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    const r = Number.parseInt(hex.slice(1, 3), 16);
    const g = Number.parseInt(hex.slice(3, 5), 16);
    const b = Number.parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    const r = Number.parseInt(hex[1] + hex[1], 16);
    const g = Number.parseInt(hex[2] + hex[2], 16);
    const b = Number.parseInt(hex[3] + hex[3], 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

function windowedColumn(
  values: (number | null)[] | undefined,
  plot: ChartPlotLine,
): (number | null)[] {
  return applyPlotWindow(values ?? [], plot.offset, plot.showLast);
}

function toUtcPoints(
  bars: ChartBar[],
  plot: ChartPlotLine,
  times?: number[],
  values?: (number | null)[],
): Array<{ time: UTCTimestamp; value: number; color?: string }> {
  const cols = windowedColumn(values ?? plot.values, plot);
  const colors = plot.colors ? applyPlotWindow(plot.colors, plot.offset, plot.showLast) : undefined;
  const out: Array<{ time: UTCTimestamp; value: number; color?: string }> = [];
  for (let i = 0; i < cols.length; i++) {
    const value = cols[i];
    if (value === null || !Number.isFinite(value)) continue;
    const time = plotTimeAt(i, bars, times);
    if (time === null) continue;
    const row: { time: UTCTimestamp; value: number; color?: string } = {
      time: time as UTCTimestamp,
      value,
    };
    const color = colors?.[i];
    if (color) row.color = color;
    out.push(row);
  }
  return out;
}

export type OhlcOverlayPoint = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  color?: string;
};

/** OHLC points for `plotbar` / `plotcandle` (siblings + window). */
export function toOhlcOverlayPoints(
  bars: ChartBar[],
  plot: ChartPlotLine,
  times?: number[],
): OhlcOverlayPoint[] {
  const close = windowedColumn(plot.values, plot);
  const open = windowedColumn(plot.open ?? plot.values, plot);
  const high = windowedColumn(plot.high ?? plot.values, plot);
  const low = windowedColumn(plot.low ?? plot.values, plot);
  const colors = plot.colors ? applyPlotWindow(plot.colors, plot.offset, plot.showLast) : undefined;
  const n = Math.max(close.length, open.length, high.length, low.length);
  const out: OhlcOverlayPoint[] = [];
  for (let i = 0; i < n; i++) {
    const c = close[i];
    const o = open[i] ?? c;
    const h = high[i] ?? c;
    const l = low[i] ?? c;
    if (c === null || o === null || h === null || l === null) continue;
    if (![c, o, h, l].every((v) => Number.isFinite(v))) continue;
    const time = plotTimeAt(i, bars, times);
    if (time === null) continue;
    const row: OhlcOverlayPoint = {
      time: time as UTCTimestamp,
      open: o,
      high: Math.max(h, o, c, l),
      low: Math.min(l, o, c, h),
      close: c,
    };
    const color = colors?.[i];
    if (color) row.color = color;
    out.push(row);
  }
  return out;
}

/** Fill band points: BarSeries body spans plot1↔plot2 after offset/show_last. */
export function toFillBandPoints(
  bars: ChartBar[],
  plot: ChartPlotLine,
  times?: number[],
): OhlcOverlayPoint[] {
  const upper = windowedColumn(plot.values, plot);
  const lower = windowedColumn(plot.fillLower ?? [], plot);
  const colors = plot.colors ? applyPlotWindow(plot.colors, plot.offset, plot.showLast) : undefined;
  const n = Math.min(upper.length, lower.length);
  const out: OhlcOverlayPoint[] = [];
  for (let i = 0; i < n; i++) {
    const a = upper[i];
    const b = lower[i];
    if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) continue;
    const time = plotTimeAt(i, bars, times);
    if (time === null) continue;
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    const row: OhlcOverlayPoint = {
      time: time as UTCTimestamp,
      open: hi,
      high: hi,
      low: lo,
      close: lo,
    };
    const color = colors?.[i] ?? plot.color;
    if (color) row.color = color;
    out.push(row);
  }
  return out;
}

/** Strategy entry/exit markers for the candle series. */
export function strategyMarkersFromTrades(
  strategy: StrategyView | undefined,
): SeriesMarker<UTCTimestamp>[] {
  if (!strategy) return [];
  const out: SeriesMarker<UTCTimestamp>[] = [];
  for (const t of strategy.trades) {
    const time = t.time;
    if (typeof time !== 'number' || !Number.isFinite(time)) continue;
    const isEntry = t.kind === 'entry';
    const isShort = t.direction === 'short';
    out.push({
      time: time as UTCTimestamp,
      position: isEntry ? (isShort ? 'aboveBar' : 'belowBar') : isShort ? 'belowBar' : 'aboveBar',
      color: isEntry ? (isShort ? '#ef5350' : '#26a69a') : '#fbbf24',
      shape: isEntry ? (isShort ? 'arrowDown' : 'arrowUp') : 'circle',
      text: t.id,
    });
  }
  return out;
}

export function shapeMarkersFromPlots(
  bars: ChartBar[],
  plots: ChartPlotLine[],
  times?: number[],
): SeriesMarker<UTCTimestamp>[] {
  const out: SeriesMarker<UTCTimestamp>[] = [];
  for (const plot of plots) {
    if (plot.kind !== 'shape') continue;
    const pts = plotPoints(bars, windowedColumn(plot.values, plot), times);
    for (let i = 0; i < pts.length; i++) {
      const v = pts[i];
      if (!v || v.value === 0) continue;
      const loc = String(plot.location ?? 'abovebar').toLowerCase();
      const position =
        loc.includes('below') ? 'belowBar' : loc.includes('inbar') || loc.includes('absolute') ? 'inBar' : 'aboveBar';
      const shape =
        plot.char === '↓' || String(plot.id).includes('arrowdown')
          ? 'arrowDown'
          : plot.char === '↑' || String(plot.id).includes('arrowup')
            ? 'arrowUp'
            : 'circle';
      out.push({
        time: v.time as UTCTimestamp,
        position,
        color: plot.colors?.[i] ?? plot.color ?? '#a78bfa',
        shape,
        text: plot.text ?? plot.char ?? plot.id,
      });
    }
  }
  return out;
}

function applyBarColors(bars: ChartBar[], plots: ChartPlotLine[]): ReturnType<typeof toCandleData> {
  const barcolor = plots.find((p) => p.kind === 'barcolor');
  const base = toCandleData(bars);
  if (!barcolor) return base;
  const colors = applyPlotWindow(barcolor.colors ?? [], barcolor.offset, barcolor.showLast);
  return base.map((row, i) => {
    const hex = colors[i];
    if (!hex) return row;
    return { ...row, color: hex, wickColor: hex, borderColor: hex };
  });
}

export function applyPlotOverlays(
  chart: IChartApi,
  candle: ISeriesApi<'Candlestick'>,
  bag: Map<string, OverlaySeries>,
  priceLines: IPriceLine[],
  bars: ChartBar[],
  plots: ChartPlotLine[],
  times?: number[],
): void {
  while (priceLines.length) {
    const line = priceLines.pop();
    if (!line) break;
    try {
      candle.removePriceLine(line);
    } catch {
      // gone
    }
  }
  const keep = new Set<string>();
  for (const plot of plots) {
    if (overlaySkipKind(plot.kind)) continue;
    keep.add(seriesKindKey(plot));
    if (plot.kind === 'fill') keep.add(seriesKindKey(plot, 'low'));
  }
  for (const [id, series] of [...bag]) {
    if (keep.has(id)) continue;
    try {
      chart.removeSeries(series);
    } catch {
      // already gone
    }
    bag.delete(id);
  }
  plots.forEach((plot, index) => {
    const color = plot.color ?? PLOT_COLORS[index % PLOT_COLORS.length];
    const width = (plot.linewidth && plot.linewidth > 0 ? Math.min(4, plot.linewidth) : 2) as 1 | 2 | 3 | 4;
    const lineStyle =
      plot.kind === 'hline' ? mapPlotLineStyle(plot.linestyle, LineStyle.Dashed) : mapPlotLineStyle(plot.linestyle);
    if (plot.kind === 'hline') {
      const windowed = windowedColumn(plot.values, plot);
      const price =
        windowed.find((v) => v !== null && Number.isFinite(v)) ??
        (typeof plot.histbase === 'number' ? plot.histbase : null);
      if (price === null) return;
      try {
        priceLines.push(
          candle.createPriceLine({
            price,
            color,
            lineWidth: width,
            lineStyle,
            axisLabelVisible: true,
            title: plot.id,
          }),
        );
      } catch {
        // stub
      }
      return;
    }
    if (plot.kind === 'barcolor' || plot.kind === 'shape') return;
    const key = seriesKindKey(plot);
    let series = bag.get(key);
    if (!series) {
      try {
        if (plot.kind === 'histogram' || plot.kind === 'bgcolor') {
          series = chart.addSeries(HistogramSeries, {
            color,
            priceLineVisible: false,
            lastValueVisible: plot.kind !== 'bgcolor',
            title: plot.id,
            base: plot.histbase ?? 0,
            priceScaleId: plot.kind === 'bgcolor' ? 'bg' : undefined,
          });
          if (plot.kind === 'bgcolor') {
            try {
              chart.priceScale('bg').applyOptions({ visible: false, borderVisible: false });
            } catch {
              // ignore
            }
          }
        } else if (plot.kind === 'area') {
          series = chart.addSeries(AreaSeries, {
            lineColor: color,
            topColor: color,
            bottomColor: 'transparent',
            lineWidth: width,
            lineStyle,
            priceLineVisible: false,
            lastValueVisible: true,
            title: plot.id,
          });
        } else if (plot.kind === 'fill') {
          series = chart.addSeries(AreaSeries, {
            lineColor: color,
            topColor: colorWithAlpha(color, 0.28),
            bottomColor: colorWithAlpha(color, 0.08),
            lineVisible: false,
            lineWidth: 1,
            lineStyle,
            priceLineVisible: false,
            lastValueVisible: false,
            title: plot.id,
          });
        } else if (plot.kind === 'plotbar') {
          series = chart.addSeries(BarSeries, {
            upColor: color,
            downColor: color,
            thinBars: true,
            openVisible: true,
            priceLineVisible: false,
            lastValueVisible: true,
            title: plot.id,
          });
        } else if (plot.kind === 'plotcandle') {
          const wick = plot.wickcolor ?? color;
          const border = plot.bordercolor ?? color;
          series = chart.addSeries(CandlestickSeries, {
            upColor: color,
            downColor: color,
            borderVisible: true,
            borderUpColor: border,
            borderDownColor: border,
            wickUpColor: wick,
            wickDownColor: wick,
            priceLineVisible: false,
            lastValueVisible: true,
            title: plot.id,
          });
        } else {
          series = chart.addSeries(LineSeries, {
            color,
            lineWidth: width,
            lineStyle,
            priceLineVisible: false,
            lastValueVisible: true,
            title: plot.id,
            lineType: plot.kind === 'step' ? LineType.WithSteps : LineType.Simple,
          });
        }
        bag.set(key, series);
      } catch {
        return;
      }
    }
    if (!series) return;
    try {
      if (plot.kind === 'plotbar' || plot.kind === 'plotcandle') {
        series.setData(toOhlcOverlayPoints(bars, plot, times));
      } else if (plot.kind === 'fill') {
        const band = toFillBandPoints(bars, plot, times);
        const upper = band.map((p) => ({ time: p.time, value: p.high, color: p.color }));
        series.setData(upper);
        const lowKey = seriesKindKey(plot, 'low');
        let lowerSeries = bag.get(lowKey);
        if (!lowerSeries) {
          try {
            lowerSeries = chart.addSeries(AreaSeries, {
              lineColor: color,
              topColor: 'transparent',
              bottomColor: 'transparent',
              lineVisible: false,
              lineWidth: 1,
              priceLineVisible: false,
              lastValueVisible: false,
              title: `${plot.id}:low`,
            });
            bag.set(lowKey, lowerSeries);
          } catch {
            lowerSeries = undefined;
          }
        }
        if (lowerSeries) {
          try {
            lowerSeries.setData(band.map((p) => ({ time: p.time, value: p.low, color: p.color })));
          } catch {
            // hostile
          }
        }
      } else {
        series.setData(toUtcPoints(bars, plot, times));
      }
    } catch {
      // hostile
    }
    try {
      if (plot.kind === 'line' || plot.kind === 'step' || plot.kind === 'area' || plot.kind === 'fill') {
        series.applyOptions({ lineStyle } as { lineStyle: LineStyle });
      }
    } catch {
      // options not supported on this series type
    }
  });
}

/**
 * Mount an LWC candlestick chart on `host`. Safe to call once per webview life.
 * Falls back to a data-attribute stub when createChart throws (tests / no canvas).
 */
export function createChartPainter(host: HTMLElement): ChartPainter {
  let disposed = false;
  let chart: IChartApi | null = null;
  let series: ISeriesApi<'Candlestick'> | null = null;
  const plotSeries = new Map<string, OverlaySeries>();
  const priceLines: IPriceLine[] = [];
  let markersApi: { setMarkers(markers: SeriesMarker<UTCTimestamp>[]): void } | null = null;
  let lastSeq = -1;
  let lastBars: ChartBar[] = [];
  let lastPlots: ChartPlotLine[] = [];
  let lastIndex = -1;
  let resizeObserver: ResizeObserver | null = null;

  const placeholder = host.querySelector('.chart-host__placeholder');

  try {
    chart = createChart(host, {
      autoSize: true,
      layout: chartLayoutOptions(),
      grid: {
        vertLines: { color: 'rgba(128,128,128,0.15)' },
        horzLines: { color: 'rgba(128,128,128,0.15)' },
      },
      leftPriceScale: { borderVisible: false, visible: false },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });
    series = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    if (placeholder) placeholder.remove();
    host.setAttribute('data-axis-paint', 'lwc');

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (disposed || !chart) return;
        try {
          chart.timeScale().fitContent();
        } catch {
          // ignore
        }
      });
      resizeObserver.observe(host);
    }
  } catch {
    chart = null;
    series = null;
    host.setAttribute('data-axis-paint', 'stub');
  }

  function sampleAt(index: number): ChartCrosshairSample {
    const bar = index >= 0 && index < lastBars.length ? (lastBars[index] ?? null) : null;
    const plots = lastPlots.map((plot) => ({
      id: plot.id,
      value: index >= 0 && index < plot.values.length ? (plot.values[index] ?? null) : null,
    }));
    return { bar, plots };
  }

  const rangeListeners = new Set<() => void>();
  const crosshairListeners = new Set<(sample: ChartCrosshairSample) => void>();
  const onRange = (): void => {
    for (const cb of [...rangeListeners]) {
      try {
        cb();
      } catch {
        // ignore listener errors
      }
    }
  };
  if (chart) {
    try {
      chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);
    } catch {
      // stub / hostile
    }
    try {
      chart.subscribeCrosshairMove((param) => {
        const time = param?.time;
        if (typeof time !== 'number') {
          lastIndex = lastBars.length - 1;
        } else {
          lastIndex = lastBars.findIndex((b) => b.time === time);
        }
        const sample = sampleAt(lastIndex);
        for (const cb of [...crosshairListeners]) {
          try {
            cb(sample);
          } catch {
            // ignore
          }
        }
      });
    } catch {
      // stub / hostile
    }
  }

  return {
    apply(state: ChartViewState): void {
      if (disposed) return;
      host.setAttribute('data-axis-init', state.ready ? '1' : '0');
      if (state.theme) host.setAttribute('data-axis-theme', state.theme);
      if (state.seriesKey) host.setAttribute('data-axis-series', state.seriesKey);
      host.setAttribute('data-axis-bar-count', String(state.bars.length));
      host.setAttribute('data-axis-seq', String(state.seq));
      host.setAttribute('data-axis-drawing-count', String(state.drawings.length));
      host.setAttribute('data-axis-plot-count', String(state.plots.length));
      host.setAttribute(
        'data-axis-plot-kinds',
        state.plots.map((p) => p.kind).join(','),
      );
      host.setAttribute('data-axis-engine-drawings', String(state.engineDrawings.length));
      host.setAttribute('data-axis-strategy-trades', String(state.strategy?.trades.length ?? 0));
      host.setAttribute(
        'data-axis-debug-bar',
        state.debugBarIndex === null ? '' : String(state.debugBarIndex),
      );
      lastBars = state.bars;
      lastPlots = state.plots;
      if (lastIndex < 0 || lastIndex >= lastBars.length) {
        lastIndex = lastBars.length - 1;
      }

      if (!series || !chart) {
        // Stub path — reducer already applied; attributes prove the round-trip.
        if (placeholder) {
          placeholder.textContent =
            state.bars.length > 0
              ? `AXIS chart · ${state.bars.length} bars`
              : 'AXIS chart host';
        }
        return;
      }
      const seqChanged = state.seq !== lastSeq;
      lastSeq = state.seq;
      try {
        if (seqChanged || state.bars.length === 0) {
          series.setData(applyBarColors(state.bars, state.plots));
        } else {
          series.setData(applyBarColors(state.bars, state.plots));
        }
        const overlayPlots = [...state.plots];
        const equity = state.strategy?.equity;
        if (equity && equity.some((v) => v !== null)) {
          overlayPlots.push({
            id: '__equity',
            values: equity,
            kind: 'line',
            color: '#fbbf24',
          });
        }
        applyPlotOverlays(chart, series, plotSeries, priceLines, state.bars, overlayPlots, state.times);
        if (state.debugBarIndex !== null) {
          const bar = state.bars[state.debugBarIndex];
          if (bar && Number.isFinite(bar.time) && Number.isFinite(bar.close)) {
            try {
              chart.setCrosshairPosition(bar.close, bar.time as UTCTimestamp, series);
            } catch {
              // LWC stub / detached
            }
          }
        }
        const markers = [
          ...strategyMarkersFromTrades(state.strategy),
          ...shapeMarkersFromPlots(state.bars, state.plots, state.times),
        ];
        if (!markersApi) {
          try {
            markersApi = createSeriesMarkers(series, markers) as {
              setMarkers(markers: SeriesMarker<UTCTimestamp>[]): void;
            };
          } catch {
            markersApi = null;
          }
        } else {
          try {
            markersApi.setMarkers(markers);
          } catch {
            // ignore
          }
        }
        if (state.bars.length > 0 && seqChanged) {
          chart.timeScale().fitContent();
        }
      } catch {
        // hostile / detached
      }
    },
    getChart(): IChartApi | null {
      return disposed ? null : chart;
    },
    getSeries(): ISeriesApi<'Candlestick'> | null {
      return disposed ? null : series;
    },
    onVisibleRangeChange(cb: () => void): () => void {
      rangeListeners.add(cb);
      return () => {
        rangeListeners.delete(cb);
      };
    },
    setPlotVisible(id: string, visible: boolean): void {
      if (disposed) return;
      const prefix = `${id}::`;
      for (const [key, line] of plotSeries) {
        if (key !== id && !key.startsWith(prefix)) continue;
        try {
          line.applyOptions({ visible });
        } catch {
          // stub / hostile
        }
      }
    },
    lastSample(): ChartCrosshairSample {
      return sampleAt(lastIndex >= 0 ? lastIndex : lastBars.length - 1);
    },
    onCrosshair(cb: (sample: ChartCrosshairSample) => void): () => void {
      crosshairListeners.add(cb);
      return () => {
        crosshairListeners.delete(cb);
      };
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      rangeListeners.clear();
      crosshairListeners.clear();
      try {
        chart?.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
      } catch {
        // ignore
      }
      try {
        resizeObserver?.disconnect();
      } catch {
        // ignore
      }
      resizeObserver = null;
      plotSeries.clear();
      try {
        chart?.remove();
      } catch {
        // ignore
      }
      chart = null;
      series = null;
    },
  };
}
