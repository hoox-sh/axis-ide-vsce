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
 * AXIS Workers studio on the shared runtime + studio.* protocol.
 * Host posts studio.init / studio.set with data `{ cards, counts, probed }`;
 * buttons post studio.action probe / probeAll.
 */

import '@axis-shared/tokens.css';
import '@axis-shared/theme.css';
import '@axis-shared/components.css';
import './style.css';
import { createStudio } from '@axis-shared/studio';
import { setText } from '@axis-shared/dom';
import {
  WORKERS_STUDIO_VIEW,
  decodeWorkersStudioData,
  encodeWorkersProbe,
  encodeWorkersProbeAll,
  encodeWorkersReady,
  type WorkerStudioCard,
  type WorkersStudioCounts,
} from './protocol';

// Shared lifecycle runtime: owns the acquireVsCodeApi singleton, host
// message subscription, safe posting, and disposal on pagehide.
const studio = createStudio({ view: WORKERS_STUDIO_VIEW });

const SVG_NS = 'http://www.w3.org/2000/svg';

let awaitingAll = false;

function setLive(text: string): void {
  setText('workers-live', text);
}

function statusDot(): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 8 8');
  svg.setAttribute('width', '8');
  svg.setAttribute('height', '8');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('workers-pill__dot');
  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', '4');
  circle.setAttribute('cy', '4');
  circle.setAttribute('r', '3');
  circle.setAttribute('fill', 'currentColor');
  svg.append(circle);
  return svg;
}

function addLine(parent: HTMLElement, className: string, text: string): void {
  const p = document.createElement('p');
  p.className = className;
  p.textContent = text;
  parent.append(p);
}

function renderCard(card: WorkerStudioCard): HTMLElement {
  const article = document.createElement('article');
  article.className = 'workers-card';
  article.dataset.id = card.id;

  const name = document.createElement('h2');
  name.className = 'workers-card__name';
  name.textContent = card.name;
  article.append(name);

  addLine(article, 'workers-card__id', card.id);
  if (card.summary) addLine(article, 'workers-card__summary', card.summary);
  addLine(article, 'workers-card__meta', `probe ${card.probe || '—'}`);
  addLine(article, 'workers-card__meta workers-card__endpoint', card.endpoint || '—');

  const row = document.createElement('div');
  row.className = 'workers-card__row';

  const pill = document.createElement('span');
  pill.className = `workers-pill workers-pill--${card.status}`;
  pill.append(statusDot());
  pill.append(document.createTextNode(card.status));
  row.append(pill);

  if (card.latencyMs != null) {
    const latency = document.createElement('span');
    latency.className = 'workers-card__meta';
    latency.textContent = `${Math.round(card.latencyMs)} ms`;
    row.append(latency);
  }

  if (card.detail) {
    const detail = document.createElement('span');
    detail.className = 'workers-card__meta';
    detail.textContent = card.detail;
    row.append(detail);
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'workers-btn';
  button.textContent = 'Probe';
  button.setAttribute('aria-label', `Probe ${card.name}`);
  button.addEventListener('click', () => {
    studio.post(encodeWorkersProbe(card.id));
  });
  row.append(button);
  article.append(row);
  return article;
}

function renderCounts(counts: WorkersStudioCounts): void {
  setText(
    'workers-counts',
    `${counts.healthy} healthy · ${counts.degraded} degraded · ${counts.down} down · ${counts.unknown} unknown`,
  );
}

function renderCards(cards: readonly WorkerStudioCard[], probed: boolean): void {
  const host = document.getElementById('workers-cards');
  if (!host) return;
  host.replaceChildren();
  if (cards.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'workers-empty';
    empty.textContent = 'No workers in catalog.';
    host.append(empty);
    return;
  }
  for (const card of cards) host.append(renderCard(card));
  if (!probed) {
    const note = document.createElement('p');
    note.className = 'workers-empty';
    note.textContent = 'Idle — not probed';
    host.append(note);
  }
}

function applyView(
  cards: readonly WorkerStudioCard[],
  counts: WorkersStudioCounts,
  probed: boolean,
  kind: 'init' | 'set',
): void {
  setText('workers-phase', probed ? 'Last probe' : 'Idle — not probed');
  renderCounts(counts);
  renderCards(cards, probed);
  if (awaitingAll && kind === 'set') {
    awaitingAll = false;
    setLive(`Probe finished — ${counts.healthy} healthy`);
  }
}

function onHostMessage(message: unknown): void {
  const decoded = decodeWorkersStudioData(message);
  if (!decoded) return;
  applyView(decoded.cards, decoded.counts, decoded.probed, decoded.kind);
}

function bindProbeAll(): void {
  const button = document.getElementById('workers-probe-all');
  if (!(button instanceof HTMLButtonElement)) return;
  button.addEventListener('click', () => {
    awaitingAll = true;
    setLive('Probing…');
    studio.post(encodeWorkersProbeAll());
  });
}

function main(): void {
  bindProbeAll();
  studio.onMessage(onHostMessage);
  studio.post(encodeWorkersReady());
}

main();
