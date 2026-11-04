// Copyright (C) 2026 jango_blockchained
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Polite live-region announcements for screen readers. The region is
 * created lazily and kept visually hidden; the clear-then-set cycle lets
 * identical consecutive messages re-announce.
 */

let liveRegion: HTMLElement | null = null;

function ensureRegion(): HTMLElement {
  if (liveRegion?.isConnected) return liveRegion;
  const region = document.createElement('div');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  const style = region.style;
  style.position = 'absolute';
  style.width = '1px';
  style.height = '1px';
  style.padding = '0';
  style.margin = '-1px';
  style.overflow = 'hidden';
  style.clip = 'rect(0, 0, 0, 0)';
  style.whiteSpace = 'nowrap';
  style.border = '0';
  document.body.append(region);
  liveRegion = region;
  return region;
}

/** Announce `message` politely (no-op for empty text). */
export function announce(message: string): void {
  if (!message) return;
  const region = ensureRegion();
  region.textContent = '';
  window.requestAnimationFrame(() => {
    if (region.isConnected) region.textContent = message;
  });
}
