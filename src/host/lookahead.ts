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

/**
 * Static grep radar for Pine lookahead / HTF `security` (Wave 2 P8, 2-week).
 * This is **not** dynamic taint and is **not** a live-safe proof.
 */

export const LOOKAHEAD_STATIC_NOTE =
  'Static grep overlay — not dynamic taint, not a live-safe proof.';

export type LookaheadKind = 'lookahead_on' | 'security' | 'calc_on_every_tick';

export type LookaheadHit = {
  kind: LookaheadKind;
  /** 0-based line. */
  line: number;
  /** 0-based column. */
  col: number;
  text: string;
};

export type LookaheadReport = {
  static: true;
  tainted: boolean;
  hits: LookaheadHit[];
  note: typeof LOOKAHEAD_STATIC_NOTE;
};

const LINE_COMMENT = /\/\/.*$/gm;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;

function stripComments(source: string): string {
  return source.replace(BLOCK_COMMENT, (m) => m.replace(/[^\n]/g, ' ')).replace(LINE_COMMENT, '');
}

function pushHits(
  hits: LookaheadHit[],
  source: string, stripped: string,
  re: RegExp,
  kind: LookaheadKind,
): void {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  const copy = new RegExp(re.source, flags);
  for (;;) {
    const m = copy.exec(stripped);
    if (m === null) break;
    const idx = m.index;
    const before = source.slice(0, idx);
    const line = before.split('\n').length - 1;
    const col = before.length - (before.lastIndexOf('\n') + 1);
    const text = m[0].replace(/\s+/g, ' ').slice(0, 80);
    hits.push({ kind, line, col, text });
    if (copy.lastIndex === m.index) copy.lastIndex += 1;
  }
}

/** Scan Pine source. Empty / non-string → not tainted. */
export function scanPineLookahead(source: unknown): LookaheadReport {
  const raw = typeof source === 'string' ? source : '';
  const hits: LookaheadHit[] = [];
  if (!raw.trim()) {
    return { static: true, tainted: false, hits, note: LOOKAHEAD_STATIC_NOTE };
  }
  const stripped = stripComments(raw);
  pushHits(hits, raw, stripped, /\bbarmerge\.lookahead_on\b|\blookahead_on\b/, 'lookahead_on');
  pushHits(hits, raw, stripped, /\brequest\.security\s*\(/, 'security');
  pushHits(hits, raw, stripped, /\bcalc_on_every_tick\s*=\s*true\b/, 'calc_on_every_tick');
  return {
    static: true,
    tainted: hits.length > 0,
    hits,
    note: LOOKAHEAD_STATIC_NOTE,
  };
}
