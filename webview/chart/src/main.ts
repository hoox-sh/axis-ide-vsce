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

const RUN_STATUS_PULSE = new Set(['ok', 'error']);

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
  renderDataWindow(painter?.lastSample() ?? { bar: null, plots: [] });
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

function renderInputs(): void {
  const panel = document.getElementById('chart-inputs');
  const fields = document.getElementById('chart-inputs-fields');
  const toggle = document.getElementById('chart-toggle-inputs');
  if (!panel || !fields || !toggle) return;
  const defs = state.inputs ?? [];
  toggle.hidden = defs.length === 0;
  if (defs.length === 0) {
    panel.hidden = true;
    toggle.setAttribute('aria-pressed', 'false');
    fields.replaceChildren();
    return;
  }
  toggle.setAttribute('aria-pressed', panel.hidden ? 'false' : 'true');
  fields.replaceChildren();
  for (const def of defs) {
    const label = document.createElement('label');
    label.textContent = def.title;
    label.setAttribute('for', `input-${def.title}`);
    const input = document.createElement('input');
    input.id = `input-${def.title}`;
    input.dataset.inputTitle = def.title;
    const t = def.type.toLowerCase();
    if (t === 'bool' || t === 'boolean') {
      input.type = 'checkbox';
      input.checked = Boolean(def.value);
    } else if (t === 'int' || t === 'integer' || t === 'float') {
      input.type = 'number';
      input.value = def.value == null ? '' : String(def.value);
    } else {
      input.type = 'text';
      input.value = def.value == null ? '' : String(def.value);
    }
    fields.append(label, input);
  }
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

function csvEscape(cell: unknown): string {
  const s = String(cell ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
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
  const trades = state.strategy?.trades ?? [];
  const header = 'id,kind,direction,qty,time,price,comment';
  const rows = trades.map((t) =>
    [t.id, t.kind, t.direction ?? '', t.qty ?? '', t.time ?? '', t.price ?? '', t.comment ?? '']
      .map(csvEscape)
      .join(','),
  );
  return [header, ...rows].join('\n');
}

function renderStrategy(): void {
  const panel = document.getElementById('chart-strategy');
  const stats = document.getElementById('chart-strategy-stats');
  const table = document.getElementById('chart-strategy-table');
  const toggle = document.getElementById('chart-toggle-strategy');
  if (!panel || !stats || !table || !toggle) return;
  const strat = state.strategy;
  const has = Boolean(strat && (strat.trades.length > 0 || strat.equity));
  toggle.hidden = !has;
  if (!has || !strat) {
    panel.hidden = true;
    toggle.setAttribute('aria-pressed', 'false');
    stats.textContent = '';
    table.replaceChildren();
    return;
  }
  toggle.setAttribute('aria-pressed', panel.hidden ? 'false' : 'true');
  const np = strat.stats.netProfit;
  stats.textContent = `trades ${strat.stats.trades} · entries ${strat.stats.entries} · exits ${strat.stats.exits}${np !== undefined ? ` · Δ ${np}` : ''}`;
  const tbl = document.createElement('table');
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  for (const h of ['id', 'kind', 'dir', 'qty', 'time', 'price']) {
    const th = document.createElement('th');
    th.textContent = h;
    hr.append(th);
  }
  thead.append(hr);
  const body = document.createElement('tbody');
  for (const t of strat.trades) {
    const tr = document.createElement('tr');
    const barIndex = tradeBarIndex(t);
    if (barIndex !== undefined) {
      tr.dataset.barIndex = String(barIndex);
      tr.style.cursor = 'pointer';
      tr.title = `Debug bar ${barIndex}`;
      tr.addEventListener('click', () => postSelectTrade(barIndex));
    }
    for (const cell of [t.id, t.kind, t.direction ?? '', t.qty ?? '', t.time ?? '', t.price ?? '']) {
      const td = document.createElement('td');
      td.textContent = String(cell);
      tr.append(td);
    }
    body.append(tr);
  }
  tbl.append(thead, body);
  table.replaceChildren(tbl);
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

function applyRunStatus(raw: unknown): void {
  const shell = document.getElementById('chart-shell');
  if (!shell) return;
  const status = typeof raw === 'string' ? raw.trim() : '';
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
    applyRunStatus(decoded.payload.state);
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
        '#chart-toolbar, #chart-layers, #chart-data-window, #chart-legend, #chart-inputs, #chart-strategy, #chart-engine-tables',
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
      '#chart-toolbar, #chart-layers, #chart-data-window, #chart-legend, #chart-inputs, #chart-strategy, #chart-engine-tables',
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
