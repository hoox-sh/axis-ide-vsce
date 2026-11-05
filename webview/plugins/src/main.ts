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
 * AXIS Plugins studio on the shared runtime + studio.* protocol.
 * Host posts studio.init (catalog + active + flags) / studio.set (active +
 * flags); the view posts studio.ready and studio.action activate.
 */

import '@axis-shared/tokens.css';
import '@axis-shared/theme.css';
import '@axis-shared/components.css';
import './style.css';
import { header, tabs, search } from '@axis-shared/components';
import { createStudio } from '@axis-shared/studio';
import { captureFocus, restoreFocus } from '@axis-shared/dom';
import {
  PLUGINS_VIEW,
  decodePluginsStudioMessage,
  encodePluginsActivate,
  encodePluginsReady,
  isKindTab,
  type KindTab,
  type PluginKind,
} from './protocol';
import { kindIconNode, renderActiveChips, renderPluginsBody } from './render';
import {
  ACTIVATE_FLASH_MS,
  COPY_FLASH_MS,
  KIND_LABELS,
  KIND_TABS,
  applyActivateFlash,
  applyCopiedFlash,
  applyPluginsHostMessage,
  filterCount,
  formatFilterCount,
  initialPluginsState,
  setKindTab,
  setSearchQuery,
  tabFromPersisted,
  type PluginsViewState,
} from './state';

const studio = createStudio({ view: PLUGINS_VIEW });

let state: PluginsViewState = initialPluginsState();
let root: HTMLElement | null = null;
let liveRegion: HTMLElement | null = null;
let headerNode: HTMLElement | null = null;
let searchInput: HTMLInputElement | null = null;
let tabsNode: HTMLElement | null = null;
let statusRowNode: HTMLElement | null = null;
let bodyNode: HTMLElement | null = null;
let tabButtons: HTMLButtonElement[] = [];

let disposed = false;
let copyFlashKey: { kind: string; id: string } | null = null;
let copyFlashTimer: ReturnType<typeof setTimeout> | null = null;
let activateFlashKey: { kind: string; id: string } | null = null;
let activateFlashTimer: ReturnType<typeof setTimeout> | null = null;

function persistTab(tab: KindTab): void {
  try {
    studio.setState({ tab });
  } catch {
    // host state is optional
  }
}

function copyButton(kind: string, id: string): HTMLButtonElement | null {
  if (!bodyNode) return null;
  try {
    const el = bodyNode.querySelector(
      `[data-action="copy-id"][data-kind="${CSS.escape(kind)}"][data-id="${CSS.escape(id)}"]`,
    );
    return el instanceof HTMLButtonElement ? el : null;
  } catch {
    return null;
  }
}

function cardPanel(kind: string, id: string): HTMLElement | null {
  if (!bodyNode) return null;
  try {
    const el = bodyNode.querySelector(
      `.plugin-card[data-kind="${CSS.escape(kind)}"][data-id="${CSS.escape(id)}"]`,
    );
    return el instanceof HTMLElement ? el : null;
  } catch {
    return null;
  }
}

function restoreFlashes(): void {
  if (copyFlashKey) {
    applyCopiedFlash(copyButton(copyFlashKey.kind, copyFlashKey.id), liveRegion, true);
  }
  if (activateFlashKey) {
    applyActivateFlash(cardPanel(activateFlashKey.kind, activateFlashKey.id), true);
  }
}

function startCopyFlash(button: HTMLButtonElement): void {
  const kind = button.dataset.kind ?? '';
  const id = button.dataset.id ?? '';
  if (copyFlashKey && (copyFlashKey.kind !== kind || copyFlashKey.id !== id)) {
    applyCopiedFlash(copyButton(copyFlashKey.kind, copyFlashKey.id), null, false);
  }
  copyFlashKey = { kind, id };
  applyCopiedFlash(button, liveRegion, true);
  if (copyFlashTimer) clearTimeout(copyFlashTimer);
  copyFlashTimer = setTimeout(() => {
    copyFlashTimer = null;
    const key = copyFlashKey;
    copyFlashKey = null;
    if (!disposed && key) {
      applyCopiedFlash(copyButton(key.kind, key.id), liveRegion, false);
    }
  }, COPY_FLASH_MS);
}

function startActivateFlash(kind: string, id: string): void {
  if (activateFlashKey) {
    applyActivateFlash(cardPanel(activateFlashKey.kind, activateFlashKey.id), false);
  }
  activateFlashKey = { kind, id };
  applyActivateFlash(cardPanel(kind, id), true);
  if (activateFlashTimer) clearTimeout(activateFlashTimer);
  activateFlashTimer = setTimeout(() => {
    activateFlashTimer = null;
    const key = activateFlashKey;
    activateFlashKey = null;
    if (!disposed && key) {
      applyActivateFlash(cardPanel(key.kind, key.id), false);
    }
  }, ACTIVATE_FLASH_MS);
}

function copyPluginId(id: string): void {
  const text = id.trim();
  if (!text) return;
  const fallbackCopy = (): void => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    } catch {
      // clipboard unavailable
    }
  };
  try {
    const clip = navigator.clipboard;
    if (clip && typeof clip.writeText === 'function') {
      void clip.writeText(text).catch(() => {
        fallbackCopy();
      });
      return;
    }
  } catch {
    // fall through
  }
  fallbackCopy();
}

function postActivate(kind: string, id: string): void {
  const msg = encodePluginsActivate(kind, id);
  if (!msg) return;
  studio.post(msg);
}

function syncTabs(): void {
  for (const button of tabButtons) {
    const selected = button.dataset.tabId === state.tab;
    button.setAttribute('aria-selected', selected ? 'true' : 'false');
  }
}

function selectTab(tab: KindTab): void {
  if (!isKindTab(tab) || tab === state.tab) return;
  state = setKindTab(state, tab);
  persistTab(state.tab);
  syncTabs();
  updateHeaderCount();
  updateBody(false);
}

function updateHeaderCount(): void {
  if (!headerNode) return;
  const count = filterCount(state);
  const countEl = headerNode.querySelector('.ax-header__count');
  if (countEl) countEl.textContent = formatFilterCount(count);
}

function focusSearch(): void {
  if (!searchInput) return;
  searchInput.focus();
  searchInput.select();
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return true;
  return el.isContentEditable;
}

function onGlobalKey(event: KeyboardEvent): void {
  if (disposed) return;
  if ((event.key === 'f' || event.key === 'F') && (event.ctrlKey || event.metaKey) && !event.altKey) {
    event.preventDefault();
    focusSearch();
    return;
  }
  if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !isTypingTarget(event.target)) {
    event.preventDefault();
    focusSearch();
  }
}

function onTabsKeyDown(event: KeyboardEvent): void {
  if (disposed || tabButtons.length === 0) return;
  const current = tabButtons.find((button) => button.getAttribute('aria-selected') === 'true');
  if (!current) return;

  if (event.key === 'Home') {
    event.preventDefault();
    selectTab('all');
    tabButtons[0]?.focus();
    return;
  }
  if (event.key === 'End') {
    event.preventDefault();
    selectTab(KIND_TABS[KIND_TABS.length - 1] ?? 'component');
    tabButtons[tabButtons.length - 1]?.focus();
  }
}

function onClick(event: MouseEvent): void {
  if (disposed) return;
  const target = event.target;
  if (!(target instanceof Element)) return;

  const chip = target.closest('[data-role="chip"]');
  if (chip instanceof HTMLButtonElement) {
    const tab = chip.dataset.tab;
    if (isKindTab(tab)) selectTab(tab);
    return;
  }

  const copy = target.closest('[data-action="copy-id"]');
  if (copy instanceof HTMLButtonElement) {
    const id = copy.dataset.id ?? '';
    copyPluginId(id);
    startCopyFlash(copy);
  }

  const activate = target.closest('[data-action="activate"]');
  if (activate instanceof HTMLButtonElement && !activate.disabled) {
    const kind = activate.dataset.kind ?? '';
    const id = activate.dataset.id ?? '';
    postActivate(kind, id);
    startActivateFlash(kind, id);
  }
}

function onBodyKeyDown(event: KeyboardEvent): void {
  if (disposed) return;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.classList.contains('plugin-card') && (event.key === 'Enter' || event.key === ' ')) {
    const btn = target.querySelector('[data-action="activate"]');
    if (btn instanceof HTMLButtonElement && !btn.disabled) {
      event.preventDefault();
      btn.click();
    }
  }
}

function onHostMessage(message: unknown): void {
  if (disposed) return;
  const decoded = decodePluginsStudioMessage(message);
  if (!decoded) return;
  state = applyPluginsHostMessage(state, decoded.kind, decoded.data);
  render();
}

function buildHeader(): HTMLElement {
  headerNode = header({ title: 'Plugins', count: formatFilterCount(filterCount(state)) });
  headerNode.classList.add('plugins-header');

  const searchWrap = document.createElement('div');
  searchWrap.className = 'plugins-search-wrap';
  searchInput = search({
    ariaLabel: 'Filter plugins by name, id, or description',
    placeholder: 'Filter plugins',
    value: state.query,
    restoreKey: 'plugins-search',
    className: 'plugins-search',
    onInput: (value) => {
      state = setSearchQuery(state, value);
      updateHeaderCount();
      updateBody(true);
    },
  });
  searchWrap.append(searchInput);
  headerNode.append(searchWrap);

  return headerNode;
}

function buildTabs(): HTMLElement {
  tabsNode = tabs({
    tabs: KIND_TABS.map((id) => ({
      id,
      label: KIND_LABELS[id],
      icon: id === 'all' ? undefined : kindIconNode(id as PluginKind),
    })),
    active: state.tab,
    onSelect: (id) => {
      selectTab(id as KindTab);
    },
  });
  tabsNode.classList.add('plugins-tabs');
  tabsNode.addEventListener('keydown', onTabsKeyDown);
  tabButtons = Array.from(tabsNode.querySelectorAll<HTMLButtonElement>('.ax-tabs__tab'));
  return tabsNode;
}

function buildStatusRow(): HTMLElement {
  statusRowNode = document.createElement('div');
  statusRowNode.className = 'plugins-status-row';
  statusRowNode.append(renderActiveChips(state, selectTab));
  return statusRowNode;
}

function buildBody(): HTMLElement {
  bodyNode = document.createElement('div');
  bodyNode.id = 'plugins-body';
  bodyNode.className = 'plugins-body';
  bodyNode.setAttribute('role', 'tabpanel');
  bodyNode.addEventListener('keydown', onBodyKeyDown);
  return bodyNode;
}

function updateStatusRow(): void {
  if (!statusRowNode) return;
  statusRowNode.replaceChildren(renderActiveChips(state, selectTab));
}

function updateBody(preserveScroll: boolean): void {
  if (!bodyNode) return;
  const focusKey = captureFocus();
  const scrollTop = preserveScroll ? bodyNode.scrollTop : 0;
  bodyNode.replaceChildren(renderPluginsBody(state));
  bodyNode.scrollTop = scrollTop;
  bodyNode.setAttribute('aria-label', KIND_LABELS[state.tab]);
  restoreFocus(focusKey);
  restoreFlashes();
}

function render(preserveScroll = true): void {
  updateHeaderCount();
  updateStatusRow();
  updateBody(preserveScroll);
}

function ensureRoot(): HTMLElement {
  const existing = document.getElementById('plugins-root');
  if (existing) return existing;
  const el = document.createElement('div');
  el.id = 'plugins-root';
  el.className = 'plugins-root';
  document.body.appendChild(el);
  return el;
}

function main(): void {
  state = initialPluginsState(tabFromPersisted(studio.getState()));
  root = ensureRoot();
  root.replaceChildren();

  liveRegion = document.createElement('div');
  liveRegion.id = 'plugins-live';
  liveRegion.className = 'plugins-live';
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');

  const headerEl = buildHeader();
  const tabsEl = buildTabs();
  const statusEl = buildStatusRow();
  const bodyEl = buildBody();
  root.append(liveRegion, headerEl, tabsEl, statusEl, bodyEl);

  syncTabs();
  render();

  document.addEventListener('keydown', onGlobalKey);
  root.addEventListener('click', onClick);

  window.addEventListener('pagehide', () => {
    disposed = true;
    searchInput = null;
    bodyNode = null;
    copyFlashKey = null;
    activateFlashKey = null;
    if (copyFlashTimer) clearTimeout(copyFlashTimer);
    if (activateFlashTimer) clearTimeout(activateFlashTimer);
    copyFlashTimer = null;
    activateFlashTimer = null;
  });

  studio.onMessage(onHostMessage);
  studio.post(encodePluginsReady());
}

main();
