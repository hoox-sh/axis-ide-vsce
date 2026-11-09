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
 * AXIS Scripts studio on the shared runtime + studio.* protocol.
 * Host posts studio.init / studio.set with data `{ snapshot }`; buttons
 * post studio.action run / openChart / apply; notices arrive as
 * studio.notice.
 *
 * UI is built entirely from ax-* components on the client. The host shell
 * (scripts-html.ts) only needs to provide `#scripts-root`; the original ids
 * and classes it emits are replaced on first render.
 */

import '@axis-shared/tokens.css';
import '@axis-shared/theme.css';
import '@axis-shared/motion.css';
import '@axis-shared/components.css';
import './style.css';
import {
  btn,
  chip,
  empty,
  header,
  kbd,
  kpi,
  panel,
  row,
  sectionTitle as axSectionTitle,
} from '@axis-shared/components';
import { createStudio } from '@axis-shared/studio';
import {
  SCRIPTS_VIEW,
  decodeScriptsStudioData,
  decodeScriptsStudioNotice,
  encodeScriptsApply,
  encodeScriptsOpenChart,
  encodeScriptsReady,
  encodeScriptsRun,
  type ScriptRunCard,
  type ScriptSuggestion,
  type ScriptsViewSnapshot,
} from './protocol';

const studio = createStudio({ view: SCRIPTS_VIEW });

const SCRIPTS_EMPTY_HINT = 'Run a Pine Script™';
const SCRIPTS_RUN_SHORTCUT = 'Ctrl+Enter';

type KpiKey =
  | 'title'
  | 'symbol'
  | 'interval'
  | 'mode'
  | 'status'
  | 'error'
  | 'at'
  | 'epoch';

interface KpiRefs {
  value: HTMLElement;
}

const els = {
  live: null as HTMLElement | null,
  lastEmpty: null as HTMLElement | null,
  lastContent: null as HTMLElement | null,
  kpis: {} as Record<KpiKey, KpiRefs>,
  suggestions: null as HTMLElement | null,
  suggestionsEmpty: null as HTMLElement | null,
};

function setLive(text: string): void {
  if (!els.live) return;
  if (els.live.textContent === text) els.live.textContent = '';
  els.live.textContent = text;
}

function formatAt(at: number): string {
  if (!at) return '—';
  try {
    return new Date(at).toLocaleString();
  } catch {
    return String(at);
  }
}

function runIcon(): SVGSVGElement {
  const svg = iconSvg(16, 16, 'scripts-btn__icon');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', 'M4 2.5v11l10-5.5L4 2.5z');
  svg.append(path);
  return svg;
}

function chartIcon(): SVGSVGElement {
  const svg = iconSvg(16, 16, 'scripts-btn__icon');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute(
    'd',
    'M2 13V3h2v8h10v2H2zm3-3 2.2-3 1.8 2.2L12 5l2 1.2-4.2 5.2-2-2.4L7 11 5 8.2V10z',
  );
  svg.append(path);
  return svg;
}

function listIcon(): SVGSVGElement {
  const svg = iconSvg(14, 14, 'scripts-list__icon');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', 'M2 3h12v2H2V3zm0 4h8v2H2V7zm0 4h10v2H2v-2z');
  svg.append(path);
  return svg;
}

function iconSvg(width: number, height: number, className: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', className);
  return svg;
}

function statusChip(status: 'ok' | 'error'): HTMLElement {
  return chip({
    label: status === 'error' ? 'error' : 'ok',
    value: status,
    pressed: false,
    className: status === 'error' ? 'scripts-chip--error' : 'scripts-chip--ok',
  });
}

function sectionTitle(text: string): HTMLElement {
  return axSectionTitle({ text, as: 'h2', className: 'scripts-section-title' });
}

function buildRunButton(): HTMLButtonElement {
  return btn({
    label: 'Run',
    variant: 'primary',
    icon: runIcon(),
    className: 'scripts-btn',
    onClick: () => {
      studio.post(encodeScriptsRun());
      setLive('Run started');
    },
  });
}

function buildOpenChartButton(): HTMLButtonElement {
  return btn({
    label: 'Open chart',
    variant: 'primary',
    icon: chartIcon(),
    className: 'scripts-btn',
    onClick: () => {
      studio.post(encodeScriptsOpenChart());
    },
  });
}

function buildKpiTile(label: string): { root: HTMLElement; refs: KpiRefs } {
  const tile = kpi({ label, value: '—' });
  const value = tile.querySelector<HTMLElement>('.ax-kpi__value');
  // The ax-kpi builder always creates a `.ax-kpi__value` child; the fallback
  // prevents the render loop from throwing if that contract ever changes.
  return { root: tile, refs: { value: value ?? document.createElement('span') } };
}

function setKpiTileHidden(key: KpiKey, hidden: boolean): void {
  const kpiRef = els.kpis[key];
  if (!kpiRef) return;
  const tile = kpiRef.value.parentElement;
  if (tile) tile.hidden = hidden;
}

function setKpiValue(key: KpiKey, content: string | Node): void {
  const kpiRef = els.kpis[key];
  if (!kpiRef) return;
  if (typeof content === 'string') {
    kpiRef.value.textContent = content;
  } else {
    kpiRef.value.textContent = '';
    kpiRef.value.append(content);
  }
}

function buildRowMain(item: ScriptSuggestion): HTMLElement {
  const main = document.createElement('div');
  main.className = 'scripts-row__main';
  const title = document.createElement('span');
  title.className = 'scripts-row__title';
  title.textContent = item.title || item.id;
  const meta = document.createElement('span');
  meta.className = 'scripts-row__meta';
  meta.textContent = `${item.kind || 'indicator'} · ${item.category || '—'}`;
  main.append(title, meta);
  return main;
}

function buildApplyButton(item: ScriptSuggestion): HTMLButtonElement {
  return btn({
    label: 'Apply',
    variant: 'secondary',
    size: 'sm',
    className: 'scripts-row__apply',
    onClick: () => {
      studio.post(encodeScriptsApply(item.id));
      setLive(`Applied ${item.title || item.id}`);
    },
  });
}

function renderSuggestions(rows: readonly ScriptSuggestion[]): void {
  if (!els.suggestions || !els.suggestionsEmpty) return;
  els.suggestions.replaceChildren();
  const hasRows = rows.length > 0;
  els.suggestions.hidden = !hasRows;
  els.suggestionsEmpty.hidden = hasRows;
  for (const item of rows) {
    const itemRow = row({
      as: 'li',
      children: [listIcon(), buildRowMain(item)],
      actions: [buildApplyButton(item)],
    });
    els.suggestions.append(itemRow);
  }
}

function applySnapshot(snap: ScriptsViewSnapshot): void {
  const card: ScriptRunCard | null = snap.lastRun;
  const hasCard = card != null;
  if (els.lastEmpty) els.lastEmpty.hidden = hasCard;
  if (els.lastContent) els.lastContent.hidden = !hasCard;
  if (card) {
    setKpiValue('title', card.title || '—');
    setKpiValue('symbol', card.symbol || '—');
    setKpiValue('interval', card.interval || '—');
    setKpiValue('mode', card.mode || '—');
    setKpiValue('status', statusChip(card.status));
    const hasError = Boolean(card.error);
    setKpiTileHidden('error', !hasError);
    const errorValue = els.kpis.error?.value;
    if (errorValue) {
      errorValue.classList.toggle('scripts-error', hasError);
    }
    if (hasError) setKpiValue('error', card.error);
    setKpiValue('at', formatAt(card.at));
    const hasEpoch = typeof snap.epoch === 'number';
    setKpiTileHidden('epoch', !hasEpoch);
    if (hasEpoch) setKpiValue('epoch', String(snap.epoch));
  }
  renderSuggestions(snap.suggestions);
}

function onHostMessage(message: unknown): void {
  const state = decodeScriptsStudioData(message);
  if (state) {
    applySnapshot(state.snapshot);
    return;
  }
  const notice = decodeScriptsStudioNotice(message);
  if (notice !== null) setLive(notice);
}

function buildKpiGroup(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'scripts-kpis';
  const defs: { key: KpiKey; label: string }[] = [
    { key: 'title', label: 'Script' },
    { key: 'symbol', label: 'Symbol' },
    { key: 'interval', label: 'Interval' },
    { key: 'mode', label: 'Mode' },
    { key: 'status', label: 'Status' },
    { key: 'error', label: 'Error' },
    { key: 'at', label: 'When' },
    { key: 'epoch', label: 'Epoch' },
  ];
  for (const { key, label } of defs) {
    const { root: tile, refs } = buildKpiTile(label);
    els.kpis[key] = refs;
    root.append(tile);
  }
  return root;
}

function buildLastRunPanel(): HTMLElement {
  const wrapper = panel({ className: 'scripts-panel' });
  wrapper.append(sectionTitle('Last run'));

  const emptyHint = empty({ hint: SCRIPTS_EMPTY_HINT });
  const shortcutHint = document.createElement('p');
  shortcutHint.className = 'scripts-hint';
  shortcutHint.append('Press ', kbd(SCRIPTS_RUN_SHORTCUT), ' from the editor.');

  const emptyStack = document.createElement('div');
  emptyStack.className = 'scripts-last-empty';
  emptyStack.append(emptyHint, shortcutHint);
  els.lastEmpty = emptyStack;

  const content = document.createElement('div');
  content.append(buildKpiGroup(), buildRunButton());
  els.lastContent = content;
  content.hidden = true;

  wrapper.append(emptyStack, content);
  return wrapper;
}

function buildChartPanel(): HTMLElement {
  const wrapper = panel({ className: 'scripts-panel' });
  wrapper.append(sectionTitle('Chart'));

  const copy = document.createElement('p');
  copy.className = 'scripts-hint';
  copy.textContent = 'Chart beside the editor.';

  wrapper.append(copy, buildOpenChartButton());
  return wrapper;
}

function buildSuggestionsPanel(): HTMLElement {
  const wrapper = panel({ className: 'scripts-panel' });
  wrapper.append(sectionTitle('Suggestions'));

  const list = document.createElement('ul');
  list.className = 'scripts-list';
  els.suggestions = list;

  const emptyNode = empty({ hint: 'No suggestions.' });
  els.suggestionsEmpty = emptyNode;

  wrapper.append(list, emptyNode);
  return wrapper;
}

function buildLiveRegion(): HTMLElement {
  const node = document.createElement('p');
  node.id = 'scripts-live';
  node.className = 'scripts-live';
  node.setAttribute('aria-live', 'polite');
  return node;
}

function main(): void {
  const root = document.getElementById('scripts-root');
  if (!root) return;
  root.replaceChildren();
  root.classList.add('scripts-root');
  root.setAttribute('data-axis-scripts-host', '1');

  els.live = buildLiveRegion();

  root.append(
    header({ title: 'Scripts', className: 'scripts-header' }),
    buildLastRunPanel(),
    buildChartPanel(),
    buildSuggestionsPanel(),
    els.live,
  );

  studio.onMessage(onHostMessage);
  studio.post(encodeScriptsReady());
}

main();
