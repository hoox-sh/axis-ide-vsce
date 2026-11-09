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
 * Workspace / file OHLCV CSV for Pick Data (Wave 2 P7).
 * No OHLCV editor studio — parse a file the user already has.
 */

import { MOCK_BARS_CAP, type OhlcvBar } from './mock-bars';

const CSV_EXT = /\.csv$/i;

export type CsvBarsOk = { ok: true; bars: OhlcvBar[] };
export type CsvBarsErr = { ok: false; error: string };
export type CsvBarsResult = CsvBarsOk | CsvBarsErr;

export type ResolveBarsPathOk = { ok: true; fsPath: string };
export type ResolveBarsPathErr = { ok: false; error: string };
export type ResolveBarsPathResult = ResolveBarsPathOk | ResolveBarsPathErr;

const TIME_KEYS = new Set(['time', 'timestamp', 't', 'datetime', 'date']);
const OPEN_KEYS = new Set(['open', 'o']);
const HIGH_KEYS = new Set(['high', 'h']);
const LOW_KEYS = new Set(['low', 'l']);
const CLOSE_KEYS = new Set(['close', 'c']);
const VOL_KEYS = new Set(['volume', 'vol', 'v']);

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if ((ch === ',' || ch === '\t') && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function headerKey(cell: string): string {
  return cell.trim().toLowerCase().replace(/^\uFEFF/, '');
}

function parseTime(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  if (/^-?\d+(\.\d+)?$/.test(t)) {
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return n >= 1e12 ? Math.floor(n / 1000) : Math.floor(n);
  }
  const ms = Date.parse(t);
  if (!Number.isFinite(ms) || ms <= 0) return undefined;
  return Math.floor(ms / 1000);
}

function parseNum(raw: string): number | undefined {
  const n = Number(String(raw).trim().replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function looksLikeHeader(cells: string[]): boolean {
  const keys = cells.map(headerKey);
  return keys.some((k) => TIME_KEYS.has(k) || OPEN_KEYS.has(k) || CLOSE_KEYS.has(k));
}

function colIndex(keys: string[], names: Set<string>, fallback: number): number {
  const i = keys.findIndex((k) => names.has(k));
  return i >= 0 ? i : fallback;
}

/** Parse OHLCV CSV text. Unix seconds on `time` (ms and ISO dates accepted). */
export function parseOhlcvCsv(text: string, cap = MOCK_BARS_CAP): CsvBarsResult {
  try {
    const raw = String(text ?? '');
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    if (lines.length === 0) {
      return { ok: false, error: 'AXIS CSV: file is empty' };
    }
    const first = splitCsvLine(lines[0] ?? '');
    const headed = looksLikeHeader(first);
    const keys = headed ? first.map(headerKey) : [];
    const ti = headed ? colIndex(keys, TIME_KEYS, 0) : 0;
    const oi = headed ? colIndex(keys, OPEN_KEYS, 1) : 1;
    const hi = headed ? colIndex(keys, HIGH_KEYS, 2) : 2;
    const li = headed ? colIndex(keys, LOW_KEYS, 3) : 3;
    const ci = headed ? colIndex(keys, CLOSE_KEYS, 4) : 4;
    const vi = headed ? colIndex(keys, VOL_KEYS, 5) : 5;
    const start = headed ? 1 : 0;
    const limit = Math.min(MOCK_BARS_CAP, Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : MOCK_BARS_CAP);
    const bars: OhlcvBar[] = [];
    for (let i = start; i < lines.length && bars.length < limit; i += 1) {
      const cells = splitCsvLine(lines[i] ?? '');
      const time = parseTime(cells[ti] ?? '');
      const open = parseNum(cells[oi] ?? '');
      const high = parseNum(cells[hi] ?? '');
      const low = parseNum(cells[li] ?? '');
      const close = parseNum(cells[ci] ?? '');
      const volume = parseNum(cells[vi] ?? '') ?? 0;
      if (
        time === undefined ||
        open === undefined ||
        high === undefined ||
        low === undefined ||
        close === undefined
      ) {
        continue;
      }
      bars.push({ time, open, high, low, close, volume });
    }
    if (bars.length === 0) {
      return { ok: false, error: 'AXIS CSV: no OHLCV rows (need time,open,high,low,close)' };
    }
    bars.sort((a, b) => a.time - b.time);
    return { ok: true, bars };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `AXIS CSV: parse failed: ${message}` };
  }
}

function hasDotDot(p: string): boolean {
  return p.split(/[/\\]/).some((seg) => seg === '..');
}

export function isCsvBarsPath(raw: string): boolean {
  const t = String(raw ?? '').trim();
  return t.length > 0 && CSV_EXT.test(t) && !hasDotDot(t);
}

function joinRoot(root: string, rel: string): string {
  const base = root.replace(/[/\\]+$/, '');
  const rest = rel.replace(/^[/\\]+/, '');
  if (!base) return rest;
  return `${base}/${rest}`.replace(/\\/g, '/');
}

function isUnderRoot(abs: string, root: string): boolean {
  const a = abs.replace(/\\/g, '/').toLowerCase();
  const r = root.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  if (!r) return false;
  return a === r || a.startsWith(`${r}/`);
}

/**
 * Resolve a stored `barsPath` against workspace / chart directory.
 * Relative paths must stay under a supplied root. Absolute paths are allowed
 * when they have no `..` and end in `.csv`.
 */
export function resolveBarsFilePath(
  raw: string,
  roots: string[],
): ResolveBarsPathResult {
  const t = String(raw ?? '').trim();
  if (!isCsvBarsPath(t)) {
    return { ok: false, error: 'AXIS CSV: barsPath must be a .csv file without .. segments' };
  }
  const posix = t.replace(/\\/g, '/');
  const absolute = posix.startsWith('/') || /^[a-zA-Z]:\//.test(posix);
  if (absolute) {
    return { ok: true, fsPath: posix };
  }
  const cleanRoots = roots.map((r) => String(r ?? '').trim()).filter(Boolean);
  if (cleanRoots.length === 0) {
    return { ok: false, error: 'AXIS CSV: relative barsPath needs a workspace or chart folder' };
  }
  for (const root of cleanRoots) {
    const joined = joinRoot(root, posix);
    if (isUnderRoot(joined, root.replace(/\\/g, '/'))) {
      return { ok: true, fsPath: joined };
    }
  }
  return { ok: false, error: 'AXIS CSV: barsPath escaped the workspace' };
}

/** Prefer a workspace-relative path for persistence. */
export function toStoredBarsPath(absPath: string, workspaceRoot?: string): string {
  const abs = String(absPath ?? '').trim().replace(/\\/g, '/');
  const root = String(workspaceRoot ?? '').trim().replace(/\\/g, '/').replace(/\/+$/, '');
  if (root && isUnderRoot(abs, root)) {
    const rel = abs.slice(root.length).replace(/^\/+/, '');
    return rel || abs;
  }
  return abs;
}

export async function loadOhlcvCsvFile(
  fsPath: string,
  readText: (path: string) => Promise<string> | string,
  cap?: number,
): Promise<CsvBarsResult> {
  try {
    const text = await readText(fsPath);
    return parseOhlcvCsv(String(text ?? ''), cap);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `AXIS CSV: could not read ${fsPath}: ${message}` };
  }
}
