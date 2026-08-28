/** Geometry helpers shared by all three layout engines. */

import { measureLine } from './text.js';
import type { DiagramKind, Scene, SceneEdge, ScenePoint, SceneShape } from './types.js';

export const MARGIN = 40;
/** Vertical room reserved above the drawing for the title cell. */
export const TITLE_SPACE = 46;
/** Must match the size the renderers draw the title at. */
export const TITLE_FONT_SIZE = 18;

/**
 * Shift everything to positive coordinates and size the canvas around the real
 * extents — including edge channels that swing outside the shape bounding box.
 */
export function finalize(
  kind: DiagramKind,
  title: string,
  shapes: SceneShape[],
  edges: SceneEdge[],
): Scene {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const shape of shapes) {
    xs.push(shape.x, shape.x + shape.w);
    ys.push(shape.y, shape.y + shape.h);
  }
  for (const edge of edges) {
    for (const point of edge.route) {
      xs.push(point.x);
      ys.push(point.y);
    }
    if (edge.labelAt) {
      xs.push(edge.labelAt.x);
      ys.push(edge.labelAt.y);
    }
  }
  if (xs.length === 0) {
    return { kind, title, width: 400, height: 200, shapes, edges };
  }

  const shiftX = MARGIN - Math.min(...xs);
  const shiftY = MARGIN + TITLE_SPACE - Math.min(...ys);
  for (const shape of shapes) {
    shape.x = Math.round(shape.x + shiftX);
    shape.y = Math.round(shape.y + shiftY);
    shape.w = Math.round(shape.w);
    shape.h = Math.round(shape.h);
  }
  for (const edge of edges) {
    edge.route = dedupe(
      edge.route.map((point) => ({
        x: Math.round(point.x + shiftX),
        y: Math.round(point.y + shiftY),
      })),
    );
    if (edge.labelAt) {
      edge.labelAt = {
        x: Math.round(edge.labelAt.x + shiftX),
        y: Math.round(edge.labelAt.y + shiftY),
      };
    }
  }

  // A narrow diagram can still carry a wide heading; without this the title is
  // drawn past the edge of the canvas and clipped.
  const titleWidth = title === '' ? 0 : MARGIN * 2 + measureLine(title, TITLE_FONT_SIZE, true);

  return {
    kind,
    title,
    width: Math.round(Math.max(Math.max(...xs) + shiftX + MARGIN, titleWidth)),
    height: Math.round(Math.max(...ys) + shiftY + MARGIN),
    shapes,
    edges,
  };
}

/**
 * Drop repeated waypoints. A Z-route collapses to a straight line whenever its
 * endpoints already share an axis, and draw.io renders the leftover duplicate
 * points as a visible kink.
 */
function dedupe(route: ScenePoint[]): ScenePoint[] {
  return route.filter(
    (point, index) =>
      index === 0 || point.x !== route[index - 1].x || point.y !== route[index - 1].y,
  );
}

/**
 * Where an edge label sits.
 *
 * Centred on the midpoint, but lifted clear of a horizontal segment: on a short
 * horizontal edge the label's backing plate is wider than the gap between the
 * two shapes and would otherwise cover its own arrowhead.
 */
export function labelPointFor(route: ScenePoint[]): ScenePoint {
  const mid = midpointOf(route);
  const segment = segmentContaining(route, mid);
  if (!segment) return mid;
  const horizontal = Math.abs(segment.b.x - segment.a.x) >= Math.abs(segment.b.y - segment.a.y);
  return horizontal ? { x: mid.x, y: mid.y - 12 } : mid;
}

function segmentContaining(
  route: ScenePoint[],
  point: ScenePoint,
): { a: ScenePoint; b: ScenePoint } | undefined {
  if (route.length < 2) return undefined;
  if (route.length === 2) return { a: route[0], b: route[1] };
  const middle = Math.floor(route.length / 2);
  void point;
  return { a: route[middle - 1], b: route[middle] };
}

/** Point halfway along a polyline, used to park edge labels. */
export function midpointOf(route: ScenePoint[]): ScenePoint {
  if (route.length < 2) return route[0] ?? { x: 0, y: 0 };
  if (route.length === 2) {
    return { x: (route[0].x + route[1].x) / 2, y: (route[0].y + route[1].y) / 2 };
  }
  const middle = Math.floor(route.length / 2);
  const a = route[middle - 1];
  const b = route[middle];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
