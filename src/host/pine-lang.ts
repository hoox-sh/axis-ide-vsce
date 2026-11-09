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
 * PYNE language when-clauses for contributes.menus / keybindings.
 * Keep in sync with package.json. hoox-sh.pyne registers id `pinescript`
 * for `.pyne` / `.pine` / `.pinev5` / `.pinev6` / `.pinescript`.
 * Extname fallbacks still match those files if the language id is unset.
 */

import { PINE_FILE_SUFFIXES, PINE_LANGUAGE_ID } from './open-chart';

/** Context key: title-bar Run ↔ Stop swap. */
export const RUN_RUNNING_CONTEXT = 'axis.run.running';

function extnameWhen(): string {
  return PINE_FILE_SUFFIXES.map((suffix) => `resourceExtname == ${suffix}`).join(
    ' || ',
  );
}

/** `editorLangId` + Pine extnames (keybindings, editor/context, palette). */
export function pineEditorWhen(): string {
  return `editorLangId == ${PINE_LANGUAGE_ID} || ${extnameWhen()}`;
}

/** `resourceLangId` + Pine extnames (editor/title, explorer/context). */
export function pineResourceWhen(): string {
  return `resourceLangId == ${PINE_LANGUAGE_ID} || ${extnameWhen()}`;
}

export function pineEditorWhenNotRunning(): string {
  return `editorTextFocus && (${pineEditorWhen()}) && !${RUN_RUNNING_CONTEXT}`;
}

export function pineEditorWhenRunning(): string {
  return `editorTextFocus && (${pineEditorWhen()}) && ${RUN_RUNNING_CONTEXT}`;
}

export function pineResourceWhenNotRunning(): string {
  return `(${pineResourceWhen()}) && !${RUN_RUNNING_CONTEXT}`;
}

export function pineResourceWhenRunning(): string {
  return `(${pineResourceWhen()}) && ${RUN_RUNNING_CONTEXT}`;
}
