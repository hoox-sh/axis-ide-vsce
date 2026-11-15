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
 * AXIS IDE statusbar item (HOOX logo) with a click popup.
 *
 * Side-effect-free until `activateStatusbar` is invoked from `extension.ts`.
 * The whole VS Code surface is injected through `StatusbarHost`, so this
 * module stays unit-testable without the extension host. The popup only
 * launches existing `axis.*` commands — it never displays key material.
 */

import type { Disposable, StatusBarItem, Uri } from 'vscode';

export const STATUSBAR_SECTION = 'axis';
export const STATUSBAR_SETTING = 'axis.statusbar.enabled';

export const STATUSBAR_COMMAND_TOGGLE = 'axis.statusbar.toggle';
export const STATUSBAR_COMMAND_POPUP = 'axis.statusbar.showPopup';

export const STATUSBAR_TITLE = 'AXIS IDE';
export const STATUSBAR_TOOLTIP = 'AXIS IDE — HOOX';
export const STATUSBAR_ACCESSIBLE_NAME = 'AXIS IDE statusbar';

/** StatusBarAlignment.Right (the host passes the real vscode enum). */
export const STATUSBAR_ALIGNMENT = 1;
export const STATUSBAR_PRIORITY = 100;

export const POPUP_ITEMS = [
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
] as const satisfies readonly {
  readonly label: string;
  readonly command: string;
}[];

export interface StatusbarHost {
  readEnabled(): boolean;
  writeEnabled(enabled: boolean): Promise<void> | void;
  createItem(alignment: unknown, priority: number): StatusBarItem;
  registerCommand(id: string, fn: () => unknown): Disposable;
  runCommand(id: string, ...args: unknown[]): Promise<unknown>;
  pick(
    items: readonly { label: string; command: string }[],
    options: { title: string },
  ): Promise<{ label: string; command: string } | undefined>;
}

/**
 * Common enable/disable function. Shows/hides the statusbar item and
 * persists `axis.statusbar.enabled`. Safe to call after `dispose` (no-op).
 */
export class AxisStatusbar {
  private item: StatusBarItem | undefined;
  private disposed = false;
  private enabled = false;

  constructor(
    private readonly host: StatusbarHost,
    private readonly iconPath: Uri,
  ) {
    this.enabled = host.readEnabled();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async setStatusbarEnabled(enabled: boolean): Promise<void> {
    if (this.disposed) return;
    this.enabled = enabled;
    try {
      await this.host.writeEnabled(enabled);
    } catch {
      // Persist failure: UI still reflects intended state; config and UI may diverge until next write succeeds.
    }
    if (enabled) this.showItem();
    else this.hideItem();
  }

  /** Restore visibility from the last known state without touching config (activate). */
  showIfEnabled(): void {
    if (this.disposed) return;
    if (this.enabled) this.showItem();
    else this.hideItem();
  }

  async toggle(): Promise<void> {
    await this.setStatusbarEnabled(!this.enabled);
  }

  async showPopup(): Promise<void> {
    if (this.disposed) return;
    const pick = await this.host.pick(POPUP_ITEMS, { title: STATUSBAR_TITLE });
    if (!pick?.command) return;
    await this.host.runCommand(pick.command);
  }

  private showItem(): void {
    if (this.item) {
      this.item.show();
      return;
    }
    const item = this.host.createItem(STATUSBAR_ALIGNMENT, STATUSBAR_PRIORITY);
    item.tooltip = STATUSBAR_TOOLTIP;
    item.name = STATUSBAR_ACCESSIBLE_NAME;
    // `StatusBarItem.iconPath` (HOOX logo) is supported by the VS Code engine
    // for ^1.95 but missing from the bundled @types/vscode — set via cast.
    (item as { iconPath?: Uri }).iconPath = this.iconPath;
    item.command = STATUSBAR_COMMAND_POPUP;
    item.show();
    this.item = item;
  }

  private hideItem(): void {
    this.item?.hide();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const item = this.item;
    this.item = undefined;
    item?.hide();
    item?.dispose();
  }
}
