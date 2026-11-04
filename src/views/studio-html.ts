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

import { escapeHtmlAttr, htmlHasInlineScript } from '../editors/chart-html';

/** Inputs for the generic panel-studio shell (URIs already asWebviewUri). */
export interface StudioHtmlOptions {
  /** `webview.cspSource` — never hard-code resource schemes here. */
  cspSource: string;
  /** Compiled `dist/webview/<id>/main.js`, already asWebviewUri'd. */
  scriptUri: string;
  /** Compiled `dist/webview/<id>/main.css`, already asWebviewUri'd. */
  styleUri: string;
  /** VS Code theme body class; ALWAYS emitted (defaults `vscode-dark`). */
  bodyClass: string;
  /** Trusted studio markup (registry `buildBody()` output). */
  bodyHtml: string;
  /** Per-document nonce. Included on `script-src` and the script tag only. */
  nonce?: string;
}

/** Paint-only fallback for hostile options — no CSP, no assets, no script. */
const FALLBACK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>AXIS Studio</title>
</head>
<body>
  <noscript>AXIS panels need JavaScript enabled.</noscript>
  <p>AXIS studio shell failed to build.</p>
</body>
</html>
`;

/** Nonce token safe to drop inside `'nonce-…'` without breaking the CSP attribute. */
function sanitizeNonce(raw: string): string {
  return raw.replace(/[^A-Za-z0-9+/=_-]/g, '');
}

/**
 * Keep class-token boundaries (theme class + optional registry class) and
 * strip each token like the per-studio builders do.
 */
function sanitizeBodyClass(raw: string): string {
  return raw
    .split(/\s+/)
    .map((token) => token.replace(/[^a-zA-Z0-9_-]/g, ''))
    .filter((token) => token.length > 0)
    .join(' ');
}

/**
 * CSP + HTML shell for every panel-studio webview — the single canonical
 * skeleton (enhancement plan §5 Phase 2). The CSP is byte-identical to the
 * current builders: with a nonce it matches colors/symbols/library
 * (`script-src 'nonce-…' ${cspSource}`), without one it matches
 * logs/results/chart (`script-src ${cspSource}`); `style-src` keeps
 * `'unsafe-inline'` for theme vars and `connect-src` stays `'none'`
 * (paint-only — the host proxies all network).
 *
 * `bodyClass` is ALWAYS emitted, closing the gap where the colors/symbols/
 * library shells can drop the theme class. Deliberate differences vs. the
 * per-studio builders: the `<noscript>` fallback body (no builder carries
 * one today); a static `<title>AXIS Studio</title>` (VS Code shows the
 * package.json view name, not this); no per-studio `data-axis-*-kind` body
 * attribute (studios stamp their own root markup via `buildBody()`); an
 * empty/whitespace nonce omits the nonce variant instead of emitting a
 * degenerate `'nonce-'` token; and a body carrying an inline script is
 * refused outright — the paint-only CSP forbids it anyway. Never throws.
 */
export function buildStudioHtml(opts?: StudioHtmlOptions | null): string {
  try {
    const rec =
      opts && typeof opts === 'object' && !Array.isArray(opts)
        ? opts
        : ({} as StudioHtmlOptions);
    const cspSource = String(rec.cspSource ?? '');
    const nonce = sanitizeNonce(String(rec.nonce ?? ''));
    const scriptUri = String(rec.scriptUri ?? '');
    const styleUri = String(rec.styleUri ?? '');
    const bodyClass = sanitizeBodyClass(String(rec.bodyClass ?? 'vscode-dark')) || 'vscode-dark';
    const bodyHtml = String(rec.bodyHtml ?? '');
    if (htmlHasInlineScript(bodyHtml)) {
      return FALLBACK_HTML;
    }

    const scriptSrc = nonce
      ? `script-src 'nonce-${nonce}' ${cspSource}`
      : `script-src ${cspSource}`;
    const csp = [
      "default-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      scriptSrc,
      `style-src ${cspSource} 'unsafe-inline'`,
      `img-src ${cspSource} data: blob:`,
      "connect-src 'none'",
    ].join('; ');

    const safeCsp = escapeHtmlAttr(csp);
    const safeNonce = escapeHtmlAttr(nonce);
    const safeScript = escapeHtmlAttr(scriptUri);
    const safeStyle = escapeHtmlAttr(styleUri);
    const scriptTag = nonce
      ? `<script nonce="${safeNonce}" src="${safeScript}"></script>`
      : `<script src="${safeScript}"></script>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${safeCsp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AXIS Studio</title>
  <link rel="stylesheet" href="${safeStyle}" />
</head>
<body class="${bodyClass}">
  <noscript>AXIS panels need JavaScript enabled.</noscript>
  ${bodyHtml}
  ${scriptTag}
</body>
</html>
`;
  } catch {
    return FALLBACK_HTML;
  }
}

export { escapeHtmlAttr, htmlHasInlineScript };
