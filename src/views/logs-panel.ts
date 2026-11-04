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
 * Panel WebviewView for script logs (`axis.logs`) — a thin shim on the
 * generic studio provider (enhancement plan §5 Phase 2). Subscribes to
 * ResultsFocusStore the same way as `attachProfiler`.
 *
 * Wire change (old flat → `studio.*`): `logs.ready` → `studio.ready` (the
 * provider acks with `studio.init` carrying `{ rows, runId, status }` — the
 * old resolve-time / ready-time `logs.set` payload verbatim);
 * `logs.reveal` → `studio.action` with `{ line }` in `args`;
 * `logs.copy` → `studio.action` with `{ text }` in `args`;
 * `logs.filter` stays local (the old host ignored it).
 *
 * Visibility: with `retainContextWhenHidden: false` VS Code re-resolves the
 * view when it becomes visible again, and the fresh `studio.ready`
 * handshake delivers the current record — the old panel's extra
 * `onDidChangeVisibility` repost is covered by that path.
 */

import { existsSync } from 'node:fs';
import {
  ColorThemeKind,
  type ExtensionContext,
  Position,
  Range,
  Selection,
  TextEditorRevealType,
  Uri,
  env,
  window,
} from 'vscode';
import {
  LOGS_STUDIO_VIEW,
  attachLogsStore,
  buildLogsBody,
  logsStudioData,
  parseLogsCopyArgs,
  parseLogsRevealArgs,
} from './logs-messages';
import { registerStudioView, StudioViewProvider, type StudioProviderDeps } from './studio-provider';
import type { StudioRegistration } from './studio-registry';

export const LOGS_VIEW_ID = 'axis.logs';

/** PYNE contributes `pinescript`. `pine` / `pyne` are accepted aliases. */
const PINE_LANGUAGE_IDS = new Set(['pinescript', 'pine', 'pyne']);

const NO_EDITOR = 'No active Pine script editor to reveal that line.';
const COPY_FAILED = 'AXIS: Could not copy the log text.';

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
  };
}

function revealLogLine(line: number): void {
  try {
    if (!Number.isInteger(line) || line < 1) return;
    const editor = window.activeTextEditor;
    const lang = editor?.document.languageId ?? '';
    if (!editor || !PINE_LANGUAGE_IDS.has(lang) || editor.document.lineCount < 1) {
      void window.showInformationMessage(NO_EDITOR);
      return;
    }
    const index = Math.min(line, editor.document.lineCount) - 1;
    const pos = new Position(index, 0);
    editor.selection = new Selection(pos, pos);
    editor.revealRange(new Range(pos, pos), TextEditorRevealType.InCenter);
  } catch {
    try {
      void window.showInformationMessage(NO_EDITOR);
    } catch {
      // host unavailable
    }
  }
}

async function copyLogText(text: string): Promise<void> {
  try {
    await env.clipboard.writeText(text);
  } catch {
    try {
      void window.showWarningMessage(COPY_FAILED);
    } catch {
      // host unavailable
    }
  }
}

/**
 * Panel WebviewView host for script logs (`axis.logs`) on the generic
 * provider. The results-store subscription re-posts `studio.set` whenever
 * the last-run record changes; the `studio.ready` handshake carries the
 * current record as `studio.init` data.
 */
export class LogsWebviewViewProvider {
  private provider: StudioViewProvider | undefined;
  private record: unknown = null;
  private readonly detachResults: () => void;

  constructor(
    context: ExtensionContext,
    resultsStore: unknown,
  ) {
    this.detachResults = attachLogsStore(resultsStore, (record) => {
      this.record = record;
      this.post();
    });
    this.provider = registerStudioView(
      this.registration(),
      studioDeps(context),
      window,
      context,
    );
  }

  /** Test / host helper — drop the results subscription. */
  dispose(): void {
    try {
      this.detachResults();
    } catch {
      // ignore
    }
  }

  private registration(): StudioRegistration {
    return {
      id: LOGS_STUDIO_VIEW,
      title: 'Logs',
      viewId: LOGS_VIEW_ID,
      retainContextWhenHidden: false,
      buildBody: buildLogsBody,
      actions: {
        reveal: (args) => {
          const line = parseLogsRevealArgs(args);
          if (line == null) return;
          revealLogLine(line);
        },
        copy: (args) => {
          const text = parseLogsCopyArgs(args);
          if (text == null) return;
          void copyLogText(text);
        },
      },
      restore: () => logsStudioData(this.record),
    };
  }

  private post(): void {
    this.provider?.postStudioSet(logsStudioData(this.record));
  }
}

/**
 * Register the Logs WebviewView (`axis.logs`).
 * `retainContextWhenHidden` is false. Never throws.
 */
export function registerLogsPanel(
  context: ExtensionContext,
  resultsStore: unknown,
): LogsWebviewViewProvider | undefined {
  try {
    const provider = new LogsWebviewViewProvider(context, resultsStore);
    context.subscriptions.push({ dispose: () => provider.dispose() });
    return provider;
  } catch {
    return undefined;
  }
}
