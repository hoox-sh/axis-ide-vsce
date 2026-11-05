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
 * Semantic Layers cards built from the shared ax-* component catalog.
 * Cards are ax-panel surfaces; section heads are ax-header; rows are ax-row;
 * empty sections use ax-empty. Colors flow through --axis-* tokens only.
 */

import { empty, header, panel, row } from '@axis-shared/components';
import type { LayersSectionView, LayersViewState } from './state';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Inline marks, one per section title. Stroke uses currentColor. */
const SECTION_ICON: Record<string, string> = {
  Scripts:
    '<path d="M6 4.5 2.5 8 6 11.5"/><path d="M10 4.5 13.5 8 10 11.5"/>',
  Panes:
    '<rect x="2.5" y="2.5" width="11" height="4" rx="0.6"/><rect x="2.5" y="9.2" width="11" height="4.3" rx="0.6"/>',
  Overlays: '<path d="M2 12.5c2.2-4.8 3.5-4.8 5.4-1.2C9.2 14.2 10.4 14 14 5.5"/>',
  'On-chain':
    '<circle cx="4" cy="8" r="1.7"/><circle cx="12" cy="4.4" r="1.7"/><circle cx="12" cy="11.6" r="1.7"/><path d="M5.6 7.3 10.4 5.1"/><path d="M5.6 8.7 10.4 10.9"/>',
  Drawings: '<path d="M9.1 3.1 12.9 6.9 5.8 14H2.2v-3.6z"/><path d="M7.8 4.4 11.6 8.2"/>',
};

export type LayersDom = {
  summary: HTMLElement | null;
  live: HTMLElement | null;
  sections: HTMLElement | null;
  open: HTMLButtonElement | null;
};

export function queryLayersDom(root: ParentNode): LayersDom {
  const open = root.querySelector('#layers-open-chart');
  return {
    summary: root.querySelector('#layers-summary'),
    live: root.querySelector('#layers-live'),
    sections: root.querySelector('#layers-sections'),
    open: open instanceof HTMLButtonElement ? open : null,
  };
}

function iconSvg(title: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'layers-panel__svg');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.3');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = SECTION_ICON[title] ?? SECTION_ICON.Scripts ?? '';
  return svg;
}

function itemsLabel(count: number): string {
  return count === 1 ? '1 item' : `${count} items`;
}

function labelSpan(text: string): HTMLSpanElement {
  const node = document.createElement('span');
  node.className = 'layers-row__label';
  node.textContent = text;
  return node;
}

function detailSpan(text: string): HTMLSpanElement {
  const node = document.createElement('span');
  node.className = 'layers-row__detail';
  node.textContent = text;
  return node;
}

function renderSection(section: LayersSectionView): HTMLElement {
  const card = panel({ className: 'layers-panel' });
  const headingId = `${section.id}-title`;
  card.setAttribute('role', 'region');
  card.setAttribute('aria-labelledby', headingId);

  const icon = document.createElement('span');
  icon.className = 'layers-panel__icon';
  icon.append(iconSvg(section.title));

  const role = document.createElement('p');
  role.className = 'layers-panel__role';
  role.textContent = section.role;

  const head = header({
    title: section.title,
    count: section.count,
    children: [icon, role],
  });
  head.classList.add('layers-panel__header');

  const title = head.querySelector('.ax-header__title');
  if (title) title.id = headingId;

  card.append(head);

  if (section.rows.length > 0) {
    const list = document.createElement('ul');
    list.className = 'layers-panel__rows';
    for (const item of section.rows) {
      const children: Node[] = [labelSpan(item.label)];
      if (item.detail) children.push(detailSpan(item.detail));
      const itemRow = row({ as: 'li', children });
      itemRow.dataset.row = item.id;
      list.append(itemRow);
    }
    card.append(list);
  } else {
    card.append(empty({ hint: section.empty, className: 'layers-panel__empty' }));
  }

  return card;
}

export function renderSections(container: HTMLElement, sections: LayersSectionView[]): void {
  const frag = document.createDocumentFragment();
  for (const section of sections) frag.append(renderSection(section));
  container.replaceChildren(frag);
}

/**
 * Build the sticky top header from the shared ax-header component.
 * Reuses the host-emitted `#layers-summary` and `#layers-open-chart` nodes
 * so listeners and text updates keep working without querying again.
 */
export function buildTopHeader(dom: LayersDom, state: LayersViewState): HTMLElement {
  const summary = dom.summary ?? document.createElement('p');
  summary.id = 'layers-summary';
  summary.className = 'layers-summary';

  const open = dom.open ?? document.createElement('button');
  open.type = 'button';
  open.id = 'layers-open-chart';
  open.className = 'layers-open';
  if (!open.textContent) open.textContent = 'Open chart';

  const node = header({
    title: 'Layers',
    count: state.total,
    children: [summary, open],
  });
  node.classList.add('layers-header');

  const title = node.querySelector('.ax-header__title');
  if (title) title.id = 'layers-title';

  return node;
}

/**
 * Paint header, cards, and (on refresh) the polite live region.
 * The live text is exactly "Updated" so assistive tech can announce the refresh.
 */
export function paintLayers(dom: LayersDom, state: LayersViewState, announce: boolean): void {
  if (dom.summary) {
    dom.summary.textContent = `${itemsLabel(state.total)} · ${state.source}`;
  }

  const titleCount = document.querySelector('.layers-header .ax-header__count');
  if (titleCount) titleCount.textContent = String(state.total);

  if (dom.sections) renderSections(dom.sections, state.sections);

  if (!announce || !dom.live) return;
  const live = dom.live;
  live.textContent = '';
  requestAnimationFrame(() => {
    if (!live.isConnected) return;
    live.textContent = 'Updated';
  });
}
