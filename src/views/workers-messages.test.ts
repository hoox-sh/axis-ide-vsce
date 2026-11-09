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

import { describe, expect, test } from 'bun:test';
import { htmlHasInlineScript } from '../editors/chart-html';
import { HOST_TO_VIEW, PROTOCOL_VERSION, VIEW_TO_HOST, decode, encode } from '../protocol';
import {
  WORKERS_STUDIO_VIEW,
  WORKERS_STUDIO_VIEW_ID,
  buildWorkersStudioBody,
  workersProbeIdFromArgs,
  workersStudioRegistration,
  type WorkersStudioHandlers,
} from './workers-messages';

function boom(key: string): Record<string, unknown> {
  return {
    get [key]() {
      throw new Error(`get ${key}`);
    },
  };
}

describe('workers studio identity', () => {
  test('view constants match the axis.workers view', () => {
    expect(WORKERS_STUDIO_VIEW).toBe('workers');
    expect(WORKERS_STUDIO_VIEW_ID).toBe('axis.workers');
  });
});

describe('workersProbeIdFromArgs', () => {
  test('accepts args.id and the legacy nested args.payload.id', () => {
    expect(workersProbeIdFromArgs({ id: 'pyne-pro' })).toBe('pyne-pro');
    expect(workersProbeIdFromArgs({ id: ' axis-worker ' })).toBe('axis-worker');
    expect(workersProbeIdFromArgs({ payload: { id: 'axis-worker' } })).toBe('axis-worker');
    expect(workersProbeIdFromArgs({ id: 'a', payload: { id: 'b' } })).toBe('a');
  });

  test('rejects junk ids exactly like the old probe validation', () => {
    expect(workersProbeIdFromArgs(undefined)).toBeNull();
    expect(workersProbeIdFromArgs(null)).toBeNull();
    expect(workersProbeIdFromArgs([])).toBeNull();
    expect(workersProbeIdFromArgs('pyne-pro')).toBeNull();
    expect(workersProbeIdFromArgs({})).toBeNull();
    expect(workersProbeIdFromArgs({ id: '' })).toBeNull();
    expect(workersProbeIdFromArgs({ id: 'has space' })).toBeNull();
    expect(workersProbeIdFromArgs({ id: 'nope/id' })).toBeNull();
    expect(workersProbeIdFromArgs({ id: 4 })).toBeNull();
    expect(workersProbeIdFromArgs({ payload: [] })).toBeNull();
    expect(workersProbeIdFromArgs(boom('id'))).toBeNull();
    expect(
      workersProbeIdFromArgs({
        get payload() {
          throw new Error('payload');
        },
      }),
    ).toBeNull();
  });
});

describe('buildWorkersStudioBody', () => {
  test('emits the exact ids/classes the Workers webview depends on', () => {
    const handlers: WorkersStudioHandlers = {
      probe: () => {},
      probeAll: () => {},
      state: () => ({ cards: [], counts: { healthy: 0, degraded: 0, down: 0, unknown: 0 }, probed: false }),
    };
    const body = workersStudioRegistration(handlers).buildBody?.();
    expect(body).toContain('id="workers-root"');
    expect(body).toContain('class="workers-root"');
    expect(body).toContain('data-axis-workers-host="1"');
    expect(body).toContain('id="workers-phase"');
    expect(body).toContain('id="workers-counts"');
    expect(body).toContain('id="workers-probe-all"');
    expect(body).toContain('ax-btn ax-btn--primary ax-btn--md');
    expect(body).toContain('workers-probe-all');
    expect(body).toContain('id="workers-cards"');
    expect(body).toContain('id="workers-live"');
    expect(body).toContain('Probe all');
    expect(body).toContain('Idle — not probed');
    expect(body).toContain('0 healthy · 0 degraded · 0 down · 0 unknown');
    expect(body).toContain('aria-live="polite"');
    expect(body).toContain('<svg');
    expect(body).toContain('class="workers-mark"');
    expect(body).not.toContain('webview-ui-toolkit');
    expect(body).not.toContain('vscode-elements');
    expect(htmlHasInlineScript(body ?? '')).toBe(false);
  });
});

describe('workersStudioRegistration', () => {
  function makeHandlers() {
    const calls: string[] = [];
    const handlers: WorkersStudioHandlers = {
      probe: (id) => {
        calls.push(`probe:${id}`);
      },
      probeAll: () => {
        calls.push('probeAll');
      },
      state: () => {
        calls.push('state');
        return {
          cards: [
            {
              id: 'pyne-pro',
              name: 'pyne Pro API',
              summary: '',
              probe: 'http-health',
              endpoint: '127.0.0.1:5002',
              status: 'healthy',
              latencyMs: 12,
              detail: '',
            },
          ],
          counts: { healthy: 1, degraded: 0, down: 0, unknown: 0 },
          probed: true,
        };
      },
    };
    return { handlers, calls };
  }

  test('registers the axis.workers studio with retained context', () => {
    const { handlers } = makeHandlers();
    const entry = workersStudioRegistration(handlers);
    expect(entry.id).toBe('workers');
    expect(entry.title).toBe('Workers');
    expect(entry.viewId).toBe('axis.workers');
    expect(entry.retainContextWhenHidden).toBe(true);
    expect(Object.keys(entry.actions).sort()).toEqual(['probe', 'probeAll']);
  });

  test('studio.action probe / probeAll dispatch to the handlers', async () => {
    const { handlers, calls } = makeHandlers();
    const entry = workersStudioRegistration(handlers);
    await entry.actions.probe?.({ id: ' pyne-pro ' }, { view: 'workers', action: 'probe' });
    await entry.actions.probe?.({ id: '' }, { view: 'workers', action: 'probe' });
    await entry.actions.probe?.(undefined, { view: 'workers', action: 'probe' });
    await entry.actions.probeAll?.(undefined, { view: 'workers', action: 'probeAll' });
    expect(calls).toEqual(['probe:pyne-pro', 'state', 'probeAll', 'state']);
  });

  test('restore feeds the studio.init handshake with the current snapshot', () => {
    const { handlers } = makeHandlers();
    const entry = workersStudioRegistration(handlers);
    expect(entry.restore?.()).toEqual({
      cards: [
        {
          id: 'pyne-pro',
          name: 'pyne Pro API',
          summary: '',
          probe: 'http-health',
          endpoint: '127.0.0.1:5002',
          status: 'healthy',
          latencyMs: 12,
          detail: '',
        },
      ],
      counts: { healthy: 1, degraded: 0, down: 0, unknown: 0 },
      probed: true,
    });
  });

  test('action names and data ride the studio.* envelopes verbatim', () => {
    const probeEnvelope = encode(VIEW_TO_HOST.StudioAction, {
      view: WORKERS_STUDIO_VIEW,
      action: 'probe',
      args: { id: 'pyne-pro' },
    });
    const probeAllEnvelope = encode(VIEW_TO_HOST.StudioAction, {
      view: WORKERS_STUDIO_VIEW,
      action: 'probeAll',
    });
    const data = {
      cards: [],
      counts: { healthy: 0, degraded: 0, down: 0, unknown: 0 },
      probed: false,
    };
    for (const type of [HOST_TO_VIEW.StudioInit, HOST_TO_VIEW.StudioSet]) {
      const envelope = encode(type, { view: WORKERS_STUDIO_VIEW, data });
      expect(envelope.v).toBe(PROTOCOL_VERSION);
      const decoded = decode(JSON.parse(JSON.stringify(envelope)));
      expect(decoded.ok).toBe(true);
      if (!decoded.ok) return;
      expect(decoded.envelope.type).toBe(type);
      expect(decoded.envelope.payload).toEqual({ view: 'workers', data });
    }
    const probeDecoded = decode(JSON.parse(JSON.stringify(probeEnvelope)));
    const probeAllDecoded = decode(JSON.parse(JSON.stringify(probeAllEnvelope)));
    expect(probeDecoded.ok && probeAllDecoded.ok).toBe(true);
  });
});
