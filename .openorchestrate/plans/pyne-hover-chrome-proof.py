#!/usr/bin/env python3
"""Assertion: OK_pyne_hover_chrome_theme_markdown. Run from axis-ide-vsce root.

Verify AXIS IDE typecheck/lint and PYNE hover chrome (theme tokens + markdown
card layout). Does not edit pyodide. Known-bad: pass --known-bad (exit 1).
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

AXIS = Path(__file__).resolve().parents[2]
HQ = AXIS.parent
PYNE = HQ / "pyne-lsp-vsce"
PYNESCRIPT = HQ / "pynescript"
DOCS_CARD = PYNESCRIPT / "src" / "pynescript" / "langserver" / "providers" / "docs_card.py"
HOVER_PY = PYNESCRIPT / "src" / "pynescript" / "langserver" / "features" / "hover.py"
TOKEN = "OK_pyne_hover_chrome_theme_markdown"

REQUIRED_COLORS = [
    "editorHoverWidget.background",
    "editorHoverWidget.border",
    "editorHoverWidget.statusBarBackground",
    "editorHoverWidget.highlightForeground",
    "editorHoverWidget.foreground",
    "textPreformat.foreground",
    "textPreformat.background",
    "textBlockQuote.border",
    "editorSuggestWidget.background",
    "editorSuggestWidget.border",
    "widget.shadow",
    "widget.border",
    "peekView.border",
    "textCodeBlock.background",
]


def fail(msg: str) -> None:
    print(msg, file=sys.stderr)
    sys.exit(1)


def run(cmd: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    print("+", " ".join(cmd), f"(cwd={cwd})", flush=True)
    return subprocess.run(cmd, cwd=cwd, text=True, capture_output=True, check=False)


def main() -> None:
    if "--known-bad" in sys.argv:
        missing = AXIS / "docs" / "DOES-NOT-EXIST-hover.md"
        if missing.is_file():
            fail("known-bad file unexpectedly exists")
        fail("known-bad missing file")

    evidence = AXIS / ".openorchestrate" / "plans" / "pyne-hover-chrome-2026-11-09.md"
    if not evidence.is_file():
        fail(f"missing artifact {evidence}")

    pkg = json.loads((PYNE / "package.json").read_text())
    themes = pkg.get("contributes", {}).get("themes") or []
    if len(themes) != 3:
        fail(f"expected 3 PYNE themes, got {len(themes)}")

    for theme in themes:
        path = PYNE / theme["path"]
        if not path.is_file():
            fail(f"missing theme {path}")
        colors = json.loads(path.read_text()).get("colors") or {}
        for key in REQUIRED_COLORS:
            if not colors.get(key):
                fail(f"{theme.get('label')} missing {key}")

    docs = DOCS_CARD.read_text()
    for needle in (
        "def format_docs_card",
        "`{kicker}`",
        "```pinescript",
        r"---\n{foot}",
        "inline-code kind",
        "textPreformat",
    ):
        if needle not in docs:
            fail(f"docs_card.py missing {needle!r}")

    hover = HOVER_PY.read_text()
    for needle in (
        "kind=lsp.MarkupKind.Markdown",
        "format_docs_card(",
        "def _markdown_hover",
    ):
        if needle not in hover:
            fail(f"hover.py missing {needle!r}")

    check = run(["bun", "run", "check"], AXIS)
    sys.stdout.write(check.stdout + check.stderr)
    if check.returncode != 0:
        fail(f"axis-ide bun run check exit {check.returncode}")

    lint = run(["bun", "run", "lint"], AXIS)
    sys.stdout.write(lint.stdout + lint.stderr)
    if lint.returncode != 0:
        fail(f"axis-ide bun run lint exit {lint.returncode}")

    pyne_check = run(["npm", "run", "check"], PYNE)
    sys.stdout.write(pyne_check.stdout + pyne_check.stderr)
    if pyne_check.returncode != 0:
        fail(f"pyne-lsp npm run check exit {pyne_check.returncode}")

    pyne_unit = run(["npm", "run", "test:unit"], PYNE)
    sys.stdout.write(pyne_unit.stdout + pyne_unit.stderr)
    if pyne_unit.returncode != 0:
        fail(f"pyne-lsp npm run test:unit exit {pyne_unit.returncode}")

    print(TOKEN)


if __name__ == "__main__":
    main()
