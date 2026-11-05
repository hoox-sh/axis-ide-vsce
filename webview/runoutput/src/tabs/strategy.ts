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

import { empty, header, kpi, row } from '@axis-shared/components';

/** View-model row for a strategy field. */
interface StrategyRow {
  key: string;
  label: string;
  value: string;
}

/** Partial/expected Strategy tab payload. */
export interface StrategyData {
  hasReport?: boolean;
  kpis?: readonly StrategyRow[];
  rows?: readonly StrategyRow[];
  note?: string | null;
}

function appendRows(container: HTMLElement, rows: readonly StrategyRow[] | undefined): void {
  if (!rows) return;
  for (const item of rows) {
    const node = row({
      children: [labelSpan(`${item.label}:`), valueSpan(item.value)],
    });
    node.dataset.key = item.key;
    container.append(node);
  }
}

function labelSpan(text: string): HTMLSpanElement {
  const node = document.createElement('span');
  node.className = 'runoutput-key';
  node.textContent = text;
  return node;
}

function valueSpan(text: string): HTMLSpanElement {
  const node = document.createElement('span');
  node.className = 'runoutput-value';
  node.textContent = text;
  return node;
}

/** Render the Strategy tab into a DOM fragment. */
export function renderStrategy(data: unknown): HTMLElement {
  const tab = document.createElement('div');
  tab.className = 'runoutput-tab runoutput-tab--strategy';
  tab.append(header({ title: 'Strategy' }));

  const strategy = data as StrategyData | undefined;
  if (!strategy?.hasReport || (strategy.kpis?.length === 0 && strategy.rows?.length === 0)) {
    tab.append(
      empty({
        hint:
          strategy?.note ??
          'This run has no strategy report. Open a strategy script and run with Ctrl/Cmd+Enter.',
      }),
    );
    return tab;
  }

  if (strategy.kpis && strategy.kpis.length > 0) {
    const kpis = document.createElement('div');
    kpis.className = 'runoutput-kpis';
    for (const item of strategy.kpis) {
      kpis.append(kpi({ label: item.label, value: item.value }));
    }
    tab.append(kpis);
  }

  if (strategy.rows && strategy.rows.length > 0) {
    const remainder = document.createElement('div');
    remainder.className = 'runoutput-rows';
    appendRows(remainder, strategy.rows);
    tab.append(remainder);
  }

  return tab;
}
