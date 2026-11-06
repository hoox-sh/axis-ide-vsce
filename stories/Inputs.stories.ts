/**
 * Copyright (C) 2026 jango_blockchained
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { fn } from 'storybook/test';

import type { Meta, StoryObj } from '@storybook/html';
import { field, search } from '../webview/shared/components';

/**
 * Single-input primitives on the axis input contract: accent caret, hover
 * edge lighten, focus accent edge + soft ring, 0.72 placeholder, readonly /
 * disabled / invalid states, and no native spinners or search chrome.
 */

const meta: Meta = {
  title: 'Elements/Inputs',
  parameters: { layout: 'padded' },
};
export default meta;

export const Search: StoryObj = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:280px;display:flex;flex-direction:column;gap:10px';
    wrap.append(
      search({ placeholder: 'Filter…', ariaLabel: 'Filter', onInput: fn() }),
      search({ placeholder: 'With value', value: 'pyodide', ariaLabel: 'Filter' }),
    );
    return wrap;
  },
};

export const Field: StoryObj = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:280px;display:flex;flex-direction:column;gap:14px';
    wrap.append(
      field({
        label: 'Symbol',
        inputId: 'sb-symbol',
        placeholder: 'BTCUSDT',
        onInput: fn(),
      }),
      field({
        label: 'Worker key',
        inputId: 'sb-key',
        placeholder: 'pn_…',
        mono: true,
        onInput: fn(),
      }),
    );
    return wrap;
  },
};

export const FieldStates: StoryObj = {
  render: () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:280px;display:flex;flex-direction:column;gap:14px';
    const invalid = field({ label: 'Endpoint', inputId: 'sb-invalid', value: 'not-a-url' });
    invalid.classList.add('is-invalid');
    const readonly = field({ label: 'Readonly', inputId: 'sb-readonly', value: 'axis.pro.local' });
    const input = readonly.querySelector('input');
    if (input) input.setAttribute('readonly', '');
    const disabled = field({ label: 'Disabled', inputId: 'sb-disabled', value: 'locked' });
    const locked = disabled.querySelector('input');
    if (locked) locked.disabled = true;
    wrap.append(invalid, readonly, disabled);
    return wrap;
  },
};

export const ComposedForm: StoryObj = {
  render: () => {
    const card = document.createElement('div');
    card.className = 'ax-panel';
    card.style.cssText = 'width:320px;padding:var(--axis-panel-pad);display:flex;flex-direction:column;gap:12px';
    card.append(
      field({ label: 'Datafeed URL', inputId: 'sb-url', value: 'http://127.0.0.1:8787', mono: true }),
      field({ label: 'Interval', inputId: 'sb-interval', placeholder: '1m' }),
      search({ placeholder: 'Search plugins…', ariaLabel: 'Search plugins' }),
    );
    return card;
  },
};
