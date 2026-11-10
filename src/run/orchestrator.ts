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
 * RunOrchestrator — monotonic epoch + Pro `/run` on mock bars (PR-06).
 */

import type { OhlcvBar } from '../host/mock-bars';
import { PRO_KEY_ERROR, WORKER_KEY_ERROR } from '../secrets/slots';
import { type ValidateResult, validateProKey, validateWorkerKey } from '../secrets/validate';
import type { ChartNotifyMessage } from './chart-bus';
import {
  DEFAULT_ENGINE_ENDPOINT,
  type EngineCompileDiagnostic,
  type EngineRunResult,
  type FetchLike,
  type RunMode,
  mapEngineResponse,
  postEngineRun,
} from './engine-http';
import { scanPineLookahead } from '../host/lookahead';
import { formatPyodideRunBanner } from '../host/pyodide-profile';
import { declarePineInputs, evaluateMinimalSubset } from './pyodide-subset';
import { chartFullFromRunResult, withLookahead } from './run-envelope';
import { scrubSecrets } from './scrub';

export type { RunMode };

export interface RunRequest {
  script: string;
  uri?: string;
  mode: RunMode;
  focus: boolean;
  bars: OhlcvBar[];
  seriesKey: string;
  engineId: string;
  signal?: AbortSignal;
  /** Handshake / session seq — run paint must use seq > this (webview lastSeq gate). */
  baseSeq?: number;
  /** Optional symbol label for the Pro body (defaults from seriesKey). */
  symbol?: string;
  /** Optional `input.*` overrides (title → value). */
  inputs?: Record<string, unknown>;
  /** Worker-style timeframe (`1m`/`1h`/`1d`). Omitted when unset. */
  timeframe?: string;
  /** Inclusive envelope start. Omitted when unset. */
  fromBar?: number;
  /** Inclusive envelope end. Omitted when unset. */
  toBar?: number;
}

export const UNSUPPORTED_ENGINE_ERROR =
  'AXIS Run supports engine id "server" or "pyodide" (when axis.engine.allowPyodide) in this release (pyne-worker lands later).';

export const PYODIDE_DISABLED_ERROR =
  'AXIS Pyodide calculator is off. Set axis.engine.allowPyodide to true (Wasm loads from jsDelivr, not the VSIX).';

export interface RunSecrets {
  /** Resolve Pro (`pyn_…`) key. Never-throw. */
  getProKey(): Promise<string | undefined>;
  /** Resolve Worker (`pn_…`) key for self-hosted CF. Never-throw. */
  getWorkerKey(): Promise<string | undefined>;
}

export interface RunOutput {
  appendLine(line: string): void;
}

/** Minimal DiagnosticCollection surface (vscode-free for unit tests). */
export interface RunDiagnostic {
  message: string;
  severity: 'error' | 'warning' | 'info';
  line?: number;
  column?: number;
}

export interface RunDiagnostics {
  /** Clear diagnostics for one URI (empty set). Prefer over wiping the collection. */
  set(uri: string | undefined, items: RunDiagnostic[]): void;
}

export interface RunDeps {
  secrets: RunSecrets;
  /** Engine base URL (`axis.engine.endpoint`) — already gated by caller. */
  endpoint: string;
  /** `axis.engine.allowRemoteEndpoint` — re-asserted at the transport layer. */
  allowRemote?: boolean;
  /** Optional injectable fetch (tests). */
  fetchImpl?: FetchLike;
  /** When `engineId === 'pyodide'`, bars-in calculator (CDN Wasm). */
  pyodideAllowed?: boolean;
  runPyodide?: (req: {
    script: string;
    bars: OhlcvBar[];
    mode: RunMode;
    signal?: AbortSignal;
    inputs?: Record<string, unknown>;
  }) => Promise<EngineRunResult>;
  bus: {
    notifyChart(message: ChartNotifyMessage): void;
  };
  output: RunOutput;
  diagnostics: RunDiagnostics;
}

export type RunOutcome =
  | { ok: true; epoch: number; runId: string; result: EngineRunResult; seq: number }
  | {
      ok: false;
      epoch: number;
      reason: 'stale' | 'error' | 'aborted';
      error?: string;
      result?: EngineRunResult;
    };

function inputsMissing(raw: unknown): boolean {
  if (raw === undefined || raw === null) return true;
  if (Array.isArray(raw)) return raw.length === 0;
  if (typeof raw === 'object') return Object.keys(raw as Record<string, unknown>).length === 0;
  return false;
}

/** Fill the inputs form from source when the engine did not declare any. */
function ensureDeclaredInputs(
  result: EngineRunResult,
  script: string,
  overrides?: Record<string, unknown>,
): void {
  if (!inputsMissing(result.inputs)) return;
  // declarePineInputs never throws; an empty list leaves the engine payload alone.
  const declared = declarePineInputs(script, overrides);
  if (declared.length > 0) result.inputs = declared;
}

function symbolFromSeriesKey(seriesKey: string): string {
  const parts = String(seriesKey ?? '').split('|');
  const sym = parts.length >= 3 ? parts[2] : '';
  return sym && sym.trim() ? sym.trim() : 'CHART';
}

function toRunDiagnostics(items: EngineCompileDiagnostic[]): RunDiagnostic[] {
  return items.map((d) => ({
    message: scrubSecrets(d.message),
    severity: d.severity ?? 'error',
    line: d.line,
    column: d.column,
  }));
}

function combineSignals(a?: AbortSignal, b?: AbortSignal): AbortSignal | undefined {
  if (!a && !b) return undefined;
  if (a && !b) return a;
  if (!a && b) return b;
  if (a!.aborted || b!.aborted) {
    const c = new AbortController();
    c.abort();
    return c.signal;
  }
  const c = new AbortController();
  const onAbort = (): void => c.abort();
  a!.addEventListener('abort', onAbort, { once: true });
  b!.addEventListener('abort', onAbort, { once: true });
  return c.signal;
}

function safeLog(output: RunOutput, line: string): void {
  try {
    output.appendLine(scrubSecrets(line));
  } catch {
    // ignore
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Format one capped engine log item for the AXIS Run output channel. */
function formatEngineLogLine(item: unknown): string | undefined {
  if (typeof item === 'string') {
    const s = item.trim();
    return s || undefined;
  }
  if (!isPlainObject(item)) return undefined;
  const message = String(item.message ?? item.msg ?? item.text ?? '').trim();
  const rawLevel = String(item.level ?? item.severity ?? '').trim().toLowerCase();
  const level = rawLevel || 'info';
  if (message) return `log.${level} ${message}`;
  if (rawLevel) return `log.${level}`;
  return undefined;
}

function dumpEngineLogs(output: RunOutput, logs: unknown): void {
  if (!Array.isArray(logs)) return;
  for (const item of logs) {
    const line = formatEngineLogLine(item);
    if (line) safeLog(output, line);
  }
}

export class RunOrchestrator {
  private epoch = 0;
  private seq = 0;
  /** Aborts the previous in-flight fetch when a new run starts or abortAll(). */
  private inflight: AbortController | undefined;

  /** Current epoch (last started run). */
  get currentEpoch(): number {
    return this.epoch;
  }

  /** Last chart.full seq posted by a successful run. */
  get currentSeq(): number {
    return this.seq;
  }

  /** Abort any in-flight `/run` (deactivate / supersede). */
  abortAll(): void {
    this.inflight?.abort();
    this.inflight = undefined;
  }

  /**
   * Bump epoch, abort prior fetch, resolve optional Pro/Worker key, POST `/run`,
   * apply chart/diagnostics only when the epoch is still current.
   * Never logs secret material.
   */
  async run(req: RunRequest, deps: RunDeps): Promise<RunOutcome> {
    // Supersede any prior in-flight request (epoch bump + AbortSignal).
    this.inflight?.abort();
    const localAbort = new AbortController();
    this.inflight = localAbort;
    const signal = combineSignals(req.signal, localAbort.signal);

    const my = ++this.epoch;
    const started = Date.now();
    try {
      safeLog(
        deps.output,
        `run start epoch=${my} engine=${req.engineId} series=${req.seriesKey} bars=${req.bars.length} focus=${req.focus}`,
      );

      if (req.engineId === 'pyodide') {
        if (deps.pyodideAllowed !== true || typeof deps.runPyodide !== 'function') {
          const error = PYODIDE_DISABLED_ERROR;
          this.setDiags(deps, req.uri, [{ message: error, severity: 'error' }]);
          safeLog(deps.output, `run error epoch=${my}: ${error}`);
          return { ok: false, epoch: my, reason: 'error', error };
        }
        if (signal?.aborted) {
          safeLog(deps.output, `run aborted epoch=${my}`);
          return { ok: false, epoch: my, reason: 'aborted', error: 'Aborted' };
        }
        let result = await deps.runPyodide({
          script: req.script,
          bars: req.bars,
          mode: req.mode || 'auto',
          signal,
          inputs: req.inputs,
        });
        if (
          result.status === 'error' &&
          (result.errorKind === 'load' || result.errorKind === 'wheel')
        ) {
          const subset = evaluateMinimalSubset(req.script, req.bars, req.inputs);
          if (subset.status === 'success') {
            safeLog(
              deps.output,
              `pyodide unavailable (${result.errorKind}); engine=local-subset uploaded=0`,
            );
            const mapped = mapEngineResponse(subset, { ms: result.meta.ms });
            mapped.meta.fallback = 'local-subset';
            result = mapped;
          }
        }
        dumpEngineLogs(deps.output, result.logs);
        return this.finishRun(req, deps, my, started, result, signal);
      }

      if (req.engineId && req.engineId !== 'server') {
        const error = UNSUPPORTED_ENGINE_ERROR;
        this.setDiags(deps, req.uri, [{ message: error, severity: 'error' }]);
        safeLog(deps.output, `run error epoch=${my}: ${error}`);
        return { ok: false, epoch: my, reason: 'error', error };
      }

      if (signal?.aborted) {
        safeLog(deps.output, `run aborted epoch=${my}`);
        return { ok: false, epoch: my, reason: 'aborted', error: 'Aborted' };
      }

      const rawPro = await deps.secrets.getProKey();
      const rawWorker = await deps.secrets.getWorkerKey();
      if (my !== this.epoch) {
        safeLog(deps.output, `drop stale epoch ${my}`);
        return { ok: false, epoch: my, reason: 'stale' };
      }
      // Open beta: an absent key is not an error — the run goes out with
      // X-AXIS-Client: ide and no Authorization header. A present-but-malformed
      // key is still a user error and must not be silently dropped.
      // Prefer a Worker key when both are set (self-hosted CF).
      const workerKey = typeof rawWorker === 'string' ? rawWorker.trim() : '';
      const proKey = typeof rawPro === 'string' ? rawPro.trim() : '';
      if (workerKey) {
        const checked: ValidateResult = validateWorkerKey(workerKey);
        if (!checked.ok) {
          const error = WORKER_KEY_ERROR;
          this.setDiags(deps, req.uri, [{ message: error, severity: 'error' }]);
          safeLog(deps.output, `run error epoch=${my}: ${error}`);
          return { ok: false, epoch: my, reason: 'error', error };
        }
      } else if (proKey) {
        const checked: ValidateResult = validateProKey(proKey);
        if (!checked.ok) {
          const error = PRO_KEY_ERROR;
          this.setDiags(deps, req.uri, [{ message: error, severity: 'error' }]);
          safeLog(deps.output, `run error epoch=${my}: ${error}`);
          return { ok: false, epoch: my, reason: 'error', error };
        }
      }
      const apiKey = workerKey || proKey || undefined;

      const endpoint = String(deps.endpoint ?? '').trim() || DEFAULT_ENGINE_ENDPOINT;
      const result = await postEngineRun({
        endpoint,
        script: req.script,
        bars: req.bars,
        mode: req.mode || 'auto',
        symbol: req.symbol || symbolFromSeriesKey(req.seriesKey),
        apiKey,
        allowRemote: deps.allowRemote,
        signal,
        fetchImpl: deps.fetchImpl,
        inputs: req.inputs,
        timeframe: req.timeframe,
        fromBar: req.fromBar,
        toBar: req.toBar,
      });
      dumpEngineLogs(deps.output, result.logs);
      return this.finishRun(req, deps, my, started, result, signal);
    } catch (e) {
      if (my !== this.epoch) {
        safeLog(deps.output, `drop stale epoch ${my}`);
        return { ok: false, epoch: my, reason: 'stale' };
      }
      const error = scrubSecrets(e instanceof Error ? e.message : String(e));
      safeLog(deps.output, `run error epoch=${my}: ${error}`);
      this.setDiags(deps, req.uri, [{ message: error, severity: 'error' }]);
      return { ok: false, epoch: my, reason: 'error', error };
    } finally {
      if (this.inflight === localAbort) this.inflight = undefined;
      // Abort the local controller so combineSignals' listener registrations
      // release promptly instead of lingering until the next run / deactivate.
      // `AbortController.abort()` is specified to never throw.
      localAbort.abort();
    }
  }

  private finishRun(
    req: RunRequest,
    deps: RunDeps,
    my: number,
    started: number,
    result: EngineRunResult,
    signal?: AbortSignal,
  ): RunOutcome {
    if (my !== this.epoch) {
      safeLog(deps.output, `drop stale epoch ${my}`);
      return { ok: false, epoch: my, reason: 'stale', result };
    }

    if (signal?.aborted) {
      safeLog(deps.output, `run aborted epoch=${my}`);
      return { ok: false, epoch: my, reason: 'aborted', error: 'Aborted', result };
    }

    const ms = result.meta.ms ?? Date.now() - started;
    const scrubbedError = result.error ? scrubSecrets(result.error) : undefined;

    if (result.status === 'error') {
      const diags = toRunDiagnostics(result.diagnostics);
      this.setDiags(
        deps,
        req.uri,
        diags.length > 0
          ? diags
          : [{ message: scrubbedError || 'Engine error', severity: 'error' }],
      );
      safeLog(
        deps.output,
        `run error epoch=${my} ms=${Math.round(ms)} ${result.code ? `code=${result.code} ` : ''}${result.errorKind ? `kind=${result.errorKind} ` : ''}${scrubbedError ?? ''}`.trim(),
      );
      return { ok: false, epoch: my, reason: 'error', error: scrubbedError, result };
    }

    this.setDiags(deps, req.uri, []);
    const base = typeof req.baseSeq === 'number' && Number.isFinite(req.baseSeq) ? req.baseSeq : 0;
    const nextSeq = Math.max(this.seq, base) + 1;
    this.seq = nextSeq;
    ensureDeclaredInputs(result, req.script, req.inputs);
    const full = withLookahead(
      chartFullFromRunResult(result, req.bars, nextSeq),
      scanPineLookahead(req.script),
    );
    deps.bus.notifyChart({
      type: 'chart.full',
      payload: full,
      seriesKey: req.seriesKey,
    });

    const runId = `run-${my}`;
    if (req.engineId === 'pyodide') {
      if (result.meta?.fallback === 'local-subset') {
        safeLog(deps.output, 'engine=local-subset uploaded=0');
      } else {
        const wheel =
          typeof result.meta?.wheel === 'string' && result.meta.wheel.trim()
            ? result.meta.wheel.trim()
            : 'hoox_pyne';
        safeLog(deps.output, formatPyodideRunBanner(wheel));
      }
    }
    safeLog(deps.output, `run ok epoch=${my} ms=${Math.round(ms)} runId=${runId} seq=${nextSeq}`);
    return { ok: true, epoch: my, runId, result, seq: nextSeq };
  }

  private setDiags(
    deps: RunDeps,
    uri: string | undefined,
    items: RunDiagnostic[],
  ): void {
    try {
      deps.diagnostics.set(uri, items);
    } catch {
      // ignore
    }
  }
}
