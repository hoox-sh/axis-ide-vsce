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
 * Run Output studio host messages and data builders (enhancement plan §5
 * Phase 3a). Pure-host: no vscode imports. Builds the composite
 * `axis.runOutput` data payload sent via `studio.init` / `studio.set`, and
 * the `studio.action` envelopes the webview posts back.
 *
 * Reuses:
 * - `ResultsFocusStore.getResultsSetPayload()` for Summary / Strategy.
 * - `ProfilerStore` snapshot for Profiler.
 * - `logsStudioData()` for Logs.
 */

import { encode } from '../protocol/codec';
import {
  HOST_TO_VIEW,
  VIEW_TO_HOST,
  type AxisEnvelope,
  type StudioActionPayload,
  type StudioSetPayload,
} from '../protocol/types';
import {
  countPlots,
  countSeries,
  type ProfilerHotLine,
  type ProfilerPhase,
  type ProfilerSnapshot,
} from '../run/profiler-store';
import { type ResultsSetPayload } from '../protocol/types';
import {
  logsStudioData,
  parseLogsCopyArgs,
  parseLogsRevealArgs,
  type LogRow,
} from './logs-messages';

/** Studio wire id and VS Code view id for the Run Output panel. */
export const RUN_OUTPUT_STUDIO_VIEW = 'runoutput';
export const RUN_OUTPUT_VIEW_ID = 'axis.runOutput';
export const RUN_OUTPUT_TITLE = 'Run Output';

/** Client-side tabs inside the Run Output studio. */
export type RunOutputTab = 'summary' | 'strategy' | 'profiler' | 'logs';

const RUN_OUTPUT_TABS: readonly RunOutputTab[] = ['summary', 'strategy', 'profiler', 'logs'];
const RUN_OUTPUT_TAB_SET: ReadonlySet<string> = new Set(RUN_OUTPUT_TABS);

export type ResultsStatus = 'success' | 'error' | 'idle';

export type ResultsRow = {
  key: string;
  label: string;
  value: string;
};

export type ResultsMetaChip = {
  key: string;
  label: string;
  value: string;
};

export interface RunOutputSummaryTab {
  /** Verbatim `ResultsSetPayload` fields. */
  lastRun: unknown;
  strategyReport: unknown;
  focusId: unknown;
  /** Pre-computed Summary view model. */
  status: ResultsStatus;
  statusLabel: string;
  focusLine: string;
  rows: ResultsRow[];
  metaChips: ResultsMetaChip[];
  emptyTitle: string;
  emptyMessage: string;
  runId: string | null;
  createdAt: number | null;
  relativeTime: string;
  absoluteTime: string;
}

export interface RunOutputStrategyTab {
  hasReport: boolean;
  kpis: ResultsRow[];
  rows: ResultsRow[];
  note: string | null;
}

export type RunOutputProfilerTab = {
  runId: string;
  status: 'success' | 'error';
  ms: number;
  engineId: string;
  seriesKey: string;
  plotCount: number;
  seriesCount: number;
  createdAt?: number;
  topLines: ProfilerHotLine[];
  lineCount: number;
  phases?: ProfilerPhase[];
  error?: string;
};

export interface RunOutputLogsTab {
  rows: LogRow[];
  runId: string | null;
  status: string | null;
}

export interface RunOutputData {
  activeTab: RunOutputTab;
  tabs: {
    summary: RunOutputSummaryTab;
    strategy: RunOutputStrategyTab;
    profiler: RunOutputProfilerTab;
    logs: RunOutputLogsTab;
  };
  liveMessage?: string;
}

export const EMPTY_RUN_TITLE = 'No run yet';
export const EMPTY_RUN_HINT = 'Run a Pine script with Ctrl/Cmd+Enter';
export const ERROR_RUN_HINT = 'Fix the error and re-run with Ctrl/Cmd+Enter';
export const NO_STRATEGY_REPORT = 'This run has no strategy report';
export const NO_STRATEGY_HINT = 'Open a strategy script and run with Ctrl/Cmd+Enter';
export const NO_RUN_FOCUSED = 'No run focused';

const STATUS_LABEL: Record<ResultsStatus, string> = {
  idle: 'Idle',
  success: 'Success',
  error: 'Error',
};

/** Primary strategy KPIs shown as dense cards. */
export const STRATEGY_KPI_IDS: readonly string[] = [
  'netprofit',
  'winrate',
  'trades',
  'profitfactor',
  'maxdd',
];

/** Known strategy stats — aliases match PWA StrategyStats + engine JSON. */
export const STRATEGY_FIELDS: ReadonlyArray<{
  id: string;
  label: string;
  aliases: readonly string[];
  format: 'number' | 'percent' | 'count';
}> = [
  { id: 'netprofit', label: 'Net profit', aliases: ['netprofit', 'netProfit', 'net_profit', 'totalPnl', 'total_pnl', 'net'], format: 'number' },
  { id: 'winrate', label: 'Win rate', aliases: ['winrate', 'winRate', 'win_rate'], format: 'percent' },
  { id: 'trades', label: 'Trades', aliases: ['trades', 'tradeCount', 'nTrades'], format: 'count' },
  { id: 'wins', label: 'Wins', aliases: ['wins'], format: 'count' },
  { id: 'losses', label: 'Losses', aliases: ['losses'], format: 'count' },
  { id: 'profitfactor', label: 'Profit factor', aliases: ['profitFactor', 'profit_factor', 'profitfactor'], format: 'number' },
  { id: 'avgtrade', label: 'Avg trade', aliases: ['avgTrade', 'avg_trade'], format: 'number' },
  { id: 'avgwin', label: 'Avg win', aliases: ['avgWin', 'avg_win'], format: 'number' },
  { id: 'avgloss', label: 'Avg loss', aliases: ['avgLoss', 'avg_loss'], format: 'number' },
  { id: 'maxdd', label: 'Max DD', aliases: ['maxDD', 'maxDd', 'max_dd', 'maxDrawdown', 'max_drawdown'], format: 'percent' },
  { id: 'grossprofit', label: 'Gross profit', aliases: ['grossProfit', 'gross_profit'], format: 'number' },
  { id: 'grossloss', label: 'Gross loss', aliases: ['grossLoss', 'gross_loss'], format: 'number' },
  { id: 'returnpct', label: 'Return %', aliases: ['returnPct', 'return_pct', 'return'], format: 'percent' },
];

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Read a property without letting a hostile getter break the caller. */
function safeRead(obj: Record<string, unknown>, key: string): unknown {
  try {
    return obj[key];
  } catch {
    return undefined;
  }
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const t = value.trim();
    return t ? t : undefined;
  }
  return undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return String(value);
  const abs = Math.abs(value);
  if (abs >= 100) return value.toFixed(2);
  if (abs >= 1) {
    const s = value.toFixed(4);
    return s.replace(/0+$/, '').replace(/\.$/, '');
  }
  return value.toPrecision(4).replace(/0+$/, '').replace(/\.$/, '');
}

function formatPercent(value: number): string {
  const pct = Math.abs(value) <= 1 ? value * 100 : value;
  const body = Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${body}%`;
}

function formatField(format: 'number' | 'percent' | 'count', value: unknown): string | undefined {
  if (format === 'count' && Array.isArray(value)) return String(value.length);
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  const n = asFiniteNumber(value);
  if (n == null) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    return undefined;
  }
  if (format === 'percent') return formatPercent(n);
  if (format === 'count') return String(Math.round(n));
  return formatNumber(n);
}

function safeKeys(obj: Record<string, unknown>): string[] {
  try {
    return Object.keys(obj);
  } catch {
    return [];
  }
}

function lookupAlias(bag: Record<string, unknown>, aliases: readonly string[]): unknown {
  for (const alias of aliases) {
    const v = safeRead(bag, alias);
    if (v != null) return v;
  }
  const lower: Record<string, unknown> = {};
  for (const key of safeKeys(bag)) {
    lower[key.toLowerCase()] = safeRead(bag, key);
  }
  for (const alias of aliases) {
    const v = lower[alias.toLowerCase()];
    if (v != null) return v;
  }
  return undefined;
}

/** Flatten `stats` onto the report so nested PWA reports still match. */
export function strategyBag(report: unknown): Record<string, unknown> | null {
  if (!isPlainObject(report)) return null;
  const stats = safeRead(report, 'stats');
  if (isPlainObject(stats)) return { ...report, ...stats };
  return report;
}

export function pickStrategyRows(report: unknown): ResultsRow[] {
  const bag = strategyBag(report);
  if (!bag) return [];
  const rows: ResultsRow[] = [];
  for (const field of STRATEGY_FIELDS) {
    const raw = lookupAlias(bag, field.aliases);
    const value = formatField(field.format, raw);
    if (value == null) continue;
    rows.push({ key: field.id, label: field.label, value });
  }
  return rows;
}

/** Split strategy rows into KPI cards vs denser table remainder. */
export function splitStrategyKpis(rows: ResultsRow[]): { kpis: ResultsRow[]; rest: ResultsRow[] } {
  const kpiSet = new Set(STRATEGY_KPI_IDS);
  const kpis: ResultsRow[] = [];
  const rest: ResultsRow[] = [];
  for (const row of rows) {
    if (kpiSet.has(row.key)) kpis.push(row);
    else rest.push(row);
  }
  kpis.sort((a, b) => STRATEGY_KPI_IDS.indexOf(a.key) - STRATEGY_KPI_IDS.indexOf(b.key));
  return { kpis, rest };
}

function countList(value: unknown): number {
  if (value == null) return 0;
  if (Array.isArray(value)) return value.length;
  return 0;
}

function metaOf(lastRun: Record<string, unknown>): Record<string, unknown> {
  const meta = safeRead(lastRun, 'meta');
  return isPlainObject(meta) ? meta : {};
}

function scriptName(lastRun: Record<string, unknown>, meta: Record<string, unknown>): string | undefined {
  return (
    asString(safeRead(meta, 'script_name')) ||
    asString(safeRead(meta, 'scriptName')) ||
    asString(safeRead(meta, 'name')) ||
    asString(safeRead(lastRun, 'script_name')) ||
    asString(safeRead(lastRun, 'name'))
  );
}

function engineId(lastRun: Record<string, unknown>, meta: Record<string, unknown>): string | undefined {
  return (
    asString(safeRead(lastRun, 'engineId')) ||
    asString(safeRead(lastRun, 'engine')) ||
    asString(safeRead(meta, 'engineId')) ||
    asString(safeRead(meta, 'engine'))
  );
}

function seriesKeyOf(lastRun: Record<string, unknown>, meta: Record<string, unknown>): string | undefined {
  return asString(safeRead(lastRun, 'seriesKey')) || asString(safeRead(meta, 'seriesKey'));
}

function msOf(lastRun: Record<string, unknown>, meta: Record<string, unknown>): number | undefined {
  const fromMeta = asFiniteNumber(safeRead(meta, 'ms'));
  if (fromMeta != null) return fromMeta;
  return asFiniteNumber(safeRead(lastRun, 'ms'));
}

function createdAtOf(lastRun: Record<string, unknown>, meta: Record<string, unknown>): number | null {
  const candidates = [
    asFiniteNumber(safeRead(lastRun, 'createdAt')),
    asFiniteNumber(safeRead(lastRun, 'at')),
    asFiniteNumber(safeRead(meta, 'createdAt')),
    asFiniteNumber(safeRead(meta, 'at')),
  ];
  for (const n of candidates) {
    if (n != null && n > 0) return n;
  }
  return null;
}

/** Relative age for the Summary sticky header. */
export function formatRelativeTime(ms: number, now = Date.now()): string {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const d = now - ms;
  if (!Number.isFinite(d) || d <= 0) return '';
  if (d < 5_000) return 'just now';
  if (d < 60_000) return `${Math.max(1, Math.round(d / 1_000))}s ago`;
  if (d < 3_600_000) return `${Math.round(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.round(d / 3_600_000)}h ago`;
  return `${Math.round(d / 86_400_000)}d ago`;
}

export function formatAbsoluteTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  return new Date(ms).toLocaleString();
}

export function statusOf(lastRun: Record<string, unknown> | null): ResultsStatus {
  if (!lastRun) return 'idle';
  const status = asString(safeRead(lastRun, 'status'));
  const error = asString(safeRead(lastRun, 'error'));
  if (status === 'error' || error) return 'error';
  if (status === 'success') return 'success';
  return 'idle';
}

export function runSummaryRows(lastRun: Record<string, unknown> | null): ResultsRow[] {
  if (!lastRun) return [];
  const meta = metaOf(lastRun);
  const id = asString(safeRead(lastRun, 'id')) ?? '—';
  const name = scriptName(lastRun, meta) ?? '—';
  const engine = engineId(lastRun, meta) ?? '—';
  const seriesKey = seriesKeyOf(lastRun, meta) ?? '—';
  const ms = msOf(lastRun, meta);
  const plots = countPlots(safeRead(lastRun, 'plots'));
  const error = asString(safeRead(lastRun, 'error'));
  const rows: ResultsRow[] = [
    { key: 'id', label: 'Run id', value: id },
    { key: 'script', label: 'Script', value: name },
    { key: 'engine', label: 'Engine', value: engine },
    { key: 'seriesKey', label: 'seriesKey', value: seriesKey },
    { key: 'ms', label: 'Duration', value: ms == null ? '—' : `${Math.round(ms)} ms` },
    { key: 'plots', label: 'Plots', value: String(plots) },
  ];
  if (error) rows.push({ key: 'error', label: 'Error', value: error });
  return rows;
}

export function buildMetaChips(lastRun: Record<string, unknown> | null): ResultsMetaChip[] {
  if (!lastRun) return [];
  const meta = metaOf(lastRun);
  const ms = msOf(lastRun, meta);
  const plots = countPlots(safeRead(lastRun, 'plots'));
  const series = countSeries(safeRead(lastRun, 'series'));
  const logs = countList(safeRead(lastRun, 'logs'));
  const diags = countList(safeRead(lastRun, 'diagnostics'));
  const chips: ResultsMetaChip[] = [];
  if (ms != null) chips.push({ key: 'ms', label: 'ms', value: String(Math.round(ms)) });
  chips.push({ key: 'plots', label: 'plots', value: String(plots) });
  chips.push({ key: 'series', label: 'series', value: String(series) });
  chips.push({ key: 'logs', label: 'logs', value: String(logs) });
  chips.push({ key: 'diags', label: 'diags', value: String(diags) });
  return chips;
}

function focusLineOf(focusId: unknown): string {
  if (focusId == null) return NO_RUN_FOCUSED;
  const id = typeof focusId === 'string' ? focusId.trim() : String(focusId).trim();
  if (!id) return NO_RUN_FOCUSED;
  return `Focus: ${id}`;
}

function emptyStrategyNote(): string {
  return `${NO_STRATEGY_REPORT}. ${NO_STRATEGY_HINT}`;
}

function readSetField(payload: unknown, key: string): unknown {
  return isPlainObject(payload) ? safeRead(payload, key) : undefined;
}

/** Build the Summary tab payload — verbatim fields plus a pre-computed view model. */
export function buildRunOutputSummaryTab(
  payload: ResultsSetPayload,
  now = Date.now(),
): RunOutputSummaryTab {
  const lastRunRaw = readSetField(payload, 'lastRun');
  const lastRun = isPlainObject(lastRunRaw) ? lastRunRaw : null;
  const status = statusOf(lastRun);
  const focusId = readSetField(payload, 'focusId');
  const strategyReport = readSetField(payload, 'strategyReport');
  const focusLine = focusLineOf(focusId);

  let rows: ResultsRow[] = [];
  let metaChips: ResultsMetaChip[] = [];
  let runId: string | null = null;
  let createdAt: number | null = null;
  let relativeTime = '';
  let absoluteTime = '';

  if (lastRun) {
    rows = runSummaryRows(lastRun);
    metaChips = buildMetaChips(lastRun);
    runId = asString(safeRead(lastRun, 'id')) ?? null;
    const meta = metaOf(lastRun);
    createdAt = createdAtOf(lastRun, meta);
    relativeTime = createdAt != null ? formatRelativeTime(createdAt, now) : '';
    absoluteTime = createdAt != null ? formatAbsoluteTime(createdAt) : '';
  }

  const emptyMessage = status === 'error' && lastRun ? ERROR_RUN_HINT : EMPTY_RUN_HINT;

  return {
    lastRun,
    strategyReport,
    focusId,
    status,
    statusLabel: STATUS_LABEL[status],
    focusLine,
    rows,
    metaChips,
    emptyTitle: EMPTY_RUN_TITLE,
    emptyMessage,
    runId,
    createdAt,
    relativeTime,
    absoluteTime,
  };
}

/** Build the Strategy tab payload from a strategy report. */
export function buildRunOutputStrategyTab(strategyReport: unknown): RunOutputStrategyTab {
  const hasReport = isPlainObject(strategyReport);
  const strategyRows = pickStrategyRows(strategyReport);

  if (hasReport && strategyRows.length > 0) {
    const { kpis, rest } = splitStrategyKpis(strategyRows);
    return {
      hasReport: true,
      kpis,
      rows: kpis.length > 0 ? rest : strategyRows,
      note: null,
    };
  }

  return {
    hasReport,
    kpis: [],
    rows: [],
    note: emptyStrategyNote(),
  };
}

const EMPTY_PROFILER_SNAPSHOT: ProfilerSnapshot = {
  runId: '',
  status: 'error',
  ms: 0,
  engineId: '',
  seriesKey: '',
  plotCount: 0,
  seriesCount: 0,
  createdAt: Date.now(),
  topLines: [],
  lineCount: 0,
};

/** Build the Profiler tab payload from a profiler snapshot. */
export function buildRunOutputProfilerTab(snapshot: ProfilerSnapshot | null): RunOutputProfilerTab {
  return snapshot ?? EMPTY_PROFILER_SNAPSHOT;
}

/** Build the Logs tab payload from the current last-run record. */
export function buildRunOutputLogsTab(lastRun: unknown): RunOutputLogsTab {
  return logsStudioData(lastRun);
}

/** Compose all four Run Output tabs into one `studio.set` data body. */
export function buildRunOutputData(
  resultsSet: ResultsSetPayload,
  profiler: ProfilerSnapshot | null,
  opts?: { now?: number },
): RunOutputData {
  const now = opts?.now ?? Date.now();
  const summary = buildRunOutputSummaryTab(resultsSet, now);
  const strategy = buildRunOutputStrategyTab(readSetField(resultsSet, 'strategyReport'));
  const profilerTab = buildRunOutputProfilerTab(profiler);
  const logs = buildRunOutputLogsTab(summary.lastRun);

  const liveBase = summary.status === 'idle' ? 'Idle' : summary.statusLabel;
  const liveMessage = summary.runId ? `${liveBase} — ${summary.runId}` : liveBase;

  return {
    activeTab: 'summary',
    tabs: {
      summary,
      strategy,
      profiler: profilerTab,
      logs,
    },
    liveMessage,
  };
}

/** Encode a `studio.set` envelope carrying the full Run Output data body. */
export function buildRunOutputSetEnvelope(data: RunOutputData): AxisEnvelope<StudioSetPayload> {
  return encode(HOST_TO_VIEW.StudioSet, {
    view: RUN_OUTPUT_STUDIO_VIEW,
    data,
  });
}

export function isRunOutputTab(value: unknown): value is RunOutputTab {
  return typeof value === 'string' && RUN_OUTPUT_TAB_SET.has(value);
}

function readArg(args: unknown, key: string): unknown {
  return isPlainObject(args) ? safeRead(args, key) : undefined;
}

function parseLineArg(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 && raw < 1_000_000) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (/^\d+$/.test(trimmed)) {
      const n = Number(trimmed);
      if (Number.isInteger(n) && n >= 1 && n < 1_000_000) return n;
    }
  }
  return null;
}

function parseCopyTextArg(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

/** Validate `{ tab: 'summary' | ... }` action args. */
export function parseRunOutputSelectTabArgs(args: unknown): RunOutputTab | null {
  const tab = readArg(args, 'tab');
  return isRunOutputTab(tab) ? tab : null;
}

/** Validate `{ runId: string }` for `copyId` action args. */
export function parseRunOutputCopyIdArgs(args: unknown): string | null {
  return parseCopyTextArg(readArg(args, 'runId'));
}

/** Validate `{ runId: string }` for `focusRun` action args. */
export function parseRunOutputFocusRunArgs(args: unknown): string | null {
  return parseCopyTextArg(readArg(args, 'runId'));
}

/** Validate `{ line: number }` for `revealProfilerLine` action args. */
export function parseRunOutputRevealProfilerLineArgs(args: unknown): number | null {
  return parseLineArg(readArg(args, 'line'));
}

/** Validate `{ runId: string }` for `copyRunId` action args. */
export function parseRunOutputCopyRunIdArgs(args: unknown): string | null {
  return parseCopyTextArg(readArg(args, 'runId'));
}

/** Validate `{ line: number }` for `revealLogLine` action args. */
export function parseRunOutputRevealLogLineArgs(args: unknown): number | null {
  return parseLogsRevealArgs(args);
}

/** Validate `{ text: string }` for `copyLogText` action args. */
export function parseRunOutputCopyLogTextArgs(args: unknown): string | null {
  return parseLogsCopyArgs(args);
}

function actionEnvelope(action: string, args?: Record<string, unknown>): AxisEnvelope<StudioActionPayload> {
  return encode(VIEW_TO_HOST.StudioAction, {
    view: RUN_OUTPUT_STUDIO_VIEW,
    action,
    args,
  });
}

/** Build a `studio.action` envelope that switches the active tab. */
export function buildRunOutputSelectTabAction(tab: RunOutputTab): AxisEnvelope<StudioActionPayload> {
  return actionEnvelope('selectTab', { tab });
}

/** Build a `studio.action` envelope that copies a run id to the clipboard. */
export function buildRunOutputCopyIdAction(runId: string): AxisEnvelope<StudioActionPayload> {
  return actionEnvelope('copyId', { runId: runId.trim() });
}

/** Build a `studio.action` envelope that retargets Results focus to a run id. */
export function buildRunOutputFocusRunAction(runId: string): AxisEnvelope<StudioActionPayload> {
  return actionEnvelope('focusRun', { runId: runId.trim() });
}

/** Build a `studio.action` envelope that reveals a profiler hot line. */
export function buildRunOutputRevealProfilerLineAction(line: number): AxisEnvelope<StudioActionPayload> {
  return actionEnvelope('revealProfilerLine', { line });
}

/** Build a `studio.action` envelope that copies a profiler run id. */
export function buildRunOutputCopyRunIdAction(runId: string): AxisEnvelope<StudioActionPayload> {
  return actionEnvelope('copyRunId', { runId: runId.trim() });
}

/** Build a `studio.action` envelope that reveals a log line. */
export function buildRunOutputRevealLogLineAction(line: number): AxisEnvelope<StudioActionPayload> {
  return actionEnvelope('revealLogLine', { line });
}

/** Build a `studio.action` envelope that copies log text. */
export function buildRunOutputCopyLogTextAction(text: string): AxisEnvelope<StudioActionPayload> {
  return actionEnvelope('copyLogText', { text });
}
