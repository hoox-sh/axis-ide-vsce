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
import {
  buildChartCspDirectives,
  buildChartWebviewHtml,
  escapeHtmlAttr,
  htmlHasInlineScript,
} from './chart-html';

const CSP_SOURCE = 'https://csp.example.vscode-webview.test';

describe('chart CSP HTML builder', () => {
  test('embeds cspSource in CSP directives and has no inline script', () => {
    const html = buildChartWebviewHtml({
      cspSource: CSP_SOURCE,
      scriptUri: `${CSP_SOURCE}/main.js`,
      styleUri: `${CSP_SOURCE}/main.css`,
      bodyClass: 'vscode-dark',
    });

    expect(html).toContain(`script-src ${CSP_SOURCE}`);
    expect(html).not.toContain("script-src 'unsafe-inline'");
    expect(html).not.toContain('script-src *');
    expect(html).not.toContain("'wasm-unsafe-eval'");
    expect(html).not.toContain('worker-src');
    expect(html).toContain(`style-src ${CSP_SOURCE} 'unsafe-inline'`);
    expect(html).toContain(`img-src ${CSP_SOURCE} data: blob:`);
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("base-uri 'none'");
    expect(html).toContain("form-action 'none'");
    expect(html).toContain("connect-src 'none'");
    expect(html).not.toContain('data-axis-pyodide-cdn');
    expect(html).toContain(`src="${CSP_SOURCE}/main.js"`);
    expect(html).toContain(`href="${CSP_SOURCE}/main.css"`);
    expect(html).toContain('id="chart-host"');
    expect(html).toContain('id="chart-toolbar"');
    expect(html).toContain('aria-label="Chart tools"');
    expect(html).toContain('id="tool-trendline"');
    expect(html).toContain('title="Trendline"');
    expect(html).toContain('id="tool-layers"');
    expect(html).toContain('id="tool-data"');
    expect(html).toContain('id="tool-legend"');
    expect(html).toContain('id="tool-fullscreen"');
    expect(html).toContain('id="tool-open-source"');
    expect(html).toContain('id="tool-live-safe"');
    expect(html).toContain('id="chart-legend"');
    expect(html).toContain('id="chart-layers"');
    expect(html).toContain('id="chart-data-window"');
    expect(html).toContain('id="chart-mark"');
    expect(html).toContain('id="chart-hud"');
    expect(html).toContain('id="chart-plot-count"');
    expect(html).toContain('id="chart-plugins"');
    expect(html).toContain('class="chart-plugins"');
    expect(html).toContain('aria-hidden="true"');
    expect(html.toLowerCase()).not.toContain('tradingview');
    expect(html).toContain('id="drawing-overlay"');
    expect(html).toContain('id="chart-toggle-inputs"');
    expect(html).toContain('id="chart-toggle-strategy"');
    expect(html).toContain('id="chart-inputs"');
    expect(html).toContain('id="chart-inputs-apply"');
    expect(html).toContain('id="chart-strategy"');
    expect(html).toContain('id="chart-strategy-csv"');
    expect(html).toContain('id="chart-engine-tables"');
    expect(html).toContain('id="chart-window-chip"');
    expect(html).toContain('id="chart-alerts-chip"');
    expect(html).toContain('data-chrome="inputs"');
    expect(html).toContain('data-chrome="strategy"');
    expect(html).toContain('class="vscode-dark"');
    expect(htmlHasInlineScript(html)).toBe(false);
    expect(html.includes('<script>')).toBe(false);
  });

  test('default CSP directives omit Pyodide widen', () => {
    const csp = buildChartCspDirectives(CSP_SOURCE).join('; ');
    expect(csp).toBe(
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
    expect(csp).not.toContain('wasm-unsafe-eval');
    expect(csp).not.toContain('worker-src');
  });

  test('allowPyodide widens script-src, connect-src CDN, and worker-src blob:', () => {
    const directives = buildChartCspDirectives(CSP_SOURCE, true);
    const csp = directives.join('; ');
    expect(csp).toContain(`script-src ${CSP_SOURCE} 'wasm-unsafe-eval' https://cdn.jsdelivr.net`);
    expect(csp).toContain(`worker-src blob: ${CSP_SOURCE}`);
    expect(csp).toContain('connect-src https://cdn.jsdelivr.net');
    expect(csp).not.toContain("connect-src 'none'");

    const html = buildChartWebviewHtml({
      cspSource: CSP_SOURCE,
      scriptUri: `${CSP_SOURCE}/main.js`,
      styleUri: `${CSP_SOURCE}/main.css`,
      bodyClass: 'vscode-dark',
      allowPyodide: true,
    });
    expect(html).toContain(`script-src ${CSP_SOURCE} 'wasm-unsafe-eval' https://cdn.jsdelivr.net`);
    expect(html).toContain(`worker-src blob: ${CSP_SOURCE}`);
    expect(html).toContain('data-axis-pyodide-cdn="https://cdn.jsdelivr.net/pyodide/v0.29.5/full/"');
    expect(htmlHasInlineScript(html)).toBe(false);
  });

  test('escapes URI attribute characters', () => {
    const html = buildChartWebviewHtml({
      cspSource: CSP_SOURCE,
      scriptUri: 'https://x.test/a"onclick=alert(1)',
      styleUri: 'https://x.test/b<script>',
      bodyClass: 'vscode-dark',
    });
    const escapedScript = escapeHtmlAttr('https://x.test/a"onclick=alert(1)');
    expect(html).toContain(`src="${escapedScript}"`);
    // Quote is escaped so the URI cannot break out of the attribute.
    expect(escapedScript).toContain('&quot;');
    expect(html).not.toContain('src="https://x.test/a"onclick');
    expect(html).toContain('&lt;script&gt;');
  });

  test('strips unsafe body class characters', () => {
    const html = buildChartWebviewHtml({
      cspSource: CSP_SOURCE,
      scriptUri: 'a.js',
      styleUri: 'a.css',
      bodyClass: 'vscode-dark"><script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('class="vscode-darkscriptalert1script"');
  });

  test('htmlHasInlineScript detects body-bearing tags but allows src scripts', () => {
    expect(htmlHasInlineScript('<script>alert(1)</script>')).toBe(true);
    expect(htmlHasInlineScript('<script type="text/javascript">x()</script>')).toBe(true);
    expect(htmlHasInlineScript('<script src="x.js"></script>')).toBe(false);
    expect(htmlHasInlineScript('<script type="module" src="x.js"></script>')).toBe(false);
  });
});
