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

import { btn, capsule, empty, header, row } from '@axis-shared/components';

/** Log row view model. */
interface LogRow {
  level?: string;
  message?: string;
  line?: number;
  timestamp?: number;
}

/** Partial/expected Logs tab payload. */
export interface LogsData {
  rows?: readonly LogRow[];
  runId?: string | null;
  status?: string | null;
}

/** Logs tab callbacks. */
export interface LogsActions {
  revealLogLine(line: number): void;
  copyLogText(text: string): void;
}

function formatLevel(level: string | undefined): string {
  if (!level) return 'info';
  return level.toLowerCase();
}

function appendRows(
  container: HTMLElement,
  rows: readonly LogRow[] | undefined,
  actions: LogsActions,
): void {
  if (!rows) return;
  for (const item of rows) {
    const message = item.message ?? '';
    const line = item.line;
    const level = formatLevel(item.level);

    const node = row({
      children: [
        capsule({ code: level.toUpperCase(), value: message.slice(0, 120) }),
      ],
      actions: [
        button('Copy', () => {
          actions.copyLogText(message);
        }),
        ...(line != null && line > 0
          ? [
              button('Reveal', () => {
                actions.revealLogLine(line);
              }),
            ]
          : []),
      ],
    });
    node.dataset.level = level;
    container.append(node);
  }
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

/** Render the Logs tab into a DOM fragment. */
export function renderLogs(data: unknown, actions: LogsActions): HTMLElement {
  const tab = document.createElement('div');
  tab.className = 'runoutput-tab runoutput-tab--logs';

  const logs = data as LogsData | undefined;
  const runId = logs?.runId ?? '—';
  const status = logs?.status ?? 'idle';
  const rows = logs?.rows ?? [];
  const count = rows.length;

  const statusCapsule = capsule({ code: 'STATUS', value: status ?? 'idle' });

  tab.append(
    header({
      title: 'Logs',
      count: String(count),
      children: [statusCapsule, runIdEl(runId)],
    }),
  );

  if (count === 0) {
    tab.append(empty({ hint: 'No logs for this run.' }));
    return tab;
  }

  const list = document.createElement('div');
  list.className = 'runoutput-rows';
  appendRows(list, rows, actions);
  tab.append(list);

  return tab;
}

function runIdEl(runId: string): HTMLSpanElement {
  const node = document.createElement('span');
  node.className = 'runoutput-focusline';
  node.textContent = runId;
  return node;
}
