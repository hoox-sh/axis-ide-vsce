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
  CCXT_NOT_AVAILABLE,
  DEFAULT_CCXT_EXCHANGE,
  fetchCcxtHistorical,
  isCcxtUnavailable,
} from './ccxt-client';

type Call = { symbol: string; timeframe: string; since: number | undefined; limit: number | undefined };

/** Inject a fake ccxt module whose `binance` exchange records fetchOHLCV calls. */
function fakeCcxt(returns: unknown[][], calls: Call[]) {
  class Exchange {
    enableRateLimit = true;
    async fetchOHLCV(
      symbol: string,
      timeframe: string,
      since?: number,
      limit?: number,
    ): Promise<unknown[]> {
      calls.push({ symbol, timeframe, since, limit });
      return returns;
    }
    async close(): Promise<unknown> {
      return undefined;
    }
  }
  return { binance: Exchange } as { [name: string]: unknown };
}

describe('ccxt-client (venue OHLCV, no network)', () => {
  const MS_1700 = 1_700_000_000_000;
  const SEC_1700 = 1_700_000_000;

  test('default exchange is binance', () => {
    expect(DEFAULT_CCXT_EXCHANGE).toBe('binance');
  });

  test('isCcxtUnavailable matches the packaged-VSIX missing-module error', () => {
    expect(isCcxtUnavailable(CCXT_NOT_AVAILABLE)).toBe(true);
    expect(isCcxtUnavailable('network down')).toBe(false);
    expect(isCcxtUnavailable(undefined)).toBe(false);
  });

  test('pair-forms load-form symbol and passes timeframe through', async () => {
    const calls: Call[] = [];
    const ccxt = fakeCcxt(
      [[MS_1700, 10, 12, 9, 11, 100]],
      calls,
    );
    const result = await fetchCcxtHistorical(
      { exchange: 'Binance', symbol: 'BTCUSDT', timeframe: '1M', limit: 50 },
      ccxt,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bars).toHaveLength(1);
    expect(result.endpoint).toBe(`ccxt:${DEFAULT_CCXT_EXCHANGE}`);

    expect(calls[0]?.symbol).toBe('BTC/USDT');
    expect(calls[0]?.timeframe).toBe('1m');
    expect(calls[0]?.limit).toBe(50);
    expect(calls[0]?.since).toBeUndefined();
  });

  test('already-paired symbol passes through; unknown load-form uppercases', async () => {
    const calls: Call[] = [];
    const ccxt = fakeCcxt([], calls);
    await fetchCcxtHistorical(
      { exchange: 'binance', symbol: 'ETH/USDT', timeframe: '15m', limit: 5 },
      ccxt,
    );
    await fetchCcxtHistorical(
      { exchange: 'binance', symbol: 'xxbtzusd', timeframe: '', limit: 3 },
      ccxt,
    );
    expect(calls[0]?.symbol).toBe('ETH/USDT');
    expect(calls[0]?.timeframe).toBe('15m');
    expect(calls[1]?.symbol).toBe('XXBTZUSD');
    expect(calls[1]?.timeframe).toBe('1m');
  });

  test('converts since seconds to ccxt ms and clamps limit to cap', async () => {
    const calls: Call[] = [];
    const ccxt = fakeCcxt([], calls);
    const result = await fetchCcxtHistorical(
      {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        since: SEC_1700,
        limit: 50_000,
      },
      ccxt,
    );
    expect(result.ok).toBe(true);
    expect(calls[0]?.since).toBe(MS_1700);
    expect(calls[0]?.limit).toBe(20_000); // MOCK_BARS_CAP
  });

  test('clamps bar invariants and negative volume', async () => {
    const calls: Call[] = [];
    const ccxt = fakeCcxt(
      [
        // high below open/close → clamped up; low above close → clamped down; negative volume → 0
        [MS_1700, 10, 5, 8, 9, -3],
        // t <= 0 (ms=0) → dropped
        [0, 1, 2, 0.5, 1.5, 10],
        // non-finite open → dropped
        [MS_1700, 'x', 2, 0.5, 1.5, 10],
        // short row → dropped
        [MS_1700, 1, 2],
        // normal bar
        [MS_1700 + 60_000, 9, 11, 8, 10, 50],
      ],
      calls,
    );
    const result = await fetchCcxtHistorical({ symbol: 'BTC/USDT', timeframe: '1m' }, ccxt);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bars).toEqual([
      { time: SEC_1700, open: 10, high: 10, low: 8, close: 9, volume: 0 },
      { time: SEC_1700 + 60, open: 9, high: 11, low: 8, close: 10, volume: 50 },
    ]);
  });

  test('since is omitted when not positive', async () => {
    const calls: Call[] = [];
    const ccxt = fakeCcxt([], calls);
    await fetchCcxtHistorical({ symbol: 'BTC/USDT', timeframe: '1m', since: 0 }, ccxt);
    await fetchCcxtHistorical({ symbol: 'BTC/USDT', timeframe: '1m', since: -5 }, ccxt);
    expect(calls[0]?.since).toBeUndefined();
    expect(calls[1]?.since).toBeUndefined();
  });

  test('rejects missing symbol', async () => {
    const result = await fetchCcxtHistorical({ symbol: '   ', timeframe: '1m' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/symbol/i);
  });

  test('ccxt not installed degrades gracefully', async () => {
    const result = await fetchCcxtHistorical(
      { symbol: 'BTC/USDT', timeframe: '1m' },
      undefined,
      async () => {
        throw new Error('Cannot find module ccxt');
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(CCXT_NOT_AVAILABLE);
  });

  test('an injected loader supplies the module', async () => {
    const calls: Call[] = [];
    const result = await fetchCcxtHistorical(
      { symbol: 'BTC/USDT', timeframe: '1m' },
      undefined,
      async () => fakeCcxt([[MS_1700, 10, 12, 9, 11, 100]], calls),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bars).toHaveLength(1);
    expect(calls[0]?.symbol).toBe('BTC/USDT');
  });

  test('exchange construction failure is reported', async () => {
    class BadExchange {
      constructor() {
        throw new Error('bad ctor');
      }
    }
    const ccxt = { binance: BadExchange } as { [name: string]: unknown };
    const result = await fetchCcxtHistorical({ symbol: 'BTC/USDT', timeframe: '1m' }, ccxt);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/construction failed/);
  });

  test('unsupported exchange returns error', async () => {
    const result = await fetchCcxtHistorical(
      { exchange: 'nope-exchange', symbol: 'BTC/USDT', timeframe: '1m' },
      fakeCcxt([], []),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/unsupported ccxt exchange/);
  });

  test('ccxt fetch error is reported, never throws', async () => {
    class Exchange {
      enableRateLimit = true;
      fetchOHLCV(): never {
        throw new Error('market closed');
      }
      async close(): Promise<unknown> {
        return undefined;
      }
    }
    const ccxt = { binance: Exchange } as { [name: string]: unknown };
    const result = await fetchCcxtHistorical({ symbol: 'BTC/USDT', timeframe: '1m' }, ccxt);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/market closed/);
  });

  test('aborted signal returns reason aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    class Exchange {
      enableRateLimit = true;
      async fetchOHLCV(): Promise<unknown[]> {
        return new Promise(() => {});
      }
      async close(): Promise<unknown> {
        return undefined;
      }
    }
    const ccxt = { binance: Exchange } as { [name: string]: unknown };
    const result = await fetchCcxtHistorical(
      { symbol: 'BTC/USDT', timeframe: '1m', signal: ac.signal },
      ccxt,
    );
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.reason).toBe('aborted');
      expect(result.error).toMatch(/aborted/i);
    }
  });

  test('hostile exchange value hits the outer catch and never throws', async () => {
    const hostile = { toString(): string { throw new Error('hostile'); } };
    const result = await fetchCcxtHistorical({
      exchange: hostile as unknown as string,
      symbol: 'BTC/USDT',
      timeframe: '1m',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/unexpected failure|hostile/i);
  });

  test('abort mid-fetch (listener branch) returns reason aborted', async () => {
    const ac = new AbortController(); // not aborted yet
    class Exchange {
      enableRateLimit = true;
      async fetchOHLCV(): Promise<unknown[]> {
        return new Promise(() => {}); // never resolves
      }
      async close(): Promise<unknown> {
        return undefined;
      }
    }
    const ccxt = { binance: Exchange } as { [name: string]: unknown };
    setTimeout(() => ac.abort(), 10);
    const result = await fetchCcxtHistorical(
      { symbol: 'BTC/USDT', timeframe: '1m', signal: ac.signal },
      ccxt,
    );
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.reason).toBe('aborted');
      expect(result.error).toMatch(/aborted/i);
    }
  });

  test('limit 0 is clamped to undefined and not sent', async () => {
    const calls: Call[] = [];
    const ccxt = fakeCcxt([], calls);
    const result = await fetchCcxtHistorical(
      { symbol: 'BTC/USDT', timeframe: '1m', limit: 0 },
      ccxt,
    );
    expect(result.ok).toBe(true);
    expect(calls[0]?.limit).toBeUndefined();
  });

  test('a throwing close does not fail a successful fetch', async () => {
    const calls: Call[] = [];
    class Exchange {
      enableRateLimit = true;
      async fetchOHLCV(): Promise<unknown[]> {
        calls.push({ symbol: 'BTC/USDT', timeframe: '1m', since: undefined, limit: undefined });
        return [[MS_1700, 1, 2, 0.5, 1.5, 100]];
      }
      async close(): Promise<unknown> {
        throw new Error('close boom');
      }
    }
    const ccxt = { binance: Exchange } as { [name: string]: unknown };
    const result = await fetchCcxtHistorical({ symbol: 'BTC/USDT', timeframe: '1m' }, ccxt);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bars).toHaveLength(1);
    expect(result.bars[0]?.close).toBe(1.5);
  });
});
