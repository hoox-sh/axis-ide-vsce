/**
 * Copyright (C) 2026 jango_blockchained
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { fn } from 'storybook/test';

import type { Meta, StoryObj } from '@storybook/html';
import { tabs } from '../webview/shared/components';

/**
 * Tab bar on the axis contract: hairline rail, animated 2px accent
 * underline indicator, quiet hover wash, inset underline on keyboard
 * focus. Arrow keys move selection and roving focus.
 */

function iconSvg(path: string): Node {
  const span = document.createElement('span');
  span.innerHTML =
    `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">` +
    `<path fill="currentColor" d="${path}"/></svg>`;
  return span.firstChild ?? span;
}

const meta: Meta = {
  title: 'Elements/Tabs',
  parameters: { layout: 'padded' },
};
export default meta;

export const Default: StoryObj = {
  render: () =>
    tabs({
      tabs: [
        { id: 'output', label: 'Output' },
        { id: 'profiler', label: 'Profiler' },
        { id: 'errors', label: 'Errors', count: 3 },
      ],
      active: 'output',
      onSelect: fn(),
    }),
};

export const WithIcons: StoryObj = {
  render: () =>
    tabs({
      tabs: [
        { id: 'all', label: 'All', icon: iconSvg('M2 4h12v2H2zM2 7h12v2H2zM2 10h12v2H2z') },
        { id: 'source', label: 'Sources', icon: iconSvg('M7.25 1.5h1.5v2.5H11v8H8.75v2.5h-1.5V12H5V4h2.25z'), count: 4 },
        { id: 'engine', label: 'Engines', icon: iconSvg('M8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z') },
      ],
      active: 'all',
      onSelect: fn(),
    }),
};

export const ManyTabs: StoryObj = {
  render: () =>
    tabs({
      tabs: [
        { id: 'a', label: 'Run Output' },
        { id: 'b', label: 'Profiler', count: 12 },
        { id: 'c', label: 'Strategy' },
        { id: 'd', label: 'Trades', count: 87 },
        { id: 'e', label: 'Deep backtest' },
      ],
      active: 'b',
      onSelect: fn(),
    }),
};
