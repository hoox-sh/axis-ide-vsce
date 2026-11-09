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
 * Client identity header for every outbound request to the PYNE engine and
 * AXIS Worker. The Worker trusts `X-AXIS-Client: ide` during open beta, so a
 * missing `pn_` / `pyn_` key is not an error state.
 *
 * Keep the header name/value in this one module and merge it through
 * `withAxisClientHeader` — never hard-code it at individual call sites.
 */

export const AXIS_CLIENT_HEADER = 'X-AXIS-Client';
export const AXIS_CLIENT_IDE = 'ide';

/** Frozen header pair sent on every engine / Worker request. */
export const AXIS_CLIENT_HEADERS: Readonly<Record<string, string>> = {
  [AXIS_CLIENT_HEADER]: AXIS_CLIENT_IDE,
};

/**
 * Copy caller headers and stamp the AXIS IDE client header.
 * Existing values for `X-AXIS-Client` are overwritten on purpose.
 */
export function withAxisClientHeader(
  headers: Record<string, string> = {},
): Record<string, string> {
  return { ...headers, [AXIS_CLIENT_HEADER]: AXIS_CLIENT_IDE };
}
