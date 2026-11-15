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
 * Standalone CPython fallback for machines without a 3.10–3.13 interpreter.
 *
 * Pinned to python-build-standalone `20261110` / CPython `3.12.16`
 * (`install_only` archives). Every asset is verified by SHA-256 before
 * extraction. The host supplies download / hash / extract / exists so this
 * module stays pure and unit-testable.
 */

/** Pinned CPython version inside the standalone build. */
export const PYTHON_STANDALONE_VERSION = '3.12.16';

/** Pinned python-build-standalone release tag. */
export const PYTHON_STANDALONE_RELEASE = '20261110';

const RELEASE_BASE = `https://github.com/astral-sh/python-build-standalone/releases/download/${PYTHON_STANDALONE_RELEASE}`;

export type RuntimePlatform = 'linux' | 'darwin' | 'win32';
export type RuntimeArch = 'x64' | 'arm64';

export type RuntimeTarget = {
  platform: RuntimePlatform;
  arch: RuntimeArch;
  /** `<platform>-<arch>` key into `RUNTIME_ASSETS`. */
  key: string;
};

export type RuntimeAsset = {
  url: string;
  sha256: string;
  /** Python executable relative to the extraction root. */
  pythonPath: string;
};

const asset = (name: string, sha256: string): RuntimeAsset => ({
  url: `${RELEASE_BASE}/${name}`,
  sha256,
  pythonPath: name.includes('windows') ? 'python/python.exe' : 'python/bin/python3',
});

export const RUNTIME_ASSETS: Record<string, RuntimeAsset> = {
  'linux-x64': asset(
    'cpython-3.12.16%2B20261110-x86_64-unknown-linux-gnu-install_only.tar.gz',
    'c2f87d4b4e8db3abddb0f116c6ccfc503d0cbdbb9ee8faacddad1b679ec12e99',
  ),
  'linux-arm64': asset(
    'cpython-3.12.16%2B20261110-aarch64-unknown-linux-gnu-install_only.tar.gz',
    '4792f81750282597fb2a3389fe18b945ed2ba6aad5e45ad406d122c58cb33081',
  ),
  'darwin-x64': asset(
    'cpython-3.12.16%2B20261110-x86_64-apple-darwin-install_only.tar.gz',
    '83f2922437e6d546d0fcdb8c11f150a8e52787e8d9ea8651b1974e20908eb1bc',
  ),
  'darwin-arm64': asset(
    'cpython-3.12.16%2B20261110-aarch64-apple-darwin-install_only.tar.gz',
    'e956e60bc9465d577ef8062059aa05cd3a2665b4b8678a2ed24e432368330b8f',
  ),
  'win32-x64': asset(
    'cpython-3.12.16%2B20261110-x86_64-pc-windows-msvc-install_only.tar.gz',
    'e23fe5b16926de1d81661b1a97352e89fb167549c55a6825796ccd0f32ec7f1b',
  ),
};

/** Map Node's `process.platform` / `process.arch` to a supported target. */
export function resolveRuntimeTarget(
  platform: string,
  arch: string,
): RuntimeTarget | undefined {
  const p: RuntimePlatform | undefined =
    platform === 'linux' ? 'linux' : platform === 'darwin' ? 'darwin' : platform === 'win32' ? 'win32' : undefined;
  const a: RuntimeArch | undefined = arch === 'x64' ? 'x64' : arch === 'arm64' ? 'arm64' : undefined;
  if (!p || !a) return undefined;
  const key = `${p}-${a}`;
  if (!RUNTIME_ASSETS[key]) return undefined;
  return { platform: p, arch: a, key };
}

export type RuntimeDownloadDeps = {
  target: RuntimeTarget;
  /** Directory that will hold the extracted `python/` tree. */
  cacheDir: string;
  download: (url: string, dest: string) => Promise<void>;
  sha256: (path: string) => Promise<string>;
  extract: (archive: string, destDir: string) => Promise<void>;
  exists: (path: string) => boolean | Promise<boolean>;
  joinPath: (...parts: string[]) => string;
  log?: (line: string) => void;
};

export type RuntimeDownloadStep = 'target' | 'download' | 'checksum' | 'extract' | 'verify';

export type RuntimeDownloadResult =
  | { ok: true; python: string; cacheDir: string }
  | { ok: false; step: RuntimeDownloadStep; error: string };

async function safeExists(
  exists: RuntimeDownloadDeps['exists'],
  path: string,
): Promise<boolean> {
  try {
    return await exists(path);
  } catch {
    return false;
  }
}

/** Download, verify, and extract the pinned standalone Python. Never throws. */
export async function ensureStandalonePython(
  deps: RuntimeDownloadDeps,
): Promise<RuntimeDownloadResult> {
  const assetEntry = RUNTIME_ASSETS[deps.target.key];
  if (!assetEntry) {
    return {
      ok: false,
      step: 'target',
      error: `unsupported runtime target ${deps.target.key}`,
    };
  }

  const python = deps.joinPath(deps.cacheDir, assetEntry.pythonPath);
  if (await safeExists(deps.exists, python)) {
    deps.log?.(`standalone Python already present: ${python}`);
    return { ok: true, python, cacheDir: deps.cacheDir };
  }

  const archive = deps.joinPath(deps.cacheDir, `${deps.target.key}.tar.gz`);
  deps.log?.(`downloading Python ${PYTHON_STANDALONE_VERSION} for ${deps.target.key}`);
  try {
    await deps.download(assetEntry.url, archive);
  } catch (e) {
    return { ok: false, step: 'download', error: e instanceof Error ? e.message : String(e) };
  }

  try {
    const digest = (await deps.sha256(archive)).trim().toLowerCase();
    if (digest !== assetEntry.sha256.toLowerCase()) {
      return {
        ok: false,
        step: 'checksum',
        error: `SHA-256 mismatch for ${deps.target.key} runtime`,
      };
    }
  } catch (e) {
    return { ok: false, step: 'checksum', error: e instanceof Error ? e.message : String(e) };
  }

  deps.log?.('extracting standalone Python');
  try {
    await deps.extract(archive, deps.cacheDir);
  } catch (e) {
    return { ok: false, step: 'extract', error: e instanceof Error ? e.message : String(e) };
  }

  if (!(await safeExists(deps.exists, python))) {
    return {
      ok: false,
      step: 'verify',
      error: `standalone Python missing at ${python}`,
    };
  }

  deps.log?.(`standalone Python ready: ${python}`);
  return { ok: true, python, cacheDir: deps.cacheDir };
}
