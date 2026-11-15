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
 * axis-bar DAP debug adapter executable (out-of-process).
 *
 * VS Code launches this as a separate process via `DebugAdapterExecutable`
 * (see `src/debug/register.ts`, DAP type `axis-bar`, never `pyne`). It speaks
 * the DAP Content-Length framing over stdio: DAP requests arrive on stdin,
 * responses and events are written to stdout. All DAP logic lives in
 * `AxisBarDebugSession` (launch/breakpoints/step/continue/variables/scopes),
 * so the adapter is a thin stdio transport over the same session used by the
 * inline fallback.
 */

import { AxisBarDebugSession } from './bar-adapter';

type DapRequest = {
  seq: number;
  type: 'request';
  command: string;
  arguments?: unknown;
};

function isDapRequest(value: unknown): value is DapRequest {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value as { type?: unknown }).type === 'request' &&
    typeof (value as { command?: unknown }).command === 'string'
  );
}

/** Write one DAP message to stdout with Content-Length framing. */
function writeMessage(stdout: NodeJS.WriteStream, message: unknown): void {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  const head = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'ascii');
  stdout.write(Buffer.concat([head, body]));
}

/**
 * Run the DAP transport over the given stdio streams. `session.handle` drives
 * every request and `writeMessage` emits each response/event back to stdout.
 */
export function runAdapter(
  stdin: NodeJS.ReadStream,
  stdout: NodeJS.WriteStream,
  opts?: { onEnd?: () => void },
): void {
  const session = new AxisBarDebugSession();
  let buffer = Buffer.alloc(0);
  let contentLength: number | null = null;

  function dispatch(message: unknown): void {
    if (!isDapRequest(message)) return;
    for (const out of session.handle(message)) writeMessage(stdout, out);
  }

  /** Feed raw stdin bytes, parsing as many Content-Length frames as available. */
  function feed(chunk: Buffer): void {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      if (contentLength === null) {
        const end = buffer.indexOf(Buffer.from('\r\n\r\n', 'utf8'));
        if (end < 0) return;
        const header = buffer.subarray(0, end).toString('utf8');
        const m = header.match(/Content-Length:\s*(\d+)/i);
        if (!m) {
          // Malformed header: drop this frame and keep scanning.
          buffer = buffer.subarray(end + 4);
          continue;
        }
        contentLength = Number(m[1]);
        buffer = buffer.subarray(end + 4);
      }
      if (buffer.length < contentLength) return;
      const body = buffer.subarray(0, contentLength);
      buffer = buffer.subarray(contentLength);
      contentLength = null;
      let parsed: unknown;
      try {
        parsed = JSON.parse(body.toString('utf8'));
      } catch {
        continue;
      }
      dispatch(parsed);
    }
  }

  stdin.on('data', feed);
  stdin.resume();
  stdin.on('end', () => {
    opts?.onEnd?.();
  });
  stdin.on('error', () => {
    opts?.onEnd?.();
  });
}

// Production entry point: real stdio. Only run when launched directly as the
// adapter executable (VS Code spawns out/debug/adapter.js as a separate
// process). Tests import runAdapter directly with mock streams, so this must
// not start reading stdin in the test process.
if (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  String(process.argv[1]).endsWith('adapter.js')
) {
  runAdapter(process.stdin, process.stdout);
}
