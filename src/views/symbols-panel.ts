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
 * Bottom-panel Symbols view (`axis.symbols`) — thin shim over the generic
 * studio provider (enhancement plan §5 Phase 2). Inserts at the active text
 * editor cursor; Copy uses the host clipboard; "Inserted" / "Copied" are
 * announced by the webview, not the host. The first `studio.ready`
 * handshake is answered with `studio.init` carrying the catalog (the old
 * panel posted a flat `symbols.set` at resolve time, retried on 0/50/200ms
 * timers — the handshake replaces that race). vscode glue only — the pure
 * logic lives in `symbols-messages.ts` and `symbols-studio.ts`.
 */

import { existsSync } from 'node:fs';
import {
  ColorThemeKind,
  type ExtensionContext,
  type Position,
  type TextEditor,
  Uri,
  env,
  window,
} from 'vscode';
import { SYMBOLS_STUDIO_VIEW, listSymbols, symbolsStudioData, symbolsTextFromArgs } from './symbols-messages';
import { buildSymbolsStudioBody, symbolsInsertPositions, SYMBOLS_STUDIO_VIEW_ID } from './symbols-studio';
import type { StudioRegistration } from './studio-registry';
import {
  registerStudioView,
  type StudioProviderDeps,
  type StudioViewHost,
} from './studio-provider';

export const SYMBOLS_VIEW_ID = SYMBOLS_STUDIO_VIEW_ID;

const NONCE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const NO_EDITOR = 'AXIS: Open an editor to insert a symbol.';
const INSERT_FAILED = 'AXIS: Could not insert the symbol.';
const COPY_FAILED = 'AXIS: Could not copy the symbol.';

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

/** `StudioProviderDeps` assembled from the vscode API, symbols-panel pattern. */
function symbolsStudioDeps(context: ExtensionContext): StudioProviderDeps {
  return {
    extensionUri: context.extensionUri,
    joinPath: (base, ...segments) => Uri.joinPath(base as Uri, ...segments),
    fsPath: (uri) => (uri as Uri).fsPath,
    assetExists: (path) => existsSync(path),
    themeBodyClass: currentThemeBodyClass,
    createNonce,
  };
}

/** Structural `window.registerWebviewViewProvider` forwarded to the shim. */
function studioViewHost(): StudioViewHost {
  return {
    registerWebviewViewProvider: (viewId, provider, options) =>
      window.registerWebviewViewProvider(viewId, provider, options),
  };
}

function warn(message: string): void {
  try {
    void window.showWarningMessage(message);
  } catch {
    // window unavailable
  }
}

async function insertSymbolText(text: string): Promise<void> {
  let editor: TextEditor | undefined;
  try {
    editor = window.activeTextEditor;
  } catch {
    editor = undefined;
  }
  if (!editor) {
    warn(NO_EDITOR);
    return;
  }
  try {
    const positions = symbolsInsertPositions<Position>(editor);
    if (positions.length === 0) {
      warn(INSERT_FAILED);
      return;
    }
    const ok = await editor.edit((builder) => {
      for (const at of positions) builder.insert(at, text);
    });
    if (!ok) warn(INSERT_FAILED);
  } catch {
    warn(INSERT_FAILED);
  }
}

async function copySymbolText(text: string): Promise<void> {
  try {
    await env.clipboard.writeText(text);
  } catch {
    warn(COPY_FAILED);
  }
}

/** Register the Symbols bottom-panel view (`axis.symbols`). */
export function registerSymbolsPanel(context: ExtensionContext): void {
  registerStudioView(
    {
      id: SYMBOLS_STUDIO_VIEW,
      title: 'Symbols',
      viewId: SYMBOLS_VIEW_ID,
      retainContextWhenHidden: false,
      buildBody: buildSymbolsStudioBody,
      actions: {
        copy: (args) => {
          const text = symbolsTextFromArgs(args);
          if (text !== null) void copySymbolText(text);
        },
        insert: (args) => {
          const text = symbolsTextFromArgs(args);
          if (text !== null) void insertSymbolText(text);
        },
      },
      restore: () => symbolsStudioData(listSymbols(), '', ''),
    },
    symbolsStudioDeps(context),
    studioViewHost(),
    context,
  );
}
