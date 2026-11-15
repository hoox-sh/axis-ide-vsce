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
import {
  LOCAL_PYODIDE_VERSION,
  PYODIDE_BOOT_FILES,
  PYODIDE_CDN_INDEX,
} from '../host/pyodide-profile';
import { loadPyodideRuntime, type PyodideLoadDeps } from './pyodide-cdn-loader';

const CACHE = '/tmp/pyodide-cache';
const BUNDLE = '/opt/axis/vendor/pyodide/0.29.5';

/** Plausible byte count per CDN file name. */
const ASSET_BYTES: Record<string, number> = {
  'pyodide.mjs': 2048,
  'pyodide.js': 2048,
  'pyodide-lock.json': 2048,
  'pyodide.asm.js': 2048,
  'pyodide.asm.wasm': 70_000,
  'python_stdlib.zip': 2048,
};

function bytesFor(name: string): Uint8Array {
  return new Uint8Array(ASSET_BYTES[name] ?? 0).fill(32);
}

function payload(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function okFetch(url: string) {
  const bytes = bytesFor(url.slice(url.lastIndexOf('/') + 1));
  return { ok: true, status: 200, arrayBuffer: async () => payload(bytes) };
}

function deps(overrides?: Partial<PyodideLoadDeps>): PyodideLoadDeps {
  return {
    fetchImpl: async (url) => okFetch(url),
    mkdir: async () => {},
    writeFile: async () => {},
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

describe('pyodide runtime loader', () => {
  test('boots from the bundled VSIX copy with zero network access', async () => {
    const fetched: string[] = [];
    let booted: { indexURL: string; packageCacheDir?: string } | null = null;
    const d = deps({
      fetchImpl: async (url) => {
        fetched.push(url);
        return okFetch(url);
      },
      exists: async (path) => path.startsWith(BUNDLE),
      importModule: async (fileUrl) => {
        expect(fileUrl).toBe(`file://${BUNDLE}/pyodide.mjs`);
        return {
          loadPyodide: async (opts) => {
            booted = opts;
            return { runPython: () => 0 };
          },
        };
      },
    });
    const py = await loadPyodideRuntime({ cacheDir: CACHE, bundledDir: BUNDLE }, d);
    expect(py.runPython('x')).toBe(0);
    expect(fetched).toEqual([]);
    expect(booted).toEqual({ indexURL: `${BUNDLE}/`, packageCacheDir: `${CACHE}/` });
  });

  test('an incomplete bundle falls back to the CDN-filled cache', async () => {
    const fetched: string[] = [];
    const lines: string[] = [];
    let booted = '';
    const d = deps({
      fetchImpl: async (url) => {
        fetched.push(url.slice(url.lastIndexOf('/') + 1));
        return okFetch(url);
      },
      log: (line) => lines.push(line),
      exists: async (path) => path === `${BUNDLE}/pyodide.mjs`,
      importModule: async (fileUrl) => {
        expect(fileUrl).toBe(`file://${CACHE}/pyodide.mjs`);
        return {
          loadPyodide: async ({ indexURL }) => {
            booted = indexURL;
            return { runPython: () => 0 };
          },
        };
      },
    });
    await loadPyodideRuntime({ cacheDir: CACHE, bundledDir: BUNDLE }, d);
    expect(booted).toBe(`${CACHE}/`);
    expect(fetched).toEqual(PYODIDE_BOOT_FILES.map((f) => f.name));
    expect(lines.some((l) => l.includes('no complete bundle'))).toBe(true);
  });

  test('downloads every boot file when no bundle is configured', async () => {
    const fetched: string[] = [];
    const written: string[] = [];
    let booted = '';
    const d = deps({
      fetchImpl: async (url) => {
        fetched.push(url);
        return okFetch(url);
      },
      writeFile: async (path, data) => {
        written.push(path);
        expect(data.byteLength).toBeGreaterThan(0);
      },
      importModule: async () => ({
        loadPyodide: async ({ indexURL }) => {
          booted = indexURL;
          return { runPython: () => 0 };
        },
      }),
    });
    await loadPyodideRuntime({ cacheDir: CACHE, bundledDir: '   ' }, d);
    expect(booted).toBe(`${CACHE}/`);
    for (const file of PYODIDE_BOOT_FILES) {
      expect(fetched).toContain(`${PYODIDE_CDN_INDEX}${file.name}`);
      expect(written).toContain(`${CACHE}/${file.name}`);
    }
  });

  test('never hands a remote URL to loadPyodide (Node path.resolve mangles it)', async () => {
    let booted = '';
    const d = deps({
      importModule: async () => ({
        loadPyodide: async ({ indexURL }) => {
          booted = indexURL;
          return { runPython: () => 0 };
        },
      }),
    });
    await loadPyodideRuntime({ cacheDir: CACHE }, d);
    expect(booted.startsWith('https://')).toBe(false);
    expect(booted.startsWith('file://')).toBe(false);
    expect(booted).toBe(`${CACHE}/`);
  });

  test('skips every CDN fetch when the cache is warm', async () => {
    let fetches = 0;
    const d = deps({
      fetchImpl: async () => {
        fetches += 1;
        return { ok: false, status: 599, arrayBuffer: async () => new ArrayBuffer(0) };
      },
      exists: async () => true,
    });
    const py = await loadPyodideRuntime({ cacheDir: CACHE }, d);
    expect(fetches).toBe(0);
    expect(py.runPython('x')).toBeDefined();
  });

  test('re-fetches only the missing asset when the cache is partial', async () => {
    const fetched: string[] = [];
    const d = deps({
      fetchImpl: async (url) => {
        fetched.push(url.slice(url.lastIndexOf('/') + 1));
        return okFetch(url);
      },
      exists: async (path) => !path.endsWith('pyodide.asm.wasm'),
    });
    await loadPyodideRuntime({ cacheDir: CACHE }, d);
    expect(fetched).toEqual(['pyodide.asm.wasm']);
  });

  test('exists throw falls through to CDN fetch', async () => {
    let fetches = 0;
    const d = deps({
      exists: async () => {
        throw new Error('stat failed');
      },
      fetchImpl: async (url) => {
        fetches += 1;
        return okFetch(url);
      },
    });
    await loadPyodideRuntime({ cacheDir: CACHE }, d);
    expect(fetches).toBe(PYODIDE_BOOT_FILES.length);
  });

  test('logs each cached, fetched, and bundled decision', async () => {
    const lines: string[] = [];
    const d = deps({
      log: (line) => lines.push(line),
      exists: async (path) => path.endsWith('pyodide.js'),
    });
    await loadPyodideRuntime({ cacheDir: CACHE }, d);
    expect(lines).toContain('pyodide: cached pyodide.js');
    expect(lines.some((l) => l.includes('fetched pyodide.asm.wasm'))).toBe(true);

    const bundledLines: string[] = [];
    const bundled = deps({
      log: (line) => bundledLines.push(line),
      exists: async () => true,
    });
    await loadPyodideRuntime({ cacheDir: CACHE, bundledDir: BUNDLE }, bundled);
    expect(bundledLines).toContain(`pyodide: bundled ${BUNDLE}`);
  });

  test('rejects empty cache dir, HTTP failure, tiny payload, missing export', async () => {
    await expect(loadPyodideRuntime({ cacheDir: '  ' }, deps())).rejects.toThrow(/cache directory/i);
    await expect(
      loadPyodideRuntime(
        { cacheDir: '/tmp/x' },
        deps({
          fetchImpl: async () => ({ ok: false, status: 503, arrayBuffer: async () => new ArrayBuffer(0) }),
        }),
      ),
    ).rejects.toThrow(/HTTP 503/);
    await expect(
      loadPyodideRuntime(
        { cacheDir: '/tmp/x' },
        deps({
          fetchImpl: async () => ({
            ok: true,
            status: 200,
            arrayBuffer: async () => payload(new Uint8Array([1, 2, 3])),
          }),
        }),
      ),
    ).rejects.toThrow(/too small/);
    await expect(
      loadPyodideRuntime(
        { cacheDir: '/tmp/x' },
        deps({
          importModule: async () =>
            ({}) as {
              loadPyodide: (opts: { indexURL: string }) => Promise<{ runPython: (c: string) => unknown }>;
            },
        }),
      ),
    ).rejects.toThrow(/loadPyodide/);
  });

  test('appends slash to the download base; empty base uses the default', async () => {
    const used: string[] = [];
    const d = deps({
      fetchImpl: async (url) => {
        used.push(url);
        return okFetch(url);
      },
    });
    await loadPyodideRuntime(
      { cacheDir: '/tmp/x', downloadBase: 'https://cdn.jsdelivr.net/pyodide/v0.29.5/full' },
      d,
    );
    expect(used).toContain(`${PYODIDE_CDN_INDEX}pyodide.mjs`);
    used.length = 0;
    await loadPyodideRuntime({ cacheDir: '/tmp/x', downloadBase: '   ' }, d);
    expect(used).toContain(`${PYODIDE_CDN_INDEX}pyodide.mjs`);
  });

  test('keeps an existing trailing slash on cache and bundle dirs', async () => {
    let booted: { indexURL: string; packageCacheDir?: string } | null = null;
    const d = deps({
      exists: async () => true,
      importModule: async () => ({
        loadPyodide: async (opts) => {
          booted = opts;
          return { runPython: () => 0 };
        },
      }),
    });
    await loadPyodideRuntime({ cacheDir: `${CACHE}/`, bundledDir: `${BUNDLE}/` }, d);
    expect(booted).toEqual({ indexURL: `${BUNDLE}/`, packageCacheDir: `${CACHE}/` });
  });

  test('accepts a Windows-style trailing separator without doubling it', async () => {
    let booted = '';
    const d = deps({
      exists: async () => true,
      importModule: async () => ({
        loadPyodide: async ({ indexURL }) => {
          booted = indexURL;
          return { runPython: () => 0 };
        },
      }),
    });
    await loadPyodideRuntime({ cacheDir: 'C:\\cache\\', bundledDir: 'C:\\axis\\vendor\\' }, d);
    expect(booted).toBe('C:\\axis\\vendor\\');
    expect(booted).not.toContain('\\\\');
  });

  test('pinned manifest matches the boot file list and version', () => {
    const manifest = JSON.parse(
      readFileSync(join(import.meta.dir, '..', '..', 'scripts', 'pyodide-assets.json'), 'utf8'),
    ) as { version: string; files: Array<{ name: string; bytes: number; sha256: string }> };
    expect(manifest.version).toBe(LOCAL_PYODIDE_VERSION);
    expect(manifest.files.map((f) => f.name)).toEqual(PYODIDE_BOOT_FILES.map((f) => f.name));
    for (const [i, file] of manifest.files.entries()) {
      expect(file.bytes).toBeGreaterThanOrEqual(PYODIDE_BOOT_FILES[i].minBytes);
      expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});
