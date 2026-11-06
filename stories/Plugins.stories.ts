/**
 * Copyright (C) 2026 jango_blockchained
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { fn } from 'storybook/test';

import type { Meta, StoryObj } from '@storybook/html';
import { chip, header, panel, row, statusDot } from '../webview/shared/components';

/**
 * Plugin card composition, mirroring the Plugins studio catalog: kind mark,
 * name + mono id, active dot, capability badges (pill chips), extra facts,
 * and hover actions. This is the composition the IDE ships inside VS Code.
 */

function kindIcon(path: string, stroke = false): Node {
  const span = document.createElement('span');
  const shape = stroke
    ? `<circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.25"/>`
    : `<path fill="currentColor" d="${path}"/>`;
  span.innerHTML =
    `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">${shape}</svg>`;
  return span.firstChild ?? span;
}

function pluginCard(options: {
  name: string;
  id: string;
  kind: string;
  icon: Node;
  active: boolean;
  badges: string[];
  facts: [string, string][];
  flagOff?: boolean;
}): HTMLElement {
  const card = row({ className: 'plugin-card', active: options.active });
  card.style.cssText =
    'display:flex;flex-direction:column;align-items:stretch;gap:6px;padding:10px 12px;min-height:0;cursor:default';

  const head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:center;gap:8px';
  head.append(options.icon);
  const name = document.createElement('span');
  name.textContent = options.name;
  name.style.cssText = 'font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  const id = document.createElement('code');
  id.textContent = options.id;
  id.style.cssText = 'font-family:var(--axis-font-mono);font-size:11px;color:var(--axis-dim);margin-left:auto';
  head.append(name, id);
  if (options.active) head.append(statusDot({ label: 'Active', state: 'ok' }));

  const badges = document.createElement('div');
  badges.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px';
  badges.append(chip({ label: options.kind, value: options.kind, pressed: options.active }));
  for (const badge of options.badges) {
    badges.append(chip({ label: badge, value: badge, pressed: false }));
  }
  if (options.flagOff) {
    badges.append(statusDot({ label: 'Flag off — enable axis.engine.allowPyodide', state: 'warn' }));
  }

  const facts = document.createElement('dl');
  facts.style.cssText = 'display:flex;flex-direction:column;gap:2px;margin:0';
  for (const [key, value] of options.facts) {
    const line = document.createElement('div');
    line.style.cssText = 'display:flex;gap:8px';
    const dt = document.createElement('dt');
    dt.textContent = key;
    dt.style.cssText =
      'color:var(--axis-dim);font-size:10px;text-transform:uppercase;letter-spacing:0.04em';
    const dd = document.createElement('dd');
    dd.textContent = value;
    dd.style.cssText =
      'margin:0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px';
    line.append(dt, dd);
    facts.append(line);
  }

  card.append(head, badges, facts);
  return card;
}

const meta: Meta = {
  title: 'Studios/Plugins',
  parameters: { layout: 'padded' },
};
export default meta;

export const Catalog: StoryObj = {
  render: () => {
    const surface = panel({
      animateIn: true,
      children: [
        header({ title: 'Plugins', count: 3 }),
        pluginCard({
          name: 'Binance REST source',
          id: 'src.binance.rest',
          kind: 'Source',
          icon: kindIcon('M7.25 1.5h1.5v2.5H11v8H8.75v2.5h-1.5V12H5V4h2.25z'),
          active: true,
          badges: ['Built-in', 'Network'],
          facts: [
            ['Transport', 'REST polling'],
            ['Auth', 'Key optional'],
          ],
        }),
        pluginCard({
          name: 'HP engine (local)',
          id: 'engine.hp.local',
          kind: 'Engine',
          icon: kindIcon('M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z'),
          active: false,
          badges: ['Built-in'],
          facts: [['Bars in', 'Only — no outbound network']],
        }),
        pluginCard({
          name: 'Pyodide calculator',
          id: 'engine.pyodide',
          kind: 'Engine',
          icon: kindIcon('M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z'),
          active: false,
          badges: ['Dynamic'],
          facts: [['Runtime', 'Wasm, multi-MB, never shipped']],
          flagOff: true,
        }),
      ],
    });
    surface.style.cssText = 'width:420px;padding:var(--axis-panel-pad)';
    return surface;
  },
};

export const ActiveVsInactive: StoryObj = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:420px;display:flex;flex-direction:column;gap:8px';
    wrap.append(
      pluginCard({
        name: 'Stream: trades',
        id: 'stream.trades.ws',
        kind: 'Stream',
        icon: kindIcon('M1 7.25h2.7l1.55-3.7 2.55 8.15 1.7-4.45H15v1.5h-4.65l-1.35 3.5-2.7-8.6-1.7 4.1H1z'),
        active: true,
        badges: ['Auth', 'Proxy'],
        facts: [['Uplink', 'wss://live.example/api/ws/live']],
      }),
      pluginCard({
        name: 'Storage: duckdb',
        id: 'storage.duckdb',
        kind: 'Storage',
        icon: kindIcon('', true),
        active: false,
        badges: ['Built-in'],
        facts: [['Writes', 'Results + profiler samples']],
      }),
    );
    return wrap;
  },
};

export const WithActions: StoryObj = {
  render: () => {
    const card = pluginCard({
      name: 'Demo momentum source',
      id: 'src.demo.momentum',
      kind: 'Source',
      icon: kindIcon('M7.25 1.5h1.5v2.5H11v8H8.75v2.5h-1.5V12H5V4h2.25z'),
      active: false,
      badges: ['Built-in'],
      facts: [['Interval', '1m · 5m · 15m']],
    });
    const activate = document.createElement('button');
    activate.type = 'button';
    activate.className = 'ax-empty__action';
    activate.textContent = 'Activate';
    activate.addEventListener('click', fn());
    card.append(activate);
    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:420px';
    wrap.append(card);
    return wrap;
  },
};
