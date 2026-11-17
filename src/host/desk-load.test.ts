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
import { DeskSession, emptyDeskChart } from './desk';
import {
  type DeskTabGroup,
  findChartUri,
  loadDeskChartState,
  refreshDeskSnapshot,
} from './desk-load';

const CHART = 'axis.chart';

describe('findChartUri', () => {
  test('prefers the active chart tab over an earlier json file and a later group', () => {
    const groups: DeskTabGroup<string>[] = [
      {
        activeIndex: 1,
        tabs: [
          { kind: 'text', fsPath: '/work/first.axis.json', uri: 'json-1' },
          { kind: 'custom', viewType: CHART, uri: 'chart-active' },
          { kind: 'other' },
        ],
      },
      {
        tabs: [{ kind: 'custom', viewType: CHART, uri: 'chart-other-group' }],
      },
    ];
    expect(findChartUri(groups, CHART)).toBe('chart-active');
  });

  test('falls through to a json text tab and ignores other files', () => {
    const groups: DeskTabGroup<string>[] = [
      {
        activeIndex: 5,
        tabs: [
          { kind: 'other' },
          { kind: 'custom', viewType: 'other.view', uri: 'nope' },
          { kind: 'text', fsPath: '/work/notes.md', uri: 'md' },
          { kind: 'text', fsPath: '/work/Chart.AXIS.JSON', uri: 'json' },
        ],
      },
    ];
    expect(findChartUri(groups, CHART)).toBe('json');
    expect(findChartUri([], CHART)).toBeUndefined();
    expect(
      findChartUri(
        [
          { tabs: [{ kind: 'other' }] },
          { tabs: [{ kind: 'text', fsPath: 'a.axis.json', uri: 'a' }] },
        ],
        CHART,
      ),
    ).toBe('a');
  });
});

describe('loadDeskChartState', () => {
  test('no uri is a closed chart', async () => {
    const chart = await loadDeskChartState({
      scriptName: 'sma.pine',
      engineLabel: 'Local',
      useMockBars: true,
      uri: undefined,
      readText: async () => '{}',
      parse: () => ({ ok: false }),
    });
    expect(chart.chartOpen).toBe(false);
    expect(chart.scriptName).toBe('sma.pine');
    expect(chart.engineLabel).toBe('Local');
    expect(chart.useMockBars).toBe(true);
  });

  test('an unreadable or invalid document still counts as open', async () => {
    const missing = await loadDeskChartState({
      scriptName: 'sma.pine',
      engineLabel: 'Server',
      useMockBars: false,
      uri: 'file',
      readText: async () => undefined,
      parse: () => ({ ok: true, doc: { symbol: 'NO' } }),
    });
    expect(missing.chartOpen).toBe(true);
    expect(missing.symbol).toBe('');
    const invalid = await loadDeskChartState({
      scriptName: 'sma.pine',
      engineLabel: 'Server',
      useMockBars: false,
      uri: 'file',
      readText: async () => '{',
      parse: () => ({ ok: false }),
    });
    expect(invalid.chartOpen).toBe(true);
    expect(invalid.symbol).toBe('');
  });

  test('a parsed document fills the desk fields', async () => {
    const chart = await loadDeskChartState({
      scriptName: 'sma.pine',
      engineLabel: 'Pyodide',
      useMockBars: false,
      uri: 'file',
      readText: async () => '{"symbol":"ETH/USDT"}',
      parse: () => ({
        ok: true,
        doc: { symbol: 'ETH/USDT', interval: '1h', exchange: 'binance', barsPath: 'bars.csv' },
      }),
    });
    expect(chart).toMatchObject({
      symbol: 'ETH/USDT',
      interval: '1h',
      exchange: 'binance',
      barsPath: 'bars.csv',
      chartOpen: true,
      scriptName: 'sma.pine',
      engineLabel: 'Pyodide',
    });
  });
});

describe('refreshDeskSnapshot', () => {
  test('does nothing without a session or after shutdown', async () => {
    let loads = 0;
    await refreshDeskSnapshot({
      getSession: () => undefined,
      deactivated: () => false,
      bump: () => 1,
      current: () => 1,
      scriptName: () => 'a',
      load: async () => {
        loads += 1;
        return emptyDeskChart();
      },
      engineLabel: () => 'Server',
    });
    const session = new DeskSession();
    await refreshDeskSnapshot({
      getSession: () => session,
      deactivated: () => true,
      bump: () => 1,
      current: () => 1,
      scriptName: () => 'a',
      load: async () => {
        loads += 1;
        return emptyDeskChart();
      },
      engineLabel: () => 'Server',
    });
    expect(loads).toBe(0);
    expect(session.get().symbol).toBe('');
  });

  test('publishes a loaded chart and a fallback when load throws', async () => {
    const session = new DeskSession();
    let gen = 0;
    await refreshDeskSnapshot({
      getSession: () => session,
      deactivated: () => false,
      bump: () => ++gen,
      current: () => gen,
      scriptName: () => 'sma.pine',
      load: async () => ({ ...emptyDeskChart(), symbol: 'BTC/USDT', scriptName: 'sma.pine' }),
      engineLabel: () => 'Server',
    });
    expect(session.get().symbol).toBe('BTC/USDT');
    await refreshDeskSnapshot({
      getSession: () => session,
      deactivated: () => false,
      bump: () => ++gen,
      current: () => gen,
      scriptName: () => 'orb.pine',
      load: async () => {
        throw new Error('read failed');
      },
      engineLabel: () => 'Local',
    });
    expect(session.get().symbol).toBe('');
    expect(session.get().scriptName).toBe('orb.pine');
    expect(session.get().engineLabel).toBe('Local');
  });

  test('drops a stale generation, a shutdown, and a replaced session', async () => {
    const first = new DeskSession();
    const second = new DeskSession();
    let gen = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const stale = refreshDeskSnapshot({
      getSession: () => first,
      deactivated: () => false,
      bump: () => ++gen,
      current: () => gen,
      scriptName: () => 'old',
      load: async () => {
        await gate;
        return { ...emptyDeskChart(), symbol: 'OLD' };
      },
      engineLabel: () => 'Server',
    });
    const fresh = refreshDeskSnapshot({
      getSession: () => first,
      deactivated: () => false,
      bump: () => ++gen,
      current: () => gen,
      scriptName: () => 'new',
      load: async () => ({ ...emptyDeskChart(), symbol: 'NEW' }),
      engineLabel: () => 'Server',
    });
    release();
    await stale;
    await fresh;
    expect(first.get().symbol).toBe('NEW');

    let down = false;
    await refreshDeskSnapshot({
      getSession: () => first,
      deactivated: () => down,
      bump: () => ++gen,
      current: () => gen,
      scriptName: () => 'gone',
      load: async () => {
        down = true;
        return { ...emptyDeskChart(), symbol: 'LATE' };
      },
      engineLabel: () => 'Server',
    });
    expect(first.get().symbol).toBe('NEW');

    let current = first;
    await refreshDeskSnapshot({
      getSession: () => current,
      deactivated: () => false,
      bump: () => ++gen,
      current: () => gen,
      scriptName: () => 'swap',
      load: async () => {
        current = second;
        return { ...emptyDeskChart(), symbol: 'SWAP' };
      },
      engineLabel: () => 'Server',
    });
    expect(first.get().symbol).toBe('NEW');
    expect(second.get().symbol).toBe('');
  });
});
