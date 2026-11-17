# Full local engine (optional)

Install the managed local backend when the script should stay on this machine. It runs the full PYNE runtime — Numba `compile`, persistent sessions, `optimize`, and batch. The in-editor engine is only a subset.

1. Run **AXIS: Install Local Engine** (or use the button in this step).
2. AXIS creates a venv under `globalStorage/pyne-engine` and installs the `hoox-pyne-backend` wheel that ships with the extension.
3. If `python3` is missing or outside 3.10–3.13, setup downloads a pinned CPython 3.12 build (SHA-256 verified) into `globalStorage/pyne-runtime`.
4. Run the script again. **AXIS: Show Run Output** logs `engine=local`.

The `PYNE local` status item shows starting / ready / error; click it for Start / Stop / Install / Logs.

Air-gapped? Set `axis.engine.local.allowDownload: false` and point `axis.engine.local.python` at a 3.10–3.13 interpreter.
