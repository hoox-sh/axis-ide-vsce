/**
 * Copyright (C) 2026 jango_blockchained
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { Meta, StoryObj } from '@storybook/html';
import {
  badge,
  cluster,
  empty,
  loading,
  sectionTitle,
  codeBlock,
  kpi,
} from '../webview/shared/components';

/**
 * Semantic badges, section titles, loading, empty hierarchy, KPI tones, code.
 */

const meta: Meta = {
  title: 'Elements/Badges',
  parameters: { layout: 'padded' },
};
export default meta;

export const BadgeTones: StoryObj = {
  render: () =>
    cluster({
      gap: 'xs',
      children: [
        badge({ text: 'Built-in' }),
        badge({ text: 'Active', tone: 'up' }),
        badge({ text: 'Network', tone: 'info' }),
        badge({ text: 'Flag off', tone: 'warn' }),
        badge({ text: 'Failed', tone: 'down' }),
        badge({ text: 'Accent', tone: 'accent' }),
      ],
    }),
};

export const SectionAndLoading: StoryObj = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:320px;display:flex;flex-direction:column;gap:12px';
    wrap.append(
      sectionTitle({ text: 'Hot lines', as: 'h3' }),
      loading({ label: 'Waiting for host catalog…' }),
      empty({
        title: 'No matches',
        hint: 'Adjust filters or clear the search field.',
        actionLabel: 'Reset filters',
      }),
      codeBlock({ text: '{\n  "runId": "r_42",\n  "status": "ok"\n}' }),
    );
    return wrap;
  },
};

export const KpiTones: StoryObj = {
  render: () => {
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,110px);gap:8px';
    grid.append(
      kpi({ label: 'Net', value: '+4.82%', tone: 'up' }),
      kpi({ label: 'Max DD', value: '6.1%', tone: 'down' }),
      kpi({ label: 'Sharpe', value: '1.42', tone: 'accent' }),
    );
    return grid;
  },
};
