#!/usr/bin/env python3
"""Assertion: OK_three_polish_lanes_working. Run from axis-ide-vsce root."""
from __future__ import annotations

import sys
from pathlib import Path

BOARD = Path(__file__).resolve().parents[1] / "board.md"

LANES = (
    "Build a feature-rich strategy report on the chart",
    "Polish chart plots, drawings, and chrome",
    "Polish run, inputs, data pick, and bar step",
)


def fail(msg: str) -> None:
    print(msg, file=sys.stderr)
    sys.exit(1)


def main() -> None:
    rows = []
    for ln in BOARD.read_text().splitlines():
        if not ln.startswith("|"):
            if ln.startswith("## "):
                break
            continue
        cells = [c.strip() for c in ln.split("|")[1:-1]]
        if len(cells) < 3 or cells[0] in {"task", "---"} or cells[0].startswith("---"):
            continue
        rows.append(cells)

    def find(name: str) -> list[str]:
        hits = [r for r in rows if r[0] == name]
        if len(hits) != 1:
            fail(f"{name!r} count={len(hits)}")
        return hits[0]

    for name in LANES:
        row = find(name)
        if row[1] != "oo-spec-2":
            fail(f"{name} owner={row[1]!r}")
        if row[2] != "Working":
            fail(f"{name} status={row[2]!r} expected Working")

    comparison = find("PyneIDE vs AXIS: competitive feature list + parity-and-beyond comparison")
    if comparison[2] == "Blocked":
        fail("comparison card is Blocked")
    inventory = find("AXIS current-capability inventory for PyneIDE comparison")
    if inventory[2] != "Done":
        fail(f"inventory status={inventory[2]!r}")

    # known-bad: a Done polish lane must not pass this gate
    if find(LANES[0])[2] == "Done":
        fail("known-bad: strategy lane Done must not pass")

    print("OK_three_polish_lanes_working")


if __name__ == "__main__":
    main()
