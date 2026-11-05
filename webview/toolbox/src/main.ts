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
 * Toolbox studio webview on the shared runtime + studio.* protocol.
 *
 * Host posts `studio.init` / `studio.set` with `view:'toolbox'` and a
 * composite data payload `{ activeTab, tabs: { colors, symbols } }`. The
 * active tab is owned client-side; switching emits a `studio.action`
 * `selectTab` to the host and persists through `setState`.
 *
 * View → host actions:
 *   selectTab, revealColorLine, copyColorText, refreshColors,
 *   insertSymbol, copySymbolText.
 */

import '@axis-shared/tokens.css';
import '@axis-shared/theme.css';
import '@axis-shared/components.css';
import './style.css';
import { header, tabs } from '@axis-shared/components';
import { createStudio } from '@axis-shared/studio';
import {
  decodeStudioAction,
  decodeStudioData,
  encodeStudioAction,
  encodeStudioReady,
  type StudioDataMessage,
} from '@axis-shared/studio-protocol';
import { createColorsTab } from './tabs/colors';
import { createSymbolsTab } from './tabs/symbols';

const TABS = ['colors', 'symbols'] as const;
type ToolboxTab = (typeof TABS)[number];

const TAB_LABELS: Record<ToolboxTab, string> = {
  colors: 'Colors',
  symbols: 'Symbols',
};

const MAX_COLOR_COPY = 256;
const MAX_SYMBOL_COPY = 16;

interface ToolboxData {
  activeTab: ToolboxTab;
  tabs: {
    colors: unknown;
    symbols: unknown;
  };
}

const studio = createStudio({ view: 'toolbox' });
let activeTab: ToolboxTab = 'colors';
let tabButtons: HTMLButtonElement[] = [];

const colorsTab = createColorsTab({
  revealColorLine,
  copyColorText,
  refreshColors,
});

const symbolsTab = createSymbolsTab({
  insertSymbol,
  copySymbolText,
});

/* ------------------------------------------------------------------ *
 * Validation helpers
 * ------------------------------------------------------------------ */

function isToolboxTab(value: unknown): value is ToolboxTab {
  return typeof value === 'string' && TABS.includes(value as ToolboxTab);
}

function isLineNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value < 1_000_000;
}

function asCopyText(value: string, max: number): string | null {
  const trimmed = value.slice(0, max).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/* ------------------------------------------------------------------ *
 * Client-side tab state
 * ------------------------------------------------------------------ */

function restoreActiveTab(): void {
  const state = studio.getState();
  if (!state || typeof state !== 'object') return;
  const saved = (state as Record<string, unknown>).activeTab;
  if (isToolboxTab(saved)) activeTab = saved;
}

function persistActiveTab(): void {
  studio.setState({ activeTab });
}

/* ------------------------------------------------------------------ *
 * Host action helpers
 * ------------------------------------------------------------------ */

function revealColorLine(line: number): void {
  if (!isLineNumber(line)) return;
  studio.post(encodeStudioAction('toolbox', 'revealColorLine', { line }));
}

function copyColorText(text: string): void {
  const valid = asCopyText(text, MAX_COLOR_COPY);
  if (!valid) return;
  studio.post(encodeStudioAction('toolbox', 'copyColorText', { text: valid }));
}

function refreshColors(): void {
  studio.post(encodeStudioAction('toolbox', 'refreshColors'));
}

function insertSymbol(text: string): void {
  const valid = asCopyText(text, MAX_SYMBOL_COPY);
  if (!valid) return;
  studio.post(encodeStudioAction('toolbox', 'insertSymbol', { text: valid }));
}

function copySymbolText(text: string): void {
  const valid = asCopyText(text, MAX_SYMBOL_COPY);
  if (!valid) return;
  studio.post(encodeStudioAction('toolbox', 'copySymbolText', { text: valid }));
}

/* ------------------------------------------------------------------ *
 * Tab switching
 * ------------------------------------------------------------------ */

function selectTab(tab: ToolboxTab): void {
  if (applyTab(tab)) {
    studio.post(encodeStudioAction('toolbox', 'selectTab', { tab: activeTab }));
  }
}

function syncTabs(): void {
  for (const button of tabButtons) {
    const selected = button.dataset.tabId === activeTab;
    button.setAttribute('aria-selected', selected ? 'true' : 'false');
  }
}

/* ------------------------------------------------------------------ *
 * Shell construction
 * ------------------------------------------------------------------ */

function buildHeader(): HTMLElement {
  const node = header({ title: 'Toolbox' });
  node.classList.add('toolbox-header');
  return node;
}

function buildTabs(): HTMLElement {
  const node = tabs({
    tabs: TABS.map((id) => ({ id, label: TAB_LABELS[id] })),
    active: activeTab,
    onSelect: (id) => {
      selectTab(id as ToolboxTab);
    },
  });
  node.classList.add('toolbox-tabs');
  tabButtons = Array.from(node.querySelectorAll<HTMLButtonElement>('.ax-tabs__tab'));
  return node;
}

function buildContent(): HTMLElement {
  const node = document.createElement('div');
  node.id = 'toolbox-content';
  node.className = 'toolbox-content';
  node.append(colorsTab.root, symbolsTab.root);
  return node;
}

/* ------------------------------------------------------------------ *
 * Render
 * ------------------------------------------------------------------ */

function render(): void {
  colorsTab.root.hidden = activeTab !== 'colors';
  symbolsTab.root.hidden = activeTab !== 'symbols';
}

/* ------------------------------------------------------------------ *
 * Host message handler
 * ------------------------------------------------------------------ */

function applyTab(tab: ToolboxTab): boolean {
  if (!isToolboxTab(tab) || tab === activeTab) return false;
  activeTab = tab;
  persistActiveTab();
  syncTabs();
  render();
  return true;
}

function onMessage(raw: unknown): void {
  const data = decodeStudioData(raw) as StudioDataMessage | null;
  if (data && data.view === 'toolbox') {
    const payload = (data.data ?? {}) as Partial<ToolboxData>;
    if (isPlainObject(payload.tabs)) {
      colorsTab.setData(payload.tabs.colors);
      symbolsTab.setData(payload.tabs.symbols);
      syncTabs();
      render();
    }
    return;
  }

  const action = decodeStudioAction(raw);
  if (action && action.view === 'toolbox') {
    if (action.action === 'selectTab') {
      const args = action.args;
      const tab = isPlainObject(args) && isToolboxTab(args.tab) ? args.tab : undefined;
      if (tab) applyTab(tab);
    }
  }
}

/* ------------------------------------------------------------------ *
 * Entry
 * ------------------------------------------------------------------ */

function main(): void {
  restoreActiveTab();

  const root = document.getElementById('toolbox-root');
  if (!root) return;
  root.replaceChildren();
  root.append(buildHeader(), buildTabs(), buildContent());
  syncTabs();

  studio.onMessage(onMessage);
  render();
  studio.post(encodeStudioReady('toolbox'));
}

main();
