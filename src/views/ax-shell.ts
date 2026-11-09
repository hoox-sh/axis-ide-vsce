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
 * Host-emitted shell chrome class names that match `webview/shared` `ax-*`
 * builders. Host HTML cannot call `btn()`; it must stamp the same frozen
 * classes so FOUC chrome matches the design system until (or if) the
 * webview replaces the node.
 */

export type AxBtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type AxBtnSize = 'sm' | 'md';

/** Class list for a primary/secondary/ghost/danger control (matches `btn()`). */
export function axBtnClass(
  variant: AxBtnVariant = 'primary',
  size: AxBtnSize = 'md',
  extra?: string,
): string {
  const parts = ['ax-btn', `ax-btn--${variant}`, `ax-btn--${size}`];
  const trimmed = extra?.trim();
  if (trimmed) parts.push(trimmed);
  return parts.join(' ');
}

/**
 * Trusted button markup for studio shells. Label is escaped for attribute
 * safety when used as text content (callers pass fixed, trusted labels).
 */
export function axBtnHtml(options: {
  id?: string;
  label: string;
  variant?: AxBtnVariant;
  size?: AxBtnSize;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  title?: string;
  dataAction?: string;
  /** Extra space-separated attributes already trusted (e.g. `aria-pressed="false"`). */
  attrs?: string;
}): string {
  const type = options.type ?? 'button';
  const className = axBtnClass(options.variant ?? 'primary', options.size ?? 'md', options.className);
  const bits = [`type="${type}"`, `class="${className}"`];
  if (options.id) bits.push(`id="${options.id}"`);
  if (options.title) bits.push(`title="${options.title}"`);
  if (options.dataAction) bits.push(`data-action="${options.dataAction}"`);
  if (options.attrs?.trim()) bits.push(options.attrs.trim());
  return `<button ${bits.join(' ')}><span class="ax-btn__label">${options.label}</span></button>`;
}
