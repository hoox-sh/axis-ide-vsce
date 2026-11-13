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

/** HOOX AXIS chart palette — up, down, accent. Matches the HOOX AXIS theme. */
const AXIS_UP = '#3ddc97';
const AXIS_DOWN = '#f07178';
const AXIS_ACCENT = '#8b9cff';
const AXIS_WARN = '#e8b84a';

const PLOT_COLORS = [
  AXIS_ACCENT,
  '#6ee7f5',
  AXIS_UP,
  AXIS_WARN,
  AXIS_DOWN,
  '#c4b5fd',
];

/** Layout options — TradingView attribution logo off (VSIX NOTICE already ships). */
/**
 * Canvas scale text. A `var(...)` string is not a canvas color — LWC would
 * keep the dark default and the axis would disappear on the void chart.
 */
export function chartLayoutOptions(textColor = '#e8eaee'): {
  background: { type: ColorType; color: string };
  textColor: string;
  attributionLogo: false;
} {
  return {
    background: { type: ColorType.Solid, color: 'transparent' },
    textColor,
    attributionLogo: false,
  };
}

function resolvedTextColor(host: HTMLElement): string {
  try {
    const color = getComputedStyle(host).color.trim();
    if (color && !color.includes('var(') && color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') {
      return color;
    }
  } catch {
    // detached host
  }
  return '#e8eaee';
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

const EQUITY_PLOT_ID = '__equity';
const EQUITY_SCALE = 'equity';
/** Oscillators / volume that must not autoscale the candle price scale. */
const OSC_SCALE = 'osc';

function channelHex(color: string): [number, number, number] | null {
  const hex = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    return [
      Number.parseInt(hex.slice(1, 3), 16),
      Number.parseInt(hex.slice(3, 5), 16),
      Number.parseInt(hex.slice(5, 7), 16),
    ];
  }
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    return [
      Number.parseInt(hex[1] + hex[1], 16),
      Number.parseInt(hex[2] + hex[2], 16),
      Number.parseInt(hex[3] + hex[3], 16),
    ];
  }
  return null;
}

function colorWithAlpha(color: string, alpha: number): string {
  const rgb = channelHex(color);
  if (!rgb) return color;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

function luma(color: string): number | null {
  const rgb = channelHex(color);
  if (!rgb) return null;
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
}

/** Near-black strokes vanish on the void chart. Non-hex colors pass through. */
function readableOnDark(color: string, fallback: string): string {
  const y = luma(color);
  if (y === null) return color;
  return y < 0.18 ? fallback : color;
}

function mapChannels(color: string, fn: (channel: number) => number): string | null {
  const rgb = channelHex(color);
  if (!rgb) return null;
  const next = rgb.map((ch) => Math.max(0, Math.min(255, Math.round(fn(ch)))));
  return `rgb(${next[0]},${next[1]},${next[2]})`;
}

function downBodyColor(color: string): string {
  return mapChannels(color, (ch) => ch * 0.62) ?? color;
}

function liftColor(color: string): string {
  return mapChannels(color, (ch) => ch + (255 - ch) * 0.42) ?? color;
}

const PAINT_RANK: Record<string, number> = {
  bgcolor: 0,
  fill: 1,
  histogram: 2,
  area: 3,
  plotbar: 4,
  plotcandle: 5,
  step: 6,
  line: 7,
  hline: 8,
  barcolor: 9,
  shape: 10,
};

function paintRank(plot: ChartPlotLine): number {
  if (plot.id === EQUITY_PLOT_ID) return 30;
  return PAINT_RANK[plot.kind] ?? 6;
}

function plotLineStyle(plot: ChartPlotLine): LineStyle {
  if (plot.id === EQUITY_PLOT_ID) return mapPlotLineStyle(plot.linestyle, LineStyle.LargeDashed);
  if (plot.kind === 'hline') return mapPlotLineStyle(plot.linestyle, LineStyle.Dashed);
  return mapPlotLineStyle(plot.linestyle);
}

/**
 * Scale id when this series would squash candles.
 * Equity is always its own overlay. Histograms stay on the price scale only
 * when their values actually sit on the candle range (price columns).
 */
export function overlayPriceScaleId(plot: ChartPlotLine, bars: ChartBar[]): string | undefined {
  if (plot.id === EQUITY_PLOT_ID) return EQUITY_SCALE;
  if (plot.kind !== 'histogram') return undefined;
  let priceMin = Number.POSITIVE_INFINITY;
  let priceMax = Number.NEGATIVE_INFINITY;
  for (const bar of bars) {
    if (Number.isFinite(bar.low)) priceMin = Math.min(priceMin, bar.low);
    if (Number.isFinite(bar.high)) priceMax = Math.max(priceMax, bar.high);
  }
  if (!Number.isFinite(priceMin) || !Number.isFinite(priceMax)) return undefined;
  const nums = plot.values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (nums.length === 0) return undefined;
  const base = plot.histbase ?? 0;
  let hMin = base;
  let hMax = base;
  for (const value of nums) {
    hMin = Math.min(hMin, value);
    hMax = Math.max(hMax, value);
  }
  const priceSpan = Math.max(priceMax - priceMin, Math.abs(priceMax) * 0.02, 1e-9);
  const overlaps = hMax >= priceMin - priceSpan && hMin <= priceMax + priceSpan;
  const wide = hMax - hMin > priceSpan * 3;
  if (!overlaps || wide) return OSC_SCALE;
  return undefined;
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
      color: isEntry ? (isShort ? AXIS_DOWN : AXIS_UP) : AXIS_WARN,
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
        color: readableOnDark(plot.colors?.[i] ?? plot.color ?? AXIS_ACCENT, AXIS_ACCENT),
        shape,
        text: plot.text ?? plot.char ?? '',
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
    if (plot.kind === 'fill') {
      keep.add(seriesKindKey(plot, 'low'));
      keep.add(seriesKindKey(plot, 'band'));
    }
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
  const paintOrder = plots
    .map((plot, index) => ({ plot, index }))
    .sort((a, b) => paintRank(a.plot) - paintRank(b.plot) || a.index - b.index);
  for (const { plot, index } of paintOrder) {
    const fallback = PLOT_COLORS[index % PLOT_COLORS.length] ?? AXIS_ACCENT;
    const color = readableOnDark(plot.color ?? fallback, fallback);
    const width = (
      plot.linewidth && plot.linewidth > 0 ? Math.min(4, plot.linewidth) : plot.id === EQUITY_PLOT_ID ? 1 : 2
    ) as 1 | 2 | 3 | 4;
    const lineStyle = plotLineStyle(plot);
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
          const histScale = plot.kind === 'bgcolor' ? 'bg' : overlayPriceScaleId(plot, bars);
          const tint = plot.kind === 'bgcolor' ? 0.2 : 0.82;
          series = chart.addSeries(HistogramSeries, {
            color: colorWithAlpha(color, tint),
            priceLineVisible: false,
            lastValueVisible: plot.kind !== 'bgcolor' && !histScale,
            title: plot.id,
            base: plot.histbase ?? 0,
            ...(histScale ? { priceScaleId: histScale } : {}),
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
            topColor: colorWithAlpha(color, 0.32),
            bottomColor: colorWithAlpha(color, 0.04),
            relativeGradient: true,
            lineWidth: width,
            lineStyle,
            priceLineVisible: false,
            lastValueVisible: true,
            title: plot.id,
          });
        } else if (plot.kind === 'fill') {
          // Anchor series keeps the upper edge. The visible band is a bar body
          // between the two plots — an area series would flood to the pane bottom.
          series = chart.addSeries(AreaSeries, {
            lineColor: 'transparent',
            topColor: 'transparent',
            bottomColor: 'transparent',
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
            downColor: downBodyColor(color),
            thinBars: false,
            openVisible: true,
            priceLineVisible: false,
            lastValueVisible: true,
            title: plot.id,
          });
        } else if (plot.kind === 'plotcandle') {
          const wick = plot.wickcolor ? readableOnDark(plot.wickcolor, liftColor(color)) : liftColor(color);
          const border = plot.bordercolor ? readableOnDark(plot.bordercolor, color) : color;
          series = chart.addSeries(CandlestickSeries, {
            upColor: color,
            downColor: downBodyColor(color),
            borderVisible: true,
            borderUpColor: border,
            borderDownColor: downBodyColor(border),
            wickUpColor: wick,
            wickDownColor: wick,
            priceLineVisible: false,
            lastValueVisible: true,
            title: plot.id,
          });
        } else {
          const scaleId = overlayPriceScaleId(plot, bars);
          series = chart.addSeries(LineSeries, {
            color,
            lineWidth: width,
            lineStyle,
            priceLineVisible: false,
            lastValueVisible: plot.id !== EQUITY_PLOT_ID,
            title: plot.id === EQUITY_PLOT_ID ? '' : plot.id,
            ...(scaleId ? { priceScaleId: scaleId } : {}),
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
        const bandKey = seriesKindKey(plot, 'band');
        let bandSeries = bag.get(bandKey);
        if (!bandSeries) {
          try {
            const tint = colorWithAlpha(color, 0.34);
            bandSeries = chart.addSeries(BarSeries, {
              upColor: tint,
              downColor: tint,
              thinBars: false,
              openVisible: false,
              priceLineVisible: false,
              lastValueVisible: false,
              title: `${plot.id}:band`,
            });
            bag.set(bandKey, bandSeries);
          } catch {
            bandSeries = undefined;
          }
        }
        if (bandSeries) {
          try {
            bandSeries.setData(
              band.map((p) => ({
                time: p.time,
                open: p.open,
                high: p.high,
                low: p.low,
                close: p.close,
                color: p.color ? colorWithAlpha(p.color, 0.34) : undefined,
              })),
            );
          } catch {
            // hostile
          }
        }
      } else {
        const points = toUtcPoints(bars, plot, times);
        if (plot.kind === 'bgcolor' || plot.kind === 'histogram') {
          const alpha = plot.kind === 'bgcolor' ? 0.2 : 0.82;
          series.setData(
            points.map((p) => (p.color ? { ...p, color: colorWithAlpha(p.color, alpha) } : p)),
          );
        } else {
          series.setData(points);
        }
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
  }
  const scales = new Set<string>();
  for (const plot of plots) {
    if (plot.id === EQUITY_PLOT_ID) scales.add(EQUITY_SCALE);
    if (plot.kind === 'histogram') {
      const id = overlayPriceScaleId(plot, bars);
      if (id) scales.add(id);
    }
  }
  if (scales.has(EQUITY_SCALE)) {
    try {
      chart.priceScale(EQUITY_SCALE).applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 } });
    } catch {
      // stub
    }
  }
  if (scales.has(OSC_SCALE)) {
    try {
      chart.priceScale(OSC_SCALE).applyOptions({ scaleMargins: { top: 0.74, bottom: 0 } });
    } catch {
      // stub
    }
  }
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
      layout: chartLayoutOptions(resolvedTextColor(host)),
      grid: {
        vertLines: { color: 'rgba(128,128,128,0.15)' },
        horzLines: { color: 'rgba(128,128,128,0.15)' },
      },
      leftPriceScale: { borderVisible: false, visible: false },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });
    series = chart.addSeries(CandlestickSeries, {
      upColor: AXIS_UP,
      downColor: AXIS_DOWN,
      borderVisible: false,
      wickUpColor: AXIS_UP,
      wickDownColor: AXIS_DOWN,
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
        if (equity?.some((v) => v !== null)) {
          overlayPlots.push({
            id: EQUITY_PLOT_ID,
            values: equity,
            kind: 'line',
            color: AXIS_ACCENT,
            linewidth: 1,
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
