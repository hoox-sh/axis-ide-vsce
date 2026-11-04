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
import { buildChartWebviewHtml } from '../editors/chart-html';

import { buildStudioHtml, escapeHtmlAttr, htmlHasInlineScript } from './studio-html';

const CSP_SOURCE = 'https://csp.example.vscode-webview.test';
const SCRIPT_URI = `${CSP_SOURCE}/main.js`;
const STYLE_URI = `${CSP_SOURCE}/main.css`;

/** Extract the escaped CSP attribute value from a built shell. */
function cspAttr(html: string): string {
  const match = /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html);
  return match?.[1] ?? '';
}

function shellHtml(bodyClass: string, bodyHtml = '', nonce?: string): string {
  return buildStudioHtml({
    cspSource: CSP_SOURCE,
    scriptUri: SCRIPT_URI,
    styleUri: STYLE_URI,
    bodyClass,
    bodyHtml,
    ...(nonce === undefined ? {} : { nonce }),
  });
}

describe('buildStudioHtml CSP parity', () => {
  test('nonce shell CSP is the paint-only matrix with the nonce on script-src', () => {
    const nonce = 'Abc123+/=_-xyz';
    const studio = shellHtml('vscode-light', '', nonce);
    // The colors builder (deleted in the Phase-2 colors migration) was the
    // reference for this matrix; its CSP was the same directive list, so the
    // assertion pins the matrix itself.
    expect(cspAttr(studio)).toBe(
      [
        "default-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        `script-src 'nonce-${nonce}' ${CSP_SOURCE}`,
        `style-src ${CSP_SOURCE} 'unsafe-inline'`,
        `img-src ${CSP_SOURCE} data: blob:`,
        "connect-src 'none'",
      ].join('; '),
    );
    expect(studio).not.toContain("script-src 'unsafe-inline'");
  });

  test('nonce-free shell CSP matches the canonical paint-only matrix', () => {
    const studio = shellHtml('vscode-dark');
    expect(cspAttr(studio)).toBe(
      [
        "default-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        `script-src ${CSP_SOURCE}`,
        `style-src ${CSP_SOURCE} 'unsafe-inline'`,
        `img-src ${CSP_SOURCE} data: blob:`,
        "connect-src 'none'",
      ].join('; '),
    );
  });

  test('full directive list is the chart paint-only matrix', () => {
    const studio = shellHtml('vscode-dark');
    expect(cspAttr(studio)).toBe(
      [
        "default-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        `script-src ${CSP_SOURCE}`,
        `style-src ${CSP_SOURCE} 'unsafe-inline'`,
        `img-src ${CSP_SOURCE} data: blob:`,
        "connect-src 'none'",
      ].join('; '),
    );
    const chart = buildChartWebviewHtml({
      cspSource: CSP_SOURCE,
      scriptUri: SCRIPT_URI,
      styleUri: STYLE_URI,
      bodyClass: 'vscode-dark',
    });
    expect(cspAttr(studio)).toBe(cspAttr(chart));
  });
});

describe('buildStudioHtml shell', () => {
  test('emits theme + registry classes, noscript, body markup, and a nonce script tag', () => {
    const html = shellHtml(
      'vscode-high-contrast axis-studio',
      '<section id="colors-root" class="colors-root" data-axis-colors-host="1"></section>',
      'n0nce',
    );
    expect(html).toContain('class="vscode-high-contrast axis-studio"');
    expect(html).toContain('<noscript>AXIS panels need JavaScript enabled.</noscript>');
    expect(html).toContain('<title>AXIS Studio</title>');
    expect(html).toContain('<section id="colors-root"');
    expect(html).toContain('data-axis-colors-host="1"');
    expect(html).toContain(`nonce="n0nce" src="${SCRIPT_URI}"`);
    expect(html).toContain(`href="${STYLE_URI}"`);
    expect(htmlHasInlineScript(html)).toBe(false);
  });

  test('without a nonce the script tag matches the logs builder form', () => {
    const html = shellHtml('vscode-dark');
    expect(html).toContain(`<script src="${SCRIPT_URI}"></script>`);
    expect(html).not.toContain('nonce=');
    expect(htmlHasInlineScript(html)).toBe(false);
  });

  test('refuses a body that carries an inline script', () => {
    const html = shellHtml('vscode-dark', '<p>x</p><script>alert(1)</script>');
    expect(html).toContain('AXIS studio shell failed to build.');
    expect(html).not.toContain('Content-Security-Policy');
    expect(html).not.toContain(SCRIPT_URI);
    expect(htmlHasInlineScript(html)).toBe(false);
  });

  test('external src script tags in a body pass the guard', () => {
    const html = shellHtml('vscode-dark', '<div><script src="side.js"></script></div>');
    expect(html).toContain('<script src="side.js"></script>');
    expect(html).toContain(SCRIPT_URI);
  });

  test('sanitizes nonce and strips hostile class tokens', () => {
    const html = buildStudioHtml({
      cspSource: CSP_SOURCE,
      nonce: 'ab c"def<script>',
      scriptUri: 'https://x.test/a"onclick=alert(1)',
      styleUri: 'https://x.test/b<script>',
      bodyClass: 'vscode-dark"><script>',
      bodyHtml: '',
    });
    expect(html).toContain("script-src 'nonce-abcdefscript' ");
    expect(html).toContain('nonce="abcdefscript"');
    expect(html).toContain(escapeHtmlAttr('https://x.test/a"onclick=alert(1)'));
    expect(html).not.toContain('src="https://x.test/a"onclick');
    expect(html).toContain(escapeHtmlAttr('https://x.test/b<script>'));
    expect(html).toContain('class="vscode-darkscript"');
    expect(htmlHasInlineScript(html)).toBe(false);
  });

  test('multi-token classes keep token boundaries and blank classes default', () => {
    const html = shellHtml(' vscode-light axis! studio ');
    expect(html).toContain('class="vscode-light axis studio"');
    const blank = shellHtml('   ');
    expect(blank).toContain('class="vscode-dark"');
  });

  test('empty options still build a CSP shell with defaults', () => {
    const html = buildStudioHtml({} as never);
    expect(html).toContain('Content-Security-Policy');
    expect(html).toContain('script-src ;');
    expect(html).toContain("style-src  'unsafe-inline'");
    expect(html).toContain('class="vscode-dark"');
    expect(html).toContain('<noscript>AXIS panels need JavaScript enabled.</noscript>');
    expect(htmlHasInlineScript(html)).toBe(false);
  });

  test('nullish, array, and non-object options coerce to the default shell', () => {
    for (const opts of [undefined, null, [], 1, 'studio'] as const) {
      const html = buildStudioHtml(opts as never);
      // Same contract as `{}`: defaults shell, never the loud fallback —
      // the provider always passes a real options object in production.
      expect(html).toContain('Content-Security-Policy');
      expect(html).toContain('class="vscode-dark"');
      expect(html).not.toContain('AXIS studio shell failed to build.');
      expect(htmlHasInlineScript(html)).toBe(false);
    }
  });

  test('hostile getters fall back without echoing values', () => {
    const cspBoom = buildStudioHtml({
      get cspSource(): string {
        throw new Error('csp');
      },
      scriptUri: 'SECRET.js',
      styleUri: 'a.css',
      bodyClass: 'vscode-dark',
      bodyHtml: '',
    });
    expect(cspBoom).toContain('AXIS studio shell failed to build.');
    expect(cspBoom).not.toContain('Content-Security-Policy');
    expect(cspBoom).not.toContain('SECRET.js');

    expect(
      buildStudioHtml({
        cspSource: CSP_SOURCE,
        get nonce(): string {
          throw new Error('nonce');
        },
        scriptUri: 'a.js',
        styleUri: 'a.css',
        bodyClass: 'b',
        bodyHtml: '',
      }),
    ).not.toContain('Content-Security-Policy');

    expect(
      buildStudioHtml({
        cspSource: CSP_SOURCE,
        nonce: 'n',
        get scriptUri(): string {
          throw new Error('script');
        },
        styleUri: 'a.css',
        bodyClass: 'b',
        bodyHtml: '',
      }),
    ).not.toContain('a.css');

    expect(
      buildStudioHtml({
        cspSource: CSP_SOURCE,
        nonce: 'n',
        scriptUri: 'a.js',
        get styleUri(): string {
          throw new Error('style');
        },
        bodyClass: 'b',
        bodyHtml: '',
      }),
    ).not.toContain('src="a.js"');

    expect(
      buildStudioHtml({
        cspSource: CSP_SOURCE,
        nonce: 'n',
        scriptUri: 'a.js',
        styleUri: 'a.css',
        bodyClass: 'b',
        get bodyHtml(): string {
          throw new Error('body');
        },
      }),
    ).not.toContain('Content-Security-Policy');

    expect(
      buildStudioHtml({
        cspSource: CSP_SOURCE,
        nonce: 'n',
        scriptUri: 'a.js',
        styleUri: 'a.css',
        get bodyClass(): string {
          throw new Error('class');
        },
        bodyHtml: '',
      }),
    ).not.toContain('Content-Security-Policy');
  });

  test('re-exports the chart-html helpers unchanged', () => {
    expect(escapeHtmlAttr('<"a&b>')).toBe('&lt;&quot;a&amp;b&gt;');
    expect(htmlHasInlineScript('<script src="a.js"></script>')).toBe(false);
    expect(htmlHasInlineScript('<script>alert(1)</script>')).toBe(true);
  });
});
