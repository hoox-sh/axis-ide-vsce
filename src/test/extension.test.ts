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

import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { RUN_NO_PINE_MESSAGE } from '../constants';
import { CHART_VIEW_TYPE } from '../editors/chart-document';
import { OPEN_CHART_NO_PINE_MESSAGE } from '../host/open-chart';
import { isVersionOlderThan } from '../semver';

const PACKAGE_PATH = path.resolve(__dirname, '../../package.json');
const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8')) as {
  name: string;
  publisher: string;
  displayName: string;
  version: string;
  license: string;
  icon?: string;
  activationEvents?: string[];
  extensionDependencies?: string[];
  contributes?: Record<string, unknown> & {
    commands?: Array<{ command: string }>;
    customEditors?: Array<{
      viewType: string;
      displayName?: string;
      selector?: Array<{ filenamePattern: string }>;
      priority?: string;
    }>;
    viewsContainers?: {
      panel?: Array<{ id: string; title?: string; icon?: string }>;
      activitybar?: Array<{ id: string; title?: string; icon?: string }>;
    };
    views?: Record<
      string,
      Array<{
        id: string;
        name?: string;
        type?: string;
        icon?: string;
        retainContextWhenHidden?: boolean;
      }>
    >;
    configuration?:
      | Array<{ properties: Record<string, unknown> }>
      | { properties: Record<string, unknown> };
  };
};

/** Exact contribute inventory — lightweight core only (chart + run + secrets). */
const EXPECTED_COMMANDS = [
  'axis.openChart',
  'axis.runScript',
  'axis.runScriptSilent',
  'axis.secrets.setProKey',
  'axis.secrets.setWorkerKey',
  'axis.secrets.clear',
  'axis.stopRun',
  'axis.showRunOutput',
  'axis.pickData',
  'axis.debug.start',
  'axis.debug.stepBar',
  'axis.debug.toggleBarBreakpoint',
  'axis.openWalkthroughFixture',
] as const;
const EXPECTED_SETTINGS = [
  'axis.telemetry.offline',
  'axis.engine.endpoint',
  'axis.engine.allowRemoteEndpoint',
  'axis.engine.allowPyodide',
  'axis.engine.pyodideWheelUrl',
  'axis.chart.historyBars',
  'axis.chart.useMockBars',
  'axis.datafeed.url',
] as const;
/** Must never appear as contributes.configuration — SecretStorage only (KD-8). */
const FORBIDDEN_SETTINGS = ['axis.worker.apiKey', 'axis.pro.apiKey'] as const;
const EXPECTED_WORKSPACE_CONTAINS = ['workspaceContains:**/*.axis.json'] as const;
const ALLOWED_CONTRIBUTE_KEYS = new Set([
  'commands',
  'configuration',
  'customEditors',
  'menus',
  'keybindings',
  'debuggers',
  'breakpoints',
  'walkthroughs',
]);
const EXPECTED_KEYBINDINGS = [
  {
    command: 'axis.runScript',
    key: 'ctrl+enter',
    mac: 'cmd+enter',
  },
  {
    command: 'axis.stopRun',
    key: 'ctrl+enter',
    mac: 'cmd+enter',
  },
] as const;
const EXPECTED_CUSTOM_EDITORS = [
  {
    viewType: CHART_VIEW_TYPE,
    displayName: 'AXIS Chart',
    filenamePattern: '*.axis.json',
    priority: 'default',
  },
] as const;

const PYNE_EXT_ID = 'hoox-sh.pyne';
const PYNE_RECOMMENDED_MIN = '0.5.8';

suite('AXIS IDE Extension Structure', () => {
  test('package.json identity', () => {
    assert.strictEqual(pkg.name, 'axis-ide');
    assert.strictEqual(pkg.publisher, 'hoox-sh');
    assert.strictEqual(pkg.displayName, 'AXIS IDE');
    assert.strictEqual(pkg.license, 'AGPL-3.0-only');
    assert.ok(/^\d+\.\d+\.\d+$/.test(pkg.version), 'package.json version must be semver');
    assert.ok(pkg.icon, 'package.json must declare icon');
    assert.ok(
      fs.existsSync(path.resolve(__dirname, '../../', pkg.icon)),
      `icon missing on disk: ${pkg.icon}`,
    );
    const iconBytes = fs.statSync(path.resolve(__dirname, '../../', pkg.icon));
    assert.ok(
      iconBytes.size >= 20_000,
      'marketplace icon should match PYNE media/icon.png (HOOX mark, ~38KB)',
    );
  });

  test('extensionDependencies includes hoox-sh.pyne (id-only)', () => {
    const deps = pkg.extensionDependencies ?? [];
    assert.ok(deps.includes(PYNE_EXT_ID), `Missing ${PYNE_EXT_ID}`);
    for (const id of deps) {
      assert.ok(!/[<>=]/.test(id), `extensionDependencies must be id-only, got: ${id}`);
    }
  });

  test('activationEvents: no onStartupFinished; onCommand + onCustomEditor + workspaceContains', () => {
    const events = pkg.activationEvents ?? [];
    assert.ok(!events.includes('onStartupFinished'), 'must not use onStartupFinished');
    assert.ok(
      events.includes(`onCustomEditor:${CHART_VIEW_TYPE}`),
      `missing onCustomEditor:${CHART_VIEW_TYPE}`,
    );
    for (const id of EXPECTED_COMMANDS) {
      assert.ok(
        events.includes(`onCommand:${id}`),
        `missing onCommand activation for ${id}`,
      );
    }
    for (const glob of EXPECTED_WORKSPACE_CONTAINS) {
      assert.ok(events.includes(glob), `missing activationEvent ${glob}`);
    }
    assert.deepStrictEqual(
      [...events].sort(),
      [
        ...EXPECTED_COMMANDS.map((id) => `onCommand:${id}`),
        `onCustomEditor:${CHART_VIEW_TYPE}`,
        'onDebug:axis-bar',
        ...EXPECTED_WORKSPACE_CONTAINS,
      ].sort(),
      'activationEvents inventory drifted',
    );
  });

  test('contributes customEditors axis.chart for *.axis.json (KD-4)', () => {
    assert.strictEqual(CHART_VIEW_TYPE, 'axis.chart');
    const editors = pkg.contributes?.customEditors ?? [];
    assert.strictEqual(editors.length, EXPECTED_CUSTOM_EDITORS.length);
    for (const expected of EXPECTED_CUSTOM_EDITORS) {
      const found = editors.find((e) => e.viewType === expected.viewType);
      assert.ok(found, `missing customEditor ${expected.viewType}`);
      assert.strictEqual(found?.displayName, expected.displayName);
      assert.strictEqual(found?.priority, 'default');
      const patterns = (found?.selector ?? []).map((s) => s.filenamePattern);
      assert.deepStrictEqual(
        patterns,
        [expected.filenamePattern],
        `${expected.viewType} selector must be exactly ${expected.filenamePattern}`,
      );
    }
  });

  test('no viewsContainers / views / MCP / LM tools in lightweight core', () => {
    assert.strictEqual(pkg.contributes?.viewsContainers, undefined);
    assert.strictEqual(pkg.contributes?.views, undefined);
    const asRecord = pkg.contributes as Record<string, unknown> | undefined;
    assert.strictEqual(asRecord?.mcpServerDefinitionProviders, undefined);
    assert.strictEqual(asRecord?.languageModelTools, undefined);
  });

  test('contributes expected commands (lightweight inventory)', () => {
    const commandIds = (pkg.contributes?.commands ?? []).map((c) => c.command);
    for (const id of EXPECTED_COMMANDS) {
      assert.ok(commandIds.includes(id), `Missing command: ${id}`);
    }
    assert.deepStrictEqual(
      [...commandIds].sort(),
      [...EXPECTED_COMMANDS].sort(),
      'command inventory drifted — update test when intentionally expanding contributes',
    );
  });

  test('contributes only allowed settings (no SecretStorage keys as config)', () => {
    const configuration = Array.isArray(pkg.contributes?.configuration)
      ? pkg.contributes.configuration
      : pkg.contributes?.configuration
        ? [pkg.contributes.configuration]
        : [];
    const settings = configuration.flatMap((group) => Object.keys(group.properties ?? {}));
    for (const key of EXPECTED_SETTINGS) {
      assert.ok(settings.includes(key), `Missing setting: ${key}`);
    }
    for (const key of FORBIDDEN_SETTINGS) {
      assert.ok(
        !settings.includes(key),
        `${key} must not be a configuration property — use axis.secrets.* → SecretStorage`,
      );
    }
    assert.deepStrictEqual(
      [...settings].sort(),
      [...EXPECTED_SETTINGS].sort(),
      'setting inventory drifted',
    );
  });

  test('contributes keys stay on the lightweight allowlist', () => {
    const keys = Object.keys(pkg.contributes ?? {});
    for (const key of keys) {
      assert.ok(
        ALLOWED_CONTRIBUTE_KEYS.has(key),
        `unexpected contributes.${key} — allowed: ${[...ALLOWED_CONTRIBUTE_KEYS].join('/')}`,
      );
    }
  });

  test('keybinding ctrl/cmd+enter → axis.runScript for pinescript', () => {
    const keybindings = (
      pkg.contributes as {
        keybindings?: Array<{ command: string; key?: string; mac?: string; when?: string }>;
      }
    )?.keybindings ?? [];
    assert.strictEqual(keybindings.length, EXPECTED_KEYBINDINGS.length);
    for (const expected of EXPECTED_KEYBINDINGS) {
      const found = keybindings.find((k) => k.command === expected.command);
      assert.ok(found, `missing keybinding for ${expected.command}`);
      assert.strictEqual(found?.key, expected.key);
      assert.strictEqual(found?.mac, expected.mac);
      assert.ok(found?.when?.includes('pinescript'), `${expected.command} when must include pinescript`);
      assert.ok(found?.when?.includes('.pyne'), `${expected.command} when must include .pyne`);
    }
  });

  test('editor/title menu includes openChart + runScript for pinescript', () => {
    const menus = (pkg.contributes as { menus?: Record<string, Array<{ command: string; when?: string }>> })
      ?.menus;
    const title = menus?.['editor/title'] ?? [];
    const open = title.find((e) => e.command === 'axis.openChart');
    assert.ok(open, 'editor/title must contribute axis.openChart');
    assert.ok(open?.when?.includes('pinescript'));
    assert.ok(open?.when?.includes('.pyne'));
    const run = title.find((e) => e.command === 'axis.runScript');
    assert.ok(run, 'editor/title must contribute axis.runScript');
    assert.ok(run?.when?.includes('!axis.run.running'));
    const stop = title.find((e) => e.command === 'axis.stopRun');
    assert.ok(stop, 'editor/title must contribute axis.stopRun');
    assert.ok(stop?.when?.includes('axis.run.running'));
  });

  test('context menus cover editor and explorer only (no view menus)', () => {
    const menus = (
      pkg.contributes as {
        menus?: Record<string, Array<{ command: string; when?: string }>>;
      }
    )?.menus;
    const editorCtx = menus?.['editor/context'] ?? [];
    assert.ok(
      editorCtx.some(
        (e) =>
          e.command === 'axis.runScript' &&
          Boolean(e.when?.includes('pinescript') && e.when.includes('.pyne')),
      ),
      'editor/context runScript',
    );
    const explorer = menus?.['explorer/context'] ?? [];
    assert.ok(
      explorer.some(
        (e) =>
          e.command === 'axis.openChart' &&
          Boolean(e.when?.includes('pinescript') && e.when.includes('.pyne')),
      ),
      'explorer/context openChart',
    );
    assert.strictEqual(menus?.['view/title'], undefined);
    assert.strictEqual(menus?.['view/item/context'], undefined);
    assert.strictEqual(menus?.['webview/context'], undefined);
  });

  test('commandPalette includes axis.runScriptSilent for pinescript', () => {
    const menus = (pkg.contributes as { menus?: Record<string, Array<{ command: string; when?: string }>> })
      ?.menus;
    const palette = menus?.commandPalette ?? [];
    const silent = palette.find((e) => e.command === 'axis.runScriptSilent');
    assert.ok(silent, 'commandPalette must contribute axis.runScriptSilent');
    assert.ok(silent?.when?.includes('pinescript'));
    assert.ok(silent?.when?.includes('.pyne'));
    const show = palette.find((e) => e.command === 'axis.showRunOutput');
    assert.ok(show, 'commandPalette must contribute axis.showRunOutput');
  });
});

suite('AXIS IDE Extension Activation', () => {
  test('activates and registers commands including axis.secrets.*', async () => {
    const ext = vscode.extensions.getExtension('hoox-sh.axis-ide');
    assert.ok(ext, 'hoox-sh.axis-ide should load under extensionDevelopmentPath');
    await ext.activate();
    assert.ok(ext.isActive);

    const commands = await vscode.commands.getCommands(true);
    for (const id of EXPECTED_COMMANDS) {
      assert.ok(commands.includes(id), `Command not registered: ${id}`);
    }
  });

  test('axis.openChart without active Pine returns clear error (no await UI)', async () => {
    // No Pine buffer in the default electron workspace — expect the no-Pine path.
    const result = await vscode.commands.executeCommand('axis.openChart');
    assert.strictEqual(result, OPEN_CHART_NO_PINE_MESSAGE);
  });

  test('axis.runScript without active Pine returns clear error (no await UI)', async () => {
    const result = await vscode.commands.executeCommand('axis.runScript');
    assert.strictEqual(result, RUN_NO_PINE_MESSAGE);
  });

  test('default axis.chart.useMockBars is false (HistoryClient dogfood)', () => {
    const config = vscode.workspace.getConfiguration('axis.chart');
    assert.strictEqual(config.get('useMockBars'), false);
  });

  test('default axis.datafeed.url is loopback :5003', () => {
    const config = vscode.workspace.getConfiguration('axis.datafeed');
    assert.strictEqual(config.get('url'), 'http://127.0.0.1:5003');
  });

  test('default axis.engine.endpoint / allowRemoteEndpoint', () => {
    const config = vscode.workspace.getConfiguration('axis.engine');
    assert.strictEqual(config.get('endpoint'), 'http://127.0.0.1:5002');
    assert.strictEqual(config.get('allowRemoteEndpoint'), false);
  });

  test('capabilities declare untrusted and virtual workspaces unsupported', () => {
    const caps = (
      pkg as {
        capabilities?: {
          untrustedWorkspaces?: { supported?: boolean };
          virtualWorkspaces?: { supported?: boolean };
        };
      }
    ).capabilities;
    assert.strictEqual(caps?.untrustedWorkspaces?.supported, false);
    assert.strictEqual(caps?.virtualWorkspaces?.supported, false);
  });

  test('axis.engine.allowRemoteEndpoint is application-scoped (not workspace)', () => {
    const configuration = Array.isArray(pkg.contributes?.configuration)
      ? pkg.contributes.configuration
      : pkg.contributes?.configuration
        ? [pkg.contributes.configuration]
        : [];
    const props = configuration.flatMap((group) =>
      Object.entries(group.properties ?? {}),
    );
    const entry = props.find(([key]) => key === 'axis.engine.allowRemoteEndpoint');
    assert.ok(entry, 'missing axis.engine.allowRemoteEndpoint');
    const meta = entry?.[1] as { scope?: string; default?: boolean };
    assert.strictEqual(meta.scope, 'application');
    assert.strictEqual(meta.default, false);
  });

  test('axis.engine.allowPyodide defaults true (Wave 1)', () => {
    const configuration = Array.isArray(pkg.contributes?.configuration)
      ? pkg.contributes.configuration
      : pkg.contributes?.configuration
        ? [pkg.contributes.configuration]
        : [];
    const props = configuration.flatMap((group) => Object.entries(group.properties ?? {}));
    const entry = props.find(([key]) => key === 'axis.engine.allowPyodide');
    assert.ok(entry, 'missing axis.engine.allowPyodide');
    const meta = entry?.[1] as { default?: boolean };
    assert.strictEqual(meta.default, true);
  });

  test('walkthrough axis.firstPlot ships fixtures', () => {
    const walks = (
      pkg.contributes as {
        walkthroughs?: Array<{ id: string; steps?: Array<{ id: string }> }>;
      }
    )?.walkthroughs ?? [];
    const first = walks.find((w) => w.id === 'axis.firstPlot');
    assert.ok(first, 'missing walkthrough axis.firstPlot');
    assert.ok(first?.steps?.some((s) => s.id === 'axis.firstPlot.open'));
    assert.ok(first?.steps?.some((s) => s.id === 'axis.firstPlot.run'));
    const root = path.resolve(__dirname, '../../');
    assert.ok(fs.existsSync(path.join(root, 'fixtures', 'orb.pine')));
    assert.ok(fs.existsSync(path.join(root, 'fixtures', 'orb.axis.json')));
    assert.ok(fs.existsSync(path.join(root, 'media', 'walkthrough-first-plot.md')));
  });

  test('default axis.telemetry.offline is true', () => {
    const config = vscode.workspace.getConfiguration('axis');
    assert.strictEqual(config.get('telemetry.offline'), true);
  });

  test('warns (does not fail) if installed PYNE is older than recommended', () => {
    const pyne = vscode.extensions.getExtension(PYNE_EXT_ID);
    if (!pyne) {
      console.warn(
        `[axis-ide test] ${PYNE_EXT_ID} not present in this run; skip version warn check.`,
      );
      return;
    }
    const ver = String(pyne.packageJSON?.version ?? '');
    if (ver && isVersionOlderThan(ver, PYNE_RECOMMENDED_MIN)) {
      console.warn(
        `[axis-ide test] ${PYNE_EXT_ID} ${ver} < recommended ${PYNE_RECOMMENDED_MIN} (warn only).`,
      );
    }
    // Never hard-fail on PYNE semver — extensionDependencies is id-only.
    assert.ok(true);
  });
});
