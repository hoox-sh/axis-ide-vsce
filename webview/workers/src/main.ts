// Copyright (C) 2026 jango_blockchained
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * AXIS Workers studio on the shared runtime + studio.* protocol.
 * Host posts studio.init / studio.set with data `{ cards, counts, probed }`;
 * buttons post studio.action probe / probeAll.
 */

import '@axis-shared/tokens.css';
import '@axis-shared/theme.css';
import '@axis-shared/motion.css';
import '@axis-shared/components.css';
import './style.css';
import { createStudio } from '@axis-shared/studio';
import { setText } from '@axis-shared/dom';
import {
  capsule,
  empty,
  header,
  panel,
  row,
  statusDot,
  type StatusDotState,
} from '@axis-shared/components';
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

let awaitingAll = false;

/** Map a worker status to a shared status-dot state. */
function statusState(status: string, probed: boolean): StatusDotState {
  switch (status) {
    case 'healthy':
      return probed ? 'live' : 'ok';
    case 'degraded':
      return 'warn';
    case 'down':
      return 'err';
    default:
      return 'idle';
  }
}

function span(className: string, text: string): HTMLSpanElement {
  const node = document.createElement('span');
  node.className = className;
  node.textContent = text;
  return node;
}

function renderMetaRow(className: string, label: string, value: string): HTMLElement {
  return row({
    className,
    children: [span('workers-key', label), span('workers-value', value)],
  });
}

function renderProbeButton(card: WorkerStudioCard): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'workers-action-btn';
  button.textContent = 'Probe';
  button.setAttribute('aria-label', `Probe ${card.name}`);
  button.addEventListener('click', () => {
    studio.post(encodeWorkersProbe(card.id));
  });
  return button;
}

function renderCard(card: WorkerStudioCard, probed: boolean): HTMLElement {
  const children: (HTMLElement | null)[] = [
    row({
      className: 'workers-card__title-row',
      children: [span('workers-card__name', card.name), capsule({ code: 'ID', value: card.id })],
    }),
  ];

  if (card.summary) {
    children.push(renderMetaRow('workers-card__summary-row', 'Summary', card.summary));
  }
  children.push(renderMetaRow('workers-card__endpoint-row', 'Endpoint', card.endpoint || '—'));
  children.push(renderMetaRow('workers-card__probe-row', 'Probe', card.probe || '—'));

  const statusChildren: (HTMLElement | null)[] = [
    statusDot({
      label: card.status,
      state: statusState(card.status, probed),
    }),
  ];
  if (card.latencyMs != null) {
    statusChildren.push(capsule({ code: 'LAT', value: `${Math.round(card.latencyMs)} ms` }));
  }
  if (card.detail) {
    statusChildren.push(capsule({ code: 'DET', value: card.detail }));
  }

  children.push(
    row({
      className: 'workers-card__status-row',
      children: statusChildren,
      actions: [renderProbeButton(card)],
    }),
  );

  return panel({ children });
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
    host.append(empty({ hint: 'No workers in catalog.' }));
    return;
  }

  host.append(header({ title: 'Worker catalog', count: cards.length }));

  const list = document.createElement('div');
  list.className = 'workers-card-list';
  for (const card of cards) {
    list.append(renderCard(card, probed));
  }
  host.append(list);

  if (!probed) {
    host.append(empty({ hint: 'Idle — not probed' }));
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
    setText('workers-live', `Probe finished — ${counts.healthy} healthy`);
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
    setText('workers-live', 'Probing…');
    studio.post(encodeWorkersProbeAll());
  });
}

function main(): void {
  bindProbeAll();
  studio.onMessage(onHostMessage);
  studio.post(encodeWorkersReady());
}

main();
