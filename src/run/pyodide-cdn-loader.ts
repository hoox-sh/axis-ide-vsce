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
 * Fetch the tiny `pyodide.mjs` loader into a cache dir, then `loadPyodide`
 * with `indexURL` on the official CDN so Wasm/stdlib stay out of the VSIX.
 */

import { LOCAL_PYODIDE_VERSION, PYODIDE_CDN_INDEX } from '../host/pyodide-profile';

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

export type PyodideCdnLoaderDeps = {
  fetchImpl: CdnFetchLike;
  mkdir: (dir: string) => Promise<void>;
  writeFile: (path: string, data: Uint8Array) => Promise<void>;
  importModule: (fileUrl: string) => Promise<{
    loadPyodide: (opts: { indexURL: string }) => Promise<PyodideCdnRuntime>;
  }>;
  joinPath: (...parts: string[]) => string;
  toFileUrl: (fsPath: string) => string;
  /** When true, skip re-fetching `pyodide.mjs` (airplane-mode after first cache). */
  exists?: (path: string) => Promise<boolean> | boolean;
};

/** Download `pyodide.mjs` (not Wasm) then boot with CDN `indexURL`. */
export async function loadPyodideFromCdn(
  cacheDir: string,
  deps: PyodideCdnLoaderDeps,
  indexURL: string = PYODIDE_CDN_INDEX,
): Promise<PyodideCdnRuntime> {
  const dir = String(cacheDir ?? '').trim();
  if (!dir) throw new Error('Pyodide CDN cache directory is empty');
  const index = String(indexURL ?? '').trim() || PYODIDE_CDN_INDEX;
  const base = index.endsWith('/') ? index : `${index}/`;
  const dest = deps.joinPath(dir, `pyodide-${LOCAL_PYODIDE_VERSION}.mjs`);
  let cached = false;
  if (deps.exists) {
    try {
      cached = (await deps.exists(dest)) === true;
    } catch {
      cached = false;
    }
  }
  if (!cached) {
    const loaderUrl = `${base}pyodide.mjs`;
    const res = await deps.fetchImpl(loaderUrl);
    if (!res.ok) {
      throw new Error(`Pyodide loader HTTP ${res.status} at ${loaderUrl}`);
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength < 16) {
      throw new Error(`Pyodide loader too small (${bytes.byteLength} bytes) at ${loaderUrl}`);
    }
    await deps.mkdir(dir);
    await deps.writeFile(dest, bytes);
  }
  const mod = await deps.importModule(deps.toFileUrl(dest));
  if (typeof mod?.loadPyodide !== 'function') {
    throw new Error('pyodide.mjs did not export loadPyodide');
  }
  return mod.loadPyodide({ indexURL: base });
}
