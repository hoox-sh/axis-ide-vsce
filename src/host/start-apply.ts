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
 * Setup for one start-screen card. No VS Code imports. The extension paints
 * each view and performs the setting writes this module asks for.
 */

import {
  HOSTED_ENGINE_URL,
  type StartCardId,
  type StartStepState,
  type StartView,
  markStep,
  runningView,
  settleWaiting,
} from './start-run';

export type StartStepReport = (id: string, state: StartStepState, detail?: string) => void;

export type StartSettingSection = 'axis.engine' | 'pynescript';

export type ProbeFetch = (
  url: string,
  init: { method: 'GET'; signal: AbortSignal },
) => Promise<unknown>;

export type StartApplyDeps = {
  update(section: StartSettingSection, key: string, value: string | boolean): Promise<void>;
  probe(url: string): Promise<string | undefined>;
  pyodideBundled: boolean;
  setupLocal?: (report: StartStepReport) => Promise<boolean>;
};

export const READY_MESSAGE =
  'Ready. Get bars with AXIS: Pick Data (Sample candles or CSV) or open examples/, then open a Pine script and press Ctrl+Enter (Cmd+Enter on a Mac). Sample candles are on by default.';
export const HOSTED_UNREACHABLE_MESSAGE =
  'The hosted engine did not answer. The choice is saved. Try again when the network is up.';
export const LOCAL_FAILED_MESSAGE =
  'Local setup stopped. Fix the failed step, or choose another way to run.';
export const LOCAL_UNAVAILABLE_MESSAGE = 'Local setup is not available in this window.';
export const SETUP_FAILED_MESSAGE = 'Setup stopped on a failed step.';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** GET `url`. Returns an error message, or undefined when the host answered. */
export async function probeHost(
  url: string,
  fetchImpl: ProbeFetch,
  timeoutMs: number,
): Promise<string | undefined> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    await fetchImpl(url, { method: 'GET', signal: ctrl.signal });
    return undefined;
  } catch (error) {
    return errorText(error);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run one card. A step in state `bad` never ends as Ready. The hosted card
 * writes `axis.engine.mode=server` and `axis.engine.endpoint` to the hosted URL
 * before it checks the network.
 */
export async function runStartChoice(
  card: StartCardId,
  deps: StartApplyDeps,
  onView: (view: StartView) => void,
): Promise<StartView> {
  let view = runningView(card);
  const paint = () => onView(view);
  const report: StartStepReport = (id, state, detail) => {
    view = { ...view, steps: markStep(view.steps, id, state, detail) };
    paint();
  };
  paint();
  try {
    if (card === 'hosted') {
      report('save', 'run');
      await deps.update('axis.engine', 'mode', 'server');
      await deps.update('axis.engine', 'endpoint', HOSTED_ENGINE_URL);
      report('save', 'ok', HOSTED_ENGINE_URL);
      report('pyne', 'run');
      try {
        await deps.update('pynescript', 'backend.useHosted', true);
        await deps.update('pynescript', 'backend.hostedUrl', HOSTED_ENGINE_URL);
        report('pyne', 'ok');
      } catch (error) {
        report('pyne', 'bad', errorText(error));
      }
      report('reach', 'run');
      const reachError = await deps.probe(HOSTED_ENGINE_URL);
      if (reachError) {
        report('reach', 'bad', reachError);
        view = { ...view, phase: 'error', message: HOSTED_UNREACHABLE_MESSAGE };
        paint();
        return view;
      }
      report('reach', 'ok');
    } else if (card === 'editor') {
      report('save', 'run');
      await deps.update('axis.engine', 'allowPyodide', true);
      await deps.update('axis.engine', 'mode', 'pyodide');
      report('save', 'ok');
      report('bundle', 'run');
      report(
        'bundle',
        deps.pyodideBundled ? 'ok' : 'skip',
        deps.pyodideBundled
          ? 'Pyodide is in this extension.'
          : 'The bundle is not in this build. The first run can fetch it.',
      );
    } else if (deps.setupLocal) {
      const ok = await deps.setupLocal(report);
      if (!ok) {
        view = { ...view, phase: 'error', message: LOCAL_FAILED_MESSAGE };
        paint();
        return view;
      }
      view = { ...view, steps: settleWaiting(view.steps, 'skip') };
    } else {
      view = { ...view, phase: 'error', message: LOCAL_UNAVAILABLE_MESSAGE };
      paint();
      return view;
    }
    if (view.steps.some((step) => step.state === 'bad')) {
      view = {
        ...view,
        phase: 'error',
        message: view.message ?? SETUP_FAILED_MESSAGE,
      };
      paint();
      return view;
    }
    view = { ...view, phase: 'done', message: READY_MESSAGE };
    paint();
    return view;
  } catch (error) {
    view = { ...view, phase: 'error', message: errorText(error) };
    paint();
    return view;
  }
}
