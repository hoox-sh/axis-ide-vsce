---
type: "Code Module"
title: "webview/alerts/src"
description: "AXIS Alerts studio webview on the shared runtime + studio. protocol."
resource: "webview/alerts/src"
tags: [alerts, code, webview]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-06T03:02:18Z
sources:
  - id: tree
    resource: "webview/alerts/src"
    title: "webview/alerts/src"
    author: process:git
okf_lock: generated
---

# Role

AXIS Alerts studio webview on the shared runtime + studio. protocol. Built with ax- components: the header, form fields, list rows and empty state use the shared builders. Host posts studio.init / studio.set carrying the alerts snapshot and studio.notice for flashes. Add / toggle / remove post back to the host; empty titles never post. Optimistic toggle/remove keep the list snappy.

# Files

* `main.ts`
* `protocol.ts` — ALERTS_REMOVED, ALERTS_TITLE_REQUIRED, ALERTS_VIEW, AlertsNotice, AlertsSnapshot, decodeAlertsNotice, decodeAlertsSnapshot, encodeAlertsAdd, encodeAlertsReady, encodeAlertsRemove, encodeAlertsToggle

# Other files

* `style.css`

# Packages

`@axis-shared/components`, `@axis-shared/dom`, `@axis-shared/studio`, `@axis-shared/studio-protocol`

# Depends on

* [src/views](/code/src/views.md)
