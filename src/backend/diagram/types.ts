/**
 * Shared vocabulary for the diagram pipeline.
 *
 * Two input forms (structured `spec` and Mermaid text) normalize into the same
 * `DiagramSpec`. Layout turns a spec into a `Scene`: absolute geometry plus the
 * draw.io style string for every cell. The scene is then rendered twice — as
 * mxGraphModel XML for the .drawio file, and as SVG for the native UI preview —
 * so what the user sees is the file they download, not a second interpretation.
 */

export type DiagramKind = 'flowchart' | 'sequence' | 'erd';
export type FlowDirection = 'TB' | 'BT' | 'LR' | 'RL';

export type FlowShape =
  | 'process'
  | 'start'
  | 'end'
  | 'decision'
  | 'io'
  | 'document'
  | 'database'
  | 'subprocess'
  | 'manual'
  | 'note';

export type EdgeLine = 'solid' | 'dashed' | 'thick';
export type EdgeArrow = 'arrow' | 'open' | 'none' | 'cross' | 'circle';

export interface FlowNode {
  id: string;
  label: string;
  shape: FlowShape;
  group?: string;
  /**
   * Key into the AWS service catalog. When set the node is drawn as the official
   * AWS icon with its label beneath, and `shape` is ignored.
   */
  icon?: string;
}

export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  line: EdgeLine;
  arrow: EdgeArrow;
}

export interface FlowGroup {
  id: string;
  label: string;
}

export interface FlowchartSpec {
  kind: 'flowchart';
  title: string;
  direction: FlowDirection;
  nodes: FlowNode[];
  edges: FlowEdge[];
  groups: FlowGroup[];
}

export type ParticipantKind = 'participant' | 'actor';

export interface Participant {
  id: string;
  label: string;
  kind: ParticipantKind;
}

export type MessageLine = 'solid' | 'dashed';
export type MessageArrow = 'arrow' | 'open' | 'none' | 'cross' | 'async';
export type NotePlacement = 'left' | 'right' | 'over';

export interface Message {
  from: string;
  to: string;
  label: string;
  line: MessageLine;
  arrow: MessageArrow;
  /** Start an activation bar on the receiving lifeline. */
  activate?: boolean;
  /** End the innermost activation bar on the sending lifeline. */
  deactivate?: boolean;
}

export interface SequenceNote {
  /** Index into `messages` the note is anchored after; -1 pins it to the top. */
  afterIndex: number;
  placement: NotePlacement;
  participants: string[];
  text: string;
}

export interface SequenceSpec {
  kind: 'sequence';
  title: string;
  participants: Participant[];
  messages: Message[];
  notes: SequenceNote[];
}

export type FieldKey = 'PK' | 'FK' | 'UK' | 'none';

export interface EntityField {
  name: string;
  type: string;
  key: FieldKey;
  comment?: string;
}

export interface Entity {
  id: string;
  label: string;
  fields: EntityField[];
}

/** Crow's-foot ends, in Mermaid's vocabulary. */
export type Cardinality = 'one' | 'zero-or-one' | 'one-or-many' | 'zero-or-many' | 'many';

export interface Relationship {
  from: string;
  to: string;
  fromCardinality: Cardinality;
  toCardinality: Cardinality;
  label: string;
  identifying: boolean;
}

export interface ErdSpec {
  kind: 'erd';
  title: string;
  entities: Entity[];
  relationships: Relationship[];
}

export type DiagramSpec = FlowchartSpec | SequenceSpec | ErdSpec;

/* ------------------------------------------------------------------ scene */

export type SceneGeom =
  | 'rect'
  | 'rounded'
  | 'stadium'
  | 'ellipse'
  | 'rhombus'
  | 'hexagon'
  | 'parallelogram'
  | 'cylinder'
  | 'document'
  | 'note'
  | 'group'
  | 'lifeline'
  | 'actorLifeline'
  | 'activation'
  | 'table'
  | 'tableRow'
  | 'awsIcon';

export interface ScenePoint {
  x: number;
  y: number;
}

export interface SceneShape {
  id: string;
  geom: SceneGeom;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  /**
   * The label as the layout wrapped it when sizing this shape. The SVG preview
   * reuses these lines instead of re-measuring, so it breaks text exactly where
   * the geometry assumed it would.
   */
  labelLines: string[];
  /** Absolute-positioned parent cell; the XML writer rebases children onto it. */
  parent?: string;
  fill: string;
  stroke: string;
  fontColor: string;
  fontSize: number;
  bold?: boolean;
  dashed?: boolean;
  align?: 'center' | 'left';
  verticalAlign?: 'middle' | 'top';
  /**
   * Header band height for `table` / `lifeline`. For `awsIcon` it is the edge
   * length of the square icon tile, which sits centred at the top of the shape's
   * rectangle with the label in the remaining space below.
   */
  headerHeight?: number;
  /** Hover text; emitted as a draw.io `<object>` wrapper when present. */
  tooltip?: string;
  /** Short AWS service name, used when no glyph is available. */
  serviceName?: string;
  /** draw.io aws4 icon id, e.g. `route_53`; keys the preview's glyph table. */
  resIcon?: string;
  /** Index into `Scene.styles`. Replaces `drawioStyle` on the wire. */
  styleId?: number;
  drawioStyle?: string;
}

export type ArrowHead =
  | 'none'
  | 'arrow'
  | 'open'
  | 'cross'
  | 'circle'
  | 'ERone'
  | 'ERmandOne'
  | 'ERzeroToOne'
  | 'ERoneToMany'
  | 'ERzeroToMany';

export interface SceneEdge {
  id: string;
  source?: string;
  target?: string;
  label?: string;
  /** Absolute polyline including both endpoints. */
  route: ScenePoint[];
  labelAt?: ScenePoint;
  /** How the label sits on `labelAt`; defaults to centred. */
  labelAnchor?: 'middle' | 'start';
  stroke: string;
  dashed?: boolean;
  thick?: boolean;
  startArrow: ArrowHead;
  endArrow: ArrowHead;
  /** Index into `Scene.styles`. Replaces `drawioStyle` on the wire. */
  styleId?: number;
  drawioStyle?: string;
}

export interface Scene {
  kind: DiagramKind;
  title: string;
  width: number;
  height: number;
  shapes: SceneShape[];
  edges: SceneEdge[];
  /**
   * De-duplicated mxGraph style strings. Dozens of cells share a handful of
   * styles, so the table costs a fraction of repeating them per cell.
   */
  styles?: string[];
}

/** Input the caller can fix; surfaced as a 400, never as a broken diagram. */
export class DiagramInputError extends Error {
  readonly details: string[];
  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = 'DiagramInputError';
    this.details = details;
  }
}
