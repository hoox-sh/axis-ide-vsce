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
 * Resolve a trusted pynescript / hoox-pyne wheel for Pyodide micropip.
 * Wasm stays on the CDN; this artifact is a pure-Python wheel.
 */

export const PYODIDE_WHEEL_SETTING = 'axis.engine.pyodideWheelUrl';

export const VENDORED_PYNE_WHEEL = 'hoox_pyne-0.6.29-py3-none-any.whl';
export const VENDORED_PYNESCRIPT_WHEEL = 'pynescript-0.6.29-py3-none-any.whl';

/** Stem used in `engine=pyodide wheel=… uploaded=0`. */
export function pyodideWheelBannerName(fileName = VENDORED_PYNE_WHEEL): string {
  const base =
    String(fileName || VENDORED_PYNE_WHEEL)
      .trim()
      .split(/[/\\]/)
      .pop() || VENDORED_PYNE_WHEEL;
  return base.replace(/-py3-none-any\.whl$/i, '').replace(/\.whl$/i, '') || 'hoox_pyne';
}
export const VENDORED_ANTLR_WHEEL = 'antlr4_python3_runtime-4.13.2-py3-none-any.whl';
export const VENDORED_RUNTIME_PY = 'pynescript_runtime.py';

export type PyodideAssetHit = {
  ok: true;
  wheelUrl: string;
  antlrUrl?: string;
  runtimePath?: string;
  searched: string[];
};

export type PyodideAssetMiss = {
  ok: false;
  missing: string;
  searched: string[];
};

export type PyodideAssetResult = PyodideAssetHit | PyodideAssetMiss;

export type ResolvePyodideAssetsOpts = {
  extensionRoot?: string;
  cwd?: string;
  wheelUrl?: string;
  exist: (absPath: string) => boolean;
  joinPath: (...parts: string[]) => string;
  toFileUrl: (absPath: string) => string;
};

function trimSlash(value: string): string {
  return value.replace(/[/\\]+$/, '');
}

function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isFileUrl(value: string): boolean {
  return /^file:/i.test(value);
}

/** Honest missing-artifact line for status / run errors. */
export function pyodideWheelMissingReason(searched: string[]): string {
  const list = searched.length > 0 ? searched.join('; ') : '(none)';
  return `Trusted pynescript/hoox-pyne wheel not found. Searched: ${list}. Vendor media/pyodide/${VENDORED_PYNE_WHEEL} or set ${PYODIDE_WHEEL_SETTING}. Wasm is not this artifact.`;
}

function siblingCandidates(joinPath: ResolvePyodideAssetsOpts['joinPath'], cwd: string): string[] {
  const root = trimSlash(cwd);
  const parent = joinPath(root, '..');
  return [
    joinPath(parent, 'pynescript', 'dist', VENDORED_PYNE_WHEEL),
    joinPath(parent, 'axis', 'vendor', VENDORED_PYNESCRIPT_WHEEL),
    joinPath(parent, 'axis', 'public', 'vendor', VENDORED_PYNESCRIPT_WHEEL),
    joinPath(parent, 'axis', 'public', 'vendor', VENDORED_ANTLR_WHEEL),
  ];
}

/** Resolve wheel + optional antlr + runtime.py. Never throws. */
export function resolvePyodideAssets(opts: ResolvePyodideAssetsOpts): PyodideAssetResult {
  const searched: string[] = [];
  const configured = typeof opts.wheelUrl === 'string' ? opts.wheelUrl.trim() : '';
  if (configured) {
    searched.push(configured);
    if (isRemoteUrl(configured) || isFileUrl(configured)) {
      return { ok: true, wheelUrl: configured, searched };
    }
    if (opts.exist(configured)) {
      return { ok: true, wheelUrl: opts.toFileUrl(configured), searched };
    }
  }

  const roots: string[] = [];
  if (opts.extensionRoot && opts.extensionRoot.trim()) roots.push(trimSlash(opts.extensionRoot.trim()));
  if (opts.cwd && opts.cwd.trim()) roots.push(trimSlash(opts.cwd.trim()));

  const wheelFiles = [VENDORED_PYNE_WHEEL, VENDORED_PYNESCRIPT_WHEEL];
  let wheelUrl: string | undefined;
  let antlrUrl: string | undefined;
  let runtimePath: string | undefined;

  for (const root of roots) {
    for (const name of wheelFiles) {
      const p = opts.joinPath(root, 'media', 'pyodide', name);
      searched.push(p);
      if (!wheelUrl && opts.exist(p)) wheelUrl = opts.toFileUrl(p);
    }
    const antlr = opts.joinPath(root, 'media', 'pyodide', VENDORED_ANTLR_WHEEL);
    searched.push(antlr);
    if (!antlrUrl && opts.exist(antlr)) antlrUrl = opts.toFileUrl(antlr);
    const runtime = opts.joinPath(root, 'media', 'pyodide', VENDORED_RUNTIME_PY);
    searched.push(runtime);
    if (!runtimePath && opts.exist(runtime)) runtimePath = runtime;
  }

  if (opts.cwd && opts.cwd.trim()) {
    for (const p of siblingCandidates(opts.joinPath, opts.cwd.trim())) {
      searched.push(p);
      const base = p.replace(/\\/g, '/');
      if (!wheelUrl && (base.endsWith(VENDORED_PYNE_WHEEL) || base.endsWith(VENDORED_PYNESCRIPT_WHEEL)) && opts.exist(p)) {
        wheelUrl = opts.toFileUrl(p);
      }
      if (!antlrUrl && base.endsWith(VENDORED_ANTLR_WHEEL) && opts.exist(p)) {
        antlrUrl = opts.toFileUrl(p);
      }
    }
  }

  if (!wheelUrl) {
    return { ok: false, missing: pyodideWheelMissingReason(searched), searched };
  }
  const hit: PyodideAssetHit = { ok: true, wheelUrl, searched };
  if (antlrUrl) hit.antlrUrl = antlrUrl;
  if (runtimePath) hit.runtimePath = runtimePath;
  return hit;
}
