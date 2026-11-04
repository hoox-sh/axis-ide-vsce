# Contributing to AXIS IDE

Thanks for helping with **AXIS IDE** — the VS Code extension for running Pine
Script™ / PYNE beside the editor with AXIS charts, results, and live sessions.

## Sister repos & websites

| Product | Repo | Website |
|---------|------|---------|
| **HOOX** | [hoox](https://github.com/hoox-sh/hoox) | [hoox.sh](https://hoox.sh) |
| **PYNE** | [pyne](https://github.com/hoox-sh/pyne) | [hoox.sh/pyne](https://hoox.sh/pyne) |
| **AXIS** | [axis](https://github.com/hoox-sh/axis) | [hoox.sh/axis](https://hoox.sh/axis) |
| **AXIS IDE** | [axis-ide-vsce](https://github.com/hoox-sh/axis-ide-vsce) (this repo) | [hoox.sh/axis](https://hoox.sh/axis) |

## Setup

Requirements: [Bun](https://bun.sh) `1.4.4`, Node 22, VS Code `^1.95.0`.

```bash
bun install
bun run compile          # host bundle + webviews
bun run check            # tsc host + webviews
bun run test:unit        # bun:test
```

Open the folder in VS Code and press **F5** (Run Extension) to launch an
Extension Development Host. Install the PYNE Language Support VSIX first, or
point `AXIS_IDE_PYNE_VSIX` at a local `pyne-vscode-*.vsix` for electron tests.

## Checks

```bash
bun run check
bun run test:coverage:gate
bun run compile
bun run package
bun run lint
```

CI runs the coverage gate and the `@vscode/test-electron` suite under xvfb.

## Style

- TypeScript for the extension host (`src/`), Vite + vanilla TS for webviews
  (`webview/`), `bun:test` for unit tests
- Prefer small PRs with clear intent
- Never invent Pine / TradingView host APIs (`TV.*`, `pine.*`, `TradingView.*`)
- Keys live in `SecretStorage` only — never in settings, logs, or fixtures

## License

AGPL-3.0-only. See [LICENSE](LICENSE). Contributions are accepted under the
same license.
