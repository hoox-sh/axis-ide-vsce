/**
 * Copyright (C) 2026 jango_blockchained
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { fn } from 'storybook/test';

import type { Meta, StoryObj } from '@storybook/html';
import { chip } from '../webview/shared/components';

/**
 * Filter chips on the axis pill contract: transparent base, hover wash,
 * accent on-state with press scale, focus ring, disabled fade.
 */

const meta: Meta = {
  title: 'Elements/Chips',
  parameters: { layout: 'padded' },
};
export default meta;

export const FilterGroup: StoryObj = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;max-width:420px';
    for (const [label, pressed] of [
      ['Sources', true],
      ['Streams', false],
      ['Engines', true],
      ['Storage', false],
    ] as const) {
      wrap.append(
        chip({
          label,
          value: label.toLowerCase(),
          pressed,
          onToggle: fn(),
        }),
      );
    }
    return wrap;
  },
};

export const WithCountAndIcon: StoryObj = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
    const mark = document.createElement('span');
    mark.innerHTML =
      '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">' +
      '<path fill="currentColor" d="M1 7.25h2.7l1.55-3.7 2.55 8.15 1.7-4.45H15v1.5h-4.65l-1.35 3.5-2.7-8.6-1.7 4.1H1z"/></svg>';
    wrap.append(
      chip({ label: 'Active', value: 'active', pressed: true, count: 6 }),
      chip({ label: 'Stream', value: 'stream', pressed: false, icon: mark }),
      chip({ label: 'Network', value: 'network', pressed: false, count: 2 }),
    );
    return wrap;
  },
};

export const Disabled: StoryObj = {
  render: () => {
    const off = chip({ label: 'Flag off', value: 'flag', pressed: false });
    off.disabled = true;
    const onDisabled = chip({ label: 'Pressed', value: 'pressed', pressed: true });
    onDisabled.disabled = true;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:6px';
    wrap.append(off, onDisabled);
    return wrap;
  },
};
