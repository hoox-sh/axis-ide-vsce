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
 * `axis.openChart` — sibling `*.axis.json` beside the active Pine buffer (Q1 / Task 08).
 */

import {
  defaultChartDocument,
  serializeChartDocument,
  type AxisChartDocV1,
} from '../editors/chart-document';
import { MOCK_BARS_DEFAULT, clampMockBarCount } from './mock-bars';

/** PYNE / Pine Script™ language id contributed by `hoox-sh.pyne`. */
export const PINE_LANGUAGE_ID = 'pinescript';

/** Filename suffixes treated as Pine sources (activation globs + sibling helper). */
export const PINE_FILE_SUFFIXES = [
  '.pyne',
  '.pine',
  '.pinev5',
  '.pinev6',
  '.pinescript',
] as const;

export const OPEN_CHART_NO_PINE_MESSAGE =
  'AXIS: Open Chart needs an active Pine Script™ file (.pyne / .pine). Open a script, then run the command again.';

/** Webview `drawing.setTool` value — host opens the sibling Pine source. */
export const OPEN_CHART_SOURCE_TOOL = 'open-source';

const AXIS_JSON_SUFFIX = '.axis.json';

/** `vscode.ViewColumn.Beside` — keep the Pine editor visible in the current group. */
export const OPEN_CHART_VIEW_COLUMN_BESIDE = -2;

/** Show options for `vscode.open` / `vscode.openWith` (preview off so the chart stays). */
export function openChartEditorOptions(preserveFocus = false): {
  viewColumn: number;
  preview: boolean;
  preserveFocus: boolean;
} {
  return {
    viewColumn: OPEN_CHART_VIEW_COLUMN_BESIDE,
    preview: false,
    preserveFocus: preserveFocus === true,
  };
}

export interface SiblingChartOptions {
  /** Copied from `axis.chart.historyBars` so the setting wins on new siblings. */
  historyBars?: number;
}

/**
 * True when the path ends with a known Pine suffix (case-insensitive).
 */
export function isPineFilePath(filePath: string): boolean {
  const lower = String(filePath ?? '').toLowerCase();
  return PINE_FILE_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

/**
 * Map `rsi.pyne` → `rsi.axis.json` (same directory, stem + `.axis.json`).
 * Returns null when the path is not a Pine source.
 */
export function siblingAxisJsonPath(pinePath: string): string | null {
  const path = String(pinePath ?? '');
  const lower = path.toLowerCase();
  const suffix = PINE_FILE_SUFFIXES.find((s) => lower.endsWith(s));
  if (!suffix) return null;
  const stem = path.slice(0, path.length - suffix.length);
  if (!stem) return null;
  return `${stem}${AXIS_JSON_SUFFIX}`;
}

function parentDir(filePath: string): string {
  const i = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return i >= 0 ? filePath.slice(0, i) : '';
}

function joinDir(dir: string, name: string): string {
  if (!dir) return name;
  const sep = dir.includes('\\') && !dir.includes('/') ? '\\' : '/';
  return `${dir}${sep}${name}`;
}

function isUnsafeRelativeName(name: string): boolean {
  return (
    !name ||
    name.includes('..') ||
    name.includes('/') ||
    name.includes('\\') ||
    name.includes(':')
  );
}

/**
 * Candidate sibling Pine paths for `rsi.axis.json` (suffix order from PYNE).
 */
export function siblingPineCandidates(chartPath: string): string[] {
  const path = String(chartPath ?? '');
  const lower = path.toLowerCase();
  if (!lower.endsWith(AXIS_JSON_SUFFIX)) return [];
  const stem = path.slice(0, path.length - AXIS_JSON_SUFFIX.length);
  if (!stem) return [];
  return PINE_FILE_SUFFIXES.map((suffix) => `${stem}${suffix}`);
}

/**
 * Resolve `scripts[].uri` (`./rsi.pyne`) beside the chart file.
 * Rejects absolute URLs and path traversal.
 */
export function chartSourceFromScripts(
  scripts: unknown,
  chartPath: string,
): string | null {
  if (!Array.isArray(scripts)) return null;
  const dir = parentDir(String(chartPath ?? ''));
  for (const entry of scripts) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }
    const uri = (entry as { uri?: unknown }).uri;
    if (typeof uri !== 'string') continue;
    let name = uri.trim();
    if (!name) continue;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(name)) continue;
    if (name.startsWith('./')) name = name.slice(2);
    if (isUnsafeRelativeName(name)) continue;
    if (!isPineFilePath(name)) continue;
    return joinDir(dir, name);
  }
  return null;
}

/**
 * Preferred Pine source for a chart: linked script URI, else first suffix candidate.
 */
export function resolveChartSourcePath(
  chartPath: string,
  scripts?: unknown,
): string | null {
  const linked = chartSourceFromScripts(scripts, chartPath);
  if (linked) return linked;
  return siblingPineCandidates(chartPath)[0] ?? null;
}

/** Default chart doc for a new sibling, optionally linking the Pine basename. */
export function defaultChartDocumentForPine(
  pineFileName: string,
  opts?: SiblingChartOptions,
): AxisChartDocV1 {
  const base = defaultChartDocument();
  const historyBars =
    typeof opts?.historyBars === 'number' && Number.isFinite(opts.historyBars) && opts.historyBars > 0
      ? clampMockBarCount(opts.historyBars)
      : MOCK_BARS_DEFAULT;
  const name = String(pineFileName ?? '').trim();
  if (!name) {
    return { ...base, historyBars };
  }
  const id = name.replace(/\.[^.]+$/, '') || name;
  return {
    ...base,
    historyBars,
    symbol: base.symbol || 'BTC/USDT',
    exchange: base.exchange || 'binance',
    source: base.source || 'binance',
    scripts: [{ id, uri: `./${name}`, inputs: {} }],
  };
}

/** Serialize bytes for a new sibling chart workspace. */
export function serializeSiblingChartDocument(
  pineFileName: string,
  opts?: SiblingChartOptions,
): Uint8Array {
  const text = serializeChartDocument(defaultChartDocumentForPine(pineFileName, opts));
  return new TextEncoder().encode(text);
}

/**
 * Pure plan for openChart create-or-open (unit-testable without VS Code fs).
 * Existing siblings are opened as-is (not rewritten).
 */
export function planSiblingChartOpen(input: {
  pinePath: string;
  pineFileName: string;
  siblingExists: boolean;
  historyBarsSetting?: number;
}):
  | { ok: true; siblingPath: string; writeBytes: Uint8Array | null }
  | { ok: false; error: string } {
  try {
    if (!isPineFilePath(input.pinePath)) {
      return { ok: false, error: OPEN_CHART_NO_PINE_MESSAGE };
    }
    const siblingPath = siblingAxisJsonPath(input.pinePath);
    if (!siblingPath) {
      return { ok: false, error: OPEN_CHART_NO_PINE_MESSAGE };
    }
    if (input.siblingExists) {
      return { ok: true, siblingPath, writeBytes: null };
    }
    const writeBytes = serializeSiblingChartDocument(input.pineFileName, {
      historyBars: input.historyBarsSetting,
    });
    return { ok: true, siblingPath, writeBytes };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `AXIS: Open Chart failed: ${message}` };
  }
}
