// Copyright (C) 2026 jango_blockchained
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * AXIS curated component builders (vanilla TS DOM — no framework).
 * Class names are the frozen contract with components.css (§4 catalog).
 * First pass: structure + base behavior; studios wire data and host actions.
 */

import { RESTORE_FOCUS_ATTR } from './dom';

export type Child = Node | string | null | undefined;
export type Tone = 'accent' | 'up' | 'down' | 'warn' | 'info';
export type StatusDotState = 'idle' | 'ok' | 'warn' | 'err' | 'live';
export type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type BtnSize = 'sm' | 'md';
export type BadgeTone = 'neutral' | Tone;

/** Swatch paints are only assigned for literals CSSOM can safely consume. */
const SAFE_SWATCH =
  /^(?:#[0-9A-Fa-f]{3}|#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{8}|rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)|rgba\(\d{1,3}, \d{1,3}, \d{1,3}, (?:0|1|0\.\d{1,3})\))$/;

function isSafeColor(value: string): boolean {
  return SAFE_SWATCH.test(value);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function append(node: HTMLElement, children?: readonly Child[]): void {
  if (!children) return;
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.append(child);
  }
}

/* 1 · ax-panel — elevated surface */

export interface PanelOptions {
  className?: string;
  children?: readonly Child[];
  /** Play the 180ms dock-edge entrance animation (axis-panel-in). */
  animateIn?: boolean;
}

export function panel(options?: PanelOptions): HTMLDivElement {
  const node = el('div', 'ax-panel');
  if (options?.className) node.classList.add(options.className);
  if (options?.animateIn) node.classList.add('ax-panel--in');
  append(node, options?.children);
  return node;
}

/* 2 · ax-header — sticky header + optional count pill */

export interface HeaderOptions {
  title: string;
  /** Optional count pill next to the title. */
  count?: string | number;
  className?: string;
  children?: readonly Child[];
}

export function header(options: HeaderOptions): HTMLElement {
  const node = el('div', 'ax-header');
  if (options.className) node.classList.add(options.className);
  node.append(el('span', 'ax-header__title', options.title));
  if (options.count !== undefined) {
    node.append(el('span', 'ax-header__count', String(options.count)));
  }
  append(node, options.children);
  return node;
}

/* 3 · ax-tabs — segmented control */

export interface TabItem {
  id: string;
  label: string;
  /** Optional icon rendered before the label. */
  icon?: Node;
  /** Optional count pill rendered after the label. */
  count?: string | number;
}

export interface TabsOptions {
  tabs: readonly TabItem[];
  /** Initially selected tab id (first tab when omitted). */
  active?: string;
  /** Called with the new tab id on activation. */
  onSelect?: (id: string) => void;
  className?: string;
}

export function tabs(options: TabsOptions): HTMLElement {
  const node = el('div', 'ax-tabs');
  node.setAttribute('role', 'tablist');
  if (options.className) node.classList.add(options.className);
  const activeId =
    options.active ?? (options.tabs.length > 0 ? options.tabs[0].id : '');
  const buttons: HTMLButtonElement[] = [];
  const select = (id: string): void => {
    for (const button of buttons) {
      button.setAttribute(
        'aria-selected',
        button.dataset.tabId === id ? 'true' : 'false',
      );
    }
    options.onSelect?.(id);
  };
  for (const item of options.tabs) {
    const tab = el('button', 'ax-tabs__tab');
    tab.type = 'button';
    tab.setAttribute('role', 'tab');
    tab.dataset.tabId = item.id;
    tab.setAttribute('aria-selected', item.id === activeId ? 'true' : 'false');
    if (item.icon) {
      const icon = el('span', 'ax-tabs__icon');
      icon.append(item.icon);
      tab.append(icon);
    }
    tab.append(el('span', 'ax-tabs__label', item.label));
    if (item.count !== undefined) {
      tab.append(el('span', 'ax-tabs__count', String(item.count)));
    }
    tab.addEventListener('click', () => {
      select(item.id);
    });
    buttons.push(tab);
    node.append(tab);
  }
  node.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const index = buttons.findIndex(
      (button) => button.getAttribute('aria-selected') === 'true',
    );
    if (index < 0) return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = buttons[(index + delta + buttons.length) % buttons.length];
    next.focus();
    select(next.dataset.tabId ?? '');
  });
  return node;
}

/* 4 · ax-row — hairline-separated list row */

export interface RowOptions {
  className?: string;
  children?: readonly Child[];
  active?: boolean;
  /** Hover/focus actions rendered over the right-edge scrim. */
  actions?: readonly Child[];
  /** Render as <li> instead of <div> (for <ul> lists). */
  as?: 'li';
}

export function row(options?: RowOptions): HTMLElement {
  const node = options?.as === 'li' ? el('li', 'ax-row') : el('div', 'ax-row');
  if (options?.className) node.classList.add(options.className);
  if (options?.active) node.classList.add('is-active');
  append(node, options?.children);
  if (options?.actions && options.actions.length > 0) {
    const scrim = el('span', 'ax-row__scrim');
    scrim.setAttribute('aria-hidden', 'true');
    const actions = el('span', 'ax-row__actions');
    append(actions, options.actions);
    node.append(scrim, actions);
  }
  return node;
}

/* 5 · ax-chip — 2px filter chip / toggle-group member */

export interface ChipOptions {
  label: string;
  /** Data value for the chip group (e.g. filter kind). */
  value: string;
  pressed?: boolean;
  /** Called after the aria-pressed state flips. */
  onToggle?: (value: string, pressed: boolean) => void;
  className?: string;
  /** Optional icon rendered before the label. */
  icon?: Node;
  /** Optional count pill rendered after the label. */
  count?: string | number;
}

export function chip(options: ChipOptions): HTMLButtonElement {
  const node = el('button', 'ax-chip');
  node.type = 'button';
  node.dataset.value = options.value;
  node.setAttribute('aria-pressed', options.pressed ? 'true' : 'false');
  if (options.className) node.classList.add(options.className);
  if (options.icon) {
    const icon = el('span', 'ax-chip__icon');
    icon.append(options.icon);
    node.append(icon);
  }
  node.append(el('span', 'ax-chip__label', options.label));
  if (options.count !== undefined) {
    node.append(el('span', 'ax-chip__count', String(options.count)));
  }
  node.addEventListener('click', () => {
    const pressed = node.getAttribute('aria-pressed') !== 'true';
    node.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    options.onToggle?.(options.value, pressed);
  });
  return node;
}

/* 6 · ax-kpi — stat tile */

export interface KpiOptions {
  label: string;
  value: string;
  /** Optional semantic tint on the value (up/down/warn/…). */
  tone?: Tone;
  className?: string;
}

export function kpi(options: KpiOptions): HTMLElement {
  const node = el('div', 'ax-kpi');
  if (options.className) node.classList.add(options.className);
  if (options.tone) node.classList.add(`ax-kpi--${options.tone}`);
  const value = el('span', 'ax-kpi__value', options.value);
  if (options.tone) value.classList.add(`ax-kpi__value--${options.tone}`);
  node.append(el('span', 'ax-kpi__label', options.label), value);
  return node;
}

/* 7 · ax-capsule — 18px status capsule */

export interface CapsuleOptions {
  /** Short uppercase code (e.g. 'LIVE', 'RUN'). */
  code: string;
  value?: string;
  /** Inset accent ring (zero footprint change). */
  active?: boolean;
  className?: string;
}

export function capsule(options: CapsuleOptions): HTMLElement {
  const node = el('span', 'ax-capsule');
  if (options.className) node.classList.add(options.className);
  if (options.active) node.classList.add('ax-capsule--active');
  node.append(el('span', 'ax-capsule__code', options.code));
  if (options.value !== undefined) {
    node.append(el('span', 'ax-capsule__value', options.value));
  }
  return node;
}

/* 8 · ax-status-dot — 6px dot + word */

export interface StatusDotOptions {
  label: string;
  state?: StatusDotState;
  className?: string;
}

export function statusDot(options: StatusDotOptions): HTMLElement {
  const node = el('span', 'ax-status-dot');
  if (options.state) node.classList.add(`ax-status-dot--${options.state}`);
  if (options.className) node.classList.add(options.className);
  const dot = el('span', 'ax-status-dot__dot');
  dot.setAttribute('aria-hidden', 'true');
  node.append(dot, options.label);
  return node;
}

/* 9 · ax-search — search input */

export interface SearchOptions {
  placeholder?: string;
  value?: string;
  /** Accessible label for the input. */
  ariaLabel?: string;
  onInput?: (value: string) => void;
  className?: string;
  /** data-restore-focus key so focus survives re-renders. */
  restoreKey?: string;
}

export function search(options?: SearchOptions): HTMLInputElement {
  const node = el('input', 'ax-search');
  node.type = 'search';
  if (options?.placeholder) node.placeholder = options.placeholder;
  if (options?.value !== undefined) node.value = options.value;
  if (options?.ariaLabel) node.setAttribute('aria-label', options.ariaLabel);
  if (options?.className) node.classList.add(options.className);
  if (options?.restoreKey) {
    node.setAttribute(RESTORE_FOCUS_ATTR, options.restoreKey);
  }
  node.addEventListener('input', () => {
    options?.onInput?.(node.value);
  });
  return node;
}

/* 10 · ax-field — floating-label input */

export interface FieldOptions {
  label: string;
  /** Input id so the <label> can target it. */
  inputId?: string;
  value?: string;
  placeholder?: string;
  /** Mono variant for key/symbol entry. */
  mono?: boolean;
  onInput?: (value: string) => void;
  className?: string;
  restoreKey?: string;
}

export function field(options: FieldOptions): HTMLElement {
  const node = el('div', 'ax-field');
  if (options.mono) node.classList.add('ax-field--mono');
  if (options.className) node.classList.add(options.className);
  const label = el('label', 'ax-field__label', options.label);
  const input = el('input', 'ax-field__input');
  input.type = 'text';
  if (options.inputId) {
    input.id = options.inputId;
    label.setAttribute('for', options.inputId);
  }
  if (options.placeholder) input.placeholder = options.placeholder;
  if (options.value !== undefined) input.value = options.value;
  if (options.restoreKey) input.setAttribute(RESTORE_FOCUS_ATTR, options.restoreKey);
  input.addEventListener('input', () => {
    options.onInput?.(input.value);
  });
  node.append(label, input);
  return node;
}

/* 11 · ax-kbd — mono kbd chip */

export function kbd(text: string): HTMLElement {
  return el('kbd', 'ax-kbd', text);
}

/* 12 · ax-empty — empty state */

export interface EmptyOptions {
  /** Optional short title above the hint (clearer hierarchy). */
  title?: string;
  hint: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function empty(options: EmptyOptions): HTMLElement {
  const node = el('div', 'ax-empty');
  if (options.className) node.classList.add(options.className);
  if (options.title) {
    node.append(el('div', 'ax-empty__title', options.title));
  }
  node.append(el('div', 'ax-empty__hint', options.hint));
  if (options.actionLabel) {
    const action = el('button', 'ax-empty__action', options.actionLabel);
    action.type = 'button';
    action.addEventListener('click', () => {
      options.onAction?.();
    });
    node.append(action);
  }
  return node;
}

/* 13 · ax-flash — 180ms tick flash keyed off a value change */

export type FlashDirection = 'up' | 'down';

export interface FlashOptions {
  value?: string;
  direction?: FlashDirection;
  className?: string;
}

export function flash(options?: FlashOptions): HTMLElement {
  const node = el('span', 'ax-flash');
  if (options?.direction) node.classList.add(`ax-flash--${options.direction}`);
  if (options?.className) node.classList.add(options.className);
  if (options?.value !== undefined) node.textContent = options.value;
  return node;
}

/* 14 · ax-bar — profiler timing bar */

export interface BarSegment {
  /** Segment width in percent of the track (clamped to 0–100). */
  width: number;
  tone?: Tone;
}

export interface BarOptions {
  segments: readonly BarSegment[];
  className?: string;
}

export function bar(options: BarOptions): HTMLElement {
  const node = el('div', 'ax-bar');
  if (options.className) node.classList.add(options.className);
  for (const segment of options.segments) {
    const part = el('span', 'ax-bar__segment');
    if (segment.tone) part.classList.add(`ax-bar__segment--${segment.tone}`);
    if (Number.isFinite(segment.width)) {
      part.style.width = `${Math.max(0, Math.min(100, segment.width))}%`;
    }
    node.append(part);
  }
  return node;
}

/* 15 · ax-swatch — color-literal chip */

export interface SwatchOptions {
  /** Raw color literal (code text). */
  code: string;
  /** Swatch paint; omitted/unpaintable literals render the hatched fallback. */
  color?: string;
  onClick?: (event: MouseEvent) => void;
  className?: string;
}

export function swatch(options: SwatchOptions): HTMLButtonElement {
  const node = el('button', 'ax-swatch');
  node.type = 'button';
  if (options.className) node.classList.add(options.className);
  const paint = el('span', 'ax-swatch__paint');
  paint.setAttribute('aria-hidden', 'true');
  if (options.color !== undefined && isSafeColor(options.color)) {
    paint.style.backgroundColor = options.color;
  } else {
    paint.classList.add('ax-swatch__paint--raw');
  }
  node.append(paint, el('span', 'ax-swatch__code', options.code));
  node.addEventListener('click', (event) => {
    options.onClick?.(event);
  });
  return node;
}

/* 16 · ax-glyph — symbol grid cell */

export interface GlyphOptions {
  char: string;
  name: string;
  onInsert?: (char: string, name: string) => void;
  className?: string;
}

export function glyph(options: GlyphOptions): HTMLButtonElement {
  const node = el('button', 'ax-glyph');
  node.type = 'button';
  node.title = options.name;
  if (options.className) node.classList.add(options.className);
  node.append(
    el('span', 'ax-glyph__char', options.char),
    el('span', 'ax-glyph__name', options.name),
  );
  node.addEventListener('click', () => {
    options.onInsert?.(options.char, options.name);
  });
  return node;
}

/* 17 · ax-btn — primary / secondary / ghost / danger control */

export interface BtnOptions {
  label: string;
  variant?: BtnVariant;
  size?: BtnSize;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  pressed?: boolean;
  title?: string;
  ariaLabel?: string;
  /** Optional leading icon node. */
  icon?: Node;
  onClick?: (event: MouseEvent) => void;
  className?: string;
  /** Extra data-* attributes (action keys, ids). */
  dataset?: Record<string, string>;
}

export function btn(options: BtnOptions): HTMLButtonElement {
  const variant = options.variant ?? 'secondary';
  const size = options.size ?? 'md';
  const node = el('button', `ax-btn ax-btn--${variant} ax-btn--${size}`);
  node.type = options.type ?? 'button';
  if (options.className) node.classList.add(options.className);
  if (options.disabled) node.disabled = true;
  if (options.title) node.title = options.title;
  if (options.ariaLabel) node.setAttribute('aria-label', options.ariaLabel);
  if (options.pressed !== undefined) {
    node.setAttribute('aria-pressed', options.pressed ? 'true' : 'false');
  }
  if (options.dataset) {
    for (const [key, value] of Object.entries(options.dataset)) {
      node.dataset[key] = value;
    }
  }
  if (options.icon) {
    const icon = el('span', 'ax-btn__icon');
    icon.append(options.icon);
    node.append(icon);
  }
  node.append(el('span', 'ax-btn__label', options.label));
  if (options.onClick) {
    node.addEventListener('click', options.onClick);
  }
  return node;
}

/* 18 · ax-toolbar — compact chrome strip */

export interface ToolbarOptions {
  className?: string;
  children?: readonly Child[];
  /** Accessible name for the toolbar role. */
  ariaLabel?: string;
}

export function toolbar(options?: ToolbarOptions): HTMLElement {
  const node = el('div', 'ax-toolbar');
  node.setAttribute('role', 'toolbar');
  if (options?.ariaLabel) node.setAttribute('aria-label', options.ariaLabel);
  if (options?.className) node.classList.add(options.className);
  append(node, options?.children);
  return node;
}

/* 19 · ax-badge — compact semantic pill */

export interface BadgeOptions {
  text: string;
  tone?: BadgeTone;
  className?: string;
}

export function badge(options: BadgeOptions): HTMLElement {
  const tone = options.tone ?? 'neutral';
  const node = el('span', `ax-badge ax-badge--${tone}`, options.text);
  if (options.className) node.classList.add(options.className);
  return node;
}

/* 20 · ax-section-title — uppercase section label */

export interface SectionTitleOptions {
  text: string;
  className?: string;
  /** Render as h2/h3 when the surrounding landmark needs a heading. */
  as?: 'div' | 'h2' | 'h3';
}

export function sectionTitle(options: SectionTitleOptions): HTMLElement {
  const tag = options.as ?? 'div';
  const node = el(tag, 'ax-section-title', options.text);
  if (options.className) node.classList.add(options.className);
  return node;
}

/* 21 · ax-loading — compact indeterminate status */

export interface LoadingOptions {
  label?: string;
  className?: string;
}

export function loading(options?: LoadingOptions): HTMLElement {
  const node = el('div', 'ax-loading');
  if (options?.className) node.classList.add(options.className);
  node.setAttribute('role', 'status');
  node.setAttribute('aria-live', 'polite');
  const spinner = el('span', 'ax-loading__spinner');
  spinner.setAttribute('aria-hidden', 'true');
  node.append(spinner);
  const label = options?.label ?? 'Loading…';
  node.append(el('span', 'ax-loading__label', label));
  return node;
}

/* 22 · ax-code — mono block for JSON / dumps */

export interface CodeOptions {
  text: string;
  className?: string;
}

export function codeBlock(options: CodeOptions): HTMLElement {
  const node = el('pre', 'ax-code', options.text);
  if (options.className) node.classList.add(options.className);
  return node;
}

/* 23 · ax-cluster — flex wrap gap helper for chips / actions */

export interface ClusterOptions {
  className?: string;
  children?: readonly Child[];
  gap?: 'xs' | 'sm';
}

export function cluster(options?: ClusterOptions): HTMLElement {
  const node = el('div', 'ax-cluster');
  if (options?.gap === 'xs') node.classList.add('ax-cluster--xs');
  if (options?.className) node.classList.add(options.className);
  append(node, options?.children);
  return node;
}
