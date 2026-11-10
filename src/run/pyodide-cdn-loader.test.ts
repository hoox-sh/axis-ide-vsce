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
import { LOCAL_PYODIDE_VERSION, PYODIDE_CDN_INDEX } from '../host/pyodide-profile';
import { loadPyodideFromCdn, type PyodideCdnLoaderDeps } from './pyodide-cdn-loader';

function deps(overrides?: Partial<PyodideCdnLoaderDeps> & { body?: Uint8Array }): PyodideCdnLoaderDeps {
  const files = new Map<string, Uint8Array>();
  const dirs: string[] = [];
  const body = overrides?.body ?? new TextEncoder().encode('export async function loadPyodide() {}');
  return {
    fetchImpl: async (url) => {
      if (url === `${PYODIDE_CDN_INDEX}pyodide.mjs`) {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
        };
      }
      return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
    },
    mkdir: async (dir) => {
      dirs.push(dir);
    },
    writeFile: async (path, data) => {
      files.set(path, data);
    },
    importModule: async () => ({
      loadPyodide: async ({ indexURL }) => ({
        runPython: (code: string) => (code === '1+1' ? 2 : indexURL),
      }),
    }),
    joinPath: (...parts) => parts.join('/'),
    toFileUrl: (fsPath) => `file://${fsPath}`,
    ...overrides,
  };
}

describe('pyodide CDN loader', () => {
  test('writes pyodide.mjs to cache and boots with CDN indexURL', async () => {
    const seen: string[] = [];
    const d = deps({
      importModule: async (fileUrl) => {
        seen.push(fileUrl);
        return {
          loadPyodide: async ({ indexURL }) => {
            seen.push(indexURL);
            return { runPython: () => 0 };
          },
        };
      },
    });
    const py = await loadPyodideFromCdn('/tmp/pyodide-cache', d);
    expect(py.runPython('x')).toBe(0);
    expect(seen[0]).toBe(`file:///tmp/pyodide-cache/pyodide-${LOCAL_PYODIDE_VERSION}.mjs`);
    expect(seen[1]).toBe(PYODIDE_CDN_INDEX);
  });

  test('skips CDN fetch when pyodide.mjs is already in cache', async () => {
    let fetches = 0;
    const dest = `/tmp/pyodide-cache/pyodide-${LOCAL_PYODIDE_VERSION}.mjs`;
    const d = deps({
      fetchImpl: async () => {
        fetches += 1;
        return { ok: false, status: 599, arrayBuffer: async () => new ArrayBuffer(0) };
      },
      exists: async (path) => path === dest,
    });
    const py = await loadPyodideFromCdn('/tmp/pyodide-cache', d);
    expect(fetches).toBe(0);
    expect(py.runPython('x')).toBeDefined();
  });

  test('exists throw falls through to CDN fetch', async () => {
    let fetches = 0;
    const body = new TextEncoder().encode('export async function loadPyodide() {}');
    const d = deps({
      exists: async () => {
        throw new Error('stat failed');
      },
      fetchImpl: async () => {
        fetches += 1;
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
        };
      },
    });
    await loadPyodideFromCdn('/tmp/pyodide-cache', d);
    expect(fetches).toBe(1);
  });

  test('rejects empty cache dir, HTTP failure, tiny payload, missing export', async () => {
    await expect(loadPyodideFromCdn('  ', deps())).rejects.toThrow(/cache directory/i);
    await expect(
      loadPyodideFromCdn('/tmp/x', deps({ fetchImpl: async () => ({ ok: false, status: 503, arrayBuffer: async () => new ArrayBuffer(0) }) })),
    ).rejects.toThrow(/HTTP 503/);
    await expect(loadPyodideFromCdn('/tmp/x', deps({ body: new Uint8Array([1, 2, 3]) }))).rejects.toThrow(
      /too small/,
    );
    await expect(
      loadPyodideFromCdn(
        '/tmp/x',
        deps({
          importModule: async () => ({} as { loadPyodide: (opts: { indexURL: string }) => Promise<{ runPython: (c: string) => unknown }> }),
        }),
      ),
    ).rejects.toThrow(/loadPyodide/);
  });

  test('appends slash to indexURL when missing; empty index uses default', async () => {
    let used = '';
    const d = deps({
      fetchImpl: async (url) => {
        used = url;
        const body = new TextEncoder().encode('export async function loadPyodide() {}');
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
        };
      },
    });
    await loadPyodideFromCdn('/tmp/x', d, 'https://cdn.jsdelivr.net/pyodide/v0.29.5/full');
    expect(used).toBe(`${PYODIDE_CDN_INDEX}pyodide.mjs`);
    await loadPyodideFromCdn('/tmp/x', d, '   ');
    expect(used).toBe(`${PYODIDE_CDN_INDEX}pyodide.mjs`);
  });
});
