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
 * AXIS chart webview: ready handshake → chart.init / chart.full / chart.delta.
 * Seq gap on delta → post chart.requestReload (host resume stub).
 * MVP trendline: toolbar → drawing.setTool; two clicks → drawing.commit.
 */

import '../../shared/tokens.css';
import './style.css';
import {
  TOOL_TRENDLINE,
  createDrawingOverlay,
  createLwcCoordAdapter,
  createTrendlinePlacer,
  type DrawingOverlay,
} from './drawings';
import { createChartPainter, type ChartCrosshairSample, type ChartPainter } from './paint';
import { bootPyodideCdnWorker } from './pyodide-boot';
import { decodeHostMessage, PROTOCOL_VERSION } from './protocol';
import {
  applyChartHostMessage,
  initialChartState,
  type ChartViewState,
  type UserDrawing,
} from './state';
import {
  buildStrategyReport,
  formatPercent,
  formatPlain,
  formatProfitFactor,
  formatResult,
  formatSigned,
  parseSide,
  parseStrategyFilter,
  strategyTradesCsv,
  tradeMatchesFilter,
  type MetricTrade,
  type RoundTrip,
  type StrategyReport,
  type StrategyTableFilter,
} from './strategy-metrics';

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

let disposed = false;
let state: ChartViewState = initialChartState();
let painter: ChartPainter | null = null;
let overlay: DrawingOverlay | null = null;
let apiRef: VsCodeApi | null = null;
let rangeUnsub: (() => void) | null = null;
let crosshairUnsub: (() => void) | null = null;
const placer = createTrendlinePlacer();
const hiddenPlots = new Set<string>();
const OPEN_SOURCE_TOOL = 'open-source';
/** Hide overlays when static lookahead grep fired. Not a live-safe proof. */
let liveSafe = false;
/** Table-only filter. Round trips and metric cards stay on the full list. */
let strategyFilter: StrategyTableFilter = 'all';
/** Skip rebuilding inputs while the host payload is unchanged (keeps typed edits). */
let lastInputsFp = '';

function postReady(api: VsCodeApi): void {
  if (disposed) return;
  api.postMessage({
    v: PROTOCOL_VERSION,
    type: 'webview.ready',
    payload: {
      view: 'chart',
      capabilities: [
        'chart-shell',
        'chart-full',
        'chart-delta',
        'drawing-trendline',
        'plot-kinds',
        'strategy',
        'inputs',
      ],
    },
    ts: Date.now(),
  });
}

function postRequestReload(api: VsCodeApi): void {
  if (disposed) return;
  try {
    api.postMessage({
      v: PROTOCOL_VERSION,
      type: 'chart.requestReload',
      payload: {},
      ts: Date.now(),
    });
  } catch {
    // host may be gone
  }
}

function postSetTool(api: VsCodeApi, tool: string): void {
  if (disposed) return;
  try {
    api.postMessage({
      v: PROTOCOL_VERSION,
      type: 'drawing.setTool',
      payload: { tool },
      ts: Date.now(),
    });
  } catch {
    // host may be gone
  }
}

function postViewport(api: VsCodeApi): void {
  if (disposed) return;
  const chart = painter?.getChart();
  if (!chart) return;
  let range: { from: number; to: number } | null = null;
  try {
    range = chart.timeScale().getVisibleLogicalRange() as { from: number; to: number } | null;
  } catch {
    return;
  }
  if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to)) return;
  try {
    api.postMessage({
      v: PROTOCOL_VERSION,
      type: 'chart.viewport',
      payload: { from: range.from, to: range.to },
      ts: Date.now(),
    });
  } catch {
    // host may be gone
  }
}

function postCommit(api: VsCodeApi, drawing: UserDrawing): void {
  if (disposed) return;
  try {
    api.postMessage({
      v: PROTOCOL_VERSION,
      type: 'drawing.commit',
      payload: {
        id: drawing.id,
        tool: drawing.tool,
        points: [
          { time: drawing.points[0].time, price: drawing.points[0].price },
          { time: drawing.points[1].time, price: drawing.points[1].price },
        ],
      },
      ts: Date.now(),
    });
  } catch {
    // host may be gone
  }
}

function redrawOverlay(): void {
  if (disposed || !overlay) return;
  overlay.redraw(state.drawings, placer.getDraft(), state.engineDrawings);
}

function ensurePainter(): ChartPainter | null {
  if (disposed) return null;
  if (painter) return painter;
  const host = document.getElementById('chart-host');
  if (!host) return null;
  painter = createChartPainter(host);
  rangeUnsub = painter.onVisibleRangeChange(() => {
    redrawOverlay();
    renderDebugCursor();
    if (apiRef) postViewport(apiRef);
  });
  crosshairUnsub = painter.onCrosshair((sample) => {
    renderDataWindow(sample);
  });
  return painter;
}

function ensureOverlay(): DrawingOverlay | null {
  if (disposed) return null;
  if (overlay) return overlay;
  const svg = document.getElementById('drawing-overlay');
  if (!svg || !(svg instanceof SVGSVGElement)) return null;
  overlay = createDrawingOverlay(svg, () =>
    createLwcCoordAdapter(painter?.getChart() ?? null, painter?.getSeries() ?? null),
  );
  return overlay;
}

const RUN_STATUS_PULSE = new Set(['ok', 'error', 'plugins', 'running', 'stopped']);

const RUN_STATUS_LABEL: Record<string, string> = {
  running: 'Running…',
  stopped: 'Stopped',
  error: 'Run failed',
};

function renderPlotCount(plots: ChartViewState['plots']): void {
  const el = document.getElementById('chart-plot-count');
  if (!el) return;
  const n = Array.isArray(plots) ? plots.length : 0;
  if (n > 0) {
    el.hidden = false;
    el.textContent = `plots ${n}`;
  } else {
    el.hidden = true;
    el.textContent = '';
  }
}

function formatNum(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(4);
}

function legendTitle(seriesKey: string): string {
  const parts = seriesKey.split('|').filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]} · ${parts[parts.length - 1]}`;
  }
  return seriesKey || 'AXIS';
}

function renderLegend(): void {
  const title = document.getElementById('chart-legend-title');
  if (title) title.textContent = legendTitle(state.seriesKey);
  const list = document.getElementById('chart-legend-plots');
  if (!list) return;
  list.replaceChildren();
  for (const plot of state.plots) {
    const li = document.createElement('li');
    li.className = 'chart-legend__plot';
    if (hiddenPlots.has(plot.id)) li.classList.add('is-hidden');
    li.textContent = plot.id;
    list.append(li);
  }
}

function renderLayers(): void {
  const list = document.getElementById('chart-layers-list');
  if (!list) return;
  list.replaceChildren();
  if (state.plots.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'chart-layers__item';
    empty.textContent = 'No plots';
    list.append(empty);
    return;
  }
  for (const plot of state.plots) {
    const li = document.createElement('li');
    li.className = 'chart-layers__item';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = !hiddenPlots.has(plot.id);
    box.dataset.plotId = plot.id;
    const label = document.createElement('span');
    label.textContent = plot.id;
    li.append(box, label);
    list.append(li);
  }
}

function renderDataWindow(sample: ChartCrosshairSample): void {
  const table = document.getElementById('chart-data-table');
  if (!table) return;
  table.replaceChildren();
  const rows: Array<[string, string]> = [];
  const bar = sample.bar;
  if (bar) {
    rows.push(['Time', String(bar.time)]);
    rows.push(['Open', formatNum(bar.open)]);
    rows.push(['High', formatNum(bar.high)]);
    rows.push(['Low', formatNum(bar.low)]);
    rows.push(['Close', formatNum(bar.close)]);
    if (bar.volume !== undefined) rows.push(['Volume', formatNum(bar.volume)]);
  } else {
    rows.push(['Bar', '—']);
  }
  for (const plot of sample.plots) {
    rows.push([plot.id, formatNum(plot.value)]);
  }
  const body = document.createElement('tbody');
  for (const [k, v] of rows) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = k;
    const td = document.createElement('td');
    td.textContent = v;
    tr.append(th, td);
    body.append(tr);
  }
  table.append(body);
}

function setChromeOpen(which: 'layers' | 'data' | null): void {
  const layers = document.getElementById('chart-layers');
  const data = document.getElementById('chart-data-window');
  if (layers) layers.hidden = which !== 'layers';
  if (data) data.hidden = which !== 'data';
  const layersBtn = document.getElementById('tool-layers');
  const dataBtn = document.getElementById('tool-data');
  layersBtn?.setAttribute('aria-pressed', which === 'layers' ? 'true' : 'false');
  dataBtn?.setAttribute('aria-pressed', which === 'data' ? 'true' : 'false');
  layersBtn?.classList.toggle('is-active', which === 'layers');
  dataBtn?.classList.toggle('is-active', which === 'data');
}

function toggleLegend(): void {
  const legend = document.getElementById('chart-legend');
  if (!legend) return;
  legend.hidden = !legend.hidden;
  const btn = document.getElementById('tool-legend');
  btn?.setAttribute('aria-pressed', legend.hidden ? 'false' : 'true');
  btn?.classList.toggle('is-active', !legend.hidden);
}

function toggleFullscreen(): void {
  const shell = document.getElementById('chart-shell');
  if (!shell) return;
  const doc = shell.ownerDocument;
  try {
    if (doc.fullscreenElement) {
      void doc.exitFullscreen();
      return;
    }
  } catch {
    // fall through to class toggle
  }
  if (typeof shell.requestFullscreen === 'function') {
    void shell.requestFullscreen().catch(() => {
      shell.classList.toggle('is-fullscreen');
    });
    return;
  }
  shell.classList.toggle('is-fullscreen');
}

function applyHiddenPlots(): void {
  if (!painter) return;
  for (const plot of state.plots) {
    painter.setPlotVisible(plot.id, !hiddenPlots.has(plot.id));
  }
}

function viewState(): ChartViewState {
  if (liveSafe && state.lookahead?.tainted) {
    return { ...state, plots: [], strategy: undefined };
  }
  return state;
}

function paintView(): void {
  const p = ensurePainter();
  p?.apply(viewState());
  const host = document.getElementById('chart-host');
  host?.classList.toggle(
    'is-lookahead-tainted',
    Boolean(state.lookahead?.tainted) && !liveSafe,
  );
}

function refreshLiveSafeBtn(): void {
  const btn = document.getElementById('tool-live-safe');
  if (!btn) return;
  const tainted = Boolean(state.lookahead?.tainted);
  btn.hidden = !tainted;
  btn.setAttribute('aria-pressed', liveSafe ? 'true' : 'false');
  btn.classList.toggle('is-active', liveSafe);
}

function refreshChrome(): void {
  renderPlotCount(state.plots);
  renderWindowChip();
  renderAlertsChip();
  renderInputs();
  renderStrategy();
  renderEngineTables();
  renderLegend();
  renderLayers();
  applyHiddenPlots();
  refreshLiveSafeBtn();
  renderDebugCursor();
  renderDataWindow(painter?.lastSample() ?? { bar: null, plots: [] });
}

function isRunBusy(): boolean {
  return document.getElementById('chart-shell')?.getAttribute('data-run-busy') === '1';
}

function syncApplyBusy(): void {
  const btn = document.getElementById('chart-inputs-apply');
  if (!(btn instanceof HTMLButtonElement)) return;
  btn.disabled = isRunBusy();
}

function renderWindowChip(): void {
  const el = document.getElementById('chart-window-chip');
  if (!el) return;
  const w = state.window;
  if (!w) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.hidden = false;
  const from = w.fromBar ?? '';
  const to = w.toBar ?? '';
  const total = w.totalBars ?? '';
  el.textContent = total !== '' ? `window ${from}–${to} / ${total}` : `window ${from}–${to}`;
}

function renderAlertsChip(): void {
  const el = document.getElementById('chart-alerts-chip');
  if (!el) return;
  if (state.alertsCount > 0) {
    el.hidden = false;
    el.textContent = `alerts ${state.alertsCount}`;
  } else {
    el.hidden = true;
    el.textContent = '';
  }
}

function inputScalar(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function inputControl(def: ChartViewState['inputs'][number], id: string): HTMLInputElement {
  const input = document.createElement('input');
  input.id = id;
  input.className = 'chart-inputs__value';
  input.dataset.inputTitle = def.title;
  input.setAttribute('aria-label', def.title);
  input.autocomplete = 'off';
  const t = def.type.toLowerCase();
  if (t === 'bool' || t === 'boolean') {
    input.type = 'checkbox';
    input.classList.add('chart-inputs__check');
    input.checked = Boolean(def.value);
    return input;
  }
  if (t === 'int' || t === 'integer' || t === 'float' || t === 'number') {
    input.type = 'number';
    input.step = t === 'int' || t === 'integer' ? '1' : 'any';
    input.value = inputScalar(def.value);
    return input;
  }
  input.type = 'text';
  input.value = inputScalar(def.value);
  return input;
}

function renderInputs(): void {
  const panel = document.getElementById('chart-inputs');
  const fields = document.getElementById('chart-inputs-fields');
  const toggle = document.getElementById('chart-toggle-inputs');
  if (!panel || !fields || !toggle) return;
  const defs = state.inputs ?? [];
  if (defs.length === 0) {
    toggle.hidden = true;
    panel.hidden = true;
    toggle.setAttribute('aria-pressed', 'false');
    toggle.classList.remove('is-active');
    fields.replaceChildren();
    lastInputsFp = '';
    syncApplyBusy();
    return;
  }
  const reveal = toggle.hidden;
  toggle.hidden = false;
  if (reveal) panel.hidden = false;
  const open = !panel.hidden;
  toggle.setAttribute('aria-pressed', open ? 'true' : 'false');
  toggle.classList.toggle('is-active', open);
  const fp = defs.map((d) => `${d.title}\u0000${d.type}\u0000${inputScalar(d.value)}`).join('\n');
  if (fp !== lastInputsFp) {
    lastInputsFp = fp;
    fields.replaceChildren();
    defs.forEach((def, i) => {
      const row = document.createElement('div');
      row.className = 'chart-inputs__row';
      const id = `chart-input-${i}`;
      const label = document.createElement('label');
      label.className = 'chart-inputs__label';
      label.htmlFor = id;
      label.textContent = def.title;
      row.append(label, inputControl(def, id));
      fields.append(row);
    });
  }
  syncApplyBusy();
}

function collectInputValues(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const fields = document.getElementById('chart-inputs-fields');
  if (!fields) return out;
  for (const el of Array.from(fields.querySelectorAll('input[data-input-title]'))) {
    if (!(el instanceof HTMLInputElement)) continue;
    const title = el.dataset.inputTitle;
    if (!title) continue;
    if (el.type === 'checkbox') out[title] = el.checked;
    else if (el.type === 'number') {
      const n = Number(el.value);
      out[title] = Number.isFinite(n) ? n : el.value;
    } else out[title] = el.value;
  }
  return out;
}

function postApplyInputs(): void {
  if (disposed || !apiRef) return;
  try {
    apiRef.postMessage({
      v: PROTOCOL_VERSION,
      type: 'chart.applyInputs',
      payload: { inputs: collectInputValues() },
      ts: Date.now(),
    });
  } catch {
    // host may be gone
  }
}

function tradeBarIndex(t: { barIndex?: number; time?: number }): number | undefined {
  if (typeof t.barIndex === 'number' && Number.isFinite(t.barIndex)) return Math.trunc(t.barIndex);
  if (typeof t.time === 'number' && Number.isFinite(t.time)) {
    const i = state.bars.findIndex((b) => b.time === t.time);
    if (i >= 0) return i;
  }
  return undefined;
}

function postSelectTrade(barIndex: number): void {
  if (disposed || !apiRef) return;
  try {
    apiRef.postMessage({
      v: PROTOCOL_VERSION,
      type: 'chart.selectTrade',
      payload: { barIndex },
      ts: Date.now(),
    });
  } catch {
    // host gone
  }
}

function strategyCsv(): string {
  return strategyTradesCsv(state.strategy?.trades ?? []);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function toneClass(value: number | null, kind: 'signed' | 'drawdown'): string {
  if (value === null || !Number.isFinite(value)) return '';
  if (kind === 'drawdown') return value > 0 ? 'is-down' : '';
  if (value > 0) return 'is-up';
  if (value < 0) return 'is-down';
  return '';
}

function netTitle(source: StrategyReport['netProfitSource']): string {
  if (source === 'stats') return 'Reported net profit';
  if (source === 'trades') return 'Sum of closed trades';
  if (source === 'equity') return 'Last equity minus first';
  return 'No net profit in the run';
}

function formatNet(report: StrategyReport): string {
  if (report.netProfit === null) return '—';
  if (report.netProfitSource === 'trades') return formatResult(report.netProfit, report.resultUnit, true);
  return formatSigned(report.netProfit);
}

function profitFactorTitle(value: number | null): string {
  if (value === null) return 'Needs wins and losses';
  if (!Number.isFinite(value)) return 'No losing trades';
  return 'Gross profit / gross loss';
}

function metricCards(report: StrategyReport): Array<{ label: string; value: string; tone: string; title: string }> {
  const unitNote = report.resultUnit === 'points' ? ' Price points, no quantity.' : '';
  return [
    {
      label: 'Net profit',
      value: formatNet(report),
      tone: toneClass(report.netProfit, 'signed'),
      title: netTitle(report.netProfitSource),
    },
    {
      label: 'Closed trades',
      value: report.closedTrades === null ? '—' : formatPlain(report.closedTrades),
      tone: '',
      title: report.closedTrades === null ? 'Round trips not paired' : 'Closed round trips',
    },
    {
      label: 'Win rate',
      value: formatPercent(report.winRate),
      tone: '',
      title: report.winRate === null ? 'Needs priced round trips' : 'Winning closes / closed trades',
    },
    {
      label: 'Profit factor',
      value: formatProfitFactor(report.profitFactor),
      tone: '',
      title: profitFactorTitle(report.profitFactor),
    },
    {
      label: 'Average trade',
      value: formatResult(report.averageTrade, report.resultUnit, true),
      tone: toneClass(report.averageTrade, 'signed'),
      title: report.averageTrade === null ? 'Needs same-unit round trips' : `Mean closed result.${unitNote}`,
    },
    {
      label: 'Max drawdown',
      value: report.maxDrawdown === null ? '—' : formatPlain(report.maxDrawdown),
      tone: toneClass(report.maxDrawdown, 'drawdown'),
      title: report.maxDrawdown === null ? 'Needs an equity curve' : 'Peak to trough on equity',
    },
    {
      label: 'Gross profit',
      value: formatResult(report.grossProfit, report.resultUnit, true),
      tone: toneClass(report.grossProfit, 'signed'),
      title: report.grossProfit === null ? 'Needs same-unit round trips' : `Sum of winning closes.${unitNote}`,
    },
    {
      label: 'Gross loss',
      value: formatResult(report.grossLoss, report.resultUnit, true),
      tone: toneClass(report.grossLoss, 'signed'),
      title: report.grossLoss === null ? 'Needs same-unit round trips' : `Sum of losing closes.${unitNote}`,
    },
  ];
}

function syncStrategyFilterChips(panel: ParentNode): void {
  const chips = panel.querySelectorAll<HTMLElement>('[data-strategy-filter]');
  for (let i = 0; i < chips.length; i++) {
    const chip = chips.item(i);
    if (!chip) continue;
    const on = chip.dataset.strategyFilter === strategyFilter;
    chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    chip.classList.toggle('is-active', on);
  }
}

function paintNet(el: HTMLElement, report: StrategyReport): void {
  el.textContent = formatNet(report);
  el.title = netTitle(report.netProfitSource);
  el.classList.remove('is-up', 'is-down');
  const tone = toneClass(report.netProfit, 'signed');
  if (tone) el.classList.add(tone);
}

function clearStrategyReport(
  stats: HTMLElement,
  table: HTMLElement,
  metrics: HTMLElement | null,
  trips: HTMLElement | null,
  equityHost: HTMLElement | null,
): void {
  stats.textContent = '—';
  stats.removeAttribute('title');
  stats.classList.remove('is-up', 'is-down');
  table.replaceChildren();
  metrics?.replaceChildren();
  if (trips) {
    trips.replaceChildren();
    trips.hidden = true;
  }
  if (equityHost) {
    equityHost.hidden = true;
    equityHost.replaceChildren();
    equityHost.classList.remove('is-up', 'is-down');
    equityHost.removeAttribute('aria-label');
  }
}

function equitySparkSvg(points: readonly number[]): SVGSVGElement {
  const width = 240;
  const height = 28;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const first = points[0];
  if (first === undefined) return svg;
  let min = first;
  let max = first;
  for (const value of points) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const span = max - min;
  const lastIndex = Math.max(points.length - 1, 1);
  const coords = points.map((value, index) => {
    const x = (index / lastIndex) * (width - 1);
    const y = span === 0 ? height / 2 : (1 - (value - min) / span) * (height - 2) + 1;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const area = document.createElementNS(SVG_NS, 'polygon');
  area.setAttribute('points', `0,${height} ${coords.join(' ')} ${width - 1},${height}`);
  area.setAttribute('fill', 'currentColor');
  area.setAttribute('opacity', '0.16');
  const line = document.createElementNS(SVG_NS, 'polyline');
  line.setAttribute('points', coords.join(' '));
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', 'currentColor');
  line.setAttribute('stroke-width', '1.25');
  line.setAttribute('stroke-linejoin', 'round');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(area, line);
  return svg;
}

function paintStrategyEquity(host: HTMLElement | null, report: StrategyReport): void {
  if (!host) return;
  const pts = report.spark;
  const first = pts?.[0];
  const last = pts && pts.length > 0 ? pts[pts.length - 1] : undefined;
  if (!pts || first === undefined || last === undefined) {
    host.hidden = true;
    host.replaceChildren();
    host.classList.remove('is-up', 'is-down');
    host.removeAttribute('aria-label');
    return;
  }
  host.hidden = false;
  host.classList.toggle('is-up', last > first);
  host.classList.toggle('is-down', last < first);
  let label = 'Equity flat';
  if (last > first) label = 'Equity up';
  else if (last < first) label = 'Equity down';
  host.setAttribute('aria-label', label);
  host.replaceChildren(equitySparkSvg(pts));
}

function paintStrategyMetrics(host: HTMLElement | null, report: StrategyReport): void {
  if (!host) return;
  host.replaceChildren();
  for (const card of metricCards(report)) {
    const el = document.createElement('div');
    el.className = 'chart-strategy__metric';
    const label = document.createElement('span');
    label.className = 'chart-strategy__metric-label';
    label.textContent = card.label;
    label.title = card.label;
    const value = document.createElement('span');
    value.className = 'chart-strategy__metric-value';
    if (card.tone) value.classList.add(card.tone);
    value.textContent = card.value;
    value.title = card.title;
    el.append(label, value);
    host.append(el);
  }
}

function sideMark(direction: string | undefined): HTMLSpanElement {
  const span = document.createElement('span');
  const side = parseSide(direction);
  span.className = 'chart-strategy__mark';
  if (side === 'long') {
    span.classList.add('chart-strategy__mark--long');
    span.textContent = '▲';
    span.title = 'Long';
  } else if (side === 'short') {
    span.classList.add('chart-strategy__mark--short');
    span.textContent = '▼';
    span.title = 'Short';
  } else {
    span.classList.add('chart-strategy__mark--flat');
    span.textContent = '·';
    if (direction) span.title = direction;
  }
  return span;
}

function plainOrDash(value: number | null): string {
  return value === null ? '—' : formatPlain(value);
}

function numSpan(text: string, tone = ''): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'chart-strategy__num';
  if (tone) span.classList.add(tone);
  span.textContent = text;
  return span;
}

function fillTrip(el: HTMLElement, trip: RoundTrip): void {
  el.classList.add('chart-strategy__trip');
  el.append(sideMark(trip.direction ?? undefined));
  el.append(numSpan(plainOrDash(trip.entryPrice)));
  const arrow = document.createElement('span');
  arrow.className = 'chart-strategy__arrow';
  arrow.textContent = '→';
  el.append(arrow);
  el.append(numSpan(plainOrDash(trip.exitPrice)));
  el.append(numSpan(formatResult(trip.result, trip.resultUnit, true), toneClass(trip.result, 'signed')));
}

function tripBar(trip: RoundTrip): number | undefined {
  const entry = tradeBarIndex({
    barIndex: trip.entryBar ?? undefined,
    time: trip.entryTime ?? undefined,
  });
  if (entry !== undefined) return entry;
  return tradeBarIndex({
    barIndex: trip.exitBar ?? undefined,
    time: trip.exitTime ?? undefined,
  });
}

function paintStrategyTrips(host: HTMLElement | null, report: StrategyReport, tradeCount: number): void {
  if (!host) return;
  host.replaceChildren();
  if (tradeCount === 0) {
    host.hidden = true;
    return;
  }
  host.hidden = false;
  if (report.ambiguous || report.roundTrips.length === 0) {
    const note = document.createElement('p');
    note.className = 'chart-strategy__note';
    if (report.ambiguous) {
      note.textContent = 'Not paired';
      note.title = 'Entry and exit sequence is ambiguous';
    } else {
      note.textContent = 'No closed round trip';
    }
    host.append(note);
    return;
  }
  const list = document.createElement('ul');
  list.className = 'chart-strategy__trips-list';
  for (const trip of report.roundTrips) {
    const item = document.createElement('li');
    const bar = tripBar(trip);
    if (bar === undefined) {
      const el = document.createElement('div');
      if (trip.id) el.title = trip.id;
      fillTrip(el, trip);
      item.append(el);
    } else {
      const el = document.createElement('button');
      el.type = 'button';
      el.title = `Debug bar ${bar}`;
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        postSelectTrade(bar);
      });
      fillTrip(el, trip);
      item.append(el);
    }
    list.append(item);
  }
  host.append(list);
}

function appendTextCell(row: HTMLTableRowElement, text: string, className: string): void {
  const td = document.createElement('td');
  if (className) td.className = className;
  td.textContent = text;
  row.append(td);
}

function appendNumberCell(row: HTMLTableRowElement, value: number | undefined): void {
  const td = document.createElement('td');
  td.className = 'chart-strategy__num';
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    td.textContent = '—';
    td.classList.add('is-missing');
  } else {
    td.textContent = formatPlain(value);
  }
  row.append(td);
}

function renderEmptyRow(table: HTMLElement, text: string): void {
  const note = document.createElement('p');
  note.className = 'chart-strategy__empty';
  note.textContent = text;
  table.replaceChildren(note);
}

function paintStrategyTable(table: HTMLElement, trades: readonly MetricTrade[]): void {
  const shown = trades.filter((trade) => tradeMatchesFilter(trade.kind, strategyFilter));
  if (trades.length === 0) {
    renderEmptyRow(table, 'No trades');
    return;
  }
  if (shown.length === 0) {
    renderEmptyRow(table, strategyFilter === 'entries' ? 'No entries' : 'No exits');
    return;
  }
  const tbl = document.createElement('table');
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  const columns: Array<{ label: string; className: string }> = [
    { label: 'Id', className: 'chart-strategy__id' },
    { label: 'Kind', className: '' },
    { label: 'Side', className: 'chart-strategy__side' },
    { label: 'Qty', className: 'chart-strategy__num' },
    { label: 'Price', className: 'chart-strategy__num' },
    { label: 'Time', className: 'chart-strategy__num' },
    { label: 'Comment', className: 'chart-strategy__comment' },
  ];
  for (const column of columns) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = column.label;
    if (column.className) th.className = column.className;
    hr.append(th);
  }
  thead.append(hr);
  const body = document.createElement('tbody');
  for (const trade of shown) {
    const tr = document.createElement('tr');
    const barIndex = tradeBarIndex(trade);
    if (barIndex !== undefined) {
      tr.dataset.barIndex = String(barIndex);
      tr.title = `Debug bar ${barIndex}`;
      tr.addEventListener('click', () => postSelectTrade(barIndex));
    }
    appendTextCell(tr, trade.id, 'chart-strategy__id');
    appendTextCell(tr, trade.kind, '');
    const side = document.createElement('td');
    side.className = 'chart-strategy__side';
    side.append(sideMark(trade.direction));
    tr.append(side);
    appendNumberCell(tr, trade.qty);
    appendNumberCell(tr, trade.price);
    appendNumberCell(tr, trade.time);
    const comment = document.createElement('td');
    comment.className = 'chart-strategy__comment';
    if (trade.comment) {
      comment.textContent = trade.comment;
      comment.title = trade.comment;
    }
    tr.append(comment);
    body.append(tr);
  }
  tbl.append(thead, body);
  table.replaceChildren(tbl);
}

function renderStrategy(): void {
  const panel = document.getElementById('chart-strategy');
  const stats = document.getElementById('chart-strategy-stats');
  const table = document.getElementById('chart-strategy-table');
  const toggle = document.getElementById('chart-toggle-strategy');
  if (!panel || !stats || !table || !toggle) return;
  syncStrategyFilterChips(panel);
  const metrics = document.getElementById('chart-strategy-metrics');
  const trips = document.getElementById('chart-strategy-trips');
  const equityHost = document.getElementById('chart-strategy-equity');
  const strat = state.strategy;
  const has = Boolean(strat && (strat.trades.length > 0 || strat.equity));
  if (!has || !strat) {
    toggle.hidden = true;
    panel.hidden = true;
    toggle.setAttribute('aria-pressed', 'false');
    clearStrategyReport(stats, table, metrics, trips, equityHost);
    return;
  }
  const reveal = toggle.hidden;
  toggle.hidden = false;
  if (reveal) panel.hidden = false;
  toggle.setAttribute('aria-pressed', panel.hidden ? 'false' : 'true');
  const report = buildStrategyReport({
    trades: strat.trades,
    equity: strat.equity,
    stats: strat.stats,
  });
  paintNet(stats, report);
  paintStrategyEquity(equityHost, report);
  paintStrategyMetrics(metrics, report);
  paintStrategyTrips(trips, report, strat.trades.length);
  paintStrategyTable(table, strat.trades);
}

function renderEngineTables(): void {
  const host = document.getElementById('chart-engine-tables');
  if (!host) return;
  const tables = (state.engineDrawings ?? []).filter((d) => d.type === 'table');
  if (tables.length === 0) {
    host.hidden = true;
    host.replaceChildren();
    return;
  }
  host.hidden = false;
  host.replaceChildren();
  for (const t of tables) {
    const tbl = document.createElement('table');
    const cells = t.cells ?? [];
    const rows = Math.max(t.rows ?? 0, ...cells.map((c) => Number(c.row ?? 0) + 1), 0);
    const cols = Math.max(t.columns ?? 0, ...cells.map((c) => Number(c.col ?? 0) + 1), 0);
    const grid: Array<Array<Record<string, unknown> | undefined>> = [];
    for (let r = 0; r < rows; r++) grid.push(Array.from({ length: cols }));
    for (const c of cells) {
      const r = Number(c.row ?? 0);
      const col = Number(c.col ?? 0);
      if (grid[r]) grid[r][col] = c;
    }
    for (let r = 0; r < rows; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c < cols; c++) {
        const td = document.createElement('td');
        const cell = grid[r]?.[c];
        td.textContent = cell ? String(cell.text ?? '') : '';
        if (cell && typeof cell.bgcolor === 'string') td.style.background = cell.bgcolor;
        if (cell && typeof cell.text_color === 'string') td.style.color = cell.text_color;
        tr.append(td);
      }
      tbl.append(tr);
    }
    host.append(tbl);
  }
}

function copyCsv(): void {
  const text = strategyCsv();
  void (async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch {
      // fall through
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', 'true');
    document.body.append(area);
    area.select();
    try {
      document.execCommand('copy');
    } catch {
      // ignore
    }
    area.remove();
  })();
}

// plugin chips removed in lightweight core (no plugins studio)

function applyRunStatus(raw: unknown, message?: unknown): void {
  const shell = document.getElementById('chart-shell');
  if (!shell) return;
  const status = typeof raw === 'string' ? raw.trim() : '';
  const fromHost = typeof message === 'string' ? message.trim() : '';
  const label = fromHost || RUN_STATUS_LABEL[status] || '';
  const busy = status === 'running';
  shell.setAttribute('data-run-busy', busy ? '1' : '0');
  shell.setAttribute('aria-busy', busy ? 'true' : 'false');
  const chip = document.getElementById('chart-run-status');
  if (chip) {
    if (!label) {
      chip.hidden = true;
      chip.textContent = '';
      chip.removeAttribute('data-state');
    } else {
      chip.hidden = false;
      chip.textContent = label;
      chip.setAttribute('data-state', status);
    }
  }
  syncApplyBusy();
  if (!RUN_STATUS_PULSE.has(status)) return;
  try {
    // Retrigger the 300ms pulse when the same status repeats.
    shell.removeAttribute('data-run-status');
    void shell.getBoundingClientRect();
    shell.setAttribute('data-run-status', status);
  } catch {
    // detached / hostile DOM
  }
}

function debugBarCaption(index: number): string {
  const count = state.bars.length;
  const shown = count > 0 ? Math.min(Math.max(0, index), count - 1) : index;
  return count > 0 ? `Bar ${shown + 1} of ${count}` : `Bar ${shown + 1}`;
}

function renderDebugCursor(): void {
  const cursor = document.getElementById('chart-debug-cursor');
  const tag = document.getElementById('chart-debug-cursor-label');
  const readout = document.getElementById('chart-debug-readout');
  const shell = document.getElementById('chart-shell');
  const idx = state.debugBarIndex;
  if (idx === null || !Number.isFinite(idx)) {
    if (cursor) cursor.hidden = true;
    if (readout) {
      readout.hidden = true;
      readout.textContent = '';
    }
    shell?.removeAttribute('data-debug-bar');
    return;
  }
  const index = Math.trunc(idx);
  const count = state.bars.length;
  const shown = count > 0 ? Math.min(Math.max(0, index), count - 1) : Math.max(0, index);
  const text = debugBarCaption(shown);
  if (readout) {
    readout.hidden = false;
    readout.textContent = text;
  }
  shell?.setAttribute('data-debug-bar', String(shown));
  if (!cursor) return;
  const bar = state.bars[shown];
  let x: number | null = null;
  if (bar && Number.isFinite(bar.time) && Number.isFinite(bar.close)) {
    const coords = createLwcCoordAdapter(painter?.getChart() ?? null, painter?.getSeries() ?? null);
    x = coords.toPixel({ time: bar.time, price: bar.close })?.x ?? null;
  }
  cursor.hidden = false;
  cursor.classList.toggle('is-fallback', x === null);
  cursor.style.left = x === null ? '50%' : `${x}px`;
  if (tag) tag.textContent = text;
}

function syncToolButton(): void {
  const btn = document.getElementById('tool-trendline');
  if (!btn) return;
  const active = placer.tool === TOOL_TRENDLINE;
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  btn.classList.toggle('is-active', active);
  const shell = document.getElementById('chart-shell');
  if (shell) {
    shell.setAttribute('data-axis-tool', placer.tool ?? '');
  }
}

function onHostMessage(event: MessageEvent): void {
  if (disposed) return;
  const decoded = decodeHostMessage(event.data);
  if (!decoded.ok) {
    // Drop unexpected / malformed host traffic (wrong direction, bad envelope).
    return;
  }
  const outcome = applyChartHostMessage(state, decoded.type, decoded.payload);
  state = outcome.state;
  if (outcome.requestReload && apiRef) {
    postRequestReload(apiRef);
  }
  if (disposed) return;
  if (disposed) return;
  paintView();
  ensureOverlay();
  redrawOverlay();
  refreshChrome();
  if (decoded.type === 'host.run.status') {
    applyRunStatus(decoded.payload.state, decoded.payload.message);
  }
}

function onToolbarClick(event: Event): void {
  if (disposed || !apiRef) return;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const chromeBtn = target.closest('[data-chrome]');
  if (chromeBtn instanceof HTMLElement) {
    const action = chromeBtn.getAttribute('data-chrome') ?? '';
    if (action === 'layers') {
      const layers = document.getElementById('chart-layers');
      setChromeOpen(layers && !layers.hidden ? null : 'layers');
      return;
    }
    if (action === 'data') {
      const data = document.getElementById('chart-data-window');
      setChromeOpen(data && !data.hidden ? null : 'data');
      return;
    }
    if (action === 'legend') {
      toggleLegend();
      return;
    }
    if (action === 'fullscreen') {
      toggleFullscreen();
      return;
    }
    if (action === 'open-source') {
      postSetTool(apiRef, OPEN_SOURCE_TOOL);
      return;
    }
    if (action === 'live-safe') {
      liveSafe = !liveSafe;
      paintView();
      refreshChrome();
      return;
    }
    if (action === 'debug-start') {
      postSelectTrade(0);
      return;
    }
    if (action === 'debug-step') {
      const cur = state.debugBarIndex;
      const next = cur === null || !Number.isFinite(cur) ? 0 : Math.trunc(cur) + 1;
      const last = state.bars.length > 0 ? state.bars.length - 1 : next;
      postSelectTrade(Math.min(next, last));
      return;
    }
    if (action === 'inputs') {
      const panel = document.getElementById('chart-inputs');
      if (panel) {
        panel.hidden = !panel.hidden;
        chromeBtn.setAttribute('aria-pressed', panel.hidden ? 'false' : 'true');
      }
      return;
    }
    if (action === 'strategy') {
      const panel = document.getElementById('chart-strategy');
      if (panel) {
        panel.hidden = !panel.hidden;
        chromeBtn.setAttribute('aria-pressed', panel.hidden ? 'false' : 'true');
      }
      return;
    }
    return;
  }
  const btn = target.closest('[data-tool]');
  if (!(btn instanceof HTMLElement)) return;
  const tool = btn.getAttribute('data-tool') ?? '';
  if (tool !== TOOL_TRENDLINE) return;
  const next = placer.tool === TOOL_TRENDLINE ? null : TOOL_TRENDLINE;
  placer.setTool(next);
  syncToolButton();
  postSetTool(apiRef, next ?? 'cursor');
  redrawOverlay();
}

function onLayersClick(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') return;
  const id = target.dataset.plotId;
  if (!id) return;
  if (target.checked) hiddenPlots.delete(id);
  else hiddenPlots.add(id);
  applyHiddenPlots();
  renderLegend();
}

function postBarBreakpoint(api: VsCodeApi, barIndex: number): void {
  if (disposed) return;
  try {
    api.postMessage({
      v: PROTOCOL_VERSION,
      type: 'chart.barBreakpoint',
      payload: { barIndex },
      ts: Date.now(),
    });
  } catch {
    // host may be gone
  }
}

function nearestBarIndex(time: number): number {
  let best = -1;
  let bestDt = Number.POSITIVE_INFINITY;
  for (let i = 0; i < state.bars.length; i++) {
    const t = state.bars[i]?.time;
    if (typeof t !== 'number' || !Number.isFinite(t)) continue;
    const dt = Math.abs(t - time);
    if (dt < bestDt) {
      bestDt = dt;
      best = i;
    }
  }
  return best;
}

function onStageClick(event: MouseEvent): void {
  if (disposed || !apiRef) return;
  if (placer.tool !== TOOL_TRENDLINE) {
    const t = event.target;
    if (
      t instanceof Element &&
      t.closest(
        '#chart-toolbar, #chart-layers, #chart-data-window, #chart-legend, #chart-inputs, #chart-strategy, #chart-engine-tables, #chart-debug',
      )
    ) {
      return;
    }
    const host = document.getElementById('chart-host');
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const coords = createLwcCoordAdapter(
      painter?.getChart() ?? null,
      painter?.getSeries() ?? null,
    );
    const point = coords.toChartPoint(x, y);
    if (!point) return;
    const idx = nearestBarIndex(point.time);
    if (idx >= 0) postBarBreakpoint(apiRef, idx);
    return;
  }
  // Ignore clicks on the toolbar.
  const t = event.target;
  if (
    t instanceof Element &&
    t.closest(
      '#chart-toolbar, #chart-layers, #chart-data-window, #chart-legend, #chart-inputs, #chart-strategy, #chart-engine-tables, #chart-debug',
    )
  ) {
    return;
  }

  const host = document.getElementById('chart-host');
  if (!host) return;
  const rect = host.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const coords = createLwcCoordAdapter(
    painter?.getChart() ?? null,
    painter?.getSeries() ?? null,
  );
  const point = coords.toChartPoint(x, y);
  if (!point) return;

  const committed = placer.onClick(point);
  if (committed) {
    // Optimistic local append (host dirty + persist; reload restores from doc).
    const without = state.drawings.filter((d) => d.id !== committed.id);
    state = { ...state, drawings: [...without, committed] };
    postCommit(apiRef, committed);
  }
  redrawOverlay();
}

function main(): void {
  const api = acquireVsCodeApi();
  apiRef = api;
  // Listener before ready — host may reply synchronously after postMessage.
  window.addEventListener('message', onHostMessage);
  window.addEventListener(
    'pagehide',
    () => {
      disposed = true;
      try {
        rangeUnsub?.();
      } catch {
        // ignore
      }
      rangeUnsub = null;
      try {
        crosshairUnsub?.();
      } catch {
        // ignore
      }
      crosshairUnsub = null;
      try {
        overlay?.dispose();
      } catch {
        // ignore
      }
      overlay = null;
      try {
        painter?.dispose();
      } catch {
        // ignore
      }
      painter = null;
      apiRef = null;
    },
    { once: true },
  );

  const toolbar = document.getElementById('chart-toolbar');
  toolbar?.addEventListener('click', onToolbarClick);
  document.getElementById('chart-layers')?.addEventListener('click', onLayersClick);
  document.getElementById('chart-inputs-apply')?.addEventListener('click', (event) => {
    event.stopPropagation();
    postApplyInputs();
  });
  document.getElementById('chart-strategy-csv')?.addEventListener('click', (event) => {
    event.stopPropagation();
    copyCsv();
  });
  document.getElementById('chart-strategy')?.addEventListener('click', (event) => {
    if (disposed) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const chip = target.closest('[data-strategy-filter]');
    if (!(chip instanceof HTMLElement)) return;
    const next = parseStrategyFilter(chip.dataset.strategyFilter);
    if (!next || next === strategyFilter) return;
    event.stopPropagation();
    strategyFilter = next;
    renderStrategy();
  });
  const stage = document.getElementById('chart-stage') ?? document.getElementById('chart-host');
  stage?.addEventListener('click', onStageClick);
  document.addEventListener('fullscreenchange', () => {
    const shell = document.getElementById('chart-shell');
    const btn = document.getElementById('tool-fullscreen');
    const on = Boolean(document.fullscreenElement);
    shell?.classList.toggle('is-fullscreen', on);
    btn?.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn?.classList.toggle('is-active', on);
  });

  ensurePainter();
  ensureOverlay();
  syncToolButton();
  refreshChrome();
  bootPyodideCdnWorker();
  postReady(api);
}

main();
