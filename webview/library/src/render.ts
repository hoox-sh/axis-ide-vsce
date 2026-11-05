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
 * Library studio DOM renderers built from ax-* components.
 * All text is set through DOM APIs — no innerHTML — so escaping is automatic.
 */

import {
  chip,
  empty,
  header,
  kbd,
  panel,
  row,
  search,
} from '@axis-shared/components';
import {
  categoryOptions,
  filteredCards,
  formatScriptCount,
  formatShowing,
  kindCounts,
  kindLabel,
  overlayLabel,
  type LibraryCard,
  type LibraryKind,
  type LibraryKindFilter,
  type LibraryViewState,
} from './state';

const SVG_NS = 'http://www.w3.org/2000/svg';

type SelectKindHandler = (kind: LibraryKindFilter) => void;
type SelectCategoryHandler = (category: string) => void;

export interface LibraryHandlers {
  onSearch(value: string): void;
  onSelectKind(kind: LibraryKindFilter): void;
  onSelectCategory(category: string): void;
  onClear(): void;
  onCopy(id: string): void;
  onApply(id: string): void;
}

function safeHtmlId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function svgIcon(pathD: string, className?: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (className) svg.setAttribute('class', className);
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', pathD);
  svg.append(path);
  return svg;
}

export function libraryMarkSvg(): SVGSVGElement {
  return svgIcon(
    'M3 1.75h7.1c.9 0 1.65.75 1.65 1.65V13.2c0 .35-.4.55-.68.35L8.2 11.7 5.33 13.55c-.28.2-.68 0-.68-.35V3.4c0-.9.75-1.65 1.65-1.65H3z M3 2.6h1.15v10.15l2.15-1.4c.4-.26.92-.26 1.32 0l2.15 1.4V3.4c0-.4-.35-.75-.75-.75H3.9',
    'library-icon',
  );
}

export function searchSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 'library-icon library-icon--search');
  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', '7');
  circle.setAttribute('cy', '7');
  circle.setAttribute('r', '4.25');
  circle.setAttribute('fill', 'none');
  circle.setAttribute('stroke', 'currentColor');
  circle.setAttribute('stroke-width', '1.4');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', 'M10.2 10.2 13.4 13.4l-1.05 1.05-3.2-3.2z');
  svg.append(circle, path);
  return svg;
}

export function kindSvg(kind: LibraryKind | 'all'): SVGSVGElement {
  if (kind === 'strategy') {
    return svgIcon(
      'M3 12.5h1.6V6.2H3zm4.2 0h1.6V3.4H7.2zm4.2 0H13V8.1h-1.6z M2.2 13.6h11.6v1.1H2.2z',
      'library-icon',
    );
  }
  if (kind === 'indicator') {
    return svgIcon(
      'M1.5 11.5 5.2 7.6l2.3 2.2L14 3.2 M12.1 2.6h2.6V5.2l-1.2-1.15z',
      'library-icon',
    );
  }
  return svgIcon(
    'M2 2h5v5H2zm7 0h5v5H9zM2 9h5v5H2zm7 0h5v5H9z',
    'library-icon',
  );
}

function overlaySvg(overlay: boolean): SVGSVGElement {
  if (overlay) {
    return svgIcon(
      'M3 5.2 8 2.6l5 2.6v1.3L8 9.1 3 6.5z M3 8.4 8 11l5-2.6v1.3L8 12.3 3 9.7z',
      'library-icon library-icon--meta',
    );
  }
  return svgIcon(
    'M2.4 2.4h11.2v11.2H2.4z M3.2 8.1h9.6v4.3H3.2z',
    'library-icon library-icon--meta',
  );
}

function applySvg(): SVGSVGElement {
  return svgIcon('M4 2.6v10.8l9-5.4z', 'library-icon library-icon--btn');
}

function emptySvg(): SVGSVGElement {
  return svgIcon(
    'M3 2.2h6.4c.7 0 1.3.6 1.3 1.3v9.2L8 11.1 5.3 12.7V3.5c0-.7.6-1.3 1.3-1.3 M4.2 5.2h5.1v1.1H4.2zm0 2.2h5.1v1.1H4.2z',
    'library-icon library-icon--empty',
  );
}

function radioChip<T extends string>(
  value: T,
  label: string,
  selected: boolean,
  group: string,
  onSelect: (value: T) => void,
  options?: { icon?: SVGSVGElement; count?: number },
): HTMLButtonElement {
  const button = chip({
    label,
    value,
    pressed: selected,
    className: 'library-chip',
    icon: options?.icon,
    count: options?.count,
    onToggle: (toggledValue) => {
      onSelect(toggledValue as T);
    },
  });
  button.setAttribute('role', 'radio');
  button.setAttribute('aria-checked', selected ? 'true' : 'false');
  button.removeAttribute('aria-pressed');
  button.dataset.value = value;
  button.dataset.group = group;
  return button;
}

function buildKindChips(state: LibraryViewState, onSelect: SelectKindHandler): HTMLElement {
  const counts = kindCounts(state);
  const order: LibraryKindFilter[] = ['all', 'indicator', 'strategy'];
  const labels: Record<LibraryKindFilter, string> = {
    all: 'All',
    indicator: 'Indicator',
    strategy: 'Strategy',
  };
  const container = document.createElement('div');
  container.className = 'library-chips';
  container.setAttribute('role', 'radiogroup');
  container.setAttribute('aria-label', 'Script kind');
  for (const id of order) {
    container.append(
      radioChip(id, labels[id], state.kind === id, 'kind', onSelect, {
        icon: kindSvg(id),
        count: counts[id],
      }),
    );
  }
  return container;
}

function buildCategoryChips(
  state: LibraryViewState,
  onSelect: SelectCategoryHandler,
): HTMLElement {
  const options = categoryOptions(state);
  const total = options.reduce((sum, row) => sum + row.count, 0);
  const container = document.createElement('div');
  container.className = 'library-chips library-chips--category';
  container.setAttribute('role', 'radiogroup');
  container.setAttribute('aria-label', 'Category');
  container.append(
    radioChip('all', 'All', state.category === 'all', 'category', onSelect, {
      icon: kindSvg('all'),
      count: total,
    }),
  );
  for (const row of options) {
    container.append(
      radioChip(
        row.id,
        row.label,
        state.category === row.id,
        'category',
        onSelect,
        { count: row.count },
      ),
    );
  }
  return container;
}

function buildApplyButton(card: LibraryCard, onApply: (id: string) => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'library-apply';
  button.setAttribute('data-action', 'apply');
  button.setAttribute('data-id', card.id);
  button.setAttribute('aria-label', `Apply ${card.title}`);
  button.setAttribute('title', `Apply ${card.title}`);

  const label = document.createElement('span');
  label.className = 'library-apply__label';
  label.append(applySvg(), document.createTextNode('Apply'));

  const sent = document.createElement('span');
  sent.className = 'library-apply__sent';
  sent.textContent = 'Sent';

  button.append(label, sent);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onApply(card.id);
  });
  return button;
}

function buildTags(tags: readonly string[]): HTMLElement | null {
  if (tags.length === 0) return null;
  const list = document.createElement('ul');
  list.className = 'library-tags';
  list.setAttribute('aria-label', 'Tags');
  for (const tag of tags) {
    const item = document.createElement('li');
    item.className = 'library-tag';
    item.textContent = tag;
    list.append(item);
  }
  return list;
}

function buildCardContent(card: LibraryCard, titleId: string): HTMLElement {
  const body = document.createElement('div');
  body.className = 'library-card__body';

  const head = document.createElement('header');
  head.className = 'library-card__head';

  const kindIcon = kindSvg(card.kind);
  kindIcon.setAttribute('title', kindLabel(card.kind));

  const titles = document.createElement('div');
  titles.className = 'library-card__titles';
  const title = document.createElement('h2');
  title.className = 'library-card__title';
  title.id = titleId;
  title.textContent = card.title;
  const short = document.createElement('p');
  short.className = 'library-card__short';
  short.textContent = card.shorttitle;
  titles.append(title, short);

  const idCode = document.createElement('code');
  idCode.className = 'library-card__id';
  idCode.setAttribute('title', card.id);
  idCode.textContent = card.id;

  head.append(kindIcon, titles, idCode);

  const meta = document.createElement('ul');
  meta.className = 'library-card__meta';

  const kindMeta = document.createElement('li');
  kindMeta.className = `library-meta library-meta--${card.kind}`;
  kindMeta.append(kindSvg(card.kind), document.createTextNode(kindLabel(card.kind)));

  const categoryMeta = document.createElement('li');
  categoryMeta.className = 'library-meta';
  categoryMeta.textContent = card.categoryLabel.trim() || card.category.trim() || 'Uncategorized';

  const placeMeta = document.createElement('li');
  placeMeta.className = 'library-meta';
  placeMeta.append(overlaySvg(card.overlay), document.createTextNode(overlayLabel(card.overlay)));

  meta.append(kindMeta, categoryMeta, placeMeta);

  body.append(head, meta);

  if (card.description.trim()) {
    const desc = document.createElement('p');
    desc.className = 'library-card__desc';
    desc.textContent = card.description;
    body.append(desc);
  }

  if (card.covers.trim()) {
    const covers = document.createElement('p');
    covers.className = 'library-card__covers';
    const label = document.createElement('span');
    label.className = 'library-card__k';
    label.textContent = 'Covers';
    covers.append(label, document.createTextNode(` ${card.covers}`));
    body.append(covers);
  }

  const tags = buildTags(card.tags);
  if (tags) body.append(tags);

  const actions = document.createElement('div');
  actions.className = 'library-card__actions';
  const flash = document.createElement('span');
  flash.className = 'library-card__flash';
  flash.setAttribute('aria-hidden', 'true');
  flash.textContent = 'Copied';
  const hint = document.createElement('p');
  hint.className = 'library-card__hint';
  hint.textContent = 'Click the card to copy the id';
  actions.append(flash, hint, buildApplyButton(card, (id) => body.dispatchEvent(new CustomEvent('apply', { detail: id }))));
  body.append(actions);

  return body;
}

function buildCard(card: LibraryCard, handlers: LibraryHandlers, state: LibraryViewState): HTMLElement {
  const titleId = `library-card-${safeHtmlId(card.id)}`;
  const content = buildCardContent(card, titleId);

  const node = row({
    className: `library-card library-card--${card.kind}`,
    children: [content],
  });
  node.tabIndex = 0;
  node.setAttribute('data-id', card.id);
  node.setAttribute('data-kind', card.kind);
  node.setAttribute('aria-labelledby', titleId);
  node.setAttribute('aria-description', `Copies id ${card.id}`);

  node.addEventListener('click', () => handlers.onCopy(card.id));
  content.addEventListener('apply', (event) => {
    if (event instanceof CustomEvent) {
      handlers.onApply(String(event.detail ?? ''));
    }
  });
  node.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handlers.onCopy(card.id);
    }
  });

  return node;
}

function buildCards(state: LibraryViewState, handlers: LibraryHandlers): HTMLElement {
  const container = document.createElement('div');
  container.className = 'library-cards';
  for (const card of filteredCards(state)) {
    container.append(buildCard(card, handlers, state));
  }
  return container;
}

function buildBanner(error: string): HTMLElement | null {
  if (!error) return null;
  const node = document.createElement('p');
  node.className = 'library-banner';
  node.setAttribute('role', 'status');
  const label = document.createElement('span');
  label.className = 'library-banner__k';
  label.textContent = 'Catalog';
  node.append(label, document.createTextNode(` ${error}`));
  return node;
}

function buildEmpty(
  state: LibraryViewState,
  handlers: LibraryHandlers,
  showing: number,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'library-empty';

  if (!state.loaded) {
    wrapper.append(
      emptySvg(),
      empty({
        hint: 'Loading builtin scripts. The studio reads the offline catalog shipped in this extension. Nothing is fetched from the network.',
      }),
    );
    return wrapper;
  }

  if (state.cards.length === 0) {
    const title = state.catalogError ? 'Builtin catalog unavailable' : 'No builtin scripts';
    const detail = state.catalogError
      ? state.catalogError
      : 'The catalog file parsed, but it did not contain any usable scripts.';

    wrapper.append(
      emptySvg(),
      empty({
        hint: `${title}: ${detail} AXIS Library lists first-party builtins from media/builtins/catalog.json inside the extension install. Reload the window after that file is restored. Apply still opens an untitled Pine document for the script you pick.`,
      }),
    );

    const facts = document.createElement('dl');
    facts.className = 'library-empty__facts';
    const rows: [string, string][] = [
      ['View', 'axis.library'],
      ['Catalog', 'media/builtins/catalog.json'],
      ['Schema', 'axis.builtins.v1'],
      ['Scripts', formatScriptCount(0)],
    ];
    for (const [term, value] of rows) {
      const rowWrapper = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = term;
      const dd = document.createElement('dd');
      const code = document.createElement('code');
      code.textContent = value;
      dd.append(code);
      rowWrapper.append(dt, dd);
      facts.append(rowWrapper);
    }
    wrapper.append(facts);
    return wrapper;
  }

  if (showing === 0) {
    const bits = [`kind ${state.kind === 'all' ? 'All' : kindLabel(state.kind)}`];
    if (state.category !== 'all') bits.push(`category ${state.category}`);
    const q = state.query.trim();

    wrapper.append(
      searchSvg(),
      empty({
        hint: `Nothing in the offline catalog is visible with ${bits.join(', ')}${q ? ` matching “${q}”` : ''}. Search checks title, short title, id, tags, and category.`,
        actionLabel: 'Clear filters',
        onAction: () => handlers.onClear(),
      }),
    );

    const shortcutHint = document.createElement('p');
    shortcutHint.className = 'library-empty__hint';
    shortcutHint.append(
      document.createTextNode('Press '),
      kbd('/'),
      document.createTextNode(' or '),
      kbd('Ctrl'),
      document.createTextNode('+'),
      kbd('F'),
      document.createTextNode(' to focus search.'),
    );
    wrapper.append(shortcutHint);

    const counts = document.createElement('p');
    counts.className = 'library-empty__counts';
    counts.textContent = `${formatScriptCount(state.cards.length)}, ${formatShowing(0)}.`;
    wrapper.append(counts);
    return wrapper;
  }

  wrapper.append(empty({ hint: '' }));
  return wrapper;
}

function buildHeader(state: LibraryViewState, handlers: LibraryHandlers): HTMLElement {
  const total = state.cards.length;
  const visible = filteredCards(state);
  const showing = visible.length;
  const indicatorN = state.cards.filter((card) => card.kind === 'indicator').length;
  const strategyN = state.cards.filter((card) => card.kind === 'strategy').length;

  const headerEl = document.createElement('header');
  headerEl.className = 'library-header';

  const top = document.createElement('div');
  top.className = 'library-header__top';

  const titleHeader = header({ title: 'Library' });
  titleHeader.classList.add('library-header__titlebar');
  titleHeader.prepend(libraryMarkSvg());

  const counts = document.createElement('p');
  counts.className = 'library-header__counts';

  const totalSpan = document.createElement('span');
  totalSpan.id = 'library-total';
  totalSpan.textContent = formatScriptCount(total);

  const showingSpan = document.createElement('span');
  showingSpan.id = 'library-showing';
  showingSpan.className = 'library-header__showing';
  showingSpan.textContent = formatShowing(showing);

  counts.append(totalSpan, showingSpan);
  top.append(titleHeader, counts);

  const sub = document.createElement('p');
  sub.className = 'library-sub';
  sub.textContent = `${indicatorN} indicators · ${strategyN} strategies · offline catalog`;

  const searchWrap = document.createElement('div');
  searchWrap.className = 'library-search-wrap';
  searchWrap.setAttribute('role', 'search');
  const searchInput = search({
    placeholder: 'Filter by title, id, tag, or category',
    value: state.query,
    ariaLabel: 'Filter scripts by title, short title, id, tags, or category',
    className: 'library-search',
    onInput: handlers.onSearch,
  });
  searchInput.id = 'library-search';
  searchInput.setAttribute('name', 'library-search');
  searchInput.setAttribute('autocomplete', 'off');
  searchInput.setAttribute('spellcheck', 'false');
  searchWrap.append(searchSvg(), searchInput);

  headerEl.append(
    top,
    sub,
    searchWrap,
    buildKindChips(state, handlers.onSelectKind),
    buildCategoryChips(state, handlers.onSelectCategory),
  );

  return headerEl;
}

function buildBody(state: LibraryViewState, handlers: LibraryHandlers): HTMLElement {
  const visible = filteredCards(state);
  const showing = visible.length;
  const body = document.createElement('div');
  body.className = 'library-body';

  const banner = state.loaded && state.cards.length > 0 ? buildBanner(state.catalogError) : null;
  if (banner) body.append(banner);

  if (showing === 0) {
    body.append(buildEmpty(state, handlers, showing));
  } else {
    body.append(buildCards(state, handlers));
  }

  return body;
}

export function buildLibraryView(
  state: LibraryViewState,
  handlers: LibraryHandlers,
): HTMLElement {
  return panel({
    className: 'library-shell',
    children: [buildHeader(state, handlers), buildBody(state, handlers)],
  });
}
