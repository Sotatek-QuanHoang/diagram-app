/**
 * Mermaid -> DiagramSpec.
 *
 * A deliberate subset, not a Mermaid implementation. It covers the constructs
 * models and users actually write for `flowchart`, `sequenceDiagram`, and
 * `erDiagram`, and reports what it skipped as a warning rather than failing the
 * whole diagram or silently dropping content.
 */

import {
  type Cardinality,
  type DiagramSpec,
  DiagramInputError,
  type Entity,
  type EntityField,
  type FieldKey,
  type FlowDirection,
  type FlowEdge,
  type FlowGroup,
  type FlowNode,
  type FlowShape,
  type Message,
  type MessageArrow,
  type MessageLine,
  type Participant,
  type Relationship,
  type SequenceNote,
} from './types.js';

export interface MermaidResult {
  spec: DiagramSpec;
  warnings: string[];
}

export function parseMermaid(source: string, titleOverride?: string): MermaidResult {
  const { lines, frontMatterTitle } = preprocess(source);
  if (lines.length === 0) throw new DiagramInputError('The mermaid source is empty.');

  const header = lines[0].text;
  const warnings: string[] = [];
  const title = titleOverride ?? frontMatterTitle;

  if (/^(flowchart|graph)\b/i.test(header)) {
    return { spec: parseFlowchart(lines, title, warnings), warnings };
  }
  if (/^sequenceDiagram\b/i.test(header)) {
    return { spec: parseSequence(lines, title, warnings), warnings };
  }
  if (/^erDiagram\b/i.test(header)) {
    return { spec: parseErd(lines, title, warnings), warnings };
  }
  throw new DiagramInputError(
    `Unsupported mermaid diagram type: "${header.slice(0, 40)}".`,
    [
      'Supported first lines are "flowchart <dir>", "graph <dir>", "sequenceDiagram", and "erDiagram".',
    ],
  );
}

/* --------------------------------------------------------------- scanning */

interface SourceLine {
  text: string;
  number: number;
}

interface Preprocessed {
  lines: SourceLine[];
  /** `title:` lifted out of the YAML front-matter block, if there was one. */
  frontMatterTitle?: string;
}

/** Strip comments and blank lines; keep original line numbers. */
function preprocess(source: string): Preprocessed {
  const lines: SourceLine[] = [];
  let frontMatterTitle: string | undefined;
  let inFrontMatter = false;
  let frontMatterSeen = false;

  source.split(/\r?\n/).forEach((raw, index) => {
    let text = raw.trim();

    if (inFrontMatter) {
      if (text === '---') {
        inFrontMatter = false;
        return;
      }
      const titled = /^title\s*:\s*(.+)$/i.exec(text);
      // Mermaid's front matter carries the diagram title; keep it rather than
      // letting the diagram fall back to an unhelpful generic heading.
      if (titled) frontMatterTitle = label(titled[1]);
      return;
    }
    if (text === '---' && !frontMatterSeen && lines.length === 0) {
      inFrontMatter = true;
      frontMatterSeen = true;
      return;
    }

    text = text.replace(/%%\{.*?\}%%/g, '').trim();
    if (text.startsWith('%%')) return;
    if (text === '') return;
    lines.push({ text, number: index + 1 });
  });
  return { lines, frontMatterTitle };
}

function decodeText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    // Callers frequently write an escaped newline inside a label even though
    // Mermaid itself only understands <br>. Honour it instead of drawing "\\n".
    .replace(/\\+n/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/#quot;/g, '"')
    .replace(/&amp;/g, '&')
    .trim();
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && /^(".*"|'.*')$/s.test(trimmed)) return trimmed.slice(1, -1);
  return trimmed;
}

function label(value: string): string {
  return decodeText(unquote(value));
}

/* -------------------------------------------------------------- flowchart */

const DIRECTIONS: Record<string, FlowDirection> = {
  TB: 'TB',
  TD: 'TB',
  BT: 'BT',
  LR: 'LR',
  RL: 'RL',
};

/**
 * Mermaid link tokens, longest-first so `-.->` is never read as `--`. The
 * trailing `|label|` form is produced by `normalizeInlineLabels`.
 */
const LINK_TOKEN =
  /(<)?(-\.-+>|-\.-+|={2,}>|={3,}|-{2,}>|-{2,}x|-{2,}o|-{3,})(?:\s*\|([^|]*)\|)?/;

/** Rewrite `A -- text --> B` into the equivalent `A -->|text| B`. */
function normalizeInlineLabels(line: string): string {
  return line
    .replace(/-\.\s*([^.|][^\n]*?)\s*\.-+>/g, '-.->|$1|')
    .replace(/-\.\s*([^.|][^\n]*?)\s*\.-+/g, '-.-|$1|')
    .replace(/==\s*([^=|][^\n]*?)\s*==+>/g, '==>|$1|')
    .replace(/==\s*([^=|][^\n]*?)\s*===+/g, '===|$1|')
    .replace(/--\s*([^->|=][^\n]*?)\s*--+>/g, '-->|$1|')
    .replace(/--\s*([^->|=][^\n]*?)\s*--+x/g, '--x|$1|')
    .replace(/--\s*([^->|=][^\n]*?)\s*--+o/g, '--o|$1|')
    .replace(/--\s*([^->|=][^\n]*?)\s*---+/g, '---|$1|');
}

const NODE_PATTERNS: Array<{ re: RegExp; shape: FlowShape }> = [
  { re: /^([\w.\-]+)\s*\(\[([\s\S]*?)\]\)/, shape: 'start' },
  { re: /^([\w.\-]+)\s*\(\(([\s\S]*?)\)\)/, shape: 'start' },
  { re: /^([\w.\-]+)\s*\[\[([\s\S]*?)\]\]/, shape: 'subprocess' },
  { re: /^([\w.\-]+)\s*\[\(([\s\S]*?)\)\]/, shape: 'database' },
  { re: /^([\w.\-]+)\s*\{\{([\s\S]*?)\}\}/, shape: 'manual' },
  { re: /^([\w.\-]+)\s*\[\/([\s\S]*?)\/\]/, shape: 'io' },
  { re: /^([\w.\-]+)\s*\[\\([\s\S]*?)\\\]/, shape: 'io' },
  { re: /^([\w.\-]+)\s*\[([\s\S]*?)\]/, shape: 'process' },
  { re: /^([\w.\-]+)\s*\(([\s\S]*?)\)/, shape: 'process' },
  { re: /^([\w.\-]+)\s*\{([\s\S]*?)\}/, shape: 'decision' },
  { re: /^([\w.\-]+)\s*>([\s\S]*?)\]/, shape: 'note' },
];

const IGNORED_FLOW_DIRECTIVES =
  /^(classDef|class|style|linkStyle|click|accTitle|accDescr|direction)\b/i;

type EnsureNode = (
  id: string,
  text: string | undefined,
  shape: FlowShape | undefined,
) => FlowNode;

function parseFlowchart(
  lines: SourceLine[],
  titleOverride: string | undefined,
  warnings: string[],
): DiagramSpec {
  const headerMatch = /^(?:flowchart|graph)\s+([A-Za-z]{2})?/i.exec(lines[0].text);
  const direction = DIRECTIONS[(headerMatch?.[1] ?? 'TB').toUpperCase()] ?? 'TB';

  const nodes = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];
  const groups: FlowGroup[] = [];
  const groupStack: string[] = [];
  let anonymousGroups = 0;
  let flowTitle: string | undefined;

  const ensureNode: EnsureNode = (id, text, shape) => {
    let node = nodes.get(id);
    if (!node) {
      node = { id, label: text ?? id, shape: shape ?? 'process' };
      if (groupStack.length > 0) node.group = groupStack[groupStack.length - 1];
      nodes.set(id, node);
      return node;
    }
    // A later, richer mention wins: `A --> B` followed by `B[Label]` labels B.
    if (text !== undefined) node.label = text;
    if (shape !== undefined) node.shape = shape;
    if (node.group === undefined && groupStack.length > 0) {
      node.group = groupStack[groupStack.length - 1];
    }
    return node;
  };

  for (const line of lines.slice(1)) {
    const text = line.text;

    if (/^end$/i.test(text)) {
      if (groupStack.length === 0) warnings.push(`Line ${line.number}: unmatched "end".`);
      else groupStack.pop();
      continue;
    }

    const subgraph = /^subgraph\s+(.*)$/i.exec(text);
    if (subgraph) {
      const rest = subgraph[1].trim();
      const titled = /^([\w.\-]+)\s*\[([\s\S]*?)\]$/.exec(rest);
      let id: string;
      let groupLabel: string;
      if (titled) {
        id = titled[1];
        groupLabel = label(titled[2]);
      } else if (/^[\w.\-]+$/.test(rest)) {
        id = rest;
        groupLabel = rest;
      } else {
        anonymousGroups += 1;
        id = `group${anonymousGroups}`;
        groupLabel = label(rest);
      }
      if (!groups.some((group) => group.id === id)) groups.push({ id, label: groupLabel });
      groupStack.push(id);
      continue;
    }

    const titled = /^title\s+(.+)$/i.exec(text);
    if (titled) {
      if (flowTitle === undefined) flowTitle = label(titled[1]);
      continue;
    }

    if (IGNORED_FLOW_DIRECTIVES.test(text)) {
      if (/^direction\b/i.test(text)) {
        warnings.push(`Line ${line.number}: per-subgraph "direction" is not applied.`);
      }
      continue;
    }

    parseFlowStatement(normalizeInlineLabels(text), line, ensureNode, edges, warnings);
  }

  if (groupStack.length > 0) warnings.push('A "subgraph" was never closed with "end".');
  if (nodes.size === 0) {
    throw new DiagramInputError('No flowchart nodes were found in the mermaid source.');
  }

  const declared = [...nodes.values()];
  return {
    kind: 'flowchart',
    // No heading beats a heading that just repeats the diagram type.
    title: titleOverride ?? flowTitle ?? '',
    direction,
    nodes: declared,
    edges,
    groups: groups.filter((group) => declared.some((node) => node.group === group.id)),
  };
}

type FlowToken =
  | { type: 'nodes'; ids: string[] }
  | { type: 'link'; operator: string; label?: string; bidirectional: boolean };

/** Parse one chained statement: `A[x] --> B{y} -->|no| C & D`. */
function parseFlowStatement(
  statement: string,
  line: SourceLine,
  ensureNode: EnsureNode,
  edges: FlowEdge[],
  warnings: string[],
): void {
  const tokens: FlowToken[] = [];
  let rest = statement;

  for (;;) {
    const match = LINK_TOKEN.exec(rest);
    const head = (match ? rest.slice(0, match.index) : rest).trim();
    tokens.push({ type: 'nodes', ids: parseNodeChain(head, line, ensureNode, warnings) });
    if (!match) break;
    tokens.push({
      type: 'link',
      operator: match[2],
      label: match[3],
      bidirectional: Boolean(match[1]),
    });
    rest = rest.slice(match.index + match[0].length);
  }

  for (let index = 1; index < tokens.length; index += 2) {
    const link = tokens[index];
    const before = tokens[index - 1];
    const after = tokens[index + 1];
    if (link.type !== 'link' || before?.type !== 'nodes' || after?.type !== 'nodes') continue;
    if (before.ids.length === 0 || after.ids.length === 0) {
      warnings.push(`Line ${line.number}: a link was missing one of its endpoints.`);
      continue;
    }
    addEdges(before.ids, after.ids, link, edges);
  }
}

/** `A[x] & B[y]` -> the ids on one side of a link. */
function parseNodeChain(
  segment: string,
  line: SourceLine,
  ensureNode: EnsureNode,
  warnings: string[],
): string[] {
  const ids: string[] = [];
  for (const part of segment.split('&')) {
    const piece = part.trim();
    if (piece === '') continue;
    const pattern = NODE_PATTERNS.find(({ re }) => re.test(piece));
    if (pattern) {
      const found = pattern.re.exec(piece)!;
      ensureNode(found[1], label(found[2]), pattern.shape);
      ids.push(found[1]);
      continue;
    }
    const bare = /^([\w.\-]+)$/.exec(piece);
    if (bare) {
      ensureNode(bare[1], undefined, undefined);
      ids.push(bare[1]);
    } else {
      warnings.push(`Line ${line.number}: could not read node "${piece.slice(0, 40)}".`);
    }
  }
  return ids;
}

function addEdges(
  sources: string[],
  targets: string[],
  link: Extract<FlowToken, { type: 'link' }>,
  edges: FlowEdge[],
): void {
  const { operator } = link;
  const style: FlowEdge['line'] = operator.includes('.')
    ? 'dashed'
    : operator.includes('=')
      ? 'thick'
      : 'solid';
  const arrow: FlowEdge['arrow'] = operator.endsWith('>')
    ? 'arrow'
    : operator.endsWith('x')
      ? 'cross'
      : operator.endsWith('o')
        ? 'circle'
        : 'none';
  const text = link.label ? label(link.label) : undefined;

  for (const from of sources) {
    for (const to of targets) {
      edges.push({ from, to, label: text, line: style, arrow });
      if (link.bidirectional) edges.push({ from: to, to: from, line: style, arrow });
    }
  }
}

/* --------------------------------------------------------------- sequence */

const SEQUENCE_ARROWS: Array<{ token: string; line: MessageLine; arrow: MessageArrow }> = [
  { token: '<<-->>', line: 'dashed', arrow: 'arrow' },
  { token: '<<->>', line: 'solid', arrow: 'arrow' },
  { token: '-->>', line: 'dashed', arrow: 'arrow' },
  { token: '--)', line: 'dashed', arrow: 'async' },
  { token: '--x', line: 'dashed', arrow: 'cross' },
  { token: '-->', line: 'dashed', arrow: 'open' },
  { token: '->>', line: 'solid', arrow: 'arrow' },
  { token: '-)', line: 'solid', arrow: 'async' },
  { token: '-x', line: 'solid', arrow: 'cross' },
  { token: '->', line: 'solid', arrow: 'open' },
];

const SEQUENCE_BLOCKS = /^(loop|alt|else|opt|par|and|critical|option|break|rect|box)\b/i;

function parseSequence(
  lines: SourceLine[],
  titleOverride: string | undefined,
  warnings: string[],
): DiagramSpec {
  const participants = new Map<string, Participant>();
  const messages: Message[] = [];
  const notes: SequenceNote[] = [];
  let title = titleOverride ?? '';
  let flattenedBlocks = 0;

  const ensureParticipant = (id: string, kind: Participant['kind'] = 'participant') => {
    const key = id.trim();
    let participant = participants.get(key);
    if (!participant) {
      participant = { id: key, label: key, kind };
      participants.set(key, participant);
    }
    return participant;
  };

  for (const line of lines.slice(1)) {
    const text = line.text;

    const declared = /^(participant|actor)\s+(.+)$/i.exec(text);
    if (declared) {
      const kind = declared[1].toLowerCase() === 'actor' ? 'actor' : 'participant';
      const aliased = /^(.+?)\s+as\s+(.+)$/i.exec(declared[2]);
      const id = (aliased ? aliased[1] : declared[2]).trim();
      const participant = ensureParticipant(id, kind);
      participant.kind = kind;
      participant.label = label(aliased ? aliased[2] : declared[2]);
      continue;
    }

    const activation = /^(activate|deactivate)\s+(.+)$/i.exec(text);
    if (activation) {
      const id = activation[2].trim();
      ensureParticipant(id);
      const activate = activation[1].toLowerCase() === 'activate';
      // A control-only entry: the layout reads it for activation bars and draws
      // no message line for it.
      messages.push({
        from: id,
        to: id,
        label: '',
        line: 'solid',
        arrow: 'none',
        activate,
        deactivate: !activate,
      });
      continue;
    }

    const note = /^note\s+(left of|right of|over)\s+([^:]+):\s*(.*)$/i.exec(text);
    if (note) {
      const keyword = note[1].toLowerCase();
      const placement = keyword.startsWith('left')
        ? 'left'
        : keyword.startsWith('right')
          ? 'right'
          : 'over';
      const targets = note[2]
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
      targets.forEach((id) => ensureParticipant(id));
      notes.push({
        afterIndex: messages.length - 1,
        placement,
        participants: targets,
        text: label(note[3]),
      });
      continue;
    }

    const declaredTitle = /^title\s+(.+)$/i.exec(text);
    if (declaredTitle) {
      if (!titleOverride) title = label(declaredTitle[1]);
      continue;
    }

    if (/^autonumber\b/i.test(text) || /^(accTitle|accDescr)/i.test(text)) continue;
    if (/^end$/i.test(text)) continue;
    if (SEQUENCE_BLOCKS.test(text)) {
      flattenedBlocks += 1;
      continue;
    }

    const message = parseSequenceMessage(text);
    if (message) {
      ensureParticipant(message.from);
      ensureParticipant(message.to);
      messages.push(message);
      continue;
    }
    warnings.push(`Line ${line.number}: could not read "${text.slice(0, 40)}".`);
  }

  if (flattenedBlocks > 0) {
    warnings.push(
      `${flattenedBlocks} block frame(s) (loop/alt/opt/par) were flattened; their messages are kept in order.`,
    );
  }
  if (participants.size === 0) {
    throw new DiagramInputError('No participants were found in the sequence diagram.');
  }

  return { kind: 'sequence', title, participants: [...participants.values()], messages, notes };
}

function parseSequenceMessage(text: string): Message | undefined {
  for (const { token, line, arrow } of SEQUENCE_ARROWS) {
    const at = text.indexOf(token);
    if (at === -1) continue;
    const left = text.slice(0, at).trim();
    const remainder = text.slice(at + token.length);
    const split = remainder.indexOf(':');
    const rightRaw = (split === -1 ? remainder : remainder.slice(0, split)).trim();
    const body = split === -1 ? '' : label(remainder.slice(split + 1));
    if (left === '' || rightRaw === '') continue;

    // `A->>+B: x` activates B on arrival; `A-->>-B: x` deactivates A on send.
    let right = rightRaw;
    let activate = false;
    let deactivate = false;
    if (right.startsWith('+')) {
      activate = true;
      right = right.slice(1).trim();
    } else if (right.startsWith('-')) {
      deactivate = true;
      right = right.slice(1).trim();
    }
    if (right === '') continue;
    return { from: left, to: right, label: body, line, arrow, activate, deactivate };
  }
  return undefined;
}

/* -------------------------------------------------------------------- erd */

const LEFT_CARDINALITY: Record<string, Cardinality> = {
  '||': 'one',
  '|o': 'zero-or-one',
  '}|': 'one-or-many',
  '}o': 'zero-or-many',
};

const RIGHT_CARDINALITY: Record<string, Cardinality> = {
  '||': 'one',
  'o|': 'zero-or-one',
  '|{': 'one-or-many',
  'o{': 'zero-or-many',
};

const RELATIONSHIP_RE =
  /^(\S+?)\s*(\|\||\|o|\}\||\}o)(--|\.\.)(\|\||o\||\|\{|o\{)\s*(\S+?)\s*(?::\s*(.*))?$/;

const FIELD_KEYS = new Set(['PK', 'FK', 'UK']);

function parseErd(
  lines: SourceLine[],
  titleOverride: string | undefined,
  warnings: string[],
): DiagramSpec {
  const entities = new Map<string, Entity>();
  const relationships: Relationship[] = [];
  let openEntity: Entity | undefined;
  let erdHeading: string | undefined;

  const ensureEntity = (id: string, alias?: string) => {
    const key = id.trim();
    let entity = entities.get(key);
    if (!entity) {
      entity = { id: key, label: alias ?? key, fields: [] };
      entities.set(key, entity);
    } else if (alias) {
      entity.label = alias;
    }
    return entity;
  };

  for (const line of lines.slice(1)) {
    const text = line.text;

    if (openEntity) {
      if (text === '}') {
        openEntity = undefined;
        continue;
      }
      const field = parseErdField(text);
      if (field) openEntity.fields.push(field);
      else warnings.push(`Line ${line.number}: could not read attribute "${text.slice(0, 40)}".`);
      continue;
    }

    // `CUSTOMER {` or `CUSTOMER["Alias"] {`
    const block = /^(\S+?)(?:\[([^\]]*)\])?\s*\{$/.exec(text);
    if (block) {
      openEntity = ensureEntity(block[1], block[2] ? label(block[2]) : undefined);
      continue;
    }

    const relationship = RELATIONSHIP_RE.exec(text);
    if (relationship) {
      const from = ensureEntity(stripAlias(relationship[1]));
      const to = ensureEntity(stripAlias(relationship[5]));
      relationships.push({
        from: from.id,
        to: to.id,
        fromCardinality: LEFT_CARDINALITY[relationship[2]] ?? 'one',
        toCardinality: RIGHT_CARDINALITY[relationship[4]] ?? 'zero-or-many',
        label: relationship[6] ? label(relationship[6]) : '',
        identifying: relationship[3] === '--',
      });
      continue;
    }

    const erdTitle = /^title\s+(.+)$/i.exec(text);
    if (erdTitle) {
      if (erdHeading === undefined) erdHeading = label(erdTitle[1]);
      continue;
    }
    if (/^(accTitle|accDescr|direction)\b/i.test(text)) continue;

    const lone = /^(\S+?)(?:\[([^\]]*)\])?$/.exec(text);
    if (lone) {
      ensureEntity(lone[1], lone[2] ? label(lone[2]) : undefined);
      continue;
    }
    warnings.push(`Line ${line.number}: could not read "${text.slice(0, 40)}".`);
  }

  if (entities.size === 0) {
    throw new DiagramInputError('No entities were found in the ER diagram.');
  }

  return {
    kind: 'erd',
    title: titleOverride ?? erdHeading ?? '',
    entities: [...entities.values()],
    relationships,
  };
}

function stripAlias(token: string): string {
  return token.replace(/\[[^\]]*\]$/, '');
}

function parseErdField(text: string): EntityField | undefined {
  const commented = /^(.*?)\s*"([^"]*)"\s*$/.exec(text);
  const body = (commented ? commented[1] : text).trim();
  const comment = commented ? decodeText(commented[2]) : undefined;
  const parts = body.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return undefined;

  // Mermaid writes `type name KEY`, e.g. `string customerId PK`.
  const [type, name, ...rest] = parts;
  const keys = rest.flatMap((token) => token.split(',')).map((token) => token.trim().toUpperCase());
  const key = (keys.find((token) => FIELD_KEYS.has(token)) ?? 'none') as FieldKey;
  return { name, type, key, comment };
}
