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

import { describe, expect, test } from 'bun:test';
import { decode } from '../protocol/codec';
import { HOST_TO_VIEW, VIEW_TO_HOST } from '../protocol/types';
import type { ProfilerSnapshot } from '../run/profiler-store';
import type { ResultsSetPayload } from '../run/results-store';
import {
  EMPTY_RUN_HINT,
  EMPTY_RUN_TITLE,
  ERROR_RUN_HINT,
  NO_RUN_FOCUSED,
  NO_STRATEGY_HINT,
  NO_STRATEGY_REPORT,
  RUN_OUTPUT_STUDIO_VIEW,
  RUN_OUTPUT_TITLE,
  RUN_OUTPUT_VIEW_ID,
  STRATEGY_KPI_IDS,
  buildRunOutputCopyIdAction,
  buildRunOutputCopyLogTextAction,
  buildRunOutputCopyRunIdAction,
  buildRunOutputData,
  buildRunOutputFocusRunAction,
  buildRunOutputLogsTab,
  buildRunOutputProfilerTab,
  buildRunOutputRevealLogLineAction,
  buildRunOutputRevealProfilerLineAction,
  buildRunOutputSelectTabAction,
  buildRunOutputSetEnvelope,
  buildRunOutputStrategyTab,
  buildRunOutputSummaryTab,
  buildMetaChips,
  formatAbsoluteTime,
  formatNumber,
  formatRelativeTime,
  isPlainObject,
  isRunOutputTab,
  parseRunOutputCopyIdArgs,
  parseRunOutputCopyLogTextArgs,
  parseRunOutputCopyRunIdArgs,
  parseRunOutputFocusRunArgs,
  parseRunOutputRevealLogLineArgs,
  parseRunOutputRevealProfilerLineArgs,
  parseRunOutputSelectTabArgs,
  pickStrategyRows,
  runSummaryRows,
  splitStrategyKpis,
  statusOf,
  type RunOutputTab,
} from './run-output-messages';

const now = new Date('2026-01-15T12:00:00.000Z').getTime();

function makeResultsSet(overrides: {
  lastRun?: unknown;
  strategyReport?: unknown;
  focusId?: unknown;
} = {}): ResultsSetPayload {
  return {
    lastRun: overrides.lastRun ?? null,
    strategyReport: overrides.strategyReport ?? null,
    focusId: overrides.focusId ?? null,
  } as ResultsSetPayload;
}

function makeLastRun(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'run-1',
    status: 'success',
    engineId: 'engine-a',
    seriesKey: 'BTC/USDT:1m',
    plots: { p1: 1 },
    series: { s1: 2 },
    logs: ['log1'],
    diagnostics: [{ message: 'd' }],
    meta: { ms: 42, createdAt: now - 60_000, scriptName: 'script.pine' },
    ...overrides,
  };
}

const profilerSnapshot: ProfilerSnapshot = {
  runId: 'run-1',
  status: 'success',
  ms: 42,
  engineId: 'engine-a',
  seriesKey: 'BTC/USDT:1m',
  plotCount: 1,
  seriesCount: 1,
  createdAt: now,
  topLines: [{ line: 5, ms: 10, execs: 2, pct: 50 }],
  lineCount: 1,
};

describe('constants and guards', () => {
  test('exports the Run Output studio identifiers', () => {
    expect(RUN_OUTPUT_STUDIO_VIEW).toBe('runoutput');
    expect(RUN_OUTPUT_VIEW_ID).toBe('axis.runOutput');
    expect(RUN_OUTPUT_TITLE).toBe('Run Output');
    expect(STRATEGY_KPI_IDS).toEqual(['netprofit', 'winrate', 'trades', 'profitfactor', 'maxdd']);
  });

  test('isPlainObject rejects primitives and arrays', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject(1)).toBe(false);
    expect(isPlainObject('x')).toBe(false);
  });

  test('isRunOutputTab validates the four tab ids', () => {
    expect(isRunOutputTab('summary')).toBe(true);
    expect(isRunOutputTab('strategy')).toBe(true);
    expect(isRunOutputTab('profiler')).toBe(true);
    expect(isRunOutputTab('logs')).toBe(true);
    expect(isRunOutputTab('nope')).toBe(false);
    expect(isRunOutputTab(1)).toBe(false);
  });
});

describe('formatting helpers', () => {
  test('formatNumber covers precision branches', () => {
    expect(formatNumber(1)).toBe('1');
    expect(formatNumber(1234.5)).toBe('1234.50');
    expect(formatNumber(12.3456)).toBe('12.3456');
    expect(formatNumber(0.001234)).toMatch(/^0\.00123/);
    expect(formatNumber(Number.NaN)).toBe('NaN');
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('Infinity');
  });

  test('formatRelativeTime returns human-readable age', () => {
    expect(formatRelativeTime(now - 2_000, now)).toBe('just now');
    expect(formatRelativeTime(now - 15_000, now)).toBe('15s ago');
    expect(formatRelativeTime(now - 90_000, now)).toBe('2m ago');
    expect(formatRelativeTime(now - 3_600_000 * 2, now)).toBe('2h ago');
    expect(formatRelativeTime(now - 86_400_000 * 3, now)).toBe('3d ago');
    expect(formatRelativeTime(Number.NaN, now)).toBe('');
    expect(formatRelativeTime(now + 86_400_000, now)).toBe('');
  });

  test('formatAbsoluteTime', () => {
    expect(formatAbsoluteTime(now)).toContain('2026');
    expect(formatAbsoluteTime(Number.NaN)).toBe('');
  });
});

describe('strategy helpers', () => {
  test('pickStrategyRows recognizes aliases and formats', () => {
    const rows = pickStrategyRows({
      netprofit: 1500,
      winRate: 0.55,
      tradeCount: 30,
      maxDD: 0.12,
      unknown: 99,
    });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(byKey.netprofit?.value).toBe('1500');
    expect(byKey.winrate?.value).toBe('55%');
    expect(byKey.trades?.value).toBe('30');
    expect(byKey.maxdd?.value).toBe('12%');
    expect(byKey.unknown).toBeUndefined();
  });

  test('pickStrategyRows reads stats bag and lower-cased aliases', () => {
    const rows = pickStrategyRows({
      stats: { NET_PROFIT: 2000, WinRate: '0.6' },
      grossprofit: 3000,
    });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(byKey.netprofit?.value).toBe('2000');
    expect(byKey.winrate?.value).toBe('60%');
    expect(byKey.grossprofit?.value).toBe('3000');
  });

  test('pickStrategyRows ignores non-objects', () => {
    expect(pickStrategyRows(null)).toEqual([]);
    expect(pickStrategyRows('x')).toEqual([]);
  });

  test('splitStrategyKpis preserves KPI order', () => {
    const rows = [
      { key: 'trades', label: 'Trades', value: '30' },
      { key: 'netprofit', label: 'Net profit', value: '1500' },
      { key: 'wins', label: 'Wins', value: '20' },
    ];
    const { kpis, rest } = splitStrategyKpis(rows);
    expect(kpis.map((k) => k.key)).toEqual(['netprofit', 'trades']);
    expect(rest.map((k) => k.key)).toEqual(['wins']);
  });
});

describe('status and summary rows', () => {
  test('statusOf maps run records', () => {
    expect(statusOf(null)).toBe('idle');
    expect(statusOf({ status: 'success' })).toBe('success');
    expect(statusOf({ status: 'error' })).toBe('error');
    expect(statusOf({ error: 'boom' })).toBe('error');
    expect(statusOf({ status: 'pending' })).toBe('idle');
  });

  test('runSummaryRows builds the primary card', () => {
    const rows = runSummaryRows(makeLastRun());
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(byKey.id?.value).toBe('run-1');
    expect(byKey.script?.value).toBe('script.pine');
    expect(byKey.engine?.value).toBe('engine-a');
    expect(byKey.seriesKey?.value).toBe('BTC/USDT:1m');
    expect(byKey.ms?.value).toBe('42 ms');
    expect(byKey.plots?.value).toBe('1');
  });

  test('runSummaryRows appends an error row when present', () => {
    const rows = runSummaryRows(makeLastRun({ error: 'syntax error' }));
    expect(rows.some((r) => r.key === 'error' && r.value === 'syntax error')).toBe(true);
  });

  test('runSummaryRows returns empty for null', () => {
    expect(runSummaryRows(null)).toEqual([]);
  });

  test('meta chips tolerate malformed list fields', () => {
    const data = buildRunOutputData(
      makeResultsSet({ lastRun: makeLastRun({ logs: 'not-an-array', diagnostics: { x: 1 } }) }),
      profilerSnapshot,
      { now },
    );
    const chips = data.tabs.summary.metaChips;
    const logChip = chips.find((c) => c.key === 'logs');
    const diagChip = chips.find((c) => c.key === 'diags');
    expect(logChip?.label.toLowerCase()).toContain('log');
    expect(diagChip?.label.toLowerCase()).toContain('diag');
  });

  test('buildMetaChips counts artifacts', () => {
    const chips = buildMetaChips(makeLastRun());
    const byKey = Object.fromEntries(chips.map((c) => [c.key, c]));
    expect(byKey.ms?.value).toBe('42');
    expect(byKey.plots?.value).toBe('1');
    expect(byKey.series?.value).toBe('1');
    expect(byKey.logs?.value).toBe('1');
    expect(byKey.diags?.value).toBe('1');
    expect(buildMetaChips(null)).toEqual([]);
  });
});

describe('tab builders', () => {
  test('buildRunOutputSummaryTab for idle state', () => {
    const tab = buildRunOutputSummaryTab(makeResultsSet(), now);
    expect(tab.status).toBe('idle');
    expect(tab.rows).toEqual([]);
    expect(tab.emptyTitle).toBe(EMPTY_RUN_TITLE);
    expect(tab.emptyMessage).toBe(EMPTY_RUN_HINT);
    expect(tab.focusLine).toBe(NO_RUN_FOCUSED);
  });

  test('buildRunOutputSummaryTab for a successful run', () => {
    const tab = buildRunOutputSummaryTab(makeResultsSet({ lastRun: makeLastRun(), focusId: 'run-1' }), now);
    expect(tab.status).toBe('success');
    expect(tab.statusLabel).toBe('Success');
    expect(tab.runId).toBe('run-1');
    expect(tab.rows.length).toBeGreaterThan(0);
    expect(tab.metaChips.length).toBeGreaterThan(0);
    expect(tab.relativeTime).toBe('1m ago');
    expect(tab.focusLine).toBe('Focus: run-1');
  });

  test('buildRunOutputSummaryTab for an error run uses error hint', () => {
    const tab = buildRunOutputSummaryTab(makeResultsSet({ lastRun: makeLastRun({ status: 'error' }) }), now);
    expect(tab.status).toBe('error');
    expect(tab.emptyMessage).toBe(ERROR_RUN_HINT);
  });

  test('buildRunOutputStrategyTab with report and rows', () => {
    const tab = buildRunOutputStrategyTab({ netprofit: 100, winrate: 0.5, trades: 10, maxdd: 0.05 });
    expect(tab.hasReport).toBe(true);
    expect(tab.kpis.length).toBeGreaterThan(0);
    expect(tab.note).toBeNull();
  });

  test('buildRunOutputStrategyTab without report shows note', () => {
    const tab = buildRunOutputStrategyTab(null);
    expect(tab.hasReport).toBe(false);
    expect(tab.note).toContain(NO_STRATEGY_REPORT);
  });

  test('buildRunOutputProfilerTab preserves snapshot or falls back', () => {
    expect(buildRunOutputProfilerTab(profilerSnapshot)).toEqual(profilerSnapshot);
    const empty = buildRunOutputProfilerTab(null);
    expect(empty.runId).toBe('');
    expect(empty.status).toBe('error');
    expect(empty.topLines).toEqual([]);
  });

  test('buildRunOutputLogsTab reuses logsStudioData', () => {
    const tab = buildRunOutputLogsTab(makeLastRun());
    expect(tab.rows.length).toBeGreaterThan(0);
    expect(tab.runId).toBe('run-1');
  });
});

describe('composite data and envelopes', () => {
  test('buildRunOutputData assembles all tabs', () => {
    const data = buildRunOutputData(makeResultsSet({ lastRun: makeLastRun() }), profilerSnapshot, { now });
    expect(data.activeTab).toBe('summary');
    expect(data.tabs.summary.status).toBe('success');
    expect(data.tabs.strategy).toBeDefined();
    expect(data.tabs.profiler.runId).toBe('run-1');
    expect(data.tabs.logs.runId).toBe('run-1');
    expect(data.liveMessage).toBe('Success — run-1');
  });

  test('buildRunOutputSetEnvelope encodes a studio.set envelope', () => {
    const data = buildRunOutputData(makeResultsSet({ lastRun: makeLastRun() }), null, { now });
    const envelope = buildRunOutputSetEnvelope(data);
    expect(envelope.type).toBe(HOST_TO_VIEW.StudioSet);
    expect(envelope.payload.view).toBe(RUN_OUTPUT_STUDIO_VIEW);
    expect((envelope.payload as { data: unknown }).data).toEqual(data);
  });
});

describe('action argument validators', () => {
  test('parseRunOutputSelectTabArgs', () => {
    expect(parseRunOutputSelectTabArgs({ tab: 'profiler' })).toBe('profiler');
    expect(parseRunOutputSelectTabArgs({ tab: 'nope' })).toBeNull();
    expect(parseRunOutputSelectTabArgs(null)).toBeNull();
    expect(parseRunOutputSelectTabArgs({})).toBeNull();
  });

  test('parseRunOutputCopyIdArgs / focusRun / copyRunId', () => {
    expect(parseRunOutputCopyIdArgs({ runId: 'run-1 ' })).toBe('run-1');
    expect(parseRunOutputCopyIdArgs({ runId: '' })).toBeNull();
    expect(parseRunOutputFocusRunArgs({ runId: 4 })).toBeNull();
    expect(parseRunOutputCopyRunIdArgs({})).toBeNull();
  });

  test('parseRunOutputRevealProfilerLineArgs / revealLogLine', () => {
    expect(parseRunOutputRevealProfilerLineArgs({ line: 12 })).toBe(12);
    expect(parseRunOutputRevealProfilerLineArgs({ line: ' 8 ' })).toBe(8);
    expect(parseRunOutputRevealProfilerLineArgs({ line: 0 })).toBeNull();
    expect(parseRunOutputRevealLogLineArgs({ line: 5 })).toBe(5);
    expect(parseRunOutputRevealLogLineArgs({ line: 'nope' })).toBeNull();
  });

  test('parseRunOutputCopyLogTextArgs delegates to logs-messages', () => {
    expect(parseRunOutputCopyLogTextArgs({ text: 'hello' })).toBe('hello');
    expect(parseRunOutputCopyLogTextArgs({ text: '' })).toBeNull();
  });

  test('validators tolerate hostile proxy args', () => {
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('hostile');
        },
      },
    );
    expect(parseRunOutputSelectTabArgs(hostile)).toBeNull();
    expect(parseRunOutputCopyIdArgs(hostile)).toBeNull();
    expect(parseRunOutputRevealProfilerLineArgs(hostile)).toBeNull();
    expect(parseRunOutputCopyLogTextArgs(hostile)).toBeNull();
  });
});

describe('studio.action envelope dispatchers', () => {
  function actionOf(envelope: ReturnType<typeof buildRunOutputSelectTabAction>) {
    return {
      type: envelope.type,
      view: envelope.payload.view,
      action: envelope.payload.action,
      args: (envelope.payload as { args?: Record<string, unknown> }).args,
    };
  }

  test('buildRunOutputSelectTabAction', () => {
    const env = buildRunOutputSelectTabAction('logs');
    expect(actionOf(env)).toEqual({
      type: VIEW_TO_HOST.StudioAction,
      view: RUN_OUTPUT_STUDIO_VIEW,
      action: 'selectTab',
      args: { tab: 'logs' },
    });
  });

  test('copy / focus / reveal action envelopes', () => {
    expect(actionOf(buildRunOutputCopyIdAction('run-1 ')).args).toEqual({ runId: 'run-1' });
    expect(actionOf(buildRunOutputFocusRunAction('run-2')).args).toEqual({ runId: 'run-2' });
    expect(actionOf(buildRunOutputRevealProfilerLineAction(7)).args).toEqual({ line: 7 });
    expect(actionOf(buildRunOutputCopyRunIdAction('run-3')).args).toEqual({ runId: 'run-3' });
    expect(actionOf(buildRunOutputRevealLogLineAction(9)).args).toEqual({ line: 9 });
    expect(actionOf(buildRunOutputCopyLogTextAction('text')).args).toEqual({ text: 'text' });
  });

  test('envelopes round-trip through the shared codec', () => {
    const original = buildRunOutputSelectTabAction('strategy');
    const decoded = decode(original);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.envelope.type).toBe(VIEW_TO_HOST.StudioAction);
    expect(decoded.envelope.payload).toEqual({
      view: RUN_OUTPUT_STUDIO_VIEW,
      action: 'selectTab',
      args: { tab: 'strategy' },
    });
  });
});

describe('hostile / malformed payloads', () => {
  test('safeRead and safeKeys catch proxy traps', () => {
    const hostile = new Proxy(makeLastRun(), {
      get(target, prop) {
        if (prop === 'lastRun' || prop === 'meta' || prop === 'status') throw new Error('no');
        return Reflect.get(target, prop);
      },
    });
    const data = buildRunOutputData(
      makeResultsSet({ lastRun: hostile, strategyReport: { netprofit: 5 } }),
      profilerSnapshot,
      { now },
    );
    expect(data.tabs.summary.status).toBe('idle');
    expect(data.tabs.strategy.hasReport).toBe(true);

    const keysHostile = new Proxy(
      { a: 1 },
      {
        ownKeys() {
          throw new Error('keys');
        },
      },
    );
    const reportData = buildRunOutputData(
      makeResultsSet({ strategyReport: keysHostile }),
      profilerSnapshot,
      { now },
    );
    expect(reportData.tabs.strategy.hasReport).toBe(true);
  });

  test('buildRunOutputData with a proxy strategyReport', () => {
    const report = new Proxy(
      { netprofit: 10 },
      {
        get(target, prop) {
          if (prop === 'stats' || prop === 'NETPROFIT') throw new Error('no');
          return Reflect.get(target, prop);
        },
      },
    );
    const data = buildRunOutputData(makeResultsSet({ lastRun: null, strategyReport: report }), null, { now });
    expect(data.tabs.strategy.hasReport).toBe(true);
  });

  test('buildRunOutputData tolerates a proxy payload root', () => {
    const payload = new Proxy(
      {},
      {
        get() {
          throw new Error('root');
        },
      },
    );
    expect(() => buildRunOutputData(payload as ResultsSetPayload, null)).not.toThrow();
  });
});
