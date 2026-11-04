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

import { afterEach, describe, expect, test } from 'bun:test';
import { resetLoggerForTests, setLogSink } from '../host/logger';
import { encode } from '../protocol/codec';
import {
  HOST_TO_VIEW,
  PROTOCOL_ERROR_CODES,
  VIEW_TO_HOST,
  type StudioReadyPayload,
} from '../protocol/types';
import { StudioMessageRouter } from './studio-router';

function readyEnvelope(view: string, capabilities?: string[]): unknown {
  return capabilities === undefined
    ? encode(VIEW_TO_HOST.StudioReady, { view })
    : encode(VIEW_TO_HOST.StudioReady, { view, capabilities });
}

function actionEnvelope(view: string, action: string, args?: Record<string, unknown>): unknown {
  return args === undefined
    ? encode(VIEW_TO_HOST.StudioAction, { view, action })
    : encode(VIEW_TO_HOST.StudioAction, { view, action, args });
}

describe('StudioMessageRouter', () => {
  test('decode failures are logged-and-dropped, never thrown', () => {
    const drops: string[] = [];
    const router = new StudioMessageRouter((message) => drops.push(message));
    const bad = [
      undefined,
      null,
      'envelope',
      [],
      {},
      { v: 2, type: 'studio.ready', payload: { view: 'x' }, ts: 1 },
      { v: 1, type: 'nope.type', payload: {}, ts: 1 },
      { v: 1, type: 'studio.ready', payload: { view: '' }, ts: 1 },
      { v: 1, type: 'studio.ready', payload: { view: 'x' }, ts: 'x' },
      { v: 1, type: 'studio.ready', payload: { view: 'x' } },
      { v: 1, type: 'studio.action', payload: { view: 'x', action: '' }, ts: 1 },
    ];
    for (const raw of bad) {
      expect(() => router.handle(raw)).not.toThrow();
    }
    expect(drops.length).toBe(bad.length);
    for (const line of drops) {
      expect(line).toContain('studio router dropped a message:');
    }
  });

  test('studio.ready reaches the route and passes capabilities through', () => {
    const seen: StudioReadyPayload[] = [];
    const drops: string[] = [];
    const router = new StudioMessageRouter((message) => drops.push(message));
    const unregister = router.register({
      view: 'colors',
      ready: (payload) => seen.push(payload),
    });
    router.handle(readyEnvelope('colors', ['copy', 'reveal']));
    expect(seen[0]).toEqual({ view: 'colors', capabilities: ['copy', 'reveal'] });
    router.handle(readyEnvelope('colors'));
    expect(seen[1]).toEqual({ view: 'colors' });
    expect(drops).toEqual([]);
    unregister();
  });

  test('unregistered views and missing handlers are dropped; unregister works', () => {
    const drops: string[] = [];
    const router = new StudioMessageRouter((message) => drops.push(message));
    router.handle(readyEnvelope('nope'));
    router.handle(actionEnvelope('nope', 'copy'));
    expect(drops[0]).toContain('studio.ready for an unregistered view: nope');
    expect(drops[1]).toContain('studio.action for an unregistered view: nope');

    const unregister = router.register({ view: 'colors' });
    router.handle(readyEnvelope('colors')); // no ready hook — silently fine
    router.handle(actionEnvelope('colors', 'copy'));
    expect(drops.length).toBe(3);
    expect(drops[2]).toContain('studio.action copy has no handler on colors');
    unregister();
    router.handle(readyEnvelope('colors'));
    expect(drops[3]).toContain('studio.ready for an unregistered view: colors');
  });

  test('re-registering a view replaces its route', () => {
    const drops: string[] = [];
    const router = new StudioMessageRouter((message) => drops.push(message));
    const seen: string[] = [];
    router.register({ view: 'colors', ready: () => seen.push('first') });
    router.register({ view: 'colors', ready: () => seen.push('second') });
    router.handle(readyEnvelope('colors'));
    expect(seen).toEqual(['second']);
  });

  test('studio.action dispatches args and context to the registered handler', () => {
    const seen: Array<{
      args: Record<string, unknown> | undefined;
      view: string;
      action: string;
    }> = [];
    const router = new StudioMessageRouter();
    router.register({
      view: 'colors',
      actions: {
        copy: (args, ctx) => seen.push({ args, view: ctx.view, action: ctx.action }),
        refresh: (args) => seen.push({ args, view: 'colors', action: 'refresh' }),
      },
    });
    router.handle(actionEnvelope('colors', 'copy', { text: '#fff' }));
    router.handle(actionEnvelope('colors', 'refresh'));
    expect(seen[0]).toEqual({ args: { text: '#fff' }, view: 'colors', action: 'copy' });
    expect(seen[1]).toEqual({ args: undefined, view: 'colors', action: 'refresh' });
  });

  test('throwing ready/action handlers are logged-and-dropped', () => {
    const drops: string[] = [];
    const router = new StudioMessageRouter((message) => drops.push(message));
    router.register({
      view: 'logs',
      ready: () => {
        throw new Error('ready-boom');
      },
      actions: {
        reveal: () => {
          throw 'action-boom';
        },
      },
    });
    expect(() => router.handle(readyEnvelope('logs'))).not.toThrow();
    expect(() => router.handle(actionEnvelope('logs', 'reveal', { line: 3 }))).not.toThrow();
    expect(drops[0]).toContain('studio.ready handler threw for logs: ready-boom');
    expect(drops[1]).toContain('studio.action reveal handler threw on logs: action-boom');
  });

  test('async handler rejections are logged, never escape', async () => {
    const drops: string[] = [];
    const router = new StudioMessageRouter((message) => drops.push(message));
    router.register({
      view: 'plugins',
      actions: {
        activate: async () => {
          throw new Error('async-boom');
        },
      },
    });
    expect(() => router.handle(actionEnvelope('plugins', 'activate', {}))).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(drops.length).toBe(1);
    expect(drops[0]).toContain('studio.action activate handler failed on plugins: async-boom');
  });

  test('non-studio envelopes are ignored silently', () => {
    const drops: string[] = [];
    const router = new StudioMessageRouter((message) => drops.push(message));
    router.register({
      view: 'colors',
      ready: () => {
        throw new Error('must not run');
      },
    });
    router.handle(encode(VIEW_TO_HOST.WebviewReady, { view: 'chart' }));
    router.handle(encode(VIEW_TO_HOST.ResultsReady, {}));
    router.handle(encode(HOST_TO_VIEW.StudioSet, { view: 'colors', data: 1 }));
    expect(drops).toEqual([]);
  });

  test('the default sink logs through the shared host logger', () => {
    const warned: string[] = [];
    setLogSink((level, message) => {
      if (level === 'warn') warned.push(message);
    });
    const router = new StudioMessageRouter();
    router.handle('not-an-envelope');
    expect(warned.length).toBe(1);
    expect(warned[0]).toContain(`studio router dropped a message: ${PROTOCOL_ERROR_CODES.BAD_ENVELOPE}`);
  });
});

afterEach(() => {
  resetLoggerForTests();
});
