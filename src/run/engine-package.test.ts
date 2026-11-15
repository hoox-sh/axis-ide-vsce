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
import { LOCAL_ENGINE_PACKAGE } from './provision';
import {
  ENGINE_WHEEL_PARTS,
  VENDORED_ENGINE_WHEEL,
  resolveLocalEnginePackage,
} from './engine-package';

const joinPath = (...parts: string[]): string => parts.join('/');
const wheelPath = `/ext/${ENGINE_WHEEL_PARTS.join('/')}/${VENDORED_ENGINE_WHEEL}`;

describe('resolveLocalEnginePackage', () => {
  test('prefers a custom configured spec', async () => {
    const result = await resolveLocalEnginePackage({
      extensionRoot: '/ext',
      exists: () => {
        throw new Error('should not probe');
      },
      joinPath,
      configured: '/tmp/hoox_pyne_backend-0.7.0-py3-none-any.whl',
    });

    expect(result).toEqual({
      spec: '/tmp/hoox_pyne_backend-0.7.0-py3-none-any.whl',
      source: 'custom',
    });
  });

  test('uses the vendored wheel when present', async () => {
    const probes: string[] = [];
    const result = await resolveLocalEnginePackage({
      extensionRoot: '/ext',
      exists: (path) => {
        probes.push(path);
        return true;
      },
      joinPath,
    });

    expect(result).toEqual({ spec: wheelPath, source: 'vendored', path: wheelPath });
    expect(probes).toEqual([wheelPath]);
  });

  test('treats the default package name as "not custom"', async () => {
    const result = await resolveLocalEnginePackage({
      extensionRoot: '/ext',
      exists: async () => true,
      joinPath,
      configured: LOCAL_ENGINE_PACKAGE,
    });

    expect(result.source).toBe('vendored');
  });

  test('falls back to the PyPI name when the wheel is missing', async () => {
    const result = await resolveLocalEnginePackage({
      extensionRoot: '/ext',
      exists: async () => false,
      joinPath,
    });

    expect(result).toEqual({ spec: LOCAL_ENGINE_PACKAGE, source: 'pypi' });
  });

  test('falls back when the extension root is empty', async () => {
    const result = await resolveLocalEnginePackage({
      extensionRoot: '   ',
      exists: async () => true,
      joinPath,
    });

    expect(result).toEqual({ spec: LOCAL_ENGINE_PACKAGE, source: 'pypi' });
  });

  test('falls back when the existence probe throws', async () => {
    const result = await resolveLocalEnginePackage({
      extensionRoot: '/ext',
      exists: () => {
        throw new Error('EACCES');
      },
      joinPath,
    });

    expect(result).toEqual({ spec: LOCAL_ENGINE_PACKAGE, source: 'pypi' });
  });

  test('treats an empty configured value as unset', async () => {
    const result = await resolveLocalEnginePackage({
      extensionRoot: '/ext',
      exists: async () => true,
      joinPath,
      configured: '   ',
    });

    expect(result.source).toBe('vendored');
  });
});
