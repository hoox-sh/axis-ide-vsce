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

import { BETA_KEY_COPY } from './slots';

/** Presence labels for StatusBar — never key material. */
export type SecretPresence = 'set' | 'missing';

export type SecretStatusLabel = {
  /** Compact StatusBar text (set/missing marks only). */
  text: string;
  /** Multi-line tooltip with set/missing words only. */
  tooltip: string;
};

/**
 * During open beta an absent key is optional, not an error. Keep the word
 * "missing" out of the tooltip so the status bar never reads as broken.
 */
function presenceWord(presence: SecretPresence): string {
  return presence === 'set' ? 'set' : 'not set — optional during open beta';
}

/**
 * Pure StatusBar label helper — unit-tested; never embeds secret values.
 * Compact marks: W✓/W· and P✓/P· for worker / pro.
 */
export function formatSecretStatus(
  worker: SecretPresence,
  pro: SecretPresence,
): SecretStatusLabel {
  const wMark = worker === 'set' ? 'W✓' : 'W·';
  const pMark = pro === 'set' ? 'P✓' : 'P·';
  return {
    text: `$(graph) AXIS ${wMark} ${pMark}`,
    tooltip: `AXIS IDE\nWorker key: ${presenceWord(worker)}\nPro key: ${presenceWord(pro)}\n${BETA_KEY_COPY}`,
  };
}
