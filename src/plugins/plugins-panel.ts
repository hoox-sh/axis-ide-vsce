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
 * Plugins studio shim (`axis.plugins`) on the generic studio provider
 * (enhancement plan §5 Phase 2). This file keeps the historical export
 * surface (`registerPluginsWebviewView`, `PluginsWebviewViewProvider`,
 * `PLUGINS_WEBVIEW_VIEW_ID`, `readPluginsFlags`) and owns only the
 * vscode-backed behavior; the shell, the `studio.ready` handshake, message
 * routing, and `studio.*` encoding live in `studio-provider.ts` /
 * `studio-router.ts` / `studio-html.ts`, and the pure payload builders,
 * the shell body, and the registration live in `plugins-messages.ts`.
 */

import { existsSync } from 'node:fs';
import {
  ColorThemeKind,
  type ExtensionContext,
  type WebviewView,
  type WebviewViewProvider,
  Uri,
  window,
  workspace,
} from 'vscode';
import { runActivatePluginCommand } from './activate-command';
import { readActivePlugins, type WorkspaceStateHelpers } from './active';
import {
  PLUGINS_STUDIO_VIEW_ID,
  parsePluginsFlags,
  pluginsInitData,
  pluginsStateData,
  pluginsStudioRegistration,
  buildPluginCards,
  type PluginCard,
  type PluginsFlags,
  type PluginsInitData,
} from './plugins-messages';
import type { HostPluginRegistry } from './registry';
import type { StudioRegistration } from '../views/studio-registry';
import {
  registerStudioView,
  StudioViewProvider,
  type StudioProviderDeps,
} from '../views/studio-provider';
import type { PluginKind } from './types';

export const PLUGINS_WEBVIEW_VIEW_ID = PLUGINS_STUDIO_VIEW_ID;

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

function readBoolSetting(section: string, key: string): boolean {
  try {
    return workspace.getConfiguration(section).get(key) === true;
  } catch {
    return false;
  }
}

/** Workspace config flags for the plugins studio (never throws). */
export function readPluginsFlags(): PluginsFlags {
  return parsePluginsFlags({
    allowPyodide: readBoolSetting('axis.engine', 'allowPyodide'),
    liveEnabled: readBoolSetting('axis.live', 'enabled'),
    allowUrlInstall: readBoolSetting('axis.plugins', 'allowUrlInstall'),
  });
}

/** `StudioProviderDeps` assembled from the real vscode surface (no nonce). */
function pluginsStudioDeps(context: ExtensionContext): StudioProviderDeps {
  return {
    extensionUri: context.extensionUri,
    joinPath: (base, ...parts) => Uri.joinPath(base as Uri, ...parts),
    fsPath: (uri) => (uri as Uri).fsPath,
    assetExists: (path) => existsSync(path),
    themeBodyClass: () => currentThemeBodyClass(),
  };
}

/**
 * Sidebar Plugins studio (`axis.plugins`) on the generic provider.
 * The registered `WebviewViewProvider` is the generic `StudioViewProvider`;
 * this class keeps the historical surface (`postState` for command wiring,
 * reveal) and forwards `resolveWebviewView` to the generic provider.
 */
export class PluginsWebviewViewProvider implements WebviewViewProvider {
  private readonly entry: StudioRegistration;
  private readonly deps: StudioProviderDeps;
  private studio: StudioViewProvider | undefined;

  constructor(
    private readonly context: ExtensionContext,
    private readonly registry: HostPluginRegistry,
    private readonly helpers: WorkspaceStateHelpers,
    private readonly refreshTrees?: () => void | Thenable<void>,
  ) {
    this.entry = pluginsStudioRegistration({
      activate: async (kind, id) => {
        await this.activate(kind, id);
      },
      state: () => this.initData(),
    });
    this.deps = pluginsStudioDeps(context);
  }

  /** Wire `axis.plugins` through the generic provider. Idempotent; never throws. */
  register(): this {
    if (this.studio) return this;
    this.studio = registerStudioView(this.entry, this.deps, window, this.context);
    return this;
  }

  resolveWebviewView(webviewView: WebviewView): void {
    this.studio?.resolveWebviewView(webviewView);
  }

  /** Push a fresh `studio.set` (active + flags) to the resolved webview (best-effort). */
  postState(): void {
    this.studio?.postStudioSet(
      pluginsStateData(readActivePlugins(this.helpers), readPluginsFlags()),
    );
  }

  /** Reveal the panel if resolved (best-effort). */
  reveal(): void {
    this.studio?.reveal(true);
  }

  private listCards(flags: PluginsFlags): PluginCard[] {
    let list: unknown = [];
    try {
      list = this.registry.listAll();
    } catch {
      list = [];
    }
    return buildPluginCards(list, flags);
  }

  private initData(): PluginsInitData {
    const flags = readPluginsFlags();
    return pluginsInitData(
      this.listCards(flags),
      readActivePlugins(this.helpers),
      flags,
    );
  }

  private async activate(kind: PluginKind, id: string): Promise<void> {
    // `runActivatePluginCommand` is defensive throughout (parse, write, notify
    // and the refresh callback all swallow their own failures), so no extra
    // guard is needed here — state is posted either way.
    await runActivatePluginCommand(this.helpers, { kind, id }, this.refreshTrees);
    this.postState();
  }
}

export function registerPluginsWebviewView(
  context: ExtensionContext,
  registry: HostPluginRegistry,
  helpers: WorkspaceStateHelpers,
  refreshTrees?: () => void | Thenable<void>,
): PluginsWebviewViewProvider {
  const provider = new PluginsWebviewViewProvider(context, registry, helpers, refreshTrees);
  provider.register();
  return provider;
}
