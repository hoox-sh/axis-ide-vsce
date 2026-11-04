// Copyright (C) 2026 jango_blockchained
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Typed acquireVsCodeApi() singleton. VS Code throws when the API is
 * acquired twice, so every studio shares one guarded acquisition; a
 * missing API (dev host, tests) resolves to null instead of throwing.
 */

export interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

let cached: VsCodeApi | null = null;
let acquired = false;

/** Single guarded acquireVsCodeApi(); repeat calls return the same instance. */
export function getVsCodeApi(): VsCodeApi | null {
  if (acquired) return cached;
  acquired = true;
  try {
    cached = acquireVsCodeApi();
  } catch {
    cached = null;
  }
  return cached;
}
