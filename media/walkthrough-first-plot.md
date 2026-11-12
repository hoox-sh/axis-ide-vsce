# First plot

AXIS Run uses **Pyodide** by default (`axis.engine.allowPyodide`). Your `.pine` source stays on the machine (`uploaded=0`). Pyodide 0.29.5 ships inside the extension (`vendor/pyodide/0.29.5/`), so the first Run needs no download; only micropip wheels come from the CDN.

1. Open the fixture (`orb.pine` + `orb.axis.json`).
2. **AXIS: Run Script** (Ctrl/Cmd+Enter).
3. Open **AXIS: Show Run Output** and look for `engine=pyodide … uploaded=0`.
