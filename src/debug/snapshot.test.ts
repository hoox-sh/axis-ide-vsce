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

import { afterEach, describe, expect, test } from 'bun:test';
import {
  lastBarDebugLaunch,
  launchFromRun,
  rememberBarDebugLaunch,
  resetBarDebugLaunchForTests,
  resolveTradeBarIndex,
} from './snapshot';

afterEach(() => {
  resetBarDebugLaunchForTests();
});

describe('bar debug snapshot', () => {
  test('launchFromRun copies finite series columns', () => {
    const launch = launchFromRun([{ time: 1, close: 2 }], {
      close: [2, 'x', 3],
      skip: 1 as unknown as number[],
    });
    expect(launch.series?.close).toEqual([2, null, 3]);
    expect(launch.series?.skip).toBeUndefined();
    rememberBarDebugLaunch(launch);
    expect(lastBarDebugLaunch()?.bars).toHaveLength(1);
  });

  test('resolveTradeBarIndex prefers barIndex then time match', () => {
    const bars = [{ time: 10 }, { time: 20 }, { time: 30 }];
    expect(resolveTradeBarIndex({ barIndex: 1.9 }, bars)).toBe(1);
    expect(resolveTradeBarIndex({ time: 30 }, bars)).toBe(2);
    expect(resolveTradeBarIndex({ time: 99 }, bars)).toBeUndefined();
    expect(resolveTradeBarIndex({}, bars)).toBeUndefined();
  });
});
