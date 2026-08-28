/**
 * The one entry point every caller uses: raw input in, .drawio file out.
 *
 * Both the tool route and the admin studio go through here, so the studio
 * preview and the agent's tool result can never drift apart.
 */

import { layoutErd } from './layout-erd.js';
import { layoutFlowchart } from './layout-flowchart.js';
import { layoutSequence } from './layout-sequence.js';
import { parseMermaid } from './mermaid.js';
import { LIMITS, normalizeSpec } from './normalize.js';
import { type DiagramKind, DiagramInputError, type DiagramSpec, type Scene } from './types.js';

export interface GenerateInput {
  title?: unknown;
  fileName?: unknown;
  mermaid?: unknown;
  spec?: unknown;
}

export interface DiagramStats {
  nodes: number;
  edges: number;
  groups: number;
}

export interface GenerateResult {
  kind: DiagramKind;
  title: string;
  fileName: string;
  mimeType: string;
  /**
   * Resolved geometry. The native UI draws the SVG preview from it and builds
   * the .drawio file from it on download — the file itself is never sent, as it
   * is several times larger than the geometry and overruns what the renderer
   * surface accepts.
   */
  preview: Scene;
  stats: DiagramStats;
  warnings: string[];
  summary: string;
}

export const DRAWIO_MIME_TYPE = 'application/vnd.jgraph.mxfile';

export function generateDiagram(input: GenerateInput): GenerateResult {
  const title = optionalTitle(input.title);
  const { spec, warnings } = readSpec(input, title);
  const scene = layoutFor(spec);
  const stats = statsFor(spec);

  return {
    kind: spec.kind,
    title: spec.title,
    fileName: buildFileName(input.fileName, spec.title, spec.kind),
    mimeType: DRAWIO_MIME_TYPE,
    preview: packStyles(scene),
    stats,
    warnings,
    summary: summarize(spec, stats),
  };
}

function readSpec(input: GenerateInput, title: string | undefined) {
  const hasMermaid = typeof input.mermaid === 'string' && input.mermaid.trim() !== '';
  const hasSpec = input.spec !== undefined && input.spec !== null;

  if (hasMermaid && hasSpec) {
    throw new DiagramInputError('Provide either "spec" or "mermaid", not both.', [
      'Use "spec" for full control over shapes and grouping; use "mermaid" to convert existing source.',
    ]);
  }
  if (hasMermaid) {
    const source = input.mermaid as string;
    if (source.length > LIMITS.mermaidChars) {
      throw new DiagramInputError(
        `"mermaid" must be at most ${LIMITS.mermaidChars} characters.`,
        [`Received ${source.length}. Split the diagram into smaller ones.`],
      );
    }
    return parseMermaid(source, title);
  }
  if (hasSpec) {
    return { spec: normalizeSpec(readSpecValue(input.spec), title), warnings: [] as string[] };
  }
  throw new DiagramInputError('Provide either "spec" or "mermaid".', [
    'See the drawio-diagrams skill for the shape of each.',
  ]);
}

/**
 * Tool callers routinely serialize a nested object argument as a JSON string.
 * Accepting that costs one parse and saves the caller a failed round trip, so
 * the string form is unwrapped here rather than rejected.
 */
function readSpecValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new DiagramInputError('"spec" was a string but is not valid JSON.', [
      error instanceof Error ? error.message : String(error),
      'Send "spec" as an object, or as a correctly JSON-encoded string.',
    ]);
  }
}

/**
 * Replace every cell's inline style string with an index into a shared table.
 * A dozen shapes typically share three or four styles, so this is most of the
 * scene's size for none of its meaning.
 */
function packStyles(scene: Scene): Scene {
  const styles: string[] = [];
  const indexOf = (style: string | undefined) => {
    const value = style ?? '';
    const existing = styles.indexOf(value);
    if (existing !== -1) return existing;
    return styles.push(value) - 1;
  };
  return {
    ...scene,
    styles,
    shapes: scene.shapes.map(({ drawioStyle, ...shape }) => ({
      ...shape,
      styleId: indexOf(drawioStyle),
    })),
    edges: scene.edges.map(({ drawioStyle, ...edge }) => ({
      ...edge,
      styleId: indexOf(drawioStyle),
    })),
  };
}

function layoutFor(spec: DiagramSpec): Scene {
  if (spec.kind === 'flowchart') return layoutFlowchart(spec);
  if (spec.kind === 'sequence') return layoutSequence(spec);
  return layoutErd(spec);
}

function statsFor(spec: DiagramSpec): DiagramStats {
  if (spec.kind === 'flowchart') {
    return { nodes: spec.nodes.length, edges: spec.edges.length, groups: spec.groups.length };
  }
  if (spec.kind === 'sequence') {
    return {
      nodes: spec.participants.length,
      edges: spec.messages.filter((message) => message.label !== '' || message.arrow !== 'none')
        .length,
      groups: spec.notes.length,
    };
  }
  return {
    nodes: spec.entities.length,
    edges: spec.relationships.length,
    groups: spec.entities.reduce((total, entity) => total + entity.fields.length, 0),
  };
}

function summarize(spec: DiagramSpec, stats: DiagramStats): string {
  const named = spec.title === '' ? '' : ` "${spec.title}"`;
  if (spec.kind === 'flowchart') {
    const groups = stats.groups > 0 ? ` in ${stats.groups} subgraph(s)` : '';
    return `Flowchart${named} with ${stats.nodes} node(s) and ${stats.edges} edge(s)${groups}, laid out ${spec.direction}.`;
  }
  if (spec.kind === 'sequence') {
    const notes = stats.groups > 0 ? ` and ${stats.groups} note(s)` : '';
    return `Sequence diagram${named} with ${stats.nodes} participant(s) and ${stats.edges} message(s)${notes}.`;
  }
  return `ER diagram${named} with ${stats.nodes} entities, ${stats.groups} attribute(s), and ${stats.edges} relationship(s).`;
}

function optionalTitle(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  if (trimmed.length > LIMITS.label) {
    throw new DiagramInputError(`"title" must be at most ${LIMITS.label} characters.`);
  }
  return trimmed;
}

/** Always ends in `.drawio` so the file opens in draw.io without renaming. */
export function buildFileName(requested: unknown, title: string, kind: DiagramKind): string {
  const source =
    typeof requested === 'string' && requested.trim() !== ''
      ? requested.trim()
      : title !== ''
        ? title
        : kind;
  const slug = source
    .replace(/\.drawio$/i, '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 60);
  return `${slug === '' ? 'diagram' : slug}.drawio`;
}
