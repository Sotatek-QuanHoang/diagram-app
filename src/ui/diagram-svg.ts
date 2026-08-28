/**
 * Scene -> SVG.
 *
 * The backend already resolved every coordinate, so this is a pure drawing pass
 * over the same geometry the .drawio file was written from — the preview and the
 * downloaded file cannot disagree about where anything sits. Text is never
 * re-measured here; the layout ships the exact lines it wrapped to.
 *
 * Every colour is emitted as an inline `style` attribute rather than a
 * presentation attribute (`fill="…"`). A host stylesheet rule such as
 * `svg * { fill: currentColor }` — common where SVG is assumed to be an icon —
 * outranks presentation attributes and would flatten the whole diagram to a
 * single theme colour: uniform outlines, no fills, barely visible against the
 * page. Inline styles outrank those rules, so the drawing keeps its own palette
 * in light and dark alike.
 *
 * The page is drawn on white in both themes: it previews a document, and
 * draw.io's canvas is white.
 */

import type { ArrowHead, Scene, SceneEdge, ScenePoint, SceneShape } from '../backend/diagram/types.js';
import { CLOUD_GLYPHS } from './cloud-glyphs.js';

export const PAPER = '#ffffff';
/** One ink colour for every edge, so markers can bake it in rather than relying
 * on `context-stroke`, which is not universally supported. */
const EDGE_INK = '#3d4753';
const TITLE_FONT_SIZE = 18;
const TITLE_COLOR = '#15181d';
const LINE_HEIGHT = 1.35;
const FONT_STACK = 'Helvetica, Arial, sans-serif';
const ROW_RULE = '#d8dce1';

export interface SvgOptions {
  /** Rendered width; height follows from the scene's aspect ratio. */
  width?: number;
  /** Accessible name for the figure. */
  ariaLabel?: string;
}

export function sceneToSvg(scene: Scene, options: SvgOptions = {}): string {
  const body: string[] = [];

  if (scene.title !== '') {
    body.push(
      text([scene.title], 40, 52 + TITLE_FONT_SIZE * 0.35, TITLE_FONT_SIZE, TITLE_COLOR, 'start', true),
    );
  }
  for (const shape of scene.shapes) body.push(drawShape(shape));
  for (const edge of scene.edges) body.push(drawEdge(edge));

  const arrows = new Set<string>();
  for (const edge of scene.edges) {
    if (edge.endArrow !== 'none') arrows.add(`${edge.endArrow}|end`);
    if (edge.startArrow !== 'none') arrows.add(`${edge.startArrow}|start`);
  }

  const width = options.width ?? scene.width;
  const height = Math.round((width / scene.width) * scene.height);
  const label = escape(options.ariaLabel ?? scene.title ?? 'Diagram preview');

  // `color-scheme: light` and an explicit background stop a host dark-mode pass
  // from inverting the page out from under the drawing.
  const rootStyle =
    `background:${PAPER};color-scheme:light;display:block;font-family:${FONT_STACK};filter:none`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${scene.width} ${scene.height}"`,
    ` width="${width}" height="${height}" role="img" aria-label="${label}"`,
    ` style="${rootStyle}">`,
    `<defs>${[...arrows].map(marker).join('')}</defs>`,
    `<rect x="0" y="0" width="${scene.width}" height="${scene.height}" style="fill:${PAPER}" />`,
    body.join(''),
    '</svg>',
  ].join('');
}

/* ------------------------------------------------------------ style attrs */

/** Filled outline: the workhorse for every closed shape. */
function fillStroke(fill: string, stroke: string, dashed = false, width = 1): string {
  return (
    ` style="fill:${fill};stroke:${stroke};stroke-width:${width}` +
    `${dashed ? ';stroke-dasharray:6 4' : ''}"`
  );
}

/** Unfilled path: connectors, lifelines, figure strokes. */
function strokeOnly(stroke: string, width = 1, dash?: string): string {
  return (
    ` style="fill:none;stroke:${stroke};stroke-width:${width}` +
    `${dash ? `;stroke-dasharray:${dash}` : ''}"`
  );
}

function textStyle(
  fontSize: number,
  color: string,
  anchor: 'start' | 'middle',
  bold: boolean,
): string {
  return (
    ` style="font-size:${fontSize}px;fill:${color};stroke:none;text-anchor:${anchor};` +
    `font-family:${FONT_STACK};font-weight:${bold ? 600 : 400}"`
  );
}

/* ---------------------------------------------------------------- shapes */

function drawShape(shape: SceneShape): string {
  const { x, y, w, h } = shape;
  const fill = shape.fill === 'none' ? 'none' : shape.fill;
  const stroke = shape.stroke === 'none' ? 'none' : shape.stroke;
  const box = fillStroke(fill, stroke, shape.dashed);

  switch (shape.geom) {
    case 'rect':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}"${box} />${centeredLabel(shape)}`;
    case 'rounded':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8"${box} />${centeredLabel(shape)}`;
    case 'stadium':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}"${box} />${centeredLabel(shape)}`;
    case 'ellipse':
      return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}"${box} />${centeredLabel(shape)}`;
    case 'rhombus':
      return `<polygon points="${points([
        [x + w / 2, y],
        [x + w, y + h / 2],
        [x + w / 2, y + h],
        [x, y + h / 2],
      ])}"${box} />${centeredLabel(shape)}`;
    case 'hexagon': {
      const inset = Math.min(w * 0.2, 24);
      return `<polygon points="${points([
        [x + inset, y],
        [x + w - inset, y],
        [x + w, y + h / 2],
        [x + w - inset, y + h],
        [x + inset, y + h],
        [x, y + h / 2],
      ])}"${box} />${centeredLabel(shape)}`;
    }
    case 'parallelogram': {
      const skew = Math.min(w * 0.16, 26);
      return `<polygon points="${points([
        [x + skew, y],
        [x + w, y],
        [x + w - skew, y + h],
        [x, y + h],
      ])}"${box} />${centeredLabel(shape)}`;
    }
    case 'cylinder': {
      const lip = Math.min(14, h / 4);
      const path =
        `M ${x} ${y + lip} A ${w / 2} ${lip} 0 0 1 ${x + w} ${y + lip} ` +
        `L ${x + w} ${y + h - lip} A ${w / 2} ${lip} 0 0 1 ${x} ${y + h - lip} Z`;
      const cap = `M ${x} ${y + lip} A ${w / 2} ${lip} 0 0 0 ${x + w} ${y + lip}`;
      return (
        `<path d="${path}"${box} />` +
        `<path d="${cap}"${strokeOnly(stroke)} />` +
        centeredLabel(shape, lip)
      );
    }
    case 'document': {
      const wave = Math.min(16, h / 4);
      const path =
        `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h - wave} ` +
        `Q ${x + (w * 3) / 4} ${y + h} ${x + w / 2} ${y + h - wave / 2} ` +
        `Q ${x + w / 4} ${y + h - wave} ${x} ${y + h - wave / 2} Z`;
      return `<path d="${path}"${box} />${centeredLabel(shape, 0, -wave / 2)}`;
    }
    case 'note': {
      const fold = 14;
      const path =
        `M ${x} ${y} L ${x + w - fold} ${y} L ${x + w} ${y + fold} ` +
        `L ${x + w} ${y + h} L ${x} ${y + h} Z`;
      const corner = `M ${x + w - fold} ${y} L ${x + w - fold} ${y + fold} L ${x + w} ${y + fold}`;
      return (
        `<path d="${path}"${box} />` +
        `<path d="${corner}"${strokeOnly(stroke)} />` +
        blockLabel(shape, 10, 8)
      );
    }
    case 'group': {
      const header = shape.headerHeight ?? 28;
      return (
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6"${box} />` +
        text(
          shape.labelLines,
          x + 12,
          y + header / 2 + shape.fontSize * 0.35,
          shape.fontSize,
          shape.fontColor,
          'start',
          true,
        )
      );
    }
    case 'lifeline':
    case 'actorLifeline': {
      const header = shape.headerHeight ?? 42;
      const centerX = x + w / 2;
      const line =
        `<line x1="${centerX}" y1="${y + header}" x2="${centerX}" y2="${y + h}"` +
        `${strokeOnly(stroke, 1, '6 5')} />`;
      if (shape.geom === 'actorLifeline') return actorHead(shape, centerX) + line;
      return (
        `<rect x="${x}" y="${y}" width="${w}" height="${header}"${fillStroke(fill, stroke)} />` +
        text(
          shape.labelLines,
          centerX,
          y + header / 2 - ((shape.labelLines.length - 1) * shape.fontSize * LINE_HEIGHT) / 2 + shape.fontSize * 0.35,
          shape.fontSize,
          shape.fontColor,
          'middle',
          shape.bold,
        ) +
        line
      );
    }
    case 'cloudIcon': {
      // The same official glyph the .drawio file references, extracted from
      // draw.io's stencil sets so the preview shows the real icon rather than a
      // stand-in. A service with no glyph falls back to its name.
      const tile = shape.headerHeight ?? Math.min(w, h);
      const tx = x + (w - tile) / 2;
      const glyph = shape.shapeId ? CLOUD_GLYPHS[shape.shapeId] : undefined;
      const tint = shape.tint ?? '#ffffff';
      // AWS wraps its glyph in a coloured tile; the others stand alone.
      const tiled = shape.iconTile === true;
      const label = text(
        shape.labelLines,
        x + w / 2,
        y + tile + 6 + shape.fontSize,
        shape.fontSize,
        shape.fontColor,
        'middle',
        shape.bold,
      );
      const plate = tiled
        ? `<rect x="${round(tx)}" y="${y}" width="${tile}" height="${tile}" rx="4"` +
          `${fillStroke(fill, 'none')} />`
        : '';

      if (!glyph) {
        const nameSize = 10;
        const name = wrapToWidth(shape.serviceName ?? '', tile - 12, nameSize);
        const nameTop =
          y + tile / 2 - ((name.length - 1) * nameSize * LINE_HEIGHT) / 2 + nameSize * 0.35;
        return (
          plate +
          text(name, tx + tile / 2, nameTop, nameSize, tiled ? '#ffffff' : tint, 'middle', true) +
          label
        );
      }

      // A tiled glyph is inset the way the provider insets it; a standalone one
      // uses the whole square.
      const box = tiled ? tile - tile * 0.36 : tile;
      const scale = Math.min(box / glyph.w, box / glyph.h);
      const gx = tx + (tile - glyph.w * scale) / 2;
      const gy = y + (tile - glyph.h * scale) / 2;
      const paths = glyph.paths
        .map(
          (part) =>
            `<path d="${part.d}" style="fill:${part.fill ?? (tiled ? tint : fill)};stroke:none" />`,
        )
        .join('');
      return (
        plate +
        `<g transform="translate(${round(gx)} ${round(gy)}) scale(${round(scale)})">${paths}</g>` +
        label
      );
    }
    case 'activation':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}"${fillStroke(fill, stroke)} />`;
    case 'table': {
      const header = shape.headerHeight ?? 32;
      return (
        `<rect x="${x}" y="${y}" width="${w}" height="${h}"${fillStroke(PAPER, stroke)} />` +
        `<path d="M ${x} ${y + header} L ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + header} Z"` +
        `${fillStroke(fill, stroke)} />` +
        text(
          shape.labelLines,
          x + w / 2,
          y + header / 2 + shape.fontSize * 0.35,
          shape.fontSize,
          shape.fontColor,
          'middle',
          true,
        )
      );
    }
    case 'tableRow':
      return (
        `<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}"${strokeOnly(ROW_RULE)} />` +
        text(
          shape.labelLines,
          x + 10,
          y + h / 2 + shape.fontSize * 0.35,
          shape.fontSize,
          shape.fontColor,
          'start',
          shape.bold,
        )
      );
    default:
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}"${box} />${centeredLabel(shape)}`;
  }
}

/** UML stick figure plus the participant name beneath it. */
function actorHead(shape: SceneShape, centerX: number): string {
  const stroke = shape.stroke;
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${strokeOnly(stroke, 1.4)} />`;
  // Kept inside the top ~34px of the header band so the participant name below
  // it never collides with the legs.
  const top = shape.y + 2;
  const radius = 6;
  const bodyTop = top + radius * 2;
  const bodyBottom = bodyTop + 11;
  return (
    `<circle cx="${centerX}" cy="${top + radius}" r="${radius}"${fillStroke(shape.fill, stroke, false, 1.4)} />` +
    line(centerX, bodyTop, centerX, bodyBottom) +
    line(centerX - 8, bodyTop + 4, centerX + 8, bodyTop + 4) +
    line(centerX, bodyBottom, centerX - 6, bodyBottom + 9) +
    line(centerX, bodyBottom, centerX + 6, bodyBottom + 9) +
    text(
      shape.labelLines,
      centerX,
      shape.y + (shape.headerHeight ?? 42) - 2,
      shape.fontSize,
      shape.fontColor,
      'middle',
      shape.bold,
    )
  );
}

function centeredLabel(shape: SceneShape, padTop = 0, offsetY = 0): string {
  const lines = shape.labelLines.length > 0 ? shape.labelLines : [shape.label];
  if (lines.join('') === '') return '';
  const lineHeight = shape.fontSize * LINE_HEIGHT;
  const centerY = shape.y + padTop + (shape.h - padTop) / 2 + offsetY;
  const first = centerY - ((lines.length - 1) * lineHeight) / 2 + shape.fontSize * 0.35;
  return text(lines, shape.x + shape.w / 2, first, shape.fontSize, shape.fontColor, 'middle', shape.bold);
}

function blockLabel(shape: SceneShape, padX: number, padY: number): string {
  const lines = shape.labelLines.length > 0 ? shape.labelLines : [shape.label];
  if (lines.join('') === '') return '';
  return text(
    lines,
    shape.x + padX,
    shape.y + padY + shape.fontSize,
    shape.fontSize,
    shape.fontColor,
    'start',
    shape.bold,
  );
}

/* ----------------------------------------------------------------- edges */

function drawEdge(edge: SceneEdge): string {
  if (edge.route.length < 2) return '';
  const d = edge.route
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const markers =
    (edge.endArrow !== 'none' ? ` marker-end="url(#${markerId(edge.endArrow, 'end')})"` : '') +
    (edge.startArrow !== 'none' ? ` marker-start="url(#${markerId(edge.startArrow, 'start')})"` : '');
  const style = strokeOnly(edge.stroke, edge.thick ? 3 : 1.4, edge.dashed ? '6 4' : undefined);

  const label =
    edge.label && edge.labelAt
      ? edgeLabel(edge.label, edge.labelAt, edge.stroke, edge.labelAnchor ?? 'middle')
      : '';
  return `<path d="${d}"${style}${markers} />${label}`;
}

function edgeLabel(
  label: string,
  at: ScenePoint,
  color: string,
  anchor: 'middle' | 'start',
): string {
  const lines = label.split('\n');
  const fontSize = 11;
  const width = Math.max(...lines.map((line) => line.length)) * fontSize * 0.55 + 10;
  const height = lines.length * fontSize * LINE_HEIGHT + 4;
  // The plate keeps the label readable where it crosses its own edge.
  const plateX = anchor === 'start' ? at.x - 4 : at.x - width / 2;
  return (
    `<rect x="${round(plateX)}" y="${round(at.y - height / 2)}" width="${round(width)}" ` +
    `height="${round(height)}" style="fill:${PAPER};stroke:none;opacity:0.92" />` +
    text(
      lines,
      at.x,
      at.y - ((lines.length - 1) * fontSize * LINE_HEIGHT) / 2 + fontSize * 0.35,
      fontSize,
      color,
      anchor,
      false,
    )
  );
}

/* --------------------------------------------------------------- markers */

function markerId(arrow: ArrowHead, side: 'start' | 'end'): string {
  return `dg-${arrow}-${side}`;
}

/**
 * Marker geometry is authored pointing right, with the connected shape at the
 * marker's right edge. Start markers reuse the same drawing mirrored, so a
 * crow's foot opens toward its entity at both ends of an edge.
 */
function marker(key: string): string {
  const [arrow, side] = key.split('|') as [ArrowHead, 'start' | 'end'];
  const box = arrow.startsWith('ER') ? 30 : 24;
  const drawing = markerBody(arrow, box);
  const inner =
    side === 'start' ? `<g transform="translate(${box},0) scale(-1,1)">${drawing}</g>` : drawing;
  const refX = arrow.startsWith('ER') ? box : refPoint(arrow);
  return (
    `<marker id="${markerId(arrow, side)}" viewBox="0 0 ${box} 24" markerUnits="userSpaceOnUse" ` +
    `markerWidth="${box}" markerHeight="24" refX="${side === 'start' ? box - refX : refX}" refY="12" ` +
    `orient="auto">${inner}</marker>`
  );
}

function refPoint(arrow: ArrowHead): number {
  if (arrow === 'cross' || arrow === 'circle') return 20;
  return 16;
}

function markerBody(arrow: ArrowHead, box: number): string {
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${strokeOnly(EDGE_INK, 1.4)} />`;

  switch (arrow) {
    case 'arrow':
      return (
        `<path d="M 2 5 L 16 12 L 2 19 z" ` +
        `style="fill:${EDGE_INK};stroke:${EDGE_INK};stroke-width:1" />`
      );
    case 'open':
      return `<path d="M 3 5 L 16 12 L 3 19"${strokeOnly(EDGE_INK, 1.4)} />`;
    case 'cross':
      return line(12, 6, 20, 18) + line(20, 6, 12, 18);
    case 'circle':
      return `<circle cx="14" cy="12" r="5"${fillStroke(PAPER, EDGE_INK, false, 1.4)} />`;
    case 'ERone':
      return line(18, 4, 18, 20);
    case 'ERmandOne':
      return line(14, 4, 14, 20) + line(21, 4, 21, 20);
    case 'ERzeroToOne':
      return (
        `<circle cx="10" cy="12" r="4.5"${fillStroke(PAPER, EDGE_INK, false, 1.4)} />` +
        line(21, 4, 21, 20)
      );
    case 'ERoneToMany':
      return (
        line(12, 4, 12, 20) + line(18, 12, box, 4) + line(18, 12, box, 12) + line(18, 12, box, 20)
      );
    case 'ERzeroToMany':
      return (
        `<circle cx="8" cy="12" r="4.5"${fillStroke(PAPER, EDGE_INK, false, 1.4)} />` +
        line(18, 12, box, 4) +
        line(18, 12, box, 12) +
        line(18, 12, box, 20)
      );
    default:
      return '';
  }
}

/** Crude wrap for the short service name inside an icon tile. */
function wrapToWidth(value: string, maxWidth: number, fontSize: number): string[] {
  if (value === '') return [];
  const perChar = fontSize * 0.58;
  const limit = Math.max(4, Math.floor(maxWidth / perChar));
  const lines: string[] = [];
  let current = '';
  for (const word of value.split(' ')) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (candidate.length <= limit || current === '') current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current !== '') lines.push(current);
  return lines.slice(0, 2);
}

/* ------------------------------------------------------------- primitives */

function text(
  lines: string[],
  x: number,
  firstBaseline: number,
  fontSize: number,
  color: string,
  anchor: 'start' | 'middle',
  bold = false,
): string {
  if (lines.length === 0) return '';
  const lineHeight = fontSize * LINE_HEIGHT;
  // The fill is repeated on every tspan, not just the parent <text>: a host rule
  // matching `svg *` sets the tspan's own fill, which then wins over anything
  // inherited from the <text> element and would leave the labels invisible.
  const spans = lines
    .map(
      (line, index) =>
        `<tspan x="${x}" y="${round(firstBaseline + index * lineHeight)}" ` +
        `style="fill:${color};stroke:none">${escape(line)}</tspan>`,
    )
    .join('');
  return `<text${textStyle(fontSize, color, anchor, bold)}>${spans}</text>`;
}

function points(pairs: Array<[number, number]>): string {
  return pairs.map(([x, y]) => `${round(x)},${round(y)}`).join(' ');
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
