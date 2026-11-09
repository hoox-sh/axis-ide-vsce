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
 * AXIS Watchlist studio on the shared runtime + studio.* protocol.
 *
 * The webview builds its shell from shared `ax-*` components and diffs the
 * incoming snapshot so only changed rows are touched. Row background flashes
 * (`axis-wl-flash-up/down`) fire when a tick moves price up or down; the class
 * is removed after one animation cycle and disabled under reduced motion.
 */

import '@axis-shared/tokens.css';
import '@axis-shared/theme.css';
import '@axis-shared/motion.css';
import '@axis-shared/components.css';
import './style.css';
import { btn, capsule, empty, header, panel, row, search } from '@axis-shared/components';
import { createStudio } from '@axis-shared/studio';
import {
  WATCHLIST_VIEW,
  decodeWatchlistSet,
  encodeWatchlistAdd,
  encodeWatchlistReady,
  encodeWatchlistRemove,
  encodeWatchlistSelect,
  normalizeWatchlistSymbol,
  snapshotFromPayload,
  type WatchlistRowView,
  type WatchlistViewSnapshot,
} from './protocol';

const studio = createStudio({ view: WATCHLIST_VIEW });

/** Last parsed numeric price per symbol, used to detect tick direction. */
const prices = new Map<string, number>();

/** Live DOM row references so snapshots can be diffed, not rebuilt. */
const rowRefs = new Map<string, RowRef>();

let countEl: HTMLElement | null = null;
let selectedEl: HTMLElement | null = null;
let priceEl: HTMLElement | null = null;
let badgeEl: HTMLElement | null = null;
let addInput: HTMLInputElement | null = null;
let listEl: HTMLElement | null = null;
let emptyEl: HTMLElement | null = null;
let liveRegion: HTMLElement | null = null;

interface RowRef {
  li: HTMLElement;
  check: Element;
  main: HTMLElement;
  price: HTMLElement;
}

/* ------------------------------------------------------------------ *
 * Price parsing — anything that is not a digit, dot, or minus sign is
 * stripped before feeding to Number().
 * ------------------------------------------------------------------ */

function parsePrice(text: string): number | null {
  const cleaned = text.replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/* ------------------------------------------------------------------ *
 * Snapshot helpers.
 * ------------------------------------------------------------------ */

function countLabel(count: number): string {
  return count === 1 ? '1 symbol' : `${count} symbols`;
}

function selectedLabel(snap: WatchlistViewSnapshot): string {
  if (snap.selected) return `Selected ${snap.selected}`;
  if (snap.focusSymbol) return `Status bar follows ${snap.focusSymbol}`;
  return 'No symbol selected';
}

/* ------------------------------------------------------------------ *
 * Announcer.
 * ------------------------------------------------------------------ */

function announce(text: string): void {
  const el = liveRegion;
  if (!el) return;
  el.textContent = '';
  window.requestAnimationFrame(() => {
    if (liveRegion === el) el.textContent = text;
  });
}

/* ------------------------------------------------------------------ *
 * Row contents.
 * ------------------------------------------------------------------ */

function checkSvg(): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'watchlist-check');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', 'M6.2 11.2 3 8l1.1-1.1 2.1 2.1 5.7-5.7L13 4.4z');
  svg.append(path);
  return svg;
}

function emptyCheck(): HTMLElement {
  const span = document.createElement('span');
  span.className = 'watchlist-check';
  span.setAttribute('aria-hidden', 'true');
  return span;
}

function actionButton(action: 'select' | 'remove', symbol: string, label: string): HTMLButtonElement {
  return btn({
    label,
    variant: action === 'remove' ? 'ghost' : 'secondary',
    size: 'sm',
    className: 'watchlist-btn',
    ariaLabel: `${label} ${symbol}`,
    dataset: { action, symbol },
  });
}

function createRow(item: WatchlistRowView): RowRef {
  const check = item.selected ? checkSvg() : emptyCheck();
  const symbol = document.createElement('span');
  symbol.className = 'watchlist-symbol';
  symbol.textContent = item.symbol;

  const price = document.createElement('span');
  price.className = 'watchlist-row__price';
  price.textContent = item.priceText;

  const main = document.createElement('div');
  main.className = 'watchlist-row__main';
  main.append(symbol, price);

  const li = row({
    as: 'li',
    active: item.selected,
    className: 'watchlist-row',
    children: [check, main],
    actions: [actionButton('select', item.symbol, 'Select'), actionButton('remove', item.symbol, 'Remove')],
  });
  li.dataset.symbol = item.symbol;
  if (item.selected) li.setAttribute('aria-current', 'true');
  li.addEventListener('animationend', onFlashEnd);

  return { li, check, main, price };
}

function updateCheck(ref: RowRef, selected: boolean): void {
  const isCheck = ref.check instanceof SVGElement;
  if (selected === isCheck) return;
  ref.check.remove();
  ref.check = selected ? checkSvg() : emptyCheck();
  ref.li.insertBefore(ref.check, ref.main);
}

function onFlashEnd(event: AnimationEvent): void {
  if (event.animationName !== 'axis-wl-flash-up' && event.animationName !== 'axis-wl-flash-down') return;
  const target = event.currentTarget;
  if (target instanceof HTMLElement) {
    target.classList.remove('axis-wl-flash-up', 'axis-wl-flash-down');
  }
}

function applyTickFlash(ref: RowRef, currentValue: number): void {
  const symbol = ref.li.dataset.symbol;
  if (!symbol) return;
  const previousValue = prices.get(symbol);
  if (previousValue == null || currentValue === previousValue) return;

  const cls = currentValue > previousValue ? 'axis-wl-flash-up' : 'axis-wl-flash-down';
  ref.li.classList.remove('axis-wl-flash-up', 'axis-wl-flash-down');
  ref.li.classList.add(cls);
}

function updateRow(item: WatchlistRowView): void {
  const ref = rowRefs.get(item.symbol);
  if (!ref) return;

  ref.li.classList.toggle('is-active', item.selected);
  if (item.selected) {
    ref.li.setAttribute('aria-current', 'true');
  } else {
    ref.li.removeAttribute('aria-current');
  }
  updateCheck(ref, item.selected);

  const value = parsePrice(item.priceText);
  if (ref.price.textContent !== item.priceText) {
    ref.price.textContent = item.priceText;
  }
  if (value != null) {
    applyTickFlash(ref, value);
    prices.set(item.symbol, value);
  }
}

/* ------------------------------------------------------------------ *
 * Snapshot render: diff rows so tick flashes and focus are preserved.
 * ------------------------------------------------------------------ */

function renderSnapshot(snap: WatchlistViewSnapshot): void {
  if (countEl) countEl.textContent = countLabel(snap.count);
  if (selectedEl) selectedEl.textContent = selectedLabel(snap);
  if (priceEl) priceEl.textContent = snap.focusPriceText || '—';
  if (badgeEl) badgeEl.hidden = !snap.placeholder;

  const desired = new Set<string>();
  if (listEl) {
    for (const item of snap.rows) {
      desired.add(item.symbol);
      const existing = rowRefs.get(item.symbol);
      if (existing) {
        updateRow(item);
        listEl.append(existing.li);
      } else {
        const created = createRow(item);
        rowRefs.set(item.symbol, created);
        const initialValue = parsePrice(item.priceText);
        if (initialValue != null) prices.set(item.symbol, initialValue);
        listEl.append(created.li);
      }
    }
  }

  for (const [symbol, ref] of rowRefs) {
    if (!desired.has(symbol)) {
      ref.li.remove();
      rowRefs.delete(symbol);
      prices.delete(symbol);
    }
  }

  if (emptyEl) emptyEl.hidden = snap.rows.length > 0;
}

/* ------------------------------------------------------------------ *
 * User actions.
 * ------------------------------------------------------------------ */

function onSubmit(event: Event): void {
  event.preventDefault();
  const input = addInput;
  if (!input) return;
  const symbol = normalizeWatchlistSymbol(input.value);
  if (!symbol) {
    announce('Could not add');
    return;
  }
  studio.post(encodeWatchlistAdd(symbol));
  input.value = '';
}

function onClick(event: Event): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest('button[data-action]');
  if (!(button instanceof HTMLButtonElement)) return;
  const symbol = normalizeWatchlistSymbol(button.dataset.symbol);
  if (!symbol) return;
  const action = button.dataset.action;
  if (action === 'select') {
    announce(`Selected ${symbol}`);
    studio.post(encodeWatchlistSelect(symbol));
    return;
  }
  if (action === 'remove') {
    announce(`Removed ${symbol}`);
    studio.post(encodeWatchlistRemove(symbol));
  }
}

/* ------------------------------------------------------------------ *
 * Shell construction.
 * ------------------------------------------------------------------ */

function buildHeader(snap: WatchlistViewSnapshot): HTMLElement {
  const node = header({ title: 'Watchlist', count: snap.count });
  node.classList.add('watchlist-header');

  const body = document.createElement('div');
  body.className = 'watchlist-header__body';

  selectedEl = document.createElement('p');
  selectedEl.className = 'watchlist-header__meta';
  selectedEl.textContent = selectedLabel(snap);

  priceEl = document.createElement('p');
  priceEl.className = 'watchlist-price';
  priceEl.textContent = snap.focusPriceText || '—';

  badgeEl = capsule({ code: 'placeholder' });
  badgeEl.hidden = !snap.placeholder;

  body.append(selectedEl, priceEl, badgeEl);
  node.append(body);

  countEl = node.querySelector<HTMLElement>('.ax-header__count');
  return node;
}

function buildAddForm(): HTMLFormElement {
  const form = document.createElement('form');
  form.id = 'watchlist-add-form';
  form.className = 'watchlist-add';
  form.autocomplete = 'off';

  const label = document.createElement('label');
  label.className = 'watchlist-add__label';
  label.htmlFor = 'watchlist-symbol-input';
  label.textContent = 'Add symbol';

  addInput = search({
    ariaLabel: 'Add symbol',
    placeholder: 'BTCUSDT',
    restoreKey: 'add-symbol',
  });
  addInput.id = 'watchlist-symbol-input';
  addInput.spellcheck = false;

  const submit = btn({
    label: 'Add',
    variant: 'primary',
    type: 'submit',
    className: 'watchlist-btn',
  });

  form.append(label, addInput, submit);
  return form;
}

function buildList(): HTMLElement {
  const node = document.createElement('ul');
  node.id = 'watchlist-rows';
  node.className = 'watchlist-rows';
  return node;
}

function buildEmpty(): HTMLElement {
  return empty({
    hint: 'Add a ticker such as BTCUSDT. The status bar still follows the selected symbol.',
    className: 'watchlist-empty',
  });
}

function buildLiveRegion(): HTMLElement {
  const node = document.createElement('div');
  node.id = 'watchlist-live';
  node.className = 'watchlist-live';
  node.setAttribute('aria-live', 'polite');
  node.setAttribute('aria-atomic', 'true');
  return node;
}

/* ------------------------------------------------------------------ *
 * Entry.
 * ------------------------------------------------------------------ */

function main(): void {
  const root = document.getElementById('watchlist-root');
  if (!root) return;

  const initialSnap = snapshotFromPayload({});

  const headerNode = buildHeader(initialSnap);
  const form = buildAddForm();
  emptyEl = buildEmpty();
  listEl = buildList();
  liveRegion = buildLiveRegion();

  const surface = panel({
    className: 'watchlist-surface',
    children: [headerNode, form, emptyEl, listEl, liveRegion],
  });

  root.replaceChildren();
  root.append(surface);

  form.addEventListener('submit', onSubmit);
  root.addEventListener('click', onClick);

  studio.onMessage((message) => {
    const snap = decodeWatchlistSet(message);
    if (snap) renderSnapshot(snap);
  });

  studio.post(encodeWatchlistReady());
}

main();
