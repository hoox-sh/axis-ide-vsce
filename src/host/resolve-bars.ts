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
 * Single bar-source resolver for chart history paint and run context.
 * Priority: barsPath CSV → mock/Sample → venue (ccxt) → sidecar.
 * Missing ccxt under venue falls back to Sample (packaged VSIX).
 * Never throws.
 */

import type { AxisChartDocV1 } from '../editors/chart-document';
import {
  fetchCcxtHistorical,
  isCcxtUnavailable,
  type CcxtHistoricalRequest,
  type CcxtHistoricalResult,
  type CcxtLoader,
  type CcxtModule,
} from './ccxt-client';
import { resolveMockBarCount } from './chart-session';
import { loadOhlcvCsvFile, resolveBarsFilePath } from './csv-bars';
import {
  fetchHistorical,
  type HistoryFetchLike,
} from './history-client';
import { generateMockBars, type OhlcvBar } from './mock-bars';

export type BarsSource =
  | 'csv'
  | 'mock'
  | 'venue'
  | 'sidecar'
  /** Venue selected but ccxt missing — Sample candles (matches chart + run). */
  | 'venue-sample-fallback';

export type FetchCcxtHistoricalFn = (
  req: CcxtHistoricalRequest,
  ccxtModule?: CcxtModule,
  loadCcxt?: CcxtLoader,
) => Promise<CcxtHistoricalResult>;

export interface ResolveHistoryBarsRequest {
  doc: Pick<
    AxisChartDocV1,
    'barsPath' | 'exchange' | 'symbol' | 'interval' | 'historyBars'
  >;
  /** `axis.chart.useMockBars` — product default true. */
  useMockBars?: boolean;
  /** `axis.datafeed.source` when mock is off. Default sidecar. */
  datafeedSource?: 'sidecar' | 'venue';
  historyBarsSetting?: number;
  datafeedUrl?: string;
  allowRemote?: boolean;
  /** Directories used to resolve relative `barsPath` (chart dir, workspace roots). */
  pathRoots?: string[];
  /** PRNG seed for Sample/mock (use `seriesKey` so chart handshake and run match). */
  mockSeed?: string;
  readText?: (path: string) => Promise<string> | string;
  fetchImpl?: HistoryFetchLike;
  fetchCcxt?: FetchCcxtHistoricalFn;
  loadCcxt?: CcxtLoader;
  signal?: AbortSignal;
}

export type ResolveHistoryBarsResult =
  | {
      ok: true;
      source: BarsSource;
      bars: OhlcvBar[];
      /** True when bars came from Sample/mock (including venue-sample-fallback). */
      useMockBars: boolean;
    }
  | { ok: false; error: string; reason?: 'aborted' };

function sampleBars(
  doc: ResolveHistoryBarsRequest['doc'],
  historyBarsSetting?: number,
  mockSeed?: string,
): OhlcvBar[] {
  const count = resolveMockBarCount(doc.historyBars, historyBarsSetting);
  return generateMockBars({
    count,
    interval: doc.interval || '1m',
    ...(mockSeed ? { seed: mockSeed } : {}),
  });
}

/**
 * Resolve OHLCV bars with the shared chart/run priority rules.
 * Callers map `source` to seq / HostError / POST envelope themselves.
 */
export async function resolveHistoryBars(
  req: ResolveHistoryBarsRequest,
): Promise<ResolveHistoryBarsResult> {
  try {
    const doc = req.doc;
    const barsPath = typeof doc.barsPath === 'string' ? doc.barsPath.trim() : '';
    if (barsPath) {
      const roots = (req.pathRoots ?? []).filter(
        (r): r is string => typeof r === 'string' && Boolean(r.trim()),
      );
      const resolved = resolveBarsFilePath(barsPath, roots);
      if (!resolved.ok) return { ok: false, error: resolved.error };
      const read =
        req.readText ??
        (async (p: string) => {
          const fs = await import('node:fs/promises');
          return fs.readFile(p, 'utf8');
        });
      const csv = await loadOhlcvCsvFile(resolved.fsPath, read);
      if (!csv.ok) return { ok: false, error: csv.error };
      return { ok: true, source: 'csv', bars: csv.bars, useMockBars: false };
    }

    const useMockBars = req.useMockBars !== false;
    if (useMockBars) {
      return {
        ok: true,
        source: 'mock',
        bars: sampleBars(doc, req.historyBarsSetting, req.mockSeed),
        useMockBars: true,
      };
    }

    const limit = resolveMockBarCount(doc.historyBars, req.historyBarsSetting);
    const datafeedSource = req.datafeedSource === 'venue' ? 'venue' : 'sidecar';

    if (datafeedSource === 'venue') {
      const fetchCcxt = req.fetchCcxt ?? fetchCcxtHistorical;
      const venue = await fetchCcxt(
        {
          exchange: doc.exchange || 'binance',
          symbol: doc.symbol,
          timeframe: doc.interval || '1m',
          limit,
          signal: req.signal,
        },
        undefined,
        req.loadCcxt,
      );
      if (!venue.ok) {
        if (isCcxtUnavailable(venue.error)) {
          return {
            ok: true,
            source: 'venue-sample-fallback',
            bars: sampleBars(doc, req.historyBarsSetting, req.mockSeed),
            useMockBars: true,
          };
        }
        return { ok: false, error: venue.error, reason: venue.reason };
      }
      if (!venue.bars.length) {
        return {
          ok: false,
          error:
            'AXIS history: venue returned no bars. Check exchange/symbol/interval or enable axis.chart.useMockBars.',
        };
      }
      return { ok: true, source: 'venue', bars: venue.bars, useMockBars: false };
    }

    const history = await fetchHistorical({
      exchange: doc.exchange || 'binance',
      symbol: doc.symbol,
      timeframe: doc.interval || '1m',
      limit,
      baseUrl: req.datafeedUrl,
      allowRemote: req.allowRemote,
      fetchImpl: req.fetchImpl,
      signal: req.signal,
    });
    if (!history.ok) {
      return { ok: false, error: history.error, reason: history.reason };
    }
    if (!history.bars.length) {
      return {
        ok: false,
        error:
          'AXIS history: datafeed returned no bars. Check exchange/symbol/interval or enable axis.chart.useMockBars.',
      };
    }
    return {
      ok: true,
      source: 'sidecar',
      bars: history.bars,
      useMockBars: false,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `AXIS history: resolve failed: ${message}` };
  }
}
