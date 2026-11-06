/**
 * Copyright (C) 2026 jango_blockchained
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { Meta, StoryObj } from '@storybook/html';

/**
 * Token board: the --axis-* design tokens resolved against the current
 * VS Code theme (toolbar switch). Flip the theme to watch semantic
 * variables re-resolve.
 */

const meta: Meta = {
  title: 'Foundations/Tokens',
  parameters: { layout: 'padded' },
};
export default meta;

type Swatch = { name: string; group: string };

const COLORS: Swatch[] = [
  { name: '--axis-bg', group: 'Surfaces' },
  { name: '--axis-bg-elev', group: 'Surfaces' },
  { name: '--axis-bg-hover', group: 'Surfaces' },
  { name: '--axis-border', group: 'Hairlines' },
  { name: '--axis-border-soft', group: 'Hairlines' },
  { name: '--axis-text', group: 'Text' },
  { name: '--axis-dim', group: 'Text' },
  { name: '--axis-faint', group: 'Text' },
  { name: '--axis-accent', group: 'Accent' },
  { name: '--axis-accent-hover', group: 'Accent' },
  { name: '--axis-up', group: 'Market' },
  { name: '--axis-down', group: 'Market' },
  { name: '--axis-warn', group: 'Market' },
  { name: '--axis-info', group: 'Market' },
  { name: '--axis-input-bg', group: 'Inputs' },
  { name: '--axis-input-border', group: 'Inputs' },
  { name: '--axis-badge-bg', group: 'Badges' },
  { name: '--axis-link', group: 'Links' },
];

const MEASURES: Swatch[] = [
  { name: '--axis-radius-chip', group: 'Radii' },
  { name: '--axis-radius-pill', group: 'Radii' },
  { name: '--axis-radius-input', group: 'Radii' },
  { name: '--axis-radius-panel', group: 'Radii' },
  { name: '--axis-control-h', group: 'Density' },
  { name: '--axis-row-h', group: 'Density' },
  { name: '--axis-capsule-h', group: 'Density' },
  { name: '--axis-bar-h', group: 'Density' },
  { name: '--axis-gap-xs', group: 'Spacing' },
  { name: '--axis-gap', group: 'Spacing' },
  { name: '--axis-panel-pad', group: 'Spacing' },
];

function tile(swatch: Swatch): HTMLElement {
  const cell = document.createElement('div');
  cell.style.cssText =
    'display:flex;flex-direction:column;gap:4px;min-width:130px';
  const swatchBox = document.createElement('span');
  swatchBox.style.cssText =
    'height:36px;border-radius:4px;border:1px solid var(--axis-border)';
  if (swatch.group === 'Radii' || swatch.group === 'Density' || swatch.group === 'Spacing') {
    swatchBox.style.background = 'var(--axis-accent)';
    swatchBox.style.opacity = '0.85';
  } else {
    swatchBox.style.background = `var(${swatch.name})`;
  }
  const name = document.createElement('code');
  name.textContent = swatch.name;
  name.style.cssText =
    'font-family:var(--axis-font-mono);font-size:11px;color:var(--axis-text)';
  const value = document.createElement('span');
  value.textContent = getComputedStyle(document.documentElement)
    .getPropertyValue(swatch.name)
    .trim() || '—';
  value.style.cssText =
    'font-family:var(--axis-font-mono);font-size:10px;color:var(--axis-dim)';
  cell.append(swatchBox, name, value);
  return cell;
}

function board(title: string, swatches: Swatch[], columns: string): HTMLElement {
  const section = document.createElement('section');
  section.style.cssText = 'display:flex;flex-direction:column;gap:8px';
  const head = document.createElement('div');
  head.className = 'ax-header__title';
  head.textContent = title;
  const grid = document.createElement('div');
  grid.style.cssText = `display:grid;grid-template-columns:${columns};gap:12px`;
  for (const swatch of swatches) grid.append(tile(swatch));
  section.append(head, grid);
  return section;
}

export const All: StoryObj = {
  render: () => {
    const root = document.createElement('div');
    root.style.cssText = 'display:flex;flex-direction:column;gap:24px';
    root.append(
      board('Color tokens', COLORS, 'repeat(auto-fill, minmax(130px, 1fr))'),
      board('Radii · density · spacing', MEASURES, 'repeat(auto-fill, minmax(130px, 1fr))'),
    );
    return root;
  },
};
