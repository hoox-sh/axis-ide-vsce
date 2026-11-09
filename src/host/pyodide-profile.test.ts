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
import {
  ALLOW_PYODIDE_DEFAULT,
  ALLOW_PYODIDE_SETTING,
  LOCAL_PYODIDE_VERSION,
  PYODIDE_CALCULATOR_PROFILE,
  PYODIDE_CDN_INDEX,
  PYODIDE_PINE_WHEEL_NEXT,
  formatPyodideRunBanner,
  isPyodideAllowed,
  pyodideRuntimeStatus,
} from './pyodide-profile';

describe('pyodide calculator profile', () => {
  test('locks LOCAL_PYODIDE_VERSION to 0.29.5', () => {
    expect(LOCAL_PYODIDE_VERSION).toBe('0.29.5');
    expect(PYODIDE_CALCULATOR_PROFILE.version).toBe('0.29.5');
  });

  test('profile is bars-in calculator, not stream-owning', () => {
    expect(PYODIDE_CALCULATOR_PROFILE.id).toBe('pyodide');
    expect(PYODIDE_CALCULATOR_PROFILE.kind).toBe('calculator');
    expect(PYODIDE_CALCULATOR_PROFILE.barsIn).toBe(true);
    expect(PYODIDE_CALCULATOR_PROFILE.streamOwning).toBe(false);
  });

  test('isPyodideAllowed is only explicit true; product default is true', () => {
    expect(ALLOW_PYODIDE_DEFAULT).toBe(true);
    expect(isPyodideAllowed(undefined)).toBe(false);
    expect(isPyodideAllowed(false)).toBe(false);
    expect(isPyodideAllowed(null)).toBe(false);
    expect(isPyodideAllowed('true')).toBe(false);
    expect(isPyodideAllowed(1)).toBe(false);
    expect(isPyodideAllowed(true)).toBe(true);
  });

  test('formatPyodideRunBanner is uploaded=0', () => {
    expect(formatPyodideRunBanner('hoox_pyne-0.6.29')).toBe(
      'engine=pyodide wheel=hoox_pyne-0.6.29 uploaded=0',
    );
    expect(formatPyodideRunBanner('')).toContain('uploaded=0');
  });

  test('flag off is not ready; flag on is ready only after Wasm load', () => {
    const off = pyodideRuntimeStatus(false);
    expect(off.ready).toBe(false);
    expect(off.version).toBe(LOCAL_PYODIDE_VERSION);
    expect(off.reason).toContain(ALLOW_PYODIDE_SETTING);
    expect(off.reason).toContain('false');

    const pending = pyodideRuntimeStatus(true);
    expect(pending.ready).toBe(false);
    expect(pending.version).toBe('0.29.5');
    expect(pending.reason).toContain(PYODIDE_CDN_INDEX);
    expect(pending.reason).toMatch(/not loaded yet/i);
    expect(pending.profile.streamOwning).toBe(false);

    const failed = pyodideRuntimeStatus(true, { wasmLoaded: false, error: 'cdn down' });
    expect(failed.ready).toBe(false);
    expect(failed.reason).toBe('cdn down');

    const blank = pyodideRuntimeStatus(true, { wasmLoaded: false, error: '  ' });
    expect(blank.ready).toBe(false);
    expect(blank.reason).toContain('not loaded yet');

    const wasmOnly = pyodideRuntimeStatus(true, { wasmLoaded: true });
    expect(wasmOnly.ready).toBe(false);
    expect(wasmOnly.reason).toContain(PYODIDE_PINE_WHEEL_NEXT);

    const wheelErr = pyodideRuntimeStatus(true, {
      wasmLoaded: true,
      runtimeReady: false,
      error: 'wheel missing',
    });
    expect(wheelErr.ready).toBe(false);
    expect(wheelErr.reason).toBe('wheel missing');

    const ready = pyodideRuntimeStatus(true, { wasmLoaded: true, runtimeReady: true });
    expect(ready.ready).toBe(true);
    expect(ready.reason).toMatch(/Runtime ready/i);
  });
});
