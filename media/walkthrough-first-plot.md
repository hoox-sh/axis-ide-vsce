# First plot

AXIS Run uses **Pyodide** by default (`axis.engine.allowPyodide`). Your `.pine` source stays on the machine (`uploaded=0`). Wasm is cached in extension `globalStorage` after the first CDN fetch — it is **not** packed in the VSIX.

1. Open the fixture (`orb.pine` + `orb.axis.json`).
2. **AXIS: Run Script** (Ctrl/Cmd+Enter).
3. Open **AXIS: Show Run Output** and look for `engine=pyodide … uploaded=0`.
