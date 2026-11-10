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

import type { AxisBarLaunch, AxisBarOhlcv } from './bar-adapter';

let last: AxisBarLaunch | undefined;

function toNullNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function seriesColumns(raw: Record<string, unknown> | undefined): Record<string, (number | null)[]> {
  const out: Record<string, (number | null)[]> = {};
  if (!raw) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!Array.isArray(value)) continue;
    out[key] = value.map((item) => toNullNumber(item));
  }
  return out;
}

/** Map a strategy trade onto a bar index (barIndex, else time match). */
export function resolveTradeBarIndex(
  trade: { barIndex?: number; time?: number },
  bars: Array<{ time?: number }>,
): number | undefined {
  if (typeof trade.barIndex === 'number' && Number.isFinite(trade.barIndex)) {
    return Math.trunc(trade.barIndex);
  }
  if (typeof trade.time === 'number' && Number.isFinite(trade.time)) {
    const i = bars.findIndex((b) => b.time === trade.time);
    if (i >= 0) return i;
  }
  return undefined;
}

export function launchFromRun(
  bars: AxisBarOhlcv[],
  series?: Record<string, unknown>,
  program?: string,
): AxisBarLaunch {
  const path = typeof program === 'string' ? program.trim() : '';
  return {
    bars: Array.isArray(bars) ? bars : [],
    series: seriesColumns(series),
    stopOnEntry: true,
    program: path || undefined,
  };
}

export function rememberBarDebugLaunch(next: AxisBarLaunch): void {
  last = next;
}

export function lastBarDebugLaunch(): AxisBarLaunch | undefined {
  return last;
}

export function resetBarDebugLaunchForTests(): void {
  last = undefined;
}
