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
 * Minimal bars-in calculator used after Pyodide Wasm smoke.
 * Not pynescript — honest subset: plot(close|open|high|low|volume) and ta.sma.
 */

import { PYODIDE_PINE_WHEEL_NEXT } from '../host/pyodide-profile';

const OHLCV = ['open', 'high', 'low', 'close', 'volume'] as const;
type OhlcvName = (typeof OHLCV)[number];

export type MinimalBar = {
  time?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
};

export type MinimalCalcResult = {
  status: 'success' | 'error';
  plots: Record<string, (number | null)[]>;
  series: Record<string, (number | null)[]>;
  plot_meta: Record<string, { kind: 'plot'; title: string }>;
  times?: number[];
  window?: { bars: number; total_bars: number };
  overlay?: boolean;
  script_type?: string;
  script_name?: string;
  error?: string;
  error_kind?: string;
};

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function column(bars: MinimalBar[], key: OhlcvName): (number | null)[] {
  return bars.map((bar) => num(bar[key]));
}

function sma(src: (number | null)[], length: number): (number | null)[] {
  const n = Math.floor(length);
  if (!Number.isFinite(n) || n < 1) return src.map(() => null);
  const out: (number | null)[] = [];
  for (let i = 0; i < src.length; i++) {
    if (i < n - 1) {
      out.push(null);
      continue;
    }
    let sum = 0;
    let ok = true;
    for (let j = i - n + 1; j <= i; j++) {
      const v = src[j];
      if (v === null) {
        ok = false;
        break;
      }
      sum += v;
    }
    out.push(ok ? sum / n : null);
  }
  return out;
}

function stripNoise(script: string): string {
  return String(script ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\/\/@version\s*=\s*\d+/g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

function indicatorName(script: string): string | undefined {
  const m = /\b(?:indicator|strategy)\s*\(\s*["']([^"']+)["']/.exec(script);
  const name = m?.[1]?.trim();
  return name || undefined;
}

type PlotSpec =
  | { kind: 'ohlcv'; source: OhlcvName; title: string }
  | { kind: 'sma'; source: OhlcvName; length: number; title: string };

function parseTitle(rest: string, fallback: string): string {
  const named = /title\s*=\s*["']([^"']+)["']/.exec(rest);
  if (named?.[1]?.trim()) return named[1].trim();
  const positional = /^\s*,\s*["']([^"']+)["']/.exec(rest);
  if (positional?.[1]?.trim()) return positional[1].trim();
  return fallback;
}

function parsePlots(body: string): { specs: PlotSpec[]; unknownPlot: boolean } {
  const specs: PlotSpec[] = [];
  let unknownPlot = false;
  const re = /\bplot\s*\(/gi;
  let match: RegExpExecArray | null = re.exec(body);
  while (match) {
    const start = match.index + match[0].length;
    const slice = body.slice(start);
    const smaMatch = /^(?:ta\.)?sma\s*\(\s*(open|high|low|close|volume)\s*,\s*(\d+)\s*\)/.exec(
      slice,
    );
    if (smaMatch) {
      const source = smaMatch[1] as OhlcvName;
      const length = Number(smaMatch[2]);
      const rest = slice.slice(smaMatch[0].length);
      specs.push({
        kind: 'sma',
        source,
        length,
        title: parseTitle(rest, `sma${length}`),
      });
    } else {
      const srcMatch = /^(open|high|low|close|volume)/.exec(slice);
      if (srcMatch) {
        const source = srcMatch[1] as OhlcvName;
        const rest = slice.slice(srcMatch[0].length);
        specs.push({
          kind: 'ohlcv',
          source,
          title: parseTitle(rest, source),
        });
      } else {
        unknownPlot = true;
      }
    }
    match = re.exec(body);
  }
  return { specs, unknownPlot };
}

/** Evaluate the documented minimal subset. Never throws. */
export function evaluateMinimalSubset(script: string, bars: MinimalBar[]): MinimalCalcResult {
  const list = Array.isArray(bars) ? bars : [];
  const body = stripNoise(script);
  const { specs, unknownPlot } = parsePlots(body);
  if (specs.length === 0) {
    return {
      status: 'error',
      plots: {},
      series: {},
      plot_meta: {},
      error: `Pyodide calculator cannot evaluate this script. Supported: plot(close|open|high|low|volume) and plot(ta.sma(close, N)). ${PYODIDE_PINE_WHEEL_NEXT}`,
      error_kind: 'unsupported',
    };
  }
  const plots: Record<string, (number | null)[]> = {};
  const plot_meta: Record<string, { kind: 'plot'; title: string }> = {};
  const used = new Set<string>();
  for (const spec of specs) {
    let key = spec.title;
    let i = 2;
    while (used.has(key)) {
      key = `${spec.title}_${i}`;
      i += 1;
    }
    used.add(key);
    const src = column(list, spec.source);
    const values = spec.kind === 'sma' ? sma(src, spec.length) : src;
    plots[key] = values;
    plot_meta[key] = { kind: 'plot', title: key };
  }
  const times = list.map((b) => num(b.time)).filter((t): t is number => t !== null);
  const name = indicatorName(String(script ?? ''));
  const result: MinimalCalcResult = {
    status: 'success',
    plots,
    series: { ...plots },
    plot_meta,
    window: { bars: list.length, total_bars: list.length },
    overlay: true,
    script_type: 'indicator',
    script_name: name || 'pyodide-min',
  };
  if (times.length > 0) result.times = times;
  if (unknownPlot) {
    result.error_kind = 'partial';
  }
  return result;
}
