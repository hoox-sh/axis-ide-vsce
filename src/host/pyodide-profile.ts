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
 * Optional Pyodide calculator profile (Task 27 / PR-15).
 *
 * Bars-in only — not stream-owning (engine redesign §5.2). Version matches the
 * AXIS PWA lock. Multi-MB Wasm is **never** shipped in this VSIX; when the flag
 * is on the host loads 0.29.5 from jsDelivr into `globalStorage`. `ready` is
 * true only after Wasm smoke (`1+1`) **and** a pynescript Runtime smoke
 * (`callable(run_script)`). Wave 1: setting default is **true**.
 */

/** Locked Pyodide runtime version (same as PWA `src/engines/catalog.ts`). */
export const LOCAL_PYODIDE_VERSION = '0.29.5';

/** Setting id in `contributes.configuration` (default **true**, Wave 1). */
export const ALLOW_PYODIDE_SETTING = 'axis.engine.allowPyodide';

/** Product default when `get(allowPyodide)` is omitted. */
export const ALLOW_PYODIDE_DEFAULT = true;

/** Origin allowed in chart CSP only when the flag is on (jsDelivr official CDN). */
export const PYODIDE_CDN_ORIGIN = 'https://cdn.jsdelivr.net';

/** Trailing-slash index URL for `loadPyodide({ indexURL })`. */
export const PYODIDE_CDN_INDEX = `${PYODIDE_CDN_ORIGIN}/pyodide/v${LOCAL_PYODIDE_VERSION}/full/`;

/** Honest missing-wheel copy (wheel is not on the Pyodide CDN). */
export const PYODIDE_PINE_WHEEL_NEXT =
  'pynescript Runtime is not installed in this Pyodide session. Micropip a trusted hoox-pyne / pynescript wheel (media/pyodide or axis.engine.pyodideWheelUrl). Numba compile, Cloudflare R2, and cron are not available in Wasm.';

/** Calculator profile descriptor — host supplies bars; engine does not own live. */
export type PyodideEngineProfile = {
  id: 'pyodide';
  kind: 'calculator';
  barsIn: true;
  streamOwning: false;
  version: typeof LOCAL_PYODIDE_VERSION;
};

export const PYODIDE_CALCULATOR_PROFILE: PyodideEngineProfile = {
  id: 'pyodide',
  kind: 'calculator',
  barsIn: true,
  streamOwning: false,
  version: LOCAL_PYODIDE_VERSION,
};

/** Coerce a raw setting value; only explicit `true` enables the flag. */
export function isPyodideAllowed(raw: unknown): boolean {
  return raw === true;
}

export type PyodideRuntimeStatus = {
  ready: boolean;
  reason: string;
  version: string;
  profile: PyodideEngineProfile;
};

export type PyodideLoadState = {
  /** True only after `loadPyodide` + smoke `1+1 === 2`. */
  wasmLoaded: boolean;
  /** True only after micropip + Runtime smoke (`callable(run_script)`). */
  runtimeReady?: boolean;
  error?: string;
};

/**
 * Probe status. Flag-off is always not ready. Flag-on is ready only after Wasm
 * and the pynescript Runtime both smoked — never just because the setting is true.
 */
export function pyodideRuntimeStatus(
  allowed: boolean,
  load?: PyodideLoadState,
): PyodideRuntimeStatus {
  if (!allowed) {
    return {
      ready: false,
      reason: `${ALLOW_PYODIDE_SETTING} is false`,
      version: LOCAL_PYODIDE_VERSION,
      profile: PYODIDE_CALCULATOR_PROFILE,
    };
  }
  if (load?.wasmLoaded === true && load.runtimeReady === true) {
    return {
      ready: true,
      reason: `Pyodide ${LOCAL_PYODIDE_VERSION} + pynescript Runtime ready (CDN ${PYODIDE_CDN_ORIGIN}; Wasm not in VSIX)`,
      version: LOCAL_PYODIDE_VERSION,
      profile: PYODIDE_CALCULATOR_PROFILE,
    };
  }
  if (load?.wasmLoaded === true && load.runtimeReady !== true) {
    const err = typeof load.error === 'string' && load.error.trim() ? load.error.trim() : '';
    return {
      ready: false,
      reason: err || PYODIDE_PINE_WHEEL_NEXT,
      version: LOCAL_PYODIDE_VERSION,
      profile: PYODIDE_CALCULATOR_PROFILE,
    };
  }
  const err = typeof load?.error === 'string' && load.error.trim() ? load.error.trim() : '';
  return {
    ready: false,
    reason:
      err ||
      `Pyodide ${LOCAL_PYODIDE_VERSION} not loaded yet — will fetch Wasm from ${PYODIDE_CDN_INDEX} into globalStorage (not shipped in this VSIX)`,
    version: LOCAL_PYODIDE_VERSION,
    profile: PYODIDE_CALCULATOR_PROFILE,
  };
}

/** Run-output banner: local wheel, source bytes uploaded = 0. */
export function formatPyodideRunBanner(wheelName = 'hoox_pyne'): string {
  const wheel = String(wheelName || 'hoox_pyne').trim() || 'hoox_pyne';
  return `engine=pyodide wheel=${wheel} uploaded=0`;
}
