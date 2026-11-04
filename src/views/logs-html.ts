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
 * DEPRECATED — delete this file (agent toolset cannot `git rm`).
 *
 * The Logs shell builder moved to the generic provider
 * (`registerStudioView` + `buildStudioHtml`); the body markup now lives in
 * `logs-messages.ts` (`buildLogsBody`). This alias exists only so stale
 * imports resolve and the coverage disk-check keeps seeing the file until
 * it is removed from the tree.
 */

export { buildLogsBody as buildLogsWebviewHtmlBody } from './logs-messages';
