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
import { DESK_ACTIONS, deskCommandIds } from '../host/desk';

const registered: {
  id?: string;
  provider?: {
    resolveWebviewView(view: {
      webview: { options?: { enableScripts?: boolean; enableCommandUris?: readonly string[] }; html: string };
      onDidDispose: () => { dispose: () => void };
    }): void;
  };
} = {};

mock.module('vscode', () => ({
  window: {
    registerWebviewViewProvider: (
      id: string,
      provider: (typeof registered)['provider'],
    ) => {
      registered.id = id;
      registered.provider = provider;
      return { dispose() {} };
    },
  },
}));

const { registerAxisDesk } = await import('./axis-desk');
const { DeskSession } = await import('../host/desk');

describe('axis desk provider', () => {
  test('passes the command allowlist to the webview', () => {
    registerAxisDesk(new DeskSession());
    const webview: {
      options?: { enableScripts?: boolean; enableCommandUris?: readonly string[] };
      html: string;
    } = { html: '' };
    registered.provider?.resolveWebviewView({
      webview,
      onDidDispose: () => ({ dispose() {} }),
    });
    expect(registered.id).toBe('axis.desk');
    expect(webview.options).toEqual({
      enableScripts: false,
      enableCommandUris: deskCommandIds(),
    });
    expect(webview.options?.enableCommandUris).toEqual(
      DESK_ACTIONS.flatMap((group) => group.actions.map((action) => action.command)),
    );
    expect(webview.html).toContain('href="command:axis.runScript"');
    expect(webview.html).not.toContain('<script');
  });
});
