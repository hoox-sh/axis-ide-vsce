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
 * Workers studio shim (`axis.workers`) on the generic studio provider
 * (enhancement plan §5 Phase 2). This file keeps the historical export
 * surface (`registerWorkersStudio`, `WorkersStudioWebviewProvider`) and
 * owns only the probe orchestration; the shell, the `studio.ready`
 * handshake, message routing, and `studio.*` encoding live in the generic
 * provider, and the pure payload builders / body / registration live in
 * `workers-messages.ts` + `workers-studio-model.ts`.
 */

import { existsSync } from 'node:fs';
import {
  ColorThemeKind,
  type ExtensionContext,
  type WebviewView,
  type WebviewViewProvider,
  Uri,
  window,
} from 'vscode';
import {
  workersStudioData,
  workersStudioRegistration,
} from './workers-messages';
import type { StudioRegistration } from './studio-registry';
import {
  registerStudioView,
  StudioViewProvider,
  type StudioProviderDeps,
} from './studio-provider';
import {
  WORKERS_VIEW_ID,
  formatWorkerProbeDescription,
  getLastWorkersSnapshot,
  listWorkerCatalog,
  probeAllWorkers,
  probeWorker,
  type WorkerId,
  type WorkerProbeResult,
  type WorkersOverviewSnapshot,
} from './workers';

export const WORKERS_STUDIO_VIEW_ID = WORKERS_VIEW_ID;

const PROBE_TIMEOUT_MS = 4000;

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
function workersStudioDeps(context: ExtensionContext): StudioProviderDeps {
  return {
    extensionUri: context.extensionUri,
    joinPath: (base, ...parts) => Uri.joinPath(base as Uri, ...parts),
    fsPath: (uri) => (uri as Uri).fsPath,
    assetExists: (path) => existsSync(path),
    themeBodyClass: () => currentThemeBodyClass(),
  };
}

/** Drop response bodies before they reach the webview model. */
function presentResult(result: WorkerProbeResult): WorkerProbeResult {
  const badge = formatWorkerProbeDescription(result) ?? '';
  let detail = '';
  if (result.status === 'down' || result.status === 'degraded') {
    const err = String(result.error ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    const leak =
      /token|secret|password|authorization|bearer/i.test(err) ||
      err.startsWith('{') ||
      err.startsWith('[');
    detail = !err || leak || err.length > 160 ? badge || result.status : err.slice(0, 80);
  }
  return { ...result, detail, error: detail || null };
}

function presentSnapshot(
  snap: WorkersOverviewSnapshot | null,
): WorkersOverviewSnapshot | null {
  if (!snap) return null;
  try {
    return { ...snap, results: snap.results.map((row) => presentResult(row)) };
  } catch {
    return null;
  }
}

/**
 * Sidebar Workers studio (`axis.workers`) on the generic provider.
 * The registered `WebviewViewProvider` is the generic `StudioViewProvider`;
 * this class keeps the historical surface (probe orchestration with the
 * sequence guard, `postSnapshot` for palette-command wiring, reveal) and
 * forwards `resolveWebviewView` to the generic provider.
 */
export class WorkersStudioWebviewProvider implements WebviewViewProvider {
  private readonly entry: StudioRegistration;
  private readonly deps: StudioProviderDeps;
  private studio: StudioViewProvider | undefined;
  private cache: WorkersOverviewSnapshot | null = null;
  private seq = 0;

  constructor(private readonly context: ExtensionContext) {
    this.entry = workersStudioRegistration({
      probe: (id) => {
        void this.probeOne(id).catch(() => {
          // hostile probe host — never throw into the router
        });
      },
      probeAll: () => {
        void this.probeAll().catch(() => {
          // hostile probe host — never throw into the router
        });
      },
      state: () => this.presentData(),
    });
    this.deps = workersStudioDeps(context);
  }

  /** Wire `axis.workers` through the generic provider. Idempotent; never throws. */
  register(): this {
    if (this.studio) return this;
    this.studio = registerStudioView(this.entry, this.deps, window, this.context);
    return this;
  }

  resolveWebviewView(webviewView: WebviewView): void {
    this.studio?.resolveWebviewView(webviewView);
  }

  /** Push a probe snapshot into the resolved webview (palette command wiring). */
  postSnapshot(snap: WorkersOverviewSnapshot | null): void {
    this.cache = snap;
    this.pushSet();
  }

  reveal(): void {
    this.studio?.reveal(true);
  }

  private currentSnapshot(): WorkersOverviewSnapshot | null {
    if (this.cache) return this.cache;
    try {
      return getLastWorkersSnapshot();
    } catch {
      return null;
    }
  }

  private presentData() {
    let catalog: unknown = [];
    try {
      catalog = listWorkerCatalog();
    } catch {
      catalog = [];
    }
    return workersStudioData(catalog, presentSnapshot(this.currentSnapshot()));
  }

  private pushSet(): void {
    this.studio?.postStudioSet(this.presentData());
  }

  private mergeResult(result: WorkerProbeResult): void {
    const prev = this.currentSnapshot();
    const map = new Map<string, WorkerProbeResult>();
    if (prev) {
      for (const row of prev.results) map.set(row.id, row);
    }
    map.set(result.id, result);
    let catalog: readonly { id: WorkerId }[] = [];
    try {
      catalog = listWorkerCatalog();
    } catch {
      catalog = [];
    }
    const results: WorkerProbeResult[] = [];
    for (const entry of catalog) {
      const hit = map.get(entry.id);
      if (hit) results.push(hit);
    }
    if (!catalog.some((entry) => entry.id === result.id)) results.push(result);
    this.cache = {
      results,
      healthy: results.filter((row) => row.status === 'healthy').length,
      degraded: results.filter((row) => row.status === 'degraded').length,
      down: results.filter((row) => row.status === 'down').length,
      unknown: results.filter(
        (row) =>
          row.status === 'unknown' ||
          row.status === 'idle' ||
          row.status === 'skipped',
      ).length,
      checkedAt: Date.now(),
    };
  }

  private async probeAll(): Promise<void> {
    const seq = ++this.seq;
    try {
      const snap = await probeAllWorkers({ timeoutMs: PROBE_TIMEOUT_MS });
      if (seq !== this.seq) return;
      this.cache = snap;
      this.pushSet();
    } catch {
      if (seq !== this.seq) return;
      this.pushSet();
    }
  }

  private async probeOne(id: string): Promise<void> {
    const seq = ++this.seq;
    try {
      const result = await probeWorker(id as WorkerId, { timeoutMs: PROBE_TIMEOUT_MS });
      if (seq !== this.seq) return;
      this.mergeResult(result);
      this.pushSet();
    } catch {
      if (seq !== this.seq) return;
      this.pushSet();
    }
  }
}

export function registerWorkersStudio(
  context: ExtensionContext,
): WorkersStudioWebviewProvider {
  const provider = new WorkersStudioWebviewProvider(context);
  provider.register();
  return provider;
}
