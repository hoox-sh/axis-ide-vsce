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
import { join } from 'node:path';
import {
  PYODIDE_WHEEL_SETTING,
  VENDORED_ANTLR_WHEEL,
  VENDORED_PYNE_WHEEL,
  pyodideWheelBannerName,
  pyodideWheelMissingReason,
  resolvePyodideAssets,
} from './pyodide-wheel';

describe('resolvePyodideAssets', () => {
  test('pyodideWheelBannerName strips wheel suffix', () => {
    expect(pyodideWheelBannerName()).toBe('hoox_pyne-0.6.29');
    expect(pyodideWheelBannerName('/tmp/hoox_pyne-0.6.29-py3-none-any.whl')).toBe('hoox_pyne-0.6.29');
  });

  test('missing wheel lists searched paths', () => {
    const r = resolvePyodideAssets({
      extensionRoot: '/ext',
      cwd: '/repo',
      exist: () => false,
      joinPath: join,
      toFileUrl: (p) => `file://${p}`,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.missing).toContain(PYODIDE_WHEEL_SETTING);
      expect(r.searched.some((p) => p.includes(VENDORED_PYNE_WHEEL))).toBe(true);
      expect(pyodideWheelMissingReason(r.searched)).toContain(r.searched[0] ?? '');
    }
  });

  test('https wheel URL wins without exist', () => {
    const r = resolvePyodideAssets({
      wheelUrl: 'https://example.test/hoox_pyne.whl',
      exist: () => false,
      joinPath: join,
      toFileUrl: (p) => `file://${p}`,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.wheelUrl).toBe('https://example.test/hoox_pyne.whl');
  });

  test('file URL and local path and vendored media', () => {
    const fileHit = resolvePyodideAssets({
      wheelUrl: 'file:///tmp/x.whl',
      exist: () => false,
      joinPath: join,
      toFileUrl: (p) => `file://${p}`,
    });
    expect(fileHit.ok).toBe(true);

    const pathHit = resolvePyodideAssets({
      wheelUrl: '/tmp/local.whl',
      exist: (p) => p === '/tmp/local.whl',
      joinPath: join,
      toFileUrl: (p) => `file://${p}`,
    });
    expect(pathHit.ok).toBe(true);
    if (pathHit.ok) expect(pathHit.wheelUrl).toBe('file:///tmp/local.whl');

    const media = '/ext/media/pyodide';
    const vendored = resolvePyodideAssets({
      extensionRoot: '/ext',
      exist: (p) =>
        p === `${media}/${VENDORED_PYNE_WHEEL}` ||
        p === `${media}/${VENDORED_ANTLR_WHEEL}` ||
        p === `${media}/pynescript_runtime.py`,
      joinPath: join,
      toFileUrl: (p) => `file://${p}`,
    });
    expect(vendored.ok).toBe(true);
    if (vendored.ok) {
      expect(vendored.wheelUrl).toContain(VENDORED_PYNE_WHEEL);
      expect(vendored.antlrUrl).toContain(VENDORED_ANTLR_WHEEL);
      expect(vendored.runtimePath).toContain('pynescript_runtime.py');
    }
  });

  test('sibling pynescript dist + missing configured path falls through', () => {
    const sibling = resolvePyodideAssets({
      cwd: '/stack/axis-ide-vsce',
      wheelUrl: '/nope.whl',
      exist: (p) => {
        const n = p.replace(/\\/g, '/');
        return (
          n.endsWith(`pynescript/dist/${VENDORED_PYNE_WHEEL}`) ||
          n.endsWith(`axis/public/vendor/${VENDORED_ANTLR_WHEEL}`)
        );
      },
      joinPath: join,
      toFileUrl: (p) => `file://${p}`,
    });
    expect(sibling.ok).toBe(true);
    if (sibling.ok) expect(sibling.antlrUrl).toContain(VENDORED_ANTLR_WHEEL);
    expect(pyodideWheelMissingReason([])).toContain('(none)');
  });
});
