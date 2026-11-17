# First plot

The default engine is hosted at `pynescript.online`. AXIS sends the script there. No API key. **AXIS: Choose How to Run** can switch to this computer, or to the in-editor Pyodide subset (`uploaded=0`).

**Bars first.** Sample candles are on by default (`axis.chart.useMockBars`), so a fresh install paints without a sidecar or `ccxt`. Use **AXIS: Pick Data** for Sample candles or a workspace CSV, or open `examples/`. The walkthrough fixture (`orb.axis.json`) points at `fixtures/sample-bars.csv`.

1. Open the fixture (`orb.pine` + `orb.axis.json`).
2. Confirm bars (Sample default, Pick Data, or the fixture CSV).
3. **AXIS: Run Script** (Ctrl/Cmd+Enter).
4. Open **AXIS: Show Run Output**. A hosted run names the server. An in-editor run logs `engine=pyodide … uploaded=0`.
