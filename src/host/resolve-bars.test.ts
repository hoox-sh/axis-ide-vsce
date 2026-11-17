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
import { CCXT_NOT_AVAILABLE } from './ccxt-client';
import { buildSeriesKey } from './chart-session';
import type { HistoryFetchLike } from './history-client';
import { generateMockBars } from './mock-bars';
import { resolveHistoryBars } from './resolve-bars';
import { resolveRunContext } from '../run/run-context';

const DOC = {
  barsPath: '',
  exchange: 'binance',
  symbol: 'BTC/USDT',
  interval: '1h',
  historyBars: 40,
};

describe('resolveHistoryBars (shared chart/run source)', () => {
  test('mock on yields Sample bars and skips fetch', async () => {
    let fetched = false;
    const result = await resolveHistoryBars({
      doc: DOC,
      useMockBars: true,
      datafeedSource: 'venue',
      mockSeed: 'seed-a',
      fetchImpl: async () => {
        fetched = true;
        return { ok: true, status: 200, text: async () => '[]' };
      },
      fetchCcxt: async () => {
        fetched = true;
        return { ok: false, error: 'should not run' };
      },
    });
    expect(fetched).toBe(false);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBe('mock');
    expect(result.useMockBars).toBe(true);
    expect(result.bars).toHaveLength(40);
    expect(result.bars).toEqual(
      generateMockBars({ count: 40, interval: '1h', seed: 'seed-a' }),
    );
  });

  test('barsPath CSV wins over mock and venue', async () => {
    let fetched = false;
    const csv = 'time,open,high,low,close,volume\n1700000000,1,2,0.5,1.5,9\n';
    const result = await resolveHistoryBars({
      doc: { ...DOC, barsPath: 'fixtures/sample-bars.csv' },
      useMockBars: true,
      datafeedSource: 'venue',
      pathRoots: ['/ws'],
      readText: async (p) => {
        expect(p).toBe('/ws/fixtures/sample-bars.csv');
        return csv;
      },
      fetchCcxt: async () => {
        fetched = true;
        return { ok: false, error: 'no' };
      },
      fetchImpl: async () => {
        fetched = true;
        return { ok: true, status: 200, text: async () => '[]' };
      },
    });
    expect(fetched).toBe(false);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBe('csv');
    expect(result.useMockBars).toBe(false);
    expect(result.bars).toHaveLength(1);
    expect(result.bars[0]?.close).toBe(1.5);
  });

  test('venue with ccxt returns venue bars', async () => {
    const bar = {
      time: 1_700_000_000,
      open: 1,
      high: 2,
      low: 0.5,
      close: 1.5,
      volume: 9,
    };
    const result = await resolveHistoryBars({
      doc: DOC,
      useMockBars: false,
      datafeedSource: 'venue',
      fetchCcxt: async () => ({
        ok: true,
        bars: [bar],
        endpoint: 'ccxt:binance',
      }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBe('venue');
    expect(result.useMockBars).toBe(false);
    expect(result.bars).toEqual([bar]);
  });

  test('venue without ccxt falls back to Sample', async () => {
    const result = await resolveHistoryBars({
      doc: { ...DOC, historyBars: 25 },
      useMockBars: false,
      datafeedSource: 'venue',
      mockSeed: 'packaged',
      fetchCcxt: async () => ({ ok: false, error: CCXT_NOT_AVAILABLE }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBe('venue-sample-fallback');
    expect(result.useMockBars).toBe(true);
    expect(result.bars).toHaveLength(25);
    expect(result.bars).toEqual(
      generateMockBars({ count: 25, interval: '1h', seed: 'packaged' }),
    );
  });

  test('sidecar path when configured', async () => {
    const bar = {
      time: 1_700_000_100,
      open: 10,
      high: 11,
      low: 9,
      close: 10.5,
      volume: 3,
    };
    const fetchImpl: HistoryFetchLike = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify([bar]),
    });
    const result = await resolveHistoryBars({
      doc: DOC,
      useMockBars: false,
      datafeedSource: 'sidecar',
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBe('sidecar');
    expect(result.useMockBars).toBe(false);
    expect(result.bars).toEqual([bar]);
  });

  test('sidecar empty bars is an error (no silent empty POST/paint)', async () => {
    const result = await resolveHistoryBars({
      doc: DOC,
      useMockBars: false,
      datafeedSource: 'sidecar',
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        text: async () => '[]',
      }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/no bars/i);
  });

  test('venue non-ccxt errors do not silently mock', async () => {
    const result = await resolveHistoryBars({
      doc: DOC,
      useMockBars: false,
      datafeedSource: 'venue',
      fetchCcxt: async () => ({ ok: false, error: 'AXIS venue: network down' }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/network down/);
  });

  test('outer catch returns resolve-failed for Error and non-Error throws', async () => {
    const hostileDoc = {
      get barsPath(): string {
        throw new Error('hostile-barsPath');
      },
      exchange: 'binance',
      symbol: 'BTC/USDT',
      interval: '1h',
      historyBars: 10,
    };
    const err = await resolveHistoryBars({ doc: hostileDoc });
    expect(err.ok).toBe(false);
    if (err.ok) return;
    expect(err.error).toMatch(/resolve failed: hostile-barsPath/);

    const hostileNonError = {
      get barsPath(): string {
        throw 'hostile-string';
      },
      exchange: 'binance',
      symbol: 'BTC/USDT',
      interval: '1h',
      historyBars: 10,
    };
    const raw = await resolveHistoryBars({ doc: hostileNonError });
    expect(raw.ok).toBe(false);
    if (raw.ok) return;
    expect(raw.error).toMatch(/resolve failed: hostile-string/);
  });
});

describe('chart/run source parity via shared resolver', () => {
  test('resolveRunContext matches resolveHistoryBars for mock, csv, venue, sample-fallback, sidecar', async () => {
    const cases: Array<{
      label: string;
      doc: typeof DOC & { barsPath?: string };
      settings: Parameters<typeof resolveHistoryBars>[0];
      expectSource: string;
    }> = [
      {
        label: 'mock',
        doc: DOC,
        settings: {
          doc: DOC,
          useMockBars: true,
          mockSeed: buildSeriesKey(DOC),
        },
        expectSource: 'mock',
      },
      {
        label: 'venue',
        doc: DOC,
        settings: {
          doc: DOC,
          useMockBars: false,
          datafeedSource: 'venue',
          fetchCcxt: async () => ({
            ok: true,
            bars: [
              {
                time: 1,
                open: 1,
                high: 1,
                low: 1,
                close: 1,
                volume: 1,
              },
            ],
            endpoint: 'ccxt:binance',
          }),
        },
        expectSource: 'venue',
      },
      {
        label: 'venue-sample-fallback',
        doc: DOC,
        settings: {
          doc: DOC,
          useMockBars: false,
          datafeedSource: 'venue',
          mockSeed: buildSeriesKey(DOC),
          fetchCcxt: async () => ({ ok: false, error: CCXT_NOT_AVAILABLE }),
        },
        expectSource: 'venue-sample-fallback',
      },
      {
        label: 'sidecar',
        doc: DOC,
        settings: {
          doc: DOC,
          useMockBars: false,
          datafeedSource: 'sidecar',
          fetchImpl: async () => ({
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify([
                {
                  time: 2,
                  open: 2,
                  high: 2,
                  low: 2,
                  close: 2,
                  volume: 2,
                },
              ]),
          }),
        },
        expectSource: 'sidecar',
      },
    ];

    for (const c of cases) {
      const shared = await resolveHistoryBars({
        ...c.settings,
        mockSeed: c.settings.mockSeed ?? buildSeriesKey(c.doc),
      });
      const run = await resolveRunContext(
        JSON.stringify({
          schema: 'axis.chart.v1',
          ...c.doc,
        }),
        {
          useMockBars: c.settings.useMockBars,
          datafeedSource: c.settings.datafeedSource,
          fetchCcxt: c.settings.fetchCcxt,
          fetchImpl: c.settings.fetchImpl,
          historyBarsSetting: c.settings.historyBarsSetting,
        },
      );
      expect(shared.ok, c.label).toBe(true);
      expect(run.ok, c.label).toBe(true);
      if (!shared.ok || !run.ok) continue;
      expect(shared.source, c.label).toBe(c.expectSource);
      expect(run.ctx.barsSource, c.label).toBe(c.expectSource);
      expect(run.ctx.bars, c.label).toEqual(shared.bars);
      expect(run.ctx.useMockBars, c.label).toBe(shared.useMockBars);
    }

    const csv = 'time,open,high,low,close,volume\n1700000000,1,2,0.5,1.5,9\n';
    const csvDoc = { ...DOC, barsPath: 'x.csv' };
    const sharedCsv = await resolveHistoryBars({
      doc: csvDoc,
      useMockBars: true,
      pathRoots: ['/ws'],
      readText: async () => csv,
    });
    const runCsv = await resolveRunContext(
      JSON.stringify({ schema: 'axis.chart.v1', ...csvDoc }),
      {
        useMockBars: true,
        workspaceRoot: '/ws',
        readText: async () => csv,
      },
    );
    expect(sharedCsv.ok).toBe(true);
    expect(runCsv.ok).toBe(true);
    if (!sharedCsv.ok || !runCsv.ok) return;
    expect(sharedCsv.source).toBe('csv');
    expect(runCsv.ctx.barsSource).toBe('csv');
    expect(runCsv.ctx.bars).toEqual(sharedCsv.bars);
  });
});
