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

import { btn, empty, header, kpi, row, statusDot } from '@axis-shared/components';

/** View-model row for a summary field. */
interface SummaryRow {
  key: string;
  label: string;
  value: string;
}

/** View-model chip for a summary meta value. */
interface SummaryMetaChip {
  key: string;
  label: string;
  value: string;
}

/** Partial/expected Summary tab payload. */
export interface SummaryData {
  status?: 'success' | 'error' | 'idle';
  statusLabel?: string;
  focusLine?: string;
  rows?: readonly SummaryRow[];
  metaChips?: readonly SummaryMetaChip[];
  emptyTitle?: string;
  emptyMessage?: string;
  runId?: string | null;
}

/** Summary tab callbacks. */
export interface SummaryActions {
  copyId(runId: string): void;
  focusRun(runId: string): void;
}

function statusState(status: string | undefined): 'idle' | 'ok' | 'err' {
  if (status === 'success') return 'ok';
  if (status === 'error') return 'err';
  return 'idle';
}

function appendRows(container: HTMLElement, rows: readonly SummaryRow[] | undefined): void {
  if (!rows) return;
  for (const item of rows) {
    const node = row({
      children: [
        span('runoutput-key', `${item.label}:`),
        span('runoutput-value', item.value),
      ],
    });
    node.dataset.key = item.key;
    container.append(node);
  }
}

function span(className: string, text: string): HTMLSpanElement {
  const node = document.createElement('span');
  node.className = className;
  node.textContent = text;
  return node;
}

/** Render the Summary tab into a DOM fragment. */
export function renderSummary(data: unknown, actions: SummaryActions): HTMLElement {
  const tab = document.createElement('div');
  tab.className = 'runoutput-tab runoutput-tab--summary';

  const summary = data as SummaryData | undefined;
  const status = summary?.status ?? 'idle';
  const statusLabel = summary?.statusLabel ?? 'Idle';
  const focusLine = summary?.focusLine ?? '';
  const runId = summary?.runId ?? null;
  const rows = summary?.rows ?? [];
  const metaChips = summary?.metaChips ?? [];

  const actionsRow: HTMLElement[] = [];
  if (runId) {
    actionsRow.push(
      button('Copy id', () => {
        actions.copyId(runId);
      }),
    );
    actionsRow.push(
      button('Focus', () => {
        actions.focusRun(runId);
      }),
    );
  }

  const headerNode = header({
    title: 'Summary',
    children: [
      statusDot({ label: statusLabel, state: statusState(status) }),
      span('runoutput-focusline', focusLine),
      ...actionsRow,
    ],
  });
  tab.append(headerNode);

  if (metaChips.length > 0) {
    const chips = document.createElement('div');
    chips.className = 'runoutput-chips';
    for (const chip of metaChips) {
      chips.append(kpi({ label: chip.label, value: chip.value }));
    }
    tab.append(chips);
  }

  if (rows.length === 0) {
    const hint = summary?.emptyMessage ?? 'Run a Pine script to see results.';
    tab.append(empty({ hint }));
    return tab;
  }

  const list = document.createElement('div');
  list.className = 'runoutput-rows';
  appendRows(list, rows);
  tab.append(list);

  return tab;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  return btn({
    label,
    variant: 'secondary',
    size: 'sm',
    className: 'runoutput-button',
    onClick,
  });
}
