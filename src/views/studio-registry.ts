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

import type { StudioActionHandler } from './studio-router';

/**
 * Everything the generic provider needs to run one panel studio
 * (enhancement plan §5 Phase 2). Studios register themselves in their
 * migration PRs; nothing is registered yet.
 */
export interface StudioRegistration {
  /** Studio id — the wire `payload.view` and the `dist/webview/<id>` directory. */
  id: string;
  /** Human title (package.json view-name twin; future contributes generation). */
  title: string;
  /** VS Code view id, e.g. `axis.colors`. */
  viewId: string;
  /** Optional extra body class emitted next to the theme class. */
  bodyClass?: string;
  /** Webview registration option, applied by `registerStudioView`. */
  retainContextWhenHidden: boolean;
  /** Trusted studio DOM for the shell body (inline scripts are refused). */
  buildBody?: () => string;
  /** `studio.action` handlers by action name. */
  actions: Readonly<Record<string, StudioActionHandler>>;
  /** Current studio data posted in the `studio.init` handshake ack. */
  restore?: () => unknown;
}

const studios = new Map<string, StudioRegistration>();

/** Validate a registration; returns a human error or null when valid. Never throws. */
function registrationError(def: unknown): string | null {
  if (def === null || typeof def !== 'object' || Array.isArray(def)) {
    return 'registration must be an object';
  }
  const rec = def as Partial<StudioRegistration>;
  if (typeof rec.id !== 'string' || rec.id.length === 0) {
    return 'id must be a non-empty string';
  }
  if (typeof rec.title !== 'string' || rec.title.length === 0) {
    return 'title must be a non-empty string';
  }
  if (typeof rec.viewId !== 'string' || rec.viewId.length === 0) {
    return 'viewId must be a non-empty string';
  }
  if (typeof rec.retainContextWhenHidden !== 'boolean') {
    return 'retainContextWhenHidden must be a boolean';
  }
  if (rec.bodyClass !== undefined && typeof rec.bodyClass !== 'string') {
    return 'bodyClass must be a string when present';
  }
  if (rec.actions === null || typeof rec.actions !== 'object' || Array.isArray(rec.actions)) {
    return 'actions must be an object';
  }
  for (const [action, handler] of Object.entries(rec.actions)) {
    if (typeof handler !== 'function') {
      return `actions.${action} must be a function`;
    }
  }
  if (rec.buildBody !== undefined && typeof rec.buildBody !== 'function') {
    return 'buildBody must be a function when present';
  }
  if (rec.restore !== undefined && typeof rec.restore !== 'function') {
    return 'restore must be a function when present';
  }
  return null;
}

/**
 * Register one studio. Trusted activation-time call site: throws loudly on a
 * bad or duplicate registration (the codec's `encode` doctrine) so wiring
 * mistakes fail at startup, not at message time. Returns an unregister.
 */
export function registerStudio(def: StudioRegistration): () => void {
  const error = registrationError(def);
  if (error) {
    throw new Error(`registerStudio: ${error}`);
  }
  if (studios.has(def.id)) {
    throw new Error(`registerStudio: duplicate studio id: ${def.id}`);
  }
  studios.set(def.id, def);
  return () => {
    studios.delete(def.id);
  };
}

/** Look up one studio by id (the wire `payload.view`). */
export function getStudio(id: string): StudioRegistration | undefined {
  return studios.get(id);
}

/** Every registered studio in registration order (activation wiring loop). */
export function listStudios(): StudioRegistration[] {
  return [...studios.values()];
}
