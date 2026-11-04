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
 * Sidebar Alerts studio (`axis.alerts`) — thin shim over the generic studio
 * provider (enhancement plan §5 Phase 2). Commands stay on
 * `registerAlertsView`; this module only owns the webview registration and
 * the add/toggle/remove actions. The first `studio.ready` handshake is
 * answered with `studio.init` carrying the snapshot (the old flow answered
 * `alerts.ready` with a flat `alerts.set`); flashes became `studio.notice`.
 * vscode glue only — the pure logic lives in `alerts-studio-model.ts`,
 * `alerts-messages.ts`, and `alerts-studio.ts`.
 */

import { existsSync } from 'node:fs';
import { ColorThemeKind, type ExtensionContext, Uri, window } from 'vscode';
import {
  addAlert,
  ALERTS_VIEW_ID,
  readAlertsV1,
  registerAlertsView,
  removeAlert,
  sanitizeAlertEntry,
  writeAlertsV1,
  type AlertEntry,
  type WorkspaceStateHelpers,
} from './alerts';
import { ALERTS_REMOVED, ALERTS_TITLE_REQUIRED, buildAlertsSnapshot } from './alerts-studio-model';
import {
  ALERTS_NOTICE_ERROR,
  ALERTS_NOTICE_INFO,
  ALERTS_STUDIO_VIEW,
  alertsAddFromArgs,
  alertsIdFromArgs,
} from './alerts-messages';
import { buildAlertsStudioBody } from './alerts-studio';
import type { StudioRegistration } from './studio-registry';
import {
  registerStudioView,
  type StudioProviderDeps,
  type StudioViewHost,
  type StudioViewProvider,
} from './studio-provider';

export const ALERTS_STUDIO_VIEW_ID = ALERTS_VIEW_ID;

function themeBodyClass(kind: ColorThemeKind): string {
  switch (kind) {
    case ColorThemeKind.Light:
      return 'vscode-light';
    case ColorThemeKind.HighContrast:
      return 'vscode-high-contrast';
    case ColorThemeKind.HighContrastLight:
      return 'vscode-high-contrast-light';
    default:
      return 'vscode-dark';
  }
}

function currentThemeBodyClass(): string {
  try {
    return themeBodyClass(window.activeColorTheme.kind);
  } catch {
    return 'vscode-dark';
  }
}

/** `StudioProviderDeps` assembled from the vscode API, alerts-panel pattern. */
function alertsStudioDeps(context: ExtensionContext): StudioProviderDeps {
  return {
    extensionUri: context.extensionUri,
    joinPath: (base, ...segments) => Uri.joinPath(base as Uri, ...segments),
    fsPath: (uri) => (uri as Uri).fsPath,
    assetExists: (path) => existsSync(path),
    themeBodyClass: currentThemeBodyClass,
  };
}

/** Structural `window.registerWebviewViewProvider` forwarded to the shim. */
function studioViewHost(): StudioViewHost {
  return {
    registerWebviewViewProvider: (viewId, provider, options) =>
      window.registerWebviewViewProvider(viewId, provider, options),
  };
}

/** Flip `enabled` on one stored row. Unknown ids are a no-op. Never throws. */
async function toggleAlertEnabled(state: WorkspaceStateHelpers, id: string): Promise<boolean> {
  try {
    const list = readAlertsV1(state);
    let found = false;
    const next: AlertEntry[] = [];
    for (const entry of list) {
      if (entry.id !== id) {
        next.push(entry);
        continue;
      }
      found = true;
      const flipped = sanitizeAlertEntry({
        id: entry.id,
        title: entry.title,
        condition: entry.condition,
        enabled: !entry.enabled,
      });
      next.push(flipped ?? entry);
    }
    if (!found) return false;
    return writeAlertsV1(state, next);
  } catch {
    return false;
  }
}

/**
 * Sidebar facade for Alerts (`axis.alerts`). Commands stay on
 * `registerAlertsView`; the facade only owns the generic-provider
 * registration and the add/toggle/remove action glue. The shim keeps the
 * historical class shape (`new AlertsStudioWebviewViewProvider(context,
 * state)`) so `registerAlertsStudio` stays unchanged for extension.ts.
 */
export class AlertsStudioWebviewViewProvider {
  private readonly provider: StudioViewProvider | undefined;

  constructor(
    context: ExtensionContext,
    private readonly state: WorkspaceStateHelpers,
  ) {
    const entry: StudioRegistration = {
      id: ALERTS_STUDIO_VIEW,
      title: 'Alerts',
      viewId: ALERTS_STUDIO_VIEW_ID,
      retainContextWhenHidden: true,
      buildBody: buildAlertsStudioBody,
      actions: {
        add: (args) => {
          void this.handleAdd(args);
        },
        toggle: (args) => {
          void this.handleToggle(args);
        },
        remove: (args) => {
          void this.handleRemove(args);
        },
      },
      restore: () => buildAlertsSnapshot(readAlertsV1(this.state)),
    };
    this.provider = registerStudioView(entry, alertsStudioDeps(context), studioViewHost(), context);
  }

  /** The generic provider registered for `axis.alerts` (tests / diagnostics). */
  get studioProvider(): StudioViewProvider | undefined {
    return this.provider;
  }

  /** Push the stored snapshot as `studio.set` (tree refresh / actions). */
  postSnapshot(): void {
    try {
      this.provider?.postStudioSet(buildAlertsSnapshot(readAlertsV1(this.state)));
    } catch {
      // disposing
    }
  }

  private async handleAdd(args: Record<string, unknown> | undefined): Promise<void> {
    try {
      const input = alertsAddFromArgs(args);
      if (!input) return;
      if (!input.title) {
        this.provider?.postStudioNotice(ALERTS_NOTICE_ERROR, ALERTS_TITLE_REQUIRED);
        return;
      }
      const created = await addAlert(
        this.state,
        input.condition ? { title: input.title, condition: input.condition } : { title: input.title },
      );
      if (!created) return;
      this.postSnapshot();
    } catch {
      // never throw into the webview host
    }
  }

  private async handleToggle(args: Record<string, unknown> | undefined): Promise<void> {
    try {
      const id = alertsIdFromArgs(args);
      if (id === null) return;
      await toggleAlertEnabled(this.state, id);
      this.postSnapshot();
    } catch {
      // never throw into the webview host
    }
  }

  private async handleRemove(args: Record<string, unknown> | undefined): Promise<void> {
    try {
      const id = alertsIdFromArgs(args);
      if (id === null) return;
      const ok = await removeAlert(this.state, id);
      this.postSnapshot();
      if (ok) this.provider?.postStudioNotice(ALERTS_NOTICE_INFO, ALERTS_REMOVED);
    } catch {
      // never throw into the webview host
    }
  }
}

/**
 * WebviewView for `axis.alerts` plus the existing add/remove commands.
 * Does not register those commands again and does not create a TreeView.
 */
export function registerAlertsStudio(
  context: ExtensionContext,
): AlertsStudioWebviewViewProvider {
  const registered = registerAlertsView(context, { tree: false });
  const provider = new AlertsStudioWebviewViewProvider(context, registered.state);
  const tree = registered.provider;
  const previous = tree.refresh.bind(tree);
  (tree as { refresh: () => void }).refresh = () => {
    try {
      previous();
    } catch {
      // tree emitter is best-effort
    }
    provider.postSnapshot();
  };
  return provider;
}
