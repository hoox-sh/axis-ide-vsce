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
 * Input-box copy for the Worker / Pro key commands.
 * Pure (no `vscode` import) so unit tests can assert the beta copy is shared.
 */

import { BETA_KEY_COPY } from './slots';

export interface KeyPromptCopy {
  /** `InputBoxOptions.title`. */
  title: string;
  /** `InputBoxOptions.prompt` — leads with the shared beta copy. */
  prompt: string;
  /** `InputBoxOptions.placeHolder`. */
  placeHolder: string;
}

export function workerKeyPromptCopy(): KeyPromptCopy {
  return {
    title: 'AXIS Worker API Key',
    prompt: `${BETA_KEY_COPY} Paste a Worker key (pn_ + 48 hex) to use one; empty clears. SecretStorage only.`,
    placeHolder: 'pn_… (optional during open beta)',
  };
}

export function proKeyPromptCopy(): KeyPromptCopy {
  return {
    title: 'AXIS Pro API Key',
    prompt: `${BETA_KEY_COPY} Paste a PYNE Pro key (pyn_…) to use one; empty clears. SecretStorage only.`,
    placeHolder: 'pyn_… (optional during open beta)',
  };
}
