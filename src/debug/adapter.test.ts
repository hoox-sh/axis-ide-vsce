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
import { PassThrough } from 'node:stream';
import { runAdapter } from './adapter';
import { AXIS_BAR_DAP_TYPE } from './bar-adapter';

function isObj(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isResponse(value: unknown): value is Record<string, unknown> {
  return isObj(value) && (value as { type?: unknown }).type === 'response';
}
function isEvent(value: unknown): value is Record<string, unknown> {
  return isObj(value) && (value as { type?: unknown }).type === 'event';
}

function dapFrame(message: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  return Buffer.concat([
    Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'ascii'),
    body,
  ]);
}

/** Concatenate captured stdout chunks and split out every Content-Length frame body. */
function parseFrames(chunks: Buffer[]): unknown[] {
  const data = Buffer.concat(chunks);
  const out: unknown[] = [];
  let i = 0;
  while (i < data.length) {
    const end = data.indexOf(Buffer.from('\r\n\r\n', 'utf8'), i);
    if (end < 0) break;
    const header = data.subarray(i, end).toString('utf8');
    const m = header.match(/Content-Length:\s*(\d+)/i);
    if (!m) break;
    const len = Number(m[1]);
    const start = end + 4;
    const body = data.subarray(start, start + len);
    try {
      out.push(JSON.parse(body.toString('utf8')));
    } catch {
      // ignore malformed body
    }
    i = start + len;
  }
  return out;
}

function spawnAdapter() {
  const stdout = new PassThrough();
  const chunks: Buffer[] = [];
  stdout.on('data', (chunk) => chunks.push(chunk));
  const stdin = new PassThrough();
  runAdapter(stdin, stdout, { onEnd: () => {} });
  stdin.resume();
  return { stdin, stdout, chunks };
}

describe('axis-bar DAP adapter stdio transport (type axis-bar)', () => {
  test('DAP type is axis-bar, never pyne', () => {
    expect(AXIS_BAR_DAP_TYPE).toBe('axis-bar');
    expect(AXIS_BAR_DAP_TYPE).not.toBe('pyne');
  });

  test('round-trips launch→stopped over Content-Length framing', () => {
    const { stdin, chunks } = spawnAdapter();
    // initialize first (produces the initialized event), then launch.
    stdin.write(dapFrame({ seq: 1, type: 'request', command: 'initialize' }));
    chunks.length = 0;
    const launch = {
      seq: 2,
      type: 'request',
      command: 'launch',
      arguments: {
        bars: [{ time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 9 }],
        stopOnEntry: true,
      },
    };
    stdin.write(dapFrame(launch));

    const parsed = parseFrames(chunks);
    const responses = parsed.filter(isResponse);
    const events = parsed.filter(isEvent);

    expect(
      responses.some(
        (r) => r.success === true && r.command === 'launch' && r.request_seq === 2,
      ),
    ).toBe(true);
    expect(
      events.some(
        (e) =>
          e.event === 'stopped' && (e.body as { reason?: string })?.reason === 'entry',
      ),
    ).toBe(true);
  });

  test('next moves one bar and emits stopped', () => {
    const { stdin, chunks } = spawnAdapter();
    const launch = {
      seq: 1,
      type: 'request',
      command: 'launch',
      arguments: {
        bars: [
          { time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 9 },
          { time: 2, open: 1.5, high: 2.5, low: 1, close: 2, volume: 8 },
        ],
        stopOnEntry: false,
      },
    };
    stdin.write(dapFrame(launch));
    chunks.length = 0; // drop launch response

    const next = { seq: 2, type: 'request', command: 'next' };
    stdin.write(dapFrame(next));

    const parsed = parseFrames(chunks);
    const responses = parsed.filter(isResponse);
    const stopped = parsed.filter(
      (e) => isEvent(e) && e.event === 'stopped',
    );
    expect(responses.some((r) => r.success === true && r.command === 'next')).toBe(true);
    expect(stopped).toHaveLength(1);
  });

  test('two frames in a single write are both parsed', () => {
    const { stdin, chunks } = spawnAdapter();
    const one = { seq: 1, type: 'request', command: 'initialize' };
    const two = { seq: 2, type: 'request', command: 'launch', arguments: { bars: [] } };
    stdin.write(Buffer.concat([dapFrame(one), dapFrame(two)]));

    const parsed = parseFrames(chunks);
    const commands = parsed.filter(isResponse).map((r) => r.command);
    expect(commands).toContain('initialize');
    expect(commands).toContain('launch');
  });

  test('non-request messages and malformed JSON are ignored', () => {
    const { stdin, chunks } = spawnAdapter();
    const garbage = Buffer.concat([
      dapFrame({ nope: true }),
      Buffer.from('Content-Length: 5\r\n\r\n{not-json', 'utf8'),
      dapFrame({ seq: 9, type: 'request', command: 'threads' }),
    ]);
    stdin.write(garbage);

    const parsed = parseFrames(chunks);
    const commands = parsed.filter(isResponse).map((r) => r.command);
    expect(commands).toContain('threads');
    expect(parsed.some((p) => isObj(p) && (p as { nope?: unknown }).nope === true)).toBe(false);
  });
});
