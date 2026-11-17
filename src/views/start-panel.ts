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
 * Editor panel for the three run choices. Setup progress is painted in the
 * same panel. The script only posts a card id.
 */

import { randomBytes } from 'node:crypto';
import type { Disposable, WebviewPanel } from 'vscode';
import { ViewColumn, window } from 'vscode';
import {
  type StartCardId,
  type StartView,
  pickingView,
  readStartMessage,
  renderStartHtml,
} from '../host/start-run';

export type StartChoiceHandler = (card: StartCardId, panel: StartPanel) => Promise<void>;
export type StartDismissHandler = () => void;

export class StartPanel {
  private panel: WebviewPanel | undefined;
  private view: StartView = pickingView();
  private busy = false;
  private disposed = false;
  private readonly subscriptions: Disposable[] = [];

  constructor(
    private readonly onChoose: StartChoiceHandler,
    private readonly onDismiss?: StartDismissHandler,
  ) {}

  reveal(): void {
    if (this.disposed) return;
    if (this.panel) {
      this.panel.reveal(ViewColumn.Active);
      return;
    }
    const panel = window.createWebviewPanel('axis.start', 'Choose how to run', ViewColumn.Active, {
      enableScripts: true,
      localResourceRoots: [],
    });
    this.panel = panel;
    this.subscriptions.push(
      panel.onDidDispose(() => {
        if (this.panel === panel) this.panel = undefined;
      }),
      panel.webview.onDidReceiveMessage((message: unknown) => {
        void this.onMessage(message);
      }),
    );
    this.paint();
  }

  show(view: StartView): void {
    this.view = view;
    this.paint();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const panel = this.panel;
    this.panel = undefined;
    for (const subscription of this.subscriptions) {
      try {
        subscription.dispose();
      } catch {
        // The host may already have dropped the listener.
      }
    }
    this.subscriptions.length = 0;
    try {
      panel?.dispose();
    } catch {
      // The panel may already be gone.
    }
  }

  private paint(): void {
    const panel = this.panel;
    if (!panel) return;
    try {
      panel.webview.html = renderStartHtml(this.view, randomBytes(16).toString('hex'));
    } catch {
      // The panel may already be gone.
    }
  }

  private async onMessage(message: unknown): Promise<void> {
    const action = readStartMessage(message, this.busy);
    if (action.type === 'ignore') return;
    if (action.type === 'back') {
      this.show(pickingView());
      return;
    }
    if (action.type === 'dismiss') {
      this.onDismiss?.();
      try {
        this.panel?.dispose();
      } catch {
        // The panel may already be gone.
      }
      return;
    }
    this.busy = true;
    try {
      await this.onChoose(action.id, this);
    } finally {
      this.busy = false;
    }
  }
}

export function registerStartPanel(
  onChoose: StartChoiceHandler,
  onDismiss?: StartDismissHandler,
): StartPanel {
  return new StartPanel(onChoose, onDismiss);
}
