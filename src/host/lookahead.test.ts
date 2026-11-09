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
import { LOOKAHEAD_STATIC_NOTE, scanPineLookahead } from './lookahead';

describe('scanPineLookahead', () => {
  test('empty source is not tainted', () => {
    const r = scanPineLookahead('');
    expect(r.tainted).toBe(false);
    expect(r.static).toBe(true);
    expect(r.note).toBe(LOOKAHEAD_STATIC_NOTE);
    expect(scanPineLookahead(null).tainted).toBe(false);
  });

  test('flags lookahead_on, request.security, and calc_on_every_tick', () => {
    const src = `//@version=6
indicator("x")
a = request.security(syminfo.tickerid, "D", close)
b = close
c = barmerge.lookahead_on
strategy("s", calc_on_every_tick=true)
`;
    const r = scanPineLookahead(src);
    expect(r.tainted).toBe(true);
    expect(r.hits.some((h) => h.kind === 'security')).toBe(true);
    expect(r.hits.some((h) => h.kind === 'lookahead_on')).toBe(true);
    expect(r.hits.some((h) => h.kind === 'calc_on_every_tick')).toBe(true);
  });

  test('comments are not hits', () => {
    const src = `//@version=6
indicator("x")
// request.security(syminfo.tickerid, "D", close)
/* lookahead_on */
plot(close)
`;
    const r = scanPineLookahead(src);
    expect(r.tainted).toBe(false);
    expect(r.hits).toEqual([]);
  });
});
