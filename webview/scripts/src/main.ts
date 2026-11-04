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
 * AXIS Scripts studio on the shared runtime + studio.* protocol.
 * Host posts studio.init / studio.set with data `{ snapshot }`; buttons
 * post studio.action run / openChart / apply; notices arrive as
 * studio.notice.
 */

import '@axis-shared/tokens.css';
import '@axis-shared/theme.css';
import '@axis-shared/components.css';
import './style.css';
import { createStudio } from '@axis-shared/studio';
import { setHidden, setText } from '@axis-shared/dom';
import {
  SCRIPTS_VIEW,
  decodeScriptsStudioData,
  decodeScriptsStudioNotice,
  encodeScriptsApply,
  encodeScriptsOpenChart,
  encodeScriptsReady,
  encodeScriptsRun,
  type ScriptRunCard,
  type ScriptSuggestion,
  type ScriptsViewSnapshot,
} from './protocol';

// Shared lifecycle runtime: owns the acquireVsCodeApi singleton, host
// message subscription, safe posting, and disposal on pagehide.
const studio = createStudio({ view: SCRIPTS_VIEW });

function setLive(text: string): void {
  const el = document.getElementById('scripts-live');
  if (!el) return;
  if (el.textContent === text) el.textContent = '';
  el.textContent = text;
}

function formatAt(at: number): string {
  if (!at) return '—';
  try {
    return new Date(at).toLocaleString();
  } catch {
    return String(at);
  }
}

function listIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'scripts-icon');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', 'M2 3h12v2H2V3zm0 4h8v2H2V7zm0 4h10v2H2v-2z');
  svg.append(path);
  return svg;
}

function renderSuggestions(rows: readonly ScriptSuggestion[]): void {
  const list = document.getElementById('scripts-suggestions');
  if (!list) return;
  list.replaceChildren();
  for (const row of rows) {
    const li = document.createElement('li');
    li.className = 'scripts-row';

    li.append(listIcon());

    const main = document.createElement('div');
    main.className = 'scripts-row__main';
    const title = document.createElement('span');
    title.className = 'scripts-row__title';
    title.textContent = row.title;
    const meta = document.createElement('span');
    meta.className = 'scripts-row__meta';
    const kind = row.kind || 'indicator';
    const category = row.category || '—';
    meta.textContent = `${kind} · ${category}`;
    main.append(title, meta);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'scripts-btn scripts-row__apply';
    button.textContent = 'Apply';
    button.dataset.id = row.id;
    button.addEventListener('click', () => {
      studio.post(encodeScriptsApply(row.id));
    });

    li.append(main, button);
    list.append(li);
  }
}

function applySnapshot(snap: ScriptsViewSnapshot): void {
  const card: ScriptRunCard | null = snap.lastRun;
  const empty = card == null;
  setHidden('scripts-empty', !empty);
  setHidden('scripts-last', empty);
  if (!empty && card) {
    setText('scripts-title', card.title || 'Script');
    setText('scripts-symbol', card.symbol || '—');
    setText('scripts-interval', card.interval || '—');
    setText('scripts-mode', card.mode || '—');
    const status = document.getElementById('scripts-status');
    if (status) {
      status.textContent = card.status === 'error' ? 'error' : 'ok';
      status.className =
        card.status === 'error' ? 'scripts-chip scripts-chip--error' : 'scripts-chip scripts-chip--ok';
    }
    const hasError = Boolean(card.error);
    setHidden('scripts-error', !hasError);
    setHidden('scripts-error-label', !hasError);
    setText('scripts-error', card.error);
    setText('scripts-at', formatAt(card.at));
  }
  const hasEpoch = typeof snap.epoch === 'number';
  setHidden('scripts-epoch', !hasEpoch || empty);
  setHidden('scripts-epoch-label', !hasEpoch || empty);
  if (hasEpoch && snap.epoch != null) setText('scripts-epoch', String(snap.epoch));
  renderSuggestions(snap.suggestions);
}

function onHostMessage(message: unknown): void {
  const state = decodeScriptsStudioData(message);
  if (state) {
    applySnapshot(state.snapshot);
    return;
  }
  const notice = decodeScriptsStudioNotice(message);
  if (notice !== null) setLive(notice);
}

function bindClick(id: string, message: unknown, live: string | null): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', () => {
    if (live) setLive(live);
    studio.post(message);
  });
}

function main(): void {
  bindClick('scripts-run', encodeScriptsRun(), 'Run started');
  bindClick('scripts-open-chart', encodeScriptsOpenChart(), null);
  studio.onMessage(onHostMessage);
  studio.post(encodeScriptsReady());
}

main();
