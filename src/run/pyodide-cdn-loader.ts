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
 * Boot Pyodide from the copy shipped in the VSIX (`vendor/pyodide/<version>/`),
 * falling back to a `globalStorage` cache filled from the official CDN when the
 * bundle is missing (dev tree without `bun run vendor:pyodide`).
 *
 * Node's Pyodide loader resolves `indexURL` with `path.resolve`, so a remote
 * `https://…` value turns into `<cwd>/https:/…` and the asm loader fails with
 * `Cannot find module '<cwd>/https:/…/pyodide.asm.js'`. `indexURL` must always
 * be a local directory; `micropip` wheels still come from the CDN.
 */

import {
  PYODIDE_BOOT_FILES,
  PYODIDE_CDN_INDEX,
  type PyodideBootFile,
} from '../host/pyodide-profile';

/** Narrow `loadPyodide` result (kept here to avoid a cycle with the calculator). */
export type PyodideCdnRuntime = {
  runPython: (code: string) => unknown;
  runPythonAsync?: (code: string) => Promise<unknown>;
};

export type CdnFetchLike = (url: string) => Promise<{
  ok: boolean;
  status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

export type PyodideLoadDeps = {
  fetchImpl: CdnFetchLike;
  mkdir: (dir: string) => Promise<void>;
  writeFile: (path: string, data: Uint8Array) => Promise<void>;
  importModule: (fileUrl: string) => Promise<{
    loadPyodide: (opts: { indexURL: string; packageCacheDir?: string }) => Promise<PyodideCdnRuntime>;
  }>;
  joinPath: (...parts: string[]) => string;
  toFileUrl: (fsPath: string) => string;
  /** When true, skip re-fetching a file (airplane-mode after first cache). */
  exists?: (path: string) => Promise<boolean> | boolean;
  /** Optional progress line (host wires this to the AXIS Run output channel). */
  log?: (message: string) => void;
};

export type PyodideBootOptions = {
  /** Writable dir for downloaded boot files and micropip wheels (`globalStorage`). */
  cacheDir: string;
  /** Read-only dir shipped in the VSIX; wins when it holds every boot file. */
  bundledDir?: string;
  /** CDN base used only when the bundled copy is missing. */
  downloadBase?: string;
};

function withTrailingSlash(dir: string): string {
  return dir.endsWith('/') || dir.endsWith('\\') ? dir : `${dir}/`;
}

async function isCached(deps: PyodideLoadDeps, path: string): Promise<boolean> {
  if (!deps.exists) return false;
  try {
    return (await deps.exists(path)) === true;
  } catch {
    return false;
  }
}

async function bundleComplete(dir: string, deps: PyodideLoadDeps): Promise<boolean> {
  if (!dir) return false;
  for (const file of PYODIDE_BOOT_FILES) {
    if (!(await isCached(deps, deps.joinPath(dir, file.name)))) return false;
  }
  return true;
}

async function ensureAsset(
  dir: string,
  file: PyodideBootFile,
  base: string,
  deps: PyodideLoadDeps,
): Promise<string> {
  const dest = deps.joinPath(dir, file.name);
  if (await isCached(deps, dest)) {
    deps.log?.(`pyodide: cached ${file.name}`);
    return dest;
  }
  const url = `${base}${file.name}`;
  const res = await deps.fetchImpl(url);
  if (!res.ok) {
    throw new Error(`Pyodide ${file.name} HTTP ${res.status} at ${url}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength < file.minBytes) {
    throw new Error(`Pyodide ${file.name} too small (${bytes.byteLength} bytes) at ${url}`);
  }
  await deps.writeFile(dest, bytes);
  deps.log?.(`pyodide: fetched ${file.name} (${bytes.byteLength} bytes) from ${url}`);
  return dest;
}

/**
 * Boot Pyodide from the bundled copy when complete, else from a CDN-filled
 * cache. The runtime `indexURL` is always a local directory; `packageCacheDir`
 * always points at the writable cache so micropip never writes into the
 * extension install dir.
 */
export async function loadPyodideRuntime(
  opts: PyodideBootOptions,
  deps: PyodideLoadDeps,
): Promise<PyodideCdnRuntime> {
  const cacheDir = String(opts.cacheDir ?? '').trim();
  if (!cacheDir) throw new Error('Pyodide cache directory is empty');
  const bundledDir = String(opts.bundledDir ?? '').trim();
  const index = String(opts.downloadBase ?? '').trim() || PYODIDE_CDN_INDEX;
  const base = withTrailingSlash(index);

  await deps.mkdir(cacheDir);
  let indexDir: string;
  if (await bundleComplete(bundledDir, deps)) {
    deps.log?.(`pyodide: bundled ${bundledDir}`);
    indexDir = bundledDir;
  } else {
    if (bundledDir) deps.log?.(`pyodide: no complete bundle at ${bundledDir} — filling ${cacheDir} from ${base}`);
    await Promise.all(PYODIDE_BOOT_FILES.map((file) => ensureAsset(cacheDir, file, base, deps)));
    indexDir = cacheDir;
  }

  const loaderPath = deps.joinPath(indexDir, 'pyodide.mjs');
  const mod = await deps.importModule(deps.toFileUrl(loaderPath));
  if (typeof mod?.loadPyodide !== 'function') {
    throw new Error('pyodide.mjs did not export loadPyodide');
  }
  return mod.loadPyodide({
    indexURL: withTrailingSlash(indexDir),
    packageCacheDir: withTrailingSlash(cacheDir),
  });
}
