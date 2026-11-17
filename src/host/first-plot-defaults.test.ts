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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type ConfigProps = Record<
  string,
  { default?: unknown; markdownDescription?: string; enum?: string[] }
>;

function packageConfigProps(): ConfigProps {
  const pkg = JSON.parse(
    readFileSync(join(import.meta.dir, '../../package.json'), 'utf8'),
  ) as {
    contributes?: { configuration?: Array<{ properties?: ConfigProps }> };
  };
  const blocks = pkg.contributes?.configuration ?? [];
  const out: ConfigProps = {};
  for (const block of blocks) {
    Object.assign(out, block.properties ?? {});
  }
  return out;
}

describe('first-plot packaged defaults', () => {
  test('useMockBars defaults true; datafeed.source defaults sidecar (venue opt-in)', () => {
    const props = packageConfigProps();
    expect(props['axis.chart.useMockBars']?.default).toBe(true);
    expect(props['axis.datafeed.source']?.default).toBe('sidecar');
    expect(props['axis.datafeed.source']?.enum).toEqual(['sidecar', 'venue']);
  });

  test('settings copy does not claim live venue is the default', () => {
    const props = packageConfigProps();
    const mockMd = props['axis.chart.useMockBars']?.markdownDescription ?? '';
    const sourceMd = props['axis.datafeed.source']?.markdownDescription ?? '';
    expect(mockMd.toLowerCase()).toContain('default');
    expect(mockMd.toLowerCase()).toMatch(/sample|mock/);
    expect(sourceMd.toLowerCase()).toContain('opt-in');
    expect(sourceMd.toLowerCase()).toContain('local feed');
    expect(sourceMd.toLowerCase()).toContain('venue');
    expect(sourceMd).toMatch(/sidecar`?\s*\(default\)/i);
    expect(sourceMd).not.toMatch(/'venue'\s*\(default\)/i);
    expect(sourceMd).not.toMatch(/\"venue\"\s*\(default\)/i);
    expect(sourceMd).not.toMatch(/leaves the (chart|canvas) empty/i);
  });
});
