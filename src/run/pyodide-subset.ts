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
 * Minimal bars-in calculator used when the Pyodide wheel is not ready.
 * Not pynescript — honest subset: plot of OHLCV or ta.sma, input.* declarations,
 * simple assignments, and a single strategy.entry.
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

export type PineInputDecl = {
  title: string;
  type: string;
  value: unknown;
  defval: unknown;
};

export type MinimalCalcResult = {
  status: 'success' | 'error';
  plots: Record<string, (number | null)[]>;
  series: Record<string, (number | null)[]>;
  plot_meta: Record<string, { kind: 'plot'; title: string; color?: string }>;
  times?: number[];
  window?: { bars: number; total_bars: number };
  overlay?: boolean;
  script_type?: string;
  script_name?: string;
  inputs?: PineInputDecl[];
  events?: Array<Record<string, unknown>>;
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

type SeriesExpr =
  | { kind: 'ohlcv'; source: OhlcvName }
  | { kind: 'sma'; sourceToken: string; lengthToken: string };

type PlotSpec = { expr: SeriesExpr; title: string; color?: string };

type Scalar = number | boolean | string;

type InputBinding = PineInputDecl & {
  binding?: string;
  sourceToken?: string;
};

type StrategyEntry = { id: string; direction: 'long' | 'short'; barIndex: number };

type ParsedScript = {
  series: Map<string, SeriesExpr>;
  scalars: Map<string, Scalar>;
  inputs: InputBinding[];
  plots: PlotSpec[];
  unknownPlot: boolean;
  entries: StrategyEntry[];
  strategy: boolean;
};

const PINE_COLORS: Record<string, string> = {
  aqua: '#6ee7f5',
  blue: '#8b9cff',
  green: '#3ddc97',
  red: '#f07178',
  orange: '#e8b84a',
  yellow: '#e8b84a',
  purple: '#c4b5fd',
  white: '#e8eaee',
  black: '#111111',
  gray: '#9aa3b2',
  grey: '#9aa3b2',
};

function isOhlcv(token: string): token is OhlcvName {
  return (OHLCV as readonly string[]).includes(token);
}

function unquote(raw: string): string {
  const text = raw.trim();
  const m = /^(['"])([\s\S]*)\1$/.exec(text);
  return m ? m[2] : text;
}

function isQuoted(raw: string): boolean {
  return /^(['"])[\s\S]*\1$/.test(raw.trim());
}

function matchingParen(src: string, openIndex: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = openIndex; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === quote && src[i - 1] !== '\\') quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === '(') depth += 1;
    else if (c === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitArgs(inner: string): string[] {
  const args: string[] = [];
  let cur = '';
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (quote) {
      cur += c;
      if (c === quote && inner[i - 1] !== '\\') quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      cur += c;
      continue;
    }
    if (c === '(') {
      depth += 1;
      cur += c;
      continue;
    }
    if (c === ')') {
      depth = Math.max(0, depth - 1);
      cur += c;
      continue;
    }
    if (c === ',' && depth === 0) {
      args.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim()) args.push(cur.trim());
  return args;
}

function parseLiteral(kind: string, raw: string): Scalar {
  const text = raw.trim();
  if (kind === 'bool' || kind === 'boolean') return text === 'true';
  if (kind === 'int') {
    const n = Number(text);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }
  if (kind === 'float') {
    const n = Number(text);
    return Number.isFinite(n) ? n : 0;
  }
  if (kind === 'source') return unquote(text);
  return unquote(text);
}

function parseInputCall(text: string): { input: InputBinding; end: number } | null {
  const head = /^input\.(int|float|bool|boolean|string|source)\s*\(/.exec(text);
  if (!head) return null;
  const open = head[0].length - 1;
  const close = matchingParen(text, open);
  if (close < 0) return null;
  const kind = head[1] === 'boolean' ? 'bool' : head[1];
  const args = splitArgs(text.slice(open + 1, close));
  let title: string | undefined;
  let defval: Scalar | undefined;
  let sourceToken: string | undefined;
  for (const arg of args) {
    const named = /^([A-Za-z_]\w*)\s*=\s*(.+)$/.exec(arg);
    if (named) {
      const key = named[1];
      const val = named[2].trim();
      if (key === 'title') title = unquote(val);
      else if (key === 'defval' || key === 'value') defval = parseLiteral(kind, val);
      continue;
    }
    if (kind === 'source' && !sourceToken && /^[A-Za-z_]\w*$/.test(arg)) {
      sourceToken = arg;
      continue;
    }
    if (!title && isQuoted(arg)) {
      title = unquote(arg);
      continue;
    }
    if (defval === undefined && kind !== 'source') defval = parseLiteral(kind, arg);
  }
  if (kind === 'source' && !sourceToken) sourceToken = 'close';
  if (defval === undefined) {
    if (kind === 'int' || kind === 'float') defval = 0;
    else if (kind === 'bool') defval = false;
    else if (kind === 'source') defval = sourceToken ?? 'close';
    else defval = '';
  }
  const input: InputBinding = {
    title: title?.trim() || 'input',
    type: kind,
    value: kind === 'source' ? (sourceToken ?? 'close') : defval,
    defval: kind === 'source' ? (sourceToken ?? 'close') : defval,
    sourceToken,
  };
  return { input, end: close + 1 };
}

function parseSmaCall(text: string): { sourceToken: string; lengthToken: string; end: number } | null {
  const head = /^(?:ta\.)?sma\s*\(/.exec(text);
  if (!head) return null;
  const open = head[0].length - 1;
  const close = matchingParen(text, open);
  if (close < 0) return null;
  const args = splitArgs(text.slice(open + 1, close));
  if (args.length < 2) return null;
  return { sourceToken: args[0], lengthToken: args[1], end: close + 1 };
}

function parseTitle(rest: string, fallback: string): string {
  const named = /title\s*=\s*["']([^"']+)["']/.exec(rest);
  if (named?.[1]?.trim()) return named[1].trim();
  const positional = /^\s*,\s*["']([^"']+)["']/.exec(rest);
  if (positional?.[1]?.trim()) return positional[1].trim();
  return fallback;
}

function parseColor(rest: string): string | undefined {
  const hex = /color\s*=\s*(#[0-9a-fA-F]{3,8})\b/.exec(rest);
  if (hex?.[1]) return hex[1];
  const named = /color\s*=\s*color\.([A-Za-z_]\w*)/.exec(rest);
  if (!named?.[1]) return undefined;
  return PINE_COLORS[named[1].toLowerCase()];
}

function resolveLength(token: string, scalars: Map<string, Scalar>): number | null {
  const text = token.trim();
  if (/^-?\d+$/.test(text)) return Number(text);
  const scalar = scalars.get(text);
  if (typeof scalar === 'number' && Number.isFinite(scalar)) return Math.trunc(scalar);
  return null;
}

function resolveSeriesToken(token: string, series: Map<string, SeriesExpr>): SeriesExpr | null {
  const text = token.trim();
  if (isOhlcv(text)) return { kind: 'ohlcv', source: text };
  return series.get(text) ?? null;
}

function bindAssignment(name: string, rhs: string, parsed: ParsedScript): void {
  const input = parseInputCall(rhs.trim());
  if (input && input.end === rhs.trim().length) {
    input.input.binding = name;
    parsed.inputs.push(input.input);
    if (input.input.type === 'source') {
      const src = input.input.sourceToken ?? 'close';
      if (isOhlcv(src)) parsed.series.set(name, { kind: 'ohlcv', source: src });
    } else if (typeof input.input.value === 'number' || typeof input.input.value === 'boolean' || typeof input.input.value === 'string') {
      parsed.scalars.set(name, input.input.value);
    }
    return;
  }
  const sma = parseSmaCall(rhs.trim());
  if (sma && sma.end === rhs.trim().length) {
    parsed.series.set(name, {
      kind: 'sma',
      sourceToken: sma.sourceToken,
      lengthToken: sma.lengthToken,
    });
    return;
  }
  const ident = rhs.trim();
  if (isOhlcv(ident)) {
    parsed.series.set(name, { kind: 'ohlcv', source: ident });
    return;
  }
  const existing = parsed.series.get(ident);
  if (existing) parsed.series.set(name, existing);
}

function parsePlotArg(slice: string, series: Map<string, SeriesExpr>): { expr: SeriesExpr; end: number } | null {
  const sma = parseSmaCall(slice);
  if (sma) {
    return {
      expr: { kind: 'sma', sourceToken: sma.sourceToken, lengthToken: sma.lengthToken },
      end: sma.end,
    };
  }
  const src = /^(open|high|low|close|volume)(?![A-Za-z0-9_])/.exec(slice);
  if (src && isOhlcv(src[1])) {
    return { expr: { kind: 'ohlcv', source: src[1] }, end: src[1].length };
  }
  const ident = /^([A-Za-z_]\w*)(?![A-Za-z0-9_])/.exec(slice);
  if (ident?.[1] && series.has(ident[1])) {
    const expr = series.get(ident[1]);
    if (expr) return { expr, end: ident[1].length };
  }
  return null;
}

function fallbackTitle(expr: SeriesExpr, scalars: Map<string, Scalar>): string {
  if (expr.kind === 'ohlcv') return expr.source;
  const len = resolveLength(expr.lengthToken, scalars);
  return `sma${len ?? expr.lengthToken}`;
}

function parseScript(body: string): ParsedScript {
  const parsed: ParsedScript = {
    series: new Map(),
    scalars: new Map(),
    inputs: [],
    plots: [],
    unknownPlot: false,
    entries: [],
    strategy: /\bstrategy\s*\(/.test(body),
  };
  const lines = body.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
  let pendingBar: number | null = null;
  for (const line of lines) {
    const ifBar = /^if\s+bar_index\s*==\s*(\d+)\s*$/.exec(line);
    if (ifBar) {
      pendingBar = Number(ifBar[1]);
      continue;
    }
    const entry = /^strategy\.entry\s*\(\s*["']([^"']+)["']\s*,\s*strategy\.(long|short)/.exec(line);
    if (entry?.[1] && (entry[2] === 'long' || entry[2] === 'short')) {
      parsed.entries.push({
        id: entry[1],
        direction: entry[2],
        barIndex: pendingBar ?? 0,
      });
      pendingBar = null;
      continue;
    }
    const assign = /^([A-Za-z_]\w*)\s*=\s*(.+)$/.exec(line);
    if (assign?.[1] && assign[2] && !/^(if|for|while|switch)$/.test(assign[1])) {
      bindAssignment(assign[1], assign[2], parsed);
      pendingBar = null;
      continue;
    }
    const bare = parseInputCall(line);
    if (bare && bare.end === line.length) {
      parsed.inputs.push(bare.input);
      pendingBar = null;
      continue;
    }
    pendingBar = null;
  }

  const re = /\bplot\s*\(/gi;
  let match: RegExpExecArray | null = re.exec(body);
  while (match) {
    const start = match.index + match[0].length;
    const slice = body.slice(start);
    const arg = parsePlotArg(slice, parsed.series);
    if (!arg) {
      parsed.unknownPlot = true;
    } else {
      const rest = slice.slice(arg.end);
      parsed.plots.push({
        expr: arg.expr,
        title: parseTitle(rest, fallbackTitle(arg.expr, parsed.scalars)),
        color: parseColor(rest),
      });
    }
    match = re.exec(body);
  }
  return parsed;
}

function coerceOverride(decl: InputBinding, value: unknown): Scalar | undefined {
  if (decl.type === 'bool') {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === 'false') return value === 'true';
    return undefined;
  }
  if (decl.type === 'int' || decl.type === 'float') {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return decl.type === 'int' ? Math.trunc(value) : value;
    }
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      const n = Number(value);
      return decl.type === 'int' ? Math.trunc(n) : n;
    }
    return undefined;
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return undefined;
}

function applyOverrides(parsed: ParsedScript, overrides?: Record<string, unknown>): void {
  if (!overrides) return;
  for (const input of parsed.inputs) {
    if (!(input.title in overrides)) continue;
    const next = coerceOverride(input, overrides[input.title]);
    if (next === undefined) continue;
    input.value = next;
    if (input.binding && input.type === 'source' && typeof next === 'string' && isOhlcv(next)) {
      parsed.series.set(input.binding, { kind: 'ohlcv', source: next });
    } else if (input.binding && input.type !== 'source') {
      parsed.scalars.set(input.binding, next);
    }
  }
}

function evalExpr(
  expr: SeriesExpr,
  series: Map<string, SeriesExpr>,
  scalars: Map<string, Scalar>,
  bars: MinimalBar[],
): (number | null)[] | null {
  if (expr.kind === 'ohlcv') return column(bars, expr.source);
  const src = resolveSeriesToken(expr.sourceToken, series);
  if (src?.kind !== 'ohlcv') return null;
  const len = resolveLength(expr.lengthToken, scalars);
  if (len === null) return null;
  return sma(column(bars, src.source), len);
}

function toPublicInputs(inputs: InputBinding[]): PineInputDecl[] {
  return inputs.map((input) => ({
    title: input.title,
    type: input.type,
    value: input.value,
    defval: input.defval,
  }));
}

/** Input declarations for the chart form. Empty when the script has none. */
export function declarePineInputs(script: string, overrides?: Record<string, unknown>): PineInputDecl[] {
  try {
    const parsed = parseScript(stripNoise(script));
    applyOverrides(parsed, overrides);
    return toPublicInputs(parsed.inputs);
  } catch {
    return [];
  }
}

function equityFromEntry(bars: MinimalBar[], entry: StrategyEntry): (number | null)[] {
  const index = Math.max(0, Math.trunc(entry.barIndex));
  const entryClose = num(bars[index]?.close);
  return bars.map((bar, i) => {
    if (i < index || entryClose === null) return null;
    const close = num(bar.close);
    if (close === null) return null;
    return entry.direction === 'short' ? entryClose - close : close - entryClose;
  });
}

/** Evaluate the documented minimal subset. Never throws. */
export function evaluateMinimalSubset(
  script: string,
  bars: MinimalBar[],
  overrides?: Record<string, unknown>,
): MinimalCalcResult {
  const list = Array.isArray(bars) ? bars : [];
  const body = stripNoise(script);
  const parsed = parseScript(body);
  applyOverrides(parsed, overrides);
  const specs = parsed.plots.filter((spec) => evalExpr(spec.expr, parsed.series, parsed.scalars, list));
  if (parsed.plots.length > specs.length) parsed.unknownPlot = true;
  if (specs.length === 0) {
    return {
      status: 'error',
      plots: {},
      series: {},
      plot_meta: {},
      error: `Local subset cannot evaluate this script. Supported: plot(close|open|high|low|volume), plot(ta.sma(...)), input.int/float/bool/string/source, and simple assignments. ${PYODIDE_PINE_WHEEL_NEXT}`,
      error_kind: 'unsupported',
    };
  }
  const plots: Record<string, (number | null)[]> = {};
  const plot_meta: Record<string, { kind: 'plot'; title: string; color?: string }> = {};
  const used = new Set<string>();
  for (const spec of specs) {
    let key = spec.title;
    let i = 2;
    while (used.has(key)) {
      key = `${spec.title}_${i}`;
      i += 1;
    }
    used.add(key);
    const values = evalExpr(spec.expr, parsed.series, parsed.scalars, list) ?? [];
    plots[key] = values;
    const meta: { kind: 'plot'; title: string; color?: string } = { kind: 'plot', title: key };
    if (spec.color) meta.color = spec.color;
    plot_meta[key] = meta;
  }
  const times = list.map((b) => num(b.time)).filter((t): t is number => t !== null);
  const name = indicatorName(String(script ?? ''));
  const series: Record<string, (number | null)[]> = { ...plots };
  const result: MinimalCalcResult = {
    status: 'success',
    plots,
    series,
    plot_meta,
    window: { bars: list.length, total_bars: list.length },
    overlay: true,
    script_type: parsed.strategy ? 'strategy' : 'indicator',
    script_name: name || 'pyodide-min',
  };
  if (times.length > 0) result.times = times;
  if (parsed.inputs.length > 0) result.inputs = toPublicInputs(parsed.inputs);
  if (parsed.unknownPlot) result.error_kind = 'partial';
  if (parsed.entries.length > 0 && list.length > 0) {
    const events: Array<Record<string, unknown>> = [];
    for (const entry of parsed.entries) {
      const index = Math.max(0, Math.min(list.length - 1, Math.trunc(entry.barIndex)));
      const bar = list[index];
      const event: Record<string, unknown> = {
        kind: 'entry',
        id: entry.id,
        direction: entry.direction,
        bar_index: index,
        qty: 1,
      };
      const price = num(bar?.close);
      if (price !== null) event.price = price;
      const time = num(bar?.time);
      if (time !== null) event.time = time;
      events.push(event);
    }
    result.events = events;
    const curve = equityFromEntry(list, parsed.entries[0]);
    if (curve.some((v) => v !== null)) series.__equity = curve;
  }
  return result;
}
