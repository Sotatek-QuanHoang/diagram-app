/**
 * Scene -> draw.io (.drawio / mxGraphModel XML).
 *
 * This runs in the browser, not the backend. The .drawio file is far larger than
 * the geometry it is built from, and sending it through the tool result pushed
 * the payload past what the renderer surface accepts — so the scene travels and
 * the file is assembled here, at the moment the reader asks for it.
 *
 * The output is uncompressed XML, which is what draw.io writes by default and
 * what `File > Open` accepts directly. Cells are emitted parents-first so
 * containers exist before their children, and every user-supplied id is remapped
 * to a safe unique cell id — `0` and `1` are reserved by mxGraph for the root.
 */

import type { ArrowHead, Scene, SceneEdge, SceneShape } from '../backend/diagram/types.js';

const ROOT_ID = '1';
const TITLE_FONT_SIZE = 18;
const TITLE_HEIGHT = 32;
const MARGIN = 40;

export interface DrawioOptions {
  /** Page name shown on the draw.io tab. */
  pageName?: string;
  /** Emitted so a reader can tell which app produced the file. */
  agent?: string;
}

export function sceneToDrawio(scene: Scene, options: DrawioOptions = {}): string {
  const ids = new CellIds();
  const lines: string[] = [];

  lines.push('        <mxCell id="0" />');
  lines.push(`        <mxCell id="${ROOT_ID}" parent="0" />`);

  if (scene.title !== '') {
    lines.push(titleCell(scene));
  }

  for (const shape of orderShapes(scene.shapes)) {
    lines.push(shapeCell(shape, scene, ids));
  }
  for (const edge of scene.edges) {
    lines.push(edgeCell(edge, scene, ids));
  }

  const pageName = escapeXml(options.pageName ?? (scene.title || 'Page-1'));
  const agent = escapeXml(options.agent ?? 'my-app');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<mxfile host="app.diagrams.net" agent="${agent}" type="device">`,
    `  <diagram id="${diagramId(scene)}" name="${pageName}">`,
    '    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" ' +
      'connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" ' +
      'math="0" shadow="0">',
    '      <root>',
    ...lines,
    '      </root>',
    '    </mxGraphModel>',
    '  </diagram>',
    '</mxfile>',
    '',
  ].join('\n');
}

/* --------------------------------------------------------------- cell ids */

/** Stable, collision-free, mxGraph-legal ids derived from the scene ids. */
class CellIds {
  private readonly assigned = new Map<string, string>();
  private readonly taken = new Set<string>(['0', ROOT_ID]);

  get(sceneId: string): string {
    const existing = this.assigned.get(sceneId);
    if (existing) return existing;
    const base = `c-${sceneId.replace(/[^A-Za-z0-9_-]/g, '_')}`.slice(0, 96);
    let candidate = base;
    let suffix = 2;
    while (this.taken.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    this.taken.add(candidate);
    this.assigned.set(sceneId, candidate);
    return candidate;
  }
}

function diagramId(scene: Scene): string {
  // Deterministic so republishing the same spec produces an identical file.
  let hash = 2166136261;
  for (const char of `${scene.kind}:${scene.title}:${scene.shapes.length}:${scene.edges.length}`) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 16777619);
  }
  return `d${(hash >>> 0).toString(36)}`;
}

/* ----------------------------------------------------------------- cells */

/** Containers must precede their children in the XML. */
function orderShapes(shapes: SceneShape[]): SceneShape[] {
  const byId = new Map(shapes.map((shape) => [shape.id, shape]));
  const emitted = new Set<string>();
  const ordered: SceneShape[] = [];

  const emit = (shape: SceneShape) => {
    if (emitted.has(shape.id)) return;
    emitted.add(shape.id);
    const parent = shape.parent ? byId.get(shape.parent) : undefined;
    if (parent) emit(parent);
    ordered.push(shape);
  };
  shapes.forEach(emit);
  return ordered;
}

function titleCell(scene: Scene): string {
  const style =
    `text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;` +
    `whiteSpace=wrap;fontSize=${TITLE_FONT_SIZE};fontStyle=1;`;
  return (
    `        <mxCell id="c-title" value="${htmlValue(scene.title)}" style="${style}" ` +
    `vertex="1" parent="${ROOT_ID}">\n` +
    `          <mxGeometry x="${MARGIN}" y="${MARGIN - 4}" ` +
    `width="${Math.max(200, scene.width - MARGIN * 2)}" height="${TITLE_HEIGHT}" as="geometry" />\n` +
    '        </mxCell>'
  );
}

function shapeCell(shape: SceneShape, scene: Scene, ids: CellIds): string {
  const id = ids.get(shape.id);
  const parentShape = shape.parent
    ? scene.shapes.find((candidate) => candidate.id === shape.parent)
    : undefined;
  const parentId = parentShape ? ids.get(parentShape.id) : ROOT_ID;
  // Child geometry in mxGraph is relative to its container's origin.
  const x = Math.round(shape.x - (parentShape?.x ?? 0));
  const y = Math.round(shape.y - (parentShape?.y ?? 0));

  const style = shapeStyle(shape, scene);
  // An AWS icon cell is only the square tile; draw.io renders its label beneath,
  // in the space the layout already reserved.
  const tile = shape.geom === 'awsIcon' ? (shape.headerHeight ?? shape.w) : undefined;
  const box = tile
    ? { x: Math.round(x + (shape.w - tile) / 2), y: Math.round(y), w: tile, h: tile }
    : { x, y, w: Math.round(shape.w), h: Math.round(shape.h) };
  const geometry =
    `          <mxGeometry x="${box.x}" y="${box.y}" width="${box.w}" ` +
    `height="${box.h}" as="geometry" />`;

  if (shape.tooltip) {
    return (
      `        <object label="${htmlValue(shape.label)}" tooltip="${escapeXml(shape.tooltip)}" id="${id}">\n` +
      `          <mxCell style="${style}" vertex="1" parent="${parentId}">\n` +
      `  ${geometry}\n` +
      '          </mxCell>\n' +
      '        </object>'
    );
  }
  return (
    `        <mxCell id="${id}" value="${htmlValue(shape.label)}" style="${style}" ` +
    `vertex="1" parent="${parentId}">\n${geometry}\n        </mxCell>`
  );
}

function shapeStyle(shape: SceneShape, scene: Scene): string {
  const parts = [resolveStyle(shape, scene)];
  parts.push(`fillColor=${shape.fill};`);
  parts.push(`strokeColor=${shape.stroke};`);
  parts.push(`fontColor=${shape.fontColor};`);
  parts.push(`fontSize=${shape.fontSize};`);
  if (shape.bold) parts.push('fontStyle=1;');
  if (shape.dashed) parts.push('dashed=1;');
  if (shape.align) parts.push(`align=${shape.align};`);
  if (shape.verticalAlign) parts.push(`verticalAlign=${shape.verticalAlign};`);
  return escapeXml(parts.join(''));
}

function edgeCell(edge: SceneEdge, scene: Scene, ids: CellIds): string {
  const id = ids.get(edge.id);
  const attributes = [
    `id="${id}"`,
    `value="${htmlValue(edge.label ?? '')}"`,
    `style="${edgeStyle(edge, scene)}"`,
    'edge="1"',
    `parent="${ROOT_ID}"`,
  ];
  if (edge.source) attributes.push(`source="${ids.get(edge.source)}"`);
  if (edge.target) attributes.push(`target="${ids.get(edge.target)}"`);

  const body: string[] = ['          <mxGeometry relative="1" as="geometry">'];
  // Free-floating edges (sequence messages) need their endpoints written out.
  if (!edge.source || !edge.target) {
    const first = edge.route[0];
    const last = edge.route[edge.route.length - 1];
    if (first) {
      body.push(`            <mxPoint x="${first.x}" y="${first.y}" as="sourcePoint" />`);
    }
    if (last) {
      body.push(`            <mxPoint x="${last.x}" y="${last.y}" as="targetPoint" />`);
    }
  }
  const waypoints = edge.route.slice(1, -1);
  if (waypoints.length > 0) {
    body.push('            <Array as="points">');
    for (const point of waypoints) {
      body.push(`              <mxPoint x="${point.x}" y="${point.y}" />`);
    }
    body.push('            </Array>');
  }
  body.push('          </mxGeometry>');

  return `        <mxCell ${attributes.join(' ')}>\n${body.join('\n')}\n        </mxCell>`;
}

function edgeStyle(edge: SceneEdge, scene: Scene): string {
  const parts = [resolveStyle(edge, scene)];
  parts.push(`strokeColor=${edge.stroke};`);
  parts.push('fontSize=11;');
  if (edge.dashed) parts.push('dashed=1;');
  if (edge.thick) parts.push('strokeWidth=3;');
  return escapeXml(parts.join(''));
}

/** Styles travel as a de-duplicated table; older payloads inline them. */
function resolveStyle(item: { drawioStyle?: string; styleId?: number }, scene: Scene): string {
  if (typeof item.drawioStyle === 'string') return item.drawioStyle;
  if (typeof item.styleId === 'number') return scene.styles?.[item.styleId] ?? '';
  return '';
}

/* ----------------------------------------------------------- escaping */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Cell labels are HTML (every style here sets `html=1`), so newlines have to
 * survive as `<br>` rather than raw whitespace.
 */
function htmlValue(value: string): string {
  return escapeXml(value).replace(/\r?\n/g, '&lt;br&gt;');
}

export const __testing = { escapeXml, htmlValue };

/** Arrow heads the scene may request; exported so the UI can stay in sync. */
export const SUPPORTED_ARROWS: ArrowHead[] = [
  'none',
  'arrow',
  'open',
  'cross',
  'circle',
  'ERone',
  'ERmandOne',
  'ERzeroToOne',
  'ERoneToMany',
  'ERzeroToMany',
];
