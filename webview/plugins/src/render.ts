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
 * Plugins studio rendering.
 *
 * The new DOM builder (used by main.ts) renders everything with the shared
 * ax-* components. The legacy `pluginsViewHtml` string renderer is kept for the
 * host test suite, which asserts against its markup shape.
 */

import { badge, btn, panel, header, row, chip, statusDot, empty } from '@axis-shared/components';
import { RESTORE_FOCUS_ATTR } from '@axis-shared/dom';
import {
  KIND_TABS,
  extraFacts,
  EMPTY_KIND_COPY,
  activeChips,
  emptyFilterMessage,
  filterCount,
  formatActiveStatus,
  formatFilterCount,
  formatFilterCountAria,
  isPluginActive,
  KIND_LABELS,
  KIND_MARKS,
  kindRole,
  kindsToRender,
  pluginBadges,
  visiblePluginsForKind,
  type PluginBadge,
  type PluginsViewState,
} from './state';
import { isKindTab, type KindTab, type PluginCard, type PluginKind, type PluginsFlags } from './protocol';

/** 16×16 geometric kind marks (inline; `currentColor` follows VS Code tokens). */
const KIND_ICON_INNER: Record<PluginKind, string> = {
  source:
    '<path fill="currentColor" d="M7.25 1.5h1.5v2.5H11v8H8.75v2.5h-1.5V12H5V4h2.25z"/>',
  stream:
    '<path fill="currentColor" d="M1 7.25h2.7l1.55-3.7 2.55 8.15 1.7-4.45H15v1.5h-4.65l-1.35 3.5-2.7-8.6-1.7 4.1H1z"/>',
  engine:
    '<path fill="currentColor" fill-rule="evenodd" d="M7.2 1.2h1.6v2.3l1.35.55 1.15-1.15 1.13 1.13-1.15 1.15.55 1.35H14.8v1.6h-2.3l-.55 1.35 1.15 1.15-1.13 1.13-1.15-1.15-.55 1.35v2.3H7.2v-2.3l-1.35-.55-1.15 1.15-1.13-1.13 1.15-1.15L3.17 9.4H1.2V7.8h2.3l.55-1.35-1.15-1.15L4.03 4.17l1.15 1.15.55-1.35zM10.05 8A2.05 2.05 0 1 1 5.95 8 2.05 2.05 0 1 1 10.05 8z"/>',
  storage: [
    '<ellipse cx="8" cy="3.7" rx="5" ry="1.85" fill="none" stroke="currentColor" stroke-width="1.25"/>',
    '<path fill="none" stroke="currentColor" stroke-width="1.25" d="M3 3.7v8.4a5 1.85 0 0 0 10 0V3.7"/>',
  ].join(''),
  dataset:
    '<path fill="currentColor" d="M8 1.35 13.55 4.55v6.9L8 14.65 2.45 11.45v-6.9z"/>',
  component:
    '<path fill="currentColor" d="M6.15 1.4h3.7v3.5h3.75v3.7H9.85v3.75H6.15V8.6H2.4V4.9h3.75z"/>',
};

export function kindIconSvg(kind: PluginKind): string {
  const inner = KIND_ICON_INNER[kind];
  if (!inner) return '';
  return `<svg class="plugins-kind-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false" data-kind-icon="${kind}">${inner}</svg>`;
}

export function kindIconNode(kind: PluginKind): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('data-kind-icon', kind);
  svg.classList.add('plugin-card__icon');
  svg.innerHTML = KIND_ICON_INNER[kind] ?? '';
  return svg;
}

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function badgeNode(item: PluginBadge): HTMLElement {
  if (item.tone === 'warn') {
    return badge({ text: item.text, tone: 'warn' });
  }
  if (item.tone === 'active') {
    return badge({ text: item.text, tone: 'up' });
  }
  return badge({ text: item.text, tone: 'neutral' });
}

function cardHeader(card: PluginCard, active: boolean, nameId: string): HTMLElement {
  const node = h('div', 'plugin-card__head');
  const icon = kindIconNode(card.kind);
  const name = h('h3', 'plugin-card__name', card.name);
  name.id = nameId;
  const code = h('code', 'plugin-card__id', card.id);
  code.title = card.id;
  node.append(icon, name, code);
  if (active) {
    node.append(statusDot({ label: 'Active', state: 'ok' }));
  }
  return node;
}

function cardBadges(
  card: PluginCard,
  active: Record<string, string | undefined>,
  flags: PluginsFlags,
): HTMLElement | null {
  const badges = pluginBadges(card, active, flags).filter((b) => b.text !== 'Active');
  if (badges.length === 0) return null;
  const node = h('div', 'plugin-card__badges');
  for (const badge of badges) {
    node.append(badgeNode(badge));
  }
  return node;
}

function cardFacts(card: PluginCard): HTMLElement | null {
  const facts = extraFacts(card.extra);
  if (facts.length === 0) return null;
  const list = h('dl', 'plugin-card__facts');
  for (const fact of facts) {
    list.append(
      row({
        className: 'plugin-card__fact',
        children: [h('dt', 'plugin-card__fact-key', fact.key), h('dd', 'plugin-card__fact-value', fact.value)],
      }),
    );
  }
  return list;
}

function cardActions(card: PluginCard, active: boolean): HTMLElement {
  const node = h('div', 'plugin-card__actions');

  const copyBtn = btn({
    label: 'Copy id',
    variant: 'secondary',
    size: 'sm',
    title: 'Copy id',
    ariaLabel: `Copy id ${card.id}`,
    className: 'plugin-card__copy',
    dataset: { action: 'copy-id', kind: card.kind, id: card.id },
  });

  const activateBtn = btn({
    label: active ? 'Active' : 'Activate',
    variant: 'primary',
    size: 'sm',
    title: active ? 'Already active' : 'Activate',
    disabled: active,
    className: 'plugin-card__activate',
    dataset: { action: 'activate', kind: card.kind, id: card.id },
  });

  node.append(copyBtn, activateBtn);
  return node;
}

export function renderPluginCard(state: PluginsViewState, card: PluginCard): HTMLElement {
  const active = isPluginActive(card, state.active);
  const nameId = `plugin-${card.kind}-${card.id}`.replace(/[^a-zA-Z0-9_-]/g, '-');
  const cardEl = panel({ className: 'plugin-card' });

  cardEl.tabIndex = 0;
  cardEl.setAttribute('role', 'article');
  cardEl.setAttribute('aria-labelledby', nameId);
  cardEl.dataset.kind = card.kind;
  cardEl.dataset.id = card.id;
  cardEl.setAttribute(RESTORE_FOCUS_ATTR, `${card.kind}:${card.id}`);
  if (active) {
    cardEl.classList.add('is-active');
  }

  cardEl.append(cardHeader(card, active, nameId));

  const badges = cardBadges(card, state.active, state.flags);
  if (badges) cardEl.append(badges);

  const description = card.description?.trim();
  if (description) {
    cardEl.append(h('p', 'plugin-card__desc', description));
  }

  const facts = cardFacts(card);
  if (facts) cardEl.append(facts);

  cardEl.append(cardActions(card, active));
  return cardEl;
}

function renderSection(state: PluginsViewState, kind: PluginKind): HTMLElement {
  const cards = visiblePluginsForKind(state, kind);

  const section = h('section', 'plugins-section');
  section.setAttribute('aria-labelledby', `kind-${kind}-title`);

  const titleId = `kind-${kind}-title`;
  const head = header({ title: KIND_LABELS[kind], count: cards.length });
  const titleEl = head.querySelector('.ax-header__title');
  if (titleEl) titleEl.id = titleId;
  section.append(head);

  section.append(h('p', 'plugins-section__role', kindRole(kind, cards)));

  if (cards.length === 0) {
    const searching = state.query.trim().length > 0;
    const hint = searching ? emptyFilterMessage(state.query) : EMPTY_KIND_COPY[kind];
    section.append(empty({ hint, className: 'plugins-empty' }));
  } else {
    const grid = h('div', 'plugins-cards');
    for (const card of cards) {
      grid.append(renderPluginCard(state, card));
    }
    section.append(grid);
  }

  return section;
}

export function renderPluginsBody(state: PluginsViewState): HTMLElement {
  const node = h('div');
  node.setAttribute('role', 'tabpanel');

  if (!state.ready && state.plugins.length === 0) {
    node.append(empty({ hint: 'Waiting for host catalog…', className: 'plugins-empty' }));
    return node;
  }

  const kinds = kindsToRender(state.tab);
  for (const kind of kinds) {
    node.append(renderSection(state, kind));
  }

  const query = state.query.trim();
  if (query.length > 0 && state.plugins.length > 0 && state.tab === 'all') {
    const anyVisible = kinds.some((k) => visiblePluginsForKind(state, k).length > 0);
    if (!anyVisible) {
      node.replaceChildren(empty({ hint: emptyFilterMessage(query), className: 'plugins-empty plugins-empty--filter' }));
    }
  }

  return node;
}

export function renderActiveChips(
  state: PluginsViewState,
  onChipClick: (tab: KindTab) => void,
): HTMLElement {
  const chips = activeChips(state.active);
  if (chips.length === 0) {
    return h('p', 'plugins-status', formatActiveStatus(state.active));
  }

  const node = h('div', 'plugins-chips');
  node.setAttribute('role', 'list');
  node.setAttribute('aria-label', formatActiveStatus(state.active));
  for (const c of chips) {
    const chipBtn = chip({
      label: c.id,
      value: c.tab,
      icon: kindIconNode(c.kind),
      onToggle: (tab) => {
        if (isKindTab(tab)) onChipClick(tab);
      },
    });
    chipBtn.title = `${KIND_LABELS[c.tab]}: ${c.id}`;
    chipBtn.setAttribute('aria-label', `Show ${KIND_LABELS[c.tab]}, ${c.id}`);
    chipBtn.dataset.role = 'chip';
    chipBtn.dataset.tab = c.tab;
    node.append(chipBtn);
  }
  return node;
}

// ---------------------------------------------------------------------------
// Legacy string renderer — kept for host test assertions.
// ---------------------------------------------------------------------------

export function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function badgeHtml(item: PluginBadge): string {
  const text = escapeHtml(item.text);
  const tone =
    item.tone === 'warn' ? 'warn' : item.tone === 'active' ? 'up' : 'neutral';
  return `<span class="ax-badge ax-badge--${tone}">${text}</span>`;
}

function factsHtml(card: PluginCard): string {
  const facts = extraFacts(card.extra);
  if (facts.length === 0) return '';
  const rows = facts
    .map(
      (f) =>
        `<div class="plugin-card__fact"><dt>${escapeHtml(f.key)}</dt><dd>${escapeHtml(f.value)}</dd></div>`,
    )
    .join('');
  return `<dl class="plugin-card__facts">${rows}</dl>`;
}

function kindMarkHtml(tab: KindTab): string {
  if (tab === 'all') return '';
  return `<span class="plugins-kind-mark" aria-hidden="true">${kindIconSvg(tab)}<span class="plugins-kind-mark__text">${escapeHtml(KIND_MARKS[tab])}</span></span>`;
}

function cardHtml(card: PluginCard, state: PluginsViewState): string {
  const active = isPluginActive(card, state.active);
  const badges = pluginBadges(card, state.active, state.flags)
    .map(badgeHtml)
    .join('');
  const desc = card.description
    ? `<p class="plugin-card__desc">${escapeHtml(card.description)}</p>`
    : '';
  const activateLabel = active ? 'Active' : 'Activate';
  const activateTitle = active ? 'Already active' : 'Activate';
  const disabled = active ? ' disabled' : '';
  const activeClass = active ? ' is-active' : '';
  const nameId = `plugin-${card.kind}-${card.id}`.replace(/[^a-zA-Z0-9_-]/g, '-');
  const kindAttr = escapeHtml(card.kind);
  const idAttr = escapeHtml(card.id);
  const vscodeCtx = escapeHtml(
    JSON.stringify({
      webviewSection: 'plugin-card',
      preventDefaultContextMenuItems: true,
    }),
  );
  return `<article class="plugin-card${activeClass}" tabindex="0" data-kind="${kindAttr}" data-id="${idAttr}" data-vscode-context="${vscodeCtx}" aria-labelledby="${nameId}">
  <header class="plugin-card__head">
    <div class="plugin-card__titles">
      ${kindIconSvg(card.kind)}
      <h3 class="plugin-card__name" id="${nameId}">${escapeHtml(card.name)}</h3>
      <code class="plugin-card__id" title="${idAttr}">${idAttr}</code>
    </div>
    <div class="plugin-card__badges">${badges}</div>
  </header>
  ${desc}
  ${factsHtml(card)}
  <div class="plugin-card__actions">
    <button type="button" class="plugin-card__copy" data-action="copy-id" data-kind="${kindAttr}" data-id="${idAttr}" aria-label="Copy id ${idAttr}" title="Copy id">Copy id</button>
    <button type="button" class="plugin-card__activate" data-action="activate" data-kind="${kindAttr}" data-id="${idAttr}" title="${activateTitle}"${disabled}>${activateLabel}</button>
  </div>
</article>`;
}

function sectionHtml(kind: PluginKind, state: PluginsViewState): string {
  const cards = visiblePluginsForKind(state, kind);
  const searching = state.query.trim().length > 0;
  if (searching && cards.length === 0 && state.tab === 'all') return '';
  const role = escapeHtml(kindRole(kind, cards));
  const count = String(cards.length);
  const emptyCopy = searching ? emptyFilterMessage(state.query) : EMPTY_KIND_COPY[kind];
  const body =
    cards.length === 0
      ? `<p class="plugins-empty">${escapeHtml(emptyCopy)}</p>`
      : `<div class="plugins-cards">${cards.map((c) => cardHtml(c, state)).join('')}</div>`;
  return `<section class="plugins-kind" data-kind="${kind}" aria-labelledby="kind-${kind}-title">
  <header class="plugins-kind__head">
    <div class="plugins-kind__title-row">
      ${kindMarkHtml(kind)}
      <h2 class="plugins-kind__title" id="kind-${kind}-title">${escapeHtml(KIND_LABELS[kind])}</h2>
      <span class="plugins-kind__count" aria-label="${count} plugins">${escapeHtml(count)}</span>
    </div>
    <p class="plugins-kind__role">${role}</p>
  </header>
  ${body}
</section>`;
}

function tabsHtml(tab: PluginsViewState['tab']): string {
  const buttons = KIND_TABS.map((id) => {
    const selected = id === tab;
    const label = KIND_LABELS[id];
    return `<button type="button" role="tab" id="tab-${id}" class="plugins-tabs__tab" data-tab="${id}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" aria-selected="${selected ? 'true' : 'false'}" tabindex="${selected ? '0' : '-1'}">${kindMarkHtml(id)}<span class="plugins-tabs__text">${escapeHtml(label)}</span></button>`;
  }).join('');
  return `<div class="plugins-tabs" role="tablist" aria-label="Plugin kinds">${buttons}</div>`;
}

function chipHtml(chipItem: { tab: PluginKind; chip: string; id: string; kind: PluginKind }): string {
  const label = KIND_LABELS[chipItem.tab];
  return `<button type="button" role="listitem" id="chip-${chipItem.kind}" class="plugins-chip" data-tab="${chipItem.tab}" data-chip="1" title="${escapeHtml(label)}: ${escapeHtml(chipItem.id)}" aria-label="Show ${escapeHtml(label)}, ${escapeHtml(chipItem.id)}"><span class="plugins-chip__mark" aria-hidden="true">${escapeHtml(chipItem.chip)}</span><span class="plugins-chip__id">${escapeHtml(chipItem.id)}</span></button>`;
}

function chipsHtml(state: PluginsViewState): string {
  const chips = activeChips(state.active);
  const status = escapeHtml(formatActiveStatus(state.active));
  if (chips.length === 0) {
    return `<p class="plugins-status" id="plugins-status">${status}</p>`;
  }
  return `<div class="plugins-chips" id="plugins-status" role="list" aria-label="${status}">${chips.map(chipHtml).join('')}</div>`;
}

function searchHtml(query: string): string {
  return `<div class="plugins-search-wrap" role="search">
    <input id="plugins-search" class="plugins-search" type="search" name="plugins-search" value="${escapeHtml(query)}" placeholder="Filter plugins" aria-label="Filter plugins by name, id, or description" title="Filter plugins" autocomplete="off" spellcheck="false" />
  </div>`;
}

function headerMetaHtml(state: PluginsViewState): string {
  const count = filterCount(state);
  const text = escapeHtml(formatFilterCount(count));
  const label = escapeHtml(formatFilterCountAria(count));
  return `<span class="plugins-header__meta" id="plugins-count" title="${label}" aria-label="${label}">${text}</span>`;
}

export function pluginsViewHtml(state: PluginsViewState): string {
  const kinds = kindsToRender(state.tab);
  const sections = kinds.map((k) => sectionHtml(k, state)).join('');
  const searching = state.query.trim().length > 0;
  const anyVisible = kinds.some((k) => visiblePluginsForKind(state, k).length > 0);
  const emptyFilter =
    searching && !anyVisible && state.plugins.length > 0 && state.tab === 'all'
      ? `<p class="plugins-empty">${escapeHtml(emptyFilterMessage(state.query))}</p>`
      : '';
  const waiting =
    !state.ready && state.plugins.length === 0
      ? `<p class="plugins-empty plugins-empty--waiting">Waiting for host catalog…</p>`
      : '';
  return `<div class="plugins-shell" data-axis-plugins-host="1">
  <div id="plugins-live" class="plugins-live" aria-live="polite" aria-atomic="true"></div>
  <header class="plugins-header">
    <div class="plugins-header__sticky">
      <div class="plugins-header__top">
        <div class="plugins-header__brand">
          <h1 class="plugins-title">Plugins</h1>
          ${headerMetaHtml(state)}
        </div>
        ${searchHtml(state.query)}
      </div>
      ${tabsHtml(state.tab)}
    </div>
    ${chipsHtml(state)}
  </header>
  <div class="plugins-body" id="plugins-body" role="tabpanel" aria-labelledby="tab-${state.tab}">
    ${waiting}${emptyFilter}${sections}
  </div>
</div>`;
}


