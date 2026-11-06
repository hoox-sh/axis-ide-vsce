---
type: "Code Module"
title: "webview/watchlist/src"
description: "AXIS Watchlist studio on the shared runtime + studio. protocol."
resource: "webview/watchlist/src"
tags: [code, watchlist, webview]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-06T03:02:18Z
sources:
  - id: tree
    resource: "webview/watchlist/src"
    title: "webview/watchlist/src"
    author: process:git
okf_lock: generated
---

# Role

AXIS Watchlist studio on the shared runtime + studio. protocol. The webview builds its shell from shared ax- components and diffs the incoming snapshot so only changed rows are touched. Row background flashes (axis-wl-flash-up/down) fire when a tick moves price up or down; the class is removed after one animation cycle and disabled under reduced motion.

# Files

* `main.ts`
* `protocol.ts` — WATCHLIST_VIEW, WatchlistRowView, WatchlistViewSnapshot, decodeWatchlistSet, encodeWatchlistAdd, encodeWatchlistReady, encodeWatchlistRemove, encodeWatchlistSelect, normalizeWatchlistSymbol, snapshotFromPayload

# Other files

* `style.css`

# Packages

`@axis-shared/components`, `@axis-shared/studio`, `@axis-shared/studio-protocol`
