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
import { resolve } from 'node:path';
import {
  isCsvBarsPath,
  loadOhlcvCsvFile,
  parseOhlcvCsv,
  resolveBarsFilePath,
  toStoredBarsPath,
} from './csv-bars';

describe('parseOhlcvCsv', () => {
  test('header aliases, ms timestamps, and skip bad rows', () => {
    const r = parseOhlcvCsv(
      't,o,h,l,c,v\n1700000000000,1,2,0.5,1.5,9\nbad\n1700000060,2,3,1,2.5,4\n',
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bars).toEqual([
      { time: 1_700_000_000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 9 },
      { time: 1_700_000_060, open: 2, high: 3, low: 1, close: 2.5, volume: 4 },
    ]);
  });

  test('quoted commas and escaped quotes', () => {
    const r = parseOhlcvCsv('time,open,high,low,close,volume\n"1700000000",1,2,0.5,1.5,"9""0"\n');
    expect(r.ok).toBe(true);
  });

  test('headerless six-column rows; ISO time; empty and no-rows fail', () => {
    const iso = parseOhlcvCsv('2024-01-01T00:00:00Z,10,11,9,10.5,1');
    expect(iso.ok).toBe(true);
    if (iso.ok) expect(iso.bars[0]?.open).toBe(10);
    expect(parseOhlcvCsv('').ok).toBe(false);
    expect(parseOhlcvCsv('time,open,high,low,close\nnope').ok).toBe(false);
    const boom = {
      toString() {
        throw new Error('hostile');
      },
    };
    expect(parseOhlcvCsv(boom as unknown as string).ok).toBe(false);
  });

  test('ships fixtures/sample-bars.csv', () => {
    const text = readFileSync(resolve(__dirname, '../../fixtures/sample-bars.csv'), 'utf8');
    const r = parseOhlcvCsv(text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.bars).toHaveLength(3);
  });
});

describe('barsPath resolve', () => {
  test('rejects traversal and non-csv; joins relative under root', () => {
    expect(isCsvBarsPath('../x.csv')).toBe(false);
    expect(isCsvBarsPath('bars.json')).toBe(false);
    expect(isCsvBarsPath('data/bars.csv')).toBe(true);
    const abs = resolveBarsFilePath('/tmp/a.csv', []);
    expect(abs.ok).toBe(true);
    const rel = resolveBarsFilePath('data/bars.csv', ['/ws']);
    expect(rel.ok).toBe(true);
    if (rel.ok) expect(rel.fsPath).toBe('/ws/data/bars.csv');
    const missingRoot = resolveBarsFilePath('data/bars.csv', []);
    expect(missingRoot.ok).toBe(false);
    const slashRoot = resolveBarsFilePath('data/bars.csv', ['/']);
    expect(slashRoot.ok).toBe(false);
    if (!slashRoot.ok) expect(slashRoot.error).toMatch(/escaped/i);
  });

  test('toStoredBarsPath strips workspace root', () => {
    expect(toStoredBarsPath('/ws/a/b.csv', '/ws')).toBe('a/b.csv');
    expect(toStoredBarsPath('/other/x.csv', '/ws')).toBe('/other/x.csv');
  });

  test('loadOhlcvCsvFile uses readText', async () => {
    const r = await loadOhlcvCsvFile('/x.csv', async () => 'time,open,high,low,close\n1,1,1,1,1,1');
    expect(r.ok).toBe(true);
    const fail = await loadOhlcvCsvFile('/x.csv', async () => {
      throw new Error('enoent');
    });
    expect(fail.ok).toBe(false);
    if (!fail.ok) expect(fail.error).toMatch(/enoent/i);
  });
});
