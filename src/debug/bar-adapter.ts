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
 * AXIS bar debugger — DAP type `axis-bar` (never `pyne`).
 * Bar-step + chart-bar breakpoints + series/na variables. VS Code-free.
 */

export const AXIS_BAR_DAP_TYPE = 'axis-bar';

export const AXIS_BAR_THREAD_ID = 1;
const BAR_SCOPE_REF = 1000;
const SERIES_SCOPE_REF = 2000;

export type DapRequest = {
  seq: number;
  type: 'request';
  command: string;
  arguments?: unknown;
};

export type DapResponse = {
  seq: number;
  type: 'response';
  request_seq: number;
  success: boolean;
  command: string;
  message?: string;
  body?: unknown;
};

export type DapEvent = {
  seq: number;
  type: 'event';
  event: string;
  body?: unknown;
};

export type DapMessage = DapResponse | DapEvent;

export type AxisBarOhlcv = {
  time?: number;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
};

export type AxisBarLaunch = {
  bars: AxisBarOhlcv[];
  series?: Record<string, (number | null)[]>;
  program?: string;
  stopOnEntry?: boolean;
};

export type AxisBarCursorListener = (barIndex: number, reason: string) => void;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finiteInt(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.trunc(value);
}

/** Pine na display — never JS `null`. */
export function formatPineValue(value: unknown): string {
  if (value === null || value === undefined) return 'na';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'na';
    return String(value);
  }
  return String(value);
}

function clampBar(index: number, count: number): number {
  if (count <= 0) return 0;
  if (index < 0) return 0;
  if (index >= count) return count - 1;
  return index;
}

export class AxisBarDebugSession {
  private seq = 1;
  private barIndex = 0;
  private bars: AxisBarOhlcv[] = [];
  private series: Record<string, (number | null)[]> = {};
  private barBreakpoints = new Set<number>();
  private program: string | undefined;
  private readonly onCursor: AxisBarCursorListener | undefined;

  constructor(onCursor?: AxisBarCursorListener) {
    this.onCursor = onCursor;
  }

  get currentBar(): number {
    return this.barIndex;
  }

  get barCount(): number {
    return this.bars.length;
  }

  /** Jump the session to a bar (strategy-table click / live seek). */
  seekToBar(index: number, reason = 'goto'): DapMessage[] {
    const count = this.bars.length;
    this.barIndex = clampBar(typeof index === 'number' ? Math.trunc(index) : 0, count);
    return [this.stopped(reason)];
  }

  /** Chart click / command: toggle a bar-index breakpoint. */
  toggleBarBreakpoint(index: number): boolean {
    const i = finiteInt(index);
    if (i === undefined || i < 0) return false;
    if (this.barBreakpoints.has(i)) {
      this.barBreakpoints.delete(i);
      return false;
    }
    this.barBreakpoints.add(i);
    return true;
  }

  barBreakpointSet(): number[] {
    return [...this.barBreakpoints].sort((a, b) => a - b);
  }

  handle(raw: unknown): DapMessage[] {
    if (!isPlainObject(raw) || raw.type !== 'request' || typeof raw.command !== 'string') {
      return [];
    }
    const req = raw as DapRequest;
    const cmd = req.command;
    if (cmd === 'initialize') return this.initialize(req);
    if (cmd === 'launch') return this.launch(req);
    if (cmd === 'setBreakpoints') return this.setBreakpoints(req);
    if (cmd === 'configurationDone') return this.ok(req, {});
    if (cmd === 'threads') {
      return this.ok(req, { threads: [{ id: AXIS_BAR_THREAD_ID, name: 'Bars' }] });
    }
    if (cmd === 'stackTrace') return this.stackTrace(req);
    if (cmd === 'scopes') return this.scopes(req);
    if (cmd === 'variables') return this.variables(req);
    if (cmd === 'next' || cmd === 'stepIn' || cmd === 'stepOut') return this.step(req, 1);
    if (cmd === 'stepBack') return this.step(req, -1);
    if (cmd === 'continue') return this.continueRun(req);
    if (cmd === 'pause') return this.pause(req);
    if (cmd === 'disconnect' || cmd === 'terminate') {
      return this.ok(req, {});
    }
    return this.fail(req, `unsupported DAP command ${cmd}`);
  }

  private nextSeq(): number {
    return this.seq++;
  }

  private ok(req: DapRequest, body: unknown): DapResponse[] {
    return [
      {
        seq: this.nextSeq(),
        type: 'response',
        request_seq: req.seq,
        success: true,
        command: req.command,
        body,
      },
    ];
  }

  private fail(req: DapRequest, message: string): DapResponse[] {
    return [
      {
        seq: this.nextSeq(),
        type: 'response',
        request_seq: req.seq,
        success: false,
        command: req.command,
        message,
      },
    ];
  }

  /** "Bar 3 of 120" — a candle, not a source line. */
  private barCaption(): string {
    const count = this.bars.length;
    if (count <= 0) return 'No bars';
    return `Bar ${this.barIndex + 1} of ${count}`;
  }

  private hint(text: string): DapEvent {
    return {
      seq: this.nextSeq(),
      type: 'event',
      event: 'output',
      body: { category: 'console', output: `${text}\n` },
    };
  }

  private stopped(reason: string): DapEvent {
    this.emitCursor(reason);
    return {
      seq: this.nextSeq(),
      type: 'event',
      event: 'stopped',
      body: {
        reason,
        description: this.barCaption(),
        text: 'Step moves one bar.',
        threadId: AXIS_BAR_THREAD_ID,
        allThreadsStopped: true,
      },
    };
  }

  private emitCursor(reason: string): void {
    try {
      this.onCursor?.(this.barIndex, reason);
    } catch {
      // listeners must not break DAP
    }
  }

  private initialize(req: DapRequest): DapMessage[] {
    return [
      ...this.ok(req, {
        supportsConfigurationDoneRequest: true,
        supportsStepBack: true,
        supportsTerminateRequest: true,
      }),
      {
        seq: this.nextSeq(),
        type: 'event',
        event: 'initialized',
        body: {},
      },
    ];
  }

  private launch(req: DapRequest): DapMessage[] {
    const args = isPlainObject(req.arguments) ? req.arguments : {};
    const bars = Array.isArray(args.bars) ? (args.bars as AxisBarOhlcv[]) : [];
    this.bars = bars.filter((b) => b && typeof b === 'object');
    this.series = isPlainObject(args.series) ? (args.series as Record<string, (number | null)[]>) : {};
    const program = typeof args.program === 'string' ? args.program.trim() : '';
    this.program = program && !/[\r\n]/.test(program) ? program : undefined;
    this.barIndex = 0;
    const stopOnEntry = args.stopOnEntry !== false;
    const hint =
      this.bars.length > 0
        ? `${this.barCaption()}. Step moves one bar. Not a source-line debugger.`
        : 'No bars yet. Run the script, then Start. Step moves one bar.';
    const out: DapMessage[] = [...this.ok(req, {}), this.hint(hint)];
    if (stopOnEntry) out.push(this.stopped('entry'));
    return out;
  }

  private setBreakpoints(req: DapRequest): DapMessage[] {
    const args = isPlainObject(req.arguments) ? req.arguments : {};
    const raw = Array.isArray(args.breakpoints) ? args.breakpoints : [];
    const verified: Array<{ line: number; verified: boolean; message?: string }> = [];
    for (const bp of raw) {
      if (!isPlainObject(bp)) continue;
      const line = finiteInt(bp.line);
      if (line === undefined || line < 1) continue;
      verified.push({
        line,
        verified: false,
        message: 'AXIS steps bars, not source lines. Use AXIS: Toggle Bar Breakpoint.',
      });
    }
    return this.ok(req, { breakpoints: verified });
  }

  private stackSource(): { name: string; path?: string; presentationHint?: 'deemphasize' } {
    const program = this.program;
    if (!program) return { name: 'bars', presentationHint: 'deemphasize' };
    const name = program.split(/[/\\]/).pop() || 'script';
    return { name, path: program };
  }

  private stackTrace(req: DapRequest): DapMessage[] {
    return this.ok(req, {
      stackFrames: [
        {
          id: 1,
          name: this.barCaption(),
          line: 1,
          column: 1,
          source: this.stackSource(),
        },
      ],
      totalFrames: 1,
    });
  }

  private scopes(req: DapRequest): DapMessage[] {
    return this.ok(req, {
      scopes: [
        { name: 'Bar', variablesReference: BAR_SCOPE_REF, expensive: false },
        { name: 'Series', variablesReference: SERIES_SCOPE_REF, expensive: false },
      ],
    });
  }

  private variables(req: DapRequest): DapMessage[] {
    const args = isPlainObject(req.arguments) ? req.arguments : {};
    const ref = finiteInt(args.variablesReference) ?? 0;
    if (ref === BAR_SCOPE_REF) {
      const bar = this.bars[this.barIndex] ?? {};
      const names: Array<keyof AxisBarOhlcv> = ['time', 'open', 'high', 'low', 'close', 'volume'];
      return this.ok(req, {
        variables: [
          { name: 'bar_index', value: String(this.barIndex), variablesReference: 0 },
          ...names.map((name) => ({
            name,
            value: formatPineValue(bar[name]),
            variablesReference: 0,
          })),
        ],
      });
    }
    if (ref === SERIES_SCOPE_REF) {
      const vars = Object.entries(this.series).map(([name, col]) => {
        const v = Array.isArray(col) ? col[this.barIndex] : null;
        return { name, value: formatPineValue(v ?? null), variablesReference: 0 };
      });
      return this.ok(req, { variables: vars });
    }
    return this.ok(req, { variables: [] });
  }

  private step(req: DapRequest, delta: number): DapMessage[] {
    const count = this.bars.length;
    if (count <= 0) return [...this.ok(req, {}), this.stopped('entry')];
    this.barIndex = clampBar(this.barIndex + delta, count);
    return [...this.ok(req, {}), this.stopped('step')];
  }

  private continueRun(req: DapRequest): DapMessage[] {
    const count = this.bars.length;
    if (count <= 0) return [...this.ok(req, {}), this.stopped('entry')];
    const start = this.barIndex + 1;
    for (let i = start; i < count; i++) {
      if (this.shouldBreak(i)) {
        this.barIndex = i;
        return [...this.ok(req, { allThreadsContinued: true }), this.stopped('breakpoint')];
      }
    }
    this.barIndex = count - 1;
    return [...this.ok(req, { allThreadsContinued: true }), this.stopped('end')];
  }

  private pause(req: DapRequest): DapMessage[] {
    return [...this.ok(req, {}), this.stopped('pause')];
  }

  private shouldBreak(index: number): boolean {
    return this.barBreakpoints.has(index);
  }
}
