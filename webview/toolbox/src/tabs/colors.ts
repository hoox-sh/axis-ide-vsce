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
 * Toolbox Colors tab — minimal but functional list of scanned Pine color
 * literals. Primary click / Enter reveals; Copy / Shift-click copies.
 * Filtering is client-side through the shared filter machine.
 */

import { btn, search } from '@axis-shared/components';
import { createFilter } from '@axis-shared/state';

export interface ColorsActions {
  /** Reveal a 1-based source line in the active editor. */
  revealColorLine(line: number): void;
  /** Copy a color literal via the host. */
  copyColorText(text: string): void;
  /** Ask the host to rescan the active editor. */
  refreshColors(): void;
}

interface ColorHit {
  line: number;
  column: number;
  raw: string;
  swatch: string;
}

type ColorKindFilter = 'all' | 'hex' | 'named' | 'rgb-new';

const KIND_FILTERS: readonly ColorKindFilter[] = ['all', 'hex', 'named', 'rgb-new'];
const CHIP_LABELS: Record<ColorKindFilter, string> = {
  all: 'All',
  hex: 'Hex',
  named: 'Named',
  'rgb-new': 'RGB',
};

const SAFE_SWATCH =
  /^(?:#[0-9A-Fa-f]{3}|#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{8}|rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)|rgba\(\d{1,3}, \d{1,3}, \d{1,3}, (?:0|1|0\.\d{1,3})\))$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isColorHit(value: unknown): value is ColorHit {
  if (!isPlainObject(value)) return false;
  const line = value.line;
  const column = value.column;
  if (typeof line !== 'number' || !Number.isInteger(line) || line < 1) return false;
  if (typeof column !== 'number' || !Number.isInteger(column) || column < 1) return false;
  if (typeof value.raw !== 'string' || value.raw.length === 0) return false;
  if (typeof value.swatch !== 'string' || value.swatch.length === 0) return false;
  return true;
}

function colorKind(raw: string): Exclude<ColorKindFilter, 'all'> {
  const text = raw.trim();
  if (text.startsWith('#')) return 'hex';
  if (/^color\.(rgb|new)\b/i.test(text)) return 'rgb-new';
  return 'named';
}

function isSafeSwatch(value: string): boolean {
  return SAFE_SWATCH.test(value);
}

interface ParsedColorsData {
  colors: ColorHit[];
  sourceLabel: string;
}

function parseColorsData(value: unknown): ParsedColorsData {
  const data = isPlainObject(value) ? value : {};
  const sourceLabel = typeof data.sourceLabel === 'string' ? data.sourceLabel : '';
  const colors: ColorHit[] = [];
  if (Array.isArray(data.colors)) {
    for (const item of data.colors) {
      if (isColorHit(item)) colors.push(item);
    }
  }
  return { colors, sourceLabel };
}

/** One-stop Colors tab factory. */
export function createColorsTab(actions: ColorsActions): {
  root: HTMLElement;
  setData(raw: unknown): void;
} {
  let rows: ColorHit[] = [];
  let sourceLabel = '';
  let activeIndex = 0;

  const filter = createFilter({
    chips: KIND_FILTERS,
    initial: { query: '', filter: 'all' },
    onChange: () => {
      activeIndex = 0;
      render();
    },
  });

  const root = document.createElement('section');
  root.className = 'toolbox-tab-panel toolbox-colors';
  root.setAttribute('role', 'tabpanel');
  root.setAttribute('aria-label', 'Colors');

  const header = document.createElement('div');
  header.className = 'toolbox-colors__header';

  const title = document.createElement('h2');
  title.className = 'toolbox-colors__title';
  title.textContent = 'Colors';

  const count = document.createElement('span');
  count.className = 'toolbox-colors__count';
  count.textContent = '0';

  const source = document.createElement('span');
  source.className = 'toolbox-colors__source';
  source.textContent = '';

  const refresh = btn({
    label: 'Refresh',
    variant: 'secondary',
    size: 'sm',
    title: 'Rescan the active Pine editor',
    className: 'toolbox-colors__refresh',
    onClick: () => {
      actions.refreshColors();
    },
  });

  header.append(title, count, source, refresh);

  const searchField = search({
    placeholder: 'Filter colors',
    ariaLabel: 'Filter colors',
    onInput: (value) => {
      filter.setQuery(value);
    },
  });
  searchField.classList.add('toolbox-colors__search');

  const chips = document.createElement('div');
  chips.className = 'toolbox-colors__filters';
  const chipButtons = new Map<ColorKindFilter, HTMLButtonElement>();
  for (const kind of KIND_FILTERS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ax-chip toolbox-colors__chip';
    button.textContent = CHIP_LABELS[kind];
    button.dataset.kind = kind;
    button.setAttribute('aria-pressed', kind === 'all' ? 'true' : 'false');
    button.addEventListener('click', () => {
      filter.setFilter(kind);
    });
    chipButtons.set(kind, button);
    chips.append(button);
  }

  const list = document.createElement('ul');
  list.className = 'toolbox-colors__list';
  list.tabIndex = 0;
  list.setAttribute('role', 'list');
  list.setAttribute('aria-label', 'Colors');
  list.addEventListener('keydown', (event) => {
    const target = event.target;
    if (target instanceof HTMLButtonElement && target.classList.contains('toolbox-color__copy')) {
      return;
    }
    const visible = visibleRows();
    if (visible.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = Math.min(visible.length - 1, activeIndex + 1);
      syncActive(visible);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = Math.max(0, activeIndex - 1);
      syncActive(visible);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) {
        copy(visible[activeIndex]?.raw ?? '');
      } else {
        revealAt(activeIndex);
      }
    }
  });

  const empty = document.createElement('p');
  empty.className = 'toolbox-empty';
  empty.hidden = true;

  root.append(header, searchField, chips, list, empty);

  function visibleRows(): ColorHit[] {
    const kind = filter.get().filter as ColorKindFilter;
    return rows.filter((hit) => {
      if (kind !== 'all' && colorKind(hit.raw) !== kind) return false;
      return filter.matches(hit.raw);
    });
  }

  function paint(color: string): HTMLElement {
    const span = document.createElement('span');
    span.className = 'toolbox-color__paint';
    if (isSafeSwatch(color)) {
      span.style.backgroundColor = color;
    } else {
      span.classList.add('toolbox-color__paint--raw');
    }
    return span;
  }

  function rowItem(hit: ColorHit, index: number): HTMLLIElement {
    const item = document.createElement('li');
    item.className = 'toolbox-color';
    item.dataset.index = String(index);

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'toolbox-color__main';
    main.title = `Reveal line ${hit.line}. Shift-click to copy.`;
    main.append(
      paint(hit.swatch),
      Object.assign(document.createElement('span'), {
        className: 'toolbox-color__code',
        textContent: hit.raw,
      }),
      Object.assign(document.createElement('span'), {
        className: 'toolbox-color__line',
        textContent: `L${hit.line}`,
      }),
    );
    main.addEventListener('click', (event) => {
      activeIndex = index;
      syncActive(visibleRows());
      if (event.shiftKey) {
        copy(hit.raw);
      } else {
        actions.revealColorLine(hit.line);
      }
    });

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'toolbox-color__copy';
    copyBtn.textContent = 'Copy';
    copyBtn.title = `Copy ${hit.raw}`;
    copyBtn.setAttribute('aria-label', `Copy ${hit.raw}`);
    copyBtn.addEventListener('click', () => {
      copy(hit.raw);
    });

    item.append(main, copyBtn);
    return item;
  }

  function syncActive(visible: ColorHit[]): void {
    if (visible.length === 0) {
      activeIndex = 0;
      return;
    }
    activeIndex = Math.max(0, Math.min(visible.length - 1, activeIndex));
    list.querySelectorAll<HTMLLIElement>('.toolbox-color').forEach((el) => {
      const idx = Number(el.dataset.index);
      el.classList.toggle('is-active', idx === activeIndex);
    });
    const active = list.querySelector('.toolbox-color.is-active .toolbox-color__main');
    active?.scrollIntoView({ block: 'nearest' });
  }

  function revealAt(index: number): void {
    const visible = visibleRows();
    const hit = visible[index];
    if (!hit) return;
    actions.revealColorLine(hit.line);
  }

  function copy(raw: string): void {
    if (!raw) return;
    actions.copyColorText(raw);
  }

  function render(): void {
    const visible = visibleRows();
    count.textContent = String(visible.length);
    source.textContent = sourceLabel;
    source.title = sourceLabel;

    for (const [kind, button] of chipButtons) {
      button.setAttribute('aria-pressed', filter.isActive(kind) ? 'true' : 'false');
    }

    list.replaceChildren();
    if (visible.length === 0) {
      empty.hidden = false;
      empty.textContent =
        rows.length === 0
          ? sourceLabel === 'No Pine editor'
            ? 'Open a Pine editor to scan colors.'
            : 'No colors in this script. Add a hex, color.* name, color.rgb, or color.new.'
          : 'No colors match this filter.';
    } else {
      empty.hidden = true;
      for (let index = 0; index < visible.length; index += 1) {
        const hit = visible[index];
        if (hit) list.append(rowItem(hit, index));
      }
    }
    syncActive(visible);
  }

  return {
    root,
    setData(raw) {
      const data = parseColorsData(raw);
      rows = data.colors;
      sourceLabel = data.sourceLabel;
      activeIndex = 0;
      render();
    },
  };
}
