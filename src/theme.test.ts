// Copyright (C) 2026 jango_blockchained
// SPDX-License-Identifier: AGPL-3.0-only

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';

const root = join(import.meta.dir, '..');

type ThemeFile = {
  name?: string;
  type?: string;
  colors?: Record<string, string>;
  tokenColors?: Array<{ scope?: string | string[]; settings?: { foreground?: string } }>;
  semanticTokenColors?: Record<string, string>;
};

function load(name: string): ThemeFile {
  return JSON.parse(readFileSync(join(root, 'themes', name), 'utf8')) as ThemeFile;
}

function scopesOf(theme: ThemeFile): string[] {
  const out: string[] = [];
  for (const rule of theme.tokenColors ?? []) {
    const scope = rule.scope;
    if (typeof scope === 'string') out.push(scope);
    else if (Array.isArray(scope)) out.push(...scope);
  }
  return out;
}

describe('HOOX AXIS color themes', () => {
  test('package contributes a dark and a light theme', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      contributes?: { themes?: Array<{ label: string; uiTheme: string; path: string }> };
    };
    const themes = pkg.contributes?.themes ?? [];
    expect(themes.map((t) => t.label)).toEqual(['HOOX AXIS', 'HOOX AXIS Light']);
    expect(themes.map((t) => t.uiTheme)).toEqual(['vs-dark', 'vs']);
    expect(themes.map((t) => t.path)).toEqual([
      './themes/hoox-axis-dark-color-theme.json',
      './themes/hoox-axis-light-color-theme.json',
    ]);
  });

  test('dark theme colors pine scopes, series tokens, and chart greens/reds', () => {
    const theme = load('hoox-axis-dark-color-theme.json');
    expect(theme.name).toBe('HOOX AXIS');
    expect(theme.type).toBe('dark');
    expect(theme.colors?.['editor.background']).toBe('#090b12');
    expect(theme.colors?.['charts.green']).toBe('#3ddc97');
    expect(theme.colors?.['charts.red']).toBe('#f07178');
    const scopes = scopesOf(theme);
    for (const scope of [
      'variable.language.series.pinescript',
      'support.function.plot.pinescript',
      'keyword.control.flow.pinescript',
      'constant.language.na.pinescript',
      'comment.line.double-slash.pinescript',
    ]) {
      expect(scopes).toContain(scope);
    }
    expect(theme.semanticTokenColors?.series).toBe('#8b9cff');
    expect(theme.semanticTokenColors?.['*.simple']).toBe('#c4b5fd');
  });

  test('light theme keeps the same pine scopes on a light surface', () => {
    const theme = load('hoox-axis-light-color-theme.json');
    expect(theme.type).toBe('light');
    expect(theme.colors?.['editor.background']).toBe('#fbfbfe');
    expect(theme.colors?.['charts.green']).toBe('#0c7a52');
    expect(scopesOf(theme)).toContain('support.function.builtin.pinescript');
    expect(theme.semanticTokenColors?.series).toBe('#3d4fd4');
  });
});
