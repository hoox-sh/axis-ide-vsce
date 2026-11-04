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
 * Sidebar WebviewView for the builtin Library studio (`axis.library`) — a
 * thin shim on the generic studio provider (enhancement plan §5 Phase 2).
 *
 * Wire change (old flat → `studio.*`): `library.ready` → `studio.ready` (the
 * provider acks with `studio.init` carrying `{ cards, catalogError }`);
 * `library.apply` / `library.copy` → `studio.action` with `{ id }` in `args`.
 * Cards still never include Pine source.
 */

import { existsSync } from 'node:fs';
import { ColorThemeKind, Uri, window, type ExtensionContext, commands, env, workspace } from 'vscode';
import {
  APPLY_BUILTIN_COMMAND,
  APPLY_BUILTIN_LOAD_FAILED_PREFIX,
  runApplyBuiltin,
} from '../host/apply-builtin';
import {
  type BuiltinCatalogEntry,
  getBuiltinById,
  loadBuiltinCatalog,
} from '../host/builtins';
import { LIBRARY_VIEW_ID } from './library';
import {
  LIBRARY_STUDIO_VIEW,
  buildLibraryBody,
  parseLibraryActionArgs,
  toLibraryStudioData,
} from './library-messages';
import { registerStudioView, StudioViewProvider, type StudioProviderDeps } from './studio-provider';
import type { StudioRegistration } from './studio-registry';

const NONCE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function createNonce(): string {
  let text = '';
  for (let i = 0; i < 32; i += 1) {
    text += NONCE_ALPHABET.charAt(Math.floor(Math.random() * NONCE_ALPHABET.length));
  }
  return text;
}

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

/** Assemble the injected VS Code surface the generic provider needs. */
function studioDeps(context: ExtensionContext): StudioProviderDeps {
  return {
    extensionUri: context.extensionUri,
    joinPath: (base, ...parts) => Uri.joinPath(base as Uri, ...parts),
    fsPath: (uri) => (uri as Uri).fsPath,
    assetExists: (path) => existsSync(path),
    themeBodyClass: () => currentThemeBodyClass(),
    createNonce,
  };
}

/**
 * Sidebar WebviewView host for the builtin Library studio (`axis.library`)
 * on the generic provider. Posts `studio.init` (cards only — no Pine
 * source) in the `studio.ready` handshake.
 */
export class LibraryWebviewViewProvider {
  private provider: StudioViewProvider | undefined;
  private scripts: BuiltinCatalogEntry[] = [];
  private catalogError = '';

  constructor(private readonly context: ExtensionContext) {
    this.provider = registerStudioView(
      this.registration(),
      studioDeps(context),
      window,
      context,
    );
  }

  private registration(): StudioRegistration {
    return {
      id: LIBRARY_STUDIO_VIEW,
      title: 'Library',
      viewId: LIBRARY_VIEW_ID,
      retainContextWhenHidden: true,
      buildBody: buildLibraryBody,
      actions: {
        apply: (args) => this.applyFromArgs(args),
        copy: (args) => this.copyFromArgs(args),
      },
      restore: () => {
        this.loadCatalog();
        return toLibraryStudioData(this.scripts, this.catalogError);
      },
    };
  }

  private loadCatalog(): void {
    try {
      const loaded = loadBuiltinCatalog(this.context.extensionPath);
      if (!loaded.ok) {
        this.scripts = [];
        this.catalogError = loaded.error;
        return;
      }
      this.scripts = [...loaded.catalog.scripts];
      this.catalogError = '';
    } catch (e) {
      this.scripts = [];
      this.catalogError = e instanceof Error ? e.message : String(e);
    }
  }

  /** Apply one catalog id without the QuickPick. `runApplyBuiltin` always prompts, so the UI auto-accepts this id. */
  private async applyId(id: string): Promise<void> {
    let loaded: ReturnType<typeof loadBuiltinCatalog>;
    try {
      loaded = loadBuiltinCatalog(this.context.extensionPath);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      void window.showErrorMessage(`${APPLY_BUILTIN_LOAD_FAILED_PREFIX} ${message}`);
      return;
    }
    if (!loaded.ok) {
      void window.showErrorMessage(`${APPLY_BUILTIN_LOAD_FAILED_PREFIX} ${loaded.error}`);
      return;
    }
    const entry = getBuiltinById(loaded.catalog.scripts, id);
    if (!entry) {
      void window.showInformationMessage(
        `AXIS: "${id}" is not in the offline catalog. Opening the builtin picker.`,
      );
      try {
        await commands.executeCommand(APPLY_BUILTIN_COMMAND);
      } catch {
        // command unwired
      }
      return;
    }
    try {
      const result = await runApplyBuiltin({
        scripts: [entry],
        ui: {
          async showQuickPick(items, _options) {
            return items.find((item) => item.builtin.id === entry.id) ?? items[0];
          },
          async openUntitledPine(code, languageId) {
            const doc = await workspace.openTextDocument({
              content: code,
              language: languageId,
            });
            await window.showTextDocument(doc);
          },
          showErrorMessage(message) {
            void window.showErrorMessage(message);
          },
        },
      });
      if (result.status === 'applied') {
        const title = result.builtin?.title || entry.title;
        void window.showInformationMessage(`AXIS: Applied builtin "${title}".`);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      void window.showErrorMessage(`AXIS: Apply builtin failed: ${message}`);
      void window.showInformationMessage(`AXIS: Could not apply "${entry.title}" directly.`);
      try {
        await commands.executeCommand(APPLY_BUILTIN_COMMAND);
      } catch {
        // command unwired
      }
    }
  }

  private applyFromArgs(args: unknown): void {
    const id = parseLibraryActionArgs(args);
    if (!id) return;
    void this.applyId(id);
  }

  private copyFromArgs(args: unknown): void {
    const id = parseLibraryActionArgs(args);
    if (!id) return;
    // clipboard optional — the webview already flashed "Copied"
    void (async () => {
      try {
        await env.clipboard.writeText(id);
      } catch {
        // ignore
      }
    })();
  }
}

/** Register the Library studio on view id `axis.library` (replaces the tree view). */
export function registerLibraryStudio(context: ExtensionContext): void {
  new LibraryWebviewViewProvider(context);
}
