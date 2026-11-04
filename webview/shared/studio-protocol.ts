// Copyright (C) 2026 jango_blockchained
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Single codec bridge for the `studio.*` namespace of axis.webview.v1.
 * Host (src/views/*) and webview studios both import from here, so both
 * sides share ONE validation implementation — src/protocol/codec.ts —
 * following the established cross-boundary import pattern (webview/logs
 * imports src/views/logs-messages; webview/alerts imports
 * src/views/alerts-studio-model). Everything below is a thin re-export
 * or a thin typed wrapper: no validation logic is duplicated here.
 */

import {
  HOST_TO_VIEW,
  VIEW_TO_HOST,
  type AxisEnvelope,
  type StudioActionPayload,
  type StudioInitPayload,
  type StudioNoticePayload,
  type StudioReadyPayload,
  type StudioSetPayload,
} from '../../src/protocol/types';
import { decode, encode } from '../../src/protocol/codec';

/* Codec + wire vocabulary re-exports — src/protocol stays the single source. */

export { decode, encode, isHostToView, isViewToHost } from '../../src/protocol/codec';
export {
  HOST_TO_VIEW,
  VIEW_TO_HOST,
  PROTOCOL_ERROR_CODES,
  PROTOCOL_VERSION,
} from '../../src/protocol/types';
export type {
  AxisEnvelope,
  DecodeResult,
  EncodeOptions,
  MessageType,
  PayloadByType,
  ProtocolError,
  ProtocolErrorCode,
  StudioActionPayload,
  StudioInitPayload,
  StudioNoticePayload,
  StudioReadyPayload,
  StudioSetPayload,
} from '../../src/protocol/types';

/** Union of the five `studio.*` message types. */
export type StudioMessageType =
  | (typeof HOST_TO_VIEW.StudioInit)
  | (typeof HOST_TO_VIEW.StudioSet)
  | (typeof HOST_TO_VIEW.StudioNotice)
  | (typeof VIEW_TO_HOST.StudioReady)
  | (typeof VIEW_TO_HOST.StudioAction);

const STUDIO_TYPES: ReadonlySet<string> = new Set([
  HOST_TO_VIEW.StudioInit,
  HOST_TO_VIEW.StudioSet,
  HOST_TO_VIEW.StudioNotice,
  VIEW_TO_HOST.StudioReady,
  VIEW_TO_HOST.StudioAction,
]);

/** True when `type` is one of the five `studio.*` message types. */
export function isStudioMessage(type: string): type is StudioMessageType {
  return STUDIO_TYPES.has(type);
}

/* Host → view encoders (studio.init / studio.set / studio.notice). */

/** studio.init envelope — optional initial studio state. */
export function encodeStudioInit(
  view: string,
  data?: unknown,
): AxisEnvelope<StudioInitPayload> {
  return data === undefined
    ? encode(HOST_TO_VIEW.StudioInit, { view })
    : encode(HOST_TO_VIEW.StudioInit, { view, data });
}

/** studio.set envelope — full studio state. */
export function encodeStudioSet(
  view: string,
  data: unknown,
): AxisEnvelope<StudioSetPayload> {
  return encode(HOST_TO_VIEW.StudioSet, { view, data });
}

/** studio.notice envelope — transient user-facing notice. */
export function encodeStudioNotice(
  view: string,
  level: string,
  message: string,
): AxisEnvelope<StudioNoticePayload> {
  return encode(HOST_TO_VIEW.StudioNotice, { view, level, message });
}

/* View → host encoders (studio.ready / studio.action). */

/** studio.ready envelope — handshake; `capabilities` omitted when not given. */
export function encodeStudioReady(
  view: string,
  capabilities?: readonly string[],
): AxisEnvelope<StudioReadyPayload> {
  return capabilities === undefined
    ? encode(VIEW_TO_HOST.StudioReady, { view })
    : encode(VIEW_TO_HOST.StudioReady, { view, capabilities: [...capabilities] });
}

/** studio.action envelope — one studio-defined action with optional args. */
export function encodeStudioAction(
  view: string,
  action: string,
  args?: Record<string, unknown>,
): AxisEnvelope<StudioActionPayload> {
  return args === undefined
    ? encode(VIEW_TO_HOST.StudioAction, { view, action })
    : encode(VIEW_TO_HOST.StudioAction, { view, action, args });
}

/* Decoders — thin `decode` wrappers; null for anything undecodable. */

/** Decoded studio.init / studio.set (host → view data messages). */
export interface StudioDataMessage {
  /** 'init' for studio.init, 'set' for studio.set. */
  kind: 'init' | 'set';
  /** Studio view id the host addressed the message to. */
  view: string;
  /** Studio state; undefined only for a data-less studio.init. */
  data: unknown;
}

/**
 * Decode a studio.init / studio.set envelope. Foreign envelopes, decode
 * errors, and every non-data studio type return null. Never throws.
 */
export function decodeStudioData(raw: unknown): StudioDataMessage | null {
  const result = decode(raw);
  if (!result.ok) return null;
  const { type, payload } = result.envelope;
  if (type !== HOST_TO_VIEW.StudioInit && type !== HOST_TO_VIEW.StudioSet) return null;
  const studio = payload as StudioInitPayload | StudioSetPayload;
  return {
    kind: type === HOST_TO_VIEW.StudioInit ? 'init' : 'set',
    view: studio.view,
    data: studio.data,
  };
}

/**
 * Decode a studio.ready envelope into its validated payload.
 * Null for anything else. Never throws.
 */
export function decodeStudioReady(raw: unknown): StudioReadyPayload | null {
  const result = decode(raw);
  if (!result.ok) return null;
  if (result.envelope.type !== VIEW_TO_HOST.StudioReady) return null;
  return result.envelope.payload as StudioReadyPayload;
}

/**
 * Decode a studio.action envelope into its validated payload.
 * Null for anything else. Never throws.
 */
export function decodeStudioAction(raw: unknown): StudioActionPayload | null {
  const result = decode(raw);
  if (!result.ok) return null;
  if (result.envelope.type !== VIEW_TO_HOST.StudioAction) return null;
  return result.envelope.payload as StudioActionPayload;
}
