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

import type { AxisBarDebugHandle } from './register';
import { beforeAll, describe, expect, mock, test } from 'bun:test';
import { AxisBarDebugSession } from './bar-adapter';

// Mock the vscode module before registering it, then dynamically import
// register.ts (static imports are hoisted and would run before mock.module).
// `adapterModeOverride` drives readDebugAdapter() (called inside
// registerAxisBarDebugger, at call time), so both adapter modes can be
// exercised by re-registering.
let adapterModeOverride: 'inline' | 'executable' = 'executable';
const showInfoCalls: unknown[] = [];
const showInfo = (...args: unknown[]) => {
  showInfoCalls.push(args);
  return Promise.resolve(undefined);
};
const startDebuggingCalls: unknown[] = [];
const startDebugging = (...args: unknown[]) => {
  startDebuggingCalls.push(args);
  return Promise.resolve(true);
};

mock.module('vscode', () => ({
  DebugAdapterExecutable: class {},
  DebugAdapterInlineImplementation: class {},
  EventEmitter: class {},
  debug: {
    registerDebugAdapterDescriptorFactory: () => ({ dispose: () => {} }),
    activeDebugSession: undefined,
    startDebugging,
  },
  workspace: {
    getConfiguration: () => ({
      get: (key: string, def?: unknown) =>
        key === 'adapter' ? adapterModeOverride : def,
    }),
  },
  window: {
    showInformationMessage: showInfo,
  },
}));

let registerAxisBarDebugger: (ctx: {
  asAbsolutePath: (...args: unknown[]) => string;
  subscriptions: unknown[];
}) => AxisBarDebugHandle;
beforeAll(async () => {
  const mod = await import('./register');
  registerAxisBarDebugger = mod.registerAxisBarDebugger;
});

function context() {
  return { asAbsolutePath: () => 'out/debug/adapter.js', subscriptions: [] };
}

describe('registerAxisBarDebugger (both adapter modes)', () => {
  test('returns a handle with stepBar/toggleBarBreakpoint/seekToBar/dispose', () => {
    adapterModeOverride = 'executable';
    const handle = registerAxisBarDebugger(context());
    expect(typeof handle.stepBar).toBe('function');
    expect(typeof handle.toggleBarBreakpoint).toBe('function');
    expect(typeof handle.seekToBar).toBe('function');
    expect(typeof handle.dispose).toBe('function');
    expect(typeof handle.start).toBe('function');
    expect(typeof handle.session).toBe('function');
  });

  test('executable mode stepBar shows info message and does not call ensureLive().handle()', () => {
    adapterModeOverride = 'executable';
    showInfoCalls.length = 0;
    let handleCalls = 0;
    const proto = AxisBarDebugSession.prototype as unknown as {
      handle: (raw: unknown) => unknown[];
    };
    const original = proto.handle;
    proto.handle = function (raw: unknown) {
      handleCalls += 1;
      return original.call(this, raw);
    };
    try {
      const handle = registerAxisBarDebugger(context());
      handle.stepBar();
      expect(handleCalls).toBe(0);
      expect(showInfoCalls).toContainEqual([
        'AXIS: Use the VS Code debug toolbar (step over) to step bars. Command-palette stepping requires inline adapter mode.',
      ]);
    } finally {
      proto.handle = original;
    }
  });

  test('executable mode toggleBarBreakpoint returns false and shows info message', () => {
    adapterModeOverride = 'executable';
    showInfoCalls.length = 0;
    const handle = registerAxisBarDebugger(context());
    expect(handle.toggleBarBreakpoint(0)).toBe(false);
    expect(showInfoCalls).toContainEqual([
      'AXIS: Bar breakpoints require inline adapter mode. Set axis.debug.adapter to inline.',
    ]);
  });

  test('executable mode seekToBar does not throw, starts a session, shows info message', async () => {
    adapterModeOverride = 'executable';
    showInfoCalls.length = 0;
    startDebuggingCalls.length = 0;
    const handle = registerAxisBarDebugger(context());
    await expect(handle.seekToBar(2)).resolves.toBeUndefined();
    expect(startDebuggingCalls.length).toBeGreaterThan(0);
    expect(showInfoCalls).toContainEqual([
      'AXIS: Use the VS Code debug UI to step/seek bars. Command-palette seeking requires inline adapter mode.',
    ]);
  });

  test('inline mode stepBar calls ensureLive().handle() without throwing', () => {
    adapterModeOverride = 'inline';
    showInfoCalls.length = 0;
    let handleCalls = 0;
    const proto = AxisBarDebugSession.prototype as unknown as {
      handle: (raw: unknown) => unknown[];
    };
    const original = proto.handle;
    proto.handle = function (raw: unknown) {
      handleCalls += 1;
      return original.call(this, raw);
    };
    try {
      const handle = registerAxisBarDebugger(context());
      expect(() => handle.stepBar()).not.toThrow();
      expect(handleCalls).toBeGreaterThan(0);
      expect(showInfoCalls.length).toBe(0);
    } finally {
      proto.handle = original;
    }
  });

  test('inline mode seekToBar calls sess.seekToBar() without throwing', async () => {
    adapterModeOverride = 'inline';
    const handle = registerAxisBarDebugger(context());
    await expect(handle.seekToBar(1)).resolves.toBeUndefined();
  });

  test('dispose does not throw', () => {
    adapterModeOverride = 'executable';
    const handle = registerAxisBarDebugger(context());
    expect(() => handle.dispose()).not.toThrow();
  });
});
