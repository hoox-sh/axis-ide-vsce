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
 * Layers studio snapshot + shell body on `axis.webview.v1` `studio.*`
 * envelopes. Pure: do not import `layers.ts` (it imports vscode) or the
 * chart editor. Section order matches `LAYER_SECTION_ORDER` in `layers.ts`.
 *
 * Wire mapping from the old flat protocol: `{ type: 'layers.set', snapshot }`
 * became `studio.set` / `studio.init` carrying `{ view: 'layers', data }`
 * where `data` is the exact snapshot object (fields verbatim);
 * `{ type: 'layers.ready' }` became `studio.ready`; `{ type:
 * 'layers.openChart' }` became `studio.action` with action `openChart`
 * (no args — the old message carried none either).
 */

/** PWA / tree order: Scripts → Panes → Overlays → On-chain → Drawings. */
export const LAYER_SECTION_TITLES = [
  'Scripts',
  'Panes',
  'Overlays',
  'On-chain',
  'Drawings',
] as const;

export type LayerSectionTitle = (typeof LAYER_SECTION_TITLES)[number];

/** Empty-row copy — same strings as `SECTION_EMPTY_LABEL` in `layers.ts`. */
export const LAYER_SECTION_EMPTY: Record<LayerSectionTitle, string> = {
  Scripts: 'Apply a builtin',
  Panes: 'No panes yet',
  Overlays: 'No overlays yet',
  'On-chain': 'No on-chain yet',
  Drawings: 'No drawings yet',
};

/** One-line role shown on each section card. */
export const LAYER_SECTION_ROLES: Record<LayerSectionTitle, string> = {
  Scripts: 'Builtins and scripts applied on this chart',
  Panes: 'Price and indicator panes in the chart',
  Overlays: 'Series drawn on the price pane',
  'On-chain': 'On-chain datasets bound to this chart',
  Drawings: 'User drawings saved in the chart file',
};

export const LAYERS_SOURCE_OPEN = 'from the open chart';
export const LAYERS_SOURCE_CLOSED = 'no chart open';

export type LayersSourceLabel = typeof LAYERS_SOURCE_OPEN | typeof LAYERS_SOURCE_CLOSED;

export type LayersRow = {
  id: string;
  label: string;
  detail: string;
};

export type LayersSection = {
  id: string;
  title: LayerSectionTitle;
  role: string;
  count: number;
  rows: LayersRow[];
  empty: string;
};

export type LayersSnapshot = {
  chartOpen: boolean;
  total: number;
  source: LayersSourceLabel;
  sections: [
    LayersSection,
    LayersSection,
    LayersSection,
    LayersSection,
    LayersSection,
  ];
};

/** `view` value for every Layers studio envelope — exactly `'layers'`. */
export const LAYERS_STUDIO_VIEW = 'layers';

/**
 * `action` name the Layers webview posts to open a chart (the old flat
 * `layers.openChart` message, now `studio.action` with no args).
 */
export const LAYERS_ACTION_OPEN_CHART = 'openChart';

/** What the panel passes in. `doc` is ignored unless `chartOpen` is true. */
export type LayersSnapshotInput = {
  chartOpen: boolean;
  doc?: unknown;
};

const ONCHAIN_KEYS = ['onChain', 'onchain', 'on-chain'] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  try {
    return !Array.isArray(value);
  } catch {
    return false;
  }
}

function readOwn(obj: Record<string, unknown>, key: string): unknown {
  try {
    return obj[key];
  } catch {
    return undefined;
  }
}

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  try {
    return Object.prototype.hasOwnProperty.call(obj, key);
  } catch {
    return false;
  }
}

function sectionSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function sectionId(title: LayerSectionTitle): string {
  return `layers.section.${sectionSlug(title)}`;
}

function readString(bag: Record<string, unknown>, key: string): string {
  try {
    const value = bag[key];
    return typeof value === 'string' ? value.trim() : '';
  } catch {
    return '';
  }
}

/**
 * Usable array length, or null when `value` is not an array / length is hostile.
 * Zero is a real length (empty list), not null.
 */
function arrayLength(value: unknown): number | null {
  if (!Array.isArray(value)) return null;
  try {
    const length = value.length;
    if (typeof length !== 'number' || !Number.isInteger(length) || length < 0) return null;
    return length;
  } catch {
    return null;
  }
}

function scriptRow(entry: unknown): LayersRow | null {
  try {
    if (typeof entry === 'string') {
      const id = entry.trim();
      if (!id) return null;
      return { id: `layers.script.${id}`, label: id, detail: '' };
    }
    if (entry === null || typeof entry !== 'object') return null;
    if (Array.isArray(entry)) return null;
    const bag = entry as Record<string, unknown>;
    const id = readString(bag, 'id');
    const scriptId = readString(bag, 'scriptId');
    const name = readString(bag, 'name');
    const key = id || scriptId || name;
    if (!key) return null;
    return {
      id: `layers.script.${key}`,
      label: name || key,
      detail: readString(bag, 'kind'),
    };
  } catch {
    return null;
  }
}

function rowsFromScriptList(value: unknown): LayersRow[] {
  const length = arrayLength(value);
  if (length === null || length === 0) return [];
  const list = value as unknown[];
  const rows: LayersRow[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < length; i++) {
    let entry: unknown;
    try {
      entry = list[i];
    } catch {
      continue;
    }
    const row = scriptRow(entry);
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    rows.push(row);
  }
  return rows;
}

function scriptRows(doc: Record<string, unknown>): LayersRow[] {
  if (hasOwn(doc, 'scripts')) return rowsFromScriptList(readOwn(doc, 'scripts'));
  if (hasOwn(doc, 'scriptIds')) return rowsFromScriptList(readOwn(doc, 'scriptIds'));
  return [];
}

function drawingRow(index: number, entry: unknown): LayersRow {
  const fallback: LayersRow = {
    id: `layers.drawing.${index}`,
    label: `Drawing ${index + 1}`,
    detail: '',
  };
  try {
    if (typeof entry === 'string') {
      const label = entry.trim();
      return {
        id: fallback.id,
        label: label || fallback.label,
        detail: '',
      };
    }
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return fallback;
    const bag = entry as Record<string, unknown>;
    const id = readString(bag, 'id');
    const name = readString(bag, 'name');
    const tool = readString(bag, 'tool');
    return {
      id: id ? `layers.drawing.${id}` : fallback.id,
      label: name || id || tool || fallback.label,
      detail: tool,
    };
  } catch {
    return fallback;
  }
}

/** One row per array element. Count is that length (not “valid drawings only”). */
function drawingRows(value: unknown): LayersRow[] {
  const length = arrayLength(value);
  if (length === null || length === 0) return [];
  const list = value as unknown[];
  const rows: LayersRow[] = [];
  for (let i = 0; i < length; i++) {
    let entry: unknown;
    try {
      entry = list[i];
    } catch {
      rows.push(drawingRow(i, undefined));
      continue;
    }
    rows.push(drawingRow(i, entry));
  }
  return rows;
}

function namedRow(sectionKey: string, index: number, entry: unknown): LayersRow | null {
  try {
    if (typeof entry === 'string') {
      const label = entry.trim();
      if (!label) return null;
      return { id: `layers.${sectionKey}.${index}`, label, detail: '' };
    }
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const bag = entry as Record<string, unknown>;
    const id = readString(bag, 'id');
    const labelText = readString(bag, 'label');
    const name = readString(bag, 'name');
    const label = labelText || name || id;
    if (!label) return null;
    return {
      id: id ? `layers.${sectionKey}.${id}` : `layers.${sectionKey}.${index}`,
      label,
      detail: readString(bag, 'kind'),
    };
  } catch {
    return null;
  }
}

function rowsFromNamedList(sectionKey: string, value: unknown): LayersRow[] {
  const length = arrayLength(value);
  if (length === null || length === 0) return [];
  const list = value as unknown[];
  const rows: LayersRow[] = [];
  for (let i = 0; i < length; i++) {
    let entry: unknown;
    try {
      entry = list[i];
    } catch {
      continue;
    }
    const row = namedRow(sectionKey, i, entry);
    if (row) rows.push(row);
  }
  return rows;
}

/** Field must be an own property. Non-arrays contribute no rows (no invented defaults). */
function rowsIfOwnArray(
  doc: Record<string, unknown>,
  key: string,
  sectionKey: string,
): LayersRow[] {
  if (!hasOwn(doc, key)) return [];
  return rowsFromNamedList(sectionKey, readOwn(doc, key));
}

function onChainRows(doc: Record<string, unknown>): LayersRow[] {
  for (const key of ONCHAIN_KEYS) {
    if (!hasOwn(doc, key)) continue;
    return rowsFromNamedList('on-chain', readOwn(doc, key));
  }
  return [];
}

function makeSection(title: LayerSectionTitle, rows: LayersRow[]): LayersSection {
  return {
    id: sectionId(title),
    title,
    role: LAYER_SECTION_ROLES[title],
    count: rows.length,
    rows,
    empty: LAYER_SECTION_EMPTY[title],
  };
}

function assemble(chartOpen: boolean, doc: Record<string, unknown> | null): LayersSnapshot {
  const sections: LayersSnapshot['sections'] = [
    makeSection('Scripts', doc ? scriptRows(doc) : []),
    makeSection('Panes', doc ? rowsIfOwnArray(doc, 'panes', 'panes') : []),
    makeSection('Overlays', doc ? rowsIfOwnArray(doc, 'overlays', 'overlays') : []),
    makeSection('On-chain', doc ? onChainRows(doc) : []),
    makeSection('Drawings', doc ? drawingRows(readOwn(doc, 'drawings')) : []),
  ];
  let total = 0;
  for (const section of sections) total += section.count;
  return {
    chartOpen,
    total,
    source: chartOpen ? LAYERS_SOURCE_OPEN : LAYERS_SOURCE_CLOSED,
    sections,
  };
}

/**
 * Build the five-section studio snapshot.
 * No chart (`chartOpen !== true`) → every count is 0 and source is "no chart open".
 * Panes, overlays, and on-chain stay empty unless that field is an own property.
 * Drawings count is `doc.drawings.length` when that value is an array.
 * Never throws.
 */
export function buildLayersSnapshot(input: unknown): LayersSnapshot {
  if (!isPlainObject(input)) return assemble(false, null);
  if (readOwn(input, 'chartOpen') !== true) return assemble(false, null);
  const doc = readOwn(input, 'doc');
  if (!isPlainObject(doc)) return assemble(true, null);
  return assemble(true, doc);
}

/**
 * Trusted studio DOM for the shell body (the exact markup the old
 * `layers-html.ts` builder emitted between `<body>` and the script tag;
 * the webview JS depends on those ids/classes).
 */
export function buildLayersBody(): string {
  // Open-chart chrome uses ax-btn classes (matches webview btn()); layers-open is the layout hook.
  return `<div id="layers-root" class="layers-root" data-axis-layers-host="1">
    <header class="layers-header">
      <h1 id="layers-title" class="layers-title">Layers</h1>
      <p id="layers-summary" class="layers-summary">0 items · no chart open</p>
      <button type="button" id="layers-open-chart" class="ax-btn ax-btn--primary ax-btn--md layers-open"><span class="ax-btn__label">Open chart</span></button>
    </header>
    <p id="layers-live" class="layers-live" aria-live="polite" aria-atomic="true"></p>
    <div id="layers-sections" class="layers-sections"></div>
  </div>`;
}
