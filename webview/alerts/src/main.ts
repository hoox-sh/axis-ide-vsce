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
 * AXIS Alerts studio webview on the shared runtime + studio.* protocol.
 * Built with ax-* components: the header, form fields, list rows and empty
 * state use the shared builders. Host posts studio.init / studio.set carrying
 * the alerts snapshot and studio.notice for flashes. Add / toggle / remove
 * post back to the host; empty titles never post. Optimistic toggle/remove
 * keep the list snappy.
 */

import '@axis-shared/tokens.css';
import '@axis-shared/theme.css';
import '@axis-shared/motion.css';
import '@axis-shared/components.css';
import './style.css';
import { createStudio } from '@axis-shared/studio';
import { setHidden, setText } from '@axis-shared/dom';
import { btn, empty, field, header, row } from '@axis-shared/components';
import {
  buildAlertsSnapshot,
  type AlertsStudioEntry,
} from '../../../src/views/alerts-studio-model';
import {
  ALERTS_REMOVED,
  ALERTS_TITLE_REQUIRED,
  ALERTS_VIEW,
  decodeAlertsNotice,
  decodeAlertsSnapshot,
  encodeAlertsAdd,
  encodeAlertsReady,
  encodeAlertsRemove,
  encodeAlertsToggle,
  type AlertsSnapshot,
} from './protocol';

// Shared lifecycle runtime: owns the acquireVsCodeApi singleton, host
// message subscription, safe posting, and disposal on pagehide.
const studio = createStudio({ view: ALERTS_VIEW });

const SVG_NS = 'http://www.w3.org/2000/svg';
const BELL_D =
  'M8 1.75a.75.75 0 0 1 .75.75v.41A4.5 4.5 0 0 1 12.5 7.25v2.1l.9 1.35a.75.75 0 0 1-.62 1.15H3.22a.75.75 0 0 1-.62-1.15l.9-1.35v-2.1A4.5 4.5 0 0 1 7.25 2.91V2.5A.75.75 0 0 1 8 1.75zM6.5 12.75a1.5 1.5 0 0 0 3 0h-3z';

let snapshot: AlertsSnapshot = buildAlertsSnapshot(undefined);
let flashTimer: ReturnType<typeof setTimeout> | undefined;

function bellGraphic(slashed: boolean): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'alerts-logo');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', BELL_D);
  svg.append(path);
  if (slashed) {
    const slash = document.createElementNS(SVG_NS, 'path');
    slash.setAttribute('d', 'M2.2 13.4 13.4 2.2');
    slash.setAttribute('fill', 'none');
    slash.setAttribute('stroke', 'currentColor');
    slash.setAttribute('stroke-width', '1.4');
    slash.setAttribute('stroke-linecap', 'round');
    svg.append(slash);
  }
  return svg;
}

function buildShell(): DocumentFragment {
  const fragment = document.createDocumentFragment();

  const titleHeader = header({ title: 'Alerts' });
  titleHeader.classList.add('alerts-header__titlebar');

  const brand = document.createElement('div');
  brand.className = 'alerts-header__brand';
  brand.append(bellGraphic(false), titleHeader);

  const summary = document.createElement('p');
  summary.id = 'alerts-summary';
  summary.className = 'alerts-summary';
  summary.setAttribute('aria-live', 'polite');
  summary.setAttribute('aria-atomic', 'true');

  const headerEl = document.createElement('div');
  headerEl.className = 'alerts-header';
  headerEl.append(brand, summary);

  const titleField = field({
    label: 'Title',
    inputId: 'alerts-title',
    placeholder: 'Alert title',
  });

  const conditionField = field({
    label: 'Condition',
    inputId: 'alerts-condition',
    placeholder: 'Optional condition',
  });

  const addButton = btn({
    label: 'Add',
    variant: 'primary',
    dataset: { action: 'add' },
  });
  addButton.id = 'alerts-add';
  addButton.classList.add('alerts-add');

  const form = document.createElement('div');
  form.className = 'alerts-form';
  form.append(titleField, conditionField, addButton);

  const live = document.createElement('p');
  live.id = 'alerts-live';
  live.className = 'alerts-live';
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');

  const emptyEl = empty({
    hint: 'Add a title and an optional condition, then press Add. This is the IDE list, not the full PWA alert engine.',
  });
  emptyEl.id = 'alerts-empty';
  emptyEl.classList.add('alerts-empty');

  const list = document.createElement('ul');
  list.id = 'alerts-list';
  list.className = 'alerts-list';
  list.setAttribute('aria-label', 'Alerts');
  list.hidden = true;

  fragment.append(headerEl, form, live, emptyEl, list);
  return fragment;
}

function buildMark(enabled: boolean): HTMLElement {
  const mark = document.createElement('span');
  mark.className = enabled
    ? 'alerts-mark alerts-mark--on'
    : 'alerts-mark alerts-mark--off';
  mark.setAttribute('role', 'img');
  mark.setAttribute('aria-label', enabled ? 'Enabled' : 'Disabled');
  mark.append(bellGraphic(!enabled));
  return mark;
}

function buildMain(entry: AlertsStudioEntry): HTMLElement {
  const main = document.createElement('div');
  main.className = 'alerts-row__main';

  const title = document.createElement('div');
  title.className = 'alerts-row__title';
  title.textContent = entry.title;

  const condition = document.createElement('div');
  condition.className = entry.condition
    ? 'alerts-row__condition'
    : 'alerts-row__condition alerts-row__condition--empty';
  condition.textContent = entry.condition ? entry.condition : 'No condition';

  const idEl = document.createElement('div');
  idEl.className = 'alerts-row__id';
  idEl.textContent = entry.id;

  main.append(title, condition, idEl);
  return main;
}

function buildActions(entry: AlertsStudioEntry): HTMLElement[] {
  const toggle = btn({
    label: entry.enabled ? 'Disable' : 'Enable',
    variant: 'secondary',
    size: 'sm',
    pressed: entry.enabled,
    ariaLabel: entry.enabled ? `Disable ${entry.title}` : `Enable ${entry.title}`,
    dataset: { action: 'toggle' },
    className: 'alerts-row__action',
  });

  const remove = btn({
    label: 'Remove',
    variant: 'ghost',
    size: 'sm',
    ariaLabel: `Remove ${entry.title}`,
    dataset: { action: 'remove' },
    className: 'alerts-row__action',
  });

  return [toggle, remove];
}

function renderRow(entry: AlertsStudioEntry): HTMLElement {
  const node = row({
    as: 'li',
    className: 'alerts-row',
    children: [buildMark(entry.enabled), buildMain(entry)],
    actions: buildActions(entry),
  });
  node.setAttribute('data-alert-id', entry.id);
  return node;
}

function paint(): void {
  setText('alerts-summary', snapshot.summary);
  const has = snapshot.entries.length > 0;
  setHidden('alerts-empty', has);
  const list = document.getElementById('alerts-list');
  if (list) {
    list.hidden = !has;
    list.replaceChildren(...snapshot.entries.map(renderRow));
  }
}

function flash(text: string, kind: 'error' | 'info'): void {
  const el = document.getElementById('alerts-live');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('alerts-live--error', kind === 'error');
  if (flashTimer !== undefined) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    flashTimer = undefined;
    const live = document.getElementById('alerts-live');
    if (!live) return;
    live.textContent = '';
    live.classList.remove('alerts-live--error');
  }, 2400);
}

function onAdd(): void {
  const titleEl = document.getElementById('alerts-title');
  const condEl = document.getElementById('alerts-condition');
  if (!(titleEl instanceof HTMLInputElement)) return;
  const title = titleEl.value.trim();
  const condition = condEl instanceof HTMLInputElement ? condEl.value.trim() : '';
  if (!title) {
    flash(ALERTS_TITLE_REQUIRED, 'error');
    titleEl.setAttribute('aria-invalid', 'true');
    titleEl.focus();
    return;
  }
  titleEl.removeAttribute('aria-invalid');
  studio.post(encodeAlertsAdd(title, condition || undefined));
  titleEl.value = '';
  if (condEl instanceof HTMLInputElement) condEl.value = '';
}

function onToggle(id: string): void {
  snapshot = buildAlertsSnapshot(
    snapshot.entries.map((entry) =>
      entry.id === id ? { ...entry, enabled: !entry.enabled } : entry,
    ),
  );
  paint();
  studio.post(encodeAlertsToggle(id));
}

function onRemove(id: string): void {
  snapshot = buildAlertsSnapshot(snapshot.entries.filter((entry) => entry.id !== id));
  paint();
  flash(ALERTS_REMOVED, 'info');
  studio.post(encodeAlertsRemove(id));
}

function onClick(event: Event): void {
  const origin =
    event.target instanceof Element
      ? event.target
      : event.target instanceof Node
        ? event.target.parentElement
        : null;
  if (!origin) return;
  const button = origin.closest('button');
  if (!(button instanceof HTMLButtonElement)) return;
  const action = button.dataset.action ?? '';
  if (action === 'add') {
    onAdd();
    return;
  }
  const rowEl = button.closest('[data-alert-id]');
  const id = rowEl?.getAttribute('data-alert-id') ?? '';
  if (!id) return;
  if (action === 'toggle') onToggle(id);
  else if (action === 'remove') onRemove(id);
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Enter') return;
  if (!(event.target instanceof HTMLInputElement)) return;
  if (event.target.id !== 'alerts-title' && event.target.id !== 'alerts-condition') return;
  event.preventDefault();
  onAdd();
}

function onHostMessage(message: unknown): void {
  const next = decodeAlertsSnapshot(message);
  if (next) {
    snapshot = next;
    paint();
    return;
  }
  const notice = decodeAlertsNotice(message);
  if (notice) {
    flash(notice.message, notice.level === 'error' ? 'error' : 'info');
  }
}

function main(): void {
  const root = document.getElementById('alerts-root');
  if (!root) return;
  root.replaceChildren();
  root.append(buildShell());
  studio.onMessage(onHostMessage);
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKeyDown);
  paint();
  studio.post(encodeAlertsReady());
}

main();
