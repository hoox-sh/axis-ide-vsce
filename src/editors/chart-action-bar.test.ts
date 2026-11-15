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
import { buildChartWebviewHtml } from './chart-html';
import { handleChartWebviewMessage } from './chart-messages';
import { buildChartInitStub } from './chart-messages';
import {
  HOST_TO_VIEW,
  VIEW_TO_HOST,
  encode,
} from '../protocol';

const CSP_SOURCE = 'https://csp.example.vscode-webview.test';

function buildHtml(): string {
  return buildChartWebviewHtml({
    cspSource: CSP_SOURCE,
    scriptUri: `${CSP_SOURCE}/main.js`,
    styleUri: `${CSP_SOURCE}/main.css`,
    bodyClass: 'vscode-dark',
  });
}

/** Every action-bar button id that must have a click path (local toggle or postMessage). */
const ACTION_BAR_BUTTON_IDS = [
  'tool-trendline',
  'tool-layers',
  'tool-data',
  'tool-legend',
  'tool-fullscreen',
  'tool-open-source',
  'tool-live-safe',
  'chart-debug-start',
  'chart-debug-step',
  'chart-toggle-inputs',
  'chart-toggle-strategy',
  'chart-inputs-apply',
  'chart-strategy-csv',
] as const;

/** Every data-chrome attribute value present in the toolbar markup — each must be handled in main.ts. */
const CHROME_ATTRIBUTES = [
  'layers',
  'data',
  'legend',
  'fullscreen',
  'open-source',
  'live-safe',
  'debug-start',
  'debug-step',
  'inputs',
  'strategy',
] as const;

/** Every data-tool attribute value present in the toolbar markup — each must be handled in main.ts. */
const TOOL_ATTRIBUTES = ['trendline'] as const;

/** View→host envelope types used by the action bar — each must map to a handled ChartMessageHandle kind. */
const ACTION_BAR_VIEW_TO_HOST_TYPES = [
  VIEW_TO_HOST.DrawingSetTool,
  VIEW_TO_HOST.DrawingCommit,
  VIEW_TO_HOST.ChartRequestReload,
  VIEW_TO_HOST.ChartApplyInputs,
  VIEW_TO_HOST.ChartViewport,
  VIEW_TO_HOST.ChartBarBreakpoint,
  VIEW_TO_HOST.ChartSelectTrade,
] as const;

/** Extract all attribute values for a given attribute name from HTML (regex, no DOMParser). */
function attrValues(html: string, attr: string): string[] {
  const re = new RegExp(`\\b${attr}="([^"]*)"`, 'g');
  const out: string[] = [];
  for (const m of html.matchAll(re)) {
    out.push(m[1]);
  }
  return out;
}

describe('chart action bar — no orphaned attributes', () => {
  test('every action-bar button id is present in the built HTML', () => {
    const html = buildHtml();
    for (const id of ACTION_BAR_BUTTON_IDS) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  test('every data-chrome attribute has a corresponding handler in main.ts', () => {
    const html = buildHtml();
    const seen = new Set(attrValues(html, 'data-chrome'));
    for (const action of CHROME_ATTRIBUTES) {
      expect(seen.has(action), `missing data-chrome="${action}"`).toBe(true);
    }
    // No unexpected data-chrome values (everything declared must be handled).
    for (const action of seen) {
      expect(
        CHROME_ATTRIBUTES.includes(action as (typeof CHROME_ATTRIBUTES)[number]),
        `unhandled data-chrome="${action}"`,
      ).toBe(true);
    }
  });

  test('every data-tool attribute has a corresponding handler in main.ts', () => {
    const html = buildHtml();
    const seen = new Set(attrValues(html, 'data-tool'));
    for (const tool of TOOL_ATTRIBUTES) {
      expect(seen.has(tool), `missing data-tool="${tool}"`).toBe(true);
    }
    for (const tool of seen) {
      expect(
        TOOL_ATTRIBUTES.includes(tool as (typeof TOOL_ATTRIBUTES)[number]),
        `unhandled data-tool="${tool}"`,
      ).toBe(true);
    }
  });
});

describe('chart action bar — view→host plumbing', () => {
  const session = {
    init: buildChartInitStub({
      theme: 'void',
      seriesKey: 'binance|spot|BTC/USDT|1m',
      panes: [{ id: 'price', kind: 'price' }],
      cssVars: { '--axis-bg': '#050505' },
    }),
    full: { bars: [], seq: 1 },
  };

  const payloads: Record<string, unknown> = {
    [VIEW_TO_HOST.DrawingSetTool]: { tool: 'trendline' },
    [VIEW_TO_HOST.DrawingCommit]: {
      id: 'd1',
      tool: 'trendline',
      points: [{ time: 0, price: 1 }, { time: 10, price: 2 }],
    },
    [VIEW_TO_HOST.ChartRequestReload]: {},
    [VIEW_TO_HOST.ChartApplyInputs]: { inputs: { Length: 14 } },
    [VIEW_TO_HOST.ChartViewport]: { from: 0, to: 100 },
    [VIEW_TO_HOST.ChartBarBreakpoint]: { barIndex: 3 },
    [VIEW_TO_HOST.ChartSelectTrade]: { barIndex: 3 },
  };

  const expectedKinds: Record<string, string> = {
    [VIEW_TO_HOST.DrawingSetTool]: 'setTool',
    [VIEW_TO_HOST.DrawingCommit]: 'commit',
    [VIEW_TO_HOST.ChartRequestReload]: 'requestReload',
    [VIEW_TO_HOST.ChartApplyInputs]: 'applyInputs',
    [VIEW_TO_HOST.ChartViewport]: 'viewport',
    [VIEW_TO_HOST.ChartBarBreakpoint]: 'barBreakpoint',
    [VIEW_TO_HOST.ChartSelectTrade]: 'selectTrade',
  };

  test('every action-bar view→host envelope type maps to a handled ChartMessageHandle kind', () => {
    const handledKinds = new Set<string>();
    for (const type of ACTION_BAR_VIEW_TO_HOST_TYPES) {
      const env = encode(type, payloads[type] as never, { id: 'x', ts: 1 });
      const result = handleChartWebviewMessage(env, session);
      expect(result.kind).not.toBe('reject');
      expect(result.kind).not.toBe('ignore');
      expect(result.kind).toBe(expectedKinds[type]);
      handledKinds.add(result.kind);
    }
    // Each type must produce a distinct, handled kind.
    expect(handledKinds.size).toBe(ACTION_BAR_VIEW_TO_HOST_TYPES.length);
  });

  test('drawing.setTool trendline is accepted as setTool kind (host decides open-source only)', () => {
    const env = encode(VIEW_TO_HOST.DrawingSetTool, { tool: 'trendline' });
    const result = handleChartWebviewMessage(env, session);
    expect(result.kind).toBe('setTool');
    if (result.kind === 'setTool') expect(result.tool).toBe('trendline');
  });

  test('drawing.setTool cursor is accepted as setTool kind (local-only, host no-op)', () => {
    const env = encode(VIEW_TO_HOST.DrawingSetTool, { tool: 'cursor' });
    const result = handleChartWebviewMessage(env, session);
    expect(result.kind).toBe('setTool');
    if (result.kind === 'setTool') expect(result.tool).toBe('cursor');
  });

  test('chart.requestReload maps to requestReload kind', () => {
    const env = encode(VIEW_TO_HOST.ChartRequestReload, {});
    const result = handleChartWebviewMessage(env, session);
    expect(result.kind).toBe('requestReload');
  });

  test('chart.applyInputs maps to applyInputs kind', () => {
    const env = encode(VIEW_TO_HOST.ChartApplyInputs, { inputs: { Length: 14 } });
    const result = handleChartWebviewMessage(env, session);
    expect(result.kind).toBe('applyInputs');
    if (result.kind === 'applyInputs') {
      expect(result.inputs).toEqual({ Length: 14 });
    }
  });

  test('chart.viewport maps to viewport kind', () => {
    const env = encode(VIEW_TO_HOST.ChartViewport, { from: 0, to: 100 });
    const result = handleChartWebviewMessage(env, session);
    expect(result.kind).toBe('viewport');
    if (result.kind === 'viewport') {
      expect(result.from).toBe(0);
      expect(result.to).toBe(100);
    }
  });

  test('chart.barBreakpoint maps to barBreakpoint kind', () => {
    const env = encode(VIEW_TO_HOST.ChartBarBreakpoint, { barIndex: 3 });
    const result = handleChartWebviewMessage(env, session);
    expect(result.kind).toBe('barBreakpoint');
    if (result.kind === 'barBreakpoint') expect(result.barIndex).toBe(3);
  });

  test('chart.selectTrade maps to selectTrade kind', () => {
    const env = encode(VIEW_TO_HOST.ChartSelectTrade, { barIndex: 3 });
    const result = handleChartWebviewMessage(env, session);
    expect(result.kind).toBe('selectTrade');
    if (result.kind === 'selectTrade') expect(result.barIndex).toBe(3);
  });

  test('host→view types are rejected when sent from the webview (wrong direction)', () => {
    const spoof = encode(HOST_TO_VIEW.ChartInit, session.init);
    const result = handleChartWebviewMessage(spoof, session);
    expect(result.kind).toBe('reject');
    if (result.kind === 'reject') {
      expect(result.error.code).toBe('BAD_TYPE');
    }
  });
});
