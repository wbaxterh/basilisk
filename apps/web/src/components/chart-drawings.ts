/**
 * chart-drawings.ts — canvas drawing layer helpers for TokenChart.
 *
 * Pure module (no React): drawing model + localStorage persistence +
 * time/price ↔ pixel mapping + hit-testing + canvas rendering.
 *
 * Coordinate strategy: points are stored as { time (unix s, candle time),
 * price (display units) } so they survive timeframe switches. Mapping to
 * pixels goes through the chart's LOGICAL scale (logicalToCoordinate) with
 * fractional interpolation/extrapolation over the loaded candle times —
 * lightweight-charts' timeToCoordinate returns null for any time that is
 * not an exact loaded bar, which would make drawings vanish after a tf
 * switch or when an endpoint scrolls out of the loaded window. Points
 * beyond the loaded range extrapolate on the tf grid and draw clipped.
 */

import type { Coordinate, Logical, Time } from "lightweight-charts";

// ---------------------------------------------------------------------------
// Model + persistence
// ---------------------------------------------------------------------------

export type DrawingType = "trend" | "ray" | "hline";

export interface DrawingPoint {
  /** Unix seconds — snapped to a candle time (or tf-grid extrapolation). */
  time: number;
  /** Price in the display units active when the drawing was created. */
  price: number;
}

export interface Drawing {
  id: string;
  type: DrawingType;
  points: DrawingPoint[];
}

/** In-progress two-point drawing: first anchor + live cursor position. */
export interface DraftDrawing {
  type: "trend" | "ray";
  start: DrawingPoint;
  cursor: { x: number; y: number } | null;
}

const KEY_PREFIX = "basilisk.drawings.";

export function drawingsKey(asset: string): string {
  return `${KEY_PREFIX}${asset.toLowerCase()}`;
}

const POINTS_REQUIRED: Record<DrawingType, number> = { trend: 2, ray: 2, hline: 1 };

export function loadDrawings(asset: string): Drawing[] {
  try {
    const raw = localStorage.getItem(drawingsKey(asset));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: Drawing[] = [];
    for (const d of parsed as Array<Partial<Drawing>>) {
      if (!d || (d.type !== "trend" && d.type !== "ray" && d.type !== "hline")) continue;
      if (!Array.isArray(d.points) || d.points.length < POINTS_REQUIRED[d.type]) continue;
      const points = d.points
        .slice(0, POINTS_REQUIRED[d.type])
        .filter((p) => Number.isFinite(p?.time) && Number.isFinite(p?.price))
        .map((p) => ({ time: p.time, price: p.price }));
      if (points.length < POINTS_REQUIRED[d.type]) continue;
      out.push({ id: typeof d.id === "string" ? d.id : newDrawingId(), type: d.type, points });
    }
    return out;
  } catch {
    return [];
  }
}

export function saveDrawings(asset: string, drawings: Drawing[]): void {
  try {
    if (drawings.length === 0) localStorage.removeItem(drawingsKey(asset));
    else localStorage.setItem(drawingsKey(asset), JSON.stringify(drawings));
  } catch {
    /* storage full/blocked — drawings just won't persist */
  }
}

export function newDrawingId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Coordinate mapping
// ---------------------------------------------------------------------------

/** Structural subset of ITimeScaleApi (keeps this module React/chart-free). */
export interface TimeScaleLike {
  timeToCoordinate(time: Time): Coordinate | null;
  logicalToCoordinate(logical: Logical): Coordinate | null;
  coordinateToLogical(x: number): Logical | null;
}

/** Structural subset of ISeriesApi (any series kind satisfies this). */
export interface PriceScaleLike {
  priceToCoordinate(price: number): Coordinate | null;
  coordinateToPrice(coordinate: number): number | null;
}

export interface DrawingMapper {
  timeToX(time: number): number | null;
  priceToY(price: number): number | null;
  /** Inverse: pixel → candle time (snapped to bar / tf grid). */
  xToTime(x: number): number | null;
  yToPrice(y: number): number | null;
}

/**
 * Build a mapper over the CURRENT loaded candle times (ascending unix s).
 * `tfSeconds` is the nominal bar interval used to extrapolate beyond the
 * loaded window (gaps inside the window interpolate between real bars).
 */
export function createMapper(
  timeScale: TimeScaleLike,
  series: PriceScaleLike,
  times: number[],
  tfSeconds: number
): DrawingMapper {
  const n = times.length;
  const step = tfSeconds > 0 ? tfSeconds : 60;

  const timeToLogical = (t: number): number | null => {
    if (n === 0) return null;
    if (t <= times[0]) return (t - times[0]) / step;
    if (t >= times[n - 1]) return n - 1 + (t - times[n - 1]) / step;
    // binary search: greatest i with times[i] <= t
    let lo = 0;
    let hi = n - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= t) lo = mid;
      else hi = mid;
    }
    const span = times[lo + 1] - times[lo];
    return lo + (span > 0 ? (t - times[lo]) / span : 0);
  };

  return {
    timeToX(t: number): number | null {
      const logical = timeToLogical(t);
      if (logical == null) return null;
      return timeScale.logicalToCoordinate(logical as Logical);
    },
    priceToY(p: number): number | null {
      return series.priceToCoordinate(p);
    },
    xToTime(x: number): number | null {
      if (n === 0) return null;
      const logical = timeScale.coordinateToLogical(x);
      if (logical == null) return null;
      const idx = Math.round(logical);
      if (idx < 0) return times[0] + idx * step;
      if (idx >= n) return times[n - 1] + (idx - (n - 1)) * step;
      return times[idx];
    },
    yToPrice(y: number): number | null {
      return series.coordinateToPrice(y);
    },
  };
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

interface Segment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Screen-space segment for a drawing inside `area` (main pane rect at 0,0),
 * or null when it can't be mapped (no data). Ray extends from p0 through p1
 * to the pane edge; hline spans the full width.
 */
function toSegment(d: Drawing, mapper: DrawingMapper, area: { width: number; height: number }): Segment | null {
  if (d.type === "hline") {
    const y = mapper.priceToY(d.points[0].price);
    if (y == null) return null;
    return { x0: 0, y0: y, x1: area.width, y1: y };
  }
  const x0 = mapper.timeToX(d.points[0].time);
  const y0 = mapper.priceToY(d.points[0].price);
  const x1 = mapper.timeToX(d.points[1].time);
  const y1 = mapper.priceToY(d.points[1].price);
  if (x0 == null || y0 == null || x1 == null || y1 == null) return null;
  if (d.type === "trend") return { x0, y0, x1, y1 };
  // Ray: extend beyond p1 in the p0→p1 direction until the pane edge.
  const dx = x1 - x0;
  const dy = y1 - y0;
  if (dx === 0 && dy === 0) return { x0, y0, x1, y1 };
  if (dx === 0) return { x0, y0, x1, y1: dy > 0 ? area.height : 0 };
  const targetX = dx > 0 ? area.width : 0;
  const t = (targetX - x0) / dx;
  return { x0, y0, x1: targetX, y1: y0 + dy * t };
}

function distToSegment(px: number, py: number, s: Segment): number {
  const dx = s.x1 - s.x0;
  const dy = s.y1 - s.y0;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - s.x0) * dx + (py - s.y0) * dy) / lenSq));
  const cx = s.x0 + t * dx;
  const cy = s.y0 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Topmost drawing within `tolerance` px of (x, y), or null. Iterates in
 * reverse so the most recently added drawing wins ties.
 */
export function hitTest(
  drawings: Drawing[],
  mapper: DrawingMapper,
  area: { width: number; height: number },
  x: number,
  y: number,
  tolerance = 6
): string | null {
  for (let i = drawings.length - 1; i >= 0; i--) {
    const seg = toSegment(drawings[i], mapper, area);
    if (seg && distToSegment(x, y, seg) <= tolerance) return drawings[i].id;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** globals.css tokens (canvas can't read CSS vars): info + warning. */
const TREND_COLOR = "#70ECFD";
const HLINE_COLOR = "#FFC107";
const HANDLE_FILL = "#15161A"; // --color-bg-elevated (canvas can't read CSS vars)
const LINE_WIDTH = 1.5;

export interface RenderState {
  draft?: DraftDrawing | null;
  /** Drawing id under the cursor while the eraser tool is active. */
  hoveredId?: string | null;
  eraserActive?: boolean;
  /** Formats the hline price label (falls back to toPrecision). */
  formatPrice?: (p: number) => string;
}

/**
 * Draw every drawing (plus the in-progress draft) clipped to the main pane
 * rect. `ctx` must already be scaled to CSS pixels (devicePixelRatio applied
 * by the caller via setTransform).
 */
export function renderDrawings(
  ctx: CanvasRenderingContext2D,
  area: { width: number; height: number },
  drawings: Drawing[],
  mapper: DrawingMapper,
  state: RenderState = {}
): void {
  if (area.width <= 0 || area.height <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, area.width, area.height);
  ctx.clip();
  ctx.lineWidth = LINE_WIDTH;
  ctx.lineCap = "round";

  for (const d of drawings) {
    const seg = toSegment(d, mapper, area);
    if (!seg) continue;
    const color = d.type === "hline" ? HLINE_COLOR : TREND_COLOR;
    ctx.strokeStyle = color;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(seg.x0, seg.y0);
    ctx.lineTo(seg.x1, seg.y1);
    ctx.stroke();

    if (d.type === "hline") {
      const label = state.formatPrice ? state.formatPrice(d.points[0].price) : d.points[0].price.toPrecision(6);
      ctx.font = "700 10px 'JetBrains Mono', 'SF Mono', Menlo, monospace";
      const w = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(21, 22, 26, 0.85)";
      ctx.fillRect(area.width - w - 14, seg.y0 - 14, w + 10, 14);
      ctx.fillStyle = HLINE_COLOR;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText(label, area.width - 9, seg.y0 - 3);
    }

    // Subtle endpoint handles while hovering a drawing in eraser mode.
    if (state.eraserActive && state.hoveredId === d.id) {
      ctx.fillStyle = HANDLE_FILL;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      for (const p of d.points) {
        const hx = d.type === "hline" ? area.width / 2 : mapper.timeToX(p.time);
        const hy = mapper.priceToY(p.price);
        if (hx == null || hy == null) continue;
        ctx.beginPath();
        ctx.arc(hx, hy, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.lineWidth = LINE_WIDTH;
    }
  }

  // In-progress preview: anchor → live cursor, dashed.
  const draft = state.draft;
  if (draft?.cursor) {
    const x0 = mapper.timeToX(draft.start.time);
    const y0 = mapper.priceToY(draft.start.price);
    if (x0 != null && y0 != null) {
      ctx.strokeStyle = TREND_COLOR;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(draft.cursor.x, draft.cursor.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = HANDLE_FILL;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x0, y0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();
}
