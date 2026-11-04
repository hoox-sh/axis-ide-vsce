// Copyright (C) 2026 jango_blockchained
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * DOM helpers shared by every studio: text/visibility updates against the
 * host-built HTML shell, and focus restoration across re-renders. Elements
 * that must keep focus carry `data-restore-focus` (optionally with a stable
 * key value); capture before a re-render, restore after.
 */

/** Attribute marking elements whose focus survives re-renders. */
export const RESTORE_FOCUS_ATTR = 'data-restore-focus';

/** Set `textContent` on the element with `id` (no-op when absent). */
export function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/** Toggle `hidden` on the element with `id` (no-op when absent). */
export function setHidden(id: string, hidden: boolean): void {
  const el = document.getElementById(id);
  if (el) el.hidden = hidden;
}

/**
 * Capture the restore key of the currently focused element (or its nearest
 * marked ancestor). Returns null when focus is not restorable; '' when the
 * marker carries no value.
 */
export function captureFocus(): string | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return null;
  const marked = active.closest<HTMLElement>(`[${RESTORE_FOCUS_ATTR}]`);
  if (!marked) return null;
  return marked.getAttribute(RESTORE_FOCUS_ATTR) ?? '';
}

/**
 * Restore focus to the element carrying the captured restore key after a
 * re-render. Safe to call with null (no-op); never throws.
 */
export function restoreFocus(key: string | null, root: ParentNode = document): void {
  if (key === null) return;
  // Array.from keeps this working with plain "DOM" lib (no DOM.Iterable needed
  // in studio tsconfigs) while still covering every marked element.
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(`[${RESTORE_FOCUS_ATTR}]`));
  for (const candidate of candidates) {
    if ((candidate.getAttribute(RESTORE_FOCUS_ATTR) ?? '') === key) {
      candidate.focus();
      return;
    }
  }
}
