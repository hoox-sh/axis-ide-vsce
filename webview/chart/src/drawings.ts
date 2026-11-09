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

function appendLine(
  svg: SVGSVGElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  className: string,
  color?: string,
  width?: number,
): void {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', String(x1));
  line.setAttribute('y1', String(y1));
  line.setAttribute('x2', String(x2));
  line.setAttribute('y2', String(y2));
  line.setAttribute('class', className);
  if (color) line.setAttribute('stroke', color);
  if (width) line.setAttribute('stroke-width', String(width));
  svg.appendChild(line);
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
      appendLine(svg, a.x, a.y, b.x, b.y, 'drawing-overlay__engine', d.color, d.width);
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
    rect.setAttribute('width', String(Math.abs(b.x - a.x)));
    rect.setAttribute('height', String(Math.abs(b.y - a.y)));
    rect.setAttribute('class', 'drawing-overlay__box');
    if (d.bgcolor) rect.setAttribute('fill', d.bgcolor);
    if (d.color) rect.setAttribute('stroke', d.color);
    svg.appendChild(rect);
    return;
  }
  if (type === 'label' && d.t1 !== undefined && d.p1 !== undefined) {
    const p = coords.toPixel({ time: chartTime(d.t1) ?? d.t1, price: d.p1 });
    if (!p) return;
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', String(p.x));
    text.setAttribute('y', String(p.y));
    text.setAttribute('class', 'drawing-overlay__label');
    if (d.textcolor) text.setAttribute('fill', d.textcolor);
    text.textContent = d.text ?? '';
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
    if (d.bgcolor || d.color) poly.setAttribute('fill', d.bgcolor || d.color || '');
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
      for (const d of drawings) {
        if (d.tool !== TOOL_TRENDLINE || d.points.length < 2) continue;
        const a = coords.toPixel(d.points[0]);
        const b = coords.toPixel(d.points[1]);
        if (!a || !b) continue;
        appendLine(svg, a.x, a.y, b.x, b.y, 'drawing-overlay__line');
      }
      for (const ed of engine ?? []) {
        try {
          paintEngineDrawing(svg, ed, coords);
        } catch {
          // skip hostile
        }
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
