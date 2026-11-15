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
import {
  PYTHON_STANDALONE_RELEASE,
  PYTHON_STANDALONE_VERSION,
  RUNTIME_ASSETS,
  type RuntimeDownloadDeps,
  ensureStandalonePython,
  resolveRuntimeTarget,
} from './runtime-download';

const joinPath = (...parts: string[]): string => parts.join('/');
const LINUX = resolveRuntimeTarget('linux', 'x64');
if (!LINUX) throw new Error('test target missing');
const PYTHON = '/cache/python/bin/python3';

function baseDeps(overrides: Partial<RuntimeDownloadDeps> = {}): RuntimeDownloadDeps {
  return {
    target: LINUX,
    cacheDir: '/cache',
    download: async () => {},
    sha256: async () => RUNTIME_ASSETS['linux-x64'].sha256,
    extract: async () => {},
    exists: async () => false,
    joinPath,
    ...overrides,
  };
}

describe('resolveRuntimeTarget', () => {
  test('maps supported platform/arch pairs', () => {
    expect(resolveRuntimeTarget('linux', 'x64')?.key).toBe('linux-x64');
    expect(resolveRuntimeTarget('linux', 'arm64')?.key).toBe('linux-arm64');
    expect(resolveRuntimeTarget('darwin', 'x64')?.key).toBe('darwin-x64');
    expect(resolveRuntimeTarget('darwin', 'arm64')?.key).toBe('darwin-arm64');
    expect(resolveRuntimeTarget('win32', 'x64')?.key).toBe('win32-x64');
  });

  test('rejects unsupported platforms, arches, and pairs', () => {
    expect(resolveRuntimeTarget('freebsd', 'x64')).toBeUndefined();
    expect(resolveRuntimeTarget('linux', 'ia32')).toBeUndefined();
    expect(resolveRuntimeTarget('win32', 'arm64')).toBeUndefined();
  });
});

describe('RUNTIME_ASSETS', () => {
  test('pins the release and selects the right executable', () => {
    expect(PYTHON_STANDALONE_VERSION).toBe('3.12.16');
    expect(PYTHON_STANDALONE_RELEASE).toBe('20261110');
    expect(Object.keys(RUNTIME_ASSETS)).toHaveLength(5);
    for (const entry of Object.values(RUNTIME_ASSETS)) {
      expect(entry.url).toContain(PYTHON_STANDALONE_RELEASE);
      expect(entry.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(RUNTIME_ASSETS['win32-x64'].pythonPath).toBe('python/python.exe');
    expect(RUNTIME_ASSETS['linux-x64'].pythonPath).toBe('python/bin/python3');
  });
});

describe('ensureStandalonePython', () => {
  test('returns an existing runtime without downloading', async () => {
    let downloads = 0;
    const result = await ensureStandalonePython(
      baseDeps({
        exists: async () => true,
        download: async () => {
          downloads += 1;
        },
      }),
    );

    expect(result).toEqual({ ok: true, python: PYTHON, cacheDir: '/cache' });
    expect(downloads).toBe(0);
  });

  test('downloads, verifies, extracts, and returns the interpreter', async () => {
    let probes = 0;
    const calls: string[] = [];
    const logs: string[] = [];
    const result = await ensureStandalonePython(
      baseDeps({
        exists: async () => {
          probes += 1;
          return probes > 1;
        },
        download: async (url, dest) => {
          calls.push(`download ${url} ${dest}`);
        },
        sha256: async (path) => {
          calls.push(`sha ${path}`);
          return RUNTIME_ASSETS['linux-x64'].sha256.toUpperCase();
        },
        extract: async (archive, dest) => {
          calls.push(`extract ${archive} ${dest}`);
        },
        log: (line) => logs.push(line),
      }),
    );

    expect(result).toEqual({ ok: true, python: PYTHON, cacheDir: '/cache' });
    expect(calls).toEqual([
      `download ${RUNTIME_ASSETS['linux-x64'].url} /cache/linux-x64.tar.gz`,
      'sha /cache/linux-x64.tar.gz',
      'extract /cache/linux-x64.tar.gz /cache',
    ]);
    expect(logs.some((l) => l.includes('downloading'))).toBe(true);
    expect(logs.some((l) => l.includes('extracting'))).toBe(true);
    expect(logs.some((l) => l.includes('ready'))).toBe(true);
  });

  test('rejects a checksum mismatch', async () => {
    const result = await ensureStandalonePython(
      baseDeps({ sha256: async () => 'deadbeef' }),
    );

    expect(result).toEqual({
      ok: false,
      step: 'checksum',
      error: 'SHA-256 mismatch for linux-x64 runtime',
    });
  });

  test('reports a download failure', async () => {
    const result = await ensureStandalonePython(
      baseDeps({
        download: async () => {
          throw new Error('network down');
        },
      }),
    );

    expect(result).toEqual({ ok: false, step: 'download', error: 'network down' });
  });

  test('stringifies a download failure', async () => {
    const result = await ensureStandalonePython(
      baseDeps({
        download: async () => {
          throw 'nope';
        },
      }),
    );

    expect(result).toEqual({ ok: false, step: 'download', error: 'nope' });
  });

  test('reports a hashing failure', async () => {
    const result = await ensureStandalonePython(
      baseDeps({
        sha256: async () => {
          throw new Error('read failed');
        },
      }),
    );

    expect(result).toEqual({ ok: false, step: 'checksum', error: 'read failed' });
  });

  test('stringifies a hashing failure', async () => {
    const result = await ensureStandalonePython(
      baseDeps({
        sha256: async () => {
          throw 'hash nope';
        },
      }),
    );

    expect(result).toEqual({ ok: false, step: 'checksum', error: 'hash nope' });
  });

  test('reports an extraction failure', async () => {
    const result = await ensureStandalonePython(
      baseDeps({
        extract: async () => {
          throw new Error('tar failed');
        },
      }),
    );

    expect(result).toEqual({ ok: false, step: 'extract', error: 'tar failed' });
  });

  test('stringifies an extraction failure', async () => {
    const result = await ensureStandalonePython(
      baseDeps({
        extract: async () => {
          throw 'tar nope';
        },
      }),
    );

    expect(result).toEqual({ ok: false, step: 'extract', error: 'tar nope' });
  });

  test('reports a missing interpreter after extraction', async () => {
    const result = await ensureStandalonePython(baseDeps({ exists: async () => false }));

    expect(result).toEqual({
      ok: false,
      step: 'verify',
      error: `standalone Python missing at ${PYTHON}`,
    });
  });

  test('rejects an unknown target key', async () => {
    const result = await ensureStandalonePython(
      baseDeps({ target: { platform: 'linux', arch: 'x64', key: 'linux-nope' } }),
    );

    expect(result).toEqual({
      ok: false,
      step: 'target',
      error: 'unsupported runtime target linux-nope',
    });
  });

  test('treats a throwing existence probe as missing', async () => {
    let probes = 0;
    const result = await ensureStandalonePython(
      baseDeps({
        exists: async () => {
          probes += 1;
          if (probes === 1) throw new Error('EACCES');
          return true;
        },
      }),
    );

    expect(result.ok).toBe(true);
  });

  test('treats a throwing verification probe as missing', async () => {
    const result = await ensureStandalonePython(
      baseDeps({
        exists: async () => {
          throw new Error('EACCES');
        },
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.step).toBe('verify');
  });
});
