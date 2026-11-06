/**
 * Copyright (C) 2026 jango_blockchained
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { fn } from 'storybook/test';

import type { Meta, StoryObj } from '@storybook/html';
import { chip, glyph, panel } from '../webview/shared/components';

/**
 * Glyph grid cells (insert-on-click) and the profiler-adjacent symbol
 * picker chrome.
 */

const meta: Meta = {
  title: 'Elements/Glyphs',
  parameters: { layout: 'padded' },
};
export default meta;

export const Grid: StoryObj = {
  render: () => {
    const grid = document.createElement('div');
    grid.style.cssText =
      'display:grid;grid-template-columns:repeat(6, 72px);gap:2px;padding:var(--axis-panel-pad);background:var(--axis-bg-elev);border:1px solid var(--axis-border);border-radius:var(--axis-radius-panel)';
    for (const [char, name] of [
      ['▲', 'triangle-up'],
      ['▼', 'triangle-down'],
      ['◆', 'diamond'],
      ['●', 'circle'],
      ['■', 'square'],
      ['★', 'star'],
      ['✕', 'cross'],
      ['⬆', 'arrow-up'],
      ['⬇', 'arrow-down'],
      ['⇅', 'arrows'],
      ['⊙', 'target'],
      ['∅', 'empty'],
    ] as const) {
      grid.append(glyph({ char, name, onInsert: fn() }));
    }
    return grid;
  },
};

export const InPanel: StoryObj = {
  render: () => {
    const box = panel({
      animateIn: true,
      children: [
        Object.assign(document.createElement('div'), {
          textContent: 'Insert symbol at cursor',
          style: 'font-size:var(--axis-label);font-weight:var(--axis-label-weight);letter-spacing:var(--axis-label-tracking);text-transform:uppercase;color:var(--axis-dim);margin-bottom:8px',
        }),
        glyph({ char: '◆', name: 'diamond', onInsert: fn() }),
      ],
    });
    box.style.cssText = 'width:240px;padding:var(--axis-panel-pad)';
    return box;
  },
};

export const WithChipsRow: StoryObj = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:6px;align-items:center';
    wrap.append(
      chip({ label: 'Shapes', value: 'shapes', pressed: true }),
      chip({ label: 'Arrows', value: 'arrows', pressed: false }),
      glyph({ char: '★', name: 'star', onInsert: fn() }),
    );
    return wrap;
  },
};
