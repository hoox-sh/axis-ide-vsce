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
import { htmlHasInlineScript } from './studio-html';
import type { StudioProviderDeps, StudioViewHost } from './studio-provider';
import type { StudioRegistration } from './studio-registry';
import {
  TOOLBOX_STUDIO_TITLE,
  TOOLBOX_STUDIO_VIEW_ID,
  buildToolboxStudioBody,
  buildToolboxStudioRegistration,
  defaultToolboxRestore,
  registerToolbox,
  toolboxDataFromActiveEditor,
  toolboxDocumentNeedsRefresh,
  toolboxInsertSymbolPositions,
} from './toolbox-studio';

describe('toolbox studio constants and markup', () => {
  test('exports the consolidated view id and title', () => {
    expect(TOOLBOX_STUDIO_VIEW_ID).toBe('axis.toolbox');
    expect(TOOLBOX_STUDIO_TITLE).toBe('Toolbox');
  });

  test('buildToolboxStudioBody emits a tabbed mount point without inline script', () => {
    const body = buildToolboxStudioBody();
    expect(body).toContain('<section id="toolbox-root"');
    expect(body).toContain('data-axis-toolbox-host="1"');
    expect(body).toContain('data-tab="colors"');
    expect(body).toContain('data-tab="symbols"');
    expect(body).toContain('toolbox-panel-colors');
    expect(body).toContain('toolbox-panel-symbols');
    expect(htmlHasInlineScript(body)).toBe(false);
  });
});

describe('toolbox studio data helpers', () => {
  function editor(text: string, languageId = 'pinescript'): Parameters<typeof toolboxDataFromActiveEditor>[0] {
    return {
      document: {
        languageId,
        getText: () => text,
        fileName: 'x.pyne',
        uri: { fsPath: 'x.pyne' },
      },
    };
  }

  test('toolboxDataFromActiveEditor composes colors and symbols', () => {
    const data = toolboxDataFromActiveEditor(editor('color.red'), 'colors');
    expect(data.activeTab).toBe('colors');
    expect(data.tabs.colors.sourceLabel).toBe('x.pyne');
    expect(data.tabs.symbols.symbols.length).toBeGreaterThan(0);
  });

  test('defaultToolboxRestore mirrors the same composite shape', () => {
    const data = defaultToolboxRestore(editor('#fff'), 'symbols');
    expect(data.activeTab).toBe('symbols');
    expect(data.tabs.colors.colors).toEqual([{ line: 1, column: 1, raw: '#fff', swatch: '#fff' }]);
    expect(data.tabs.symbols.symbols.length).toBeGreaterThan(0);
  });

  test('toolboxDocumentNeedsRefresh delegates to the colors guard', () => {
    const pine = editor('color.red');
    expect(toolboxDocumentNeedsRefresh(pine, pine?.document)).toBe(true);
    expect(toolboxDocumentNeedsRefresh(pine, {})).toBe(false);
  });

  test('toolboxInsertSymbolPositions returns distinct active positions', () => {
    const positions = toolboxInsertSymbolPositions({
      selections: [{ active: { line: 1, character: 0 } }, { active: { line: 2, character: 5 } }],
      selection: { active: { line: 9, character: 9 } },
    });
    expect(positions).toEqual([
      { line: 1, character: 0 },
      { line: 2, character: 5 },
    ]);
  });
});

describe('buildToolboxStudioRegistration', () => {
  function makeDeps(): {
    deps: {
      revealColorLine: (line: number) => void;
      copyColorText: (text: string) => void;
      refreshColors: () => void;
      insertSymbolText: (text: string) => void;
      copySymbolText: (text: string) => void;
      restore: () => { activeTab: 'colors' | 'symbols'; tabs: unknown };
    };
    calls: { method: string; arg: unknown }[];
  } {
    const calls: { method: string; arg: unknown }[] = [];
    const deps = {
      revealColorLine: (line: number) => calls.push({ method: 'revealColorLine', arg: line }),
      copyColorText: (text: string) => calls.push({ method: 'copyColorText', arg: text }),
      refreshColors: () => calls.push({ method: 'refreshColors', arg: undefined }),
      insertSymbolText: (text: string) => calls.push({ method: 'insertSymbolText', arg: text }),
      copySymbolText: (text: string) => calls.push({ method: 'copySymbolText', arg: text }),
      restore: () => ({
        activeTab: 'colors' as const,
        tabs: {
          colors: { colors: [], sourceLabel: '' },
          symbols: { symbols: [], query: '', category: '' },
        },
      }),
    };
    return { deps, calls };
  }

  test('registers the correct view metadata and body', () => {
    const { deps } = makeDeps();
    const reg = buildToolboxStudioRegistration(deps);
    expect(reg.id).toBe('toolbox');
    expect(reg.viewId).toBe('axis.toolbox');
    expect(reg.title).toBe('Toolbox');
    expect(reg.retainContextWhenHidden).toBe(false);
    expect(reg.buildBody?.()).toContain('toolbox-root');
  });

  test('restore() returns the injected data', () => {
    const { deps } = makeDeps();
    const reg = buildToolboxStudioRegistration(deps);
    expect(reg.restore?.()).toEqual({
      activeTab: 'colors',
      tabs: {
        colors: { colors: [], sourceLabel: '' },
        symbols: { symbols: [], query: '', category: '' },
      },
    });
  });

  test('action handlers dispatch valid arguments only', () => {
    const { deps, calls } = makeDeps();
    const reg = buildToolboxStudioRegistration(deps);

    reg.actions?.selectTab?.({ tab: 'colors' }, { view: 'toolbox', action: 'selectTab' });
    expect(calls).toEqual([]);

    reg.actions?.revealColorLine?.({ line: 5 }, { view: 'toolbox', action: 'revealColorLine' });
    expect(calls[calls.length - 1]).toEqual({ method: 'revealColorLine', arg: 5 });

    reg.actions?.revealColorLine?.({ line: -1 }, { view: 'toolbox', action: 'revealColorLine' });
    // Invalid arg should be dropped, so the last call is still revealColorLine 5
    expect(calls[calls.length - 1]).toEqual({ method: 'revealColorLine', arg: 5 });

    reg.actions?.copyColorText?.({ text: '#fff' }, { view: 'toolbox', action: 'copyColorText' });
    expect(calls[calls.length - 1]).toEqual({ method: 'copyColorText', arg: '#fff' });

    reg.actions?.copyColorText?.({ text: '' }, { view: 'toolbox', action: 'copyColorText' });
    expect(calls[calls.length - 1]).toEqual({ method: 'copyColorText', arg: '#fff' });

    reg.actions?.refreshColors?.(undefined, { view: 'toolbox', action: 'refreshColors' });
    expect(calls[calls.length - 1]).toEqual({ method: 'refreshColors', arg: undefined });

    reg.actions?.insertSymbol?.({ text: '\u2191' }, { view: 'toolbox', action: 'insertSymbol' });
    expect(calls[calls.length - 1]).toEqual({ method: 'insertSymbolText', arg: '\u2191' });

    reg.actions?.insertSymbol?.({ text: '' }, { view: 'toolbox', action: 'insertSymbol' });
    expect(calls[calls.length - 1]).toEqual({ method: 'insertSymbolText', arg: '\u2191' });

    reg.actions?.copySymbolText?.({ text: '\u2605' }, { view: 'toolbox', action: 'copySymbolText' });
    expect(calls[calls.length - 1]).toEqual({ method: 'copySymbolText', arg: '\u2605' });
  });
});

describe('registerToolbox', () => {
  function makeHost(): { host: StudioViewHost; registrations: { id: string; options?: unknown }[] } {
    const registrations: { id: string; options?: unknown }[] = [];
    const host: StudioViewHost = {
      registerWebviewViewProvider: (id, _provider, options) => {
        registrations.push({ id, options });
        return { dispose() {} };
      },
    };
    return { host, registrations };
  }

  function makeDeps(): StudioProviderDeps {
    return {
      extensionUri: { fsPath: '/ext' },
      joinPath: (base, ...parts) => ({
        fsPath: `${(base as { fsPath: string }).fsPath}/${parts.join('/')}`,
      }),
      fsPath: (uri) => (uri as { fsPath: string }).fsPath,
      assetExists: () => true,
      themeBodyClass: () => 'vscode-dark',
      createNonce: () => 'nonce',
    };
  }

  function makeEntry(): StudioRegistration {
    return {
      id: 'toolbox',
      title: 'Toolbox',
      viewId: 'axis.toolbox',
      retainContextWhenHidden: false,
      buildBody: () => '<div>toolbox</div>',
      actions: {},
    };
  }

  test('wires the registration through the generic provider', () => {
    const { host, registrations } = makeHost();
    const context = { subscriptions: [] as Array<{ dispose(): void }> };
    const provider = registerToolbox(makeEntry(), makeDeps(), host, context);
    expect(provider).toBeTruthy();
    expect(registrations).toEqual([
      { id: 'axis.toolbox', options: { webviewOptions: { retainContextWhenHidden: false } } },
    ]);
    expect(context.subscriptions.length).toBe(1);
  });

  test('returns undefined and does not throw when registration fails', () => {
    const host: StudioViewHost = {
      registerWebviewViewProvider: () => {
        throw new Error('uncontributed');
      },
    };
    const context = { subscriptions: [] as Array<{ dispose(): void }> };
    expect(registerToolbox(makeEntry(), makeDeps(), host, context)).toBeUndefined();
  });
});
