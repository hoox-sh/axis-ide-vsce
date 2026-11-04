// Copyright (C) 2026 jango_blockchained
//
// This file is part of AXIS IDE (hoox-sh.axis-ide).
//
// AXIS IDE is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, version 3 of the License only.
//
// AXIS IDE is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with AXIS IDE.  If not, see <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * AXIS Colors studio webview on the shared runtime + studio.* protocol.
 * Host posts studio.init / studio.set with data `{ colors, sourceLabel }`.
 * Primary click / Enter reveals; Copy / Shift-click copies via host action;
 * chips and search filter client-side through the shared filter machine.
 */

import '@axis-shared/tokens.css';
import '@axis-shared/theme.css';
import '@axis-shared/components.css';
import './style.css';
import { createStudio } from '@axis-shared/studio';
import { setHidden, setText } from '@axis-shared/dom';
import { createFilter } from '@axis-shared/state';
import {
  COLORS_VIEW,
  COLOR_KIND_FILTERS,
  colorKindOf,
  decodeColorsSet,
  encodeColorsCopy,
  encodeColorsReady,
  encodeColorsRefresh,
  encodeColorsReveal,
  isSafeSwatch,
  type ColorRow,
} from './protocol';

// Shared lifecycle runtime: owns the acquireVsCodeApi singleton, host
// message subscription, safe posting, and disposal on pagehide.
const studio = createStudio({ view: COLORS_VIEW });

let colors: ColorRow[] = [];
let sourceLabel = '';
let activeIndex = 0;

// Shared filter machine. In-memory only (no persistKey / api) to keep the
// pre-migration behavior: query + kind start empty on every webview load.
const colorFilter = createFilter({
  chips: COLOR_KIND_FILTERS,
  initial: { query: '', filter: 'all' },
  onChange: () => {
    activeIndex = 0;
    render();
  },
});

function countLabel(count: number): string {
  return String(count);
}

function visibleColors(): ColorRow[] {
  const kind = colorFilter.get().filter;
  return colors.filter((hit) => {
    if (kind !== 'all' && colorKindOf(hit.raw) !== kind) return false;
    return colorFilter.matches(hit.raw);
  });
}

function emptyMessage(visibleCount: number): string {
  if (colors.length === 0) {
    if (sourceLabel === 'No Pine editor') {
      return 'Open a Pine editor to scan colors.';
    }
    return 'No colors in this script. Add a hex, color.* name, color.rgb, or color.new.';
  }
  if (visibleCount === 0) {
    return 'No colors match this filter.';
  }
  return '';
}

function rowItem(hit: ColorRow, index: number): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'colors-list__item';
  item.dataset.index = String(index);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'colors-row';
  button.dataset.line = String(hit.line);
  button.dataset.index = String(index);
  button.dataset.raw = hit.raw;
  button.title = `Show line ${hit.line}, column ${hit.column}. Shift-click to copy.`;

  const swatch = document.createElement('span');
  swatch.className = 'colors-swatch';
  swatch.setAttribute('aria-hidden', 'true');
  if (isSafeSwatch(hit.swatch)) {
    const paint = document.createElement('span');
    paint.className = 'colors-swatch__paint';
    paint.style.backgroundColor = hit.swatch;
    swatch.append(paint);
  } else {
    swatch.classList.add('colors-swatch--raw');
  }

  const raw = document.createElement('span');
  raw.className = 'colors-raw';
  raw.textContent = hit.raw;

  const line = document.createElement('span');
  line.className = 'colors-line';
  line.textContent = `L${hit.line}`;

  button.append(swatch, raw, line);

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'colors-copy';
  copy.textContent = 'Copy';
  copy.dataset.raw = hit.raw;
  copy.title = `Copy ${hit.raw}`;
  copy.setAttribute('aria-label', `Copy ${hit.raw}`);

  item.append(button, copy);
  return item;
}

function syncActive(rows: ColorRow[]): void {
  if (rows.length === 0) {
    activeIndex = 0;
    return;
  }
  if (activeIndex < 0) activeIndex = 0;
  if (activeIndex >= rows.length) activeIndex = rows.length - 1;
  const list = document.getElementById('colors-list');
  if (!list) return;
  list.querySelectorAll('.colors-list__item').forEach((el) => {
    const idx = Number((el as HTMLElement).dataset.index);
    el.classList.toggle('is-active', idx === activeIndex);
  });
  const active = list.querySelector('.colors-list__item.is-active');
  if (active instanceof HTMLElement) {
    active.scrollIntoView({ block: 'nearest' });
  }
}

function render(): void {
  const rows = visibleColors();
  setText('colors-count', countLabel(rows.length));
  const source = document.getElementById('colors-source');
  if (source) {
    source.textContent = sourceLabel;
    source.setAttribute('title', sourceLabel);
  }
  const message = emptyMessage(rows.length);
  setHidden('colors-empty', message.length === 0);
  if (message) setText('colors-empty', message);
  const list = document.getElementById('colors-list');
  if (!(list instanceof HTMLUListElement)) return;
  list.hidden = rows.length === 0;
  list.replaceChildren();
  for (let index = 0; index < rows.length; index += 1) {
    const hit = rows[index];
    if (hit) list.append(rowItem(hit, index));
  }
  syncActive(rows);

  const chips = document.querySelectorAll<HTMLButtonElement>('button.colors-chip[data-kind]');
  chips.forEach((chip) => {
    const value = chip.getAttribute('data-kind') ?? '';
    chip.setAttribute('aria-pressed', colorFilter.isActive(value) ? 'true' : 'false');
  });
}

function revealAt(index: number): void {
  const rows = visibleColors();
  const hit = rows[index];
  if (!hit) return;
  studio.post(encodeColorsReveal(hit.line));
}

function copyRaw(text: string): void {
  if (!text) return;
  studio.post(encodeColorsCopy(text));
}

function onListClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const copyBtn = target.closest('button.colors-copy');
  if (copyBtn instanceof HTMLButtonElement) {
    copyRaw(copyBtn.dataset.raw ?? '');
    return;
  }
  const button = target.closest('button.colors-row');
  if (!(button instanceof HTMLButtonElement)) return;
  const index = Number(button.dataset.index);
  if (Number.isInteger(index)) activeIndex = index;
  syncActive(visibleColors());
  if (event.shiftKey) {
    copyRaw(button.dataset.raw ?? '');
    return;
  }
  const line = Number(button.dataset.line);
  if (!Number.isInteger(line) || line < 1) return;
  studio.post(encodeColorsReveal(line));
}

function onListKeydown(event: KeyboardEvent): void {
  const rows = visibleColors();
  if (rows.length === 0) return;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    activeIndex = Math.min(rows.length - 1, activeIndex + 1);
    syncActive(rows);
    return;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    activeIndex = Math.max(0, activeIndex - 1);
    syncActive(rows);
    return;
  }
  if (event.key === 'Enter') {
    const target = event.target;
    if (target instanceof HTMLButtonElement && target.classList.contains('colors-copy')) return;
    event.preventDefault();
    if (event.shiftKey) {
      copyRaw(rows[activeIndex]?.raw ?? '');
      return;
    }
    revealAt(activeIndex);
  }
}

function onHostMessage(message: unknown): void {
  const state = decodeColorsSet(message);
  if (!state) return;
  colors = state.colors;
  sourceLabel = state.sourceLabel;
  activeIndex = 0;
  render();
}

function main(): void {
  const search = document.getElementById('colors-search');
  if (search instanceof HTMLInputElement) {
    search.addEventListener('input', () => {
      colorFilter.setQuery(search.value);
    });
  }

  const filters = document.querySelector('.colors-filters');
  filters?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const chip = target.closest('button[data-kind]');
    colorFilter.setFilter(chip?.getAttribute('data-kind') ?? '');
  });

  document.getElementById('colors-refresh')?.addEventListener('click', () => {
    studio.post(encodeColorsRefresh());
  });

  const list = document.getElementById('colors-list');
  if (list) {
    list.addEventListener('click', onListClick);
    list.addEventListener('keydown', onListKeydown);
  }

  studio.onMessage(onHostMessage);
  render();
  studio.post(encodeColorsReady());
}

main();
