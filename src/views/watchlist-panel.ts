// Copyright (C) 2026 jango_blockchained
//
// This file is part of AXIS IDE (hoox-sh.axis-ide).
//
// AXIS IDE is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, version 3 of the License only.
//
// AXIS IDE is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with AXIS IDE.  If not, see <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Sidebar WebviewView for `axis.watchlist` — a thin shim on the generic
 * studio provider (enhancement plan §5 Phase 2).
 *
 * Does not register `axis.watchlist.add` / `axis.watchlist.remove` — those stay
 * on `registerWatchlist`. Does not create the TreeView. Wiring must call
 * `registerWatchlist(context, { tree: false })` for commands + status bar and
 * `registerWatchlistStudio(context)` for this view. See
 * `watchlist-studio-contributes.fragment.json`.
 *
 * Wire change (old flat → `studio.*`): `watchlist.ready` → `studio.ready`
 * (the provider acks with `studio.init` carrying the current snapshot);
 * `watchlist.add` / `watchlist.remove` / `watchlist.select` → `studio.action`
 * with `{ symbol }` in `args`; the snapshot posts as `studio.init` /
 * `studio.set` data, fields verbatim.
 */

import { existsSync } from 'node:fs';
import { ColorThemeKind, Uri, window, type ExtensionContext } from 'vscode';
import { registerStudioView, StudioViewProvider, type StudioProviderDeps } from './studio-provider';
import type { StudioRegistration } from './studio-registry';
import {
  WATCHLIST_STUDIO_VIEW,
  buildWatchlistBody,
  parseWatchlistSymbolArgs,
} from './watchlist-messages';
import {
  WATCHLIST_VIEW_ID,
  addWatchlistSymbol,
  createMockQuoteFeed,
  readWatchlistV1,
  removeWatchlistSymbol,
  selectWatchlistSymbol,
  writeWatchlistV1,
  type QuoteFeed,
  type WatchlistV1,
  type WorkspaceStateHelpers,
} from './watchlist';
import {
  buildWatchlistSnapshot,
  type WatchlistQuoteSource,
  type WatchlistStudioSnapshot,
} from './watchlist-studio-model';

function themeBodyClass(kind: ColorThemeKind): string {
  switch (kind) {
    case ColorThemeKind.Light:
      return 'vscode-light';
    case ColorThemeKind.HighContrast:
      return 'vscode-high-contrast';
    case ColorThemeKind.HighContrastLight:
      return 'vscode-high-contrast-light';
    default:
      return 'vscode-dark';
  }
}

function currentThemeBodyClass(): string {
  try {
    return themeBodyClass(window.activeColorTheme.kind);
  } catch {
    return 'vscode-dark';
  }
}

/** Assemble the injected VS Code surface the generic provider needs. */
function studioDeps(context: ExtensionContext): StudioProviderDeps {
  return {
    extensionUri: context.extensionUri,
    joinPath: (base, ...parts) => Uri.joinPath(base as Uri, ...parts),
    fsPath: (uri) => (uri as Uri).fsPath,
    assetExists: (path) => existsSync(path),
    themeBodyClass: () => currentThemeBodyClass(),
  };
}

export type WatchlistStudioOptions = {
  /** Live feed. Omit for the mock placeholder (badge "placeholder", close 100). */
  quoteFeed?: QuoteFeed;
  /**
   * Force the placeholder badge. Default true when `quoteFeed` is omitted,
   * false when a feed is passed.
   */
  mock?: boolean;
  /**
   * After a successful `axis.watchlist.v1` write.
   * `registerWatchlist` returns `refreshStatusBar`, which reads provider state
   * — not workspaceState. Wiring should `provider.setState(state)` then
   * `refreshStatusBar()`. This module does not export a new watchlist.ts API.
   */
  onPersisted?: (state: WatchlistV1) => void;
};

/** One of the three mutating watchlist actions. */
type WatchlistMutation = 'add' | 'remove' | 'select';

/**
 * Watchlist studio host (`axis.watchlist`) on the generic provider.
 * Mutates via `addWatchlistSymbol` / `removeWatchlistSymbol` /
 * `selectWatchlistSymbol` + `writeWatchlistV1`, re-posting the snapshot as
 * `studio.init` / `studio.set` data. Does not register commands.
 */
export class WatchlistStudioProvider {
  private provider: StudioViewProvider | undefined;
  private feed: QuoteFeed;
  private mock: boolean;
  private readonly helpers: WorkspaceStateHelpers;
  private readonly onPersisted?: (state: WatchlistV1) => void;

  constructor(
    private readonly context: ExtensionContext,
    opts?: WatchlistStudioOptions,
  ) {
    this.feed = opts?.quoteFeed ?? createMockQuoteFeed();
    this.mock = opts?.mock ?? opts?.quoteFeed == null;
    this.onPersisted = opts?.onPersisted;
    this.helpers = {
      get: <T>(key: string) => this.context.workspaceState.get<T>(key),
      update: (key, value) => this.context.workspaceState.update(key, value),
    };
    // registerStudioView never throws (uncontributed view id / test host
    // resolve to undefined and the wrapper methods no-op, matching the old
    // panel's behavior with an unresolved view).
    this.provider = registerStudioView(
      this.registration(),
      studioDeps(context),
      window,
      context,
    );
  }

  /** Replace the quote feed. `mock` defaults to false (a real feed was attached). */
  setQuoteFeed(feed: QuoteFeed, mock = false): void {
    this.feed = feed;
    this.mock = mock;
    this.postSnapshot();
  }

  /** Re-read workspaceState and post a snapshot (palette add/remove catch-up). */
  postSnapshot(): void {
    this.provider?.postStudioSet(this.snapshot());
  }

  reveal(): void {
    try {
      this.provider?.reveal(true);
    } catch {
      // older hosts / disposing
    }
  }

  private registration(): StudioRegistration {
    return {
      id: WATCHLIST_STUDIO_VIEW,
      title: 'Watchlist',
      viewId: WATCHLIST_VIEW_ID,
      retainContextWhenHidden: true,
      buildBody: buildWatchlistBody,
      actions: {
        add: (args) => this.mutate('add', args),
        remove: (args) => this.mutate('remove', args),
        select: (args) => this.mutate('select', args),
      },
      restore: () => this.snapshot(),
    };
  }

  private quoteSource(): WatchlistQuoteSource {
    if (this.mock) return { mock: true };
    const feed = this.feed;
    return {
      mock: false,
      getQuote: (symbol) => {
        try {
          return feed.getQuote(symbol);
        } catch {
          return null;
        }
      },
    };
  }

  private snapshot(): WatchlistStudioSnapshot {
    return buildWatchlistSnapshot(readWatchlistV1(this.helpers), this.quoteSource());
  }

  /** Old `watchlist.add` / `remove` / `select` handling, args moved into `studio.action`. */
  private mutate(action: WatchlistMutation, args: unknown): void {
    const symbol = parseWatchlistSymbolArgs(args);
    if (!symbol) return;
    void this.persist(action, symbol);
  }

  private async persist(action: WatchlistMutation, symbol: string): Promise<void> {
    try {
      const current = readWatchlistV1(this.helpers);
      let next = current;
      if (action === 'add') next = addWatchlistSymbol(current, symbol);
      else if (action === 'remove') next = removeWatchlistSymbol(current, symbol);
      else next = selectWatchlistSymbol(current, symbol);
      const wrote = await writeWatchlistV1(this.helpers, next);
      if (wrote) {
        try {
          this.onPersisted?.(next);
        } catch {
          // status bar hook is best-effort
        }
        this.provider?.postStudioSet(buildWatchlistSnapshot(next, this.quoteSource()));
        return;
      }
      this.provider?.postStudioSet(this.snapshot());
    } catch {
      // never throw into the webview host
    }
  }
}

/**
 * Register the Watchlist studio WebviewView (`axis.watchlist`).
 * Does not register add/remove commands and does not create a TreeView.
 */
export function registerWatchlistStudio(
  context: ExtensionContext,
  opts?: WatchlistStudioOptions,
): WatchlistStudioProvider {
  return new WatchlistStudioProvider(context, opts);
}
