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
 * Scripts studio shim (`axis.indicators`) on the generic studio provider
 * (enhancement plan §5 Phase 2). This file keeps the historical export
 * surface (`registerScriptsStudio`, `ScriptsStudioProvider`, …) and owns
 * only the vscode-backed behavior; the shell, the `studio.ready` handshake,
 * message routing, and `studio.*` encoding live in `studio-provider.ts` /
 * `studio-router.ts` / `studio-html.ts`, and the pure payload builders,
 * the shell body, and the registration live in `scripts-messages.ts`.
 *
 * Last run: `ResultsFocusStore.subscribe` exists (`src/run/results-store.ts`).
 * Pass the store as the optional focus argument — this panel subscribes and
 * does not poll. `pushScriptsRunCard` / `notifyScriptsStudio` remain for a
 * host that has not passed the store.
 *
 * Apply uses `runApplyBuiltin` with a one-row catalog so the posted id is
 * opened as untitled pinescript. `axis.applyBuiltin` itself is a QuickPick
 * and cannot target an id; this panel does not call that command.
 */

import { existsSync } from 'node:fs';
import {
  ColorThemeKind,
  type ExtensionContext,
  type WebviewView,
  type WebviewViewProvider,
  Uri,
  commands,
  window,
  workspace,
} from 'vscode';
import {
  APPLY_BUILTIN_LOAD_FAILED_PREFIX,
  type ApplyBuiltinUi,
  runApplyBuiltin,
} from '../host/apply-builtin';
import { getBuiltinById, loadBuiltinCatalog } from '../host/builtins';
import { PINE_LANGUAGE_ID } from '../host/open-chart';
import {
  SCRIPTS_OPEN_CHART_COMMAND,
  SCRIPTS_RUN_COMMAND,
  SCRIPTS_STUDIO_VIEW_ID,
  buildScriptsSnapshot,
  scriptsNoticeMessage,
  scriptsStudioData,
  scriptsStudioRegistration,
  type ScriptSuggestion,
} from './scripts-messages';
import type { StudioRegistration } from './studio-registry';
import {
  registerStudioView,
  StudioViewProvider,
  type StudioProviderDeps,
} from './studio-provider';

export const SCRIPTS_VIEW_ID = SCRIPTS_STUDIO_VIEW_ID;

/**
 * Structural lookalike of `ResultsFocusStore`.
 * Real store: `subscribe(listener)`, `getLastRun()`, snapshot `{ lastRun }`.
 */
export type ResultsFocusLike = {
  subscribe?: (
    listener: (snapshot: unknown, reason?: unknown) => void,
  ) => () => void;
  getLastRun?: () => unknown;
};

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

/** `StudioProviderDeps` assembled from the real vscode surface (no nonce). */
function scriptsStudioDeps(context: ExtensionContext): StudioProviderDeps {
  return {
    extensionUri: context.extensionUri,
    joinPath: (base, ...parts) => Uri.joinPath(base as Uri, ...parts),
    fsPath: (uri) => (uri as Uri).fsPath,
    assetExists: (path) => existsSync(path),
    themeBodyClass: () => currentThemeBodyClass(),
  };
}

function loadSuggestions(extensionPath: string): ScriptSuggestion[] {
  try {
    const loaded = loadBuiltinCatalog(extensionPath);
    if (!loaded.ok) return [];
    return buildScriptsSnapshot({ suggestions: loaded.catalog.scripts }).suggestions;
  } catch {
    return [];
  }
}

async function executeNamed(command: string): Promise<boolean> {
  try {
    await commands.executeCommand(command);
    return true;
  } catch {
    return false;
  }
}

/** Apply one builtin id via `runApplyBuiltin` (source stays in the host). */
async function applyBuiltinById(extensionPath: string, id: string): Promise<boolean> {
  try {
    const loaded = loadBuiltinCatalog(extensionPath);
    if (!loaded.ok) {
      void window.showErrorMessage(`${APPLY_BUILTIN_LOAD_FAILED_PREFIX}${loaded.error}`);
      return false;
    }
    const entry = getBuiltinById(loaded.catalog.scripts, id);
    if (!entry) {
      void window.showErrorMessage(`AXIS: Builtin not found: ${id}`);
      return false;
    }
    const ui: ApplyBuiltinUi = {
      async showQuickPick(items) {
        return items.find((item) => item.builtin.id === id) ?? items[0];
      },
      async openUntitledPine(code, languageId) {
        const doc = await workspace.openTextDocument({
          content: code,
          language: languageId,
        });
        await window.showTextDocument(doc, { preview: false });
      },
      showErrorMessage(message) {
        void window.showErrorMessage(message);
      },
    };
    const result = await runApplyBuiltin({
      scripts: [entry],
      ui,
      languageId: PINE_LANGUAGE_ID,
    });
    return result.status === 'applied';
  } catch {
    return false;
  }
}

/**
 * Sidebar Scripts studio (`axis.indicators`) on the generic provider.
 * Suggestions are titles only — Pine `code` is never posted. The registered
 * `WebviewViewProvider` is the generic `StudioViewProvider`; this class
 * keeps the historical surface (focus subscription, last-run pushes,
 * reveal/dispose) and forwards `resolveWebviewView` to the generic provider.
 */
export class ScriptsStudioProvider implements WebviewViewProvider {
  private readonly entry: StudioRegistration;
  private readonly deps: StudioProviderDeps;
  private studio: StudioViewProvider | undefined;
  private detachFocus: (() => void) | undefined;
  private lastRunRaw: unknown = null;
  private readonly suggestions: ScriptSuggestion[];

  constructor(
    private readonly context: ExtensionContext,
    focus?: ResultsFocusLike,
  ) {
    this.suggestions = loadSuggestions(context.extensionPath);
    this.entry = scriptsStudioRegistration({
      run: () => {
        void this.run().catch(() => {
          // hostile command host — never throw into the router
        });
      },
      openChart: () => {
        void this.openChart().catch(() => {
          // hostile command host — never throw into the router
        });
      },
      apply: (id) => {
        void this.applyBuiltin(id).catch(() => {
          // hostile editor host — never throw into the router
        });
      },
      snapshot: () => scriptsStudioData(this.lastRunRaw, this.suggestions),
    });
    this.deps = scriptsStudioDeps(context);
    this.attachFocus(focus);
  }

  /** Wire `axis.indicators` through the generic provider. Idempotent; never throws. */
  register(): this {
    if (this.studio) return this;
    this.studio = registerStudioView(this.entry, this.deps, window, this.context);
    try {
      this.context.subscriptions.push({ dispose: () => this.dispose() });
    } catch {
      // subscriptions missing (test hosts)
    }
    return this;
  }

  resolveWebviewView(webviewView: WebviewView): void {
    this.studio?.resolveWebviewView(webviewView);
  }

  /** Replace the last-run record (manual push or store snapshot). */
  applyLastRun(summary: unknown): void {
    this.lastRunRaw = summary ?? null;
    this.pushSet();
  }

  reveal(): void {
    this.studio?.reveal(true);
  }

  dispose(): void {
    try {
      this.detachFocus?.();
    } catch {
      // ignore
    }
    this.detachFocus = undefined;
    this.studio?.dispose();
    this.studio = undefined;
  }

  private attachFocus(focus: ResultsFocusLike | undefined): void {
    if (!focus) return;
    try {
      const initial = focus.getLastRun?.();
      if (initial != null) this.lastRunRaw = initial;
    } catch {
      // hostile store
    }
    if (typeof focus.subscribe !== 'function') return;
    try {
      this.detachFocus = focus.subscribe((snapshot) => {
        this.lastRunRaw = snapshot ?? null;
        this.pushSet();
      });
    } catch {
      this.detachFocus = undefined;
    }
  }

  private pushSet(): void {
    this.studio?.postStudioSet(scriptsStudioData(this.lastRunRaw, this.suggestions));
  }

  private pushNotice(text: string): void {
    this.studio?.postStudioNotice('info', scriptsNoticeMessage(text));
  }

  private async run(): Promise<void> {
    if (await executeNamed(SCRIPTS_RUN_COMMAND)) this.pushNotice('Run started');
  }

  private async openChart(): Promise<void> {
    await executeNamed(SCRIPTS_OPEN_CHART_COMMAND);
  }

  private async applyBuiltin(id: string): Promise<void> {
    if (await applyBuiltinById(this.context.extensionPath, id)) this.pushNotice('Applied');
  }
}

let studio: ScriptsStudioProvider | undefined;

/**
 * Register the Scripts WebviewView (`axis.indicators`).
 * Optional `focus` is a `ResultsFocusStore` (subscribe + getLastRun).
 */
export function registerScriptsStudio(
  context: ExtensionContext,
  focus?: ResultsFocusLike,
): ScriptsStudioProvider {
  const provider = new ScriptsStudioProvider(context, focus);
  provider.register();
  studio = provider;
  return provider;
}

/** Push a last-run summary when activate did not pass the results store. */
export function pushScriptsRunCard(summary: unknown): void {
  try {
    studio?.applyLastRun(summary);
  } catch {
    // ignore
  }
}

/** Alias of {@link pushScriptsRunCard} for wiring notes. */
export function notifyScriptsStudio(summary: unknown): void {
  pushScriptsRunCard(summary);
}
