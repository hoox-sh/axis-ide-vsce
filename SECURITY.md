# Security Policy

## Supported versions

Security fixes are applied on the default branch (`main`) of this repository.
The latest published extension version is the supported release line.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Report privately to the maintainer (**jango_blockchained**) via:

- GitHub Security Advisories on this repository (preferred), or
- A private channel linked from your GitHub profile

Include steps to reproduce, impact, and any suggested fix if you have one.

We will acknowledge receipt when possible and coordinate disclosure.

## Scope notes

AXIS IDE stores Worker / Pro API keys only in VS Code `SecretStorage` and never
writes them to settings. Please treat any path that could leak `pn_…` / `pyn_…`
values (logs, webview messages, MCP config, diagnostics exports) as security
relevant.
