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

import { describe, expect, test } from 'bun:test';
import { htmlHasInlineScript } from './studio-html';
import { buildAlertsStudioBody } from './alerts-studio';

describe('buildAlertsStudioBody', () => {
  test('emits the exact old alerts-html body markup the webview depends on', () => {
    const body = buildAlertsStudioBody();
    expect(body).toContain('<div id="alerts-root" class="alerts-root" data-axis-alerts-host="1">');
    expect(body).toContain('<header class="alerts-header">');
    expect(body).toContain('<svg class="alerts-logo" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">');
    expect(body).toContain('<path fill="currentColor" d="M8 1.75a.75.75 0 0 1 .75.75v.41A4.5 4.5 0 0 1 12.5 7.25v2.1l.9 1.35a.75.75 0 0 1-.62 1.15H3.22a.75.75 0 0 1-.62-1.15l.9-1.35v-2.1A4.5 4.5 0 0 1 7.25 2.91V2.5A.75.75 0 0 1 8 1.75zM6.5 12.75a1.5 1.5 0 0 0 3 0h-3z"/>');
    expect(body).toContain('<h1 class="alerts-title">Alerts</h1>');
    expect(body).toContain(
      '<p id="alerts-summary" class="alerts-summary" aria-live="polite" aria-atomic="true">0 alerts, 0 enabled</p>',
    );
    expect(body).toContain('<label class="alerts-field" for="alerts-title">Title');
    expect(body).toContain('<input id="alerts-title" name="title" type="text" placeholder="Alert title" autocomplete="off" />');
    expect(body).toContain('<label class="alerts-field" for="alerts-condition">Condition');
    expect(body).toContain('<input id="alerts-condition" name="condition" type="text" placeholder="Optional condition" autocomplete="off" />');
    expect(body).toContain('id="alerts-add"');
    expect(body).toContain('data-action="add"');
    expect(body).toContain('ax-btn ax-btn--primary ax-btn--md');
    expect(body).toContain('Add');
    expect(body).toContain('type="button"');
    expect(body).toContain('<p id="alerts-live" class="alerts-live" aria-live="polite" aria-atomic="true"></p>');
    expect(body).toContain(
      'Add a title and an optional condition, then press Add. This is the IDE list, not the full PWA alert engine.',
    );
    expect(body).toContain('<ul id="alerts-list" class="alerts-list" aria-label="Alerts" hidden></ul>');
    expect(body).toContain('aria-live="polite"');
    expect(body.startsWith('<div id="alerts-root"')).toBe(true);
    expect(body.trimEnd().endsWith('</div>')).toBe(true);
    expect(body).not.toContain('<form');
    expect(body).not.toContain('onclick');
    expect(body).not.toContain('webview-ui-toolkit');
    expect(body).not.toContain('vscode-elements');
    expect(htmlHasInlineScript(body)).toBe(false);
  });
});
