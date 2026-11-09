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
 * VS Code wiring for DAP type `axis-bar` (inline adapter, not `pyne`).
 */

import {
  DebugAdapterInlineImplementation,
  type DebugAdapter,
  type DebugProtocolMessage,
  type ExtensionContext,
  debug,
  EventEmitter,
} from 'vscode';
import { notifyChart } from '../run/chart-bus';
import { AxisBarDebugSession, AXIS_BAR_DAP_TYPE, type DapRequest } from './bar-adapter';
import { lastBarDebugLaunch } from './snapshot';

export type AxisBarDebugHandle = {
  session: () => AxisBarDebugSession | undefined;
  start: () => Thenable<boolean>;
  stepBar: () => void;
  toggleBarBreakpoint: (index: number) => boolean;
  /** Click-the-lying-trade: seek the live session (starts DAP if needed). */
  seekToBar: (index: number) => Thenable<void>;
  dispose: () => void;
};

class InlineAxisBarAdapter implements DebugAdapter {
  private readonly emitter = new EventEmitter<DebugProtocolMessage>();
  readonly onDidSendMessage = this.emitter.event;
  constructor(private readonly session: AxisBarDebugSession) {}
  handleMessage(message: DebugProtocolMessage): void {
    const raw = message as DapRequest;
    let payload: unknown = message;
    if (raw && raw.type === 'request' && raw.command === 'launch') {
      const last = lastBarDebugLaunch();
      const args =
        raw.arguments && typeof raw.arguments === 'object'
          ? { ...(last ?? {}), ...(raw.arguments as object) }
          : last ?? {};
      payload = { ...raw, arguments: args };
    }
    for (const out of this.session.handle(payload)) {
      this.emitter.fire(out as DebugProtocolMessage);
    }
  }
  dispose(): void {
    this.emitter.dispose();
  }
}

/** Register inline DAP factory + keep one live session for commands. */
export function registerAxisBarDebugger(context: ExtensionContext): AxisBarDebugHandle {
  let live: AxisBarDebugSession | undefined;
  const factory = debug.registerDebugAdapterDescriptorFactory(AXIS_BAR_DAP_TYPE, {
    createDebugAdapterDescriptor() {
      live = new AxisBarDebugSession((barIndex) => {
        notifyChart({ type: 'chart.debugCursor', payload: { barIndex } });
      });
      return new DebugAdapterInlineImplementation(new InlineAxisBarAdapter(live));
    },
  });
  context.subscriptions.push(factory);
  return {
    session: () => live,
    start: () =>
      debug.startDebugging(undefined, {
        type: AXIS_BAR_DAP_TYPE,
        name: 'AXIS: Bar debug',
        request: 'launch',
        stopOnEntry: true,
      }),
    stepBar: () => {
      live?.handle({ seq: Date.now(), type: 'request', command: 'next' });
    },
    toggleBarBreakpoint: (index: number) => live?.toggleBarBreakpoint(index) ?? false,
    seekToBar: async (index: number) => {
      if (!live) {
        await debug.startDebugging(undefined, {
          type: AXIS_BAR_DAP_TYPE,
          name: 'AXIS: Bar debug',
          request: 'launch',
          stopOnEntry: false,
        });
      }
      live?.seekToBar(index, 'trade');
    },
    dispose: () => {
      factory.dispose();
      live = undefined;
    },
  };
}
