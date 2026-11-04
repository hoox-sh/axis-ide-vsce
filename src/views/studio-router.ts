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

import { logWarn } from '../host/logger';
import { decode } from '../protocol/codec';
import {
  VIEW_TO_HOST,
  type StudioActionPayload,
  type StudioReadyPayload,
} from '../protocol/types';

/** Sink for dropped messages; defaults to the shared host logger. */
export type StudioRouterSink = (message: string) => void;

/** Dispatch context handed to a `studio.action` handler. */
export interface StudioActionContext {
  view: string;
  action: string;
}

/** Studio-defined `studio.action` handler (registry `actions` map values). */
export type StudioActionHandler = (
  args: Record<string, unknown> | undefined,
  context: StudioActionContext,
) => void;

/** `studio.ready` handshake hook (the provider acks with `studio.init`). */
export type StudioReadyHandler = (payload: StudioReadyPayload) => void;

/** One studio's dispatch table. */
export interface StudioRoute {
  /** Studio id — the wire `payload.view`. */
  view: string;
  ready?: StudioReadyHandler;
  actions?: Readonly<Record<string, StudioActionHandler>>;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * One message dispatch shared by every panel studio (enhancement plan §5
 * Phase 2): decode one `axis.webview.v1` envelope, then route
 * `studio.ready` / `studio.action` by `payload.view` (and
 * `payload.action`) to the registered handlers. Decode failures, unknown
 * views/actions, and throwing handlers are logged-and-dropped — `handle`
 * never throws, the same tolerance the per-panel handlers use. Envelopes
 * that are not studio traffic (webview.ready, chart.*, results.*) are
 * ignored: those belong to the chart/results specialists.
 */
export class StudioMessageRouter {
  private readonly routes = new Map<string, StudioRoute>();

  constructor(private readonly sink: StudioRouterSink = (message) => logWarn(message)) {}

  /** Register one studio's route; returns its unregister. */
  register(route: StudioRoute): () => void {
    this.routes.set(route.view, route);
    return () => {
      this.routes.delete(route.view);
    };
  }

  /** Decode + dispatch one raw webview → host message. Never throws. */
  handle(raw: unknown): void {
    const decoded = decode(raw);
    if (!decoded.ok) {
      this.sink(`studio router dropped a message: ${decoded.error.code} ${decoded.error.message}`);
      return;
    }
    if (decoded.envelope.type === VIEW_TO_HOST.StudioReady) {
      this.dispatchReady(decoded.envelope.payload as StudioReadyPayload);
      return;
    }
    if (decoded.envelope.type === VIEW_TO_HOST.StudioAction) {
      this.dispatchAction(decoded.envelope.payload as StudioActionPayload);
      return;
    }
    // Not studio traffic (webview.ready / chart.* / results.*) — not ours.
  }

  private dispatchReady(payload: StudioReadyPayload): void {
    const route = this.routes.get(payload.view);
    if (!route) {
      this.sink(`studio.ready for an unregistered view: ${payload.view}`);
      return;
    }
    if (!route.ready) return;
    try {
      route.ready(payload);
    } catch (error) {
      this.sink(`studio.ready handler threw for ${payload.view}: ${messageOf(error)}`);
    }
  }

  private dispatchAction(payload: StudioActionPayload): void {
    const route = this.routes.get(payload.view);
    if (!route) {
      this.sink(`studio.action for an unregistered view: ${payload.view}`);
      return;
    }
    const handler = route.actions?.[payload.action];
    if (!handler) {
      this.sink(`studio.action ${payload.action} has no handler on ${payload.view}`);
      return;
    }
    try {
      handler(payload.args, { view: payload.view, action: payload.action });
    } catch (error) {
      this.sink(
        `studio.action ${payload.action} handler threw on ${payload.view}: ${messageOf(error)}`,
      );
    }
  }
}
