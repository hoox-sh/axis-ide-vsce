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

import {
  bar,
  btn,
  empty,
  header,
  kpi,
  row,
  sectionTitle,
  statusDot,
} from '@axis-shared/components';

/** Profiler hot line view model. */
interface ProfilerHotLine {
  line: number;
  count: number;
  text?: string;
}

/** Profiler phase view model. */
interface ProfilerPhase {
  name: string;
  ms: number;
}

/** Partial/expected Profiler tab payload. */
export interface ProfilerData {
  runId?: string;
  status?: 'success' | 'error';
  ms?: number;
  engineId?: string;
  seriesKey?: string;
  plotCount?: number;
  seriesCount?: number;
  createdAt?: number;
  topLines?: readonly ProfilerHotLine[];
  lineCount?: number;
  phases?: readonly ProfilerPhase[];
  error?: string;
}

/** Profiler tab callbacks. */
export interface ProfilerActions {
  revealProfilerLine(line: number): void;
  copyRunId(runId: string): void;
}

function appendMetadata(
  container: HTMLElement,
  data: ProfilerData,
): void {
  const fields: { label: string; value: string }[] = [
    { label: 'Engine', value: data.engineId ?? '—' },
    { label: 'Series', value: data.seriesKey ?? '—' },
    { label: 'Plots', value: String(data.plotCount ?? 0) },
    { label: 'Series', value: String(data.seriesCount ?? 0) },
  ];
  for (const field of fields) {
    container.append(
      row({
        children: [
          span('runoutput-key', `${field.label}:`),
          span('runoutput-value', field.value),
        ],
      }),
    );
  }
}

function span(className: string, text: string): HTMLSpanElement {
  const node = document.createElement('span');
  node.className = className;
  node.textContent = text;
  return node;
}

function appendPhases(container: HTMLElement, phases: readonly ProfilerPhase[] | undefined): void {
  if (!phases || phases.length === 0) return;
  container.append(sectionTitle({ text: 'Phases', as: 'h3', className: 'runoutput-section-title' }));

  const total = phases.reduce((sum, phase) => sum + (phase.ms ?? 0), 0) || 1;
  const list = document.createElement('div');
  list.className = 'runoutput-rows';
  const segments = phases.map((phase) => ({
    width: ((phase.ms / total) * 100) || 0,
    tone: 'info' as const,
  }));
  list.append(bar({ segments }));
  for (const phase of phases) {
    list.append(
      row({
        children: [
          span('runoutput-key', phase.name),
          span('runoutput-value', `${Math.round(phase.ms ?? 0)} ms`),
        ],
      }),
    );
  }
  container.append(list);
}

function appendHotLines(
  container: HTMLElement,
  lines: readonly ProfilerHotLine[] | undefined,
  actions: ProfilerActions,
): void {
  if (!lines || lines.length === 0) return;
  container.append(sectionTitle({ text: 'Hot lines', as: 'h3', className: 'runoutput-section-title' }));

  const list = document.createElement('div');
  list.className = 'runoutput-rows';
  for (const line of lines) {
    const text = line.text ?? `line ${line.line}`;
    const node = row({
      children: [
        span('runoutput-key', `L${line.line}`),
        span('runoutput-value', text),
      ],
      actions: [
        button('Reveal', () => {
          actions.revealProfilerLine(line.line);
        }),
      ],
    });
    node.dataset.line = String(line.line);
    list.append(node);
  }
  container.append(list);
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

/** Render the Profiler tab into a DOM fragment. */
export function renderProfiler(data: unknown, actions: ProfilerActions): HTMLElement {
  const tab = document.createElement('div');
  tab.className = 'runoutput-tab runoutput-tab--profiler';

  const profiler = data as ProfilerData | undefined;
  const status = profiler?.status ?? 'error';
  const runId = profiler?.runId ?? '';

  const headerActions: HTMLElement[] = [];
  if (runId) {
    headerActions.push(
      button('Copy id', () => {
        actions.copyRunId(runId);
      }),
    );
  }

  tab.append(
    header({
      title: 'Profiler',
      children: [
        statusDot({
          label: status === 'success' ? 'OK' : 'Error',
          state: status === 'success' ? 'ok' : 'err',
        }),
        runId ? span('runoutput-focusline', runId) : null,
        ...headerActions,
      ],
    }),
  );

  if (profiler?.error) {
    tab.append(
      row({
        children: [
          span('runoutput-key', 'Error:'),
          span('runoutput-value runoutput-value--error', String(profiler.error)),
        ],
      }),
    );
  }

  const ms = profiler?.ms ?? 0;
  const kpiRow = document.createElement('div');
  kpiRow.className = 'runoutput-kpis';
  kpiRow.append(kpi({ label: 'Duration', value: `${Math.round(ms)} ms` }));
  kpiRow.append(kpi({ label: 'Lines', value: String(profiler?.lineCount ?? 0) }));
  tab.append(kpiRow);

  const meta = document.createElement('div');
  meta.className = 'runoutput-rows';
  appendMetadata(meta, profiler ?? {});
  tab.append(meta);

  if (!profiler || (profiler.topLines?.length === 0 && profiler.phases?.length === 0)) {
    tab.append(empty({ hint: 'No profiler data for this run.' }));
    return tab;
  }

  appendPhases(tab, profiler.phases);
  appendHotLines(tab, profiler.topLines, actions);

  return tab;
}
