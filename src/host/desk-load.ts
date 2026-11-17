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
 * Pick the open chart tab and fold it into the desk session.
 * No VS Code imports. The extension maps editor tabs onto these shapes.
 */

import {
  type DeskChartState,
  type DeskSession,
  deskFromChartDoc,
  emptyDeskChart,
} from './desk';

export type DeskTabInput<T> =
  | { kind: 'custom'; viewType: string; uri: T }
  | { kind: 'text'; fsPath: string; uri: T }
  | { kind: 'other' };

export type DeskTabGroup<T> = {
  tabs: readonly DeskTabInput<T>[];
  /** Index into `tabs` of the group's active tab, when it has one. */
  activeIndex?: number;
};

export type ParsedDeskChart =
  | {
      ok: true;
      doc: {
        symbol?: unknown;
        interval?: unknown;
        exchange?: unknown;
        barsPath?: unknown;
      };
    }
  | { ok: false };

/**
 * First chart custom-editor tab, else the first `*.axis.json` text tab.
 * Groups are already ordered with the active group first. Within a group the
 * active tab is checked before the others.
 */
export function findChartUri<T>(
  groups: readonly DeskTabGroup<T>[],
  chartViewType: string,
): T | undefined {
  for (const group of groups) {
    const tabs = group.tabs;
    const active = group.activeIndex === undefined ? undefined : tabs[group.activeIndex];
    const ordered = active ? [active, ...tabs] : tabs;
    for (const tab of ordered) {
      if (tab.kind === 'other') continue;
      if (tab.kind === 'custom' && tab.viewType === chartViewType) return tab.uri;
      if (tab.kind === 'text' && tab.fsPath.toLowerCase().endsWith('.axis.json')) {
        return tab.uri;
      }
    }
  }
  return undefined;
}

/** Chart fields for the desk. A missing or unreadable document still counts as open. */
export async function loadDeskChartState<T>(opts: {
  scriptName: string;
  engineLabel: string;
  useMockBars: boolean;
  datafeedSource?: 'sidecar' | 'venue';
  uri: T | undefined;
  readText: (uri: T) => Promise<string | undefined>;
  parse: (text: string) => ParsedDeskChart;
}): Promise<DeskChartState> {
  const { scriptName, engineLabel, useMockBars } = opts;
  const datafeedSource = opts.datafeedSource === 'venue' ? 'venue' : 'sidecar';
  if (opts.uri === undefined) {
    return { ...emptyDeskChart(), scriptName, engineLabel, useMockBars, datafeedSource };
  }
  const text = await opts.readText(opts.uri);
  const parsed = text === undefined ? undefined : opts.parse(text);
  if (!parsed?.ok) {
    return {
      ...emptyDeskChart(),
      scriptName,
      engineLabel,
      chartOpen: true,
      useMockBars,
      datafeedSource,
    };
  }
  return deskFromChartDoc(parsed.doc, {
    useMockBars,
    chartOpen: true,
    scriptName,
    engineLabel,
    datafeedSource,
  });
}

/**
 * Load the chart and publish it. A later call (higher generation), a shutdown,
 * or a replaced session drops a stale result.
 */
export async function refreshDeskSnapshot(state: {
  getSession: () => DeskSession | undefined;
  deactivated: () => boolean;
  bump: () => number;
  current: () => number;
  scriptName: () => string;
  load: (scriptName: string) => Promise<DeskChartState>;
  engineLabel: () => string;
}): Promise<void> {
  const session = state.getSession();
  if (!session || state.deactivated()) return;
  const gen = state.bump();
  const scriptName = state.scriptName();
  let chart: DeskChartState;
  try {
    chart = await state.load(scriptName);
  } catch {
    chart = {
      ...emptyDeskChart(),
      scriptName,
      engineLabel: state.engineLabel(),
    };
  }
  if (gen !== state.current() || state.deactivated() || state.getSession() !== session) return;
  session.setChart(chart);
}
