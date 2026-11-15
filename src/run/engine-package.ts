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
 * Resolve what `AXIS: Install Local Engine` should pip-install.
 *
 * Preference order:
 * 1. `axis.engine.local.package` when the user changed it from the default.
 * 2. The backend wheel vendored in the VSIX (`media/engine/`).
 * 3. The PyPI name (`hoox-pyne-backend`) as a last-resort fallback.
 *
 * The wheel is pinned by filename/version. Its SHA-256 at vendor time was
 * `cb6823c1c8ebd25f17fc552fda1e1a3e72485dfda74d1c35919e54a333a364b1`
 * (built from `pynescript/packages/backend` at 0.7.0).
 */

import { LOCAL_ENGINE_PACKAGE } from './provision';

/** Wheel shipped in the VSIX (built from `packages/backend`). */
export const VENDORED_ENGINE_WHEEL = 'hoox_pyne_backend-0.7.0-py3-none-any.whl';

/** Directory under the extension root that holds the vendored wheel. */
export const ENGINE_WHEEL_PARTS = ['media', 'engine'] as const;

export type EnginePackageSource = 'custom' | 'vendored' | 'pypi';

export type EnginePackageResult = {
  /** PEP 508-ish spec passed to `pip install`. */
  spec: string;
  source: EnginePackageSource;
  /** Absolute wheel path when `source === 'vendored'`. */
  path?: string;
};

export type ResolveEnginePackageOptions = {
  extensionRoot: string;
  exists: (path: string) => boolean | Promise<boolean>;
  joinPath: (...parts: string[]) => string;
  /** `axis.engine.local.package` (may be empty / the default). */
  configured?: string;
};

/** Pick a custom spec, the vendored wheel, or the PyPI fallback. Never throws. */
export async function resolveLocalEnginePackage(
  opts: ResolveEnginePackageOptions,
): Promise<EnginePackageResult> {
  const configured = String(opts.configured ?? '').trim();
  if (configured && configured !== LOCAL_ENGINE_PACKAGE) {
    return { spec: configured, source: 'custom' };
  }

  const root = String(opts.extensionRoot ?? '').trim();
  if (root) {
    try {
      const wheel = opts.joinPath(root, ...ENGINE_WHEEL_PARTS, VENDORED_ENGINE_WHEEL);
      if (await opts.exists(wheel)) {
        return { spec: wheel, source: 'vendored', path: wheel };
      }
    } catch {
      // fall through to the PyPI name
    }
  }

  return { spec: LOCAL_ENGINE_PACKAGE, source: 'pypi' };
}
