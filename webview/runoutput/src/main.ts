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
 * Run Output studio webview on the shared runtime + studio.* protocol.
 *
 * Host posts `studio.init` / `studio.set` with `view:'runoutput'` and a
 * composite data payload containing the Summary, Strategy, Profiler and Logs
 * tabs. The active tab is owned client-side; switching emits no host action.
 *
 * View → host actions: copyId, focusRun, revealProfilerLine, copyRunId,
 * revealLogLine, copyLogText.
 */

import '@axis-shared/tokens.css';
import '@axis-shared/theme.css';
import '@axis-shared/components.css';
import './style.css';
import { header, tabs } from '@axis-shared/components';
import { createStudio } from '@axis-shared/studio';
import {
  decodeStudioData,
  encodeStudioAction,
  encodeStudioReady,
  type StudioDataMessage,
} from '@axis-shared/studio-protocol';
import { renderLogs } from './tabs/logs';
import { renderProfiler } from './tabs/profiler';
import { renderStrategy } from './tabs/strategy';
import { renderSummary } from './tabs/summary';

const TABS = ['summary', 'strategy', 'profiler', 'logs'] as const;
type RunOutputTab = (typeof TABS)[number];

const TAB_LABELS: Record<RunOutputTab, string> = {
  summary: 'Summary',
  strategy: 'Strategy',
  profiler: 'Profiler',
  logs: 'Logs',
};

interface RunOutputData {
  activeTab: RunOutputTab;
  tabs: {
    summary: unknown;
    strategy: unknown;
    profiler: unknown;
    logs: unknown;
  };
  liveMessage?: string;
}

function isRunOutputTab(value: unknown): value is RunOutputTab {
  return typeof value === 'string' && TABS.includes(value as RunOutputTab);
}

function isLineNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value < 1_000_000;
}

function asRunnableId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asCopyText(value: unknown, max = 8192): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.slice(0, max).trim();
  return trimmed.length > 0 ? trimmed : null;
}

const studio = createStudio({ view: 'runoutput' });
let data: RunOutputData | null = null;
let activeTab: RunOutputTab = 'summary';
let tabButtons: HTMLButtonElement[] = [];

/* ------------------------------------------------------------------ *
 * Client-side tab state (persisted so the active tab survives reload).
 * ------------------------------------------------------------------ */

function restoreActiveTab(): void {
  const state = studio.getState();
  if (!state || typeof state !== 'object') return;
  const saved = (state as Record<string, unknown>).activeTab;
  if (isRunOutputTab(saved)) activeTab = saved;
}

function persistActiveTab(): void {
  studio.setState({ activeTab });
}

/* ------------------------------------------------------------------ *
 * Host action helpers — validated args → studio.action envelopes.
 * ------------------------------------------------------------------ */

function copyId(runId: string): void {
  const valid = asRunnableId(runId);
  if (!valid) return;
  studio.post(encodeStudioAction('runoutput', 'copyId', { runId: valid }));
}

function focusRun(runId: string): void {
  const valid = asRunnableId(runId);
  if (!valid) return;
  studio.post(encodeStudioAction('runoutput', 'focusRun', { runId: valid }));
}

function revealProfilerLine(line: number): void {
  if (!isLineNumber(line)) return;
  studio.post(encodeStudioAction('runoutput', 'revealProfilerLine', { line }));
}

function copyRunId(runId: string): void {
  const valid = asRunnableId(runId);
  if (!valid) return;
  studio.post(encodeStudioAction('runoutput', 'copyRunId', { runId: valid }));
}

function revealLogLine(line: number): void {
  if (!isLineNumber(line)) return;
  studio.post(encodeStudioAction('runoutput', 'revealLogLine', { line }));
}

function copyLogText(text: string): void {
  const valid = asCopyText(text);
  if (!valid) return;
  studio.post(encodeStudioAction('runoutput', 'copyLogText', { text: valid }));
}

const actions = {
  copyId,
  focusRun,
  revealProfilerLine,
  copyRunId,
  revealLogLine,
  copyLogText,
};

/* ------------------------------------------------------------------ *
 * Tab switching: client-side only (no host post on switch).
 * ------------------------------------------------------------------ */

function selectTab(tab: RunOutputTab): void {
  if (!isRunOutputTab(tab) || tab === activeTab) return;
  activeTab = tab;
  persistActiveTab();
  syncTabs();
  render();
}

function syncTabs(): void {
  for (const button of tabButtons) {
    const selected = button.dataset.tabId === activeTab;
    button.setAttribute('aria-selected', selected ? 'true' : 'false');
  }
}

/* ------------------------------------------------------------------ *
 * Build the shell.
 * ------------------------------------------------------------------ */

function buildHeader(): HTMLElement {
  const node = header({ title: 'Run Output' });
  node.classList.add('runoutput-header');
  return node;
}

function buildTabs(): HTMLElement {
  const node = tabs({
    tabs: TABS.map((id) => ({ id, label: TAB_LABELS[id] })),
    active: activeTab,
    onSelect: (id) => {
      selectTab(id as RunOutputTab);
    },
  });
  node.classList.add('runoutput-tabs');
  tabButtons = Array.from(node.querySelectorAll<HTMLButtonElement>('.ax-tabs__tab'));
  return node;
}

function buildContent(): HTMLElement {
  const node = document.createElement('div');
  node.id = 'runoutput-content';
  node.className = 'runoutput-content';
  return node;
}

/* ------------------------------------------------------------------ *
 * Render the active tab into the content container.
 * ------------------------------------------------------------------ */

function render(): void {
  const container = document.getElementById('runoutput-content');
  if (!container) return;
  container.replaceChildren();

  if (!data) return;

  switch (activeTab) {
    case 'summary':
      container.append(renderSummary(data.tabs.summary, actions));
      break;
    case 'strategy':
      container.append(renderStrategy(data.tabs.strategy));
      break;
    case 'profiler':
      container.append(renderProfiler(data.tabs.profiler, actions));
      break;
    case 'logs':
      container.append(renderLogs(data.tabs.logs, actions));
      break;
    default:
      break;
  }
}

/* ------------------------------------------------------------------ *
 * Host message handler — accepts only studio.init / studio.set for
 * 'runoutput'.
 * ------------------------------------------------------------------ */

function onMessage(raw: unknown): void {
  const message = decodeStudioData(raw) as StudioDataMessage | null;
  if (!message || message.view !== 'runoutput') return;
  const payload = message.data as Partial<RunOutputData> | undefined;
  if (!payload || !payload.tabs) return;
  data = payload as RunOutputData;
  render();
}

/* ------------------------------------------------------------------ *
 * Entry.
 * ------------------------------------------------------------------ */

function main(): void {
  restoreActiveTab();

  const root = document.getElementById('runoutput-root');
  if (!root) return;
  root.replaceChildren();
  root.append(buildHeader(), buildTabs(), buildContent());
  syncTabs();

  studio.onMessage(onMessage);
  render();
  studio.post(encodeStudioReady('runoutput'));
}

main();
