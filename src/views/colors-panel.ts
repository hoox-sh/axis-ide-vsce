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
 * Bottom-panel Colors view (`axis.colors`) — thin shim over the generic
 * studio provider (enhancement plan §5 Phase 2). The registration carries
 * the colors body markup and the reveal/copy/refresh actions; the first
 * `studio.ready` handshake is answered with `studio.init` carrying the
 * `restore()` scan, and editor events push fresh scans as `studio.set`.
 * vscode glue only — the pure logic lives in `colors-messages.ts` and
 * `colors-studio.ts`.
 */

import { existsSync } from 'node:fs';
import {
  ColorThemeKind,
  Range,
  Selection,
  TextEditorRevealType,
  Uri,
  env,
  window,
  workspace,
  type ExtensionContext,
  type TextDocument,
} from 'vscode';
import {
  COLORS_STUDIO_VIEW,
  colorsCopyTextFromArgs,
  colorsRevealLineFromArgs,
  isPineEditorLanguage,
} from './colors-messages';
import {
  buildColorsStudioBody,
  colorsDataFromEditor,
  colorsDocumentTriggersRefresh,
  colorsRevealIndex,
  COLORS_STUDIO_VIEW_ID,
} from './colors-studio';
import type { StudioRegistration } from './studio-registry';
import {
  registerStudioView,
  type StudioProviderDeps,
  type StudioViewHost,
  type StudioViewProvider,
} from './studio-provider';

export const COLORS_VIEW_ID = COLORS_STUDIO_VIEW_ID;

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

/** `StudioProviderDeps` assembled from the vscode API, colors-panel pattern. */
function colorsStudioDeps(context: ExtensionContext): StudioProviderDeps {
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

function revealLine(line: number): void {
  const editor = window.activeTextEditor;
  if (!editor || !isPineEditorLanguage(editor.document.languageId)) return;
  const index = colorsRevealIndex(line, editor.document.lineCount);
  const textLine = editor.document.lineAt(index);
  const range = new Range(textLine.range.start, textLine.range.end);
  editor.selection = new Selection(range.start, range.end);
  editor.revealRange(range, TextEditorRevealType.InCenter);
}

async function copyText(text: string): Promise<void> {
  try {
    await env.clipboard.writeText(text);
  } catch {
    try {
      void window.showWarningMessage('AXIS: Could not copy the color.');
    } catch {
      // window unavailable
    }
  }
}

/**
 * Bottom-panel Colors view (`axis.colors`). Facade over the generic
 * `StudioViewProvider` created by `registerStudioView`; the shim keeps the
 * historical class shape (`new ColorsPanelProvider(context)`) so the
 * registration and editor-event wiring stay unchanged for extension.ts.
 */
export class ColorsPanelProvider {
  private readonly provider: StudioViewProvider | undefined;

  constructor(context: ExtensionContext) {
    const entry: StudioRegistration = {
      id: COLORS_STUDIO_VIEW,
      title: 'Colors',
      viewId: COLORS_STUDIO_VIEW_ID,
      retainContextWhenHidden: false,
      buildBody: buildColorsStudioBody,
      actions: {
        copy: (args) => {
          const text = colorsCopyTextFromArgs(args);
          if (text !== null) void copyText(text);
        },
        reveal: (args) => {
          const line = colorsRevealLineFromArgs(args);
          if (line !== null) revealLine(line);
        },
        refresh: () => this.refresh(),
      },
      restore: () => colorsDataFromEditor(window.activeTextEditor),
    };
    this.provider = registerStudioView(entry, colorsStudioDeps(context), studioViewHost(), context);
  }

  /** The generic provider registered for `axis.colors` (tests / diagnostics). */
  get studioProvider(): StudioViewProvider | undefined {
    return this.provider;
  }

  /** Rescan the active Pine editor, or clear the list when it is not Pine. */
  refresh(): void {
    try {
      this.provider?.postStudioSet(colorsDataFromEditor(window.activeTextEditor));
    } catch {
      // disposing or unreadable document
    }
  }

  /** Document edits refresh only the active Pine editor. */
  refreshIfDocument(document: TextDocument): void {
    try {
      if (colorsDocumentTriggersRefresh(window.activeTextEditor, document)) {
        this.refresh();
      }
    } catch {
      // editor host unavailable
    }
  }
}

/** Register `axis.colors` in the panel container. `retainContextWhenHidden` is false. */
export function registerColorsPanel(context: ExtensionContext): ColorsPanelProvider {
  const panel = new ColorsPanelProvider(context);
  if (panel.studioProvider) {
    try {
      context.subscriptions.push(
        window.onDidChangeActiveTextEditor(() => {
          panel.refresh();
        }),
        workspace.onDidChangeTextDocument((event) => {
          panel.refreshIfDocument(event.document);
        }),
      );
    } catch {
      // editor host unavailable
    }
  }
  return panel;
}
