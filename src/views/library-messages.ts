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
 * Library studio cards + `studio.*` wire helpers (`axis.library`).
 * Pure — no vscode import.
 *
 * Wire mapping from the old flat protocol:
 * - `{ type: 'library.init' | 'library.state', cards, catalogError }` became
 *   `studio.init` / `studio.set` carrying `{ view: 'library', data: { cards,
 *   catalogError } }` — the old payload fields preserved verbatim as `data`.
 * - `{ type: 'library.ready' }` became `studio.ready` `{ view: 'library' }`.
 * - `{ type: 'library.apply' | 'library.copy', id }` became `studio.action`
 *   `{ view: 'library', action, args: { id } }` — the old `id` field moved
 *   into `args` verbatim.
 *
 * Cards never include Pine `code`. Every parse never throws.
 */

import type { BuiltinCatalogEntry } from '../host/builtins';

/** `view` value for every Library studio envelope — exactly `'library'`. */
export const LIBRARY_STUDIO_VIEW = 'library';

export type LibraryKind = 'indicator' | 'strategy';

/** Builtin row shipped to the webview. `code` is intentionally absent. */
export type LibraryCard = {
  id: string;
  title: string;
  shorttitle: string;
  description: string;
  category: string;
  categoryLabel: string;
  kind: LibraryKind;
  overlay: boolean;
  covers: string;
  tags: readonly string[];
};

/** `studio.init` / `studio.set` `data` — the old `library.init` payload verbatim. */
export type LibraryStudioData = {
  cards: LibraryCard[];
  catalogError: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readString(raw: Record<string, unknown>, key: string): string {
  try {
    const value = raw[key];
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

function readKind(raw: Record<string, unknown>): LibraryKind {
  try {
    return raw.kind === 'strategy' ? 'strategy' : 'indicator';
  } catch {
    return 'indicator';
  }
}

function readOverlay(raw: Record<string, unknown>): boolean {
  try {
    return raw.overlay === true;
  } catch {
    return false;
  }
}

function readTags(raw: Record<string, unknown>): string[] {
  try {
    const value = raw.tags;
    if (!Array.isArray(value)) return [];
    const tags: string[] = [];
    for (const item of value) {
      if (typeof item === 'string' && item) tags.push(item);
    }
    return tags;
  } catch {
    return [];
  }
}

function cardFromUnknown(raw: unknown): LibraryCard | null {
  if (!isRecord(raw)) return null;
  const id = readString(raw, 'id').trim();
  if (!id) return null;
  const title = readString(raw, 'title').trim() || id;
  const shorttitle = readString(raw, 'shorttitle').trim() || id;
  return {
    id,
    title,
    shorttitle,
    description: readString(raw, 'description'),
    category: readString(raw, 'category'),
    categoryLabel: readString(raw, 'categoryLabel'),
    kind: readKind(raw),
    overlay: readOverlay(raw),
    covers: readString(raw, 'covers'),
    tags: readTags(raw),
  };
}

/**
 * Strip Pine source (and any other fields) off catalog rows.
 * Never throws — non-arrays and hostile entries become `[]` or are skipped.
 */
export function toLibraryCards(scripts: readonly BuiltinCatalogEntry[]): LibraryCard[] {
  try {
    if (!Array.isArray(scripts)) return [];
    const cards: LibraryCard[] = [];
    for (const raw of scripts) {
      const card = cardFromUnknown(raw);
      if (card) cards.push(card);
    }
    return cards;
  } catch {
    return [];
  }
}

function catalogErrorText(catalogError: unknown): string {
  return typeof catalogError === 'string' ? catalogError : '';
}

/**
 * Host → web `studio.init` / `studio.set` data — the exact `{ cards,
 * catalogError }` payload the old `library.init` / `library.state` messages
 * carried, preserved verbatim. Never throws.
 */
export function toLibraryStudioData(
  scripts: readonly BuiltinCatalogEntry[],
  catalogError?: unknown,
): LibraryStudioData {
  return {
    cards: toLibraryCards(scripts),
    catalogError: catalogErrorText(catalogError),
  };
}

/**
 * Old `library.apply` / `library.copy` validation, moved into `args`: the id
 * must be a trimmed non-empty string. Missing / invalid args return null
 * exactly like the old parser returned nothing. Never throws.
 */
export function parseLibraryActionArgs(args: unknown): string | null {
  if (!isRecord(args)) return null;
  let value: unknown;
  try {
    value = args.id;
  } catch {
    return null;
  }
  if (typeof value !== 'string') return null;
  const id = value.trim();
  return id ? id : null;
}

/**
 * Trusted studio DOM for the shell body (the exact markup the old
 * `library-html.ts` builder emitted between `<body>` and the script tag;
 * the webview JS depends on those ids/classes).
 */
export function buildLibraryBody(): string {
  return `<div id="library-live" class="library-live" role="status" aria-live="polite" aria-atomic="true"></div>
  <div id="library-root" class="library-root" data-axis-library-host="1">
    <p class="library-boot">Loading builtin scripts…</p>
  </div>`;
}
