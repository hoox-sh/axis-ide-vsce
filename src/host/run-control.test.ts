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
import { abortInflightRun, beginCommandAbortController } from './run-control';

describe('run control', () => {
  test('abortInflightRun is idle when missing or already aborted', () => {
    expect(abortInflightRun(undefined)).toBe('idle');
    const ac = new AbortController();
    ac.abort();
    expect(abortInflightRun(ac)).toBe('idle');
  });

  test('abortInflightRun stops a live controller', () => {
    const ac = new AbortController();
    expect(abortInflightRun(ac)).toBe('stopped');
    expect(ac.signal.aborted).toBe(true);
    expect(abortInflightRun(ac)).toBe('idle');
  });

  test('beginCommandAbortController aborts the previous controller', () => {
    const prev = new AbortController();
    const next = beginCommandAbortController(prev);
    expect(prev.signal.aborted).toBe(true);
    expect(next.signal.aborted).toBe(false);
    const afterUndefined = beginCommandAbortController(undefined);
    expect(afterUndefined).toBeInstanceOf(AbortController);
  });

  test('abort helpers swallow abort() throws', () => {
    const hostile = {
      signal: { aborted: false },
      abort(): void {
        throw new Error('nope');
      },
    } as AbortController;
    expect(abortInflightRun(hostile)).toBe('stopped');
    expect(beginCommandAbortController(hostile)).toBeInstanceOf(AbortController);
  });
});
