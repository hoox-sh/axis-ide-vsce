// Copyright (C) 2026 jango_blockchained
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Shared search/filter/chip state machine plus setState persistence
 * helpers. One controller covers the query box + chip group pattern used
 * by the list studios; persistence is a validated slice of the webview's
 * setState blob so sibling keys (e.g. the active tab) are never clobbered.
 */

import type { VsCodeApi } from './vscode-api';

/** Live filter state — `query` '' matches everything, `filter` 'all' by convention. */
export interface FilterState {
  query: string;
  filter: string;
}

export interface FilterOptions {
  /** Vs Code API used for persistence; omit/null to stay in-memory. */
  api?: VsCodeApi | null;
  /** Key inside the persisted webview state blob; omit to skip persistence. */
  persistKey?: string;
  /** Allowed chip values; anything else restores the initial filter. */
  chips?: readonly string[];
  /** Values used when nothing valid is persisted. */
  initial?: Partial<FilterState>;
  /** Called after every accepted change. */
  onChange?: (state: FilterState) => void;
}

export interface FilterController {
  get(): FilterState;
  setQuery(query: string): void;
  setFilter(filter: string): void;
  /** Chip toggle — accepts only configured chip values; returns acceptance. */
  toggleChip(value: string): boolean;
  /** True when `value` is the active chip. */
  isActive(value: string): boolean;
  /** Case-insensitive substring test against the live query. */
  matches(text: string): boolean;
  /** Force a persistence write (writes also happen on every change). */
  persist(): void;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Read one validated slice from the webview state blob (null when absent). */
export function readPersistedSlice(api: VsCodeApi | null, key: string): unknown {
  if (!api) return null;
  try {
    const root = api.getState();
    if (!isPlainObject(root)) return null;
    return root[key] ?? null;
  } catch {
    return null;
  }
}

/** Merge one slice into the webview state blob without clobbering siblings. */
export function writePersistedSlice(
  api: VsCodeApi | null,
  key: string,
  value: unknown,
): void {
  if (!api) return;
  try {
    const current = api.getState();
    const root = isPlainObject(current) ? current : {};
    api.setState({ ...root, [key]: value });
  } catch {
    // host may be gone — persistence is best-effort
  }
}

function restore(options: FilterOptions): FilterState {
  const fallback: FilterState = {
    query: options.initial?.query ?? '',
    filter: options.initial?.filter ?? 'all',
  };
  if (!options.persistKey) return fallback;
  const raw = readPersistedSlice(options.api ?? null, options.persistKey);
  if (!isPlainObject(raw)) return fallback;
  const query = typeof raw.query === 'string' ? raw.query : fallback.query;
  const filter = typeof raw.filter === 'string' ? raw.filter : fallback.filter;
  const allowed = options.chips ? options.chips.includes(filter) : filter.length > 0;
  return { query, filter: allowed ? filter : fallback.filter };
}

/** Create a filter controller; restored synchronously from persisted state. */
export function createFilter(options: FilterOptions = {}): FilterController {
  const state = restore(options);
  const save = (): void => {
    if (options.persistKey) {
      writePersistedSlice(options.api ?? null, options.persistKey, { ...state });
    }
  };
  const notify = (): void => {
    options.onChange?.({ ...state });
  };
  return {
    get: () => ({ ...state }),
    setQuery(query) {
      state.query = query;
      save();
      notify();
    },
    setFilter(filter) {
      if (options.chips && !options.chips.includes(filter)) return;
      state.filter = filter;
      save();
      notify();
    },
    toggleChip(value) {
      if (options.chips && !options.chips.includes(value)) return false;
      state.filter = value;
      save();
      notify();
      return true;
    },
    isActive(value) {
      return state.filter === value;
    },
    matches(text) {
      const q = state.query.trim().toLowerCase();
      if (!q) return true;
      return text.toLowerCase().includes(q);
    },
    persist: save,
  };
}
