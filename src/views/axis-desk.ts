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
 * AXIS activity-bar view. Paints `renderDeskHtml` and refreshes when the
 * session changes. Buttons are command links, so the webview has no script.
 */

import { randomBytes } from 'node:crypto';
import type { Disposable, WebviewView, WebviewViewProvider } from 'vscode';
import { window } from 'vscode';
import { DESK_VIEW_ID, type DeskSession, deskWebviewOptions, renderDeskHtml } from '../host/desk';

class AxisDeskProvider implements WebviewViewProvider {
  private view: WebviewView | undefined;
  private unsubscribe: (() => void) | undefined;

  constructor(private readonly session: DeskSession) {}

  resolveWebviewView(webviewView: WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = deskWebviewOptions();
    this.unsubscribe?.();
    this.unsubscribe = this.session.subscribe(() => this.render());
    this.render();
    webviewView.onDidDispose(() => {
      this.unsubscribe?.();
      this.unsubscribe = undefined;
      if (this.view === webviewView) this.view = undefined;
    });
  }

  private render(): void {
    const view = this.view;
    if (!view) return;
    try {
      view.webview.html = renderDeskHtml(this.session.get(), randomBytes(16).toString('hex'));
    } catch {
      // View may already be gone.
    }
  }
}

export function registerAxisDesk(session: DeskSession): Disposable {
  const provider = new AxisDeskProvider(session);
  return window.registerWebviewViewProvider(DESK_VIEW_ID, provider);
}
