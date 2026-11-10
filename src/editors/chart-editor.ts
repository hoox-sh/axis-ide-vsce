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

import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  type CancellationToken,
  CancellationError,
  ColorThemeKind,
  type CustomDocument,
  type CustomDocumentBackup,
  type CustomDocumentBackupContext,
  type CustomDocumentContentChangeEvent,
  type CustomDocumentOpenContext,
  type CustomEditorProvider,
  type ExtensionContext,
  type Uri,
  type Webview,
  type WebviewPanel,
  EventEmitter,
  Uri as UriClass,
  ViewColumn,
  window,
  workspace,
} from 'vscode';
import {
  CHART_HISTORY_SEQ,
  buildChartSession,
  resolveMockBarCount,
} from '../host/chart-session';
import {
  DEFAULT_DATAFEED_URL,
  fetchHistorical,
} from '../host/history-client';
import { logError, logProtocolReject, logWarn } from '../host/logger';
import { encode, HOST_TO_VIEW } from '../protocol';
import { getLastChartFull, notifyChart, subscribeChartNotify } from '../run/chart-bus';
import { recordChartViewport } from '../run/run-context';
import {
  type AxisChartDocV1,
  CHART_VIEW_TYPE,
  mergeScriptInputs,
  parseChartDocument,
  serializeChartDocument,
} from './chart-document';
import { appendDrawingToDoc } from './chart-drawings';
import {
  loadOhlcvCsvFile,
  resolveBarsFilePath,
} from '../host/csv-bars';
import { ALLOW_PYODIDE_DEFAULT, isPyodideAllowed } from '../host/pyodide-profile';
import { buildChartWebviewHtml } from './chart-html';
import { handleChartWebviewMessage } from './chart-messages';
import {
  OPEN_CHART_SOURCE_TOOL,
  resolveChartSourcePath,
  siblingPineCandidates,
} from '../host/open-chart';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** Open custom-editor documents — data pick / open-source without a studio. */
const openChartDocuments = new Map<string, AxisChartDocument>();

/**
 * Apply a chart doc in-memory and refresh webviews without marking dirty
 * (caller already wrote the same bytes to disk).
 */
export function applyChartDocumentQuiet(uri: Uri, next: AxisChartDocV1): boolean {
  const doc = openChartDocuments.get(uri.toString());
  if (!doc) return false;
  doc.replaceQuiet(next);
  return true;
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

function bytesToString(bytes: Uint8Array): string {
  return textDecoder.decode(bytes);
}

function stringToBytes(text: string): Uint8Array {
  return textEncoder.encode(text);
}

function throwIfCancelled(cancellation: CancellationToken): void {
  if (cancellation.isCancellationRequested) {
    throw new CancellationError();
  }
}

/** Editable chart workspace document (`*.axis.json`). */
export class AxisChartDocument implements CustomDocument {
  private readonly _onDidDispose = new EventEmitter<void>();
  readonly onDidDispose = this._onDidDispose.event;

  private readonly _onDidChange =
    new EventEmitter<CustomDocumentContentChangeEvent<AxisChartDocument>>();
  /** Content-change dirty (no undo stack yet — KD-4 early path). */
  readonly onDidChange = this._onDidChange.event;

  /** Fired after revert/reload without marking dirty — webviews should refresh. */
  private readonly _onDidRefresh = new EventEmitter<AxisChartDocument>();
  readonly onDidRefresh = this._onDidRefresh.event;

  private _doc: AxisChartDocV1;
  private _disposed = false;

  private constructor(
    readonly uri: Uri,
    doc: AxisChartDocV1,
  ) {
    this._doc = doc;
  }

  /**
   * Open from disk or backup. Empty file → default chart doc.
   * Invalid JSON / non-object root → throws (never silently overwrite on Save).
   */
  static async create(
    uri: Uri,
    backupId: string | undefined,
  ): Promise<AxisChartDocument> {
    let bytes: Uint8Array;
    try {
      if (backupId) {
        bytes = await workspace.fs.readFile(UriClass.parse(backupId));
      } else {
        try {
          bytes = await workspace.fs.readFile(uri);
        } catch {
          // New / missing file — empty chart workspace.
          bytes = stringToBytes('');
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(`AXIS chart: failed to read document: ${message}`);
    }

    const parsed = parseChartDocument(bytesToString(bytes));
    if (!parsed.ok) {
      throw new Error(
        `AXIS chart: invalid document at ${uri.toString()}: ${parsed.error}`,
      );
    }
    const document = new AxisChartDocument(uri, parsed.doc);
    openChartDocuments.set(uri.toString(), document);
    document.onDidDispose(() => {
      openChartDocuments.delete(uri.toString());
    });
    return document;
  }

  get documentData(): AxisChartDocV1 {
    return this._doc;
  }

  /** Replace document content and mark dirty via content-change event. */
  update(doc: AxisChartDocV1): void {
    if (this._disposed) return;
    this._doc = doc;
    this._onDidChange.fire({ document: this });
  }

  /** Replace content and refresh webviews without dirtying (disk already matches). */
  replaceQuiet(doc: AxisChartDocV1): void {
    if (this._disposed) return;
    this._doc = doc;
    this._onDidRefresh.fire(this);
  }

  async save(cancellation: CancellationToken): Promise<void> {
    await this.saveAs(this.uri, cancellation);
  }

  async saveAs(target: Uri, cancellation: CancellationToken): Promise<void> {
    if (this._disposed) {
      throw new Error('AXIS chart: cannot save a disposed document');
    }
    throwIfCancelled(cancellation);
    const bytes = stringToBytes(serializeChartDocument(this._doc));
    throwIfCancelled(cancellation);
    await workspace.fs.writeFile(target, bytes);
    throwIfCancelled(cancellation);
  }

  /**
   * Reload from disk. Does **not** fire content-change (would re-dirty).
   * Fires `onDidRefresh` so open webviews can re-init.
   */
  async revert(cancellation: CancellationToken): Promise<void> {
    if (this._disposed) return;
    throwIfCancelled(cancellation);
    let bytes: Uint8Array;
    try {
      bytes = await workspace.fs.readFile(this.uri);
    } catch {
      bytes = stringToBytes('');
    }
    throwIfCancelled(cancellation);
    if (this._disposed) return;
    const parsed = parseChartDocument(bytesToString(bytes));
    if (!parsed.ok) {
      throw new Error(`AXIS chart: revert failed: ${parsed.error}`);
    }
    this._doc = parsed.doc;
    // Do not fire _onDidChange — that marks dirty again after a clean revert.
    this._onDidRefresh.fire(this);
  }

  async backup(
    destination: Uri,
    cancellation: CancellationToken,
  ): Promise<CustomDocumentBackup> {
    throwIfCancelled(cancellation);
    await this.saveAs(destination, cancellation);
    throwIfCancelled(cancellation);
    return {
      id: destination.toString(),
      delete: async () => {
        try {
          await workspace.fs.delete(destination);
        } catch {
          // best-effort cleanup
        }
      },
    };
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    // lightweight core: no live-doc snapshot to clear
    this._onDidDispose.fire();
    this._onDidDispose.dispose();
    this._onDidChange.dispose();
    this._onDidRefresh.dispose();
  }
}

function chartAssetPath(extensionUri: Uri, file: string): Uri {
  return UriClass.joinPath(extensionUri, 'dist', 'webview', 'chart', file);
}

function assertChartAssets(extensionUri: Uri): void {
  const mainJs = chartAssetPath(extensionUri, 'main.js');
  if (!existsSync(mainJs.fsPath)) {
    throw new Error(
      `AXIS chart webview assets missing at ${mainJs.fsPath}. Run: bun run compile:webview`,
    );
  }
}

/** Read `axis.engine.allowPyodide` (default true; never throws). */
function readAllowPyodide(): boolean {
  try {
    return isPyodideAllowed(
      workspace.getConfiguration('axis.engine').get<boolean>('allowPyodide', ALLOW_PYODIDE_DEFAULT),
    );
  } catch {
    return ALLOW_PYODIDE_DEFAULT;
  }
}

async function openChartSource(document: AxisChartDocument): Promise<void> {
  const fsPath = document.uri.scheme === 'file' ? document.uri.fsPath : '';
  if (!fsPath) {
    void window.showErrorMessage('AXIS: Open source needs a file-backed chart.');
    return;
  }
  const preferred = resolveChartSourcePath(fsPath, document.documentData.scripts);
  const candidates = [
    ...(preferred ? [preferred] : []),
    ...siblingPineCandidates(fsPath),
  ];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    try {
      const uri = UriClass.file(candidate);
      await workspace.fs.stat(uri);
      await window.showTextDocument(uri, {
        viewColumn: ViewColumn.Beside,
        preview: false,
      });
      return;
    } catch {
      // try next suffix
    }
  }
  void window.showErrorMessage('AXIS: No sibling Pine source found for this chart.');
}

function getChartHtml(webview: Webview, extensionUri: Uri): string {
  assertChartAssets(extensionUri);
  const script = webview.asWebviewUri(chartAssetPath(extensionUri, 'main.js'));
  const style = webview.asWebviewUri(chartAssetPath(extensionUri, 'main.css'));
  return buildChartWebviewHtml({
    cspSource: webview.cspSource,
    scriptUri: script.toString(),
    styleUri: style.toString(),
    bodyClass: themeBodyClass(window.activeColorTheme.kind),
    allowPyodide: readAllowPyodide(),
  });
}

interface ChartHostSettings {
  useMockBars: boolean;
  historyBarsSetting?: number;
  datafeedUrl: string;
  allowRemote: boolean;
}

/** Read chart + datafeed settings (never throws). */
function readChartHostSettings(): ChartHostSettings {
  let useMockBars = false;
  let historyBarsSetting: number | undefined;
  let datafeedUrl = DEFAULT_DATAFEED_URL;
  let allowRemote = false;
  try {
    const cfg = workspace.getConfiguration('axis.chart');
    // Mock bars are opt-in; HistoryClient is the dogfood default.
    useMockBars = cfg.get<boolean>('useMockBars', false) === true;
    const hb = cfg.get<number>('historyBars');
    if (typeof hb === 'number' && Number.isFinite(hb)) historyBarsSetting = hb;
  } catch {
    useMockBars = false;
  }
  try {
    const df = workspace.getConfiguration('axis.datafeed');
    const url = df.get<string>('url');
    if (typeof url === 'string' && url.trim()) datafeedUrl = url.trim();
  } catch {
    // keep default
  }
  try {
    allowRemote =
      workspace.getConfiguration('axis.engine').get<boolean>('allowRemoteEndpoint', false) ===
      true;
  } catch {
    allowRemote = false;
  }
  return { useMockBars, historyBarsSetting, datafeedUrl, allowRemote };
}

/** Read chart settings + document into a fresh session (no stale init closure). */
function sessionForDocument(document: AxisChartDocument, context: ExtensionContext) {
  const settings = readChartHostSettings();
  const fileBars = Boolean(document.documentData.barsPath?.trim());
  return buildChartSession({
    doc: document.documentData,
    useMockBars: settings.useMockBars && !fileBars,
    historyBarsSetting: settings.historyBarsSetting,
  });
}

/** Post cached run chart.full so hide→show / late open keeps paint. */
function replayLastRunFull(webview: Webview, seriesKey: string): void {
  try {
    const last = getLastChartFull(seriesKey);
    if (!last || last.type !== 'chart.full') return;
    void webview.postMessage(encode(HOST_TO_VIEW.ChartFull, last.payload));
  } catch {
    // panel may be disposing
  }
}

/**
 * After handshake empty clear, fetch venue bars and post chart.full at history seq.
 * On failure: host.error + log — leave empty clear (do not silently mock).
 */
async function paintHistoryAfterHandshake(
  webview: Webview,
  document: AxisChartDocument,
  seriesKey: string,
  signal: AbortSignal,
  isDisposed: () => boolean,
): Promise<void> {
  const settings = readChartHostSettings();
  const doc = document.documentData;
  const barsPath = typeof doc.barsPath === 'string' ? doc.barsPath.trim() : '';
  if (barsPath) {
    const roots: string[] = [];
    if (document.uri.scheme === 'file' && document.uri.fsPath) {
      roots.push(dirname(document.uri.fsPath));
    }
    for (const folder of workspace.workspaceFolders ?? []) {
      if (folder.uri.scheme === 'file') roots.push(folder.uri.fsPath);
    }
    const resolved = resolveBarsFilePath(barsPath, roots);
    if (!resolved.ok) {
      logError(resolved.error);
      try {
        void webview.postMessage(
          encode(HOST_TO_VIEW.HostError, { code: 'HISTORY_FETCH', message: resolved.error }),
        );
      } catch {
        // disposing
      }
      return;
    }
    const csv = await loadOhlcvCsvFile(resolved.fsPath, async (p) => {
      const fs = await import('node:fs/promises');
      return fs.readFile(p, 'utf8');
    });
    if (isDisposed() || signal.aborted) return;
    if (!csv.ok) {
      logError(csv.error);
      try {
        void webview.postMessage(
          encode(HOST_TO_VIEW.HostError, { code: 'HISTORY_FETCH', message: csv.error }),
        );
      } catch {
        // disposing
      }
      return;
    }
    try {
      void webview.postMessage(
        encode(HOST_TO_VIEW.ChartFull, {
          bars: csv.bars,
          seq: CHART_HISTORY_SEQ,
        }),
      );
      if (!isDisposed()) replayLastRunFull(webview, seriesKey);
    } catch {
      // disposing
    }
    return;
  }
  if (settings.useMockBars) return;
  const limit = resolveMockBarCount(doc.historyBars, settings.historyBarsSetting);
  const history = await fetchHistorical({
    exchange: doc.exchange || 'binance',
    symbol: doc.symbol,
    timeframe: doc.interval || '1m',
    limit,
    baseUrl: settings.datafeedUrl,
    allowRemote: settings.allowRemote,
    signal,
  });
  if (isDisposed() || signal.aborted) return;
  if (!history.ok) {
    const message = history.error;
    logError(message);
    try {
      void webview.postMessage(
        encode(HOST_TO_VIEW.HostError, { code: 'HISTORY_FETCH', message }),
      );
    } catch {
      // disposing
    }
    return;
  }
  try {
    void webview.postMessage(
      encode(HOST_TO_VIEW.ChartFull, {
        bars: history.bars,
        seq: CHART_HISTORY_SEQ,
      }),
    );
    // Replay run paint only after history so a lower history seq cannot clobber it.
    if (!isDisposed()) replayLastRunFull(webview, seriesKey);
  } catch {
    // panel may be disposing
  }
}

function postHandshake(
  webview: Webview,
  session: ReturnType<typeof sessionForDocument>,
  opts?: {
    document?: AxisChartDocument;
    signal?: AbortSignal;
    isDisposed?: () => boolean;
  },
): void {
  try {
    // live doc removed in lightweight core; no publish
    void webview.postMessage(encode(HOST_TO_VIEW.ChartInit, session.init));
    if (session.full) {
      void webview.postMessage(encode(HOST_TO_VIEW.ChartFull, session.full));
    }
    if (session.useMockBars) {
      replayLastRunFull(webview, session.seriesKey);
      return;
    }
    // Mock off: clear already posted; fetch history then replay run (if any).
    if (opts?.document && opts.signal && opts.isDisposed) {
      void paintHistoryAfterHandshake(
        webview,
        opts.document,
        session.seriesKey,
        opts.signal,
        opts.isDisposed,
      );
    }
  } catch {
    // panel may be disposing
  }
}

class AxisChartEditorProvider implements CustomEditorProvider<AxisChartDocument> {
  private readonly _onDidChangeCustomDocument = new EventEmitter<
    CustomDocumentContentChangeEvent<AxisChartDocument>
  >();
  readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  /** Open webview panels per document — refresh on revert without re-dirty. */
  private readonly panels = new WeakMap<AxisChartDocument, Set<WebviewPanel>>();
  /** Strong refs + seriesKey so run-bus can filter which panels receive paint. */
  private readonly openPanels = new Map<
    WebviewPanel,
    {
      seriesKey: string;
      historyAbort?: AbortController;
      document?: AxisChartDocument;
    }
  >();
  private readonly busSub: { dispose(): void };
  private readonly onRequestReload: (() => void) | undefined;
  private readonly onApplyInputs:
    | ((inputs: Record<string, unknown>, document: AxisChartDocument) => void)
    | undefined;
  private readonly onBarBreakpoint: ((barIndex: number) => void) | undefined;
  private readonly onSelectTrade: ((barIndex: number) => void) | undefined;

  constructor(
    private readonly context: ExtensionContext,
    opts?: ChartEditorProviderOptions,
  ) {
    this.onRequestReload = opts?.onRequestReload;
    this.onApplyInputs = opts?.onApplyInputs;
    this.onBarBreakpoint = opts?.onBarBreakpoint;
    this.onSelectTrade = opts?.onSelectTrade;
    this.busSub = subscribeChartNotify((message) => {
      for (const [panel, meta] of [...this.openPanels]) {
        try {
          // A keyed paint must not land on a different chart, or on a panel
          // that has not finished its handshake (empty seriesKey).
          if (message.seriesKey && message.seriesKey !== meta.seriesKey) {
            continue;
          }
          if (message.type === 'chart.full') {
            void panel.webview.postMessage(
              encode(HOST_TO_VIEW.ChartFull, message.payload),
            );
          } else if (message.type === 'chart.delta') {
            void panel.webview.postMessage(
              encode(HOST_TO_VIEW.ChartDelta, message.payload),
            );
          } else if (message.type === 'host.run.status') {
            void panel.webview.postMessage(
              encode(HOST_TO_VIEW.HostRunStatus, message.payload),
            );
          } else if (message.type === 'chart.debugCursor') {
            void panel.webview.postMessage(
              encode(HOST_TO_VIEW.ChartDebugCursor, message.payload),
            );
          }
        } catch {
          // panel may be disposing
        }
      }
    });
  }

  private rebuildOpenCharts(): void {
    for (const [panel, meta] of [...this.openPanels]) {
      const document = meta.document;
      if (!document) continue;
      const session = sessionForDocument(document, this.context);
      const signal = this.beginHistoryFetch(panel, session.seriesKey);
      postHandshake(panel.webview, session, {
        document,
        signal,
        isDisposed: () => !this.openPanels.has(panel),
      });
    }
  }

  dispose(): void {
    this.busSub.dispose();
    for (const meta of this.openPanels.values()) {
      try {
        meta.historyAbort?.abort();
      } catch {
        // ignore
      }
    }
    this.openPanels.clear();
  }

  private beginHistoryFetch(panel: WebviewPanel, seriesKey?: string): AbortSignal {
    const prev = this.openPanels.get(panel);
    try {
      prev?.historyAbort?.abort();
    } catch {
      // ignore
    }
    const ac = new AbortController();
    this.openPanels.set(panel, {
      seriesKey: seriesKey ?? prev?.seriesKey ?? '',
      historyAbort: ac,
      document: prev?.document,
    });
    return ac.signal;
  }

  private trackPanel(
    document: AxisChartDocument,
    panel: WebviewPanel,
    seriesKey: string,
  ): void {
    let set = this.panels.get(document);
    if (!set) {
      set = new Set();
      this.panels.set(document, set);
    }
    set.add(panel);
    const prev = this.openPanels.get(panel);
    this.openPanels.set(panel, {
      seriesKey,
      historyAbort: prev?.historyAbort,
      document,
    });
  }

  private untrackPanel(document: AxisChartDocument, panel: WebviewPanel): void {
    const set = this.panels.get(document);
    if (set) set.delete(panel);
    const meta = this.openPanels.get(panel);
    try {
      meta?.historyAbort?.abort();
    } catch {
      // ignore
    }
    this.openPanels.delete(panel);
  }

  private refreshPanels(document: AxisChartDocument): void {
    const set = this.panels.get(document);
    if (!set) return;
    const session = sessionForDocument(document, this.context);
    for (const panel of set) {
      const signal = this.beginHistoryFetch(panel, session.seriesKey);
      postHandshake(panel.webview, session, {
        document,
        signal,
        isDisposed: () => !this.openPanels.has(panel),
      });
    }
  }

  async openCustomDocument(
    uri: Uri,
    openContext: CustomDocumentOpenContext,
    _token: CancellationToken,
  ): Promise<AxisChartDocument> {
    const document = await AxisChartDocument.create(uri, openContext.backupId);
    const changeSub = document.onDidChange((e) => {
      this._onDidChangeCustomDocument.fire(e);
    });
    const refreshSub = document.onDidRefresh((doc) => {
      this.refreshPanels(doc);
    });
    document.onDidDispose(() => {
      changeSub.dispose();
      refreshSub.dispose();
    });
    return document;
  }

  async resolveCustomEditor(
    document: AxisChartDocument,
    webviewPanel: WebviewPanel,
    _token: CancellationToken,
  ): Promise<void> {
    let disposed = false;

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        UriClass.joinPath(this.context.extensionUri, 'dist', 'webview', 'chart'),
        UriClass.joinPath(this.context.extensionUri, 'media'),
      ],
    };

    // Register message handler BEFORE assigning html — webview posts ready synchronously.
    // Rebuild session on every ready (hide→show re-posts; must not close over resolve-time snapshot).
    const msgSub = webviewPanel.webview.onDidReceiveMessage((raw) => {
      if (disposed) return;
      let session = sessionForDocument(document, this.context);
      const result = handleChartWebviewMessage(raw, () => {
        session = sessionForDocument(document, this.context);
        // Keep bus filter in sync when handshake rebuilds the seriesKey.
        const prev = this.openPanels.get(webviewPanel);
        this.openPanels.set(webviewPanel, {
          seriesKey: session.seriesKey,
          historyAbort: prev?.historyAbort,
          document,
        });
        return { init: session.init, full: session.full };
      });
      if (disposed) return;
      if (result.kind === 'reject') {
        let typeHint: string | undefined;
        try {
          if (
            raw !== null &&
            typeof raw === 'object' &&
            !Array.isArray(raw) &&
            typeof (raw as { type?: unknown }).type === 'string'
          ) {
            typeHint = (raw as { type: string }).type;
          }
        } catch {
          typeHint = undefined;
        }
        logProtocolReject(result.error, typeHint);
        return;
      }
      if (result.kind === 'setTool') {
        if (result.tool === OPEN_CHART_SOURCE_TOOL) {
          void openChartSource(document);
        }
        return;
      }
      if (result.kind === 'requestReload') {
        try {
          this.onRequestReload?.();
        } catch {
          // resume stub must not tear down the editor
        }
        return;
      }
      if (result.kind === 'commit') {
        if (disposed) return;
        try {
          const next = appendDrawingToDoc(document.documentData, result.drawing);
          document.update(next);
          // live doc publish removed (lightweight)
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          logError(`drawing.commit failed: ${message}`);
        }
        return;
      }
      if (result.kind === 'applyInputs') {
        if (disposed) return;
        try {
          const next = mergeScriptInputs(document.documentData, result.inputs);
          document.update(next);
          this.onApplyInputs?.(result.inputs, document);
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          logError(`chart.applyInputs failed: ${message}`);
        }
        return;
      }
      if (result.kind === 'viewport') {
        recordChartViewport(result.from, result.to);
        return;
      }
      if (result.kind === 'barBreakpoint') {
        try {
          this.onBarBreakpoint?.(result.barIndex);
        } catch {
          // debug session must not tear down the editor
        }
        return;
      }
      if (result.kind === 'selectTrade') {
        try {
          this.onSelectTrade?.(result.barIndex);
        } catch {
          // debug session must not tear down the editor
        }
        return;
      }
      if (result.kind === 'init') {
        if (disposed) return;
        try {
          // live doc publish removed (lightweight)
          void webviewPanel.webview.postMessage(result.envelope);
          if (result.full && !disposed) {
            void webviewPanel.webview.postMessage(result.full);
          }
          if (disposed) return;
          const key =
            this.openPanels.get(webviewPanel)?.seriesKey ?? session.seriesKey;
          if (session.useMockBars) {
            replayLastRunFull(webviewPanel.webview, key);
          } else {
            const signal = this.beginHistoryFetch(webviewPanel, key);
            void paintHistoryAfterHandshake(
              webviewPanel.webview,
              document,
              key,
              signal,
              () => disposed || !this.openPanels.has(webviewPanel),
            );
          }
        } catch {
          // panel may be disposing
        }
      }
    });

    const sessionKey = sessionForDocument(document, this.context).seriesKey;
    this.trackPanel(document, webviewPanel, sessionKey);

    try {
      webviewPanel.webview.html = getChartHtml(
        webviewPanel.webview,
        this.context.extensionUri,
      );
    } catch (e) {
      disposed = true;
      msgSub.dispose();
      this.untrackPanel(document, webviewPanel);
      const message = e instanceof Error ? e.message : String(e);
      logWarn(message);
      void window.showErrorMessage(message);
      throw e;
    }

    webviewPanel.onDidDispose(() => {
      disposed = true;
      msgSub.dispose();
      this.untrackPanel(document, webviewPanel);
    });
  }

  saveCustomDocument(
    document: AxisChartDocument,
    cancellation: CancellationToken,
  ): Thenable<void> {
    return document.save(cancellation);
  }

  saveCustomDocumentAs(
    document: AxisChartDocument,
    destination: Uri,
    cancellation: CancellationToken,
  ): Thenable<void> {
    return document.saveAs(destination, cancellation);
  }

  revertCustomDocument(
    document: AxisChartDocument,
    cancellation: CancellationToken,
  ): Thenable<void> {
    return document.revert(cancellation);
  }

  backupCustomDocument(
    document: AxisChartDocument,
    context: CustomDocumentBackupContext,
    cancellation: CancellationToken,
  ): Thenable<CustomDocumentBackup> {
    return document.backup(context.destination, cancellation);
  }
}

/** Register `axis.chart` CustomEditorProvider (editable, not Readonly). */
export type ChartEditorProviderOptions = {
  /** Host handler for webview `chart.requestReload` (resume stub in lightweight). */
  onRequestReload?: () => void;
  /** Persist `scripts[].inputs` then re-run with overrides (no Inputs studio). */
  onApplyInputs?: (inputs: Record<string, unknown>, document: AxisChartDocument) => void;
  /** Chart-bar breakpoint from webview click (DAP, not a studio). */
  onBarBreakpoint?: (barIndex: number) => void;
  /** Strategy table row → seek DAP to that bar (click the lying trade). */
  onSelectTrade?: (barIndex: number) => void;
};

export function registerChartEditorProvider(
  context: ExtensionContext,
  opts?: ChartEditorProviderOptions,
): { dispose(): void } {
  const provider = new AxisChartEditorProvider(context, opts);
  const registration = window.registerCustomEditorProvider(CHART_VIEW_TYPE, provider, {
    webviewOptions: { retainContextWhenHidden: false },
    supportsMultipleEditorsPerDocument: true,
  });
  return {
    dispose() {
      registration.dispose();
      provider.dispose();
    },
  };
}
