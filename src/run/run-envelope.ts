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
 * Map unused Pro / pyne-worker POST /run envelope fields into host + chart.full.
 * Source: pyne-worker README POST /run + Runtime.result packing.
 */

import type { ChartFullPayload } from '../protocol';

/** Host result extras copied from a `/run` envelope (subset used by attach). */
export interface RunEnvelopeFields {
  plots?: unknown;
  series?: unknown;
  drawings?: unknown;
  plotMeta?: unknown;
  inputs?: unknown;
  alerts?: unknown;
  times?: number[];
  window?: RunWindow;
  errorKind?: string;
  scriptType?: string;
  scriptName?: string;
  overlay?: boolean;
  strategy?: StrategyReport;
}

export interface StrategyTrade {
  id: string;
  kind: string;
  direction?: string;
  qty?: number;
  time?: number;
  barIndex?: number;
  price?: number;
  comment?: string;
}

export interface StrategyReport {
  trades: StrategyTrade[];
  equity?: (number | null)[];
  stats: {
    trades: number;
    entries: number;
    exits: number;
    netProfit?: number;
  };
}

export interface RunWindow {
  fromBar?: number;
  toBar?: number;
  bars?: number;
  totalBars?: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sampleToNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (isPlainObject(raw)) return num(raw.value) ?? num(raw.v) ?? num(raw.close);
  return null;
}

function numericColumn(raw: unknown): (number | null)[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const values = raw.map(sampleToNumber);
  if (!values.some((v) => v !== null)) return undefined;
  return values;
}

const TRADE_KINDS = new Set(['entry', 'exit', 'close', 'close_all', 'order']);

function priceFromEvent(entry: Record<string, unknown>): number | undefined {
  const direct = num(entry.price) ?? num(entry.limit) ?? num(entry.stop);
  if (direct !== null) return direct;
  const ohlc = entry.ohlc;
  if (Array.isArray(ohlc) && ohlc.length >= 4) {
    const close = num(ohlc[3]);
    if (close !== null) return close;
  }
  return undefined;
}

function timeFromEvent(entry: Record<string, unknown>): number | undefined {
  const raw = num(entry.bar_time) ?? num(entry.time) ?? num(entry.t);
  if (raw === null) return undefined;
  return raw > 1e11 ? Math.round(raw / 1000) : raw;
}

/** Pair strategy.* events into a trades table (never throws). */
export function extractStrategy(raw: Record<string, unknown>): StrategyReport | undefined {
  try {
    const events = Array.isArray(raw.events) ? raw.events : [];
    const trades: StrategyTrade[] = [];
    for (let i = 0; i < events.length; i++) {
      const entry = events[i];
      if (!isPlainObject(entry)) continue;
      const kind = String(entry.kind ?? entry.type ?? '').trim().toLowerCase();
      if (!TRADE_KINDS.has(kind)) continue;
      const id =
        typeof entry.id === 'string' && entry.id.trim()
          ? entry.id.trim()
          : `t${trades.length}`;
      const trade: StrategyTrade = { id, kind };
      const direction = typeof entry.direction === 'string' ? entry.direction.trim() : '';
      if (direction) trade.direction = direction;
      const qty = num(entry.qty);
      if (qty !== null) trade.qty = qty;
      const time = timeFromEvent(entry);
      if (time !== undefined) trade.time = time;
      const barIndex = num(entry.bar_index) ?? num(entry.barIndex);
      if (barIndex !== null) trade.barIndex = barIndex;
      const price = priceFromEvent(entry);
      if (price !== undefined) trade.price = price;
      const comment = typeof entry.comment === 'string' ? entry.comment : '';
      if (comment) trade.comment = comment;
      trades.push(trade);
    }

    const series = isPlainObject(raw.series) ? raw.series : {};
    const equity =
      numericColumn(series.__equity) ??
      numericColumn(series.equity) ??
      numericColumn(series.__netprofit);

    const scriptType = String(raw.script_type ?? raw.scriptType ?? '').toLowerCase();
    if (trades.length === 0 && !equity && scriptType !== 'strategy') {
      return undefined;
    }

    const entries = trades.filter((t) => t.kind === 'entry').length;
    const exits = trades.filter((t) => t.kind === 'exit' || t.kind === 'close' || t.kind === 'close_all')
      .length;
    const stats: StrategyReport['stats'] = {
      trades: trades.length,
      entries,
      exits,
    };
    if (equity) {
      const last = [...equity].reverse().find((v) => v !== null);
      const first = equity.find((v) => v !== null);
      if (last !== undefined && last !== null && first !== undefined && first !== null) {
        stats.netProfit = last - first;
      }
    }
    const report: StrategyReport = { trades, stats };
    if (equity) report.equity = equity;
    return report;
  } catch {
    return undefined;
  }
}

function coerceTimes(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: number[] = [];
  for (const item of raw) {
    const n = num(item);
    if (n === null) continue;
    out.push(n > 1e11 ? Math.round(n / 1000) : n);
  }
  return out.length > 0 ? out : undefined;
}

function coerceWindow(raw: unknown): RunWindow | undefined {
  if (!isPlainObject(raw)) return undefined;
  const fromBar = num(raw.from_bar) ?? num(raw.fromBar);
  const toBar = num(raw.to_bar) ?? num(raw.toBar);
  const bars = num(raw.bars);
  const totalBars = num(raw.total_bars) ?? num(raw.totalBars);
  if (fromBar === null && toBar === null && bars === null && totalBars === null) {
    return undefined;
  }
  const out: RunWindow = {};
  if (fromBar !== null) out.fromBar = fromBar;
  if (toBar !== null) out.toBar = toBar;
  if (bars !== null) out.bars = bars;
  if (totalBars !== null) out.totalBars = totalBars;
  return out;
}

function coercePlotMeta(raw: unknown): unknown {
  if (isPlainObject(raw) || Array.isArray(raw)) return raw;
  return undefined;
}

function coerceInputs(raw: unknown): unknown {
  if (Array.isArray(raw) || isPlainObject(raw)) return raw;
  return undefined;
}

/**
 * Copy unused `/run` fields onto the host result (never throws).
 * `plots` / `series` / `drawings` / `events` / `logs` stay on the HTTP mapper.
 */
export function attachRunEnvelope<T extends RunEnvelopeFields>(
  result: T,
  raw: Record<string, unknown>,
): T {
  try {
    const plotMeta = coercePlotMeta(raw.plot_meta ?? raw.plotMeta);
    if (plotMeta !== undefined) result.plotMeta = plotMeta;
    const inputs = coerceInputs(raw.inputs);
    if (inputs !== undefined) result.inputs = inputs;
    if (Array.isArray(raw.alerts)) result.alerts = raw.alerts;
    const times = coerceTimes(raw.times);
    if (times) result.times = times;
    const window = coerceWindow(raw.window);
    if (window) result.window = window;
    const errorKind = typeof raw.error_kind === 'string' ? raw.error_kind.trim() : '';
    if (errorKind) result.errorKind = errorKind;
    const scriptType = typeof raw.script_type === 'string' ? raw.script_type.trim() : '';
    if (scriptType) result.scriptType = scriptType;
    const scriptName = typeof raw.script_name === 'string' ? raw.script_name.trim() : '';
    if (scriptName) result.scriptName = scriptName;
    if (typeof raw.overlay === 'boolean') result.overlay = raw.overlay;
    const strategy = extractStrategy(raw);
    if (strategy) result.strategy = strategy;
  } catch {
    // never fail a run over extras
  }
  return result;
}

/** Chart.full extras from a mapped engine result (omits empty). */
export function chartFullFromRunResult(
  result: RunEnvelopeFields,
  bars: unknown,
  seq: number,
): ChartFullPayload {
  const full: ChartFullPayload = {
    bars,
    plots: result.plots,
    series: result.series,
    seq,
  };
  if (result.drawings !== undefined) full.drawings = result.drawings;
  if (result.plotMeta !== undefined) full.plotMeta = result.plotMeta;
  if (result.inputs !== undefined) full.inputs = result.inputs;
  if (result.alerts !== undefined) full.alerts = result.alerts;
  if (result.times !== undefined) full.times = result.times;
  if (result.window !== undefined) full.window = result.window;
  if (result.strategy !== undefined) full.strategy = result.strategy;
  if (result.scriptType !== undefined) full.scriptType = result.scriptType;
  return full;
}

/** Attach a static lookahead report onto a chart.full payload. */
export function withLookahead(
  full: ChartFullPayload,
  lookahead: unknown,
): ChartFullPayload {
  if (lookahead === undefined || lookahead === null) return full;
  return { ...full, lookahead };
}

/** CSV for the strategy trades table (header always). */
export function strategyTradesCsv(trades: StrategyTrade[]): string {
  const header = 'id,kind,direction,qty,time,price,comment';
  const rows = trades.map((t) =>
    [t.id, t.kind, t.direction ?? '', t.qty ?? '', t.time ?? '', t.price ?? '', t.comment ?? '']
      .map((cell) => {
        const s = String(cell);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      })
      .join(','),
  );
  return [header, ...rows].join('\n');
}
