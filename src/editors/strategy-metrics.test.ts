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
import {
  STRATEGY_CSV_HEADER,
  buildStrategyReport,
  finiteEquity,
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
} from '../../webview/chart/src/strategy-metrics';

function leg(
  id: string,
  kind: string,
  extra: Omit<Partial<MetricTrade>, 'id' | 'kind'> = {},
): MetricTrade {
  return { id, kind, ...extra };
}

describe('strategy report metrics', () => {
  test('pairs a same-id long and prefers price math over event counters', () => {
    const report = buildStrategyReport({
      trades: [
        leg('L', 'entry', { direction: 'long', price: 100, qty: 1 }),
        leg('L', 'exit', { direction: 'long', price: 110, qty: 1 }),
      ],
      stats: { trades: 99, entries: 40, exits: 40 },
    });
    expect(report.ambiguous).toBe(false);
    expect(report.closedTrades).toBe(1);
    expect(report.roundTrips[0]).toMatchObject({
      id: 'L',
      direction: 'long',
      entryPrice: 100,
      exitPrice: 110,
      result: 10,
      resultUnit: 'money',
    });
    expect(report.netProfit).toBe(10);
    expect(report.netProfitSource).toBe('trades');
    expect(report.winRate).toBe(1);
    expect(report.profitFactor).toBe(Number.POSITIVE_INFINITY);
    expect(report.averageTrade).toBe(10);
    expect(report.grossProfit).toBe(10);
    expect(report.grossLoss).toBe(0);
    expect(report.maxDrawdown).toBeNull();
    expect(report.spark).toBeNull();
  });

  test('pairs a short by quantity and a sequential exit with a different id', () => {
    const same = buildStrategyReport({
      trades: [
        leg('S', 'entry', { direction: 'strategy.short', price: 50, qty: 3 }),
        leg('S', 'exit', { direction: 'short', price: 40, qty: 3 }),
      ],
    });
    expect(same.roundTrips[0]?.result).toBe(30);
    expect(same.resultUnit).toBe('money');

    const sequential = buildStrategyReport({
      trades: [
        leg('t0', 'entry', { direction: 'Long', price: 10, qty: 1 }),
        leg('t1', 'exit', { direction: 'buy', price: 12, qty: 1 }),
      ],
    });
    expect(sequential.ambiguous).toBe(false);
    expect(sequential.roundTrips).toHaveLength(1);
    expect(sequential.roundTrips[0]?.id).toBe('t0');
    expect(sequential.roundTrips[0]?.result).toBe(2);
  });

  test('pairs by id when two names are open, which FIFO would cross', () => {
    const report = buildStrategyReport({
      trades: [
        leg('A', 'entry', { direction: 'long', price: 10, qty: 1 }),
        leg('B', 'entry', { direction: 'short', price: 20, qty: 1 }),
        leg('B', 'exit', { direction: 'short', price: 15, qty: 1 }),
        leg('A', 'exit', { direction: 'long', price: 14, qty: 1 }),
      ],
    });
    expect(report.ambiguous).toBe(false);
    expect(report.roundTrips.map((trip) => trip.id)).toEqual(['B', 'A']);
    expect(report.roundTrips.map((trip) => trip.result)).toEqual([5, 4]);
    expect(report.netProfit).toBe(9);
    expect(report.winRate).toBe(1);
    expect(report.averageTrade).toBe(4.5);
    expect(report.grossProfit).toBe(9);
    expect(report.grossLoss).toBe(0);
  });

  test('win, loss, and breakeven stats stay on the closed results', () => {
    const mixed = buildStrategyReport({
      trades: [
        leg('A', 'entry', { direction: 'long', price: 10, qty: 1 }),
        leg('A', 'exit', { direction: 'long', price: 20, qty: 1 }),
        leg('B', 'entry', { direction: 'long', price: 10, qty: 1 }),
        leg('B', 'exit', { direction: 'long', price: 6, qty: 1 }),
      ],
    });
    expect(mixed.winRate).toBe(0.5);
    expect(mixed.grossProfit).toBe(10);
    expect(mixed.grossLoss).toBe(-4);
    expect(mixed.profitFactor).toBe(2.5);
    expect(mixed.averageTrade).toBe(3);
    expect(mixed.netProfit).toBe(6);

    const flat = buildStrategyReport({
      trades: [
        leg('A', 'entry', { direction: 'long', price: 10, qty: 1 }),
        leg('A', 'exit', { direction: 'long', price: 10, qty: 1 }),
      ],
    });
    expect(flat.winRate).toBe(0);
    expect(flat.grossProfit).toBe(0);
    expect(flat.grossLoss).toBe(0);
    expect(flat.profitFactor).toBeNull();
    expect(flat.averageTrade).toBe(0);
    expect(flat.netProfit).toBe(0);

    const loss = buildStrategyReport({
      trades: [
        leg('A', 'entry', { direction: 'long', price: 10, qty: 1 }),
        leg('A', 'exit', { direction: 'long', price: 5, qty: 1 }),
      ],
    });
    expect(loss.winRate).toBe(0);
    expect(loss.profitFactor).toBe(0);
    expect(loss.grossProfit).toBe(0);
    expect(loss.grossLoss).toBe(-5);
  });

  test('reported net profit wins over closes and equity', () => {
    const report = buildStrategyReport({
      trades: [
        leg('L', 'entry', { direction: 'long', price: 1, qty: 1 }),
        leg('L', 'exit', { direction: 'long', price: 11, qty: 1 }),
      ],
      equity: [0, 100],
      stats: { netProfit: 4 },
    });
    expect(report.netProfit).toBe(4);
    expect(report.netProfitSource).toBe('stats');
    expect(report.grossProfit).toBe(10);
    expect(report.averageTrade).toBe(10);
    expect(report.maxDrawdown).toBe(0);
    expect(report.netProfit).not.toBe(report.grossProfit);
  });

  test('points when quantity is missing, and mixed units do not sum', () => {
    const points = buildStrategyReport({
      trades: [
        leg('L', 'entry', { direction: 'long', price: 10 }),
        leg('L', 'exit', { direction: 'long', price: 13 }),
      ],
    });
    expect(points.resultUnit).toBe('points');
    expect(points.netProfit).toBe(3);
    expect(formatResult(points.netProfit, points.resultUnit, true)).toBe('+3 pts');

    const oneSidedQty = buildStrategyReport({
      trades: [
        leg('L', 'entry', { direction: 'long', price: 10, qty: 2 }),
        leg('L', 'exit', { direction: 'long', price: 12 }),
      ],
    });
    expect(oneSidedQty.roundTrips[0]?.result).toBe(4);
    expect(oneSidedQty.resultUnit).toBe('money');

    const mixed = buildStrategyReport({
      trades: [
        leg('A', 'entry', { direction: 'long', price: 1, qty: 1 }),
        leg('A', 'exit', { direction: 'long', price: 11, qty: 1 }),
        leg('B', 'entry', { direction: 'long', price: 5 }),
        leg('B', 'exit', { direction: 'long', price: 6 }),
      ],
    });
    expect(mixed.winRate).toBe(1);
    expect(mixed.resultUnit).toBeNull();
    expect(mixed.grossProfit).toBeNull();
    expect(mixed.averageTrade).toBeNull();
    expect(mixed.profitFactor).toBeNull();
    expect(mixed.netProfit).toBeNull();
    expect(mixed.closedTrades).toBe(2);
  });

  test('unpriced and conflicting closes do not invent a win rate', () => {
    const unpriced = buildStrategyReport({
      trades: [
        leg('A', 'entry', { direction: 'long', price: 1, qty: 1 }),
        leg('A', 'exit', { direction: 'long', price: 2, qty: 1 }),
        leg('B', 'entry', { direction: 'long' }),
        leg('B', 'exit', { direction: 'long' }),
      ],
    });
    expect(unpriced.closedTrades).toBe(2);
    expect(unpriced.winRate).toBeNull();
    expect(unpriced.netProfit).toBeNull();

    const conflict = buildStrategyReport({
      trades: [
        leg('L', 'entry', { direction: 'long', price: 10, qty: 1 }),
        leg('L', 'exit', { direction: 'short', price: 12, qty: 1 }),
      ],
    });
    expect(conflict.ambiguous).toBe(false);
    expect(conflict.closedTrades).toBe(1);
    expect(conflict.roundTrips[0]?.direction).toBeNull();
    expect(conflict.roundTrips[0]?.result).toBeNull();
    expect(conflict.winRate).toBeNull();
  });

  test('ambiguous sequences stay on the event list', () => {
    const pyramid = buildStrategyReport({
      trades: [
        leg('L', 'entry', { direction: 'long', price: 1, qty: 1 }),
        leg('L', 'entry', { direction: 'long', price: 2, qty: 1 }),
        leg('L', 'exit', { direction: 'long', price: 3, qty: 1 }),
      ],
      stats: { trades: 3, entries: 2, exits: 1, netProfit: 50 },
    });
    expect(pyramid.ambiguous).toBe(true);
    expect(pyramid.roundTrips).toEqual([]);
    expect(pyramid.closedTrades).toBeNull();
    expect(pyramid.winRate).toBeNull();
    expect(pyramid.netProfit).toBe(50);
    expect(pyramid.netProfitSource).toBe('stats');

    const crossed = buildStrategyReport({
      trades: [
        leg('A', 'entry', { direction: 'long', price: 1, qty: 1 }),
        leg('B', 'entry', { direction: 'long', price: 1, qty: 1 }),
        leg('Z', 'exit', { direction: 'long', price: 2, qty: 1 }),
      ],
    });
    expect(crossed.ambiguous).toBe(true);
    expect(crossed.closedTrades).toBeNull();

    const orphan = buildStrategyReport({
      trades: [leg('L', 'exit', { direction: 'long', price: 2, qty: 1 })],
    });
    expect(orphan.ambiguous).toBe(true);
    expect(orphan.closedTrades).toBeNull();

    const backwards = buildStrategyReport({
      trades: [
        leg('L', 'exit', { direction: 'long', price: 2, qty: 1 }),
        leg('L', 'entry', { direction: 'long', price: 1, qty: 1 }),
      ],
    });
    expect(backwards.ambiguous).toBe(true);

    const extraExit = buildStrategyReport({
      trades: [
        leg('L', 'entry', { direction: 'long', price: 1, qty: 1 }),
        leg('L', 'exit', { direction: 'long', price: 2, qty: 1 }),
        leg('L', 'exit', { direction: 'long', price: 3, qty: 1 }),
      ],
    });
    expect(extraExit.ambiguous).toBe(true);
    expect(extraExit.roundTrips).toEqual([]);

    const partial = buildStrategyReport({
      trades: [
        leg('L', 'entry', { direction: 'long', price: 10, qty: 2 }),
        leg('L', 'exit', { direction: 'long', price: 12, qty: 1 }),
      ],
    });
    expect(partial.ambiguous).toBe(true);
    expect(partial.closedTrades).toBeNull();
  });

  test('close_all pairs one open leg and refuses several', () => {
    const one = buildStrategyReport({
      trades: [
        leg('L', 'entry', { direction: 'long', price: 10, qty: 2, barIndex: 4, time: 40 }),
        leg('all', 'close_all', { price: 11, barIndex: 5, time: 50 }),
      ],
    });
    expect(one.ambiguous).toBe(false);
    expect(one.roundTrips[0]).toMatchObject({
      id: 'L',
      direction: 'long',
      result: 2,
      entryBar: 4,
      exitBar: 5,
      entryTime: 40,
      exitTime: 50,
    });

    const many = buildStrategyReport({
      trades: [
        leg('A', 'entry', { direction: 'long', price: 1, qty: 1 }),
        leg('B', 'entry', { direction: 'short', price: 2, qty: 1 }),
        leg('all', 'close_all', { price: 3 }),
      ],
    });
    expect(many.ambiguous).toBe(true);
    expect(many.closedTrades).toBeNull();
  });

  test('unknown kinds do not block a clean entry then exit', () => {
    const report = buildStrategyReport({
      trades: [
        leg('L', 'Entry', { direction: 'long', price: 1, qty: 1 }),
        leg('x', 'order', { price: 9 }),
        leg('L', 'Close', { direction: 'flat', price: 4, qty: 1 }),
      ],
    });
    expect(report.ambiguous).toBe(false);
    expect(report.closedTrades).toBe(1);
    expect(report.roundTrips[0]?.direction).toBe('long');
    expect(report.roundTrips[0]?.result).toBe(3);
  });

  test('a single open entry is finished, not a fake close', () => {
    const report = buildStrategyReport({
      trades: [leg('L', 'entry', { direction: 'long', price: 10, qty: 1 })],
      equity: [1000, 1010, 990],
    });
    expect(report.ambiguous).toBe(false);
    expect(report.closedTrades).toBe(0);
    expect(report.roundTrips).toEqual([]);
    expect(report.winRate).toBeNull();
    expect(report.profitFactor).toBeNull();
    expect(report.grossProfit).toBeNull();
    expect(report.netProfit).toBe(-10);
    expect(report.netProfitSource).toBe('equity');
    expect(report.maxDrawdown).toBe(20);
    expect(report.spark).toEqual([1000, 1010, 990]);
  });

  test('equity gaps are not zeros, and one sample is not a curve', () => {
    const gapped = buildStrategyReport({ equity: [100, null, 80], trades: [] });
    expect(gapped.spark).toEqual([100, 80]);
    expect(gapped.maxDrawdown).toBe(20);
    expect(gapped.netProfit).toBe(-20);
    expect(gapped.closedTrades).toBe(0);

    const peak = buildStrategyReport({ equity: [100, 130, 90, 120], trades: [] });
    expect(peak.maxDrawdown).toBe(40);
    expect(peak.netProfit).toBe(20);

    const single = buildStrategyReport({ equity: [null, 5, null], trades: [] });
    expect(single.spark).toBeNull();
    expect(single.maxDrawdown).toBeNull();
    expect(single.netProfit).toBeNull();
    expect(finiteEquity([Number.NaN, Number.POSITIVE_INFINITY, 1])).toBeNull();

    const flat = buildStrategyReport({ equity: [5, 5], trades: [] });
    expect(flat.maxDrawdown).toBe(0);
    expect(flat.netProfit).toBe(0);
    expect(flat.netProfitSource).toBe('equity');

    const reportedZero = buildStrategyReport({
      equity: [5, 1],
      trades: [],
      stats: { netProfit: 0 },
    });
    expect(reportedZero.netProfit).toBe(0);
    expect(reportedZero.netProfitSource).toBe('stats');
    expect(reportedZero.maxDrawdown).toBe(4);
  });

  test('closed trade results beat the equity delta when both exist', () => {
    const report = buildStrategyReport({
      trades: [
        leg('L', 'entry', { direction: 'long', price: 1, qty: 1 }),
        leg('L', 'exit', { direction: 'long', price: 11, qty: 1 }),
      ],
      equity: [0, 100],
    });
    expect(report.netProfit).toBe(10);
    expect(report.netProfitSource).toBe('trades');
    expect(report.maxDrawdown).toBe(0);
  });

  test('display helpers do not pad precision', () => {
    expect(formatPlain(10)).toBe('10');
    expect(formatPlain(0)).toBe('0');
    expect(formatPlain(-0)).toBe('0');
    expect(formatPlain(0.1 + 0.2)).toBe('0.3');
    expect(formatPlain(0.1 * 3)).toBe('0.3');
    expect(formatPlain(Number.NaN)).toBe('—');
    expect(formatSigned(2)).toBe('+2');
    expect(formatSigned(-2)).toBe('-2');
    expect(formatSigned(null)).toBe('—');
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(1)).toBe('100%');
    expect(formatPercent(0.5)).toBe('50%');
    expect(formatPercent(2 / 3)).toBe('66.67%');
    expect(formatProfitFactor(null)).toBe('—');
    expect(formatProfitFactor(0)).toBe('0');
    expect(formatProfitFactor(Number.POSITIVE_INFINITY)).toBe('∞');
    expect(formatResult(1.5, 'points', true)).toBe('+1.5 pts');
    expect(formatResult(-2, 'money', true)).toBe('-2');
    expect(formatResult(null, 'money', true)).toBe('—');
  });

  test('side words and table filters', () => {
    expect(parseSide('Strategy.Long')).toBe('long');
    expect(parseSide('strategy.short')).toBe('short');
    expect(parseSide('sell')).toBeNull();
    expect(parseSide('buy')).toBeNull();
    expect(parseSide('flat')).toBeNull();
    expect(parseSide(undefined)).toBeNull();
    expect(tradeMatchesFilter('Entry', 'entries')).toBe(true);
    expect(tradeMatchesFilter('close', 'exits')).toBe(true);
    expect(tradeMatchesFilter('close_all', 'entries')).toBe(false);
    expect(tradeMatchesFilter('close_all', 'exits')).toBe(true);
    expect(tradeMatchesFilter('order', 'exits')).toBe(false);
    expect(tradeMatchesFilter('order', 'all')).toBe(true);
    expect(parseStrategyFilter('entries')).toBe('entries');
    expect(parseStrategyFilter('nope')).toBeNull();
  });

  test('csv matches the table columns and keeps raw text', () => {
    expect(strategyTradesCsv([])).toBe(STRATEGY_CSV_HEADER);
    const csv = strategyTradesCsv([
      leg('a,b', 'entry', {
        direction: 'long',
        qty: 1,
        price: 0.1 + 0.2,
        time: 5,
        comment: 'say "hi"',
      }),
    ]);
    expect(csv).toBe(`${STRATEGY_CSV_HEADER}\n"a,b",entry,long,1,0.3,5,"say ""hi"""`);
  });
});
