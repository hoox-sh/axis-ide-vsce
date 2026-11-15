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
 * Pick the engine for a run. `auto` keeps the old Pyodide/server default until
 * a local engine is actually available (provisioned venv or a custom command).
 */

import { LOCAL_ENGINE_DEFAULT_COMMAND } from '../run/local-engine';

export type EngineMode = 'auto' | 'server' | 'local' | 'pyodide';

export type EngineChoiceInput = {
  mode: EngineMode;
  allowPyodide: boolean;
  /** `axis.engine.local.command` (default `pyne-backend`). */
  localCommand: string;
  /** True when the extension-owned venv console script exists. */
  localProvisioned: boolean;
};

/** Resolve `auto`; explicit modes pass through unchanged. */
export function chooseEngine(input: EngineChoiceInput): Exclude<EngineMode, 'auto'> {
  if (input.mode !== 'auto') return input.mode;
  const command =
    String(input.localCommand ?? '').trim() || LOCAL_ENGINE_DEFAULT_COMMAND;
  if (input.localProvisioned || command !== LOCAL_ENGINE_DEFAULT_COMMAND) {
    return 'local';
  }
  return input.allowPyodide ? 'pyodide' : 'server';
}
