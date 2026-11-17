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

import { describe, expect, mock, test } from 'bun:test';

type Handler = (message: unknown) => void;

const created: { count: number; disposed: number; paints: number; handler?: Handler; html: string } = {
  count: 0,
  disposed: 0,
  paints: 0,
  html: '',
};

mock.module('vscode', () => ({
  ViewColumn: { Active: -1 },
  window: {
    createWebviewPanel: () => {
      created.count += 1;
      return {
        reveal() {},
        onDidDispose: () => ({ dispose() {} }),
        dispose() {
          created.disposed += 1;
        },
        webview: {
          set html(value: string) {
            created.paints += 1;
            created.html = value;
          },
          get html() {
            return created.html;
          },
          onDidReceiveMessage(handler: Handler) {
            created.handler = handler;
            return { dispose() {} };
          },
        },
      };
    },
  },
}));

const { registerStartPanel } = await import('./start-panel');

describe('start panel messages', () => {
  test('ignores unknown ids and further input while a choice is running', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const chosen: string[] = [];
    const panel = registerStartPanel(async (id) => {
      chosen.push(id);
      await gate;
    });
    panel.reveal();
    const paintsAfterOpen = created.paints;
    created.handler?.({ type: 'choose', id: 'nope' });
    created.handler?.({ type: 'choose', id: 'hosted' });
    created.handler?.({ type: 'choose', id: 'local' });
    created.handler?.({ type: 'back' });
    expect(chosen).toEqual(['hosted']);
    expect(created.paints).toBe(paintsAfterOpen);

    release();
    await gate;
    await new Promise((resolve) => setTimeout(resolve, 0));
    created.handler?.({ type: 'back' });
    expect(created.paints).toBe(paintsAfterOpen + 1);
    expect(created.html).toContain('How should a script run?');
    expect(created.count).toBe(1);

    panel.dispose();
    panel.dispose();
    panel.reveal();
    expect(created.disposed).toBe(1);
    expect(created.count).toBe(1);
  });

  test('dismiss calls onDismiss and closes the panel without choosing', async () => {
    let dismissed = 0;
    const panel = registerStartPanel(async () => {
      throw new Error('choose must not run');
    }, () => {
      dismissed += 1;
    });
    panel.reveal();
    const disposedBefore = created.disposed;
    created.handler?.({ type: 'dismiss' });
    expect(dismissed).toBe(1);
    expect(created.disposed).toBe(disposedBefore + 1);
    panel.dispose();
  });
});
