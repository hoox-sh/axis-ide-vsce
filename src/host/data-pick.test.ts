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
import { defaultChartDocument } from '../editors/chart-document';
import {
  DATA_TIMEFRAMES,
  applyDataPickToDoc,
  isDataTimeframe,
} from './data-pick';

describe('data pick', () => {
  test('timeframe catalog matches common bars', () => {
    expect([...DATA_TIMEFRAMES]).toEqual(['1m', '5m', '15m', '1h', '4h', '1d']);
    expect(isDataTimeframe('1h')).toBe(true);
    expect(isDataTimeframe('2h')).toBe(false);
    expect(isDataTimeframe('')).toBe(false);
  });

  test('applyDataPickToDoc merges non-empty fields and lowercases exchange', () => {
    const base = defaultChartDocument();
    const next = applyDataPickToDoc(base, {
      symbol: ' ETH/USDT ',
      exchange: 'OKX',
      interval: '5m',
    });
    expect(next.symbol).toBe('ETH/USDT');
    expect(next.exchange).toBe('okx');
    expect(next.interval).toBe('5m');
    expect(base.symbol).toBe('');
  });

  test('applyDataPickToDoc ignores empty / missing fields', () => {
    const base = { ...defaultChartDocument(), symbol: 'BTC/USDT', interval: '1m' };
    const next = applyDataPickToDoc(base, { symbol: '  ', exchange: '', interval: undefined });
    expect(next.symbol).toBe('BTC/USDT');
    expect(next.exchange).toBe(base.exchange);
    expect(next.interval).toBe('1m');
  });

  test('applyDataPickToDoc writes and clears barsPath', () => {
    const withPath = applyDataPickToDoc(defaultChartDocument(), { barsPath: ' fixtures/sample-bars.csv ' });
    expect(withPath.barsPath).toBe('fixtures/sample-bars.csv');
    const cleared = applyDataPickToDoc(withPath, { barsPath: '' });
    expect(cleared.barsPath).toBe('');
  });
});
