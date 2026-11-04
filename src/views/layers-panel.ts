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
 * Sidebar WebviewView for Layers (`axis.layers`) — a thin shim on the
 * generic studio provider (enhancement plan §5 Phase 2).
 *
 * Wire change (old flat → `studio.*`): `layers.ready` → `studio.ready`;
 * `layers.openChart` → `studio.action` (action `openChart`, no args);
 * `layers.set` → `studio.set` carrying the snapshot verbatim as `data`.
 *
 * Handshake trace (identical timing to the old panel): resolve builds the
 * shell but posts nothing; the webview's `studio.ready` acks with a
 * data-less `studio.init` (which the webview ignores), and the entry's
 * `restore()` kicks the same epoch-guarded async chart read the old
 * `layers.ready` handler ran — the first snapshot arrives as `studio.set`
 * exactly when it used to arrive as `layers.set`.
 */

import { existsSync } from 'node:fs';
import { TextDecoder } from 'node:util';
import {
  ColorThemeKind,
  TabInputCustom,
  TabInputText,
  Uri,
  type ExtensionContext,
  type Tab,
  type TextDocument,
  commands,
  window,
  workspace,
} from 'vscode';
import { CHART_VIEW_TYPE, parseChartDocument } from '../editors/chart-document';
import { getChartLiveDoc, mergeChartDoc, subscribeChartLiveDoc } from '../editors/chart-live-doc';
import { LAYERS_VIEW_ID } from './layers';
import {
  LAYERS_ACTION_OPEN_CHART,
  LAYERS_STUDIO_VIEW,
  buildLayersBody,
  buildLayersSnapshot,
  type LayersSnapshotInput,
} from './layers-messages';
import { registerStudioView, StudioViewProvider, type StudioProviderDeps } from './studio-provider';
import type { StudioRegistration } from './studio-registry';

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

const OPTIONAL_DOC_KEYS = [
  'panes',
  'overlays',
  'onChain',
  'onchain',
  'on-chain',
] as const;

function isAxisJsonName(name: string): boolean {
  return /\.axis\.json$/i.test(name);
}

function isAxisJsonUri(uri: Uri | undefined | null): uri is Uri {
  try {
    if (!uri) return false;
    const name = uri.fsPath || uri.path || '';
    return isAxisJsonName(name);
  } catch {
    return false;
  }
}

function isChartDocument(doc: TextDocument | undefined): doc is TextDocument {
  try {
    if (!doc) return false;
    const name = doc.fileName || doc.uri?.fsPath || doc.uri?.path || '';
    return isAxisJsonName(name);
  } catch {
    return false;
  }
}

function uriFromTab(tab: Tab | undefined): Uri | null {
  try {
    const input = tab?.input;
    if (!input || typeof input !== 'object') return null;
    if (input instanceof TabInputCustom) {
      if (input.viewType === CHART_VIEW_TYPE || isAxisJsonUri(input.uri)) return input.uri;
      return null;
    }
    if (input instanceof TabInputText) {
      return isAxisJsonUri(input.uri) ? input.uri : null;
    }
    const bag = input as { uri?: Uri; viewType?: string };
    if (bag.viewType === CHART_VIEW_TYPE && bag.uri) return bag.uri;
    if (isAxisJsonUri(bag.uri)) return bag.uri;
    return null;
  } catch {
    return null;
  }
}

/**
 * Active chart tab wins; otherwise the first open `*.axis.json` / `axis.chart` tab.
 * Text documents cover a custom editor that is not the active text editor.
 */
function findOpenChartUri(): Uri | null {
  try {
    const activeTab = uriFromTab(window.tabGroups?.activeTabGroup?.activeTab);
    if (activeTab) return activeTab;
    const activeDoc = window.activeTextEditor?.document;
    if (isChartDocument(activeDoc)) return activeDoc.uri;
    const groups = window.tabGroups?.all ?? [];
    for (const group of groups) {
      for (const tab of group?.tabs ?? []) {
        const uri = uriFromTab(tab);
        if (uri) return uri;
      }
    }
    for (const editor of window.visibleTextEditors ?? []) {
      if (isChartDocument(editor?.document)) return editor.document.uri;
    }
    for (const doc of workspace.textDocuments ?? []) {
      if (isChartDocument(doc)) return doc.uri;
    }
  } catch {
    // hostile host
  }
  return null;
}

function textOfOpenDocument(uri: Uri): string | null {
  try {
    const key = uri.toString();
    for (const doc of workspace.textDocuments ?? []) {
      try {
        if (doc.uri.toString() !== key) continue;
        return doc.getText();
      } catch {
        return null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function readChartText(uri: Uri): Promise<string | null> {
  const open = textOfOpenDocument(uri);
  if (open != null) return open;
  try {
    const bytes = await workspace.fs.readFile(uri);
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return null;
  }
}

function hasOwnKey(obj: Record<string, unknown>, key: string): boolean {
  try {
    return Object.prototype.hasOwnProperty.call(obj, key);
  } catch {
    return false;
  }
}

/**
 * Scripts and drawings come from `parseChartDocument`.
 * Panes, overlays, and on-chain are copied only when the file has that key —
 * the parser injects a default price pane, which is not a layer row.
 */
function inputFromChartText(text: string): LayersSnapshotInput {
  let parsed: ReturnType<typeof parseChartDocument>;
  try {
    parsed = parseChartDocument(text);
  } catch {
    return { chartOpen: true };
  }
  if (!parsed.ok) return { chartOpen: true };
  let raw: Record<string, unknown> | null = null;
  try {
    const value: unknown = JSON.parse(text);
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      raw = value as Record<string, unknown>;
    }
  } catch {
    raw = null;
  }
  const doc: Record<string, unknown> = {
    drawings: parsed.doc.drawings,
  };
  if (raw && hasOwnKey(raw, 'scripts')) {
    doc.scripts = parsed.doc.scripts;
  } else if (raw && hasOwnKey(raw, 'scriptIds')) {
    doc.scriptIds = raw.scriptIds;
  } else {
    doc.scripts = parsed.doc.scripts;
  }
  if (raw) {
    for (const key of OPTIONAL_DOC_KEYS) {
      if (hasOwnKey(raw, key)) doc[key] = raw[key];
    }
  }
  return { chartOpen: true, doc };
}

function asDocRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

async function readLayersInput(): Promise<LayersSnapshotInput> {
  try {
    const uri = findOpenChartUri();
    if (!uri) return { chartOpen: false };
    const live = getChartLiveDoc(uri.toString());
    const text = await readChartText(uri);
    if (text == null) {
      if (!live) return { chartOpen: true };
      const doc = mergeChartDoc(null, live);
      return doc ? { chartOpen: true, doc } : { chartOpen: true };
    }
    const parsed = inputFromChartText(text);
    if (!live) return parsed;
    const doc = mergeChartDoc(asDocRecord(parsed.doc), live);
    if (!doc) return parsed;
    return { chartOpen: true, doc };
  } catch {
    return { chartOpen: false };
  }
}

/**
 * Sidebar WebviewView host for Layers (`axis.layers`) on the generic
 * provider. Posts `studio.set` when the active editor or an open chart
 * changes, and on the `studio.ready` handshake.
 */
export class LayersStudioProvider {
  private provider: StudioViewProvider | undefined;
  private epoch = 0;

  constructor(context: ExtensionContext) {
    this.provider = registerStudioView(
      this.registration(),
      studioDeps(context),
      window,
      context,
    );
  }

  /** True when the host accepted the `axis.layers` contribution. */
  registered(): boolean {
    return this.provider !== undefined;
  }

  private registration(): StudioRegistration {
    return {
      id: LAYERS_STUDIO_VIEW,
      title: 'Layers',
      viewId: LAYERS_VIEW_ID,
      retainContextWhenHidden: true,
      buildBody: buildLayersBody,
      actions: {
        [LAYERS_ACTION_OPEN_CHART]: () => {
          try {
            void commands.executeCommand('axis.openChart');
          } catch {
            // command missing in this host
          }
        },
      },
      restore: () => {
        // The old panel had no resolve-time post: its first snapshot was
        // pushed by the ready handler's async chart read. Keep that timing —
        // the data-less studio.init ack is ignored by the webview and the
        // async read posts studio.set exactly when layers.set used to land.
        void this.refreshSoon();
        return undefined;
      },
    };
  }

  /** Push a fresh snapshot if the view is resolved. */
  refresh(): void {
    void this.refreshSoon();
  }

  private async refreshSoon(): Promise<void> {
    const token = ++this.epoch;
    let input: LayersSnapshotInput = { chartOpen: false };
    try {
      input = await readLayersInput();
    } catch {
      input = { chartOpen: false };
    }
    if (token !== this.epoch) return;
    this.provider?.postStudioSet(buildLayersSnapshot(input));
  }
}

function subscribe(context: ExtensionContext, provider: LayersStudioProvider): void {
  const bump = (): void => {
    try {
      provider.refresh();
    } catch {
      // never throw from a host event
    }
  };
  context.subscriptions.push(
    window.onDidChangeActiveTextEditor(() => bump()),
    window.onDidChangeVisibleTextEditors(() => bump()),
    workspace.onDidOpenTextDocument(() => bump()),
    workspace.onDidCloseTextDocument(() => bump()),
    workspace.onDidChangeTextDocument((event) => {
      try {
        if (isChartDocument(event.document)) bump();
      } catch {
        // ignore
      }
    }),
    { dispose: subscribeChartLiveDoc(() => bump()) },
  );
  try {
    context.subscriptions.push(window.tabGroups.onDidChangeTabs(() => bump()));
  } catch {
    // tab API unavailable
  }
}

/**
 * Register the Layers WebviewView (`axis.layers`) instead of the Layers tree.
 * Retains the webview while the view is hidden. Never throws.
 */
export function registerLayersStudio(context: ExtensionContext): LayersStudioProvider | undefined {
  try {
    const provider = new LayersStudioProvider(context);
    // registerStudioView never throws; it returns undefined when the host
    // refuses the contribution. The old panel returned undefined there.
    if (!provider.registered()) return undefined;
    subscribe(context, provider);
    return provider;
  } catch {
    return undefined;
  }
}
