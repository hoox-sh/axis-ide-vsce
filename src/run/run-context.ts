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
 * Resolve bars + seriesKey for a run from an optional sibling chart doc (PR-06b).
 * When `useMockBars` is true (default), generate fixture bars.
 * When false, fetch venue history via HistoryClient — failures return `{ ok:false }`
 * so the run path does not POST empty data.
 */

import {
  defaultChartDocument,
  parseChartDocument,
  scriptInputsFromDoc,
  type AxisChartDocV1,
} from '../editors/chart-document';
import {
  CHART_HANDSHAKE_SEQ,
  CHART_HISTORY_SEQ,
  buildChartSession,
  resolveMockBarCount,
} from '../host/chart-session';
import {
  fetchHistorical,
  type HistoryFetchLike,
} from '../host/history-client';
import {
  loadOhlcvCsvFile,
  resolveBarsFilePath,
} from '../host/csv-bars';
import type { OhlcvBar } from '../host/mock-bars';
import { DEFAULT_ENGINE_ENDPOINT, mapToWorkerTimeframe } from './engine-http';
import type { RunMode } from './orchestrator';

/** Last `chart.viewport` from the webview (logical from/to). */
let lastViewport: { from: number; to: number } | undefined;

/** Record visible range reported by the chart webview. Never throws. */
export function recordChartViewport(from: number, to: number): void {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return;
  lastViewport = { from, to };
}

/** Copy of last reported viewport, if any. */
export function lastChartViewport(): { from: number; to: number } | undefined {
  return lastViewport ? { from: lastViewport.from, to: lastViewport.to } : undefined;
}

/** Test-only: drop cached viewport. */
export function resetChartViewportForTests(): void {
  lastViewport = undefined;
}

/**
 * Inclusive `from_bar`/`to_bar` for POST /run.
 * Visible range when reported; otherwise the full bar window. Omitted when
 * there are no bars.
 */
export function barWindowFromVisibleRange(
  barCount: number,
  range?: { from: number; to: number },
): { fromBar: number; toBar: number } | undefined {
  const n = Math.floor(barCount);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (
    !range ||
    !Number.isFinite(range.from) ||
    !Number.isFinite(range.to)
  ) {
    return { fromBar: 0, toBar: n - 1 };
  }
  let from = Math.floor(range.from);
  let to = Math.floor(range.to);
  if (from > to) {
    const tmp = from;
    from = to;
    to = tmp;
  }
  from = Math.min(Math.max(from, 0), n - 1);
  to = Math.min(Math.max(to, 0), n - 1);
  return { fromBar: from, toBar: to };
}

export interface RunContextSettings {
  historyBarsSetting?: number;
  engineId?: string;
  /** Active plugin engine id when `engineId` is omitted/empty. Default `'server'`. */
  activeEngineId?: string;
  endpoint?: string;
  /** `axis.chart.useMockBars` — product default false; omitted here keeps mock for callers without settings. */
  useMockBars?: boolean;
  /** `axis.datafeed.url`. */
  datafeedUrl?: string;
  /** `axis.engine.allowRemoteEndpoint` — also gates datafeed. */
  allowRemote?: boolean;
  fetchImpl?: HistoryFetchLike;
  signal?: AbortSignal;
  /** Directory of the sibling `*.axis.json` (relative `barsPath`). */
  chartDir?: string;
  /** First workspace folder (relative `barsPath`). */
  workspaceRoot?: string;
  /** Injected file reader for CSV bars (tests). */
  readText?: (path: string) => Promise<string> | string;
}

export interface ResolvedRunContext {
  doc: AxisChartDocV1;
  bars: OhlcvBar[];
  seriesKey: string;
  engineId: string;
  endpoint: string;
  mode: RunMode;
  /**
   * Last chart.full seq for this path (handshake=1 mock; history paint=2).
   * Run must paint seq > this.
   */
  seq: number;
  useMockBars: boolean;
  /** Persisted `scripts[].inputs` overrides, when present. */
  inputs?: Record<string, unknown>;
  /** Worker-style timeframe from `doc.interval`. Omitted when unknown. */
  timeframe?: string;
  /** Inclusive envelope start (visible range or full window). */
  fromBar?: number;
  /** Inclusive envelope end (visible range or full window). */
  toBar?: number;
}

export type ResolveRunContextResult =
  | { ok: true; ctx: ResolvedRunContext }
  | { ok: false; error: string; reason?: 'aborted' };

function withDocInputs(ctx: ResolvedRunContext): ResolvedRunContext {
  const inputs = scriptInputsFromDoc(ctx.doc);
  if (!inputs) return ctx;
  return { ...ctx, inputs };
}

/** Timeframe + envelope fields for a run. Omits keys when unset. */
export function runWindowFields(
  interval: string,
  barCount: number,
  range?: { from: number; to: number },
): { timeframe?: string; fromBar?: number; toBar?: number } {
  const timeframe = mapToWorkerTimeframe(interval);
  const win = barWindowFromVisibleRange(barCount, range);
  return {
    ...(timeframe ? { timeframe } : {}),
    ...(win ? { fromBar: win.fromBar, toBar: win.toBar } : {}),
  };
}

function finishRunContext(ctx: ResolvedRunContext): ResolvedRunContext {
  return { ...withDocInputs(ctx), ...runWindowFields(ctx.doc.interval, ctx.bars.length, lastViewport) };
}

function fallbackMockContext(): ResolvedRunContext {
  const doc = defaultChartDocument();
  const session = buildChartSession({ doc, useMockBars: true });
  return finishRunContext({
    doc,
    bars: session.bars,
    seriesKey: session.seriesKey,
    engineId: 'server',
    endpoint: DEFAULT_ENGINE_ENDPOINT,
    mode: 'auto',
    seq: session.full.seq,
    useMockBars: true,
  });
}

/**
 * Build run context from chart JSON text (sibling) or defaults.
 * Never throws. When mock is off and history fails, returns `{ ok: false }`.
 */
export async function resolveRunContext(
  chartJsonText: string | null | undefined,
  settings?: RunContextSettings,
): Promise<ResolveRunContextResult> {
  try {
    let doc: AxisChartDocV1 = defaultChartDocument();
    if (typeof chartJsonText === 'string' && chartJsonText.trim()) {
      const parsed = parseChartDocument(chartJsonText);
      if (parsed.ok) doc = parsed.doc;
    }

    const engineId =
      (settings?.engineId && settings.engineId.trim()) ||
      (settings?.activeEngineId && settings.activeEngineId.trim()) ||
      (doc.engine && doc.engine.trim()) ||
      'server';
    const endpoint =
      (settings?.endpoint && settings.endpoint.trim()) || DEFAULT_ENGINE_ENDPOINT;

    const barsPath = typeof doc.barsPath === 'string' ? doc.barsPath.trim() : '';
    if (barsPath) {
      const roots = [settings?.chartDir, settings?.workspaceRoot].filter(
        (r): r is string => typeof r === 'string' && Boolean(r.trim()),
      );
      const resolved = resolveBarsFilePath(barsPath, roots);
      if (!resolved.ok) return { ok: false, error: resolved.error };
      const read =
        settings?.readText ??
        (async (p: string) => {
          const fs = await import('node:fs/promises');
          return fs.readFile(p, 'utf8');
        });
      const csv = await loadOhlcvCsvFile(resolved.fsPath, read);
      if (!csv.ok) return { ok: false, error: csv.error };
      const session = buildChartSession({
        doc,
        useMockBars: false,
        historyBarsSetting: settings?.historyBarsSetting,
      });
      return {
        ok: true,
        ctx: finishRunContext({
          doc,
          bars: csv.bars,
          seriesKey: session.seriesKey,
          engineId,
          endpoint,
          mode: 'auto',
          seq: CHART_HISTORY_SEQ,
          useMockBars: false,
        }),
      };
    }

    const useMockBars = settings?.useMockBars !== false;
    if (useMockBars) {
      const session = buildChartSession({
        doc,
        useMockBars: true,
        historyBarsSetting: settings?.historyBarsSetting,
      });
      return {
        ok: true,
        ctx: finishRunContext({
          doc,
          bars: session.bars,
          seriesKey: session.seriesKey,
          engineId,
          endpoint,
          mode: 'auto',
          seq: session.full.seq || CHART_HANDSHAKE_SEQ,
          useMockBars: true,
        }),
      };
    }

    // Real history — do not fall back to mock when the user asked for venue bars.
    const session = buildChartSession({
      doc,
      useMockBars: false,
      historyBarsSetting: settings?.historyBarsSetting,
    });
    const limit = resolveMockBarCount(doc.historyBars, settings?.historyBarsSetting);
    const history = await fetchHistorical({
      exchange: doc.exchange || 'binance',
      symbol: doc.symbol,
      timeframe: doc.interval || '1m',
      limit,
      baseUrl: settings?.datafeedUrl,
      allowRemote: settings?.allowRemote,
      fetchImpl: settings?.fetchImpl,
      signal: settings?.signal,
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
      ctx: finishRunContext({
        doc,
        bars: history.bars,
        seriesKey: session.seriesKey,
        engineId,
        endpoint,
        mode: 'auto',
        seq: CHART_HISTORY_SEQ,
        useMockBars: false,
      }),
    };
  } catch (e) {
    // Hostile settings / unexpected — only mock fallback when mock was requested.
    if (settings?.useMockBars === false) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, error: `AXIS run context failed: ${message}` };
    }
    return { ok: true, ctx: fallbackMockContext() };
  }
}
