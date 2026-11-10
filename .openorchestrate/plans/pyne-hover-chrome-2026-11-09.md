# PYNE LSP hover chrome — proof notes

**Date:** 2026-11-09  
**Seat:** oo-spec-2  
**Card:** Visual polish PYNE LSP hover cards (theme chrome + markdown layout)  
**Agency:** axis-ide-vsce (pack card). Chrome lives in `pyne-lsp-vsce` themes + `pynescript` Markdown card. No pyodide edits.

## Theme chrome (AXIS Void / HOOX Signal / PYNE Volt)

Shipped in `pyne-lsp-vsce` 0.5.8 (`CHANGELOG.md` Unreleased/0.5.8: hover / suggest / peek chrome). Locked by `src/test/manifest.test.ts` (`gives hover, suggest, peek, and inlay the AXIS card chrome`).

Required color keys (all three themes):

- `editorHoverWidget.{background,border,statusBarBackground,highlightForeground,foreground}`
- `textPreformat.{foreground,background}` (kind chip)
- `textBlockQuote.border`, `textCodeBlock.background`
- `editorSuggestWidget.{background,border}`
- `widget.{shadow,border}`, `peekView.border`

AXIS Void sample: hover fill `#0C0E16`, accent border `#939FFF59`, `widget.border` `#939FFF40`.

## Markdown layout

VS Code cannot inject CSS into native hover widgets. Layout is Markdown in `pynescript/src/pynescript/langserver/providers/docs_card.py` `format_docs_card`:

1. inline-code kind chip (`` `function` ``) → theme `textPreformat`
2. fenced signature ` ```pinescript `
3. body + optional sections
4. `---` footer (docs link)

`features/hover.py` `_markdown_hover` sets `MarkupKind.Markdown` and calls `format_docs_card`.

## Verify

- axis-ide-vsce: `bun run check`, `bun run lint` (cwd this repo)
- pyne-lsp-vsce: `npm run check`, `npm run test:unit` (includes hover chrome test)
- Not run: pyodide calculator / venue-stream. Those cards stay untouched.

## Known-bad

`python3 .openorchestrate/plans/pyne-hover-chrome-proof.py --known-bad` exits 1 (missing file).
