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
 * Shared data pick (symbol / timeframe / mock vs datafeed vs workspace CSV)
 * applied to `*.axis.json`. CSV path is `barsPath` on the doc. Settings
 * (`useMockBars`, datafeed URL) stay in configuration.
 */

import type { AxisChartDocV1 } from '../editors/chart-document';

/** Timeframe quick-pick rows. `label` is the stored interval. */
export const DATA_TIMEFRAME_CHOICES = [
  { label: '1m', description: '1 minute' },
  { label: '5m', description: '5 minutes' },
  { label: '15m', description: '15 minutes' },
  { label: '1h', description: '1 hour' },
  { label: '4h', description: '4 hours' },
  { label: '1d', description: '1 day' },
] as const;

export const DATA_TIMEFRAMES = DATA_TIMEFRAME_CHOICES.map((item) => item.label);
export type DataTimeframe = (typeof DATA_TIMEFRAME_CHOICES)[number]['label'];

/** Quick-pick copy. Labels are the words a person sees — not setting names. */
export const DATA_PICK_COPY = {
  symbolTitle: 'Symbol',
  symbolPrompt: 'Symbol, such as BTC/USDT',
  timeframeTitle: 'Timeframe',
  timeframePlaceholder: 'Choose a timeframe',
  sourceTitle: 'Bars',
  sourcePlaceholder: 'CSV, sample candles, or a local feed',
  csvTitle: 'CSV',
  csvBrowseLabel: 'Browse for a CSV…',
  csvBrowseDescription: 'Pick a .csv file of candles',
} as const;

export type DataSourceId = 'csv' | 'mock' | 'feed';

export interface DataSourceChoice {
  id: DataSourceId;
  label: string;
  description: string;
  detail?: string;
}

/** Bars source rows: CSV, sample candles, local feed. No symbol browser. */
export function dataSourceChoices(opts?: {
  datafeedUrl?: string;
  barsPath?: string;
}): DataSourceChoice[] {
  const barsPath = opts?.barsPath?.trim() ?? '';
  const url = opts?.datafeedUrl?.trim() ?? '';
  const csv: DataSourceChoice = {
    id: 'csv',
    label: 'CSV',
    description: barsPath ? barsPath : 'OHLCV file (time, open, high, low, close)',
  };
  const feed: DataSourceChoice = {
    id: 'feed',
    label: 'Local feed',
    description: 'Candles from a data feed on this machine',
  };
  if (url) feed.detail = url;
  return [
    csv,
    { id: 'mock', label: 'Sample candles', description: 'Built-in sample bars' },
    feed,
  ];
}

/** One source phrase for the confirmation line. */
export function dataSourceLabel(id: DataSourceId, barsPath?: string): string {
  if (id === 'csv') {
    const path = barsPath?.trim();
    return path ? `CSV ${path}` : 'CSV';
  }
  if (id === 'mock') return 'sample candles';
  return 'local feed';
}

export function formatDataPickSummary(symbol: string, interval: string, source: string): string {
  return `${symbol} · ${interval} · ${source}`;
}

export interface DataPickFields {
  symbol?: string;
  exchange?: string;
  interval?: string;
  /** Set to a `.csv` path; empty string clears file bars. */
  barsPath?: string;
}

export function isDataTimeframe(value: string): value is DataTimeframe {
  return (DATA_TIMEFRAMES as readonly string[]).includes(value);
}

/** Merge picker fields onto a chart document. Empty strings are ignored. */
export function applyDataPickToDoc(
  doc: AxisChartDocV1,
  pick: DataPickFields,
): AxisChartDocV1 {
  const next: AxisChartDocV1 = { ...doc };
  if (typeof pick.symbol === 'string') {
    const symbol = pick.symbol.trim();
    if (symbol) next.symbol = symbol;
  }
  if (typeof pick.exchange === 'string') {
    const exchange = pick.exchange.trim().toLowerCase();
    if (exchange) next.exchange = exchange;
  }
  if (typeof pick.interval === 'string') {
    const interval = pick.interval.trim();
    if (interval) next.interval = interval;
  }
  if (typeof pick.barsPath === 'string') {
    next.barsPath = pick.barsPath.trim();
  }
  return next;
}
