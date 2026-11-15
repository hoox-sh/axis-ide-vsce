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

import { describe, expect, test } from 'bun:test';
import type { StatusBarItem, Uri } from 'vscode';
import type { StatusbarHost } from './statusbar';
import {
  AxisStatusbar,
  POPUP_ITEMS,
  STATUSBAR_ALIGNMENT,
  STATUSBAR_ACCESSIBLE_NAME,
  STATUSBAR_COMMAND_POPUP,
  STATUSBAR_PRIORITY,
  STATUSBAR_SETTING,
  STATUSBAR_TITLE,
  STATUSBAR_TOOLTIP,
} from './statusbar';

const fakeUri = {
  scheme: 'file' as const,
  fsPath: '/ext/media/icon.png',
  toString: () => 'file:///ext/media/icon.png',
} as unknown as Uri;

function makeItem() {
  return {
    tooltip: '',
    name: '',
    iconPath: undefined as unknown as Uri,
    command: undefined as unknown as string,
    shown: false,
    hidden: false,
    disposed: false,
    show() {
      this.shown = true;
    },
    hide() {
      this.hidden = true;
    },
    dispose() {
      this.disposed = true;
    },
  } as unknown as StatusBarItem;
}

function makeHost(initialEnabled: boolean | undefined = true) {
  const config = new Map<string, unknown>();
  if (initialEnabled !== undefined) config.set(STATUSBAR_SETTING, initialEnabled);
  const runs: string[] = [];
  const lastPick: {
    value:
      | { items: readonly { label: string; command: string }[]; title: string }
      | undefined;
  } = { value: undefined };
  const pickCell: { value: { label: string; command: string } | undefined } = {
    value: undefined,
  };
  const created: Array<{ alignment: unknown; priority: number }> = [];
  const item = makeItem();
  const host: StatusbarHost = {
    readEnabled: () => config.get(STATUSBAR_SETTING) ?? true,
    writeEnabled: async (enabled: boolean) => {
      config.set(STATUSBAR_SETTING, enabled);
    },
    createItem: (_alignment: unknown, priority: number) => {
      created.push({ alignment: _alignment, priority });
      return item;
    },
    registerCommand: () => ({ dispose: () => undefined }),
    runCommand: async (id: string, ..._args: unknown[]) => {
      runs.push(id);
      return undefined;
    },
    pick: async (_items, options) => {
      lastPick.value = { items: _items, title: options.title };
      return pickCell.value;
    },
  };
  return { host, config, runs, created, lastPick, pickCell, item };
}

describe('AxisStatusbar', () => {
  test('defaults to enabled and shows the HOOX item on activate', () => {
    const { host, created, item } = makeHost(undefined);
    const sb = new AxisStatusbar(host, fakeUri);
    expect(sb.isEnabled()).toBe(true);
    expect(created).toHaveLength(0);
    sb.showIfEnabled();
    expect(created).toHaveLength(1);
    expect(created[0]).toEqual({
      alignment: STATUSBAR_ALIGNMENT,
      priority: STATUSBAR_PRIORITY,
    });
    expect(item.tooltip).toBe(STATUSBAR_TOOLTIP);
    expect(item.name).toBe(STATUSBAR_ACCESSIBLE_NAME);
    expect(item.iconPath).toBeDefined();
    expect(item.command).toBe(STATUSBAR_COMMAND_POPUP);
    expect(item.shown).toBe(true);
    expect(item.hidden).toBe(false);
  });

  test('setStatusbarEnabled(false) hides the item; dispose() owns disposal', async () => {
    const { host, config, item } = makeHost();
    const sb = new AxisStatusbar(host, fakeUri);
    sb.showIfEnabled();
    await sb.setStatusbarEnabled(false);
    expect(sb.isEnabled()).toBe(false);
    expect(config.get(STATUSBAR_SETTING)).toBe(false);
    expect(item.hidden).toBe(true);
    expect(item.disposed).toBe(false);
    // hideItem() no longer disposes; only dispose() does.
    sb.dispose();
    expect(item.disposed).toBe(true);
  });

  test('setStatusbarEnabled(true) re-creates and shows the item', async () => {
    const { host, config, item } = makeHost();
    const sb = new AxisStatusbar(host, fakeUri);
    sb.showIfEnabled();
    await sb.setStatusbarEnabled(false);
    await sb.setStatusbarEnabled(true);
    expect(sb.isEnabled()).toBe(true);
    expect(config.get(STATUSBAR_SETTING)).toBe(true);
    expect(item.shown).toBe(true);
    expect(item.disposed).toBe(false);
  });

  test('toggle flips enabled and persists', async () => {
    const { host, config, item } = makeHost();
    const sb = new AxisStatusbar(host, fakeUri);
    sb.showIfEnabled(); // activate path: item exists before toggling
    await sb.toggle();
    expect(sb.isEnabled()).toBe(false);
    expect(config.get(STATUSBAR_SETTING)).toBe(false);
    expect(item.hidden).toBe(true);
    await sb.toggle();
    expect(sb.isEnabled()).toBe(true);
    expect(config.get(STATUSBAR_SETTING)).toBe(true);
    expect(item.shown).toBe(true);
  });

  test('showPopup opens a QuickPick titled AXIS IDE with POPUP_ITEMS', async () => {
    const { host, runs, lastPick, pickCell } = makeHost();
    pickCell.value = { label: 'Run Script', command: 'axis.runScript' };
    const sb = new AxisStatusbar(host, fakeUri);
    await sb.showPopup();
    expect(lastPick.value?.title).toBe(STATUSBAR_TITLE);
    expect(lastPick.value?.items).toEqual(POPUP_ITEMS);
    expect(runs).toEqual(['axis.runScript']);
  });

  test('showPopup with no pick runs nothing', async () => {
    const { host, runs } = makeHost();
    const sb = new AxisStatusbar(host, fakeUri);
    await sb.showPopup();
    expect(runs).toHaveLength(0);
  });

  test('dispose gates later changes', async () => {
    const { host, item } = makeHost();
    const sb = new AxisStatusbar(host, fakeUri);
    sb.showIfEnabled();
    sb.dispose();
    await sb.setStatusbarEnabled(false);
    expect(item.disposed).toBe(true);
    expect(item.hidden).toBe(true);
  });

  test('POPUP_ITEMS map labels to existing AXIS command ids', () => {
    expect(POPUP_ITEMS).toEqual([
      { label: 'Run Script', command: 'axis.runScript' },
      { label: 'Stop Run', command: 'axis.stopRun' },
      { label: 'Open Chart', command: 'axis.openChart' },
      { label: 'Pick Data', command: 'axis.pickData' },
      { label: 'Show Run Output', command: 'axis.showRunOutput' },
      { label: 'Set Pro API Key', command: 'axis.secrets.setProKey' },
      { label: 'Set Worker Key (CF)', command: 'axis.secrets.setWorkerKey' },
      { label: 'Clear Stored Secrets', command: 'axis.secrets.clear' },
      { label: 'Start Bar Debug', command: 'axis.debug.start' },
      { label: 'Step Bar', command: 'axis.debug.stepBar' },
      { label: 'Toggle Bar Breakpoint', command: 'axis.debug.toggleBarBreakpoint' },
      { label: 'Open Walkthrough Example', command: 'axis.openWalkthroughFixture' },
      { label: 'Last Run Profile', command: 'axis.profiler.show' },
    ]);
    for (const item of POPUP_ITEMS) {
      expect(typeof item.command).toBe('string');
      expect(item.command.length).toBeGreaterThan(0);
    }
  });
});
