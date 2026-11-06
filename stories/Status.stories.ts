/**
 * Copyright (C) 2026 jango_blockchained
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { Meta, StoryObj } from '@storybook/html';
import { capsule, flash, statusDot } from '../webview/shared/components';

/**
 * Status primitives: 18px capsules, 6px status dots (with the 350ms live
 * pulse), and the 180ms tick flash for value changes.
 */

const meta: Meta = {
  title: 'Elements/Status',
  parameters: { layout: 'padded' },
};
export default meta;

export const Capsules: StoryObj = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center';
    wrap.append(
      capsule({ code: 'IDLE' }),
      capsule({ code: 'RUN', value: '12s' }),
      capsule({ code: 'LIVE', value: 'ws', active: true }),
      capsule({ code: 'ERR', value: '401' }),
    );
    return wrap;
  },
};

export const StatusDots: StoryObj = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.cssText =
      'display:flex;flex-direction:column;gap:8px;width:200px;padding:12px;background:var(--axis-bg-elev);border-radius:var(--axis-radius-panel)';
    wrap.append(
      statusDot({ label: 'Idle', state: 'idle' }),
      statusDot({ label: 'Connected', state: 'ok' }),
      statusDot({ label: 'Degraded', state: 'warn' }),
      statusDot({ label: 'Failed', state: 'err' }),
      statusDot({ label: 'Live', state: 'live' }),
    );
    return wrap;
  },
};

export const Flash: StoryObj = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:16px;font-family:var(--axis-font-mono);font-size:14px';
    wrap.append(
      flash({ value: '42,318.5', direction: 'up' }),
      flash({ value: '42,190.0', direction: 'down' }),
      flash({ value: '42,250.0' }),
    );
    return wrap;
  },
};
