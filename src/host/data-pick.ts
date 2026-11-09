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

export const DATA_TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
export type DataTimeframe = (typeof DATA_TIMEFRAMES)[number];

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
