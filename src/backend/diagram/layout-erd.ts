/**
 * Entity relationship layout.
 *
 * Entities become draw.io stack-layout swimlanes — the same construction the
 * editor's own ER shapes use — so each attribute stays an individually editable
 * row after the file is opened. Placement is a breadth-first grid: related
 * entities are visited together, which keeps relationship edges short without
 * the unpredictability of a force simulation.
 */

import { MARGIN, TITLE_SPACE, finalize, labelPointFor } from './layout-common.js';
import { measureLine, snap } from './text.js';
import { ERD_STYLE, PALETTE, cardinalityArrow, drawioEndArrow, drawioStartArrow } from './theme.js';
import type {
  Entity,
  ErdSpec,
  Scene,
  SceneEdge,
  ScenePoint,
  SceneShape,
} from './types.js';

const FONT_SIZE = 12;
const HEADER_FONT_SIZE = 13;
const MIN_WIDTH = 190;
const MAX_WIDTH = 340;
const COLUMN_GAP = 120;
const ROW_GAP = 90;
const MAX_COLUMNS = 4;

interface Placed {
  entity: Entity;
  rows: string[];
  w: number;
  h: number;
  x: number;
  y: number;
  column: number;
  row: number;
}

export function layoutErd(spec: ErdSpec): Scene {
  const placed = sizeEntities(spec);
  const byId = new Map(placed.map((item) => [item.entity.id, item]));
  arrangeGrid(placed, spec, byId);

  const shapes: SceneShape[] = [];
  for (const item of placed) {
    shapes.push(buildEntityShape(item));
    item.rows.forEach((row, index) => {
      shapes.push(buildRowShape(item, row, index));
    });
  }

  const edges: SceneEdge[] = spec.relationships
    .map((relationship, index) => {
      const from = byId.get(relationship.from);
      const to = byId.get(relationship.to);
      if (!from || !to || from === to) return undefined;
      return routeRelationship(relationship, from, to, index);
    })
    .filter((edge): edge is SceneEdge => edge !== undefined);

  return finalize('erd', spec.title, shapes, edges);
}

/* ------------------------------------------------------------ 1. sizing */

function formatRow(field: Entity['fields'][number]): string {
  const marker = field.key === 'none' ? '' : `${field.key}  `;
  const type = field.type === '' ? '' : `: ${field.type}`;
  return `${marker}${field.name}${type}`;
}

function sizeEntities(spec: ErdSpec): Placed[] {
  return spec.entities.map((entity) => {
    const rows = entity.fields.map(formatRow);
    const headerWidth = measureLine(entity.label, HEADER_FONT_SIZE, true) + 40;
    const widest = rows.reduce(
      (max, row) => Math.max(max, measureLine(row, FONT_SIZE) + 34),
      0,
    );
    return {
      entity,
      rows,
      w: snap(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, headerWidth, widest))),
      h: ERD_STYLE.headerHeight + rows.length * ERD_STYLE.rowHeight,
      x: 0,
      y: 0,
      column: 0,
      row: 0,
    };
  });
}

/* --------------------------------------------------------- 2. placement */

/**
 * Visit entities breadth-first from the most connected one so neighbours land
 * in adjacent grid cells, then centre each entity within its column.
 */
function arrangeGrid(placed: Placed[], spec: ErdSpec, byId: Map<string, Placed>): void {
  const adjacency = new Map<string, string[]>();
  for (const relationship of spec.relationships) {
    if (relationship.from === relationship.to) continue;
    (adjacency.get(relationship.from) ?? adjacency.set(relationship.from, []).get(relationship.from)!)
      .push(relationship.to);
    (adjacency.get(relationship.to) ?? adjacency.set(relationship.to, []).get(relationship.to)!)
      .push(relationship.from);
  }

  const seeds = [...placed].sort(
    (a, b) =>
      (adjacency.get(b.entity.id)?.length ?? 0) - (adjacency.get(a.entity.id)?.length ?? 0),
  );

  const visited = new Set<string>();
  const order: Placed[] = [];
  for (const seed of seeds) {
    if (visited.has(seed.entity.id)) continue;
    const queue = [seed.entity.id];
    visited.add(seed.entity.id);
    while (queue.length > 0) {
      const id = queue.shift()!;
      const item = byId.get(id);
      if (item) order.push(item);
      for (const next of adjacency.get(id) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
  }

  const columns = Math.max(1, Math.min(MAX_COLUMNS, Math.round(Math.sqrt(order.length))));
  order.forEach((item, index) => {
    item.column = index % columns;
    item.row = Math.floor(index / columns);
  });

  const columnWidths: number[] = [];
  const rowHeights: number[] = [];
  for (const item of order) {
    columnWidths[item.column] = Math.max(columnWidths[item.column] ?? 0, item.w);
    rowHeights[item.row] = Math.max(rowHeights[item.row] ?? 0, item.h);
  }

  const columnX: number[] = [];
  let cursorX = MARGIN;
  columnWidths.forEach((width, index) => {
    columnX[index] = cursorX;
    cursorX += width + COLUMN_GAP;
  });

  const rowY: number[] = [];
  let cursorY = MARGIN + TITLE_SPACE;
  rowHeights.forEach((height, index) => {
    rowY[index] = cursorY;
    cursorY += height + ROW_GAP;
  });

  for (const item of order) {
    item.x = columnX[item.column] + (columnWidths[item.column] - item.w) / 2;
    item.y = rowY[item.row];
  }
}

/* ------------------------------------------------------------ 3. shapes */

function buildEntityShape(item: Placed): SceneShape {
  return {
    id: item.entity.id,
    geom: 'table',
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    label: item.entity.label,
    labelLines: [item.entity.label],
    fill: ERD_STYLE.headerFill,
    stroke: ERD_STYLE.headerStroke,
    fontColor: PALETTE.ink,
    fontSize: HEADER_FONT_SIZE,
    bold: true,
    align: 'center',
    verticalAlign: 'middle',
    headerHeight: ERD_STYLE.headerHeight,
    drawioStyle:
      ERD_STYLE.entityDrawioStyle + `swimlaneFillColor=${ERD_STYLE.bodyFill};`,
  };
}

function buildRowShape(item: Placed, row: string, index: number): SceneShape {
  const field = item.entity.fields[index];
  return {
    id: `${item.entity.id}-field-${index}`,
    geom: 'tableRow',
    x: item.x,
    y: item.y + ERD_STYLE.headerHeight + index * ERD_STYLE.rowHeight,
    w: item.w,
    h: ERD_STYLE.rowHeight,
    label: row,
    labelLines: [row],
    parent: item.entity.id,
    fill: 'none',
    stroke: 'none',
    fontColor: PALETTE.ink,
    fontSize: FONT_SIZE,
    bold: field?.key === 'PK',
    align: 'left',
    verticalAlign: 'middle',
    tooltip: field?.comment,
    drawioStyle: ERD_STYLE.rowDrawioStyle,
  };
}

/* ------------------------------------------------------------- 4. edges */

function routeRelationship(
  relationship: ErdSpec['relationships'][number],
  from: Placed,
  to: Placed,
  index: number,
): SceneEdge {
  const startArrow = cardinalityArrow(relationship.fromCardinality);
  const endArrow = cardinalityArrow(relationship.toCardinality);

  let route: ScenePoint[];
  let exit: ScenePoint;
  let entry: ScenePoint;

  if (from.column === to.column) {
    // Stacked in the same column: leave the bottom, enter the top.
    const upper = from.y <= to.y ? from : to;
    const lower = upper === from ? to : from;
    const midY = (upper.y + upper.h + lower.y) / 2;
    const a = { x: upper.x + upper.w / 2, y: upper.y + upper.h };
    const b = { x: lower.x + lower.w / 2, y: lower.y };
    const points = [a, { x: a.x, y: midY }, { x: b.x, y: midY }, b];
    route = upper === from ? points : [...points].reverse();
    exit = upper === from ? { x: 0.5, y: 1 } : { x: 0.5, y: 0 };
    entry = upper === from ? { x: 0.5, y: 0 } : { x: 0.5, y: 1 };
  } else {
    const leftIsFrom = from.x <= to.x;
    const left = leftIsFrom ? from : to;
    const right = leftIsFrom ? to : from;
    const midX = (left.x + left.w + right.x) / 2;
    const a = { x: left.x + left.w, y: left.y + headerCenter(left) };
    const b = { x: right.x, y: right.y + headerCenter(right) };
    const points = [a, { x: midX, y: a.y }, { x: midX, y: b.y }, b];
    route = leftIsFrom ? points : [...points].reverse();
    exit = leftIsFrom ? { x: 1, y: headerCenter(from) / from.h } : { x: 0, y: headerCenter(from) / from.h };
    entry = leftIsFrom ? { x: 0, y: headerCenter(to) / to.h } : { x: 1, y: headerCenter(to) / to.h };
  }

  return {
    id: `relationship-${index}`,
    source: from.entity.id,
    target: to.entity.id,
    label: relationship.label,
    route,
    labelAt: labelPointFor(route),
    stroke: PALETTE.edge,
    dashed: !relationship.identifying,
    startArrow,
    endArrow,
    drawioStyle:
      'edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;jettySize=auto;orthogonalLoop=1;' +
      `exitX=${round(exit.x)};exitY=${round(exit.y)};exitDx=0;exitDy=0;` +
      `entryX=${round(entry.x)};entryY=${round(entry.y)};entryDx=0;entryDy=0;` +
      drawioEndArrow(endArrow) +
      drawioStartArrow(startArrow),
  };
}

/** Anchor relationship edges on the entity header, not its midpoint. */
function headerCenter(item: Placed): number {
  return Math.min(ERD_STYLE.headerHeight + ERD_STYLE.rowHeight / 2, item.h / 2);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
