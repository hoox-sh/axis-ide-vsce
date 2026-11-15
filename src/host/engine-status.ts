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

/** Status-bar presentation for the managed local engine. */

import type { LocalEngineStatus } from '../run/local-engine';
import type { EngineMode } from './engine-choice';

export type EngineStatusView = {
  show: boolean;
  text: string;
  tooltip: string;
};

/** Hide the item unless local mode is selected or the engine is active. */
export function engineStatusView(
  status: LocalEngineStatus | undefined,
  mode: EngineMode,
): EngineStatusView {
  const current = status ?? ({ state: 'stopped' } as const);
  if (mode !== 'local' && current.state === 'stopped') {
    return { show: false, text: '', tooltip: '' };
  }
  switch (current.state) {
    case 'ready':
      return {
        show: true,
        text: '$(check) PYNE local',
        tooltip: `Local engine ready at ${current.endpoint}`,
      };
    case 'starting':
      return {
        show: true,
        text: '$(sync~spin) PYNE local',
        tooltip: 'Local engine starting…',
      };
    case 'error':
      return {
        show: true,
        text: '$(error) PYNE local',
        tooltip: `Local engine error: ${current.error}`,
      };
    default:
      return {
        show: true,
        text: '$(circle-outline) PYNE local',
        tooltip: 'Local engine stopped. Click for status.',
      };
  }
}
