/**
 * Copyright (C) 2026 jango_blockchained
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { fn } from 'storybook/test';

import type { Meta, StoryObj } from '@storybook/html';
import {
  empty,
  header,
  kbd,
  kpi,
  panel,
  swatch,
} from '../webview/shared/components';

/**
 * Surfaces: elevated panels with the 180ms dock-edge entrance, sticky
 * headers with count pills, stat tiles, empty states, and kbd chips.
 */

const meta: Meta = {
  title: 'Elements/Surfaces',
  parameters: { layout: 'padded' },
};
export default meta;

export const PanelWithHeader: StoryObj = {
  render: () => {
    const inner = panel({
      animateIn: true,
      children: [
        header({ title: 'Watchlist', count: 12 }),
        Object.assign(document.createElement('div'), {
          textContent: 'Rows go here.',
          style: 'padding:0 var(--axis-gap-xs) var(--axis-gap-xs);font-size:12px;color:var(--axis-dim)',
        }),
      ],
    });
    inner.style.cssText = 'width:320px;padding:var(--axis-panel-pad)';
    return inner;
  },
};

export const KpiGrid: StoryObj = {
  render: () => {
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(3, 110px);gap:8px';
    grid.append(
      kpi({ label: 'Net', value: '+4.82%' }),
      kpi({ label: 'Trades', value: '128' }),
      kpi({ label: 'Max DD', value: '6.1%' }),
    );
    return grid;
  },
};

export const EmptyState: StoryObj = {
  render: () => {
    const box = panel({
      children: [
        empty({
          title: 'Nothing here yet',
          hint: 'No plugins match the current filters.',
          actionLabel: 'Reset filters',
          onAction: fn(),
        }),
      ],
    });
    box.style.cssText = 'width:320px;padding:var(--axis-panel-pad)';
    return box;
  },
};

export const InlineKbd: StoryObj = {
  render: () => {
    const line = document.createElement('p');
    line.style.cssText = 'font-size:12px;color:var(--axis-dim)';
    line.append('Press ', kbd('⌘'), ' + ', kbd('R'), ' to run the active script.');
    return line;
  },
};

export const Swatches: StoryObj = {
  render: () => {
    const list = document.createElement('div');
    list.style.cssText = 'width:280px;display:flex;flex-direction:column;gap:2px';
    list.append(
      swatch({ code: '#8b9cff', color: '#8b9cff', onClick: fn() }),
      swatch({ code: '#3ddc97', color: '#3ddc97', onClick: fn() }),
      swatch({ code: 'color.new(purple)', onClick: fn() }),
    );
    return list;
  },
};
