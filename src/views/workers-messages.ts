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
 * Workers studio wire layer on the `studio.*` namespace of axis.webview.v1
 * (frozen Phase-1 contract). Pure — no vscode, no workers commands module.
 * Never throws. The card/snapshot model lives in the sibling pure model;
 * this module owns the studio view identity, the action-args validation,
 * the shell body, and the registration the generic provider wires.
 *
 * Host → view: `studio.init` / `studio.set` carrying
 * `{ view: 'workers', data: { cards, counts, probed } }` — the exact fields
 * the old flat `workers.init` / `workers.state` messages carried, preserved
 * verbatim. View → host: `studio.ready` and `studio.action`
 * (`probe` | `probeAll`) — the old flat payload fields move into `args`.
 */

import { axBtnHtml } from './ax-shell';
import type { StudioRegistration } from './studio-registry';
import type { WorkersStudioSnapshot } from './workers-studio-model';

/** `view` value for every Workers studio envelope — exactly `'workers'`. */
export const WORKERS_STUDIO_VIEW = 'workers';

/** VS Code view id of the Workers studio (`axis.workers`). */
export const WORKERS_STUDIO_VIEW_ID = 'axis.workers';

/* Model re-exports — one import target for the shim and the webview bridge. */
export {
  countsFromWorkerCards,
  parseWorkersStudioData,
  workersStudioSnapshot as workersStudioData,
} from './workers-studio-model';
export type {
  WorkerStudioCard,
  WorkersStudioCounts,
  WorkersStudioSnapshot,
  WorkersStudioStatus,
} from './workers-studio-model';

const MAX_ID = 64;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * Old `parseProbeId` + `encodeWorkersProbe` validation, moved onto
 * `studio.action` args: the trimmed `args.id` (or a legacy nested
 * `args.payload.id`), `/^[A-Za-z0-9._-]+$/`, capped at 64 chars. Invalid
 * probe actions are ignored, never thrown.
 */
export function workersProbeIdFromArgs(args: unknown): string | null {
  try {
    if (!isPlainObject(args)) return null;
    const idRaw = args.id ?? (isPlainObject(args.payload) ? args.payload.id : undefined);
    const id = readString(idRaw, MAX_ID);
    if (!id || !/^[A-Za-z0-9._-]+$/.test(id)) return null;
    return id;
  } catch {
    return null;
  }
}

/**
 * Trusted studio DOM for the Workers shell body — the exact markup the old
 * workers HTML builder emitted between the theme-classed `<body>` and the
 * script tag (webview JS depends on these ids/classes). Inline scripts are
 * refused by the shell; this body carries none.
 */
export function buildWorkersStudioBody(): string {
  return `<div id="workers-root" class="workers-root" data-axis-workers-host="1">
    <header class="workers-root__header">
      <h1 class="workers-root__title">
        <svg class="workers-mark" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <rect x="2.5" y="3" width="11" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"></rect>
          <path d="M5 8h6M8 5.5v5" fill="none" stroke="currentColor" stroke-width="1.2"></path>
        </svg>
        Workers
      </h1>
      <p class="workers-phase" id="workers-phase">Idle — not probed</p>
      <p class="workers-counts" id="workers-counts">0 healthy · 0 degraded · 0 down · 0 unknown</p>
      ${axBtnHtml({ id: 'workers-probe-all', label: 'Probe all', className: 'workers-probe-all' })}
      <p class="workers-live" id="workers-live" aria-live="polite"></p>
    </header>
    <div id="workers-cards" class="workers-cards"></div>
  </div>`;
}

/** Host behavior the Workers studio registration wires behind `studio.action`. */
export interface WorkersStudioHandlers {
  /** `studio.action probe` — probe one worker id. */
  probe(id: string): void | Promise<void>;
  /** `studio.action probeAll` — probe every catalog worker. */
  probeAll(): void | Promise<void>;
  /** Current studio state — feeds the `studio.init` handshake ack. */
  state(): WorkersStudioSnapshot;
}

/**
 * Build the Workers `StudioRegistration` (enhancement plan §5 Phase 2).
 * Pure data + dispatch: the shim supplies the vscode-backed handlers, the
 * generic provider owns the shell, the ready handshake, and encoding.
 */
export function workersStudioRegistration(
  handlers: WorkersStudioHandlers,
): StudioRegistration {
  return {
    id: WORKERS_STUDIO_VIEW,
    title: 'Workers',
    viewId: WORKERS_STUDIO_VIEW_ID,
    retainContextWhenHidden: true,
    buildBody: buildWorkersStudioBody,
    actions: {
      probe: async (args) => {
        const id = workersProbeIdFromArgs(args);
        if (!id) return;
        await handlers.probe(id);
        handlers.state();
      },
      probeAll: async () => {
        await handlers.probeAll();
        handlers.state();
      },
    },
    restore: () => handlers.state(),
  };
}
