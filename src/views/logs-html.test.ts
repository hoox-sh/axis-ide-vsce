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
 * DEPRECATED — delete this file together with `logs-html.ts` (the agent
 * toolset cannot `git rm`). The former shell-builder assertions were
 * re-homed in `logs-messages.test.ts`; this file only pins the deprecated
 * alias to the migrated body builder.
 */

import { expect, test } from 'bun:test';
import { buildLogsWebviewHtmlBody } from './logs-html';
import { buildLogsBody } from './logs-messages';

test('deprecated logs-html re-exports the migrated body builder', () => {
  expect(buildLogsWebviewHtmlBody).toBe(buildLogsBody);
  expect(buildLogsWebviewHtmlBody()).toBe(buildLogsBody());
});
