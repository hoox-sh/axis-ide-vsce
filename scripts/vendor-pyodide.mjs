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
 * Vendor the Pyodide boot files into `vendor/pyodide/<version>/` so the VSIX
 * ships them (no first-run CDN download). Files are pinned by size + SHA-256 in
 * `scripts/pyodide-assets.json`; a mismatch fails the build.
 *
 *   node scripts/vendor-pyodide.mjs               # download + verify (idempotent)
 *   node scripts/vendor-pyodide.mjs --check       # verify only, no network
 *   node scripts/vendor-pyodide.mjs --out DIR     # alternate output dir
 *
 * `vscode:prepublish` runs this, so `vsce package` / `vsce publish` always carry
 * the exact bytes verified here.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const MANIFEST_PATH = join(SCRIPT_DIR, 'pyodide-assets.json');
const DOWNLOAD_TIMEOUT_MS = 120_000;

function parseArgs(argv) {
  const opts = { check: false, out: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check') {
      opts.check = true;
    } else if (arg === '--out') {
      opts.out = argv[i + 1] ?? '';
      i += 1;
    } else if (arg.startsWith('--out=')) {
      opts.out = arg.slice('--out='.length);
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        'usage: node scripts/vendor-pyodide.mjs [--check] [--out DIR]',
      );
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return opts;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function readManifest() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  if (!manifest?.version || !manifest?.cdnBase || !Array.isArray(manifest?.files)) {
    throw new Error(`malformed manifest: ${MANIFEST_PATH}`);
  }
  if (!manifest.cdnBase.endsWith('/')) {
    throw new Error(`manifest cdnBase must end with "/": ${manifest.cdnBase}`);
  }
  for (const file of manifest.files) {
    if (!file?.name || !Number.isFinite(file?.bytes) || !/^[a-f0-9]{64}$/.test(file?.sha256 ?? '')) {
      throw new Error(`malformed manifest entry: ${JSON.stringify(file)}`);
    }
  }
  return manifest;
}

async function verify(path, file) {
  try {
    const info = await stat(path);
    if (info.size !== file.bytes) return `size ${info.size} != ${file.bytes}`;
    const digest = sha256(await readFile(path));
    if (digest !== file.sha256) return `sha256 ${digest} != ${file.sha256}`;
    return '';
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

async function download(url, file) {
  const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${file.name}: HTTP ${res.status} at ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength !== file.bytes) {
    throw new Error(`${file.name}: got ${bytes.byteLength} bytes, expected ${file.bytes} at ${url}`);
  }
  const digest = sha256(bytes);
  if (digest !== file.sha256) {
    throw new Error(`${file.name}: sha256 ${digest} != pinned ${file.sha256} at ${url}`);
  }
  return bytes;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const manifest = await readManifest();
  const outDir = opts.out
    ? resolve(opts.out)
    : join(REPO_ROOT, 'vendor', 'pyodide', manifest.version);

  let downloaded = 0;
  let cached = 0;
  let totalBytes = 0;
  const problems = [];

  for (const file of manifest.files) {
    const dest = join(outDir, file.name);
    const problem = await verify(dest, file);
    if (!problem) {
      cached += 1;
      totalBytes += file.bytes;
      continue;
    }
    if (opts.check) {
      problems.push(`${file.name}: ${problem}`);
      continue;
    }
    const bytes = await download(`${manifest.cdnBase}${file.name}`, file);
    await mkdir(outDir, { recursive: true });
    const tmp = `${dest}.tmp`;
    await writeFile(tmp, bytes);
    await rename(tmp, dest);
    downloaded += 1;
    totalBytes += bytes.byteLength;
    console.log(`[vendor:pyodide] fetched ${file.name} (${bytes.byteLength} bytes)`);
  }

  if (problems.length > 0) {
    for (const line of problems) console.error(`[vendor:pyodide] missing/invalid ${line}`);
    console.error(`[vendor:pyodide] run: node scripts/vendor-pyodide.mjs`);
    process.exit(1);
  }

  console.log(
    `[vendor:pyodide] ${manifest.version} ready in ${outDir} — ` +
      `${cached} cached, ${downloaded} downloaded, ${totalBytes} bytes`,
  );
}

main().catch((e) => {
  console.error(`[vendor:pyodide] ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
