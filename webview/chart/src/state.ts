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
 * Pure chart webview reducer — apply chart.init / chart.full / chart.delta.
 * Bar wire shape matches host mock: `{ time, open, high, low, close, volume? }`
 * (also accepts short keys t/o/h/l/c/v).
 *
 * Seq gap on `chart.delta` → `requestReload: true` (post `chart.requestReload`).
 */

export interface ChartBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/** MVP user trendline (mirrors host CommittedTrendlineDrawing). */
export interface UserDrawing {
  id: string;
  tool: 'trendline';
  points: [{ time: number; price: number }, { time: number; price: number }];
}

export interface ChartPlugins {
  source?: string;
  stream?: string;
  engine?: string;
  storage?: string;
}

/** Paint kind — Pine plot() style + engine visual kinds. */
export type PlotPaintKind =
  | 'line'
  | 'histogram'
  | 'step'
  | 'area'
  | 'hline'
  | 'bgcolor'
  | 'barcolor'
  | 'shape'
  | 'fill'
  | 'plotbar'
  | 'plotcandle';

/** One overlay aligned to candle times (Pine `plot` / named `series`). */
export type ChartPlotLine = {
  id: string;
  values: (number | null)[];
  kind: PlotPaintKind;
  color?: string;
  linewidth?: number;
  histbase?: number;
  location?: string;
  text?: string;
  char?: string;
  /** Per-bar color (bgcolor / barcolor / shape). */
  colors?: (string | null)[];
  /** Pine `plot.linestyle_*` / `hline.style_*` (solid / dashed / dotted). */
  linestyle?: string;
  /** Pine `plot(..., offset=)` — bars to shift (positive = future). */
  offset?: number;
  /** Pine `plot(..., show_last=)` — keep only the last N bars. */
  showLast?: number;
  /** `fill(plot1, plot2)` edge titles. */
  plot1?: string;
  plot2?: string;
  /** Lower fill edge (upper is `values`). */
  fillLower?: (number | null)[];
  /** `plotbar` / `plotcandle` OHLC siblings (close is `values`). */
  open?: (number | null)[];
  high?: (number | null)[];
  low?: (number | null)[];
  wickcolor?: string;
  bordercolor?: string;
};

/** Engine `line` / `label` / `box` / `table` (not user trendlines). */
export interface EngineDrawing {
  type: string;
  t1?: number;
  p1?: number;
  t2?: number;
  p2?: number;
  t3?: number;
  p3?: number;
  t4?: number;
  p4?: number;
  color?: string;
  bgcolor?: string;
  width?: number;
  text?: string;
  textcolor?: string;
  style?: string;
  points?: Array<{ time: number; price: number }>;
  position?: string;
  rows?: number;
  columns?: number;
  cells?: Array<Record<string, unknown>>;
}

export interface StrategyTradeView {
  id: string;
  kind: string;
  direction?: string;
  qty?: number;
  time?: number;
  barIndex?: number;
  price?: number;
  comment?: string;
}

export interface StrategyView {
  trades: StrategyTradeView[];
  equity?: (number | null)[];
  stats: { trades: number; entries: number; exits: number; netProfit?: number };
}

export interface ChartInputDef {
  title: string;
  type: string;
  value: unknown;
  defval?: unknown;
}

export interface ChartViewState {
  seriesKey: string;
  theme: string;
  panes: unknown;
  bars: ChartBar[];
  /** User drawings from chart.init / user-shaped chart.full batches. */
  drawings: UserDrawing[];
  /** Engine drawings (line/label/box/table) — never wipe user trendlines. */
  engineDrawings: EngineDrawing[];
  /** Script plots from `chart.full` (painted as LWC overlays by kind). */
  plots: ChartPlotLine[];
  seq: number;
  ready: boolean;
  /** Active plugin ids (HUD chips); omitted until chart.init / host.run.status. */
  plugins?: ChartPlugins;
  inputs: ChartInputDef[];
  strategy?: StrategyView;
  times?: number[];
  window?: { fromBar?: number; toBar?: number; bars?: number; totalBars?: number };
  alertsCount: number;
  /** Bar debugger cursor (overlay). `null` = hidden. */
  debugBarIndex: number | null;
  /** Static lookahead grep from chart.full (P8). */
  lookahead?: {
    static: true;
    tainted: boolean;
    hits: Array<{ kind: string; line: number; col: number; text: string }>;
    note?: string;
  };
}

/** Outcome of one host message — gap sets `requestReload`. */
export type ChartReduceOutcome = {
  state: ChartViewState;
  /** Webview should post `chart.requestReload` (seq gap / unsafe delta). */
  requestReload: boolean;
};

export function initialChartState(): ChartViewState {
  return {
    seriesKey: '',
    theme: '',
    panes: null,
    bars: [],
    drawings: [],
    engineDrawings: [],
    plots: [],
    seq: 0,
    ready: false,
    inputs: [],
    alertsCount: 0,
    debugBarIndex: null,
    lookahead: undefined,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sampleToNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (isPlainObject(raw)) {
    return num(raw.value) ?? num(raw.v) ?? num(raw.close);
  }
  return null;
}

function numericColumn(raw: unknown): (number | null)[] | null {
  if (!Array.isArray(raw)) return null;
  const values = raw.map(sampleToNumber);
  if (!values.some((v) => v !== null)) return null;
  return values;
}

function colorSample(raw: unknown): string | null {
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (isPlainObject(raw)) {
    const c = raw.color ?? raw.c;
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

function colorColumn(raw: unknown): (string | null)[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const values = raw.map(colorSample);
  if (!values.some((v) => v !== null)) return undefined;
  return values;
}

function metaMap(plotMeta: unknown): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  if (isPlainObject(plotMeta)) {
    for (const [key, value] of Object.entries(plotMeta)) {
      if (isPlainObject(value)) out[key] = value;
    }
  } else if (Array.isArray(plotMeta)) {
    plotMeta.forEach((entry, i) => {
      if (!isPlainObject(entry)) return;
      const id =
        typeof entry.title === 'string'
          ? entry.title
          : typeof entry.id === 'string'
            ? entry.id
            : `plot${i}`;
      out[id] = entry;
    });
  }
  return out;
}

/** Map engine `kind` + Pine `style` onto an LWC paint kind. */
export function resolvePlotPaintKind(meta?: Record<string, unknown>): PlotPaintKind {
  const kind = String(meta?.kind ?? meta?.type ?? 'plot').toLowerCase();
  if (kind === 'hline') return 'hline';
  if (kind === 'bgcolor') return 'bgcolor';
  if (kind === 'barcolor') return 'barcolor';
  if (kind === 'fill') return 'fill';
  if (kind === 'plotbar') return 'plotbar';
  if (kind === 'plotcandle') return 'plotcandle';
  if (kind === 'plotshape' || kind === 'plotchar' || kind === 'plotarrow' || kind === 'shape') {
    return 'shape';
  }
  const style = String(meta?.style ?? '')
    .toLowerCase()
    .replace(/^plot\.style_/, '')
    .replace(/^style_/, '');
  if (style === 'histogram' || style === 'columns' || style === 'histogram_unscaled') {
    return 'histogram';
  }
  if (style === 'stepline' || style === 'step' || style === 'stepline_diamond') return 'step';
  if (style === 'area' || style === 'areabr' || style === 'linebr') {
    return style === 'area' || style === 'areabr' ? 'area' : 'line';
  }
  if (style === 'bars') return 'plotbar';
  if (style === 'candles') return 'plotcandle';
  return 'line';
}

function metaString(meta: Record<string, unknown> | undefined, key: string): string | undefined {
  const v = meta?.[key];
  return typeof v === 'string' && v.trim() ? v : undefined;
}

function finishPlot(
  id: string,
  values: (number | null)[],
  meta: Record<string, unknown> | undefined,
  colors?: (string | null)[],
): ChartPlotLine {
  const plot: ChartPlotLine = { id, values, kind: resolvePlotPaintKind(meta) };
  if (meta) {
    const color = typeof meta.color === 'string' ? meta.color : undefined;
    if (color) plot.color = color;
    const lw = num(meta.linewidth);
    if (lw !== null) plot.linewidth = lw;
    const hb = num(meta.histbase);
    if (hb !== null) plot.histbase = hb;
    if (typeof meta.location === 'string') plot.location = meta.location;
    if (typeof meta.text === 'string') plot.text = meta.text;
    if (typeof meta.char === 'string') plot.char = meta.char;
    const ls = metaString(meta, 'linestyle') ?? metaString(meta, 'lineStyle');
    if (ls) plot.linestyle = ls;
    const off = num(meta.offset);
    if (off !== null) plot.offset = Math.trunc(off);
    const sl = num(meta.show_last) ?? num(meta.showLast);
    if (sl !== null) plot.showLast = Math.trunc(sl);
    const p1 = metaString(meta, 'plot1');
    const p2 = metaString(meta, 'plot2');
    if (p1) plot.plot1 = p1;
    if (p2) plot.plot2 = p2;
    const wick = metaString(meta, 'wickcolor') ?? metaString(meta, 'wickColor');
    const border = metaString(meta, 'bordercolor') ?? metaString(meta, 'borderColor');
    if (wick) plot.wickcolor = wick;
    if (border) plot.bordercolor = border;
  }
  if (colors) plot.colors = colors;
  return plot;
}

function ohlcLinkedKeys(meta: Record<string, Record<string, unknown>>): Set<string> {
  const skip = new Set<string>();
  for (const [id, m] of Object.entries(meta)) {
    const kind = resolvePlotPaintKind(m);
    if (kind !== 'plotbar' && kind !== 'plotcandle') continue;
    for (const key of ['open', 'high', 'low'] as const) {
      const ref = metaString(m, key);
      if (ref && ref !== id) skip.add(ref);
    }
    skip.add(`${id}.open`);
    skip.add(`${id}.high`);
    skip.add(`${id}.low`);
  }
  return skip;
}

function seriesLookup(
  series: Record<string, unknown> | undefined,
  plots: ChartPlotLine[],
  ref?: string,
): (number | null)[] | undefined {
  if (!ref) return undefined;
  const fromPlot = plots.find((p) => p.id === ref);
  if (fromPlot?.values.some((v) => v !== null)) return fromPlot.values;
  if (!series) return undefined;
  return numericColumn(series[ref]) ?? undefined;
}

/**
 * Pine `offset` (positive = future) then `show_last` (keep last N slots).
 * Length is preserved so index zip with bars/`times` stays stable.
 */
export function applyPlotWindow<T>(
  values: readonly T[],
  offset?: number,
  showLast?: number,
): (T | null)[] {
  const n = values.length;
  const off = typeof offset === 'number' && Number.isFinite(offset) ? Math.trunc(offset) : 0;
  const shifted: (T | null)[] = new Array(n).fill(null);
  if (off === 0) {
    for (let i = 0; i < n; i++) shifted[i] = values[i] as T;
  } else {
    for (let i = 0; i < n; i++) {
      const j = i + off;
      if (j < 0 || j >= n) continue;
      shifted[j] = values[i] as T;
    }
  }
  if (typeof showLast !== 'number' || !Number.isFinite(showLast) || showLast <= 0) {
    return shifted;
  }
  const start = Math.max(0, n - Math.trunc(showLast));
  for (let i = 0; i < start; i++) shifted[i] = null;
  return shifted;
}

/**
 * Flatten engine `plots` / `series` / `plot_meta` into overlay specs (never throws).
 * Accepts a number[], list of columns, or `{ name: number[] }` maps.
 */
export function normalizePlotLines(
  plots: unknown,
  series?: unknown,
  plotMeta?: unknown,
): ChartPlotLine[] {
  try {
    const meta = metaMap(plotMeta);
    const seriesMap = isPlainObject(series) ? series : undefined;
    const skip = ohlcLinkedKeys(meta);
    const out: ChartPlotLine[] = [];
    const seen = new Set<string>();
    const push = (id: string, raw: unknown, forceKind?: PlotPaintKind): void => {
      const key = id.trim() || `plot${out.length}`;
      if (seen.has(key) || key.startsWith('_') || skip.has(key)) return;
      const m = meta[key];
      const kind = forceKind ?? resolvePlotPaintKind(m);
      const colors = colorColumn(raw);
      const values =
        numericColumn(raw) ??
        ((kind === 'bgcolor' || kind === 'barcolor' || kind === 'shape') && colors
          ? colors.map(() => 1)
          : null);
      if (kind === 'fill') {
        seen.add(key);
        out.push(finishPlot(key, values ?? [], m, colors));
        return;
      }
      if (!values && !colors) return;
      seen.add(key);
      const paintColors =
        kind === 'bgcolor' || kind === 'barcolor' || kind === 'shape' || kind === 'plotbar' || kind === 'plotcandle'
          ? colors
          : undefined;
      out.push(finishPlot(key, values ?? [], m, paintColors));
    };
    if (Array.isArray(plots)) {
      const asColumn = numericColumn(plots);
      const looksNested = plots.some((p) => Array.isArray(p) || isPlainObject(p));
      if (asColumn && !looksNested) {
        push('plot', plots);
      } else {
        plots.forEach((entry, i) => {
          if (Array.isArray(entry)) {
            push(`plot${i}`, entry);
            return;
          }
          if (isPlainObject(entry)) {
            const id =
              typeof entry.id === 'string'
                ? entry.id
                : typeof entry.title === 'string'
                  ? entry.title
                  : `plot${i}`;
            push(id, entry.values ?? entry.data ?? entry.y ?? entry);
          }
        });
      }
    } else if (isPlainObject(plots)) {
      for (const [key, value] of Object.entries(plots)) push(key, value);
    }
    if (seriesMap) {
      for (const [key, value] of Object.entries(seriesMap)) push(key, value);
    }
    for (const [key, m] of Object.entries(meta)) {
      if (seen.has(key) || skip.has(key) || key.startsWith('_')) continue;
      if (resolvePlotPaintKind(m) === 'fill') push(key, seriesMap?.[key], 'fill');
    }
    for (const plot of out) {
      const m = meta[plot.id];
      if (plot.kind === 'plotbar' || plot.kind === 'plotcandle') {
        const open = seriesLookup(seriesMap, out, metaString(m, 'open') ?? `${plot.id}.open`);
        const high = seriesLookup(seriesMap, out, metaString(m, 'high') ?? `${plot.id}.high`);
        const low = seriesLookup(seriesMap, out, metaString(m, 'low') ?? `${plot.id}.low`);
        if (open) plot.open = open;
        if (high) plot.high = high;
        if (low) plot.low = low;
      }
      if (plot.kind === 'fill') {
        const p1 = plot.plot1 ?? metaString(m, 'plot1');
        const p2 = plot.plot2 ?? metaString(m, 'plot2');
        const edge1 =
          seriesLookup(seriesMap, out, p1) ??
          seriesLookup(seriesMap, out, `${plot.id}.plot1`) ??
          seriesLookup(seriesMap, out, `${plot.id}.upper`);
        const edge2 =
          seriesLookup(seriesMap, out, p2) ??
          seriesLookup(seriesMap, out, `${plot.id}.plot2`) ??
          seriesLookup(seriesMap, out, `${plot.id}.lower`);
        if (edge1) plot.values = edge1;
        if (edge2) plot.fillLower = edge2;
        if (p1) plot.plot1 = p1;
        if (p2) plot.plot2 = p2;
      }
    }
    return out.filter((p) => {
      if (p.kind === 'fill') {
        return p.values.some((v) => v !== null) && (p.fillLower?.some((v) => v !== null) ?? false);
      }
      return true;
    });
  } catch {
    return [];
  }
}

export function normalizeEngineDrawings(raw: unknown): EngineDrawing[] {
  try {
    if (!Array.isArray(raw)) return [];
    const out: EngineDrawing[] = [];
    for (const entry of raw) {
      if (!isPlainObject(entry)) continue;
      if (typeof entry.tool === 'string') continue;
      const type = String(entry.type ?? entry.kind ?? '').trim().toLowerCase();
      if (!type) continue;
      const d: EngineDrawing = { type };
      for (const k of ['t1', 'p1', 't2', 'p2', 't3', 'p3', 't4', 'p4', 'width'] as const) {
        const n = num(entry[k]);
        if (n !== null) (d as unknown as Record<string, unknown>)[k] = n;
      }
      if (typeof entry.color === 'string') d.color = entry.color;
      if (typeof entry.bgcolor === 'string') d.bgcolor = entry.bgcolor;
      if (typeof entry.text === 'string') d.text = entry.text;
      if (typeof entry.textcolor === 'string') d.textcolor = entry.textcolor;
      if (typeof entry.style === 'string') d.style = entry.style;
      if (typeof entry.position === 'string') d.position = entry.position;
      const rows = num(entry.rows);
      if (rows !== null) d.rows = rows;
      const cols = num(entry.columns);
      if (cols !== null) d.columns = cols;
      if (Array.isArray(entry.points)) {
        const pts: Array<{ time: number; price: number }> = [];
        for (const p of entry.points) {
          if (!isPlainObject(p)) continue;
          const time = num(p.time) ?? num(p.t);
          const price = num(p.price) ?? num(p.p);
          if (time === null || price === null) continue;
          pts.push({ time, price });
        }
        if (pts.length) d.points = pts;
      }
      if (Array.isArray(entry.cells)) {
        d.cells = entry.cells.filter((c) => isPlainObject(c)) as Array<Record<string, unknown>>;
      }
      out.push(d);
    }
    return out;
  } catch {
    return [];
  }
}

export function normalizeInputs(raw: unknown): ChartInputDef[] {
  try {
    const out: ChartInputDef[] = [];
    if (Array.isArray(raw)) {
      for (const entry of raw) {
        if (!isPlainObject(entry)) continue;
        const title = String(entry.title ?? entry.id ?? '').trim();
        if (!title) continue;
        out.push({
          title,
          type: String(entry.type ?? 'any'),
          value: entry.value ?? entry.defval ?? entry.default,
          defval: entry.defval ?? entry.default,
        });
      }
      return out;
    }
    if (isPlainObject(raw)) {
      for (const [title, value] of Object.entries(raw)) {
        if (!title.trim()) continue;
        out.push({ title, type: typeof value, value });
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function normalizeStrategy(raw: unknown): StrategyView | undefined {
  try {
    if (!isPlainObject(raw)) return undefined;
    const tradesRaw = Array.isArray(raw.trades) ? raw.trades : [];
    const trades: StrategyTradeView[] = [];
    for (const entry of tradesRaw) {
      if (!isPlainObject(entry)) continue;
      const id = typeof entry.id === 'string' ? entry.id : `t${trades.length}`;
      const kind = typeof entry.kind === 'string' ? entry.kind : '';
      if (!kind) continue;
      const t: StrategyTradeView = { id, kind };
      if (typeof entry.direction === 'string') t.direction = entry.direction;
      const qty = num(entry.qty);
      if (qty !== null) t.qty = qty;
      const time = num(entry.time);
      if (time !== null) t.time = time;
      const barIndex = num(entry.barIndex) ?? num(entry.bar_index);
      if (barIndex !== null) t.barIndex = barIndex;
      const price = num(entry.price);
      if (price !== null) t.price = price;
      if (typeof entry.comment === 'string') t.comment = entry.comment;
      trades.push(t);
    }
    const equity = numericColumn(raw.equity);
    const statsRaw = isPlainObject(raw.stats) ? raw.stats : {};
    const stats = {
      trades: num(statsRaw.trades) ?? trades.length,
      entries: num(statsRaw.entries) ?? trades.filter((t) => t.kind === 'entry').length,
      exits:
        num(statsRaw.exits) ??
        trades.filter((t) => t.kind === 'exit' || t.kind === 'close' || t.kind === 'close_all').length,
      netProfit: num(statsRaw.netProfit) ?? undefined,
    };
    if (trades.length === 0 && !equity) return undefined;
    const view: StrategyView = { trades, stats };
    if (equity) view.equity = equity;
    return view;
  } catch {
    return undefined;
  }
}

export function normalizeWindow(
  raw: unknown,
): { fromBar?: number; toBar?: number; bars?: number; totalBars?: number } | undefined {
  if (!isPlainObject(raw)) return undefined;
  const fromBar = num(raw.fromBar) ?? num(raw.from_bar);
  const toBar = num(raw.toBar) ?? num(raw.to_bar);
  const bars = num(raw.bars);
  const totalBars = num(raw.totalBars) ?? num(raw.total_bars);
  if (fromBar === null && toBar === null && bars === null && totalBars === null) return undefined;
  const out: { fromBar?: number; toBar?: number; bars?: number; totalBars?: number } = {};
  if (fromBar !== null) out.fromBar = fromBar;
  if (toBar !== null) out.toBar = toBar;
  if (bars !== null) out.bars = bars;
  if (totalBars !== null) out.totalBars = totalBars;
  return out;
}

/** Bar unix-seconds for overlay index `i` (engine `times` may be ms). */
export function plotTimeAt(i: number, bars: ChartBar[], times?: number[]): number | null {
  if (times && times.length > 0) {
    if (i < 0 || i >= times.length) return null;
    let t = times[i] ?? 0;
    if (t > 1e11) t = Math.round(t / 1000);
    if (bars.some((b) => b.time === t)) return t;
    const bar = bars[i];
    return bar ? bar.time : null;
  }
  const bar = bars[i];
  return bar ? bar.time : null;
}

/** Align a plot column to bar unix-seconds (engine `times` may be ms). */
export function plotPoints(
  bars: ChartBar[],
  values: (number | null)[],
  times?: number[],
): Array<{ time: number; value: number }> {
  const out: Array<{ time: number; value: number }> = [];
  const n = times && times.length > 0 ? Math.min(times.length, values.length) : Math.min(bars.length, values.length);
  for (let i = 0; i < n; i++) {
    const value = values[i];
    if (value === null || !Number.isFinite(value)) continue;
    const time = plotTimeAt(i, bars, times);
    if (time === null || !Number.isFinite(time)) continue;
    out.push({ time, value });
  }
  return out;
}

function normalizeDrawingPoint(raw: unknown): { time: number; price: number } | null {
  if (!isPlainObject(raw)) return null;
  const time = num(raw.time) ?? num(raw.t);
  const price = num(raw.price) ?? num(raw.p);
  if (time === null || price === null) return null;
  return { time, price };
}

/**
 * True when a drawings batch is user-tool shaped (empty or every entry has `tool`).
 * Script/engine batches omit `tool` and must not wipe user drawings.
 */
export function isUserDrawingBatch(raw: unknown): boolean {
  if (!Array.isArray(raw)) return false;
  if (raw.length === 0) return true;
  for (const entry of raw) {
    if (!isPlainObject(entry) || typeof entry.tool !== 'string') return false;
  }
  return true;
}

/** Keep only valid MVP trendlines. */
export function normalizeUserDrawings(raw: unknown): UserDrawing[] {
  try {
    if (!Array.isArray(raw)) return [];
    const out: UserDrawing[] = [];
    for (const entry of raw) {
      if (!isPlainObject(entry)) continue;
      const id = typeof entry.id === 'string' ? entry.id.trim() : '';
      const tool = typeof entry.tool === 'string' ? entry.tool.trim() : '';
      if (!id || tool !== 'trendline' || !Array.isArray(entry.points) || entry.points.length < 2) {
        continue;
      }
      const a = normalizeDrawingPoint(entry.points[0]);
      const b = normalizeDrawingPoint(entry.points[1]);
      if (!a || !b) continue;
      out.push({ id, tool: 'trendline', points: [a, b] });
    }
    return out;
  } catch {
    return [];
  }
}

export function normalizeLookahead(
  raw: unknown,
): ChartViewState['lookahead'] | undefined {
  if (!isPlainObject(raw)) return undefined;
  const hitsRaw = Array.isArray(raw.hits) ? raw.hits : [];
  const hits: Array<{ kind: string; line: number; col: number; text: string }> = [];
  for (const h of hitsRaw) {
    if (!isPlainObject(h)) continue;
    const line = num(h.line);
    const col = num(h.col);
    if (line === null || col === null) continue;
    hits.push({
      kind: typeof h.kind === 'string' ? h.kind : 'security',
      line,
      col,
      text: typeof h.text === 'string' ? h.text : '',
    });
  }
  const tainted = raw.tainted === true || hits.length > 0;
  return {
    static: true,
    tainted,
    hits,
    note: typeof raw.note === 'string' ? raw.note : undefined,
  };
}

/** Normalize one bar; returns null when OHLC/time are unusable. */
export function normalizeBar(raw: unknown): ChartBar | null {
  try {
    if (!isPlainObject(raw)) return null;
    const time = num(raw.time) ?? num(raw.t);
    const open = num(raw.open) ?? num(raw.o);
    const high = num(raw.high) ?? num(raw.h);
    const low = num(raw.low) ?? num(raw.l);
    const close = num(raw.close) ?? num(raw.c);
    if (
      time === null ||
      open === null ||
      high === null ||
      low === null ||
      close === null
    ) {
      return null;
    }
    const volume = num(raw.volume) ?? num(raw.v) ?? undefined;
    const bar: ChartBar = { time, open, high, low, close };
    if (volume !== undefined) bar.volume = volume;
    return bar;
  } catch {
    return null;
  }
}

/** Replace-series normalize for chart.full.bars (skips invalid entries). */
export function normalizeBars(raw: unknown): ChartBar[] {
  try {
    if (!Array.isArray(raw)) return [];
    const out: ChartBar[] = [];
    for (const entry of raw) {
      const bar = normalizeBar(entry);
      if (bar) out.push(bar);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Merge `tail` onto `bars` at `baseIndex` (slice head + concat tail).
 * Returns null when baseIndex is out of range.
 */
export function mergeBarTail(
  bars: ChartBar[],
  baseIndex: number,
  tail: ChartBar[],
): ChartBar[] | null {
  if (!Number.isFinite(baseIndex) || baseIndex < 0 || baseIndex > bars.length) {
    return null;
  }
  if (baseIndex === 0) return tail.slice();
  return bars.slice(0, baseIndex).concat(tail);
}

/**
 * Classify delta seq vs last applied seq.
 * - continuous: seq === lastSeq + 1
 * - duplicate: seq === lastSeq
 * - gap: anything else (including delta before first full)
 */
export function classifyDeltaSeq(
  lastSeq: number,
  seq: number,
): 'continuous' | 'duplicate' | 'gap' {
  if (!(typeof lastSeq === 'number' && Number.isFinite(lastSeq))) return 'gap';
  if (!(typeof seq === 'number' && Number.isFinite(seq))) return 'gap';
  if (lastSeq <= 0) return 'gap';
  if (seq === lastSeq + 1) return 'continuous';
  if (seq === lastSeq) return 'duplicate';
  return 'gap';
}

const PLUGIN_CHIP_ORDER = [
  ['source', 'src'],
  ['stream', 'stm'],
  ['engine', 'eng'],
  ['storage', 'sto'],
] as const;

/** Normalize plugin ids; unknown keys ignored. Arrays / non-objects → undefined. */
export function pickChartPlugins(raw: unknown): ChartPlugins | undefined {
  if (!isPlainObject(raw)) return undefined;
  const out: ChartPlugins = {};
  for (const [key] of PLUGIN_CHIP_ORDER) {
    const v = raw[key];
    if (typeof v !== 'string') continue;
    const trimmed = v.trim();
    if (trimmed) out[key] = trimmed;
  }
  return out;
}

/** Chip specs stub — plugins removed in lightweight core. */
export function pluginChipSpecs(
  _plugins: ChartPlugins | undefined,
): Array<{
  kind: (typeof PLUGIN_CHIP_ORDER)[number][0];
  prefix: (typeof PLUGIN_CHIP_ORDER)[number][1];
  id: string;
}> {
  return [];
}

function applyDelta(
  state: ChartViewState,
  payload: Record<string, unknown>,
): ChartReduceOutcome {
  const seq = num(payload.seq);
  const baseIndex = num(payload.baseIndex) ?? num(payload.base_index);
  if (seq === null || baseIndex === null || !('tail' in payload)) {
    // Malformed — ignore without thrashing reload.
    return { state, requestReload: false };
  }

  const kind = classifyDeltaSeq(state.seq, seq);
  if (kind === 'duplicate') {
    return { state, requestReload: false };
  }
  if (kind === 'gap') {
    return { state, requestReload: true };
  }

  const tail = normalizeBars(payload.tail);
  const merged = mergeBarTail(state.bars, baseIndex, tail);
  if (merged === null) {
    return { state, requestReload: true };
  }
  return {
    state: { ...state, bars: merged, seq },
    requestReload: false,
  };
}

/**
 * Apply one decoded host message. Unknown types leave state unchanged.
 * `chart.full` replaces `bars` + `seq`.
 * `chart.delta` merges `tail` at `baseIndex`; seq gap → `requestReload`.
 */
export function applyChartHostMessage(
  state: ChartViewState,
  type: string,
  payload: Record<string, unknown>,
): ChartReduceOutcome {
  try {
    if (type === 'chart.init') {
      const drawings =
        'drawings' in payload ? normalizeUserDrawings(payload.drawings) : [];
      const next: ChartViewState = {
        ...state,
        ready: true,
        // Clear prior series on re-init; chart.full (possibly empty) follows.
        bars: [],
        plots: [],
        engineDrawings: [],
        strategy: undefined,
        times: undefined,
        window: undefined,
        alertsCount: 0,
        seq: 0,
        debugBarIndex: null,
        lookahead: undefined,
        drawings,
        inputs: 'inputs' in payload ? normalizeInputs(payload.inputs) : [],
        theme: typeof payload.theme === 'string' ? payload.theme : state.theme,
        seriesKey:
          typeof payload.seriesKey === 'string' ? payload.seriesKey : state.seriesKey,
        panes: 'panes' in payload ? payload.panes : state.panes,
      };
      if ('plugins' in payload) {
        const plugins = pickChartPlugins(payload.plugins);
        if (plugins) next.plugins = plugins;
      }
      return {
        state: next,
        requestReload: false,
      };
    }
    if (type === 'chart.full') {
      const seq = num(payload.seq);
      const plotMeta = payload.plotMeta ?? payload.plot_meta;
      const next: ChartViewState = {
        ...state,
        bars: normalizeBars(payload.bars),
        plots: normalizePlotLines(payload.plots, payload.series, plotMeta),
        seq: seq === null ? state.seq : seq,
      };
      // Only replace user drawings when the batch is user-tool shaped.
      if ('drawings' in payload && isUserDrawingBatch(payload.drawings)) {
        next.drawings = normalizeUserDrawings(payload.drawings);
      } else if ('drawings' in payload) {
        next.engineDrawings = normalizeEngineDrawings(payload.drawings);
      }
      if ('inputs' in payload) next.inputs = normalizeInputs(payload.inputs);
      if ('strategy' in payload) next.strategy = normalizeStrategy(payload.strategy);
      if ('times' in payload && Array.isArray(payload.times)) {
        next.times = payload.times
          .map((t) => num(t))
          .filter((t): t is number => t !== null);
      }
      if ('window' in payload) next.window = normalizeWindow(payload.window);
      if ('alerts' in payload) {
        next.alertsCount = Array.isArray(payload.alerts) ? payload.alerts.length : 0;
      }
      if ('lookahead' in payload) {
        next.lookahead = normalizeLookahead(payload.lookahead);
      }
      return { state: next, requestReload: false };
    }
    if (type === 'chart.delta') {
      return applyDelta(state, payload);
    }
    if (type === 'host.run.status') {
      if (!('plugins' in payload)) {
        return { state, requestReload: false };
      }
      const plugins = pickChartPlugins(payload.plugins);
      if (!plugins) {
        return { state, requestReload: false };
      }
      return { state: { ...state, plugins }, requestReload: false };
    }
    if (type === 'chart.debugCursor') {
      const idx = num(payload.barIndex);
      return {
        state: { ...state, debugBarIndex: idx },
        requestReload: false,
      };
    }
    return { state, requestReload: false };
  } catch {
    return { state, requestReload: false };
  }
}

/**
 * Apply one decoded host message (state only). Prefer {@link applyChartHostMessage}
 * when the caller must honour seq-gap → `chart.requestReload`.
 */
export function reduceChartMessage(
  state: ChartViewState,
  type: string,
  payload: Record<string, unknown>,
): ChartViewState {
  return applyChartHostMessage(state, type, payload).state;
}
