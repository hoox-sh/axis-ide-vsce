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
 * Thin Pro `/run` HTTP adapter (PR-06). Injectable fetch for unit tests.
 * Body: `{ script, data, mode, symbol?, inputs?, timeframe?, from_bar?, to_bar? }`.
 * `timeframe` is retried off once on Flask `UNKNOWN_FIELDS` (schema landing in parallel).
 */

import type { OhlcvBar } from '../host/mock-bars';
import { withAxisClientHeader } from '../http/client';
import { attachRunEnvelope, type RunWindow, type StrategyReport } from './run-envelope';

export type RunMode = 'auto' | 'interpret' | 'compile';

/** Fetch subset used by the adapter (globalThis.fetch-compatible). */
export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

/** Absolute deadline for a Pro `/run` HTTP round-trip (supersede abort still wins). */
export const ENGINE_RUN_TIMEOUT_MS = 30_000;

/**
 * Combine 0..n abort signals into one; undefined when none provided.
 * The caller's supersede/deactivate abort is preserved, and a timeout can be
 * layered on top so a stalled socket never hangs a run indefinitely.
 */
export function combineAbortSignals(
  ...signals: Array<AbortSignal | undefined>
): AbortSignal | undefined {
  const present = signals.filter((s): s is AbortSignal => s != null);
  if (present.length === 0) return undefined;
  if (present.length === 1) return present[0];
  if (present.some((s) => s.aborted)) return AbortSignal.abort();
  const controller = new AbortController();
  const onAbort = (): void => controller.abort();
  for (const s of present) s.addEventListener('abort', onAbort, { once: true });
  return controller.signal;
}

export interface EngineHttpRequest {
  endpoint: string;
  script: string;
  bars: OhlcvBar[];
  mode: RunMode;
  /** Optional chart symbol label (defaults to CHART). */
  symbol?: string;
  /** Optional `input.*` overrides (title → value). Omitted when empty. */
  inputs?: Record<string, unknown>;
  /**
   * Chart interval (`*.axis.json` `interval` / data pick). Mapped to worker-style
   * `1m`/`1h`/`1d` before POST. Omitted when unset/unknown.
   */
  timeframe?: string;
  /** Inclusive envelope start (bar index). Omitted when unset. */
  fromBar?: number;
  /** Inclusive envelope end (bar index). Omitted when unset. */
  toBar?: number;
  /**
   * Bearer token (`pyn_…` / `pn_…`). Optional during open beta: when absent the
   * request still goes out with `X-AXIS-Client: ide` and no Authorization header.
   * When present, both `Authorization: Bearer` and `X-API-Key` are sent.
   */
  apiKey?: string;
  signal?: AbortSignal;
  /** Absolute round-trip deadline (ms). Defaults to ENGINE_RUN_TIMEOUT_MS. */
  timeoutMs?: number;
  /**
   * When false (default), the endpoint must be loopback so the Bearer key is
   * not sent off-machine. Transport-level gate (fail-closed) — mirrors
   * `checkEngineEndpoint` so future callers cannot forget the caller-side gate.
   */
  allowRemote?: boolean;
  fetchImpl?: FetchLike;
}

export interface EngineCompileDiagnostic {
  message: string;
  line?: number;
  column?: number;
  severity?: 'error' | 'warning' | 'info';
}

export interface EngineRunResult {
  status: 'success' | 'error';
  plots: unknown;
  series: Record<string, unknown>;
  events: unknown[];
  drawings?: unknown;
  error?: string;
  code?: string;
  httpStatus?: number;
  diagnostics: EngineCompileDiagnostic[];
  /** Capped engine log lines from `logs` or `log` (strings may be truncated). */
  logs?: unknown;
  raw?: unknown;
  /** `profile` is set only when the engine sent a plain object — never invented. */
  meta: { ms?: number; transport: 'rest'; profile?: unknown; [key: string]: unknown };
  plotMeta?: unknown;
  inputs?: unknown;
  alerts?: unknown;
  times?: number[];
  window?: RunWindow;
  errorKind?: string;
  scriptType?: string;
  scriptName?: string;
  overlay?: boolean;
  strategy?: StrategyReport;
}

export const MISSING_ENDPOINT_ERROR =
  'AXIS engine endpoint is empty. Set axis.engine.endpoint (e.g. http://127.0.0.1:5002).';

/**
 * Retained for callers that still gate on Pro auth. `postEngineRun` itself no
 * longer fails when the key is absent — open beta trusts `X-AXIS-Client: ide`.
 */
export const MISSING_API_KEY_ERROR =
  'AXIS Pro API key required for POST /run (SecretStorage pyn_…).';

export const DEFAULT_ENGINE_ENDPOINT = 'http://127.0.0.1:5002';

/** Kept in sync with `REMOTE_ENDPOINT_DENIED` in `./endpoint` (no import → avoid cycle). */
export const ENGINE_REMOTE_DENIED =
  'AXIS engine endpoint must be loopback (127.0.0.1 / localhost / ::1) unless axis.engine.allowRemoteEndpoint is enabled.';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

/** pyne-worker `sanitize_timeframe` set (exchange / Binance-style). */
const WORKER_TIMEFRAMES = new Set([
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '6h',
  '8h',
  '12h',
  '1d',
  '3d',
  '1w',
  '1M',
]);

/** Pine period / aliases → worker-style interval. `1M` monthly is exact-match only. */
const TIMEFRAME_ALIASES: Record<string, string> = {
  '1': '1m',
  '3': '3m',
  '5': '5m',
  '15': '15m',
  '30': '30m',
  '60': '1h',
  '120': '2h',
  '240': '4h',
  '360': '6h',
  '480': '8h',
  '720': '12h',
  '60m': '1h',
  '240m': '4h',
  d: '1d',
  w: '1w',
};

/**
 * Map `*.axis.json` `interval` (or a Pine period) to a worker-style timeframe.
 * Unknown / empty values are omitted (do not POST garbage).
 */
export function mapToWorkerTimeframe(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  if (WORKER_TIMEFRAMES.has(s)) return s;
  const lower = s.toLowerCase();
  if (lower !== '1m' && WORKER_TIMEFRAMES.has(lower)) return lower;
  return TIMEFRAME_ALIASES[s] ?? TIMEFRAME_ALIASES[lower];
}

function finiteInt(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.trunc(value);
}

function buildRunBody(req: EngineHttpRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    script: req.script,
    data: barsForPine(req.bars),
    mode: req.mode || 'auto',
    symbol: (req.symbol && String(req.symbol).trim()) || 'CHART',
  };
  if (req.inputs && Object.keys(req.inputs).length > 0) {
    body.inputs = req.inputs;
  }
  const timeframe = mapToWorkerTimeframe(req.timeframe);
  if (timeframe) body.timeframe = timeframe;
  const fromBar = finiteInt(req.fromBar);
  if (fromBar !== undefined) body.from_bar = fromBar;
  const toBar = finiteInt(req.toBar);
  if (toBar !== undefined) body.to_bar = toBar;
  return body;
}

function isUnknownFields(mapped: EngineRunResult, parsed: unknown): boolean {
  if (mapped.code === 'UNKNOWN_FIELDS') return true;
  if (isPlainObject(parsed) && parsed.code === 'UNKNOWN_FIELDS') return true;
  const msg = `${mapped.error ?? ''} ${mapped.code ?? ''}`;
  return /UNKNOWN_FIELDS/i.test(msg);
}

/** True when the endpoint host is loopback (mirrors `checkEngineEndpoint`). */
function isLoopbackEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint.includes('://') ? endpoint : `http://${endpoint}`);
    return LOOPBACK_HOSTS.has(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Chart bars store unix seconds; Pine `time` expects milliseconds. */
export function barsForPine(bars: OhlcvBar[]): Array<Record<string, number>> {
  if (!Array.isArray(bars)) return [];
  return bars.map((bar) => {
    const time = Number(bar?.time);
    const pineTime =
      Number.isFinite(time) && time > 0 && time < 1e11 ? Math.round(time * 1000) : time;
    return {
      time: pineTime,
      open: Number(bar.open),
      high: Number(bar.high),
      low: Number(bar.low),
      close: Number(bar.close),
      volume: Number(bar.volume),
    };
  });
}

function trimEndpoint(endpoint: string): string {
  return String(endpoint ?? '')
    .trim()
    .replace(/\/+$/, '');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function coerceSeriesMap(raw: unknown): Record<string, unknown> {
  if (!isPlainObject(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!key || key.startsWith('_')) continue;
    if (Array.isArray(value)) out[key] = value;
  }
  return out;
}

const MAX_LOG_LINES = 200;
const MAX_LOG_CHARS = 2000;

/** `logs` array, else `log` array. Cap length; clip oversized string lines. */
function coerceLogs(raw: Record<string, unknown>): unknown[] | undefined {
  const source = Array.isArray(raw.logs) ? raw.logs : Array.isArray(raw.log) ? raw.log : undefined;
  if (!source) return undefined;
  return source.slice(0, MAX_LOG_LINES).map((item) => {
    if (typeof item !== 'string' || item.length <= MAX_LOG_CHARS) return item;
    return item.slice(0, MAX_LOG_CHARS);
  });
}

/** Plain `profile`, else plain `meta.profile`. No synthetic line stats. */
function readProfile(raw: Record<string, unknown>): unknown {
  if (isPlainObject(raw.profile)) return raw.profile;
  if (isPlainObject(raw.meta) && isPlainObject(raw.meta.profile)) return raw.meta.profile;
  return undefined;
}

function coerceDiagnostics(raw: unknown, fallbackMessage?: string): EngineCompileDiagnostic[] {
  const out: EngineCompileDiagnostic[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry === 'string' && entry.trim()) {
        out.push({ message: entry.trim(), severity: 'error' });
        continue;
      }
      if (!isPlainObject(entry)) continue;
      const message = String(entry.message ?? entry.error ?? entry.msg ?? '').trim();
      if (!message) continue;
      const lineRaw = entry.line ?? entry.lineno ?? entry.row;
      const colRaw = entry.column ?? entry.col ?? entry.character;
      const line =
        typeof lineRaw === 'number' && Number.isFinite(lineRaw)
          ? Math.max(1, Math.floor(lineRaw))
          : undefined;
      const column =
        typeof colRaw === 'number' && Number.isFinite(colRaw)
          ? Math.max(0, Math.floor(colRaw))
          : undefined;
      const sev = String(entry.severity ?? entry.level ?? 'error').toLowerCase();
      const severity: EngineCompileDiagnostic['severity'] =
        sev === 'warning' || sev === 'warn'
          ? 'warning'
          : sev === 'info' || sev === 'hint'
            ? 'info'
            : 'error';
      out.push({ message, line, column, severity });
    }
  }
  if (out.length === 0 && fallbackMessage) {
    out.push({ message: fallbackMessage, severity: 'error' });
  }
  return out;
}

/** Map a loose Pro `/run` JSON body into a stable host result (never throws). */
export function mapEngineResponse(
  raw: unknown,
  opts?: { httpStatus?: number; ms?: number },
): EngineRunResult {
  try {
    const ms = opts?.ms;
    const httpStatus = opts?.httpStatus;
    if (!isPlainObject(raw)) {
      return {
        status: 'error',
        plots: [],
        series: {},
        events: [],
        error: 'Empty or invalid engine response',
        httpStatus,
        diagnostics: [{ message: 'Empty or invalid engine response', severity: 'error' }],
        raw,
        meta: { ms, transport: 'rest' },
      };
    }

    const explicitError =
      raw.status === 'error' || raw.status === 'failed' || raw.ok === false;
    const explicitSuccess = raw.status === 'success' || raw.status === 'ok';
    const message =
      typeof raw.message === 'string'
        ? raw.message
        : typeof raw.error === 'string'
          ? raw.error
          : raw.error != null
            ? String(raw.error)
            : undefined;
    const status: 'success' | 'error' = explicitError
      ? 'error'
      : explicitSuccess
        ? 'success'
        : message
          ? 'error'
          : 'success';

    const diagnostics = coerceDiagnostics(
      raw.errors ?? raw.diagnostics ?? raw.compile_errors,
      status === 'error' ? message : undefined,
    );

    const plots = Array.isArray(raw.plots) ? raw.plots : raw.plots ?? [];
    const series = coerceSeriesMap(raw.series);
    const events = Array.isArray(raw.events) ? raw.events : [];
    const code = typeof raw.code === 'string' ? raw.code : undefined;
    const logs = coerceLogs(raw);
    const profile = readProfile(raw);

    const result: EngineRunResult = {
      status,
      plots,
      series,
      events,
      diagnostics,
      raw,
      meta: { ms, transport: 'rest' },
      httpStatus,
    };
    if (logs !== undefined) result.logs = logs;
    if (profile !== undefined) result.meta.profile = profile;
    if (status === 'error') {
      result.error = message || code || `HTTP ${httpStatus ?? 'error'}`;
      if (code) result.code = code;
    }
    if (Array.isArray(raw.drawings)) result.drawings = raw.drawings;
    return attachRunEnvelope(result, raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      status: 'error',
      plots: [],
      series: {},
      events: [],
      error: msg,
      diagnostics: [{ message: msg, severity: 'error' }],
      httpStatus: opts?.httpStatus,
      meta: { ms: opts?.ms, transport: 'rest' },
    };
  }
}

function forceHttpError(
  mapped: EngineRunResult,
  parsed: unknown,
  httpStatus: number,
): EngineRunResult {
  if (mapped.status !== 'success') return mapped;
  const msg =
    mapped.error ||
    (isPlainObject(parsed) && typeof parsed.message === 'string'
      ? parsed.message
      : `HTTP ${httpStatus}`);
  return {
    ...mapped,
    status: 'error',
    error: msg,
    diagnostics:
      mapped.diagnostics.length > 0
        ? mapped.diagnostics
        : [{ message: msg, severity: 'error' }],
  };
}

/**
 * POST `{endpoint}/run` with script + bars. Never logs the API key.
 * A key is optional during open beta: absent → no Authorization / X-API-Key,
 * but every request carries `X-AXIS-Client: ide`. Present key → both Bearer
 * (Pro) and `X-API-Key` (worker self-host).
 */
export async function postEngineRun(req: EngineHttpRequest): Promise<EngineRunResult> {
  const t0 = Date.now();
  try {
    const endpoint = trimEndpoint(req.endpoint);
    if (!endpoint) {
      return {
        status: 'error',
        plots: [],
        series: {},
        events: [],
        error: MISSING_ENDPOINT_ERROR,
        diagnostics: [{ message: MISSING_ENDPOINT_ERROR, severity: 'error' }],
        meta: { transport: 'rest' },
      };
    }

    const key = typeof req.apiKey === 'string' ? req.apiKey.trim() : '';

    // Transport-level loopback gate (fail-closed): never send the Bearer key
    // to a remote host unless the caller explicitly opts in.
    if (req.allowRemote !== true && !isLoopbackEndpoint(endpoint)) {
      return {
        status: 'error',
        plots: [],
        series: {},
        events: [],
        error: ENGINE_REMOTE_DENIED,
        diagnostics: [{ message: ENGINE_REMOTE_DENIED, severity: 'error' }],
        meta: { transport: 'rest' },
      };
    }

    const fetchImpl = req.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const url = `${endpoint}/run`;
    const body = buildRunBody(req);
    const headers = withAxisClientHeader({
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}`, 'X-API-Key': key } : {}),
    });

    const timeoutMs =
      typeof req.timeoutMs === 'number' && Number.isFinite(req.timeoutMs)
        ? req.timeoutMs
        : ENGINE_RUN_TIMEOUT_MS;
    const signal = combineAbortSignals(req.signal, AbortSignal.timeout(timeoutMs));

    const postOnce = async (
      payload: Record<string, unknown>,
    ): Promise<{ ok: boolean; status: number; mapped: EngineRunResult; parsed: unknown }> => {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal,
      });
      const text = await res.text();
      const ms = Date.now() - t0;
      let parsed: unknown;
      try {
        parsed = text && text.trim() ? JSON.parse(text) : null;
      } catch {
        parsed = {
          status: 'error',
          code: 'INVALID_RESPONSE',
          message: `HTTP ${res.status}: non-JSON body`,
        };
      }
      let mapped = mapEngineResponse(parsed, { httpStatus: res.status, ms });
      if (!res.ok) mapped = forceHttpError(mapped, parsed, res.status);
      return { ok: res.ok, status: res.status, mapped, parsed };
    };

    let round = await postOnce(body);
    // Old Flask RUN_SCHEMA rejects `timeframe` with 400 UNKNOWN_FIELDS. Retry
    // once without it so :5002 keeps working until the schema lands.
    if (
      body.timeframe !== undefined &&
      !round.ok &&
      round.status === 400 &&
      isUnknownFields(round.mapped, round.parsed) &&
      !signal?.aborted
    ) {
      const retryBody = { ...body };
      delete retryBody.timeframe;
      round = await postOnce(retryBody);
    }
    return round.mapped;
  } catch (e) {
    const ms = Date.now() - t0;
    const msg = e instanceof Error ? e.message : String(e);
    const aborted =
      (e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError')) ||
      /aborted|timeout/i.test(msg);
    return {
      status: 'error',
      plots: [],
      series: {},
      events: [],
      error: aborted ? 'Aborted' : msg,
      diagnostics: [{ message: aborted ? 'Aborted' : msg, severity: 'error' }],
      meta: { ms, transport: 'rest' },
    };
  }
}
