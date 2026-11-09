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

import { describe, expect, test } from 'bun:test';
import { proKeyPromptCopy, workerKeyPromptCopy } from './prompts';
import { BETA_KEY_COPY } from './slots';

describe('key prompt copy', () => {
  test('both prompt builders lead with the shared BETA_KEY_COPY', () => {
    const worker = workerKeyPromptCopy();
    const pro = proKeyPromptCopy();
    for (const copy of [worker, pro]) {
      expect(copy.prompt.startsWith(BETA_KEY_COPY)).toBe(true);
      expect(copy.prompt).toContain(BETA_KEY_COPY);
      expect(copy.placeHolder).toContain('optional during open beta');
    }
    // One shared string — do not paraphrase per surface.
    expect(worker.prompt).toContain(pro.prompt.slice(0, BETA_KEY_COPY.length));
  });

  test('keeps the Worker / Pro key shapes in their own prompts', () => {
    const worker = workerKeyPromptCopy();
    const pro = proKeyPromptCopy();
    expect(worker.title).toContain('Worker');
    expect(worker.prompt).toContain('pn_');
    expect(pro.title).toContain('Pro');
    expect(pro.prompt).toContain('pyn_');
  });
});
