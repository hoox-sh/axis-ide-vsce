/**
 * Copyright (C) 2026 jango_blockchained
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { fn } from 'storybook/test';

import type { Meta, StoryObj } from '@storybook/html';
import { kbd, row } from '../webview/shared/components';

/**
 * List rows: hairline separators, hover wash, active accent bar, and
 * hover-revealed actions over the right-edge scrim.
 */

function actionButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'ax-empty__action';
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

const meta: Meta = {
  title: 'Elements/Rows',
  parameters: { layout: 'padded' },
};
export default meta;

export const List: StoryObj = {
  render: () => {
    const list = document.createElement('div');
    list.style.cssText = 'width:360px';
    list.append(
      row({
        active: true,
        children: [
          Object.assign(document.createElement('span'), { textContent: 'ema-cross', style: 'font-family:var(--axis-font-mono);font-size:12px' }),
          Object.assign(document.createElement('span'), { textContent: 'active', style: 'margin-left:auto;font-size:11px;color:var(--axis-dim)' }),
        ],
      }),
      row({
        children: [
          Object.assign(document.createElement('span'), { textContent: 'rsi-divergence', style: 'font-family:var(--axis-font-mono);font-size:12px' }),
        ],
        actions: [actionButton('Open', fn()), actionButton('Remove', fn())],
      }),
      row({
        children: [
          Object.assign(document.createElement('span'), { textContent: 'src.demo.momentum', style: 'font-family:var(--axis-font-mono);font-size:12px' }),
          kbd('⌘R'),
        ],
        actions: [actionButton('Run', fn())],
      }),
    );
    return list;
  },
};

export const AsListItems: StoryObj = {
  render: () => {
    const ul = document.createElement('ul');
    ul.style.cssText = 'width:360px;margin:0;padding:0;list-style:none';
    ul.append(
      row({ as: 'li', children: [document.createTextNode('First row')] }),
      row({ as: 'li', children: [document.createTextNode('Second row')] }),
    );
    return ul;
  },
};
