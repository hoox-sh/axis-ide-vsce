// Copyright (C) 2026 jango_blockchained
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Shared factory for studio Vite configs. Replicates today's per-studio
 * options exactly (base './', publicDir false, IIFE lib → main.js,
 * assetFileNames 'main.[ext]', cssCodeSplit false, no sourcemap, outDir
 * ../../dist/webview/<studio>) and adds the `@axis-shared` alias so the
 * shared runtime/design-system module can be imported by any studio.
 *
 * Path handling: Vite bundles each config-file module with an injected,
 * per-module `__dirname` (vite/src/node/config.ts inject-file-scope-variables),
 * so inside this file `__dirname` is `webview/shared`. The basename check
 * keeps the factory correct even if `__dirname` were ever resolved relative
 * to the entry config instead (no studio is named 'shared').
 */

import { basename, resolve } from 'node:path';
import { defineConfig, type UserConfig } from 'vite';

/** Common Vite config for one studio webview → ./dist/webview/<studio>/. */
export function createStudioViteConfig(studio: string, globalName: string): UserConfig {
  const here = __dirname;
  const studioDir = basename(here) === studio ? here : resolve(here, '..', studio);
  return defineConfig({
    root: studioDir,
    base: './',
    publicDir: false,
    build: {
      outDir: resolve(studioDir, '..', '..', 'dist', 'webview', studio),
      emptyOutDir: true,
      target: 'es2020',
      sourcemap: false,
      minify: true,
      lib: {
        entry: resolve(studioDir, 'src', 'main.ts'),
        formats: ['iife'],
        name: globalName,
        fileName: () => 'main.js',
      },
      cssCodeSplit: false,
      rollupOptions: {
        output: {
          assetFileNames: 'main.[ext]',
        },
      },
    },
    resolve: {
      alias: {
        '@axis-shared': resolve(studioDir, '..', 'shared'),
      },
    },
  });
}
