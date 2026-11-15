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
  ConfigurationTarget,
  type ExtensionContext,
  type OutputChannel,
  type TextDocument,
  ProgressLocation,
  StatusBarAlignment,
  type StatusBarItem,
  Uri,
  ViewColumn,
  commands,
  extensions,
  window,
  workspace,
} from 'vscode';

import { RUN_NO_PINE_MESSAGE, RUN_OUTPUT_CHANNEL_NAME } from './constants';
import { applyChartDocumentQuiet, registerChartEditorProvider } from './editors/chart-editor';
import {
  CHART_VIEW_TYPE,
  defaultChartDocument,
  parseChartDocument,
  serializeChartDocument,
} from './editors/chart-document';
import { isCsvBarsPath, toStoredBarsPath } from './host/csv-bars';
import {
  DATA_PICK_COPY,
  DATA_TIMEFRAME_CHOICES,
  applyDataPickToDoc,
  dataSourceChoices,
  dataSourceLabel,
  formatDataPickSummary,
  isDataTimeframe,
} from './host/data-pick';
import {
  OPEN_CHART_NO_PINE_MESSAGE,
  PINE_LANGUAGE_ID,
  isPineFilePath,
  openChartEditorOptions,
  planSiblingChartOpen,
  siblingAxisJsonPath,
} from './host/open-chart';
import { RUN_RUNNING_CONTEXT } from './host/pine-lang';
import {
  abortInflightRun,
  beginCommandAbortController,
  runChromeLabel,
  type RunChromeState,
} from './host/run-control';
import {
  AxisSecretStorage,
  SECRET_STORE_ERROR,
  proKeyPromptCopy,
  validateProKey,
  validateWorkerKey,
  workerKeyPromptCopy,
} from './secrets';
import { chooseEngine, type EngineMode } from './host/engine-choice';
import { engineStatusView } from './host/engine-status';
import { DEFAULT_DATAFEED_URL } from './host/history-client';
import { logInfo, setLogSink } from './host/logger';
import {
  ALLOW_PYODIDE_DEFAULT,
  isPyodideAllowed,
  LOCAL_PYODIDE_VERSION,
  PYODIDE_BUNDLE_PARTS,
} from './host/pyodide-profile';
import { spawn as spawnProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { join as joinPath } from 'node:path';
import { pathToFileURL } from 'node:url';
import { registerAxisBarDebugger, type AxisBarDebugHandle } from './debug/register';
import { lastBarDebugLaunch, launchFromRun, rememberBarDebugLaunch } from './debug/snapshot';
import {
  DEFAULT_ENGINE_ENDPOINT,
  LOCAL_ENGINE_DEFAULT_COMMAND,
  LOCAL_ENGINE_HOST,
  LOCAL_ENGINE_PACKAGE,
  LOCAL_ENGINE_VENV_DIR,
  LocalEngine,
  RunOrchestrator,
  checkEngineEndpoint,
  createPyodideCalculator,
  ensureStandalonePython,
  installPynescriptRuntime,
  loadPyodideRuntime,
  notifyChart,
  postEngineRun,
  provisionLocalEngine,
  resolveLocalEnginePackage,
  resolvePyodideAssets,
  resolveRunContext,
  resolveRuntimeTarget,
  scrubSecrets,
  venvConsoleScript,
  type ProvisionCommandResult,
  type ProvisionResult,
  type PyodideCalculator,
  type RunDeps,
  type RunMode,
} from './run';

import {
  AxisStatusbar,
  STATUSBAR_COMMAND_POPUP,
  STATUSBAR_COMMAND_TOGGLE,
  type StatusbarHost,
} from './statusbar';

export const COMMANDS = {
  openChart: 'axis.openChart',
  runScript: 'axis.runScript',
  runScriptSilent: 'axis.runScriptSilent',
  setProKey: 'axis.secrets.setProKey',
  setWorkerKey: 'axis.secrets.setWorkerKey',
  clearSecrets: 'axis.secrets.clear',
  stopRun: 'axis.stopRun',
  showRunOutput: 'axis.showRunOutput',
  pickData: 'axis.pickData',
  debugStart: 'axis.debug.start',
  debugStepBar: 'axis.debug.stepBar',
  debugToggleBarBreakpoint: 'axis.debug.toggleBarBreakpoint',
  openWalkthroughFixture: 'axis.openWalkthroughFixture',
  engineStart: 'axis.engine.start',
  engineStop: 'axis.engine.stop',
  engineStatus: 'axis.engine.status',
  engineSetup: 'axis.engine.setup',
  engineMenu: 'axis.engine.menu',
} as const;

const PYNE_EXT_ID = 'hoox-sh.pyne';

let runOutput: OutputChannel | undefined;
let secrets: AxisSecretStorage | undefined;
let orchestrator: RunOrchestrator | undefined;
let pyodideCalc: PyodideCalculator | undefined;
let localEngine: LocalEngine | undefined;
/** Command/args/cwd tuple the live `localEngine` was built from. */
let localEngineKey = '';
let engineStatusBar: StatusBarItem | undefined;
let extensionContext: ExtensionContext | undefined;
let barDebug: AxisBarDebugHandle | undefined;
/** Aborts the previous command-level run when a new one starts. */
let commandAbort: AbortController | undefined;
/** Bumped on start/stop so a late `finally` cannot clear a newer run. */
let runGeneration = 0;
/** Set in deactivate so any late work skips after shutdown. */
let deactivated = false;
/** HOOX statusbar item (created on demand, disposed on deactivate). */
let statusbar: AxisStatusbar | undefined;

function setRunRunning(running: boolean): void {
  try {
    void commands.executeCommand('setContext', RUN_RUNNING_CONTEXT, running);
  } catch {
    // tests / host without setContext
  }
}

/** Chart toolbar chip via host.run.status. No status bar. Stale epochs are dropped. */
function publishRunChrome(state: RunChromeState, epoch: number): void {
  if (deactivated || epoch !== runGeneration) return;
  const message = runChromeLabel(state);
  try {
    notifyChart({
      type: 'host.run.status',
      payload: message ? { epoch, state, message } : { epoch, state },
    });
  } catch {
    // chart may be closed
  }
}

function readEngineSettings(): {
  endpoint: string;
  allowRemote: boolean;
  allowPyodide: boolean;
  pyodideWheelUrl?: string;
  historyBarsSetting?: number;
  useMockBars: boolean;
  datafeedUrl: string;
  engineMode: EngineMode;
  localCommand: string;
  localArgs: string[];
  localCwd?: string;
  localPython: string;
  localPackage: string;
  localAllowDownload: boolean;
} {
  let endpoint = DEFAULT_ENGINE_ENDPOINT;
  let allowRemote = false;
  let allowPyodide = ALLOW_PYODIDE_DEFAULT;
  let pyodideWheelUrl: string | undefined;
  let historyBarsSetting: number | undefined;
  let useMockBars = false;
  let datafeedUrl = DEFAULT_DATAFEED_URL;
  let engineMode: EngineMode = 'auto';
  let localCommand = LOCAL_ENGINE_DEFAULT_COMMAND;
  let localArgs: string[] = [];
  let localCwd: string | undefined;
  let localPython = 'python3';
  let localPackage = LOCAL_ENGINE_PACKAGE;
  let localAllowDownload = true;
  try {
    const engineCfg = workspace.getConfiguration('axis.engine');
    const ep = engineCfg.get<string>('endpoint');
    if (typeof ep === 'string' && ep.trim()) endpoint = ep.trim();
    allowRemote = engineCfg.get<boolean>('allowRemoteEndpoint', false) === true;
    allowPyodide = isPyodideAllowed(
      engineCfg.get<boolean>('allowPyodide', ALLOW_PYODIDE_DEFAULT),
    );
    const wheel = engineCfg.get<string>('pyodideWheelUrl');
    if (typeof wheel === 'string' && wheel.trim()) pyodideWheelUrl = wheel.trim();
    const mode = engineCfg.get<string>('mode');
    if (mode === 'auto' || mode === 'server' || mode === 'local' || mode === 'pyodide') {
      engineMode = mode;
    }
    const cmd = engineCfg.get<string>('local.command');
    if (typeof cmd === 'string' && cmd.trim()) localCommand = cmd.trim();
    const args = engineCfg.get<string[]>('local.args');
    if (Array.isArray(args)) localArgs = args.filter((a) => typeof a === 'string');
    const cwd = engineCfg.get<string>('local.cwd');
    if (typeof cwd === 'string' && cwd.trim()) localCwd = cwd.trim();
    const py = engineCfg.get<string>('local.python');
    if (typeof py === 'string' && py.trim()) localPython = py.trim();
    const pkg = engineCfg.get<string>('local.package');
    if (typeof pkg === 'string' && pkg.trim()) localPackage = pkg.trim();
    localAllowDownload = engineCfg.get<boolean>('local.allowDownload', true) === true;
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
  return {
    endpoint,
    allowRemote,
    allowPyodide,
    pyodideWheelUrl,
    historyBarsSetting,
    useMockBars,
    datafeedUrl,
    engineMode,
    localCommand,
    localArgs,
    localCwd,
    localPython,
    localPackage,
    localAllowDownload,
  };
}

/** True when the extension-owned venv console script exists. */
function localEngineProvisioned(): boolean {
  const root = extensionContext?.globalStorageUri;
  if (!root) return false;
  const bin = venvConsoleScript(
    Uri.joinPath(root, LOCAL_ENGINE_VENV_DIR).fsPath,
    process.platform,
    joinPath,
  );
  try {
    return existsSync(bin);
  } catch {
    return false;
  }
}

/** Selected engine id; `auto` prefers a provisioned local engine. */
function selectedEngineId(
  settings: ReturnType<typeof readEngineSettings>,
): Exclude<EngineMode, 'auto'> {
  return chooseEngine({
    mode: settings.engineMode,
    allowPyodide: settings.allowPyodide,
    localCommand: settings.localCommand,
    localProvisioned: localEngineProvisioned(),
  });
}

/** Push the current engine state into the status bar. */
function refreshEngineStatusBar(): void {
  if (!engineStatusBar) return;
  const view = engineStatusView(localEngine?.status(), readEngineSettings().engineMode);
  if (!view.show) {
    engineStatusBar.hide();
    return;
  }
  engineStatusBar.text = view.text;
  engineStatusBar.tooltip = `${view.tooltip} — click for Start / Stop / Install`;
  engineStatusBar.show();
}

/** Bind a loopback port, read it, close, then hand it to the sidecar. */
function findFreeLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, LOCAL_ENGINE_HOST, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => {
        if (port > 0) resolve(port);
        else reject(new Error('could not allocate a loopback port'));
      });
    });
  });
}

/** Build (or rebuild) the sidecar manager from current settings. */
function ensureLocalEngine(): LocalEngine {
  const settings = readEngineSettings();
  const key = `${settings.localCommand}\u0000${settings.localArgs.join('\u0000')}\u0000${settings.localCwd ?? ''}`;
  if (localEngine && localEngineKey === key) return localEngine;
  localEngine?.stop();
  localEngine = new LocalEngine({
    command: settings.localCommand,
    args: settings.localArgs,
    ...(settings.localCwd ? { cwd: settings.localCwd } : {}),
    findFreePort: findFreeLoopbackPort,
    spawn: (command, args, options) => {
      const child = spawnProcess(command, args, {
        ...(options.cwd ? { cwd: options.cwd } : {}),
        env: { ...process.env, ...options.env },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      child.stdout?.on('data', (chunk) => {
        const line = String(chunk).trimEnd();
        if (line) runOutput?.appendLine(scrubSecrets(line));
      });
      child.stderr?.on('data', (chunk) => {
        const line = String(chunk).trimEnd();
        if (line) runOutput?.appendLine(scrubSecrets(line));
      });
      return child;
    },
    log: (line) => runOutput?.appendLine(scrubSecrets(line)),
    onStateChange: () => refreshEngineStatusBar(),
  });
  localEngineKey = key;
  return localEngine;
}

type LocalEngineStartResult =
  | { ok: true; endpoint: string }
  | { ok: false; error: string };

async function startLocalEngine(): Promise<LocalEngineStartResult> {
  const engine = ensureLocalEngine();
  const status = await engine.start();
  refreshEngineStatusBar();
  if (status.state === 'ready') return { ok: true, endpoint: status.endpoint };
  if (status.state === 'error') return { ok: false, error: status.error };
  return { ok: false, error: 'AXIS local engine did not start.' };
}

async function engineStartCommand(): Promise<void> {
  const result = await startLocalEngine();
  if (!result.ok) {
    void window
      .showErrorMessage(scrubSecrets(result.error), 'Install Local Engine')
      .then((choice) => {
        if (choice) void commands.executeCommand(COMMANDS.engineSetup);
      });
    return;
  }
  void window.showInformationMessage(`AXIS local engine ready at ${result.endpoint}`);
}

function engineStopCommand(): void {
  localEngine?.stop();
  refreshEngineStatusBar();
  runOutput?.appendLine('local engine stopped');
}

function engineStatusCommand(): void {
  refreshEngineStatusBar();
  const status = localEngine?.status() ?? { state: 'stopped' as const };
  const message =
    status.state === 'ready'
      ? `AXIS local engine ready at ${status.endpoint}`
      : status.state === 'error'
        ? `AXIS local engine error: ${status.error}`
        : `AXIS local engine ${status.state}`;
  void window.showInformationMessage(scrubSecrets(message));
}

type EngineMenuItem = {
  label: string;
  description?: string;
  command: string;
};

/** QuickPick actions for the `PYNE local` status item. */
async function engineMenuCommand(): Promise<void> {
  refreshEngineStatusBar();
  const status = localEngine?.status() ?? { state: 'stopped' as const };
  const view = engineStatusView(status, 'local');
  const items: EngineMenuItem[] = [];

  if (status.state !== 'ready') {
    items.push({ label: '$(play) Start Local Engine', command: COMMANDS.engineStart });
  }
  if (status.state === 'ready' || status.state === 'starting') {
    items.push({ label: '$(debug-stop) Stop Local Engine', command: COMMANDS.engineStop });
  }
  items.push({
    label: '$(cloud-download) Install Local Engine',
    command: COMMANDS.engineSetup,
  });
  items.push({ label: '$(output) Show AXIS Run Output', command: COMMANDS.showRunOutput });
  items.push({
    label: '$(info) Local Engine Status',
    description: view.tooltip,
    command: COMMANDS.engineStatus,
  });

  const pick = await window.showQuickPick(items, {
    title: 'AXIS local engine',
    placeHolder: view.tooltip,
  });
  if (pick) await commands.executeCommand(pick.command);
}

/** Stream one provisioning command into the AXIS Run channel. */
function runProvisionCommand(
  command: string,
  args: string[],
): Promise<ProvisionCommandResult> {
  return new Promise((resolve) => {
    const child = spawnProcess(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      const text = String(chunk);
      stdout += text;
      runOutput?.appendLine(scrubSecrets(text.trimEnd()));
    });
    child.stderr?.on('data', (chunk) => {
      const text = String(chunk);
      stderr += text;
      runOutput?.appendLine(scrubSecrets(text.trimEnd()));
    });
    child.once('error', (err) => resolve({ code: -1, stderr: err.message }));
    child.once('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

/** Download a pinned runtime archive into `dest`. */
async function downloadToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, bytes);
}

async function sha256File(file: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  const fs = await import('node:fs/promises');
  return createHash('sha256').update(await fs.readFile(file)).digest('hex');
}

/** Extract a `.tar.gz` with the platform `tar` (bsdtar on Win10+). */
async function extractTarGz(archive: string, destDir: string): Promise<void> {
  const fs = await import('node:fs/promises');
  await fs.mkdir(destDir, { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const child = spawnProcess('tar', ['-xzf', archive, '-C', destDir], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code !== 0) {
        reject(new Error(`tar exited with code ${code}: ${stderr.trim()}`));
        return;
      }
      // The extracted tree is enough; drop the ~68 MB archive.
      void fs.rm(archive, { force: true }).then(
        () => resolve(),
        () => resolve(),
      );
    });
  });
}

/** Create the extension-owned venv, install the backend, select local mode. */
async function engineSetupCommand(context: ExtensionContext): Promise<void> {
  const settings = readEngineSettings();
  const venvDir = Uri.joinPath(context.globalStorageUri, LOCAL_ENGINE_VENV_DIR).fsPath;
  const pkg = await resolveLocalEnginePackage({
    extensionRoot: context.extensionPath,
    exists: (path) => existsSync(path),
    joinPath,
    configured: settings.localPackage,
  });
  runOutput?.appendLine(`local engine package: ${pkg.source} ${pkg.spec}`);
  const runtimeDir = Uri.joinPath(context.globalStorageUri, 'pyne-runtime').fsPath;
  const result = await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: 'AXIS: installing local engine',
      cancellable: false,
    },
    async (progress): Promise<ProvisionResult> => {
      const provision = (python: string) =>
        provisionLocalEngine({
          python,
          venvDir,
          packageSpec: pkg.spec,
          run: runProvisionCommand,
          exists: async (path) => existsSync(path),
          joinPath,
          platform: process.platform,
          log: (line) => runOutput?.appendLine(scrubSecrets(line)),
        });

      const first = await provision(settings.localPython);
      const canDownload =
        settings.localAllowDownload && settings.localPython === 'python3';
      if (first.ok || first.step !== 'python' || !canDownload) return first;

      const target = resolveRuntimeTarget(process.platform, process.arch);
      if (!target) {
        return {
          ok: false,
          step: 'python',
          error: `no standalone Python build for ${process.platform}/${process.arch}; set axis.engine.local.python.`,
        };
      }

      progress.report({ message: 'downloading standalone Python…' });
      const runtime = await ensureStandalonePython({
        target,
        cacheDir: joinPath(runtimeDir, target.key),
        download: downloadToFile,
        sha256: sha256File,
        extract: extractTarGz,
        exists: (path) => existsSync(path),
        joinPath,
        log: (line) => runOutput?.appendLine(scrubSecrets(line)),
      });
      if (!runtime.ok) {
        return {
          ok: false,
          step: 'python',
          error: `standalone Python ${runtime.step} failed: ${runtime.error}`,
        };
      }

      progress.report({ message: 'installing backend…' });
      return provision(runtime.python);
    },
  );
  if (!result.ok) {
    const hint =
      pkg.source === 'pypi'
        ? ' The vendored wheel is missing from this build; set axis.engine.local.package to a wheel or repo path.'
        : '';
    void window.showErrorMessage(
      `AXIS local engine setup failed (${result.step}): ${scrubSecrets(result.error)}${hint}`,
    );
    return;
  }
  const cfg = workspace.getConfiguration('axis.engine');
  await cfg.update('local.command', result.command, ConfigurationTarget.Global);
  await cfg.update('mode', 'local', ConfigurationTarget.Global);
  refreshEngineStatusBar();
  void window.showInformationMessage(
    'AXIS local engine installed. Run a script with Ctrl+Enter (Cmd+Enter on macOS).',
  );
}

function beginCommandAbort(): AbortSignal {
  commandAbort = beginCommandAbortController(commandAbort);
  return commandAbort.signal;
}

function stopRunCommand(): string {
  runGeneration += 1;
  const stopped = abortInflightRun(commandAbort);
  try {
    orchestrator?.abortAll();
  } catch {
    // ignore
  }
  setRunRunning(false);
  if (stopped === 'stopped') {
    runOutput?.appendLine('AXIS: Run stopped.');
    publishRunChrome('stopped', runGeneration);
  }
  return stopped;
}

function showRunOutputCommand(): string {
  try {
    runOutput?.show(true);
  } catch {
    // ignore
  }
  return RUN_OUTPUT_CHANNEL_NAME;
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
  inputs?: Record<string, unknown>;
}): Promise<{ ok: boolean; mode: RunMode; focus: boolean; runId?: string; error?: string; reason?: string; epoch?: number }> {
  const { mode, focus, showErrors } = opts;
  if (deactivated) {
    return { ok: false, mode, focus, error: 'AXIS IDE deactivated' };
  }
  if (!pyneLanguageInstalled()) {
    const err =
      'AXIS: PYNE Language Support (hoox-sh.pyne) is not installed. Hover/diagnostics will be dead until you install it.';
    if (showErrors) warnIfPyneBelowRecommended();
    return { ok: false, mode, focus, error: err };
  }
  let myGen = 0;
  let markedRunning = false;
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
    const engineId = selectedEngineId(settings);
    const endpointCheck = checkEngineEndpoint(settings.endpoint, {
      allowRemote: settings.allowRemote,
    });
    if (engineId === 'server' && !endpointCheck.ok) {
      const err = scrubSecrets(endpointCheck.error);
      output.appendLine(err);
      if (showErrors) void window.showErrorMessage(err);
      return { ok: false, mode, focus, error: err };
    }
    const endpoint = endpointCheck.ok ? endpointCheck.endpoint : DEFAULT_ENGINE_ENDPOINT;

    const signal = beginCommandAbort();
    myGen = ++runGeneration;
    markedRunning = true;
    setRunRunning(true);
    publishRunChrome('running', myGen);
    const token = opts.token;
    if (token) {
      if (token.isCancellationRequested) {
        try { commandAbort?.abort(); } catch {}
        publishRunChrome('stopped', myGen);
        return { ok: false, mode, focus, reason: 'aborted', error: 'aborted' };
      }
      token.onCancellationRequested(() => { try { commandAbort?.abort(); } catch {} });
    }

    const resolved = await resolveRunContext(chartJson, {
      historyBarsSetting: settings.historyBarsSetting,
      engineId,
      activeEngineId: undefined,
      endpoint,
      useMockBars: settings.useMockBars,
      datafeedUrl: settings.datafeedUrl,
      allowRemote: settings.allowRemote,
      signal,
      chartDir: pinePath ? joinPath(pinePath, '..') : undefined,
      workspaceRoot: workspace.workspaceFolders?.[0]?.uri.fsPath,
    });
    if (deactivated) {
      return { ok: false, mode, focus, reason: 'aborted', error: 'aborted' };
    }
    if (!resolved.ok) {
      if (resolved.reason === 'aborted') {
        publishRunChrome('stopped', myGen);
        return { ok: false, mode, focus, reason: 'aborted', error: 'aborted' };
      }
      const err = scrubSecrets(resolved.error);
      output.appendLine(err);
      if (showErrors) void window.showErrorMessage(err);
      publishRunChrome('error', myGen);
      return { ok: false, mode, focus, error: err };
    }
    const ctx = resolved.ctx;
    const runMode: RunMode = mode || ctx.mode || 'auto';

    let sidecarEndpoint: string | undefined;
    if (engineId === 'local') {
      const started = await startLocalEngine();
      if (!started.ok) {
        const err = scrubSecrets(started.error);
        output.appendLine(err);
        if (showErrors) {
          void window.showErrorMessage(err, 'Install Local Engine').then((choice) => {
            if (choice) void commands.executeCommand(COMMANDS.engineSetup);
          });
        }
        publishRunChrome('error', myGen);
        return { ok: false, mode, focus, error: err };
      }
      sidecarEndpoint = started.endpoint;
    }
    if (signal.aborted) {
      publishRunChrome('stopped', myGen);
      return { ok: false, mode, focus, reason: 'aborted', error: 'aborted' };
    }

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
      endpoint,
      allowRemote: settings.allowRemote,
      pyodideAllowed: settings.allowPyodide,
      runPyodide: settings.allowPyodide && pyodideCalc
        ? (req) => pyodideCalc!.run(true, req)
        : undefined,
      runLocal: sidecarEndpoint
        ? (req) =>
            postEngineRun({
              endpoint: sidecarEndpoint,
              script: req.script,
              bars: req.bars,
              mode: req.mode,
              symbol: req.symbol,
              inputs: req.inputs,
              timeframe: req.timeframe,
              fromBar: req.fromBar,
              toBar: req.toBar,
              allowRemote: false,
              signal: req.signal,
              timeoutMs: 120_000,
            })
        : undefined,
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
        inputs: opts.inputs ?? ctx.inputs,
        timeframe: ctx.timeframe,
        fromBar: ctx.fromBar,
        toBar: ctx.toBar,
      },
      deps,
    );
    if (deactivated) {
      return { ok: false, mode: runMode, focus, reason: 'aborted', error: 'aborted' };
    }

    if (outcome.ok) {
      try {
        rememberBarDebugLaunch(
          launchFromRun(ctx.bars, outcome.result.series, pinePath || undefined),
        );
      } catch {
        // debug snapshot is best-effort
      }
      publishRunChrome('ok', myGen);
      return {
        ok: true,
        mode: runMode,
        focus,
        epoch: outcome.epoch,
        runId: outcome.runId,
      };
    }
    if (outcome.reason === 'stale') {
      publishRunChrome('idle', myGen);
      return { ok: false, mode: runMode, focus, reason: 'stale', epoch: outcome.epoch };
    }
    if (outcome.reason === 'aborted') {
      publishRunChrome('stopped', myGen);
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
    publishRunChrome('error', myGen);
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
    if (markedRunning) publishRunChrome('error', myGen);
    return { ok: false, mode, focus, error: err };
  } finally {
    if (markedRunning && (deactivated || runGeneration === myGen)) {
      setRunRunning(false);
    }
  }
}

async function openWalkthroughFixture(extensionPath: string): Promise<void> {
  const pine = Uri.file(joinPath(extensionPath, 'fixtures', 'orb.pine'));
  const chart = Uri.file(joinPath(extensionPath, 'fixtures', 'orb.axis.json'));
  if (!existsSync(pine.fsPath) || !existsSync(chart.fsPath)) {
    void window.showErrorMessage('AXIS walkthrough fixtures are missing from this install.');
    return;
  }
  await window.showTextDocument(pine, { preview: false, viewColumn: ViewColumn.One });
  await commands.executeCommand('vscode.openWith', chart, CHART_VIEW_TYPE, ViewColumn.Beside);
}

function pyneLanguageInstalled(): boolean {
  try {
    return Boolean(extensions.getExtension(PYNE_EXT_ID));
  } catch {
    return false;
  }
}

function warnIfPyneBelowRecommended(): void {
  if (deactivated) return;
  if (pyneLanguageInstalled()) return;
  console.warn(`[axis-ide] Required dependency ${PYNE_EXT_ID} is not installed.`);
  void window
    .showErrorMessage(
      'AXIS needs PYNE Language Support (hoox-sh.pyne) for hover, diagnostics, and .pine/.pyne. Install PYNE, then reload.',
      'Install PYNE',
    )
    .then((pick) => {
      if (pick !== 'Install PYNE' || deactivated) return;
      return commands.executeCommand('workbench.extensions.installExtension', PYNE_EXT_ID);
    });
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

async function pickDataCommand(): Promise<string | undefined> {
  if (deactivated) return undefined;
  try {
    const editor = window.activeTextEditor;
    const doc = editor?.document;
    const fsPath = doc?.uri?.scheme === 'file' ? (doc.uri.fsPath ?? '') : '';
    const langOk = doc?.languageId === PINE_LANGUAGE_ID;
    const pineOk = Boolean(fsPath) && (langOk || isPineFilePath(fsPath));
    const chartOk = Boolean(fsPath) && fsPath.toLowerCase().endsWith('.axis.json');
    if (!doc || doc.uri.scheme !== 'file' || (!pineOk && !chartOk)) {
      const err =
        'AXIS: Pick Data needs an active Pine Script™ or *.axis.json file.';
      void window.showErrorMessage(err);
      return err;
    }

    let chartPath = fsPath;
    if (pineOk) {
      await ensureSiblingChartBeside(fsPath, doc, true);
      const sibling = siblingAxisJsonPath(fsPath);
      if (!sibling) {
        void window.showErrorMessage(OPEN_CHART_NO_PINE_MESSAGE);
        return OPEN_CHART_NO_PINE_MESSAGE;
      }
      chartPath = sibling;
    }

    let chartJson: string | null = null;
    try {
      const bytes = await workspace.fs.readFile(Uri.file(chartPath));
      chartJson = new TextDecoder().decode(bytes);
    } catch {
      chartJson = null;
    }
    const parsed = parseChartDocument(chartJson ?? '');
    const chartDoc = parsed.ok ? parsed.doc : defaultChartDocument();

    const symbol = await window.showInputBox({
      title: DATA_PICK_COPY.symbolTitle,
      prompt: DATA_PICK_COPY.symbolPrompt,
      placeHolder: 'BTC/USDT',
      value: chartDoc.symbol || 'BTC/USDT',
      ignoreFocusOut: true,
    });
    if (deactivated || symbol === undefined) return 'cancelled';

    const tfPick = await window.showQuickPick(
      DATA_TIMEFRAME_CHOICES.map((item) => ({
        label: item.label,
        description: item.description,
      })),
      {
        title: DATA_PICK_COPY.timeframeTitle,
        placeHolder: chartDoc.interval || DATA_PICK_COPY.timeframePlaceholder,
        ignoreFocusOut: true,
      },
    );
    if (deactivated || !tfPick || !isDataTimeframe(tfPick.label)) return 'cancelled';
    const tf = tfPick.label;

    const settings = readEngineSettings();
    const workspaceRoot = workspace.workspaceFolders?.[0]?.uri.fsPath;
    const barsMode = await window.showQuickPick(
      dataSourceChoices({
        datafeedUrl: settings.datafeedUrl,
        barsPath: chartDoc.barsPath,
      }),
      {
        title: DATA_PICK_COPY.sourceTitle,
        placeHolder: DATA_PICK_COPY.sourcePlaceholder,
        ignoreFocusOut: true,
      },
    );
    if (deactivated || !barsMode) return 'cancelled';

    let barsPath = '';
    if (barsMode.id === 'csv') {
      const found = await workspace.findFiles(
        '**/*.csv',
        '**/{node_modules,.git,out,dist,coverage}/**',
        50,
      );
      const picks: Array<{ label: string; description: string; path: string | '__browse__' }> = [
        ...found.map((uri) => ({
          label: uri.fsPath.split(/[/\\]/).pop() || uri.fsPath,
          description: toStoredBarsPath(uri.fsPath, workspaceRoot),
          path: uri.fsPath,
        })),
        {
          label: DATA_PICK_COPY.csvBrowseLabel,
          description: DATA_PICK_COPY.csvBrowseDescription,
          path: '__browse__',
        },
      ];
      const filePick = await window.showQuickPick(picks, {
        title: DATA_PICK_COPY.csvTitle,
        placeHolder: 'Choose a CSV of candles',
        ignoreFocusOut: true,
      });
      if (deactivated || !filePick) return 'cancelled';
      let abs = filePick.path;
      if (abs === '__browse__') {
        const opened = await window.showOpenDialog({
          canSelectMany: false,
          filters: { CSV: ['csv'] },
          title: DATA_PICK_COPY.csvTitle,
        });
        if (deactivated || !opened?.[0]) return 'cancelled';
        abs = opened[0].fsPath;
      }
      if (!isCsvBarsPath(abs)) {
        const err = 'AXIS: Pick a .csv file. The path cannot contain "..".';
        void window.showErrorMessage(err);
        return err;
      }
      barsPath = toStoredBarsPath(abs, workspaceRoot);
    }

    const nextDoc = applyDataPickToDoc(chartDoc, {
      symbol,
      interval: tf,
      exchange: chartDoc.exchange || 'binance',
      barsPath,
    });
    const chartUri = Uri.file(chartPath);
    await workspace.fs.writeFile(
      chartUri,
      new TextEncoder().encode(serializeChartDocument(nextDoc)),
    );
    applyChartDocumentQuiet(chartUri, nextDoc);

    const useMock = barsMode.id === 'mock';
    if (barsMode.id !== 'csv') {
      const target = workspace.workspaceFolders?.length
        ? ConfigurationTarget.Workspace
        : ConfigurationTarget.Global;
      await workspace.getConfiguration('axis.chart').update('useMockBars', useMock, target);
    }

    const sourceLabel = dataSourceLabel(barsMode.id, nextDoc.barsPath);
    const summary = formatDataPickSummary(nextDoc.symbol, nextDoc.interval, sourceLabel);
    void window.showInformationMessage(`AXIS: ${summary}`);
    return summary;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const err = `AXIS: Pick Data failed: ${message}`;
    void window.showErrorMessage(err);
    return err;
  }
}

/**
 * VS Code-backed `StatusbarHost` for `AxisStatusbar`. Lives in the host so
 * `src/statusbar.ts` stays free of runtime `vscode` imports (unit-testable).
 */
function makeStatusbarHost(): StatusbarHost {
  return {
    readEnabled: () =>
      workspace
        .getConfiguration('axis')
        .get<boolean>('statusbar.enabled', true) === true,
    writeEnabled: async (enabled: boolean) =>
      workspace
        .getConfiguration('axis')
        .update('statusbar.enabled', enabled, ConfigurationTarget.Global),
    createItem: (alignment: unknown, priority: number) =>
      window.createStatusBarItem(alignment as StatusBarAlignment, priority),
    registerCommand: (id: string, fn: () => unknown) =>
      commands.registerCommand(id, fn),
    runCommand: async (id: string, ...args: unknown[]) =>
      commands.executeCommand(id, ...args),
    pick: async (items, options) =>
      window.showQuickPick(items, { title: options.title }),
  };
}

export function activate(context: ExtensionContext): void {
  deactivated = false;
  extensionContext = context;

  secrets = new AxisSecretStorage(context.secrets);
  orchestrator = new RunOrchestrator();
  const cacheDir = context.globalStorageUri
    ? Uri.joinPath(context.globalStorageUri, 'pyodide', LOCAL_PYODIDE_VERSION).fsPath
    : '';
  const bundledDir = Uri.joinPath(context.extensionUri, ...PYODIDE_BUNDLE_PARTS).fsPath;
  pyodideCalc = createPyodideCalculator({
    load: async (indexURL) => {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const { pathToFileURL: toUrl } = await import('node:url');
      // Local: bundled Pyodide + read-only VSIX copy with CDN fallback and a
      // boot-level timeout in pyodide-calculator (PYODIDE_LOAD_TIMEOUT_MS).
      // Remote's per-fetch 20s AbortSignal is subsumed by that boot timeout.
      return loadPyodideRuntime(
        { cacheDir, bundledDir, downloadBase: indexURL },
        {
          fetchImpl: (url) => fetch(url),
          mkdir: async (dir) => {
            await fs.mkdir(dir, { recursive: true });
          },
          writeFile: (filePath, data) => fs.writeFile(filePath, data),
          importModule: (fileUrl) => import(fileUrl),
          joinPath: (...parts) => path.join(...parts),
          toFileUrl: (fsPath) => toUrl(fsPath).href,
          exists: async (filePath) => {
            try {
              await fs.access(filePath);
              return true;
            } catch {
              return false;
            }
          },
          log: (message) => logInfo(message),
        },
      );
    },
    install: async (py) => {
      const fs = await import('node:fs/promises');
      const wheelUrl = readEngineSettings().pyodideWheelUrl;
      const assets = resolvePyodideAssets({
        extensionRoot: context.extensionPath,
        cwd: process.cwd(),
        wheelUrl,
        exist: existsSync,
        joinPath,
        toFileUrl: (fsPath) => pathToFileURL(fsPath).href,
      });
      if (!assets.ok) throw new Error(assets.missing);
      let runtimeSource = '';
      if (assets.runtimePath) {
        runtimeSource = await fs.readFile(assets.runtimePath, 'utf8');
      }
      await installPynescriptRuntime(py, {
        wheelUrl: assets.wheelUrl,
        antlrUrl: assets.antlrUrl,
        runtimeSource,
      });
    },
  });

  runOutput = window.createOutputChannel(RUN_OUTPUT_CHANNEL_NAME);
  context.subscriptions.push(runOutput);

  engineStatusBar = window.createStatusBarItem(StatusBarAlignment.Right, 90);
  engineStatusBar.command = COMMANDS.engineMenu;
  context.subscriptions.push(engineStatusBar);
  refreshEngineStatusBar();
  context.subscriptions.push(
    workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('axis.engine')) refreshEngineStatusBar();
    }),
  );
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
    registerChartEditorProvider(context, {
      onApplyInputs: (inputs) => {
        void runScriptCore({
          mode: 'auto',
          focus: false,
          showErrors: false,
          inputs,
        });
      },
      onBarBreakpoint: (barIndex) => {
        barDebug?.toggleBarBreakpoint(barIndex);
      },
      onSelectTrade: (barIndex) => {
        void barDebug?.seekToBar(barIndex);
      },
    }),
  );
  barDebug = registerAxisBarDebugger(context);
  context.subscriptions.push({ dispose: () => barDebug?.dispose() });

  context.subscriptions.push(
    commands.registerCommand(COMMANDS.openChart, () => openChartCommand()),
    commands.registerCommand(COMMANDS.runScript, () => runScriptCommand(true)),
    commands.registerCommand(COMMANDS.runScriptSilent, () => runScriptCommand(false)),
    commands.registerCommand(COMMANDS.setProKey, () => promptAndSetProKey()),
    commands.registerCommand(COMMANDS.setWorkerKey, () => promptAndSetWorkerKey()),
    commands.registerCommand(COMMANDS.clearSecrets, () => promptAndClearSecrets()),
    commands.registerCommand(COMMANDS.stopRun, () => stopRunCommand()),
    commands.registerCommand(COMMANDS.showRunOutput, () => showRunOutputCommand()),
    commands.registerCommand(COMMANDS.pickData, () => pickDataCommand()),
    commands.registerCommand(COMMANDS.debugStart, () => {
      const doc = window.activeTextEditor?.document;
      const pinePath =
        doc && doc.uri.scheme === 'file' && isPineFilePath(doc.uri.fsPath) ? doc.uri.fsPath : '';
      if (pinePath) {
        const last = lastBarDebugLaunch();
        rememberBarDebugLaunch({
          bars: last?.bars ?? [],
          series: last?.series,
          stopOnEntry: last?.stopOnEntry !== false,
          program: pinePath,
        });
      }
      return barDebug?.start();
    }),
    commands.registerCommand(COMMANDS.debugStepBar, () => barDebug?.stepBar()),
    commands.registerCommand(COMMANDS.debugToggleBarBreakpoint, () => {
      const session = barDebug?.session();
      if (!session) return false;
      // Route through the handle so executable adapter mode shows the info
      // message instead of toggling the orphaned in-process session.
      return barDebug?.toggleBarBreakpoint(session.currentBar) ?? false;
    }),
    commands.registerCommand(COMMANDS.openWalkthroughFixture, () =>
      openWalkthroughFixture(context.extensionPath),
    ),
    commands.registerCommand(COMMANDS.engineStart, () => engineStartCommand()),
    commands.registerCommand(COMMANDS.engineStop, () => engineStopCommand()),
    commands.registerCommand(COMMANDS.engineStatus, () => engineStatusCommand()),
    commands.registerCommand(COMMANDS.engineSetup, () => engineSetupCommand(context)),
    commands.registerCommand(COMMANDS.engineMenu, () => engineMenuCommand()),
  );

  // AXIS IDE statusbar item (HOOX logo) with a click popup.
  const sbHost = makeStatusbarHost();
  statusbar = new AxisStatusbar(
    sbHost,
    Uri.file(context.asAbsolutePath('media/icon.png')),
  );
  context.subscriptions.push({ dispose: () => statusbar?.dispose() });
  const sb = statusbar;
  context.subscriptions.push(
    commands.registerCommand(STATUSBAR_COMMAND_TOGGLE, () => void sb?.toggle()),
    commands.registerCommand(STATUSBAR_COMMAND_POPUP, () => void sb?.showPopup()),
  );
  sb?.showIfEnabled();

  warnIfPyneBelowRecommended();
  const ver = String(context.extension.packageJSON?.version ?? '');
  runOutput.appendLine(ver ? `AXIS IDE activated (lightweight core ${ver}).` : 'AXIS IDE activated (lightweight).');
}

export function deactivate(): void {
  deactivated = true;
  runGeneration += 1;
  try {
    commandAbort?.abort();
  } catch {}
  commandAbort = undefined;
  try {
    orchestrator?.abortAll();
  } catch {}
  setRunRunning(false);
  setLogSink(null);
  runOutput = undefined;
  secrets = undefined;
  orchestrator = undefined;
  try {
    pyodideCalc?.reset();
  } catch {}
  pyodideCalc = undefined;
  try {
    localEngine?.stop();
  } catch {}
  localEngine = undefined;
  localEngineKey = '';
  try {
    engineStatusBar?.dispose();
  } catch {}
  engineStatusBar = undefined;
  extensionContext = undefined;
  barDebug = undefined;
  statusbar?.dispose();
  statusbar = undefined;
}
