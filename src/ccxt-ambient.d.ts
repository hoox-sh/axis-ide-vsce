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
 * Ambient declaration for the lazily-loaded ccxt module. The host compiles
 * without ccxt installed; a missing module is runtime graceful degradation
 * (`fetchCcxtHistorical` returns `{ ok: false, error: 'ccxt not available' }`).
 * Marked external in `esbuild.host.mjs` so it is never bundled.
 */
declare module 'ccxt' {
  const _: { [name: string]: unknown };
  export = _;
}
