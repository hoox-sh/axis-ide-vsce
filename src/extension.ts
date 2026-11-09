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
 * AXIS IDE — lightweight VS Code extension.
 * Sole purpose: AXIS chart custom editor (*.axis.json) + run orchestration for chart painting + Pyodide opt-in + secrets for Pro / self-hosted CF PYNE worker.
 * No live, mcp, plugins, views/studios, results, profiler, etc.
 */

import {
  type CancellationToken,
  type ExtensionContext,
  type OutputChannel,
  type TextDocument,
  Uri,
  ViewColumn,
  commands,
  extensions,
  window,
  workspace,
} from 'vscode';

import { RUN_NO_PINE_MESSAGE } from './constants';
import { registerChartEditorProvider } from './editors/chart-editor';
import { CHART_VIEW_TYPE } from './editors/chart-document';
import {
  OPEN_CHART_NO_PINE_MESSAGE,
  PINE_LANGUAGE_ID,
  isPineFilePath,
  openChartEditorOptions,
  planSiblingChartOpen,
  siblingAxisJsonPath,
} from './host/open-chart';
import {
  AxisSecretStorage,
  SECRET_STORE_ERROR,
  proKeyPromptCopy,
  validateProKey,
  validateWorkerKey,
  workerKeyPromptCopy,
} from './secrets';
import { DEFAULT_DATAFEED_URL } from './host/history-client';
import { setLogSink } from './host/logger';
import {
  DEFAULT_ENGINE_ENDPOINT,
  RunOrchestrator,
  checkEngineEndpoint,
  notifyChart,
  resolveRunContext,
  scrubSecrets,
  type RunDeps,
  type RunMode,
} from './run';

export const COMMANDS = {
  openChart: 'axis.openChart',
  runScript: 'axis.runScript',
  runScriptSilent: 'axis.runScriptSilent',
  setProKey: 'axis.secrets.setProKey',
  setWorkerKey: 'axis.secrets.setWorkerKey',
  clearSecrets: 'axis.secrets.clear',
} as const;

const PYNE_EXT_ID = 'hoox-sh.pyne';

let runOutput: OutputChannel | undefined;
let secrets: AxisSecretStorage | undefined;
let orchestrator: RunOrchestrator | undefined;
/** Aborts the previous command-level run when a new one starts. */
let commandAbort: AbortController | undefined;
/** Set in deactivate so any late work skips after shutdown. */
let deactivated = false;

function readEngineSettings(): {
  endpoint: string;
  allowRemote: boolean;
  historyBarsSetting?: number;
  useMockBars: boolean;
  datafeedUrl: string;
} {
  let endpoint = DEFAULT_ENGINE_ENDPOINT;
  let allowRemote = false;
  let historyBarsSetting: number | undefined;
  let useMockBars = false;
  let datafeedUrl = DEFAULT_DATAFEED_URL;
  try {
    const engineCfg = workspace.getConfiguration('axis.engine');
    const ep = engineCfg.get<string>('endpoint');
    if (typeof ep === 'string' && ep.trim()) endpoint = ep.trim();
    allowRemote = engineCfg.get<boolean>('allowRemoteEndpoint', false) === true;
  } catch {
    // keep defaults
  }
  try {
    const chartCfg = workspace.getConfiguration('axis.chart');
    const hb = chartCfg.get<number>('historyBars');
    if (typeof hb === 'number' && Number.isFinite(hb)) historyBarsSetting = hb;
    useMockBars = chartCfg.get<boolean>('useMockBars', false) === true;
  } catch {
    // keep defaults
  }
  try {
    const dfCfg = workspace.getConfiguration('axis.datafeed');
    const url = dfCfg.get<string>('url');
    if (typeof url === 'string' && url.trim()) datafeedUrl = url.trim();
  } catch {
    // keep defaults
  }
  return { endpoint, allowRemote, historyBarsSetting, useMockBars, datafeedUrl };
}

function beginCommandAbort(): AbortSignal {
  try {
    commandAbort?.abort();
  } catch {
    // ignore
  }
  commandAbort = new AbortController();
  return commandAbort.signal;
}

async function readSiblingChartJson(pineFsPath: string): Promise<string | null> {
  try {
    const sibling = siblingAxisJsonPath(pineFsPath);
    if (!sibling) return null;
    const bytes = await workspace.fs.readFile(Uri.file(sibling));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

async function runScriptCommand(focus: boolean): Promise<string | undefined> {
  const result = await runScriptCore({ mode: 'auto', focus, showErrors: focus });
  if (result.ok) return result.runId ? `ok:${result.runId}` : 'ok';
  if (result.reason === 'stale') return 'stale';
  if (result.reason === 'aborted') return 'aborted';
  return result.error;
}

/**
 * Shared run path for commands. Summaries only.
 * Uses Pro key (auto from secret or AXIS_PRO_KEY env) or Worker key.
 */
async function runScriptCore(opts: {
  mode: RunMode;
  focus: boolean;
  showErrors: boolean;
  token?: CancellationToken;
  document?: TextDocument;
}): Promise<{ ok: boolean; mode: RunMode; focus: boolean; runId?: string; error?: string; reason?: string; epoch?: number }> {
  const { mode, focus, showErrors } = opts;
  if (deactivated) {
    return { ok: false, mode, focus, error: 'AXIS IDE deactivated' };
  }
  try {
    const doc = opts.document ?? window.activeTextEditor?.document;
    if (!doc || (doc.languageId !== PINE_LANGUAGE_ID && !(doc.uri.scheme === 'file' && isPineFilePath(doc.uri.fsPath)))) {
      if (showErrors) void window.showErrorMessage(RUN_NO_PINE_MESSAGE);
      return { ok: false, mode, focus, error: RUN_NO_PINE_MESSAGE };
    }
    if (!secrets || !orchestrator || !runOutput) {
      const err = 'AXIS: Run Script is not ready (activate incomplete).';
      if (showErrors) void window.showErrorMessage(err);
      return { ok: false, mode, focus, error: err };
    }
    const secretStore = secrets;
    const runOrch = orchestrator;
    const output = runOutput;

    const script = doc.getText();
    const pinePath = doc.uri.scheme === 'file' ? doc.uri.fsPath : '';
    if (pinePath) {
      try {
        await ensureSiblingChartBeside(pinePath, doc, true);
      } catch {
        // run still proceeds
      }
    }
    const chartJson = pinePath ? await readSiblingChartJson(pinePath) : null;
    if (deactivated) {
      return { ok: false, mode, focus, reason: 'aborted', error: 'aborted' };
    }

    const settings = readEngineSettings();
    const endpointCheck = checkEngineEndpoint(settings.endpoint, {
      allowRemote: settings.allowRemote,
    });
    if (!endpointCheck.ok) {
      const err = scrubSecrets(endpointCheck.error);
      output.appendLine(err);
      if (showErrors) void window.showErrorMessage(err);
      return { ok: false, mode, focus, error: err };
    }

    const signal = beginCommandAbort();
    const token = opts.token;
    if (token) {
      if (token.isCancellationRequested) {
        try { commandAbort?.abort(); } catch {}
        return { ok: false, mode, focus, reason: 'aborted', error: 'aborted' };
      }
      token.onCancellationRequested(() => { try { commandAbort?.abort(); } catch {} });
    }

    const resolved = await resolveRunContext(chartJson, {
      historyBarsSetting: settings.historyBarsSetting,
      engineId: 'server',
      activeEngineId: undefined,
      endpoint: endpointCheck.endpoint,
      useMockBars: settings.useMockBars,
      datafeedUrl: settings.datafeedUrl,
      allowRemote: settings.allowRemote,
      signal,
    });
    if (deactivated) {
      return { ok: false, mode, focus, reason: 'aborted', error: 'aborted' };
    }
    if (!resolved.ok) {
      if (resolved.reason === 'aborted') {
        return { ok: false, mode, focus, reason: 'aborted', error: 'aborted' };
      }
      const err = scrubSecrets(resolved.error);
      output.appendLine(err);
      if (showErrors) void window.showErrorMessage(err);
      return { ok: false, mode, focus, error: err };
    }
    const ctx = resolved.ctx;
    const runMode: RunMode = mode || ctx.mode || 'auto';

    const deps: RunDeps = {
      secrets: {
        getProKey: async () => {
          const k = await secretStore.getProKey();
          return k || (process.env.AXIS_PRO_KEY || undefined);
        },
        getWorkerKey: async () => {
          const k = await secretStore.getWorkerKey();
          return k || (process.env.AXIS_WORKER_KEY || undefined);
        },
      },
      endpoint: endpointCheck.endpoint,
      allowRemote: settings.allowRemote,
      bus: { notifyChart },
      output: {
        appendLine(line: string) {
          output.appendLine(scrubSecrets(line));
        },
      },
      diagnostics: {
        set: (_uri, _items) => {
          // diagnostics stripped in lightweight core (errors still logged to output)
        },
      },
    };

    const outcome = await runOrch.run(
      {
        script,
        uri: doc.uri.toString(),
        mode: runMode,
        focus,
        bars: ctx.bars,
        seriesKey: ctx.seriesKey,
        engineId: ctx.engineId,
        baseSeq: ctx.seq,
        signal,
      },
      deps,
    );
    if (deactivated) {
      return { ok: false, mode: runMode, focus, reason: 'aborted', error: 'aborted' };
    }

    if (outcome.ok) {
      return {
        ok: true,
        mode: runMode,
        focus,
        epoch: outcome.epoch,
        runId: outcome.runId,
      };
    }
    if (outcome.reason === 'stale') {
      return { ok: false, mode: runMode, focus, reason: 'stale', epoch: outcome.epoch };
    }
    if (outcome.reason === 'aborted') {
      return {
        ok: false,
        mode: runMode,
        focus,
        reason: 'aborted',
        epoch: outcome.epoch,
        error: 'aborted',
      };
    }
    const err = scrubSecrets(outcome.error || 'AXIS run failed');
    if (showErrors) void window.showErrorMessage(err);
    return {
      ok: false,
      mode: runMode,
      focus,
      reason: 'error',
      epoch: outcome.epoch,
      error: err,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const err = scrubSecrets(`AXIS: Run Script failed: ${message}`);
    runOutput?.appendLine(err);
    if (showErrors) void window.showErrorMessage(err);
    return { ok: false, mode, focus, error: err };
  }
}

function warnIfPyneBelowRecommended(): void {
  if (deactivated) return;
  try {
    const pyne = extensions.getExtension(PYNE_EXT_ID);
    if (!pyne) {
      console.warn(`[axis-ide] Recommended dependency ${PYNE_EXT_ID} is not installed.`);
    }
  } catch {
    // ignore in minimal
  }
}

async function promptAndSetProKey(): Promise<string | undefined> {
  if (deactivated || !secrets) return undefined;
  const raw = await window.showInputBox({
    ...proKeyPromptCopy(),
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => {
      const t = value.trim();
      if (!t) return null;
      const r = validateProKey(t);
      return r.ok ? null : r.error;
    },
  });
  if (deactivated || raw === undefined || !secrets) return undefined;
  try {
    const result = await secrets.setProKey(raw);
    if (!result.ok) {
      void window.showErrorMessage(result.error);
      return result.error;
    }
    const cleared = raw.trim().length === 0;
    void window.showInformationMessage(
      cleared ? 'AXIS Pro key cleared (SecretStorage).' : 'AXIS Pro key saved (SecretStorage).',
    );
    return cleared ? 'cleared' : 'ok';
  } catch {
    void window.showErrorMessage(SECRET_STORE_ERROR);
    return SECRET_STORE_ERROR;
  }
}

async function promptAndSetWorkerKey(): Promise<string | undefined> {
  if (deactivated || !secrets) return undefined;
  const raw = await window.showInputBox({
    ...workerKeyPromptCopy(),
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => {
      const t = value.trim();
      if (!t) return null;
      const r = validateWorkerKey(t);
      return r.ok ? null : r.error;
    },
  });
  if (deactivated || raw === undefined || !secrets) return undefined;
  try {
    const result = await secrets.setWorkerKey(raw);
    if (!result.ok) {
      void window.showErrorMessage(result.error);
      return result.error;
    }
    const cleared = raw.trim().length === 0;
    void window.showInformationMessage(
      cleared ? 'AXIS Worker key cleared (SecretStorage).' : 'AXIS Worker key saved (SecretStorage).',
    );
    return cleared ? 'cleared' : 'ok';
  } catch {
    void window.showErrorMessage(SECRET_STORE_ERROR);
    return SECRET_STORE_ERROR;
  }
}

async function promptAndClearSecrets(): Promise<string | undefined> {
  if (deactivated || !secrets) return undefined;
  const confirm = await window.showWarningMessage(
    'Clear stored AXIS Worker and Pro API keys from SecretStorage?',
    { modal: true },
    'Clear',
  );
  if (deactivated || confirm !== 'Clear' || !secrets) return undefined;
  try {
    await secrets.clearWorkerAndProKeys();
    void window.showInformationMessage('AXIS Worker and Pro secrets cleared.');
    return 'cleared';
  } catch {
    void window.showErrorMessage(SECRET_STORE_ERROR);
    return SECRET_STORE_ERROR;
  }
}

async function revealChartBeside(uri: Uri, preserveFocus: boolean): Promise<void> {
  const opts = openChartEditorOptions(preserveFocus);
  try {
    await commands.executeCommand('vscode.openWith', uri, CHART_VIEW_TYPE, opts);
    return;
  } catch {
    // fall through
  }
  await commands.executeCommand('vscode.open', uri, {
    viewColumn: ViewColumn.Beside,
    preview: opts.preview,
    preserveFocus: opts.preserveFocus,
  });
}

async function ensureSiblingChartBeside(
  pinePath: string,
  doc: TextDocument,
  preserveFocus: boolean,
): Promise<void> {
  const pineFileName =
    doc.uri.path.split('/').pop() ||
    doc.fileName.split(/[/\\]/).pop() ||
    'script.pyne';
  const probe = planSiblingChartOpen({
    pinePath,
    pineFileName,
    siblingExists: true,
  });
  if (!probe.ok) return;
  const siblingUri = Uri.file(probe.siblingPath);
  let exists = false;
  try {
    await workspace.fs.stat(siblingUri);
    exists = true;
  } catch {
    exists = false;
  }
  if (deactivated) return;
  let historyBarsSetting: number | undefined;
  try {
    const hb = workspace.getConfiguration('axis.chart').get<number>('historyBars');
    if (typeof hb === 'number' && Number.isFinite(hb)) historyBarsSetting = hb;
  } catch {
    historyBarsSetting = undefined;
  }
  const plan = planSiblingChartOpen({
    pinePath,
    pineFileName,
    siblingExists: exists,
    historyBarsSetting,
  });
  if (!plan.ok) return;
  if (plan.writeBytes) {
    await workspace.fs.writeFile(siblingUri, plan.writeBytes);
  }
  if (deactivated) return;
  await revealChartBeside(siblingUri, preserveFocus);
}

async function openChartCommand(): Promise<string | undefined> {
  if (deactivated) return undefined;
  try {
    const editor = window.activeTextEditor;
    const doc = editor?.document;
    const fsPath = doc?.uri?.fsPath ?? '';
    const langOk = doc?.languageId === PINE_LANGUAGE_ID;
    const pathOk = isPineFilePath(fsPath);
    if (doc?.uri.scheme !== 'file' || (!langOk && !pathOk)) {
      void window.showErrorMessage(OPEN_CHART_NO_PINE_MESSAGE);
      return OPEN_CHART_NO_PINE_MESSAGE;
    }

    await ensureSiblingChartBeside(fsPath, doc, false);
    const sibling = siblingAxisJsonPath(fsPath);
    return sibling ? Uri.file(sibling).toString() : undefined;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const err = `AXIS: Open Chart failed: ${message}`;
    void window.showErrorMessage(err);
    return err;
  }
}

export function activate(context: ExtensionContext): void {
  deactivated = false;

  secrets = new AxisSecretStorage(context.secrets);
  orchestrator = new RunOrchestrator();

  runOutput = window.createOutputChannel('AXIS Run');
  context.subscriptions.push(runOutput);
  setLogSink((level, message) => {
    const line = `[${level}] ${message}`;
    try {
      runOutput?.appendLine(scrubSecrets(line));
    } catch {}
    if (level === 'error') console.error(`[axis] ${scrubSecrets(message)}`);
    else if (level === 'warn') console.warn(`[axis] ${scrubSecrets(message)}`);
  });

  // Register chart editor (core)
  context.subscriptions.push(
    registerChartEditorProvider(context, {}),
  );

  // Core commands only (no showRunOutput, no run-on-save)
  context.subscriptions.push(
    commands.registerCommand(COMMANDS.openChart, () => openChartCommand()),
    commands.registerCommand(COMMANDS.runScript, () => runScriptCommand(true)),
    commands.registerCommand(COMMANDS.runScriptSilent, () => runScriptCommand(false)),
    commands.registerCommand(COMMANDS.setProKey, () => promptAndSetProKey()),
    commands.registerCommand(COMMANDS.setWorkerKey, () => promptAndSetWorkerKey()),
    commands.registerCommand(COMMANDS.clearSecrets, () => promptAndClearSecrets()),
  );

  warnIfPyneBelowRecommended();
  const ver = String(context.extension.packageJSON?.version ?? '');
  runOutput.appendLine(ver ? `AXIS IDE activated (lightweight core ${ver}).` : 'AXIS IDE activated (lightweight).');

  // no statusBar in lightweight core
}

export function deactivate(): void {
  deactivated = true;
  try {
    commandAbort?.abort();
  } catch {}
  commandAbort = undefined;
  try {
    orchestrator?.abortAll();
  } catch {}
  setLogSink(null);
  runOutput = undefined;
  secrets = undefined;
  orchestrator = undefined;
}
