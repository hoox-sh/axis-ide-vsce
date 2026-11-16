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
import { chooseEngine } from './engine-choice';

const base = {
  localCommand: 'pyne-backend',
  localProvisioned: false,
};

describe('chooseEngine', () => {
  test('explicit modes pass through', () => {
    expect(chooseEngine({ ...base, mode: 'server' })).toBe('server');
    expect(chooseEngine({ ...base, mode: 'local' })).toBe('local');
    expect(chooseEngine({ ...base, mode: 'pyodide' })).toBe('pyodide');
  });

  test('auto prefers local when the venv is provisioned', () => {
    expect(chooseEngine({ ...base, mode: 'auto', localProvisioned: true })).toBe('local');
  });

  test('auto prefers local when the command is customised', () => {
    expect(
      chooseEngine({ ...base, mode: 'auto', localCommand: '/venv/bin/pyne-backend' }),
    ).toBe('local');
  });

  test('auto falls back to the hosted server when local is not provisioned', () => {
    expect(chooseEngine({ ...base, mode: 'auto' })).toBe('server');
  });

  test('blank commands are treated as the default', () => {
    expect(chooseEngine({ ...base, mode: 'auto', localCommand: '   ' })).toBe('server');
    expect(
      chooseEngine({ ...base, mode: 'auto', localCommand: undefined as unknown as string }),
    ).toBe('server');
  });
});
