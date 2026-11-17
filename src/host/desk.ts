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
 * AXIS charting desk: one side-panel snapshot and the status-bar label.
 * No VS Code imports. The view (`src/views/axis-desk.ts`) only paints this HTML.
 * Command links are a fixed allowlist — snapshot strings never become commands.
 */

import type { RunChromeState } from './run-control';
import { axisIconSvg, deskActionIcon, deskRunIcon } from './icons';

export const DESK_VIEW_ID = 'axis.desk';
export const DESK_FOCUS_COMMAND = 'axis.desk.focus';
export const DESK_CONTAINER_ID = 'axis';

export type DeskRunState = RunChromeState;

export type DeskChartState = {
  symbol: string;
  interval: string;
  exchange: string;
  barsPath: string;
  useMockBars: boolean;
  /** `axis.datafeed.source` when mock is off. Default sidecar → desk "Local feed". */
  datafeedSource: 'sidecar' | 'venue';
  chartOpen: boolean;
  scriptName: string;
  engineLabel: string;
};

export type DeskSnapshot = DeskChartState & { run: DeskRunState };

export type DeskAction = { label: string; command: string; primary?: boolean };

export type DeskActionGroup = { id: string; title: string; actions: readonly DeskAction[] };

const RUN_STATES = new Set<DeskRunState>(['idle', 'running', 'stopped', 'ok', 'error']);

/** Commands the desk may invoke. Snapshot text is never interpolated into these. */
export const DESK_ACTIONS: readonly DeskActionGroup[] = [
  {
    id: 'chart',
    title: 'Chart',
    actions: [
      { label: 'Choose How to Run', command: 'axis.start', primary: true },
      { label: 'Run Script', command: 'axis.runScript', primary: true },
      { label: 'Stop', command: 'axis.stopRun' },
      { label: 'Open Chart', command: 'axis.openChart', primary: true },
      { label: 'Pick Data', command: 'axis.pickData' },
    ],
  },
  {
    id: 'debug',
    title: 'Debug',
    actions: [
      { label: 'Start Bar Debug', command: 'axis.debug.start' },
      { label: 'Step Bar', command: 'axis.debug.stepBar' },
      { label: 'Bar Breakpoint', command: 'axis.debug.toggleBarBreakpoint' },
      { label: 'Run Output', command: 'axis.showRunOutput' },
    ],
  },
  {
    id: 'engine',
    title: 'Engine',
    actions: [
      { label: 'Engine Menu', command: 'axis.engine.menu' },
      { label: 'Install Local Engine', command: 'axis.engine.setup' },
    ],
  },
  {
    id: 'more',
    title: 'More',
    actions: [
      { label: 'Walkthrough', command: 'axis.openWalkthroughFixture' },
      { label: 'Last Profile', command: 'axis.profiler.show' },
      { label: 'Pro Key', command: 'axis.secrets.setProKey' },
      { label: 'Worker Key', command: 'axis.secrets.setWorkerKey' },
      { label: 'Clear Secrets', command: 'axis.secrets.clear' },
      { label: 'All Commands', command: 'axis.statusbar.showPopup' },
    ],
  },
] as const;

export function emptyDeskChart(): DeskChartState {
  return {
    symbol: '',
    interval: '',
    exchange: '',
    barsPath: '',
    useMockBars: false,
    datafeedSource: 'sidecar',
    chartOpen: false,
    scriptName: '',
    engineLabel: 'Server',
  };
}

export function emptyDesk(): DeskSnapshot {
  return { ...emptyDeskChart(), run: 'idle' };
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Map a chart document (or a partial one) onto desk fields. Unknown keys are ignored. */
export function deskFromChartDoc(
  doc: {
    symbol?: unknown;
    interval?: unknown;
    exchange?: unknown;
    barsPath?: unknown;
  },
  extra: {
    useMockBars: boolean;
    chartOpen: boolean;
    scriptName: string;
    engineLabel: string;
    datafeedSource?: 'sidecar' | 'venue';
  },
): DeskChartState {
  return {
    symbol: asText(doc.symbol),
    interval: asText(doc.interval),
    exchange: asText(doc.exchange),
    barsPath: asText(doc.barsPath),
    useMockBars: extra.useMockBars === true,
    datafeedSource: extra.datafeedSource === 'venue' ? 'venue' : 'sidecar',
    chartOpen: extra.chartOpen === true,
    scriptName: asText(extra.scriptName),
    engineLabel: asText(extra.engineLabel) || 'Server',
  };
}

export function engineDeskLabel(mode: string): string {
  switch (mode) {
    case 'local':
      return 'Local';
    case 'pyodide':
      return 'Pyodide';
    default:
      return 'Server';
  }
}

/** File name only. Accepts `/` and `\\` separators. */
export function fileBaseName(filePath: string): string {
  const norm = String(filePath ?? '').replace(/\\/g, '/');
  const slash = norm.lastIndexOf('/');
  return slash >= 0 ? norm.slice(slash + 1) : norm;
}

export function deskDataLabel(
  state: Pick<DeskChartState, 'barsPath' | 'useMockBars' | 'datafeedSource'>,
): string {
  if (state.barsPath.trim()) return 'CSV';
  if (state.useMockBars) return 'Sample';
  // Match Pick Data wording: sidecar → "Local feed"; venue (ccxt) → "Venue".
  return state.datafeedSource === 'venue' ? 'Venue' : 'Local feed';
}

export function deskHeadline(snap: DeskSnapshot): string {
  const symbol = snap.symbol.trim();
  if (symbol) return symbol;
  return snap.chartOpen ? 'Chart' : 'No chart';
}

function pairLabel(snap: DeskSnapshot): string {
  const symbol = snap.symbol.trim();
  if (!symbol) return 'AXIS';
  const interval = snap.interval.trim();
  return interval ? `${symbol} · ${interval}` : symbol;
}

/** Status-bar text. The HOOX icon sits beside this; idle charts omit a second glyph. */
export function deskStatusText(snap: DeskSnapshot): string {
  const pair = pairLabel(snap);
  switch (snap.run) {
    case 'running':
      return `$(sync~spin) ${pair}`;
    case 'error':
      return `$(error) ${pair}`;
    case 'stopped':
      return `$(debug-stop) ${pair}`;
    case 'ok':
      return `$(check) ${pair}`;
    default:
      return pair;
  }
}

export function deskStatusTooltip(snap: DeskSnapshot): string {
  const symbol = snap.symbol.trim();
  const where =
    snap.chartOpen && symbol
      ? `${symbol} · ${snap.interval.trim() || '—'} · ${deskDataLabel(snap)}`
      : 'No chart open';
  const script = snap.scriptName.trim() ? ` Script ${snap.scriptName.trim()}.` : '';
  const engine = ` Engine ${snap.engineLabel.trim() || 'Server'}.`;
  return `AXIS chart. ${where}.${script}${engine} Click to open the AXIS side panel.`;
}

export function deskRunLabel(run: DeskRunState): string {
  switch (run) {
    case 'running':
      return 'Running';
    case 'error':
      return 'Run failed';
    case 'stopped':
      return 'Stopped';
    case 'ok':
      return 'Ran';
    default:
      return 'Ready';
  }
}

/** Holds the chart session. `setChart` keeps the current run state. */
export class DeskSession {
  private snap: DeskSnapshot = emptyDesk();
  private readonly listeners = new Set<(snap: DeskSnapshot) => void>();

  get(): DeskSnapshot {
    return this.snap;
  }

  setChart(chart: DeskChartState): void {
    const prev = this.snap;
    if (
      prev.symbol === chart.symbol &&
      prev.interval === chart.interval &&
      prev.exchange === chart.exchange &&
      prev.barsPath === chart.barsPath &&
      prev.useMockBars === chart.useMockBars &&
      prev.datafeedSource === chart.datafeedSource &&
      prev.chartOpen === chart.chartOpen &&
      prev.scriptName === chart.scriptName &&
      prev.engineLabel === chart.engineLabel
    ) {
      return;
    }
    this.snap = { ...chart, run: prev.run };
    this.emit();
  }

  setRun(state: string): void {
    if (!RUN_STATES.has(state as DeskRunState)) return;
    const run = state as DeskRunState;
    if (this.snap.run === run) return;
    this.snap = { ...this.snap, run };
    this.emit();
  }

  subscribe(listener: (snap: DeskSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snap = this.snap;
    for (const listener of this.listeners) {
      try {
        listener(snap);
      } catch {
        // One listener must not block the status bar or the view.
      }
    }
  }
}

/** Command ids the desk webview may run. Snapshot text is not included. */
export function deskCommandIds(): readonly string[] {
  return DESK_ACTIONS.flatMap((group) => group.actions.map((action) => action.command));
}

/**
 * Webview options for the desk. VS Code drops `command:` links unless
 * `enableCommandUris` lists them. `true` would allow every command id.
 */
export function deskWebviewOptions(): {
  enableScripts: false;
  enableCommandUris: readonly string[];
} {
  return {
    enableScripts: false,
    enableCommandUris: deskCommandIds(),
  };
}

/** CSP nonce token. Anything outside `[a-zA-Z0-9]` is dropped. */
export function deskStyleNonce(nonce: string): string {
  return nonce.replace(/[^a-zA-Z0-9]/g, '') || 'axis';
}

/** Desk policy. The one `<style>` block carries this nonce. No `'unsafe-inline'`. */
export function deskCsp(nonce: string): string {
  const safe = deskStyleNonce(nonce);
  return [
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "script-src 'none'",
    `style-src 'nonce-${safe}'`,
    "img-src 'none'",
    "connect-src 'none'",
  ].join('; ');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function metaLine(snap: DeskSnapshot): string {
  const parts = [snap.interval.trim(), snap.exchange.trim(), deskDataLabel(snap)].filter(
    (part) => part.length > 0,
  );
  if (!snap.chartOpen && !snap.symbol.trim()) {
    return 'Open a Pine script, then Open Chart. Ctrl+Enter or Cmd+Enter runs it.';
  }
  return parts.join(' · ');
}

function actionLink(action: DeskAction): string {
  const klass = action.primary ? 'btn primary' : 'btn';
  const iconId = deskActionIcon(action.command) ?? 'menu';
  const icon = axisIconSvg(iconId, { size: 14, className: 'btn__icon' });
  return `<a class="${klass}" href="command:${escapeHtml(action.command)}">${icon}<span class="btn__label">${escapeHtml(action.label)}</span></a>`;
}

function groupHtml(group: DeskActionGroup): string {
  const links = group.actions.map((action) => actionLink(action)).join('');
  return `<section class="group" aria-label="${escapeHtml(group.title)}"><h2>${escapeHtml(group.title)}</h2><div class="grid">${links}</div></section>`;
}

/**
 * Side-panel document. No scripts. Buttons are `command:` links from `DESK_ACTIONS`.
 */
export function renderDeskHtml(snap: DeskSnapshot, nonce: string): string {
  const safeNonce = deskStyleNonce(nonce);
  const headline = escapeHtml(deskHeadline(snap));
  const meta = escapeHtml(metaLine(snap));
  const script = snap.scriptName.trim();
  const scriptHtml = script
    ? `<p class="script">${escapeHtml(script)}</p>`
    : '';
  const engine = escapeHtml(snap.engineLabel.trim() || 'Server');
  const run = escapeHtml(deskRunLabel(snap.run));
  const runIcon = axisIconSvg(deskRunIcon(snap.run), {
    size: 12,
    className: 'pill__icon',
  });
  const groups = DESK_ACTIONS.map((group) => groupHtml(group)).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(deskCsp(safeNonce))}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AXIS</title>
<style nonce="${safeNonce}">
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 12px;
    color: var(--vscode-foreground, #e8eaee);
    background: var(--vscode-sideBar-background, transparent);
    font-family: var(--vscode-font-family, sans-serif);
    font-size: var(--vscode-font-size, 13px);
    line-height: 1.35;
  }
  .session { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }
  .kicker {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--vscode-descriptionForeground, #9aa3b2);
  }
  .head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
  }
  .pill {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 8px;
    border-radius: 999px;
    border: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.45));
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .pill__icon {
    display: block;
    width: 12px;
    height: 12px;
    flex: 0 0 auto;
  }
  .pill[data-run="running"] { color: var(--vscode-textLink-foreground, #8b9cff); }
  .pill[data-run="ok"] { color: var(--vscode-testing-iconPassed, #3ddc97); }
  .pill[data-run="error"] { color: var(--vscode-errorForeground, #f07178); }
  .pill[data-run="stopped"] { color: var(--vscode-editorWarning-foreground, #e8b84a); }
  .meta, .script, .engine {
    margin: 0;
    color: var(--vscode-descriptionForeground, #9aa3b2);
    font-variant-numeric: tabular-nums;
  }
  .group { margin: 0 0 12px; }
  h2 {
    margin: 0 0 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--vscode-descriptionForeground, #9aa3b2);
  }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 28px;
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.45));
    background: var(--vscode-button-secondaryBackground, rgba(128, 128, 128, 0.18));
    color: var(--vscode-button-secondaryForeground, inherit);
    text-decoration: none;
    text-align: center;
  }
  .btn__icon {
    display: block;
    width: 14px;
    height: 14px;
    flex: 0 0 auto;
  }
  .btn__label { min-width: 0; }
  .btn.primary {
    background: var(--vscode-button-background, #0e639c);
    color: var(--vscode-button-foreground, #fff);
    border-color: transparent;
  }
  .btn:hover { background: var(--vscode-button-secondaryHoverBackground, rgba(128, 128, 128, 0.28)); }
  .btn.primary:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
  .btn:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #8b9cff);
    outline-offset: 1px;
  }
  .hint {
    margin: 4px 0 0;
    color: var(--vscode-descriptionForeground, #9aa3b2);
    font-size: 11px;
  }
</style>
</head>
<body>
  <header class="session">
    <p class="kicker">AXIS</p>
    <div class="head">
      <h1>${headline}</h1>
      <span class="pill" data-run="${escapeHtml(snap.run)}">${runIcon}<span class="pill__label">${run}</span></span>
    </div>
    <p class="meta">${meta}</p>
    ${scriptHtml}
    <p class="engine">Engine · ${engine}</p>
  </header>
  ${groups}
  <p class="hint">Ctrl+Enter or Cmd+Enter runs the open script. Click the status-bar symbol to show this panel.</p>
</body>
</html>
`;
}
