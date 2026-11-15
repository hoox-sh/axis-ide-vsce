# AXIS pack — PYNE language surface (AXIS-side recit)

**Date:** 2026-11-09  
**Seat:** oo-misc  
**Card:** Review pyne-lsp-vsce: fine-tune language surface for AXIS pack  
**Agency card:** `pyne-lsp-vsce` already Ready for Review with `docs/axis-pack-language-review.md` + `./scripts/verify.sh`. This file is the AXIS copy: read-only recit, no engine-rework / pyodide edits.

Sources: `pyne-lsp-vsce/package.json`, `pyne-lsp-vsce/src/extension.ts`, `pyne-lsp-vsce/src/test/manifest.test.ts`, `pyne-lsp-vsce/docs/axis-pack-language-review.md`; this checkout `package.json` menus/keybindings, `src/host/open-chart.ts` (`PINE_LANGUAGE_ID`, `PINE_FILE_SUFFIXES`), `src/host/pine-lang.ts`.

---

## Verdict

Pack Match items 13–15 hold from the AXIS side **without further AXIS product edits**.

| Item | AXIS today | PYNE today | Status |
| --- | --- | --- | --- |
| 13. Pine LS | Consumes `pinescript` buffers | Single contributed id `pinescript`; LSP selector includes `pinescript` | **Match** |
| 14. Convert to v6 | Not an AXIS command | `pynescript.convertToV6`, `enablement` `editorLangId == pinescript` | **Match** (PYNE) |
| 15. `.pyne` / `.pine` association | `when` uses `editorLangId == pinescript` **plus** extname belt | One id `pinescript` for `.pyne` `.pine` `.pinev5` `.pinev6` `.pinescript` `.psc`; aliases `pine`/`pyne`; on-open remap | **Match** for pack; **not** PyneIDE `pyne` Python mode |

HOOX `.pyne` files are Pine source. Do not register language id `pyne` on either extension.

---

## AXIS `when` vs PYNE id

AXIS `Ctrl/Cmd+Enter` and title-bar Run/Open Chart already use:

- `editorLangId == pinescript` / `resourceLangId == pinescript`
- extname belt: `.pyne` `.pine` `.pinev5` `.pinev6` `.pinescript`

Helpers in `src/host/pine-lang.ts` document the contract: `hoox-sh.pyne` registers id `pinescript`. Runtime `isPineFilePath` matches the same suffixes (no `.psc`).

PYNE remaps incoming `pine` / `pyne` (and suffix mismatches) to `pinescript`, so AXIS `when` fires even if another extension labeled the buffer first.

The extname belt is redundant while PYNE is installed and harmless if it is not. That is the P0-10 follow-on from the PYNE review; it is already on this working tree.

---

## What AXIS should not do

- Do not add a second language id (`pyne`, `pine`) — it would break pack Run/Open Chart.
- Do not grow a chart or DAP inside PYNE (already absent: no `customEditors` / `debuggers` / `views` in PYNE `package.json`; tests lock that).
- Do not steal HQ `AXIS IDE: venue-stream datafeed + engine rework` / pyodide cards.

---

## Remaining gaps (not this card)

1. **Series/`na` diagnostics (P1-5)** — server `hoox-sh/pyne`, not AXIS chrome. Token highlight ≠ Edge type checker.
2. **`.psc` (PyneIDE Pine suffix)** — PYNE maps it to `pinescript`; AXIS `PINE_FILE_SUFFIXES` and `package.json` `when` omit it. Optional follow-on if we care about PyneIDE files in AXIS. Not required for HOOX `.pyne`/`.pine`.
3. **P1-6** local Pine→PYNE compile without cloud — not this client.

---

## Proof

- Artifact: this file
- Command: `test -f docs/pyne-lsp-language-surface-review.md`
- PYNE agency: leave Ready for Review for Checker (`docs/axis-pack-language-review.md`)
