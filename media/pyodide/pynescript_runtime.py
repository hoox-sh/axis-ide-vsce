# Copyright (C) 2026 jango_blockchained
#
# This file is part of AXIS IDE (hoox-sh.axis-ide).
#
# AXIS IDE is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, version 3 of the License only.
#
# SPDX-License-Identifier: AGPL-3.0-only

"""Pyodide bridge: same ``pynescript.runtime.Runtime`` envelope as Flask ``POST /run``.

Loaded after micropip installs a trusted ``hoox-pyne`` / pynescript wheel
(deps=false: no Click/requests/tqdm). Compile/Numba is not available in Wasm;
``mode=auto`` falls back inside Runtime to interpret.
"""

from __future__ import annotations

import json
from typing import Any

from pynescript.runtime import Runtime

_RUNTIME: Runtime | None = None


def _runtime() -> Runtime:
    global _RUNTIME
    if _RUNTIME is None:
        _RUNTIME = Runtime()
    return _RUNTIME


def run_script(
    script: str,
    bars: list,
    mode: str = "interpret",
    libraries: list | None = None,
    inputs: dict | None = None,
) -> str:
    """Always return a JSON string for the JS host (never raise)."""
    mode_norm = (mode or "interpret").strip().lower()
    if mode_norm not in ("interpret", "compile", "auto"):
        mode_norm = "interpret"
    try:
        kwargs: dict[str, Any] = {
            "source_code": script,
            "ohlcv_data": bars or [],
            "mode": mode_norm,
        }
        if libraries:
            kwargs["libraries"] = libraries
        if inputs:
            kwargs["inputs"] = inputs
        out = _runtime().run(**kwargs)
        if not isinstance(out, dict):
            out = {"status": "error", "error": "Runtime.run returned non-dict", "error_kind": "runtime"}
        elif "status" not in out:
            out["status"] = "success"
        return json.dumps(out, allow_nan=False, default=str)
    except Exception as e:  # noqa: BLE001 — envelope must always serialize
        return json.dumps(
            {
                "status": "error",
                "plots": {},
                "series": {},
                "events": [],
                "error": f"{type(e).__name__}: {e}",
                "error_kind": "runtime",
                "meta": {"mode": mode_norm},
            }
        )
