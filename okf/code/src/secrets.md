---
type: "Code Module"
title: "src/secrets"
description: "src/secrets contains index.ts, slots.ts, status.ts, and 4 more files."
resource: "src/secrets"
tags: [code, secrets]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-06T03:02:18Z
sources:
  - id: tree
    resource: "src/secrets"
    title: "src/secrets"
    author: process:git
okf_lock: generated
---

# Files

* `index.ts` — AxisSecretStorage, PRO_API_KEY_RE, PRO_KEY_ERROR, SECRET_SLOTS, SECRET_STORE_ERROR, WORKER_API_KEY_RE, WORKER_KEY_ERROR, createMemorySecretStore, formatSecretStatus, redactSecret, validateProKey, validateWorkerKey
* `slots.ts` — PRO_API_KEY_RE, PRO_KEY_ERROR, SECRET_SLOTS, SECRET_STORE_ERROR, SecretSlot, WORKER_API_KEY_RE, WORKER_KEY_ERROR
* `status.ts` — SecretPresence, SecretStatusLabel, formatSecretStatus
* `storage.test.ts`
* `storage.ts` — AxisSecretStorage, SecretStore, createMemorySecretStore
* `validate.test.ts`
* `validate.ts` — ValidateErr, ValidateOk, ValidateResult, redactSecret, validateProKey, validateWorkerKey

# Packages

`bun:test`

# Used by

* [src](/code/src.md)
* [src/live](/code/src/live.md)
* [src/mcp](/code/src/mcp.md)
* [src/run](/code/src/run.md)
