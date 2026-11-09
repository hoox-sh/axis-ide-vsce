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

/** Result of Stop Run — hung `/run` vs already idle. */
export type StopRunResult = 'stopped' | 'idle';

/**
 * Abort an in-flight command AbortController without starting a new run.
 * Never throws.
 */
export function abortInflightRun(
  controller: AbortController | undefined,
): StopRunResult {
  if (!controller || controller.signal.aborted) return 'idle';
  try {
    controller.abort();
  } catch {
    // AbortController.abort is specified not to throw; still guard.
  }
  return 'stopped';
}

/** Replace the previous command-level controller (restart path). */
export function beginCommandAbortController(
  previous: AbortController | undefined,
): AbortController {
  try {
    previous?.abort();
  } catch {
    // ignore
  }
  return new AbortController();
}
