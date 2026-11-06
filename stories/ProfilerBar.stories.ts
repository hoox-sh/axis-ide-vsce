/**
 * Copyright (C) 2026 jango_blockchained
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { Meta, StoryObj } from '@storybook/html';
import { bar } from '../webview/shared/components';

/**
 * Profiler timing bars: 4px segmented track, tonal segments, width clamped
 * to 0–100%.
 */

const meta: Meta = {
  title: 'Elements/ProfilerBar',
  parameters: { layout: 'padded' },
};
export default meta;

export const Single: StoryObj = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:320px;display:flex;flex-direction:column;gap:8px';
    wrap.append(bar({ segments: [{ width: 62, tone: 'accent' }] }));
    return wrap;
  },
};

export const Segmented: StoryObj = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:320px;display:flex;flex-direction:column;gap:8px';
    wrap.append(
      bar({
        segments: [
          { width: 45, tone: 'accent' },
          { width: 25, tone: 'up' },
          { width: 18, tone: 'warn' },
          { width: 7 },
        ],
      }),
      bar({
        segments: [
          { width: 55, tone: 'down' },
          { width: 30, tone: 'info' },
        ],
      }),
    );
    return wrap;
  },
};
