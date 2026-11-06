---
okf_lock: human
type: Guide
title: AXIS IDE — Security Model
description: Secrets handling, webview CSP defaults, endpoint posture, and MCP/Pro key rules for axis-ide-vsce.
resource: https://github.com/hoox-sh/axis-ide-vsce
tags: [security, secrets, csp, vscode-extension, axis-ide]
sources:
  - id: pkg
    title: package.json
    resource: ../../package.json
  - id: csp
    title: Webview CSP matrix
    resource: ../../docs/csp-matrix.md
  - id: design
    title: AXIS VS Code extension design
    resource: ../../docs/plans/axis-vscode-extension-design.md
  - id: agents-md
    title: Repository AGENTS.md
    resource: ../../AGENTS.md
  - id: vscode-api
    title: Visual Studio Code Extension API
    resource: https://code.visualstudio.com/api/references/vscode-api
---

# AXIS IDE — Security Model

## Secrets

API keys are **never** extension settings. They live in `vscode.ExtensionContext.secrets`:

- Worker key: `/^pn_[a-f0-9]{48}$/`
- Pro key: `pyn_` + 20–508 `[A-Za-z0-9_-]`

Validation happens before `SecretStorage.store()`. Empty input clears the slot. Status bar and logs show **set/missing** only.[^pkg] [^design]

## Network posture

- `axis.engine.endpoint` defaults to `http://127.0.0.1:5002`; `axis.datafeed.url` defaults to `http://127.0.0.1:5003`.
- Remote endpoints require `axis.engine.allowRemoteEndpoint`, which is **application scope** — workspace settings cannot enable it.[^pkg]
- `axis.mcp.command` and `axis.mcp.allowNpx` are also application-scope.[^pkg]
- MCP CLI resolution soft-fails: override → `which axis` → `npx -y @hoox-sh/axis-cli` only if `allowNpx` is true. Default is false.[^design]

## Webview CSP

Default CSP is paint-only:

```
default-src 'none'
connect-src 'none'
script-src ${webview.cspSource}
style-src ${webview.cspSource} 'unsafe-inline'
img-src ${webview.cspSource} data: blob:
```

The host proxies all network. CSP widening is allowed only for the chart webview and only when `axis.engine.allowPyodide` is true (`script-src 'wasm-unsafe-eval'` + `worker-src blob:`). Multi-MB Pyodide Wasm is not shipped in the VSIX.[^csp] [^vscode-api]

## Anti-patterns

- Do not put keys in `contributes.configuration`.
- Do not pass keys to webviews.
- Do not log bearer tokens or key prefixes.
- Do not use `?key=` query strings for live ticket flow.

## Related concepts

- [design.md](/playbooks/design.md)
- [agent-instructions.md](/playbooks/agent-instructions.md)
