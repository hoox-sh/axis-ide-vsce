#!/usr/bin/env node
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
 * Bundle the extension host so packaging with --no-dependencies works.
 *
 * Two outputs:
 *   - `out/extension.js`        extension host (external: `vscode`)
 *   - `out/debug/adapter.js`    out-of-process `axis-bar` DAP adapter executable
 *                                 (launched via `DebugAdapterExecutable`, node).
 */

import * as esbuild from 'esbuild';
import { mkdirSync } from 'node:fs';

const watch = process.argv.includes('--watch');

mkdirSync('out', { recursive: true });
mkdirSync('out/debug', { recursive: true });

const common = {
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  sourcesContent: false,
  logLevel: 'info',
  keepNames: true,
};

const extOpts = {
  ...common,
  entryPoints: ['src/extension.ts'],
  outfile: 'out/extension.js',
  external: ['vscode', 'ccxt'],
};

const adapterOpts = {
  ...common,
  entryPoints: ['src/debug/adapter.ts'],
  outfile: 'out/debug/adapter.js',
};

async function runBuild() {
  await esbuild.build(extOpts);
  await esbuild.build(adapterOpts);
  console.log('[esbuild] bundled out/extension.js + out/debug/adapter.js');
}

if (watch) {
  const [extCtx, adapterCtx] = await Promise.all([
    esbuild.context(extOpts),
    esbuild.context(adapterOpts),
  ]);
  await Promise.all([extCtx.watch(), adapterCtx.watch()]);
  console.log('[esbuild] watching…');
} else {
  await runBuild();
}
