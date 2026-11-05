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

import type { WebviewView, WebviewViewProvider } from 'vscode';
import { logWarn } from '../host/logger';
import { encode } from '../protocol/codec';
import {
  HOST_TO_VIEW,
  type HostToViewType,
  type PayloadByType,
  type StudioInitPayload,
  type StudioNoticePayload,
  type StudioSetPayload,
} from '../protocol/types';
import type { StudioRegistration } from './studio-registry';
import { buildStudioHtml } from './studio-html';
import { StudioMessageRouter } from './studio-router';

/** Structural slice of `vscode.Webview` the provider touches (pure-host tests). */
export interface StudioWebviewLike {
  readonly cspSource: string;
  options: { enableScripts?: boolean; localResourceRoots?: readonly unknown[] };
  asWebviewUri(uri: unknown): { toString(): string };
  postMessage(message: unknown): unknown;
  onDidReceiveMessage(listener: (message: unknown) => void): { dispose(): void };
  html: string;
  getState(): unknown;
  setState(state: unknown): void;
}

/** Structural slice of `vscode.WebviewView` the provider touches. */
export interface StudioWebviewViewLike {
  readonly webview: StudioWebviewLike;
  show(preserveFocus?: boolean): void;
  onDidDispose(listener: () => void): { dispose(): void };
}

/** VS Code surface the provider needs, injected to keep this module pure-host. */
export interface StudioProviderDeps {
  /** Extension install root; assets live at `<root>/dist/webview/<id>`. */
  extensionUri: unknown;
  /** `vscode.Uri.joinPath`. */
  joinPath(base: unknown, ...segments: string[]): unknown;
  /** `Uri.fsPath` (may throw on remote schemes). */
  fsPath(uri: unknown): string;
  /** Compiled-asset probe (`fs.existsSync`). */
  assetExists(path: string): boolean;
  /** Current theme body class (`vscode.window.activeColorTheme.kind`). */
  themeBodyClass(): string;
  /** Per-document nonce (colors/symbols/library pattern); omit for a nonce-free shell. */
  createNonce?(): string;
}

/** Structural `window.registerWebviewViewProvider` for `registerStudioView`. */
export interface StudioViewHost {
  registerWebviewViewProvider(
    viewId: string,
    provider: WebviewViewProvider,
    options?: { webviewOptions?: { retainContextWhenHidden?: boolean } },
  ): { dispose(): void };
}

/** Structural `ExtensionContext.subscriptions` for `registerStudioView`. */
export interface StudioContextLike {
  subscriptions: Array<{ dispose(): void }>;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** colors/logs-style fallback: plain message, no CSP, no assets. */
function fallbackHtml(error: unknown): string {
  // Detailed-but-sanitized: the old per-studio builders echoed the reason
  // (missing assets / asWebviewUri / buildBody) so operators could act on it.
  // Strip angle brackets so the message can never inject markup.
  const message = error instanceof Error ? error.message : String(error);
  return `<!DOCTYPE html><html><body><p>${message.replace(/[<>&]/g, '')}</p></body></html>`;
}

/**
 * The generic panel-studio `WebviewViewProvider` (enhancement plan §5
 * Phase 2) — one class behind every registry entry. `resolveWebviewView`
 * enables scripts, builds the shell via `buildStudioHtml`, and wires
 * `onDidReceiveMessage` into a `StudioMessageRouter`. The first
 * `studio.ready` from the webview is the handshake: only then does the
 * host ack with `studio.init` carrying the entry's `restore()` data, so a
 * freshly recreated webview instance never misses its state. Webview-local
 * state is the VS Code setState/getState store behind
 * `persistWebviewState` / `readWebviewState`. Never throws.
 */
export class StudioViewProvider implements WebviewViewProvider {
  private view: StudioWebviewViewLike | undefined;
  private readonly router: StudioMessageRouter;
  private readonly unregisterRoute: () => void;

  constructor(
    private readonly entry: StudioRegistration,
    private readonly deps: StudioProviderDeps,
    router?: StudioMessageRouter,
  ) {
    this.router = router ?? new StudioMessageRouter();
    this.unregisterRoute = this.router.register({
      view: entry.id,
      ready: () => this.postInit(),
      actions: entry.actions,
    });
  }

  resolveWebviewView(webviewView: WebviewView): void {
    // vscode hands us the full WebviewView; the narrow shim type is what the
    // body actually touches (pure-host tests drive resolveStudioView).
    this.resolveStudioView(webviewView as unknown as StudioWebviewViewLike);
  }

  /** Narrow, test-visible resolve used by both the vscode entry and tests. */
  resolveStudioView(webviewView: StudioWebviewViewLike): void {
    try {
      this.view = webviewView;
      const { webview } = webviewView;
      webview.onDidReceiveMessage((raw) => this.handleRaw(raw));
      webviewView.onDidDispose(() => {
        if (this.view === webviewView) this.view = undefined;
      });
      try {
        let root: unknown;
        try {
          root = this.assetsRoot();
        } catch {
          root = undefined;
        }
        webview.options = {
          enableScripts: true,
          localResourceRoots: root === undefined ? [] : [root],
        };
        webview.html = this.buildHtml(webview);
      } catch (error) {
        try {
          webview.html = fallbackHtml(error);
        } catch {
          // html setter unavailable
        }
      }
    } catch {
      // never throw from resolve
    }
  }

  /** Reveal the view (commands / cross-panel focus). */
  reveal(preserveFocus?: boolean): void {
    try {
      this.view?.show(preserveFocus);
    } catch {
      // disposing
    }
  }

  /** Drop the router route and the view reference. Idempotent. */
  dispose(): void {
    try {
      this.unregisterRoute();
    } catch {
      // hostile router disposer
    }
    this.view = undefined;
  }

  /** Post `studio.init` — the `studio.ready` handshake ack, with `restore()` data when available. */
  postInit(): boolean {
    let payload: StudioInitPayload;
    if (this.entry.restore) {
      try {
        const data = this.entry.restore();
        payload = data === undefined ? { view: this.entry.id } : { view: this.entry.id, data };
      } catch (error) {
        logWarn(`studio ${this.entry.id} restore() failed: ${messageOf(error)}`);
        payload = { view: this.entry.id };
      }
    } else {
      payload = { view: this.entry.id };
    }
    return this.postEnvelope(HOST_TO_VIEW.StudioInit, payload);
  }

  /** Push fresh studio data (`studio.set`). */
  postStudioSet(data: unknown): boolean {
    const payload: StudioSetPayload = { view: this.entry.id, data };
    return this.postEnvelope(HOST_TO_VIEW.StudioSet, payload);
  }

  /** Surface a notice in the studio (`studio.notice`). */
  postStudioNotice(level: string, message: string): boolean {
    const payload: StudioNoticePayload = { view: this.entry.id, level, message };
    return this.postEnvelope(HOST_TO_VIEW.StudioNotice, payload);
  }

  /** Persist webview-local state (the store behind `acquireVsCodeApi().getState`). */
  persistWebviewState(state: unknown): void {
    try {
      this.view?.webview.setState(state);
    } catch {
      // disposing / setter unavailable
    }
  }

  /** Read webview-local state; undefined when unavailable. */
  readWebviewState(): unknown {
    try {
      return this.view?.webview.getState();
    } catch {
      return undefined;
    }
  }

  private handleRaw(raw: unknown): void {
    try {
      this.router.handle(raw);
    } catch {
      // hostile router / sink — never throw into the webview host
    }
  }

  private assetsRoot(): unknown {
    return this.deps.joinPath(this.deps.extensionUri, 'dist', 'webview', this.entry.id);
  }

  private assetPath(file: string): unknown {
    return this.deps.joinPath(this.assetsRoot(), file);
  }

  /** colors/symbols/logs pattern: refuse to mount without compiled assets. */
  private buildHtml(webview: StudioWebviewLike): string {
    let jsPath = '';
    let mainJs: unknown;
    try {
      mainJs = this.assetPath('main.js');
      jsPath = this.deps.fsPath(mainJs);
    } catch {
      jsPath = '';
      mainJs = undefined;
    }
    if (!jsPath || !this.deps.assetExists(jsPath) || mainJs === undefined) {
      throw new Error(
        `AXIS ${this.entry.id} webview assets missing at ${jsPath || 'unknown'}. Run: bun run compile:webview`,
      );
    }
    const scriptUri = webview.asWebviewUri(mainJs).toString();
    return buildStudioHtml({
      cspSource: webview.cspSource,
      scriptUri,
      styleUri: this.styleUriString(webview, scriptUri),
      bodyClass: this.bodyClass(),
      bodyHtml: this.studioBody(),
      ...(this.deps.createNonce ? { nonce: this.deps.createNonce() } : {}),
    });
  }

  private studioBody(): string {
    const build = this.entry.buildBody;
    if (!build) return '';
    return build();
  }

  /** main.css when compiled, else the script URI with the extension swapped. */
  private styleUriString(webview: StudioWebviewLike, scriptUri: string): string {
    const stylePath = this.assetPath('main.css');
    let styleUri = '';
    try {
      const cssPath = this.deps.fsPath(stylePath);
      if (this.deps.assetExists(cssPath)) {
        styleUri = webview.asWebviewUri(stylePath).toString();
      }
    } catch {
      styleUri = '';
    }
    return styleUri || scriptUri.replace(/main\.js$/, 'main.css');
  }

  /** Theme class (+ optional registry class); the shell defaults to `vscode-dark`. */
  private bodyClass(): string {
    let theme = '';
    try {
      theme = String(this.deps.themeBodyClass() ?? '');
    } catch {
      theme = '';
    }
    const extra = typeof this.entry.bodyClass === 'string' ? this.entry.bodyClass : '';
    return `${theme} ${extra}`.trim();
  }

  /** Encode + post one host→view envelope. False when the view or codec refuses. */
  private postEnvelope(type: HostToViewType, payload: PayloadByType[HostToViewType]): boolean {
    const webview = this.view?.webview;
    if (!webview) return false;
    try {
      const envelope = encode(type, payload);
      void webview.postMessage(envelope);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Register one studio view against the generic provider, applying the
 * registry entry's `retainContextWhenHidden` (panel studios false,
 * activity-bar studios true). An optional shared router lets every studio
 * dispatch through one instance. Never throws — a missing contribution or
 * a test host returns undefined, mirroring the per-panel register helpers.
 */
export function registerStudioView(
  entry: StudioRegistration,
  deps: StudioProviderDeps,
  host: StudioViewHost,
  context: StudioContextLike,
  router?: StudioMessageRouter,
): StudioViewProvider | undefined {
  try {
    const provider = new StudioViewProvider(entry, deps, router);
    const disposable = host.registerWebviewViewProvider(entry.viewId, provider, {
      webviewOptions: { retainContextWhenHidden: entry.retainContextWhenHidden },
    });
    try {
      context.subscriptions.push(disposable);
    } catch {
      // Hostile / disposing context; the disposable is still held by VS Code and
      // the provider is fully wired. Swallow rather than hide the view.
    }
    return provider;
  } catch {
    // uncontributed view id / test host
    return undefined;
  }
}
