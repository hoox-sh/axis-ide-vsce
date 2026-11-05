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
 * Run Output studio registration (enhancement plan §5 Phase 3a).
 *
 * Pure-host wiring: returns a `StudioRegistration` and a `registerRunOutput`
 * helper that mounts the generic `StudioViewProvider` for `axis.runOutput`.
 * VS Code surface is injected via the same `StudioProviderDeps`,
 * `StudioViewHost`, and `StudioContextLike` shims the generic provider uses,
 * so this file stays import-free of the VS Code runtime.
 */

import { ProfilerStore } from '../run/profiler-store';
import type { ResultsFocusStore } from '../run/results-store';
import type { StudioRegistration } from './studio-registry';
import {
  registerStudioView,
  StudioViewProvider,
  type StudioContextLike,
  type StudioProviderDeps,
  type StudioViewHost,
} from './studio-provider';
import { StudioMessageRouter } from './studio-router';
import {
  RUN_OUTPUT_STUDIO_VIEW,
  RUN_OUTPUT_TITLE,
  RUN_OUTPUT_VIEW_ID,
  buildRunOutputData,
  parseRunOutputCopyIdArgs,
  parseRunOutputCopyLogTextArgs,
  parseRunOutputCopyRunIdArgs,
  parseRunOutputFocusRunArgs,
  parseRunOutputRevealLogLineArgs,
  parseRunOutputRevealProfilerLineArgs,
} from './run-output-messages';

/** Host surfaces for Run Output actions (clipboard, editor reveal, focus). */
export interface RunOutputHostSurfaces {
  /** Copy arbitrary text (run id / log text). */
  copyText(text: string): void;
  /** Retarget Results focus to a run id and reveal the Summary tab. */
  focusRun(runId: string): void;
  /** Reveal a profiler hot line in the active Pine editor. */
  revealProfilerLine(line: number): void;
  /** Reveal a log line in the active Pine editor. */
  revealLogLine(line: number): void;
  /** Copy a log line verbatim. */
  copyLogText(text: string): void;
}

export const RUN_OUTPUT_STUDIO_ID = RUN_OUTPUT_STUDIO_VIEW;

/** Body markup for the Run Output studio — the webview JS depends on these ids. */
export function buildRunOutputStudioBody(): string {
  return `<section id="runoutput-root" class="runoutput-root" data-axis-runoutput-host="1" aria-label="Run Output">
  <header class="runoutput-header">
    <nav class="runoutput-tabs" role="tablist" aria-label="Run Output tabs">
      <button type="button" class="runoutput-tab" data-tab="summary" role="tab" aria-selected="true">Summary</button>
      <button type="button" class="runoutput-tab" data-tab="strategy" role="tab" aria-selected="false">Strategy</button>
      <button type="button" class="runoutput-tab" data-tab="profiler" role="tab" aria-selected="false">Profiler</button>
      <button type="button" class="runoutput-tab" data-tab="logs" role="tab" aria-selected="false">Logs</button>
    </nav>
  </header>
  <div id="runoutput-panels" class="runoutput-panels"></div>
</section>`;
}

/** Create the `StudioRegistration` for the Run Output panel. */
export function createRunOutputRegistration(
  resultsStore: Pick<ResultsFocusStore, 'getResultsSetPayload'>,
  profiler: Pick<ProfilerStore, 'getSnapshot'>,
  surfaces: RunOutputHostSurfaces,
): StudioRegistration {
  return {
    id: RUN_OUTPUT_STUDIO_ID,
    title: RUN_OUTPUT_TITLE,
    viewId: RUN_OUTPUT_VIEW_ID,
    retainContextWhenHidden: false,
    buildBody: buildRunOutputStudioBody,
    actions: {
      copyId: (args) => {
        const runId = parseRunOutputCopyIdArgs(args);
        if (runId) surfaces.copyText(runId);
      },
      focusRun: (args) => {
        const runId = parseRunOutputFocusRunArgs(args);
        if (runId) surfaces.focusRun(runId);
      },
      revealProfilerLine: (args) => {
        const line = parseRunOutputRevealProfilerLineArgs(args);
        if (line != null) surfaces.revealProfilerLine(line);
      },
      copyRunId: (args) => {
        const runId = parseRunOutputCopyRunIdArgs(args);
        if (runId) surfaces.copyText(runId);
      },
      revealLogLine: (args) => {
        const line = parseRunOutputRevealLogLineArgs(args);
        if (line != null) surfaces.revealLogLine(line);
      },
      copyLogText: (args) => {
        const text = parseRunOutputCopyLogTextArgs(args);
        if (text) surfaces.copyLogText(text);
      },
      selectTab: () => {
        // client-side owns tab state; host acknowledges by taking no action
      },
    },
    restore: () => buildRunOutputData(resultsStore.getResultsSetPayload(), profiler.getSnapshot()),
  };
}

/** Post the current composite Run Output state to a provider. */
function postRunOutputData(
  provider: StudioViewProvider,
  resultsStore: Pick<ResultsFocusStore, 'getResultsSetPayload'>,
  profiler: Pick<ProfilerStore, 'getSnapshot'>,
): void {
  provider.postStudioSet(buildRunOutputData(resultsStore.getResultsSetPayload(), profiler.getSnapshot()));
}

/**
 * Register `axis.runOutput` against the generic studio provider.
 * Subscribes to the Results and Profiler stores and pushes `studio.set`
 * whenever the last-run or profiler snapshot changes.
 */
export function registerRunOutput(
  context: StudioContextLike,
  deps: StudioProviderDeps,
  host: StudioViewHost,
  resultsStore: Pick<ResultsFocusStore, 'getResultsSetPayload' | 'subscribe'>,
  surfaces: RunOutputHostSurfaces,
  profiler?: ProfilerStore,
  router?: StudioMessageRouter,
): StudioViewProvider | undefined {
  const profilerStore = profiler ?? new ProfilerStore();
  const entry = createRunOutputRegistration(resultsStore, profilerStore, surfaces);
  const provider = registerStudioView(entry, deps, host, context, router);
  if (!provider) {
    return undefined;
  }

  const unsubResults = resultsStore.subscribe(() => {
    postRunOutputData(provider, resultsStore, profilerStore);
  });
  const unsubProfiler = profilerStore.subscribe(() => {
    postRunOutputData(provider, resultsStore, profilerStore);
  });

  try {
    context.subscriptions.push({
      dispose: () => {
        try {
          unsubResults();
        } catch {
          // ignore
        }
        try {
          unsubProfiler();
        } catch {
          // ignore
        }
        provider.dispose();
      },
    });
  } catch {
    // subscriptions push may fail on a hostile context; provider still usable
  }

  return provider;
}
