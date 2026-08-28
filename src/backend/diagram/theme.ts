/**
 * The single place shape appearance is decided.
 *
 * Colors are draw.io's own default palette, so a generated file looks native
 * when opened and recolors correctly with the app's built-in styles. Each entry
 * carries both the mxGraph style string and the primitive the SVG preview draws,
 * which is what keeps the preview honest about the downloaded file.
 */

import type { ArrowHead, Cardinality, EdgeArrow, EdgeLine, FlowShape, SceneGeom } from './types.js';

export const PALETTE = {
  canvas: '#ffffff',
  ink: '#1f2933',
  muted: '#5a6472',
  groupStroke: '#9aa5b1',
  edge: '#3d4753',
} as const;

export interface ShapeStyle {
  geom: SceneGeom;
  fill: string;
  stroke: string;
  fontColor: string;
  drawioStyle: string;
  minWidth: number;
  minHeight: number;
  /** Horizontal/vertical label padding added to the measured text box. */
  padX: number;
  padY: number;
}

const FLOW_SHAPE_STYLES: Record<FlowShape, ShapeStyle> = {
  process: {
    geom: 'rect',
    fill: '#dae8fc',
    stroke: '#6c8ebf',
    fontColor: PALETTE.ink,
    drawioStyle: 'rounded=0;whiteSpace=wrap;html=1;',
    minWidth: 120,
    minHeight: 50,
    padX: 28,
    padY: 24,
  },
  start: {
    geom: 'stadium',
    fill: '#d5e8d4',
    stroke: '#82b366',
    fontColor: PALETTE.ink,
    drawioStyle: 'rounded=1;arcSize=40;whiteSpace=wrap;html=1;',
    minWidth: 110,
    minHeight: 44,
    padX: 32,
    padY: 22,
  },
  end: {
    geom: 'stadium',
    fill: '#f8cecc',
    stroke: '#b85450',
    fontColor: PALETTE.ink,
    drawioStyle: 'rounded=1;arcSize=40;whiteSpace=wrap;html=1;',
    minWidth: 110,
    minHeight: 44,
    padX: 32,
    padY: 22,
  },
  decision: {
    geom: 'rhombus',
    fill: '#fff2cc',
    stroke: '#d6b656',
    fontColor: PALETTE.ink,
    drawioStyle: 'rhombus;whiteSpace=wrap;html=1;',
    minWidth: 140,
    minHeight: 80,
    // A rhombus only fits text in its middle band, so it needs generous padding.
    padX: 76,
    padY: 52,
  },
  io: {
    geom: 'parallelogram',
    fill: '#e1d5e7',
    stroke: '#9673a6',
    fontColor: PALETTE.ink,
    drawioStyle:
      'shape=parallelogram;perimeter=parallelogramPerimeter;fixedSize=1;whiteSpace=wrap;html=1;',
    minWidth: 130,
    minHeight: 50,
    padX: 46,
    padY: 24,
  },
  document: {
    geom: 'document',
    fill: '#f5f5f5',
    stroke: '#666666',
    fontColor: PALETTE.ink,
    drawioStyle: 'shape=document;boundedLbl=1;whiteSpace=wrap;html=1;',
    minWidth: 120,
    minHeight: 60,
    padX: 28,
    padY: 34,
  },
  database: {
    geom: 'cylinder',
    fill: '#ffe6cc',
    stroke: '#d79b00',
    fontColor: PALETTE.ink,
    drawioStyle:
      'shape=cylinder3;size=14;boundedLbl=1;backgroundOutline=1;whiteSpace=wrap;html=1;',
    minWidth: 120,
    minHeight: 70,
    padX: 28,
    padY: 44,
  },
  subprocess: {
    geom: 'rect',
    fill: '#dae8fc',
    stroke: '#6c8ebf',
    fontColor: PALETTE.ink,
    drawioStyle: 'shape=process;size=0.08;backgroundOutline=1;whiteSpace=wrap;html=1;',
    minWidth: 130,
    minHeight: 50,
    padX: 44,
    padY: 24,
  },
  manual: {
    geom: 'hexagon',
    fill: '#fff2cc',
    stroke: '#d6b656',
    fontColor: PALETTE.ink,
    drawioStyle:
      'shape=hexagon;perimeter=hexagonPerimeter2;fixedSize=1;whiteSpace=wrap;html=1;',
    minWidth: 130,
    minHeight: 55,
    padX: 52,
    padY: 26,
  },
  note: {
    geom: 'note',
    fill: '#fff9b2',
    stroke: '#d6b656',
    fontColor: PALETTE.ink,
    drawioStyle: 'shape=note;size=14;backgroundOutline=1;darkOpacity=0.05;whiteSpace=wrap;html=1;',
    minWidth: 120,
    minHeight: 55,
    padX: 30,
    padY: 26,
  },
};

export function flowShapeStyle(shape: FlowShape): ShapeStyle {
  return FLOW_SHAPE_STYLES[shape];
}

export const GROUP_STYLE = {
  fill: 'none',
  stroke: PALETTE.groupStroke,
  fontColor: PALETTE.muted,
  drawioStyle:
    'rounded=1;arcSize=6;whiteSpace=wrap;html=1;dashed=1;dashPattern=6 4;verticalAlign=top;' +
    'align=left;spacingLeft=12;spacingTop=2;fontStyle=1;container=1;collapsible=0;' +
    'connectable=0;movable=1;recursiveResize=0;',
  headerHeight: 28,
  padding: 26,
} as const;

/* ------------------------------------------------------------- sequence */

export const SEQUENCE_STYLE = {
  headHeight: 42,
  lifelineFill: '#ffffff',
  lifelineStroke: '#4d5866',
  activationFill: '#ffffff',
  activationStroke: '#333333',
  activationWidth: 10,
  noteFill: '#fff9b2',
  noteStroke: '#d6b656',
  lifelineDrawioStyle:
    'shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;container=1;' +
    'collapsible=0;recursiveResize=0;outlineConnect=0;',
  activationDrawioStyle:
    'html=1;points=[[0,0,0,0,0],[0,1,0,0,0],[1,0,0,0,0],[1,1,0,0,0]];perimeter=orthogonalPerimeter;' +
    'outlineConnect=0;targetShapes=umlLifeline;whiteSpace=wrap;',
  noteDrawioStyle: 'shape=note;size=12;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacingLeft=6;',
} as const;

/* ------------------------------------------------------------------ erd */

export const ERD_STYLE = {
  headerHeight: 32,
  rowHeight: 26,
  headerFill: '#dae8fc',
  headerStroke: '#6c8ebf',
  bodyFill: '#ffffff',
  entityDrawioStyle:
    'swimlane;childLayout=stackLayout;horizontal=1;startSize=32;horizontalStack=0;' +
    'resizeParent=1;resizeParentMax=0;html=1;whiteSpace=wrap;collapsible=0;marginBottom=0;',
  rowDrawioStyle:
    'text;spacingLeft=8;spacingRight=8;overflow=hidden;points=[[0,0.5],[1,0.5]];' +
    'portConstraint=eastwest;rotatable=0;whiteSpace=wrap;html=1;',
} as const;

const CARDINALITY_ARROWS: Record<Cardinality, ArrowHead> = {
  one: 'ERmandOne',
  'zero-or-one': 'ERzeroToOne',
  'one-or-many': 'ERoneToMany',
  'zero-or-many': 'ERzeroToMany',
  many: 'ERoneToMany',
};

export function cardinalityArrow(cardinality: Cardinality): ArrowHead {
  return CARDINALITY_ARROWS[cardinality];
}

/* ----------------------------------------------------------------- edges */

/** mxGraph arrow token for each scene arrow head. */
const DRAWIO_ARROWS: Record<ArrowHead, string> = {
  none: 'endArrow=none;',
  arrow: 'endArrow=classic;endFill=1;',
  open: 'endArrow=open;endFill=0;',
  cross: 'endArrow=cross;endFill=0;',
  circle: 'endArrow=oval;endFill=0;',
  ERone: 'endArrow=ERone;',
  ERmandOne: 'endArrow=ERmandOne;',
  ERzeroToOne: 'endArrow=ERzeroToOne;',
  ERoneToMany: 'endArrow=ERoneToMany;',
  ERzeroToMany: 'endArrow=ERzeroToMany;',
};

export function drawioEndArrow(arrow: ArrowHead): string {
  return DRAWIO_ARROWS[arrow];
}

export function drawioStartArrow(arrow: ArrowHead): string {
  if (arrow === 'none') return 'startArrow=none;startFill=0;';
  return DRAWIO_ARROWS[arrow].replace(/^endArrow=/, 'startArrow=').replace(/endFill=/, 'startFill=');
}

export function flowEdgeArrow(arrow: EdgeArrow): ArrowHead {
  return arrow;
}

export function edgeLineDecoration(line: EdgeLine): { dashed: boolean; thick: boolean } {
  return { dashed: line === 'dashed', thick: line === 'thick' };
}
