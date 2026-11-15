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
  DebugAdapterExecutable,
  DebugAdapterInlineImplementation,
  type DebugAdapter,
  type DebugProtocolMessage,
  type ExtensionContext,
  debug,
  EventEmitter,
  window,
  workspace,
} from 'vscode';
import { notifyChart } from '../run/chart-bus';
import { AxisBarDebugSession, AXIS_BAR_DAP_TYPE, type DapRequest } from './bar-adapter';
import { lastBarDebugLaunch } from './snapshot';

export type AxisBarDebugAdapter = 'inline' | 'executable';

const DEFAULT_ADAPTER: AxisBarDebugAdapter = 'executable';

function readDebugAdapter(): AxisBarDebugAdapter {
  try {
    const raw = workspace.getConfiguration('axis.debug').get('adapter', DEFAULT_ADAPTER);
    return raw === 'inline' ? 'inline' : 'executable';
  } catch {
    return DEFAULT_ADAPTER;
  }
}

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

const BAR_DEBUG_NAME = 'AXIS: Step bars';

function noteIfNoBars(): void {
  const count = lastBarDebugLaunch()?.bars.length ?? 0;
  if (count > 0) return;
  void window.showInformationMessage(
    'AXIS: No bars to step. Run the script, then Start. Step moves one bar. This is not a source-line debugger.',
  );
}

/** Register the `axis-bar` DAP descriptor + keep one live session for commands. */
export function registerAxisBarDebugger(context: ExtensionContext): AxisBarDebugHandle {
  let live: AxisBarDebugSession | undefined;
  const adapterMode = readDebugAdapter();

  function ensureLive(): AxisBarDebugSession {
    if (!live) {
      live = new AxisBarDebugSession((barIndex) => {
        notifyChart({ type: 'chart.debugCursor', payload: { barIndex } });
      });
    }
    return live;
  }

  const factory = debug.registerDebugAdapterDescriptorFactory(AXIS_BAR_DAP_TYPE, {
    createDebugAdapterDescriptor() {
      if (adapterMode === 'executable') {
        // Real DAP: VS Code spawns the out-of-process adapter executable.
        const adapterPath = context.asAbsolutePath('out/debug/adapter.js');
        return new DebugAdapterExecutable(process.execPath, [adapterPath]);
      }
      // Inline fallback: DAP runs in the extension host process.
      return new DebugAdapterInlineImplementation(new InlineAxisBarAdapter(ensureLive()));
    },
  });
  context.subscriptions.push(factory);
  return {
    session: () => live,
    start: () => {
      noteIfNoBars();
      return debug.startDebugging(undefined, {
        type: AXIS_BAR_DAP_TYPE,
        name: BAR_DEBUG_NAME,
        request: 'launch',
        stopOnEntry: true,
      });
    },
    stepBar: () => {
      if (adapterMode === 'executable') {
        const running =
          debug.activeDebugSession?.type === AXIS_BAR_DAP_TYPE;
        if (!running) {
          void debug.startDebugging(undefined, {
            type: AXIS_BAR_DAP_TYPE,
            name: BAR_DEBUG_NAME,
            request: 'launch',
            stopOnEntry: true,
          });
        }
        void window.showInformationMessage(
          'AXIS: Use the VS Code debug toolbar (step over) to step bars. Command-palette stepping requires inline adapter mode.',
        );
        return;
      }
      ensureLive().handle({ seq: Date.now(), type: 'request', command: 'next' });
    },
    toggleBarBreakpoint: (index: number) => {
      if (adapterMode === 'executable') {
        void window.showInformationMessage(
          'AXIS: Bar breakpoints require inline adapter mode. Set axis.debug.adapter to inline.',
        );
        return false;
      }
      return ensureLive().toggleBarBreakpoint(index);
    },
    seekToBar: async (index: number) => {
      if (adapterMode === 'executable') {
        const running =
          debug.activeDebugSession?.type === AXIS_BAR_DAP_TYPE;
        if (!running) {
          await debug.startDebugging(undefined, {
            type: AXIS_BAR_DAP_TYPE,
            name: BAR_DEBUG_NAME,
            request: 'launch',
            stopOnEntry: false,
          });
        }
        void window.showInformationMessage(
          'AXIS: Use the VS Code debug UI to step/seek bars. Command-palette seeking requires inline adapter mode.',
        );
        return;
      }
      const sess = ensureLive();
      if (sess.barCount <= 0) {
        noteIfNoBars();
        await debug.startDebugging(undefined, {
          type: AXIS_BAR_DAP_TYPE,
          name: BAR_DEBUG_NAME,
          request: 'launch',
          stopOnEntry: false,
        });
      }
      sess.seekToBar(index, 'trade');
    },
    dispose: () => {
      factory.dispose();
      live = undefined;
    },
  };
}
