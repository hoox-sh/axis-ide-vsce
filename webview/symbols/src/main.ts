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
 * AXIS Symbols studio webview on the shared runtime + studio.* protocol.
 * Host posts studio.init / studio.set with data `{ symbols, query,
 * category }`. Click inserts; Shift-click or Copy copies. Recent inserts
 * persist in webview state via setState. Status text is local
 * ("Inserted" / "Copied").
 */

import '@axis-shared/tokens.css';
import '@axis-shared/theme.css';
import '@axis-shared/components.css';
import './style.css';
import { createStudio } from '@axis-shared/studio';
import { createFilter } from '@axis-shared/state';
import { setHidden, setText } from '@axis-shared/dom';
import {
  SYMBOLS_VIEW,
  decodeSymbolsSet,
  encodeSymbolsCopy,
  encodeSymbolsInsert,
  encodeSymbolsReady,
  symbolRowFrom,
  type SymbolRow,
} from './protocol';

// Shared lifecycle runtime: owns the acquireVsCodeApi singleton, host
// message subscription, safe posting, and disposal on pagehide.
const studio = createStudio({ view: SYMBOLS_VIEW });

const CHIPS: ReadonlyArray<{ id: string; label: string }> = [
  { id: '', label: 'All' },
  { id: 'arrows', label: 'Arrows' },
  { id: 'shapes', label: 'Shapes' },
  { id: 'box', label: 'Box' },
  { id: 'checks', label: 'Checks' },
  { id: 'stars', label: 'Stars' },
];

const CATEGORY_IDS = new Set(['arrows', 'shapes', 'box', 'checks', 'stars']);
const RECENT_MAX = 8;

type PersistedState = {
  recent: SymbolRow[];
};

let shellReady = false;
let userEdited = false;
let received = false;
let catalog: SymbolRow[] = [];
let recent: SymbolRow[] = [];

// Shared filter machine. In-memory only (no persistKey / api) to keep the
// pre-migration behavior: query + category start empty on every webview
// load. The '' chip is the All chip, as before.
const symbolFilter = createFilter({
  chips: ['', 'arrows', 'shapes', 'box', 'checks', 'stars'],
  initial: { query: '', filter: '' },
  onChange: () => {
    render();
  },
});

function canonicalCategory(value: string): string {
  const raw = value.trim().toLowerCase();
  if (raw === '' || raw === 'all') return '';
  return CATEGORY_IDS.has(raw) ? raw : '';
}

function readPersisted(raw: unknown): SymbolRow[] {
  try {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const list = (raw as PersistedState).recent;
    if (!Array.isArray(list)) return [];
    const out: SymbolRow[] = [];
    for (const item of list) {
      const row = symbolRowFrom(item);
      if (row) out.push(row);
      if (out.length >= RECENT_MAX) break;
    }
    return out;
  } catch {
    return [];
  }
}

function persistRecent(): void {
  studio.setState({ recent } satisfies PersistedState);
}

function pushRecent(symbol: SymbolRow): void {
  const next = recent.filter((row) => row.id !== symbol.id);
  next.unshift({
    id: symbol.id,
    category: symbol.category,
    char: symbol.char,
    name: symbol.name,
  });
  recent = next.slice(0, RECENT_MAX);
  persistRecent();
  renderRecent();
}

function ensureRoot(): HTMLElement {
  const existing = document.getElementById('symbols-root');
  if (existing) return existing;
  const el = document.createElement('div');
  el.id = 'symbols-root';
  el.className = 'symbols-root';
  document.body.appendChild(el);
  return el;
}

function ensureLive(): HTMLElement {
  const existing = document.getElementById('symbols-live');
  if (existing) return existing;
  const el = document.createElement('div');
  el.id = 'symbols-live';
  el.className = 'symbols-live';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  document.body.prepend(el);
  return el;
}

function visibleSymbols(): SymbolRow[] {
  const { query, filter } = symbolFilter.get();
  const q = query.trim().toLowerCase();
  return catalog.filter((symbol) => {
    if (filter && symbol.category !== filter) return false;
    if (!q) return true;
    return (
      symbol.name.toLowerCase().includes(q) ||
      symbol.id.toLowerCase().includes(q) ||
      symbol.char.toLowerCase().includes(q)
    );
  });
}

function announce(status: 'Inserted' | 'Copied'): void {
  const live = ensureLive();
  live.textContent = '';
  window.setTimeout(() => {
    if (live.isConnected) live.textContent = status;
  }, 30);
}

function findByChar(text: string): SymbolRow | null {
  for (const symbol of catalog) {
    if (symbol.char === text) return symbol;
  }
  for (const symbol of recent) {
    if (symbol.char === text) return symbol;
  }
  return null;
}

function act(text: string, copy: boolean): void {
  if (!text) return;
  if (copy) {
    studio.post(encodeSymbolsCopy(text));
    announce('Copied');
    return;
  }
  studio.post(encodeSymbolsInsert(text));
  announce('Inserted');
  const symbol = findByChar(text);
  if (symbol) pushRecent(symbol);
}

function symbolItem(symbol: SymbolRow): HTMLDivElement {
  const item = document.createElement('div');
  item.className = 'symbols-item';
  item.setAttribute('role', 'listitem');

  const insert = document.createElement('button');
  insert.type = 'button';
  insert.className = 'symbols-insert';
  insert.setAttribute('data-action', 'insert');
  insert.setAttribute('data-text', symbol.char);
  insert.setAttribute('data-id', symbol.id);
  insert.setAttribute('aria-label', `Insert ${symbol.name}`);
  insert.title = `${symbol.name}. Click to insert. Shift-click to copy.`;

  const glyph = document.createElement('span');
  glyph.className = 'symbols-glyph';
  glyph.textContent = symbol.char;
  glyph.setAttribute('aria-hidden', 'true');

  const name = document.createElement('span');
  name.className = 'symbols-name';
  name.textContent = symbol.name;

  insert.append(glyph, name);

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'symbols-copy';
  copy.textContent = 'Copy';
  copy.setAttribute('data-action', 'copy');
  copy.setAttribute('data-text', symbol.char);
  copy.setAttribute('aria-label', `Copy ${symbol.name}`);
  copy.title = `Copy ${symbol.name}`;

  item.append(insert, copy);
  return item;
}

function renderChips(): void {
  const chips = document.getElementById('symbols-chips');
  if (!chips) return;
  chips.querySelectorAll('button').forEach((button) => {
    const id = button.getAttribute('data-category') ?? '';
    const on = symbolFilter.isActive(id);
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
    button.classList.toggle('is-active', on);
  });
}

function renderRecent(): void {
  const section = document.getElementById('symbols-recent');
  const strip = document.getElementById('symbols-recent-strip');
  if (!section || !strip) return;
  section.hidden = recent.length === 0;
  strip.replaceChildren();
  for (const symbol of recent) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'symbols-recent__btn';
    button.textContent = symbol.char;
    button.title = `${symbol.name}. Click to insert. Shift-click to copy.`;
    button.setAttribute('aria-label', `Insert ${symbol.name}`);
    button.setAttribute('data-action', 'insert');
    button.setAttribute('data-text', symbol.char);
    button.setAttribute('data-id', symbol.id);
    strip.append(button);
  }
}

function renderGrid(): void {
  const grid = document.getElementById('symbols-grid');
  const empty = document.getElementById('symbols-empty');
  if (!grid || !empty) return;
  const rows = visibleSymbols();
  setText('symbols-count', String(rows.length));
  grid.replaceChildren();
  for (const symbol of rows) grid.append(symbolItem(symbol));
  const showEmpty = rows.length === 0;
  setHidden('symbols-empty', !showEmpty);
  if (showEmpty) {
    const { query, filter } = symbolFilter.get();
    if (!received) empty.textContent = 'Loading symbols…';
    else if (query.trim() || filter) empty.textContent = 'No symbols match your search.';
    else empty.textContent = 'No symbols available.';
  }
}

function render(): void {
  ensureShell();
  const search = document.getElementById('symbols-search');
  const query = symbolFilter.get().query;
  if (search instanceof HTMLInputElement && document.activeElement !== search && search.value !== query) {
    search.value = query;
  }
  renderChips();
  renderRecent();
  renderGrid();
}

function ensureShell(): void {
  if (shellReady) return;
  shellReady = true;
  const root = ensureRoot();
  root.replaceChildren();

  const shell = document.createElement('section');
  shell.className = 'symbols-shell';
  shell.setAttribute('aria-label', 'Symbols');

  const header = document.createElement('header');
  header.className = 'symbols-header';

  const top = document.createElement('div');
  top.className = 'symbols-header__top';

  const title = document.createElement('h1');
  title.className = 'symbols-title';
  title.textContent = 'Symbols';

  const count = document.createElement('span');
  count.id = 'symbols-count';
  count.className = 'symbols-count';
  count.textContent = '0';

  top.append(title, count);

  const hint = document.createElement('p');
  hint.id = 'symbols-hint';
  hint.className = 'symbols-hint';
  hint.textContent = 'Click to insert. Shift-click or Copy to copy. Hover a glyph for its name.';

  const label = document.createElement('label');
  label.className = 'symbols-search-label';
  label.htmlFor = 'symbols-search';
  label.textContent = 'Search';

  const search = document.createElement('input');
  search.id = 'symbols-search';
  search.className = 'symbols-search';
  search.type = 'search';
  search.placeholder = 'Name or glyph';
  search.autocomplete = 'off';
  search.spellcheck = false;
  search.setAttribute('aria-label', 'Search symbols');
  search.value = symbolFilter.get().query;
  search.addEventListener('input', () => {
    userEdited = true;
    symbolFilter.setQuery(search.value);
  });

  const chips = document.createElement('div');
  chips.id = 'symbols-chips';
  chips.className = 'symbols-chips';
  chips.setAttribute('role', 'toolbar');
  chips.setAttribute('aria-label', 'Symbol category');
  for (const chip of CHIPS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'symbols-chip';
    button.textContent = chip.label;
    button.setAttribute('data-category', chip.id);
    button.setAttribute('aria-pressed', symbolFilter.isActive(chip.id) ? 'true' : 'false');
    button.addEventListener('click', () => {
      userEdited = true;
      symbolFilter.setFilter(chip.id);
    });
    chips.append(button);
  }

  const recentSection = document.createElement('section');
  recentSection.id = 'symbols-recent';
  recentSection.className = 'symbols-recent';
  recentSection.hidden = true;
  recentSection.setAttribute('aria-label', 'Recent symbols');

  const recentLabel = document.createElement('p');
  recentLabel.className = 'symbols-recent__label';
  recentLabel.textContent = 'Recent';

  const recentStrip = document.createElement('div');
  recentStrip.id = 'symbols-recent-strip';
  recentStrip.className = 'symbols-recent__strip';
  recentStrip.setAttribute('role', 'list');
  recentStrip.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('button');
    if (!(button instanceof HTMLButtonElement) || !recentStrip.contains(button)) return;
    const text = button.getAttribute('data-text') ?? '';
    act(text, event.shiftKey);
  });

  recentSection.append(recentLabel, recentStrip);

  const grid = document.createElement('div');
  grid.id = 'symbols-grid';
  grid.className = 'symbols-grid';
  grid.setAttribute('role', 'list');
  grid.setAttribute('aria-label', 'Symbols');
  grid.setAttribute('aria-describedby', 'symbols-hint');
  grid.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('button');
    if (!(button instanceof HTMLButtonElement) || !grid.contains(button)) return;
    const text = button.getAttribute('data-text') ?? '';
    const action = button.getAttribute('data-action');
    act(text, action === 'copy' || event.shiftKey);
  });
  grid.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (!event.shiftKey) return;
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    if (target.getAttribute('data-action') !== 'insert') return;
    const text = target.getAttribute('data-text') ?? '';
    if (!text) return;
    event.preventDefault();
    act(text, true);
  });

  const empty = document.createElement('p');
  empty.id = 'symbols-empty';
  empty.className = 'symbols-empty';
  empty.textContent = 'Loading symbols…';

  header.append(top, hint, label, search, chips, recentSection);
  shell.append(header, grid, empty);
  root.append(shell);
}

function onHostMessage(message: unknown): void {
  const decoded = decodeSymbolsSet(message);
  if (!decoded) return;
  catalog = decoded.symbols;
  received = true;
  if (!userEdited) {
    symbolFilter.setQuery(decoded.query.trim());
    symbolFilter.setFilter(canonicalCategory(decoded.category));
  }
  render();
}

function main(): void {
  recent = readPersisted(studio.getState());
  studio.onMessage(onHostMessage);
  ensureLive();
  render();
  studio.post(encodeSymbolsReady());
}

main();
