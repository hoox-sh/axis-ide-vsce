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
 * Blob worker that fetches Pyodide 0.29.5 from jsDelivr when the chart HTML
 * carries `data-axis-pyodide-cdn`. Paint stays in main.ts; this only loads Wasm.
 */

export function pyodideWorkerSource(indexUrl: string): string {
  const url = JSON.stringify(String(indexUrl ?? ''));
  return `self.onmessage = async function (ev) {
  var d = ev.data || {};
  if (d.type !== 'load') return;
  var indexUrl = d.indexUrl || ${url};
  try {
    importScripts(indexUrl + 'pyodide.js');
    var py = await self.loadPyodide({ indexURL: indexUrl });
    var n = py.runPython('1+1');
    self.postMessage({ type: 'ready', smoke: Number(n) });
  } catch (e) {
    self.postMessage({ type: 'error', message: String((e && e.message) || e) });
  }
};`;
}

/** Spawn a blob worker and send `load`. No-op when the CDN attr is missing. */
export function bootPyodideCdnWorker(
  doc: Pick<Document, 'body'> = document,
): Worker | undefined {
  const indexUrl = doc.body?.getAttribute('data-axis-pyodide-cdn') ?? '';
  if (!indexUrl || typeof Worker === 'undefined' || typeof Blob === 'undefined') {
    return undefined;
  }
  const blob = new Blob([pyodideWorkerSource(indexUrl)], { type: 'text/javascript' });
  const worker = new Worker(URL.createObjectURL(blob));
  worker.postMessage({ type: 'load', indexUrl });
  return worker;
}
