// Copyright (C) 2026 jango_blockchained
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Shared studio runtime: owns the acquireVsCodeApi singleton, the host
 * message subscription, safe posting, persistence, and focus restoration
 * across re-renders. The message payload stays untyped here — studios
 * shape/decode envelopes with the shared codec (studio-protocol.ts,
 * Phase 1), never through this module.
 */

import { captureFocus, restoreFocus } from './dom';
import { getVsCodeApi } from './vscode-api';

export interface Studio {
  /** Studio view id (e.g. 'colors'). */
  readonly view: string;
  /** Post an already-shaped envelope object. Shaping/validation is the caller's job. */
  post(message: unknown): void;
  /** Subscribe to host messages; returns an unsubscribe function. */
  onMessage(handler: (message: unknown) => void): () => void;
  /** Persist webview state (survives host restarts via VS Code). */
  setState(state: unknown): void;
  /** Read persisted webview state (null when unavailable). */
  getState(): unknown;
  /** Stop posting, receiving, and restoring; idempotent. */
  dispose(): void;
}

/** Lifecycle + messaging runtime for one studio webview. */
export function createStudio({ view }: { view: string }): Studio {
  const api = getVsCodeApi();
  let disposed = false;
  const handlers = new Set<(message: unknown) => void>();

  const onHostMessage = (event: MessageEvent): void => {
    if (disposed) return;
    // Handlers usually re-render; keep focus on marked elements across them.
    const focusKey = captureFocus();
    for (const handler of handlers) {
      handler(event.data);
    }
    restoreFocus(focusKey);
  };

  const onPageHide = (): void => {
    disposed = true;
  };

  window.addEventListener('message', onHostMessage);
  window.addEventListener('pagehide', onPageHide, { once: true });

  return {
    view,
    post(message) {
      if (disposed || !api) return;
      try {
        api.postMessage(message);
      } catch {
        // host may be gone
      }
    },
    onMessage(handler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    setState(state) {
      if (!api) return;
      try {
        api.setState(state);
      } catch {
        // host may be gone
      }
    },
    getState() {
      if (!api) return null;
      try {
        return api.getState();
      } catch {
        return null;
      }
    },
    dispose() {
      disposed = true;
      handlers.clear();
      window.removeEventListener('message', onHostMessage);
      window.removeEventListener('pagehide', onPageHide);
    },
  };
}
