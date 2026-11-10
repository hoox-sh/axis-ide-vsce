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
 * Closed-trade math for the chart strategy report.
 *
 * An exit pairs with the one open entry that shares its id, or with the
 * only open entry. Pyramids, qty mismatches, orphan exits, and close_all
 * against more than one open entry leave the whole sequence unpaired.
 *
 * Net profit is stats.netProfit, else a same-unit sum of closes, else
 * last equity minus first. Max drawdown is the equity peak-to-trough
 * drop, not a percent. Missing inputs stay null — no fee, point value,
 * or quantity is invented.
 */

/** Trade fields the report can see. Matches `StrategyTradeView`. */
export interface MetricTrade {
  id: string;
  kind: string;
  direction?: string;
  qty?: number;
  time?: number;
  barIndex?: number;
  price?: number;
  comment?: string;
}

export type StrategyTableFilter = 'all' | 'entries' | 'exits';

export type TradeResultUnit = 'money' | 'points';

export interface RoundTrip {
  id: string;
  direction: 'long' | 'short' | null;
  entryPrice: number | null;
  exitPrice: number | null;
  result: number | null;
  resultUnit: TradeResultUnit | null;
  entryBar: number | null;
  exitBar: number | null;
  entryTime: number | null;
  exitTime: number | null;
}

export interface StrategyReport {
  /** True when an exit could not be matched to exactly one open entry. */
  ambiguous: boolean;
  roundTrips: RoundTrip[];
  /** stats.netProfit, else same-unit closed sum, else last equity minus first. */
  netProfit: number | null;
  netProfitSource: 'stats' | 'trades' | 'equity' | null;
  /** Null when ambiguous. Otherwise closed round trips (zero is real). */
  closedTrades: number | null;
  /** Wins / closes. Null when any close is unpriced, or there are no closes. */
  winRate: number | null;
  /** Gross profit / |gross loss|. Infinity when wins exist and losses do not. */
  profitFactor: number | null;
  averageTrade: number | null;
  /** Absolute peak-to-trough drop on equity. Not a percent. */
  maxDrawdown: number | null;
  grossProfit: number | null;
  /** Sum of losing closes, ≤ 0. Not an absolute value. */
  grossLoss: number | null;
  /** Set only when every priced close shares one unit. */
  resultUnit: TradeResultUnit | null;
  /** Finite equity samples in order. Null when fewer than two. */
  spark: number[] | null;
}

export const STRATEGY_CSV_HEADER = 'Id,Kind,Side,Qty,Price,Time,Comment';

interface OpenLeg {
  id: string;
  direction: string | undefined;
  price: number | undefined;
  qty: number | undefined;
  time: number | undefined;
  barIndex: number | undefined;
}

function finiteOrNull(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Long/short only. Flat and unknown directions stay null. */
export function parseSide(direction: string | undefined): 'long' | 'short' | null {
  if (!direction) return null;
  const side = direction.trim().toLowerCase();
  if (side === 'long' || side === 'strategy.long') return 'long';
  if (side === 'short' || side === 'strategy.short') return 'short';
  return null;
}

function resolveSide(entry: string | undefined, exit: string | undefined): 'long' | 'short' | null {
  const openSide = parseSide(entry);
  const closeSide = parseSide(exit);
  if (openSide && closeSide && openSide !== closeSide) return null;
  return openSide ?? closeSide;
}

export function tradeSide(kind: string): 'entry' | 'exit' | 'other' {
  const name = kind.trim().toLowerCase();
  if (name === 'entry') return 'entry';
  if (name === 'exit' || name === 'close' || name === 'close_all') return 'exit';
  return 'other';
}

function isCloseAll(kind: string): boolean {
  return kind.trim().toLowerCase() === 'close_all';
}

export function parseStrategyFilter(value: string | null | undefined): StrategyTableFilter | null {
  if (value === 'all' || value === 'entries' || value === 'exits') return value;
  return null;
}

export function tradeMatchesFilter(kind: string, filter: StrategyTableFilter): boolean {
  if (filter === 'all') return true;
  const side = tradeSide(kind);
  if (filter === 'entries') return side === 'entry';
  return side === 'exit';
}

function usableQty(value: number | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || !(value > 0)) return null;
  return value;
}

function qtyConflict(entry: number | undefined, exit: number | undefined): boolean {
  const openQty = usableQty(entry);
  const closeQty = usableQty(exit);
  return openQty !== null && closeQty !== null && openQty !== closeQty;
}

function sharedQty(entry: number | undefined, exit: number | undefined): number | null {
  const openQty = usableQty(entry);
  const closeQty = usableQty(exit);
  if (openQty !== null && closeQty !== null) return openQty;
  return openQty ?? closeQty;
}

function priceResult(
  direction: 'long' | 'short' | null,
  entryPrice: number | null,
  exitPrice: number | null,
  qty: number | null,
): { result: number | null; unit: TradeResultUnit | null } {
  if (direction === null || entryPrice === null || exitPrice === null) {
    return { result: null, unit: null };
  }
  const points = direction === 'long' ? exitPrice - entryPrice : entryPrice - exitPrice;
  if (qty === null) return { result: points, unit: 'points' };
  return { result: points * qty, unit: 'money' };
}

function toLeg(trade: MetricTrade): OpenLeg {
  return {
    id: trade.id,
    direction: trade.direction,
    price: trade.price,
    qty: trade.qty,
    time: trade.time,
    barIndex: trade.barIndex,
  };
}

function makeTrip(entry: OpenLeg, exit: MetricTrade): RoundTrip {
  const direction = resolveSide(entry.direction, exit.direction);
  const entryPrice = finiteOrNull(entry.price);
  const exitPrice = finiteOrNull(exit.price);
  const priced = priceResult(direction, entryPrice, exitPrice, sharedQty(entry.qty, exit.qty));
  return {
    id: entry.id,
    direction,
    entryPrice,
    exitPrice,
    result: priced.result,
    resultUnit: priced.unit,
    entryBar: finiteOrNull(entry.barIndex),
    exitBar: finiteOrNull(exit.barIndex),
    entryTime: finiteOrNull(entry.time),
    exitTime: finiteOrNull(exit.time),
  };
}

function pairRoundTrips(trades: readonly MetricTrade[]): { ambiguous: boolean; trips: RoundTrip[] } {
  const open: OpenLeg[] = [];
  const trips: RoundTrip[] = [];
  for (const trade of trades) {
    const side = tradeSide(trade.kind);
    if (side === 'other') continue;
    if (side === 'entry') {
      open.push(toLeg(trade));
      continue;
    }
    let index: number | null = null;
    if (isCloseAll(trade.kind)) {
      if (open.length !== 1) return { ambiguous: true, trips: [] };
      index = 0;
    } else {
      const matches: number[] = [];
      for (let i = 0; i < open.length; i++) {
        const leg = open[i];
        if (leg && leg.id === trade.id) matches.push(i);
      }
      if (matches.length > 1) return { ambiguous: true, trips: [] };
      const matched = matches[0];
      if (matches.length === 1 && matched !== undefined) index = matched;
      else if (open.length === 1) index = 0;
      else return { ambiguous: true, trips: [] };
    }
    const leg = open[index];
    if (!leg || qtyConflict(leg.qty, trade.qty)) return { ambiguous: true, trips: [] };
    open.splice(index, 1);
    trips.push(makeTrip(leg, trade));
  }
  return { ambiguous: false, trips };
}

/** Drop null and non-finite samples. Null is a gap, not a zero. */
export function finiteEquity(equity: readonly (number | null)[] | null | undefined): number[] | null {
  if (!equity) return null;
  const points: number[] = [];
  for (const value of equity) {
    if (typeof value === 'number' && Number.isFinite(value)) points.push(value);
  }
  return points.length >= 2 ? points : null;
}

function maxDrawdownOf(points: number[] | null): number | null {
  if (!points || points.length < 2) return null;
  const first = points[0];
  if (first === undefined) return null;
  let peak = first;
  let maxDrop = 0;
  for (const value of points) {
    if (value > peak) peak = value;
    const drop = peak - value;
    if (drop > maxDrop) maxDrop = drop;
  }
  return maxDrop;
}

function summarize(trips: readonly RoundTrip[]): {
  winRate: number;
  profitFactor: number | null;
  averageTrade: number | null;
  grossProfit: number | null;
  grossLoss: number | null;
  tradeNet: number | null;
  resultUnit: TradeResultUnit | null;
} | null {
  if (trips.length === 0) return null;
  if (!trips.every((trip) => trip.result !== null && trip.resultUnit !== null)) return null;
  let wins = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let sum = 0;
  const units = new Set<TradeResultUnit>();
  for (const trip of trips) {
    const result = trip.result;
    const unit = trip.resultUnit;
    if (result === null || unit === null) continue;
    units.add(unit);
    sum += result;
    if (result > 0) {
      grossProfit += result;
      wins += 1;
    } else if (result < 0) {
      grossLoss += result;
    }
  }
  const winRate = wins / trips.length;
  if (units.size !== 1) {
    return {
      winRate,
      profitFactor: null,
      averageTrade: null,
      grossProfit: null,
      grossLoss: null,
      tradeNet: null,
      resultUnit: null,
    };
  }
  const resultUnit = units.values().next().value ?? null;
  let profitFactor: number | null = null;
  if (grossLoss < 0) profitFactor = grossProfit / Math.abs(grossLoss);
  else if (grossProfit > 0) profitFactor = Number.POSITIVE_INFINITY;
  return {
    winRate,
    profitFactor,
    averageTrade: sum / trips.length,
    grossProfit,
    grossLoss,
    tradeNet: sum,
    resultUnit,
  };
}

export function buildStrategyReport(input: {
  trades: readonly MetricTrade[];
  equity?: readonly (number | null)[] | null;
  /**
   * `trades` / `entries` / `exits` are event counters when the payload
   * has them. They are not closed round trips, so they are not read.
   */
  stats?: {
    trades?: number;
    entries?: number;
    exits?: number;
    netProfit?: number;
  } | null;
}): StrategyReport {
  const paired = pairRoundTrips(input.trades ?? []);
  const spark = finiteEquity(input.equity);
  const summary = paired.ambiguous ? null : summarize(paired.trips);
  const reported = input.stats?.netProfit;
  let netProfit: number | null = null;
  let netProfitSource: StrategyReport['netProfitSource'] = null;
  if (typeof reported === 'number' && Number.isFinite(reported)) {
    netProfit = reported;
    netProfitSource = 'stats';
  } else if (summary && summary.tradeNet !== null) {
    netProfit = summary.tradeNet;
    netProfitSource = 'trades';
  } else if (spark) {
    const first = spark[0];
    const last = spark[spark.length - 1];
    if (first !== undefined && last !== undefined) {
      netProfit = last - first;
      netProfitSource = 'equity';
    }
  }
  return {
    ambiguous: paired.ambiguous,
    roundTrips: paired.ambiguous ? [] : paired.trips,
    netProfit,
    netProfitSource,
    closedTrades: paired.ambiguous ? null : paired.trips.length,
    winRate: summary?.winRate ?? null,
    profitFactor: summary?.profitFactor ?? null,
    averageTrade: summary?.averageTrade ?? null,
    maxDrawdown: maxDrawdownOf(spark),
    grossProfit: summary?.grossProfit ?? null,
    grossLoss: summary?.grossLoss ?? null,
    resultUnit: summary?.resultUnit ?? null,
    spark,
  };
}

/** Display trim for binary float dust. Caps at 8 decimal places; does not pad zeros. */
export function formatPlain(value: number): string {
  if (!Number.isFinite(value) || value === 0) return Number.isFinite(value) ? '0' : '—';
  const negative = value < 0;
  const abs = Math.abs(value);
  const digits =
    abs >= 1e-6 && abs < 1e12 ? abs.toFixed(8).replace(/0+$/, '').replace(/\.$/, '') : String(abs);
  return negative ? `-${digits}` : digits;
}

export function formatSigned(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (value > 0) return `+${formatPlain(value)}`;
  return formatPlain(value);
}

export function formatPercent(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return '—';
  const pct = ratio * 100;
  if (pct === 0) return '0%';
  const negative = pct < 0;
  const digits = Math.abs(pct).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${negative ? '-' : ''}${digits}%`;
}

export function formatProfitFactor(value: number | null): string {
  if (value === null) return '—';
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '—';
  return formatPlain(value);
}

export function formatResult(
  value: number | null,
  unit: TradeResultUnit | null,
  signed = false,
): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const body = signed ? formatSigned(value) : formatPlain(value);
  if (unit === 'points') return `${body} pts`;
  return body;
}

function csvField(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return formatPlain(value);
  }
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Full trade list, not the filtered table. Columns match the on-screen table. */
export function strategyTradesCsv(trades: readonly MetricTrade[]): string {
  const lines = [STRATEGY_CSV_HEADER];
  for (const trade of trades) {
    lines.push(
      [
        csvField(trade.id),
        csvField(trade.kind),
        csvField(trade.direction),
        csvField(trade.qty),
        csvField(trade.price),
        csvField(trade.time),
        csvField(trade.comment),
      ].join(','),
    );
  }
  return lines.join('\n');
}
