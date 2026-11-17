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
 * Shared AXIS SVG icon markup for host HTML (start, desk) and the chart
 * toolbar. Stroke icons, `currentColor`, sized for 12–20px chrome.
 * File copies for VS Code `iconPath` live under `media/icons/`.
 */

export const AXIS_ICON_IDS = [
  'hosted',
  'local',
  'editor',
  'run',
  'stop',
  'chart',
  'data',
  'start',
  'debug-start',
  'debug-step',
  'breakpoint',
  'output',
  'engine',
  'install',
  'walkthrough',
  'profiler',
  'key',
  'clear',
  'menu',
  'trendline',
  'layers',
  'legend',
  'fullscreen',
  'source',
  'live-safe',
  'inputs',
  'strategy',
  'apply',
  'csv',
  'play',
  'info',
  'status-ok',
  'status-run',
  'status-error',
  'status-stopped',
  'status-idle',
] as const;

export type AxisIconId = (typeof AXIS_ICON_IDS)[number];

const PATHS: Record<AxisIconId, string> = {
  hosted:
    '<path d="M4 12.5a3.5 3.5 0 0 1 .6-6.9A4.5 4.5 0 0 1 13 5.5a3 3 0 0 1 .2 6"/><path d="M5.5 12.5h7"/>',
  local:
    '<rect x="2.5" y="3.5" width="11" height="8" rx="1.2"/><path d="M6 14.5h4M8 11.5v3"/>',
  editor:
    '<path d="M5.5 4.5 2.5 8l3 3.5M10.5 4.5l3 3.5-3 3.5M9 3.5l-2 9"/>',
  run: '<path d="M5 3.5v9l8-4.5z"/>',
  play: '<path d="M5 3.5v9l8-4.5z"/>',
  stop: '<rect x="4" y="4" width="8" height="8" rx="1"/>',
  chart:
    '<path d="M3 13V3M3 13h10"/><path d="M5.5 10V7.5M8 10V5M10.5 10V6.5"/>',
  data: '<ellipse cx="8" cy="4.5" rx="4.5" ry="1.8"/><path d="M3.5 4.5v3c0 1 2 1.8 4.5 1.8s4.5-.8 4.5-1.8v-3"/><path d="M3.5 7.5v3c0 1 2 1.8 4.5 1.8s4.5-.8 4.5-1.8v-3"/>',
  start:
    '<circle cx="8" cy="8" r="5.5"/><path d="M8 5v3.5l2.2 1.3"/>',
  'debug-start':
    '<path d="M3.5 3.5v9M6.5 3.5v9l7-4.5z"/>',
  'debug-step':
    '<path d="M3.5 8h6.5M7.5 5l3.5 3-3.5 3M13 3.5v9"/>',
  breakpoint: '<circle cx="8" cy="8" r="3.2"/>',
  output:
    '<rect x="2.5" y="3" width="11" height="10" rx="1.2"/><path d="M4.5 6h3M4.5 8.5h5"/>',
  engine:
    '<circle cx="8" cy="8" r="2.2"/><path d="M8 2.8v1.6M8 11.6v1.6M2.8 8h1.6M11.6 8h1.6M4.1 4.1l1.1 1.1M10.8 10.8l1.1 1.1M11.9 4.1l-1.1 1.1M5.2 10.8l-1.1 1.1"/>',
  install: '<path d="M8 3v7M5.5 7.5 8 10l2.5-2.5M3.5 13h9"/>',
  walkthrough:
    '<path d="M3.5 13.5 7 3.5l2.2 4.3L13.5 6"/><circle cx="13" cy="12.5" r="1.3"/>',
  profiler:
    '<path d="M3 13V3M3 13h10"/><path d="M5.5 11V8M8 11V5.5M10.5 11V7"/>',
  key: '<circle cx="5.5" cy="8" r="2.5"/><path d="M8 8h5.5l-1.2 1.5M11 8v2"/>',
  clear:
    '<path d="M4 5h8l-.7 8.2a1 1 0 0 1-1 .8H5.7a1 1 0 0 1-1-.8L4 5z"/><path d="M6.5 3.5h3M3.5 5h9"/>',
  menu: '<path d="M3.5 5h9M3.5 8h9M3.5 11h9"/>',
  trendline: '<path d="M3 12.5 7 7l3 2.5 3.5-5.5"/><circle cx="7" cy="7" r="1"/><circle cx="13.5" cy="4" r="1"/>',
  layers:
    '<path d="M8 2.8 13.2 6 8 9.2 2.8 6z"/><path d="M2.8 8.2 8 11.4l5.2-3.2M2.8 10.4 8 13.6l5.2-3.2"/>',
  legend:
    '<path d="M3.5 4.5h3M3.5 8h3M3.5 11.5h3"/><path d="M8.5 4.5h4M8.5 8h4M8.5 11.5h4"/>',
  fullscreen:
    '<path d="M3.5 6V3.5H6M10 3.5h2.5V6M12.5 10v2.5H10M6 12.5H3.5V10"/>',
  source:
    '<path d="M5.5 4.5 2.5 8l3 3.5M10.5 4.5l3 3.5-3 3.5"/>',
  'live-safe':
    '<path d="M8 2.8 13 5v3.2c0 3.2-2.1 5.2-5 6-2.9-.8-5-2.8-5-6V5z"/>',
  inputs:
    '<path d="M4 5.5h8M4 10.5h8"/><circle cx="6.5" cy="5.5" r="1.4"/><circle cx="10" cy="10.5" r="1.4"/>',
  strategy:
    '<path d="M3 12.5 6.5 7l2.5 2.5L13 4"/><path d="M10.5 4H13v2.5"/>',
  apply: '<path d="M3.5 8.2 6.5 11.2 12.5 4.8"/>',
  csv: '<path d="M5 2.5h4l3 3V13.5H5z"/><path d="M9 2.5v3h3M6.5 8.5h3M6.5 11h3"/>',
  info: '<circle cx="8" cy="8" r="5.5"/><path d="M8 7v4.2M8 5.2h.01"/>',
  'status-ok': '<path d="M3.5 8.2 6.5 11.2 12.5 4.8"/>',
  'status-run':
    '<path d="M8 3.2a4.8 4.8 0 1 1-4.2 2.4"/><path d="M3.5 3.2v2.6H6"/>',
  'status-error':
    '<circle cx="8" cy="8" r="5.5"/><path d="M8 5v3.8M8 11.2h.01"/>',
  'status-stopped': '<rect x="4.5" y="4.5" width="7" height="7" rx="1"/>',
  'status-idle': '<circle cx="8" cy="8" r="2.2"/>',
};

/** Relative VSIX paths for QuickPick / StatusBar `iconPath` (stroke #C5C5C5). */
export const AXIS_ICON_MEDIA: Partial<Record<AxisIconId, string>> = {
  play: 'media/icons/play.svg',
  stop: 'media/icons/stop.svg',
  install: 'media/icons/install.svg',
  output: 'media/icons/output.svg',
  info: 'media/icons/info.svg',
  engine: 'media/icons/engine.svg',
  run: 'media/icons/play.svg',
  chart: 'media/icons/chart.svg',
  data: 'media/icons/data.svg',
  start: 'media/icons/start.svg',
};

export function isAxisIconId(value: string): value is AxisIconId {
  return (AXIS_ICON_IDS as readonly string[]).includes(value);
}

export type AxisIconOptions = {
  size?: number;
  className?: string;
  label?: string;
};

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Inline SVG for a known icon id. Unknown ids return an empty string so a
 * missing map entry never injects a broken glyph.
 */
export function axisIconSvg(id: string, opts: AxisIconOptions = {}): string {
  if (!isAxisIconId(id)) return '';
  const size = Number.isFinite(opts.size) && (opts.size as number) > 0 ? Math.round(opts.size as number) : 16;
  const className = opts.className?.trim() || 'axis-icon';
  const labelText = opts.label?.trim() ?? '';
  const a11y = labelText
    ? `role="img" aria-label="${escapeAttr(labelText)}"`
    : 'aria-hidden="true" focusable="false"';
  return `<svg class="${escapeAttr(className)}" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${PATHS[id]}</svg>`;
}

/** Icon + visible label for toolbar / desk chrome. */
export function axisIconLabel(
  id: AxisIconId,
  label: string,
  opts: { size?: number; className?: string; iconClass?: string } = {},
): string {
  const icon = axisIconSvg(id, {
    size: opts.size ?? 14,
    className: opts.iconClass ?? 'axis-icon',
  });
  const klass = opts.className?.trim();
  const safeText = label
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  if (klass) {
    return `<span class="${escapeAttr(klass)}">${icon}<span class="axis-icon__label">${safeText}</span></span>`;
  }
  return `${icon}<span class="axis-icon__label">${safeText}</span>`;
}

/** Desk action command → icon id for primary / visual chrome. */
export function deskActionIcon(command: string): AxisIconId | undefined {
  switch (command) {
    case 'axis.start':
      return 'start';
    case 'axis.runScript':
      return 'run';
    case 'axis.stopRun':
      return 'stop';
    case 'axis.openChart':
      return 'chart';
    case 'axis.pickData':
      return 'data';
    case 'axis.debug.start':
      return 'debug-start';
    case 'axis.debug.stepBar':
      return 'debug-step';
    case 'axis.debug.toggleBarBreakpoint':
      return 'breakpoint';
    case 'axis.showRunOutput':
      return 'output';
    case 'axis.engine.menu':
      return 'engine';
    case 'axis.engine.setup':
      return 'install';
    case 'axis.openWalkthroughFixture':
      return 'walkthrough';
    case 'axis.profiler.show':
      return 'profiler';
    case 'axis.secrets.setProKey':
    case 'axis.secrets.setWorkerKey':
      return 'key';
    case 'axis.secrets.clear':
      return 'clear';
    case 'axis.statusbar.showPopup':
      return 'menu';
    default:
      return undefined;
  }
}

/** Start-card id → distinct icon. */
export function startCardIcon(card: 'hosted' | 'local' | 'editor'): AxisIconId {
  return card;
}

/** Desk run pill cue (HTML only — status-bar text still uses ThemeIcon). */
export function deskRunIcon(
  run: 'idle' | 'running' | 'stopped' | 'ok' | 'error',
): AxisIconId {
  switch (run) {
    case 'running':
      return 'status-run';
    case 'error':
      return 'status-error';
    case 'stopped':
      return 'status-stopped';
    case 'ok':
      return 'status-ok';
    default:
      return 'status-idle';
  }
}
