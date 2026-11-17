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
import {
  DESK_ACTIONS,
  DESK_CONTAINER_ID,
  DESK_FOCUS_COMMAND,
  DESK_VIEW_ID,
  DeskSession,
  deskCommandIds,
  deskCsp,
  deskWebviewOptions,
  deskDataLabel,
  deskFromChartDoc,
  deskHeadline,
  deskRunLabel,
  deskStatusText,
  deskStatusTooltip,
  emptyDesk,
  engineDeskLabel,
  fileBaseName,
  renderDeskHtml,
} from './desk';

describe('desk session', () => {
  test('ids stay aligned with package.json', () => {
    expect(DESK_VIEW_ID).toBe('axis.desk');
    expect(DESK_FOCUS_COMMAND).toBe('axis.desk.focus');
    expect(DESK_CONTAINER_ID).toBe('axis');
  });

  test('empty desk is an idle AXIS with no chart', () => {
    const snap = emptyDesk();
    expect(snap.chartOpen).toBe(false);
    expect(snap.run).toBe('idle');
    expect(deskHeadline(snap)).toBe('No chart');
    expect(deskStatusText(snap)).toBe('AXIS');
    expect(deskStatusTooltip(snap)).toBe(
      'AXIS chart. No chart open. Engine Server. Click to open the AXIS side panel.',
    );
  });

  test('deskFromChartDoc trims fields and drops non-strings', () => {
    const chart = deskFromChartDoc(
      { symbol: ' BTC/USDT ', interval: 1, exchange: ' binance ', barsPath: '  ' },
      { useMockBars: true, chartOpen: true, scriptName: ' sma.pine ', engineLabel: '' },
    );
    expect(chart).toEqual({
      symbol: 'BTC/USDT',
      interval: '',
      exchange: 'binance',
      barsPath: '',
      useMockBars: true,
      datafeedSource: 'sidecar',
      chartOpen: true,
      scriptName: 'sma.pine',
      engineLabel: 'Server',
    });
    expect(
      deskFromChartDoc(
        {},
        { useMockBars: false, chartOpen: false, scriptName: '', engineLabel: 'Local' },
      ).chartOpen,
    ).toBe(false);
  });

  test('setChart keeps the run; setRun ignores duplicates and unknown states', () => {
    const session = new DeskSession();
    const seen: string[] = [];
    const stop = session.subscribe((snap) => {
      seen.push(snap.run);
    });
    session.setRun('running');
    session.setChart({
      ...emptyDesk(),
      symbol: 'ETH/USDT',
      interval: '1h',
      chartOpen: true,
      engineLabel: 'Local',
    });
    session.setChart({
      ...emptyDesk(),
      symbol: 'ETH/USDT',
      interval: '1h',
      chartOpen: true,
      engineLabel: 'Local',
    });
    expect(session.get().run).toBe('running');
    expect(session.get().symbol).toBe('ETH/USDT');
    session.setRun('running');
    session.setRun('nope');
    session.setRun('ok');
    stop();
    session.setRun('idle');
    expect(seen).toEqual(['running', 'running', 'ok']);
    expect(session.get().run).toBe('idle');
  });

  test('a throwing listener does not block the next one', () => {
    const session = new DeskSession();
    session.subscribe(() => {
      throw new Error('desk listener');
    });
    let got = '';
    session.subscribe((snap) => {
      got = snap.symbol;
    });
    session.setChart({ ...emptyDesk(), symbol: 'SOL/USDT' });
    expect(got).toBe('SOL/USDT');
  });
});

describe('desk labels', () => {
  test('status text follows the run', () => {
    const base = {
      ...emptyDesk(),
      symbol: 'BTC/USDT',
      interval: '1m',
      chartOpen: true,
    };
    expect(deskStatusText({ ...base, run: 'idle' })).toBe('BTC/USDT · 1m');
    expect(deskStatusText({ ...base, interval: '', run: 'idle' })).toBe('BTC/USDT');
    expect(deskStatusText({ ...base, run: 'running' })).toBe('$(sync~spin) BTC/USDT · 1m');
    expect(deskStatusText({ ...base, run: 'error' })).toBe('$(error) BTC/USDT · 1m');
    expect(deskStatusText({ ...base, run: 'stopped' })).toBe('$(debug-stop) BTC/USDT · 1m');
    expect(deskStatusText({ ...base, run: 'ok' })).toBe('$(check) BTC/USDT · 1m');
    expect(deskStatusText({ ...base, symbol: '   ', run: 'running' })).toBe('$(sync~spin) AXIS');
  });

  test('tooltip names the script and the data kind', () => {
    const snap = {
      ...emptyDesk(),
      symbol: 'BTC/USDT',
      interval: '',
      barsPath: 'fixtures/sample-bars.csv',
      chartOpen: true,
      scriptName: 'orb.pine',
      engineLabel: 'Pyodide',
    };
    expect(deskStatusTooltip(snap)).toBe(
      'AXIS chart. BTC/USDT · — · CSV. Script orb.pine. Engine Pyodide. Click to open the AXIS side panel.',
    );
    expect(deskStatusTooltip({ ...snap, engineLabel: '  ', scriptName: '' })).toContain(
      'Engine Server.',
    );
    expect(deskStatusTooltip({ ...snap, symbol: '', chartOpen: true })).toContain('No chart open');
  });

  test('data, engine, headline, and run labels', () => {
    expect(
      deskDataLabel({ barsPath: ' bars.csv ', useMockBars: true, datafeedSource: 'sidecar' }),
    ).toBe('CSV');
    expect(deskDataLabel({ barsPath: '', useMockBars: true, datafeedSource: 'sidecar' })).toBe(
      'Sample',
    );
    expect(deskDataLabel({ barsPath: '', useMockBars: false, datafeedSource: 'sidecar' })).toBe(
      'Local feed',
    );
    expect(deskDataLabel({ barsPath: '', useMockBars: false, datafeedSource: 'venue' })).toBe(
      'Venue',
    );
    expect(engineDeskLabel('local')).toBe('Local');
    expect(engineDeskLabel('pyodide')).toBe('Pyodide');
    expect(engineDeskLabel('server')).toBe('Server');
    expect(engineDeskLabel('auto')).toBe('Server');
    expect(deskHeadline({ ...emptyDesk(), chartOpen: true })).toBe('Chart');
    expect(deskHeadline({ ...emptyDesk(), symbol: 'X' })).toBe('X');
    expect(deskRunLabel('running')).toBe('Running');
    expect(deskRunLabel('error')).toBe('Run failed');
    expect(deskRunLabel('stopped')).toBe('Stopped');
    expect(deskRunLabel('ok')).toBe('Ran');
    expect(deskRunLabel('idle')).toBe('Ready');
    expect(fileBaseName('')).toBe('');
    expect(fileBaseName('sma.pine')).toBe('sma.pine');
    expect(fileBaseName('/work/examples/sma.pine')).toBe('sma.pine');
    expect(fileBaseName('C:\\work\\sma.pine')).toBe('sma.pine');
  });
});

describe('desk webview options', () => {
  test('command links are limited to the action allowlist', () => {
    const ids = deskCommandIds();
    expect(deskWebviewOptions()).toEqual({
      enableScripts: false,
      enableCommandUris: ids,
    });
    expect(ids).toEqual(DESK_ACTIONS.flatMap((group) => group.actions.map((action) => action.command)));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain('workbench.action.reloadWindow');
  });
});

describe('desk html', () => {
  test('paints the session and only allowlisted command links', () => {
    const html = renderDeskHtml({
      ...emptyDesk(),
      symbol: 'BTC<script>&USDT',
      interval: '1h',
      exchange: 'binance',
      chartOpen: true,
      scriptName: 'sma.pine',
      engineLabel: 'Local',
      run: 'running',
      useMockBars: false,
      datafeedSource: 'sidecar',
    }, 'desk');
    expect(html).toContain('BTC&lt;script&gt;&amp;USDT');
    expect(html).not.toContain('<script');
    expect(html).toContain(`content="${deskCsp('desk')}"`);
    expect(html).toContain("script-src 'none'");
    expect(html).toContain("style-src 'nonce-desk'");
    expect(html).toContain('nonce="desk"');
    expect(html).not.toContain('unsafe-inline');
    expect(deskCsp('a/b')).toContain("style-src 'nonce-ab'");
    expect(deskCsp('')).toContain("style-src 'nonce-axis'");
    expect(html).toContain('data-run="running"');
    expect(html).toContain('sma.pine');
    expect(html).toContain('Engine · Local');
    expect(html).toContain('1h · binance · Local feed');
    expect(html).toContain('class="btn__icon"');
    expect(html).toContain('class="pill__icon"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('class="btn__label">Run Script</span>');
    expect(html).toContain('class="btn__label">Open Chart</span>');
    const hrefs = [...html.matchAll(/href="command:([^"]+)"/g)].map((match) => match[1]);
    const allowed = DESK_ACTIONS.flatMap((group) => group.actions.map((action) => action.command));
    expect(hrefs).toEqual(allowed);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  test('closed chart explains the next step and escapes the engine label', () => {
    const html = renderDeskHtml({
      ...emptyDesk(),
      engineLabel: '<Local>',
    }, 'desk');
    expect(html).toContain('No chart');
    expect(html).toContain('Open a Pine script, then Open Chart.');
    expect(html).toContain('Engine · &lt;Local&gt;');
    expect(html).not.toContain('<p class="script">');
  });

  test('a symbol with a quote still shows the data line and a blank engine falls back', () => {
    const html = renderDeskHtml({
      ...emptyDesk(),
      chartOpen: true,
      useMockBars: true,
      engineLabel: '   ',
      symbol: 'A"B',
      run: 'ok',
    }, 'desk');
    expect(html).toContain('<h1>A&quot;B</h1>');
    expect(html).toContain('Sample');
    expect(html).toContain('Engine · Server');
    expect(html).toContain('data-run="ok"');
    expect(html).toContain('>Ran<');
  });
});
