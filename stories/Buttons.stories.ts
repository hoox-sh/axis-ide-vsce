/**
 * Copyright (C) 2026 jango_blockchained
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { fn } from 'storybook/test';

import type { Meta, StoryObj } from '@storybook/html';
import { btn, cluster, toolbar } from '../webview/shared/components';

/**
 * Shared controls: ax-btn variants/sizes and ax-toolbar chrome strip.
 */

const meta: Meta = {
  title: 'Elements/Buttons',
  parameters: { layout: 'padded' },
};
export default meta;

export const Variants: StoryObj = {
  render: () => {
    const wrap = cluster({
      children: [
        btn({ label: 'Primary', variant: 'primary', onClick: fn() }),
        btn({ label: 'Secondary', variant: 'secondary', onClick: fn() }),
        btn({ label: 'Ghost', variant: 'ghost', onClick: fn() }),
        btn({ label: 'Danger', variant: 'danger', onClick: fn() }),
        btn({ label: 'Disabled', variant: 'primary', disabled: true }),
        btn({ label: 'Pressed', variant: 'secondary', pressed: true }),
      ],
    });
    return wrap;
  },
};

export const Sizes: StoryObj = {
  render: () => {
    return cluster({
      children: [
        btn({ label: 'Medium', variant: 'primary', size: 'md' }),
        btn({ label: 'Small', variant: 'primary', size: 'sm' }),
        btn({ label: 'Reveal', variant: 'secondary', size: 'sm' }),
        btn({ label: 'Remove', variant: 'ghost', size: 'sm' }),
      ],
    });
  },
};

export const ToolbarChrome: StoryObj = {
  render: () => {
    const bar = toolbar({
      ariaLabel: 'Chart tools',
      children: [
        btn({ label: 'Pan', variant: 'ghost', size: 'sm', pressed: true }),
        btn({ label: 'Trendline', variant: 'ghost', size: 'sm' }),
        btn({ label: 'Crosshair', variant: 'ghost', size: 'sm' }),
      ],
    });
    const end = document.createElement('div');
    end.className = 'ax-toolbar__end';
    end.append(
      btn({ label: 'Run', variant: 'primary', size: 'sm' }),
      btn({ label: 'Refresh', variant: 'secondary', size: 'sm' }),
    );
    bar.append(end);
    bar.style.cssText = 'width:420px';
    return bar;
  },
};
