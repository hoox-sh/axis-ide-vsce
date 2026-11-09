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
 * MVP trendline chrome — SVG overlay + two-click place → drawing.commit.
 */

import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import type { EngineDrawing, UserDrawing } from './state';

export const TOOL_TRENDLINE = 'trendline' as const;

export interface ChartPoint {
  time: number;
  price: number;
}

export interface DrawingOverlay {
  redraw(drawings: UserDrawing[], draft?: ChartPoint | null, engine?: EngineDrawing[]): void;
  dispose(): void;
}

export interface CoordAdapter {
  /** Pixel (relative to overlay) → chart time/price; null when unmapped. */
  toChartPoint(x: number, y: number): ChartPoint | null;
  /** Chart time/price → pixel; null when off-scale. */
  toPixel(point: ChartPoint): { x: number; y: number } | null;
}

/** Build coord adapter from LWC chart + series (stub returns nulls). */
export function createLwcCoordAdapter(
  chart: IChartApi | null,
  series: ISeriesApi<'Candlestick'> | null,
): CoordAdapter {
  return {
    toChartPoint(x: number, y: number): ChartPoint | null {
      if (!chart || !series) return null;
      try {
        const rawTime = chart.timeScale().coordinateToTime(x);
        const price = series.coordinateToPrice(y);
        if (rawTime === null || price === null) return null;
        const time =
          typeof rawTime === 'number'
            ? rawTime
            : typeof rawTime === 'object' && rawTime && 'timestamp' in rawTime
              ? Number((rawTime as { timestamp: number }).timestamp)
              : Number(rawTime);
        if (!Number.isFinite(time) || !Number.isFinite(price)) return null;
        return { time, price };
      } catch {
        return null;
      }
    },
    toPixel(point: ChartPoint): { x: number; y: number } | null {
      if (!chart || !series) return null;
      try {
        const x = chart.timeScale().timeToCoordinate(point.time as UTCTimestamp);
        const y = series.priceToCoordinate(point.price);
        if (x === null || y === null) return null;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return { x, y };
      } catch {
        return null;
      }
    },
  };
}

function clearSvg(svg: SVGSVGElement): void {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}

function channelHex(color: string): [number, number, number] | null {
  const hex = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    return [
      Number.parseInt(hex.slice(1, 3), 16),
      Number.parseInt(hex.slice(3, 5), 16),
      Number.parseInt(hex.slice(5, 7), 16),
    ];
  }
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    return [
      Number.parseInt(hex[1] + hex[1], 16),
      Number.parseInt(hex[2] + hex[2], 16),
      Number.parseInt(hex[3] + hex[3], 16),
    ];
  }
  return null;
}

function luma(color: string): number | null {
  const rgb = channelHex(color);
  if (!rgb) return null;
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
}

/** Opaque hex becomes rgba so boxes and fills don't paint out the candles. */
function translucent(color: string | undefined, alpha: number): string | null {
  if (!color) return null;
  const trimmed = color.trim();
  if (/^(rgba?|hsla?)\(/i.test(trimmed)) return trimmed;
  const rgb = channelHex(trimmed);
  if (!rgb) return trimmed;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

/** Near-black strokes disappear on the void chart. */
function readableStroke(color: string | undefined, fallback: string): string | undefined {
  if (!color) return undefined;
  const y = luma(color);
  if (y === null) return color;
  return y < 0.22 ? fallback : color;
}

function labelInk(text: string | undefined, bg: string | undefined): string {
  const bgLuma = bg ? luma(bg) : 0.07;
  const lightBg = (bgLuma ?? 0.07) >= 0.55;
  const fallback = lightBg ? '#12141a' : '#e8eaee';
  if (!text) return fallback;
  const y = luma(text);
  if (y === null) return text;
  if (!lightBg && y < 0.45) return fallback;
  if (lightBg && y > 0.62) return fallback;
  return text;
}

function dashArray(style?: string): string | undefined {
  const raw = String(style ?? '').toLowerCase();
  if (!raw) return undefined;
  if (raw.includes('dot')) return '1 3';
  if (raw.includes('dash')) return '5 4';
  return undefined;
}

function appendLine(
  svg: SVGSVGElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  className: string,
  color?: string,
  width?: number,
  dash?: string,
): void {
  const hit = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  hit.setAttribute('x1', String(x1));
  hit.setAttribute('y1', String(y1));
  hit.setAttribute('x2', String(x2));
  hit.setAttribute('y2', String(y2));
  hit.setAttribute('class', 'drawing-overlay__hit');
  svg.appendChild(hit);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', String(x1));
  line.setAttribute('y1', String(y1));
  line.setAttribute('x2', String(x2));
  line.setAttribute('y2', String(y2));
  line.setAttribute('class', className);
  const stroke = readableStroke(color, '#e8eaee');
  if (stroke) line.setAttribute('stroke', stroke);
  if (width && width > 0) {
    line.setAttribute('stroke-width', String(Math.min(4, Math.max(1, width))));
  }
  if (dash) line.setAttribute('stroke-dasharray', dash);
  svg.appendChild(line);
}

function appendHandle(svg: SVGSVGElement, x: number, y: number): void {
  const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  handle.setAttribute('cx', String(x));
  handle.setAttribute('cy', String(y));
  handle.setAttribute('r', '3.5');
  handle.setAttribute('class', 'drawing-overlay__handle');
  svg.appendChild(handle);
}

function chartTime(raw: number | undefined): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  return raw > 1e11 ? Math.round(raw / 1000) : raw;
}

function paintEngineDrawing(
  svg: SVGSVGElement,
  d: EngineDrawing,
  coords: CoordAdapter,
): void {
  const type = d.type;
  if (type === 'table') return;
  if (type === 'line' || type === 'polyline') {
    const pts =
      d.points && d.points.length >= 2
        ? d.points
        : d.t1 !== undefined && d.p1 !== undefined && d.t2 !== undefined && d.p2 !== undefined
          ? [
              { time: d.t1, price: d.p1 },
              { time: d.t2, price: d.p2 },
            ]
          : [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = coords.toPixel({ time: chartTime(pts[i].time) ?? pts[i].time, price: pts[i].price });
      const b = coords.toPixel({
        time: chartTime(pts[i + 1].time) ?? pts[i + 1].time,
        price: pts[i + 1].price,
      });
      if (!a || !b) continue;
      appendLine(
        svg,
        a.x,
        a.y,
        b.x,
        b.y,
        'drawing-overlay__engine',
        d.color,
        d.width,
        dashArray(d.style),
      );
      if (type === 'line') {
        appendHandle(svg, a.x, a.y);
        appendHandle(svg, b.x, b.y);
      }
    }
    return;
  }
  if (type === 'box' && d.t1 !== undefined && d.p1 !== undefined && d.t2 !== undefined && d.p2 !== undefined) {
    const a = coords.toPixel({ time: chartTime(d.t1) ?? d.t1, price: d.p1 });
    const b = coords.toPixel({ time: chartTime(d.t2) ?? d.t2, price: d.p2 });
    if (!a || !b) return;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(Math.min(a.x, b.x)));
    rect.setAttribute('y', String(Math.min(a.y, b.y)));
    rect.setAttribute('width', String(Math.max(1, Math.abs(b.x - a.x))));
    rect.setAttribute('height', String(Math.max(1, Math.abs(b.y - a.y))));
    rect.setAttribute('class', 'drawing-overlay__box');
    const fill = translucent(d.bgcolor, 0.18);
    if (fill) rect.setAttribute('fill', fill);
    const stroke = readableStroke(d.color, '#6ee7f5');
    if (stroke) rect.setAttribute('stroke', stroke);
    rect.setAttribute('stroke-width', '1.25');
    svg.appendChild(rect);
    return;
  }
  if (type === 'label' && d.t1 !== undefined && d.p1 !== undefined) {
    const p = coords.toPixel({ time: chartTime(d.t1) ?? d.t1, price: d.p1 });
    if (!p) return;
    const textValue = (d.text ?? '').trim();
    if (!textValue) return;
    const width = Math.max(16, textValue.length * 7 + 10);
    const height = 18;
    const x = p.x + 6;
    const y = p.y - height - 4;
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', String(x));
    bg.setAttribute('y', String(y));
    bg.setAttribute('width', String(width));
    bg.setAttribute('height', String(height));
    bg.setAttribute('rx', '2');
    bg.setAttribute('class', 'drawing-overlay__label-bg');
    const bgFill = translucent(d.bgcolor, 0.92);
    if (bgFill) bg.setAttribute('fill', bgFill);
    svg.appendChild(bg);
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', String(x + 5));
    text.setAttribute('y', String(y + 13));
    text.setAttribute('class', 'drawing-overlay__label');
    text.setAttribute('fill', labelInk(d.textcolor, d.bgcolor));
    text.textContent = textValue;
    svg.appendChild(text);
    return;
  }
  if (
    type === 'linefill' &&
    d.t1 !== undefined &&
    d.p1 !== undefined &&
    d.t2 !== undefined &&
    d.p2 !== undefined &&
    d.t3 !== undefined &&
    d.p3 !== undefined &&
    d.t4 !== undefined &&
    d.p4 !== undefined
  ) {
    const pts = [
      coords.toPixel({ time: chartTime(d.t1) ?? d.t1, price: d.p1 }),
      coords.toPixel({ time: chartTime(d.t2) ?? d.t2, price: d.p2 }),
      coords.toPixel({ time: chartTime(d.t4) ?? d.t4, price: d.p4 }),
      coords.toPixel({ time: chartTime(d.t3) ?? d.t3, price: d.p3 }),
    ];
    if (pts.some((p) => !p)) return;
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute(
      'points',
      pts
        .filter((p): p is { x: number; y: number } => !!p)
        .map((p) => `${p.x},${p.y}`)
        .join(' '),
    );
    poly.setAttribute('class', 'drawing-overlay__fill');
    poly.setAttribute('fill', translucent(d.bgcolor || d.color, 0.2) ?? 'rgba(110,231,245,0.18)');
    const stroke = readableStroke(d.color || d.bgcolor, '#6ee7f5');
    if (stroke) poly.setAttribute('stroke', stroke);
    poly.setAttribute('stroke-width', '1');
    svg.appendChild(poly);
  }
}

/** SVG overlay that maps committed (+ optional draft) drawings via coords. */
export function createDrawingOverlay(
  svg: SVGSVGElement,
  getCoords: () => CoordAdapter,
): DrawingOverlay {
  let disposed = false;

  return {
    redraw(drawings: UserDrawing[], draft?: ChartPoint | null, engine?: EngineDrawing[]): void {
      if (disposed) return;
      clearSvg(svg);
      const coords = getCoords();
      for (const ed of engine ?? []) {
        try {
          paintEngineDrawing(svg, ed, coords);
        } catch {
          // skip hostile
        }
      }
      for (const d of drawings) {
        if (d.tool !== TOOL_TRENDLINE || d.points.length < 2) continue;
        const a = coords.toPixel(d.points[0]);
        const b = coords.toPixel(d.points[1]);
        if (!a || !b) continue;
        appendLine(svg, a.x, a.y, b.x, b.y, 'drawing-overlay__line');
        appendHandle(svg, a.x, a.y);
        appendHandle(svg, b.x, b.y);
      }
      if (draft) {
        const p = coords.toPixel(draft);
        if (p) {
          const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          c.setAttribute('cx', String(p.x));
          c.setAttribute('cy', String(p.y));
          c.setAttribute('r', '4');
          c.setAttribute('class', 'drawing-overlay__draft');
          svg.appendChild(c);
        }
      }
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      clearSvg(svg);
    },
  };
}

let drawingSeq = 0;

/** Stable-enough id for a committed trendline (webview-generated). */
export function nextDrawingId(): string {
  drawingSeq += 1;
  return `tl-${Date.now().toString(36)}-${drawingSeq}`;
}

export interface TrendlinePlacer {
  readonly tool: string | null;
  setTool(tool: string | null): void;
  /** Returns a commit payload when the second point lands; otherwise null. */
  onClick(point: ChartPoint): UserDrawing | null;
  getDraft(): ChartPoint | null;
  resetDraft(): void;
}

/** Two-click trendline placer (stays in tool mode after commit). */
export function createTrendlinePlacer(): TrendlinePlacer {
  let tool: string | null = null;
  let draft: ChartPoint | null = null;

  return {
    get tool() {
      return tool;
    },
    setTool(next: string | null): void {
      tool = next === TOOL_TRENDLINE ? TOOL_TRENDLINE : next && next.length > 0 ? next : null;
      if (tool !== TOOL_TRENDLINE) draft = null;
    },
    onClick(point: ChartPoint): UserDrawing | null {
      if (tool !== TOOL_TRENDLINE) return null;
      if (!draft) {
        draft = point;
        return null;
      }
      const drawing: UserDrawing = {
        id: nextDrawingId(),
        tool: TOOL_TRENDLINE,
        points: [draft, point],
      };
      draft = null;
      return drawing;
    },
    getDraft(): ChartPoint | null {
      return draft;
    },
    resetDraft(): void {
      draft = null;
    },
  };
}
