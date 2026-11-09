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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import {
  RUN_RUNNING_CONTEXT,
  pineEditorWhen,
  pineEditorWhenNotRunning,
  pineEditorWhenRunning,
  pineResourceWhen,
  pineResourceWhenNotRunning,
  pineResourceWhenRunning,
} from './pine-lang';

const pkg = JSON.parse(
  readFileSync(join(import.meta.dir, '../../package.json'), 'utf8'),
) as {
  capabilities?: {
    untrustedWorkspaces?: { supported?: boolean; description?: string };
    virtualWorkspaces?: { supported?: boolean; description?: string };
  };
  activationEvents?: string[];
  contributes?: {
    commands?: Array<{ command: string; title?: string }>;
    menus?: Record<string, Array<{ command: string; when?: string }>>;
    keybindings?: Array<{ command: string; when?: string }>;
    views?: unknown;
    debuggers?: Array<{ type?: string }>;
  };
};

describe('host chrome manifest (P0 Stop / when / output / P1 capabilities)', () => {
  test('commands include Stop, Show Run Output, Data pick', () => {
    const ids = (pkg.contributes?.commands ?? []).map((c) => c.command);
    expect(ids).toContain('axis.stopRun');
    expect(ids).toContain('axis.showRunOutput');
    expect(ids).toContain('axis.pickData');
    expect(ids).toContain('axis.debug.start');
    expect(ids).toContain('axis.debug.stepBar');
    expect(ids).toContain('axis.debug.toggleBarBreakpoint');
    const show = (pkg.contributes?.commands ?? []).find(
      (c) => c.command === 'axis.showRunOutput',
    );
    expect(show?.title).toBe('Show Run Output');
    expect(pkg.contributes?.views).toBeUndefined();
    const dap = pkg.contributes?.debuggers ?? [];
    expect(dap.map((d) => d.type)).toEqual(['axis-bar']);
    expect(dap.some((d) => d.type === 'pyne')).toBe(false);
  });

  test('activationEvents include new onCommand ids', () => {
    const events = pkg.activationEvents ?? [];
    expect(events).toContain('onCommand:axis.stopRun');
    expect(events).toContain('onCommand:axis.showRunOutput');
    expect(events).toContain('onCommand:axis.pickData');
    expect(events).toContain('onCommand:axis.debug.start');
  });

  test('when clauses cover pinescript and PYNE extnames', () => {
    const editor = pineEditorWhen();
    const resource = pineResourceWhen();
    expect(editor).toContain('editorLangId == pinescript');
    expect(resource).toContain('resourceLangId == pinescript');
    for (const ext of ['.pyne', '.pine', '.pinev5', '.pinev6', '.pinescript']) {
      expect(editor).toContain(`resourceExtname == ${ext}`);
      expect(resource).toContain(`resourceExtname == ${ext}`);
    }
    const menus = pkg.contributes?.menus ?? {};
    const title = menus['editor/title'] ?? [];
    const run = title.find((e) => e.command === 'axis.runScript');
    const stop = title.find((e) => e.command === 'axis.stopRun');
    expect(run?.when).toBe(pineResourceWhenNotRunning());
    expect(stop?.when).toBe(pineResourceWhenRunning());
    const editorCtx = menus['editor/context'] ?? [];
    expect(editorCtx.some((e) => e.when === pineEditorWhen())).toBe(true);
    const explorer = menus['explorer/context'] ?? [];
    expect(explorer.some((e) => e.when === pineResourceWhen())).toBe(true);
    const keys = pkg.contributes?.keybindings ?? [];
    const runKey = keys.find((k) => k.command === 'axis.runScript');
    const stopKey = keys.find((k) => k.command === 'axis.stopRun');
    expect(runKey?.when).toBe(pineEditorWhenNotRunning());
    expect(stopKey?.when).toBe(pineEditorWhenRunning());
    expect(RUN_RUNNING_CONTEXT).toBe('axis.run.running');
  });

  test('declares untrustedWorkspaces and virtualWorkspaces unsupported', () => {
    expect(pkg.capabilities?.untrustedWorkspaces?.supported).toBe(false);
    expect(pkg.capabilities?.virtualWorkspaces?.supported).toBe(false);
    expect(pkg.capabilities?.untrustedWorkspaces?.description).toContain('Run');
    expect(pkg.capabilities?.virtualWorkspaces?.description).toContain('axis.json');
  });
});
