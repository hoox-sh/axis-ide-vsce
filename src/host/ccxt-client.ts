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
 * Venue OHLCV fetch via ccxt (default binance), an alternative to the
 * axis-datafeed sidecar (`src/host/history-client.ts`).
 *
 * ccxt is loaded lazily (`await import('ccxt)`) so the host stays
 * installable without ccxt in node_modules. A missing module is runtime
 * graceful degradation (`{ ok: false, error: 'ccxt not available' }`), not a
 * build error — the 'ccxt' module is ambient-declared below and marked
 * external in `esbuild.host.mjs`.
 *
 * Contract mirrors `FetchHistoricalResult`: never throws, returns `{ ok, … }`.
 * IDE bar time is unix **seconds**; ccxt `since`/timestamps are unix **ms**,
 * so we convert both directions.
 */

import { combineAbortSignals } from '../run/engine-http';
import { MOCK_BARS_CAP, type OhlcvBar } from './mock-bars';
import { pairFormSymbol } from './series-key';

export const CCXT_NOT_AVAILABLE =
  'ccxt is not installed — run `bun add ccxt` to enable venue OHLCV fetching.';

export const DEFAULT_CCXT_EXCHANGE = 'binance';

export interface CcxtHistoricalRequest {
  /** Defaults to `binance`. ccxt exchange id (lowercase, e.g. `binance`, `kraken`). */
  exchange?: string;
  /** Symbol. Pair form (`BTC/USDT`) preferred; load-form (`BTCUSDT`) is pair-formed. */
  symbol: string;
  /** ccxt timeframe (`1m`, `5m`, `1h`, `1d`, …). Passed through verbatim. */
  timeframe: string;
  /** Unix **seconds** (IDE convention). Converted to ms for ccxt `since`. */
  since?: number;
  /** Max bars. Clamped to {@link MOCK_BARS_CAP}. */
  limit?: number;
  /** Optional external abort signal. */
  signal?: AbortSignal;
  /** Absolute deadline (ms) for the ccxt round-trip. */
  timeoutMs?: number;
}

export type CcxtHistoricalResult =
  | { ok: true; bars: OhlcvBar[]; endpoint: string }
  | { ok: false; error: string; reason?: 'aborted' };

type CcxtExchange = {
  fetchOHLCV: (
    symbol: string,
    timeframe: string,
    since?: number,
    limit?: number,
  ) => Promise<unknown[]>;
  close?: () => Promise<unknown>;
};
type CcxtExchangeCtor = new (options: { enableRateLimit?: boolean }) => CcxtExchange;
export type CcxtModule = { [name: string]: unknown };
export type CcxtLoader = () => Promise<CcxtModule>;

function clampLimit(limit: number | undefined): number | undefined {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return undefined;
  const n = Math.floor(limit);
  if (n <= 0) return undefined;
  return Math.min(n, MOCK_BARS_CAP);
}

/** Resolve the ccxt exchange id; defaults to binance, never throws. */
function resolveExchange(req: CcxtHistoricalRequest): string {
  const ex = String(req.exchange ?? DEFAULT_CCXT_EXCHANGE).trim().toLowerCase();
  return ex || DEFAULT_CCXT_EXCHANGE;
}

/** Pair-form the symbol (`BTCUSDT` → `BTC/USDT`); unknowns pass through uppercased. */
function resolveSymbol(symbol: string): string {
  const formed = pairFormSymbol(symbol ?? '');
  return formed || String(symbol ?? '').trim().toUpperCase();
}

/** ccxt timeframe passthrough (ccxt understands standard timeframes). */
function resolveTimeframe(timeframe: string): string {
  return String(timeframe ?? '').trim().toLowerCase() || '1m';
}

/** Clamp one ccxt row to IDE bar invariants: high>=max(open,close), low<=min(open,close), volume>=0. */
function mapCcxtRow(row: unknown[], fallbackTime: number): OhlcvBar | null {
  if (!Array.isArray(row) || row.length < 6) return null;
  const [ms, open, high, low, close, volume] = row;
  const o = Number(open);
  const h = Number(high);
  const l = Number(low);
  const c = Number(close);
  const v = Number(volume);
  const t = typeof ms === 'number' && Number.isFinite(ms) ? Math.floor(ms / 1000) : fallbackTime;
  if (![o, h, l, c, v].every(Number.isFinite) || t <= 0) return null;
  return {
    time: t,
    open: o,
    high: Math.max(h, o, c),
    low: Math.min(l, o, c),
    close: c,
    volume: Math.max(0, v),
  };
}

/** Reject when the (combined) abort signal fires; never resolves otherwise. */
function abortSignalPromise(signal: AbortSignal | undefined): Promise<void> {
  if (!signal) return new Promise(() => {});
  if (signal.aborted) {
    return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
  }
  return new Promise<void>((_resolve, reject) => {
    const onAbort = (): void => reject(new DOMException('The operation was aborted.', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Fetch historical OHLCV from a venue via ccxt.
 * Never throws — returns `{ ok, … }`.
 *
 * @param ccxtModule injected ccxt module for tests; when omitted the real
 *   module is lazy-loaded (`import('ccxt)`), which fails gracefully when ccxt
 *   is not installed.
 * @param loadCcxt injected loader for the missing-module test; defaults to the
 *   real dynamic import.
 */
export async function fetchCcxtHistorical(
  req: CcxtHistoricalRequest,
  ccxtModule?: CcxtModule,
  loadCcxt?: CcxtLoader,
): Promise<CcxtHistoricalResult> {
  try {
    const exchangeId = resolveExchange(req);
    const symbol = resolveSymbol(req.symbol);
    const timeframe = resolveTimeframe(req.timeframe);
    const limit = clampLimit(req.limit);
    if (!symbol) {
      return { ok: false, error: 'AXIS venue: symbol is required for ccxt OHLCV.' };
    }

    let ccxt = ccxtModule;
    if (!ccxt) {
      try {
        ccxt = loadCcxt ? await loadCcxt() : await import('ccxt');
      } catch {
        return { ok: false, error: CCXT_NOT_AVAILABLE };
      }
    }

    const ctor = ccxt[exchangeId] as unknown;
    if (typeof ctor !== 'function') {
      return { ok: false, error: `AXIS venue: unsupported ccxt exchange '${exchangeId}'.` };
    }

    let exchange: CcxtExchange;
    try {
      exchange = new (ctor as CcxtExchangeCtor)({ enableRateLimit: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        error: `AXIS venue: ccxt exchange '${exchangeId}' construction failed: ${message}`,
      };
    }
    const sinceMs =
      typeof req.since === 'number' && Number.isFinite(req.since) && req.since > 0
        ? Math.floor(req.since) * 1000
        : undefined;

    // ccxt's fetchOHLCV does not accept abort signals, so abort is best-effort
    // at the Promise.race level: the underlying HTTP request may continue in
    // the background after the signal fires.
    const signal = combineAbortSignals(
      req.signal,
      AbortSignal.timeout(req.timeoutMs ?? 30_000),
    );
    const runFetch = (): Promise<unknown[]> => {
      try {
        return exchange.fetchOHLCV(symbol, timeframe, sinceMs, limit);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return Promise.reject(new Error(`ccxt fetchOHLCV failed: ${message}`));
      }
    };

    let ohlcv: unknown[];
    try {
      ohlcv = (await Promise.race([runFetch(), abortSignalPromise(signal)])) as unknown[];
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return { ok: false, error: 'AXIS venue: ccxt fetch aborted.', reason: 'aborted' };
      }
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, error: `AXIS venue: ${message}` };
    } finally {
      try {
        await exchange.close?.();
      } catch {
        // close must not fail a successful fetch
      }
    }

    const bars: OhlcvBar[] = [];
    const fallbackTime = Math.floor(Date.now() / 1000);
    for (const row of ohlcv) {
      const bar = mapCcxtRow(row as unknown[], fallbackTime);
      if (bar) bars.push(bar);
      if (bars.length >= MOCK_BARS_CAP) break;
    }

    return { ok: true, bars, endpoint: `ccxt:${exchangeId}` };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `AXIS venue: unexpected failure: ${message}` };
  }
}
