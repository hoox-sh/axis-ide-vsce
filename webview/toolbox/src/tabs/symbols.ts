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
 * Toolbox Symbols tab — minimal but functional symbol catalog grid. Clicking
 * a glyph inserts; Shift-clicking or the Copy button copies. Category chips
 * and search filter client-side through the shared filter machine.
 */

import { btn, search } from '@axis-shared/components';
import { createFilter } from '@axis-shared/state';

export interface SymbolsActions {
  /** Insert the symbol at the current cursor. */
  insertSymbol(text: string): void;
  /** Copy the symbol to the host clipboard. */
  copySymbolText(text: string): void;
}

interface SymbolRow {
  id: string;
  category: string;
  char: string;
  name: string;
}

type SymbolCategory = '' | 'arrows' | 'shapes' | 'box' | 'checks' | 'stars';

interface CategoryChip {
  id: SymbolCategory;
  label: string;
}

const CHIPS: readonly CategoryChip[] = [
  { id: '', label: 'All' },
  { id: 'arrows', label: 'Arrows' },
  { id: 'shapes', label: 'Shapes' },
  { id: 'box', label: 'Box' },
  { id: 'checks', label: 'Checks' },
  { id: 'stars', label: 'Stars' },
];

const CATEGORY_IDS = new Set(CHIPS.map((chip) => chip.id));

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isSymbolRow(value: unknown): value is SymbolRow {
  if (!isPlainObject(value)) return false;
  const id = value.id;
  const category = value.category;
  const char = value.char;
  const name = value.name;
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    typeof category === 'string' &&
    typeof char === 'string' &&
    char.length > 0 &&
    typeof name === 'string' &&
    name.length > 0
  );
}

function canonicalCategory(value: string): SymbolCategory {
  const raw = value.trim().toLowerCase();
  if (raw === '' || raw === 'all') return '';
  if (raw === 'arrows' || raw === 'shapes' || raw === 'box' || raw === 'checks' || raw === 'stars') {
    return raw;
  }
  return '';
}

interface ParsedSymbolsData {
  symbols: SymbolRow[];
  query: string;
  category: SymbolCategory;
}

function parseSymbolsData(value: unknown): ParsedSymbolsData | null {
  const data = isPlainObject(value) ? value : {};
  if (!Array.isArray(data.symbols)) return null;
  const query = typeof data.query === 'string' ? data.query : '';
  const category = canonicalCategory(typeof data.category === 'string' ? data.category : '');
  const symbols: SymbolRow[] = [];
  for (const item of data.symbols) {
    if (isSymbolRow(item)) symbols.push(item);
  }
  return { symbols, query, category };
}

/** One-stop Symbols tab factory. */
export function createSymbolsTab(actions: SymbolsActions): {
  root: HTMLElement;
  setData(raw: unknown): void;
} {
  let catalog: SymbolRow[] = [];
  let received = false;
  let userEdited = false;

  const filter = createFilter({
    chips: ['', ...Array.from(CATEGORY_IDS)],
    initial: { query: '', filter: '' },
    onChange: () => {
      render();
    },
  });

  const root = document.createElement('section');
  root.className = 'toolbox-tab-panel toolbox-symbols';
  root.setAttribute('role', 'tabpanel');
  root.setAttribute('aria-label', 'Symbols');

  const header = document.createElement('div');
  header.className = 'toolbox-symbols__header';

  const title = document.createElement('h2');
  title.className = 'toolbox-symbols__title';
  title.textContent = 'Symbols';

  const count = document.createElement('span');
  count.className = 'toolbox-symbols__count';
  count.textContent = '0';

  header.append(title, count);

  const hint = document.createElement('p');
  hint.className = 'toolbox-symbols__hint';
  hint.textContent = 'Click to insert. Shift-click or Copy to copy.';

  const searchField = search({
    placeholder: 'Name or glyph',
    ariaLabel: 'Search symbols',
    onInput: (value) => {
      userEdited = true;
      filter.setQuery(value);
    },
  });
  searchField.classList.add('toolbox-symbols__search');

  const chips = document.createElement('div');
  chips.className = 'toolbox-symbols__chips';
  const chipButtons = new Map<SymbolCategory, HTMLButtonElement>();
  for (const chip of CHIPS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ax-chip toolbox-symbols__chip';
    button.textContent = chip.label;
    button.dataset.category = chip.id;
    button.setAttribute('aria-pressed', filter.isActive(chip.id) ? 'true' : 'false');
    button.addEventListener('click', () => {
      userEdited = true;
      filter.setFilter(chip.id);
    });
    chipButtons.set(chip.id, button);
    chips.append(button);
  }

  const grid = document.createElement('div');
  grid.className = 'toolbox-symbols__grid';
  grid.setAttribute('role', 'list');
  grid.setAttribute('aria-label', 'Symbols');
  grid.setAttribute('aria-describedby', 'toolbox-symbols-hint');
  grid.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('button[data-text]');
    if (!button || !grid.contains(button)) return;
    const text = button.dataset.text ?? '';
    const action = button.dataset.action;
    act(text, action === 'copy' || event.shiftKey);
  });

  hint.id = 'toolbox-symbols-hint';

  const empty = document.createElement('p');
  empty.className = 'toolbox-empty';
  empty.hidden = true;

  root.append(header, hint, searchField, chips, grid, empty);

  function visibleSymbols(): SymbolRow[] {
    const state = filter.get();
    const category = state.filter;
    const query = state.query.trim().toLowerCase();
    return catalog.filter((symbol) => {
      if (category && symbol.category !== category) return false;
      if (!query) return true;
      return (
        symbol.name.toLowerCase().includes(query) ||
        symbol.id.toLowerCase().includes(query) ||
        symbol.char.toLowerCase().includes(query)
      );
    });
  }

  function act(text: string, copy: boolean): void {
    if (!text) return;
    if (copy) {
      actions.copySymbolText(text);
    } else {
      actions.insertSymbol(text);
    }
  }

  function symbolItem(symbol: SymbolRow): HTMLDivElement {
    const item = document.createElement('div');
    item.className = 'toolbox-symbol';
    item.setAttribute('role', 'listitem');

    const insert = document.createElement('button');
    insert.type = 'button';
    insert.className = 'toolbox-symbol__insert';
    insert.dataset.action = 'insert';
    insert.dataset.text = symbol.char;
    insert.title = `${symbol.name}. Click to insert. Shift-click to copy.`;
    insert.setAttribute('aria-label', `Insert ${symbol.name}`);
    insert.append(
      Object.assign(document.createElement('span'), {
        className: 'toolbox-symbol__char',
        textContent: symbol.char,
        ariaHidden: 'true',
      }),
      Object.assign(document.createElement('span'), {
        className: 'toolbox-symbol__name',
        textContent: symbol.name,
      }),
    );

    const copyBtn = btn({
      label: 'Copy',
      variant: 'ghost',
      size: 'sm',
      className: 'toolbox-symbol__copy',
      title: `Copy ${symbol.name}`,
      ariaLabel: `Copy ${symbol.name}`,
      dataset: { action: 'copy', text: symbol.char },
    });

    item.append(insert, copyBtn);
    return item;
  }

  function render(): void {
    const visible = visibleSymbols();
    count.textContent = String(visible.length);

    for (const [id, button] of chipButtons) {
      button.setAttribute('aria-pressed', filter.isActive(id) ? 'true' : 'false');
    }

    grid.replaceChildren();
    if (visible.length === 0) {
      empty.hidden = false;
      const state = filter.get();
      if (!received) empty.textContent = 'Loading symbols…';
      else if (state.query.trim() || state.filter) empty.textContent = 'No symbols match your search.';
      else empty.textContent = 'No symbols available.';
    } else {
      empty.hidden = true;
      for (const symbol of visible) grid.append(symbolItem(symbol));
    }
  }

  return {
    root,
    setData(raw) {
      const data = parseSymbolsData(raw);
      if (!data) return;
      catalog = data.symbols;
      received = true;
      if (!userEdited) {
        filter.setQuery(data.query.trim());
        filter.setFilter(data.category);
      }
      render();
    },
  };
}
