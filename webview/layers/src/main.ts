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
 * AXIS Layers webview on the shared runtime + studio.* protocol:
 * studio.ready → studio.init (data-less) / studio.set carrying the snapshot.
 * Open chart posts studio.action `openChart` (old `layers.openChart`).
 */

import '@axis-shared/tokens.css';
import '@axis-shared/theme.css';
import '@axis-shared/components.css';
import './style.css';
import { createStudio } from '@axis-shared/studio';
import { paintLayers, queryLayersDom } from './render';
import { decodeLayersSet, encodeLayersOpenChart, encodeLayersReady } from './protocol';
import { initialLayersView } from './state';

// Shared lifecycle runtime: owns the acquireVsCodeApi singleton, host
// message subscription, safe posting, and disposal on pagehide.
const studio = createStudio({ view: 'layers' });

function main(): void {
  const dom = queryLayersDom(document);
  paintLayers(dom, initialLayersView(), false);
  dom.open?.addEventListener('click', () => {
    studio.post(encodeLayersOpenChart());
  });
  studio.onMessage((message) => {
    const next = decodeLayersSet(message);
    if (!next) return;
    paintLayers(dom, next, true);
  });
  studio.post(encodeLayersReady());
}

main();
