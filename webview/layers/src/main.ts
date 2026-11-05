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
 * AXIS Layers webview on the shared runtime + studio.* protocol.
 * Built with ax-* components: the top header uses ax-header, each section
 * is an ax-panel, rows are ax-row, and empty sections use ax-empty.
 * Open chart posts studio.action `openChart` (old `layers.openChart`).
 */

import '@axis-shared/tokens.css';
import '@axis-shared/theme.css';
import '@axis-shared/motion.css';
import '@axis-shared/components.css';
import './style.css';
import { header } from '@axis-shared/components';
import { createStudio } from '@axis-shared/studio';
import { paintLayers, queryLayersDom } from './render';
import { decodeLayersSet, encodeLayersOpenChart, encodeLayersReady } from './protocol';
import { initialLayersView } from './state';

const LAYERS_VIEW = 'layers';

// Shared lifecycle runtime: owns the acquireVsCodeApi singleton, host
// message subscription, safe posting, and disposal on pagehide.
const studio = createStudio({ view: LAYERS_VIEW });

function buildShell(): DocumentFragment {
  const fragment = document.createDocumentFragment();

  const titleHeader = header({ title: 'Layers', className: 'layers-header__titlebar' });

  const summary = document.createElement('p');
  summary.id = 'layers-summary';
  summary.className = 'layers-summary';

  const open = document.createElement('button');
  open.type = 'button';
  open.id = 'layers-open-chart';
  open.className = 'layers-open';
  open.textContent = 'Open chart';

  const headerEl = document.createElement('div');
  headerEl.className = 'layers-header';
  headerEl.append(titleHeader, summary, open);

  const live = document.createElement('p');
  live.id = 'layers-live';
  live.className = 'layers-live';
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');

  const sections = document.createElement('div');
  sections.id = 'layers-sections';
  sections.className = 'layers-sections';

  fragment.append(headerEl, live, sections);
  return fragment;
}

function main(): void {
  const root = document.getElementById('layers-root');
  if (!root) return;
  root.replaceChildren();
  root.append(buildShell());

  const dom = queryLayersDom(root);
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
