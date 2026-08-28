/**
 * Boundary validation for the structured `spec` input.
 *
 * Core validates the tool input against the declared JSON Schema, but the same
 * route serves the admin studio and any future caller, so the spec is validated
 * again here. Every rejection names the offending path so the agent can repair
 * its own input instead of retrying blindly.
 */

import {
  type Cardinality,
  type DiagramSpec,
  DiagramInputError,
  type EdgeArrow,
  type EdgeLine,
  type Entity,
  type EntityField,
  type ErdSpec,
  type FieldKey,
  type FlowDirection,
  type FlowEdge,
  type FlowGroup,
  type FlowNode,
  type FlowShape,
  type FlowchartSpec,
  type Message,
  type MessageArrow,
  type MessageLine,
  type NotePlacement,
  type Participant,
  type ParticipantKind,
  type Relationship,
  type SequenceNote,
  type SequenceSpec,
} from './types.js';
import { CLOUD_SERVICES } from './clouds.js';

export const LIMITS = {
  mermaidChars: 20_000,
  label: 240,
  nodes: 200,
  edges: 400,
  groups: 40,
  participants: 40,
  messages: 200,
  notes: 60,
  entities: 60,
  fields: 40,
  relationships: 200,
} as const;

const FLOW_SHAPES: FlowShape[] = [
  'process',
  'start',
  'end',
  'decision',
  'io',
  'document',
  'database',
  'subprocess',
  'manual',
  'note',
];
const FLOW_DIRECTIONS: FlowDirection[] = ['TB', 'BT', 'LR', 'RL'];
const EDGE_LINES: EdgeLine[] = ['solid', 'dashed', 'thick'];
const EDGE_ARROWS: EdgeArrow[] = ['arrow', 'open', 'none', 'cross', 'circle'];
const PARTICIPANT_KINDS: ParticipantKind[] = ['participant', 'actor'];
const MESSAGE_LINES: MessageLine[] = ['solid', 'dashed'];
const MESSAGE_ARROWS: MessageArrow[] = ['arrow', 'open', 'none', 'cross', 'async'];
const NOTE_PLACEMENTS: NotePlacement[] = ['left', 'right', 'over'];
const FIELD_KEY_VALUES: FieldKey[] = ['PK', 'FK', 'UK', 'none'];
const CARDINALITIES: Cardinality[] = [
  'one',
  'zero-or-one',
  'one-or-many',
  'zero-or-many',
  'many',
];

export function normalizeSpec(raw: unknown, titleOverride?: string): DiagramSpec {
  const spec = expectObject(raw, 'spec');
  const kind = expectString(spec.type, 'spec.type');
  if (kind === 'flowchart') return normalizeFlowchart(spec, titleOverride);
  if (kind === 'sequence') return normalizeSequence(spec, titleOverride);
  if (kind === 'erd') return normalizeErd(spec, titleOverride);
  throw new DiagramInputError(`spec.type must be "flowchart", "sequence", or "erd".`, [
    `Received "${kind}".`,
  ]);
}

/* -------------------------------------------------------------- flowchart */

function normalizeFlowchart(spec: JsonRecord, titleOverride?: string): FlowchartSpec {
  const rawNodes = expectArray(spec.nodes, 'spec.nodes', 1, LIMITS.nodes);
  const rawEdges = spec.edges === undefined ? [] : expectArray(spec.edges, 'spec.edges', 0, LIMITS.edges);
  const rawGroups =
    spec.groups === undefined ? [] : expectArray(spec.groups, 'spec.groups', 0, LIMITS.groups);

  const groups: FlowGroup[] = rawGroups.map((entry, index) => {
    const group = expectObject(entry, `spec.groups[${index}]`);
    return {
      id: expectId(group.id, `spec.groups[${index}].id`),
      label: text(group.label ?? group.id, `spec.groups[${index}].label`),
    };
  });
  assertUnique(groups.map((group) => group.id), 'spec.groups[].id');

  const groupIds = new Set(groups.map((group) => group.id));
  const nodes: FlowNode[] = rawNodes.map((entry, index) => {
    const node = expectObject(entry, `spec.nodes[${index}]`);
    const id = expectId(node.id, `spec.nodes[${index}].id`);
    const group = node.group === undefined ? undefined : expectId(node.group, `spec.nodes[${index}].group`);
    if (group !== undefined && !groupIds.has(group)) {
      throw new DiagramInputError(`spec.nodes[${index}].group references an undeclared group.`, [
        `Add { "id": "${group}", "label": "…" } to spec.groups.`,
      ]);
    }
    const icon = node.icon === undefined ? undefined : expectString(node.icon, `spec.nodes[${index}].icon`);
    if (icon !== undefined && !(icon in CLOUD_SERVICES)) {
      const near = Object.keys(CLOUD_SERVICES)
        .filter((key) => key.includes(icon) || icon.includes(key))
        .slice(0, 5);
      throw new DiagramInputError(`spec.nodes[${index}].icon is not a known cloud service.`, [
        `Received "${icon}".`,
        near.length > 0 ? `Did you mean: ${near.join(', ')}?` : 'See the drawio-diagrams skill for the list.',
      ]);
    }
    return {
      id,
      label: text(node.label ?? id, `spec.nodes[${index}].label`),
      shape: oneOf(node.shape ?? 'process', FLOW_SHAPES, `spec.nodes[${index}].shape`),
      group,
      icon,
    };
  });
  assertUnique(nodes.map((node) => node.id), 'spec.nodes[].id');

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: FlowEdge[] = rawEdges.map((entry, index) => {
    const edge = expectObject(entry, `spec.edges[${index}]`);
    const from = expectId(edge.from, `spec.edges[${index}].from`);
    const to = expectId(edge.to, `spec.edges[${index}].to`);
    for (const [value, path] of [[from, 'from'], [to, 'to']] as const) {
      if (!nodeIds.has(value)) {
        throw new DiagramInputError(
          `spec.edges[${index}].${path} references unknown node "${value}".`,
          [`Known node ids: ${[...nodeIds].slice(0, 12).join(', ')}${nodeIds.size > 12 ? ', …' : ''}`],
        );
      }
    }
    return {
      from,
      to,
      label: edge.label === undefined ? undefined : text(edge.label, `spec.edges[${index}].label`),
      line: oneOf(edge.line ?? 'solid', EDGE_LINES, `spec.edges[${index}].line`),
      arrow: oneOf(edge.arrow ?? 'arrow', EDGE_ARROWS, `spec.edges[${index}].arrow`),
    };
  });

  return {
    kind: 'flowchart',
    title: titleOverride ?? optionalText(spec.title, 'spec.title') ?? '',
    direction: oneOf(spec.direction ?? 'TB', FLOW_DIRECTIONS, 'spec.direction'),
    nodes,
    edges,
    groups: groups.filter((group) => nodes.some((node) => node.group === group.id)),
  };
}

/* --------------------------------------------------------------- sequence */

function normalizeSequence(spec: JsonRecord, titleOverride?: string): SequenceSpec {
  const rawParticipants = expectArray(
    spec.participants,
    'spec.participants',
    1,
    LIMITS.participants,
  );
  const rawMessages =
    spec.messages === undefined ? [] : expectArray(spec.messages, 'spec.messages', 0, LIMITS.messages);
  const rawNotes = spec.notes === undefined ? [] : expectArray(spec.notes, 'spec.notes', 0, LIMITS.notes);

  const participants: Participant[] = rawParticipants.map((entry, index) => {
    const participant = expectObject(entry, `spec.participants[${index}]`);
    const id = expectId(participant.id, `spec.participants[${index}].id`);
    return {
      id,
      label: text(participant.label ?? id, `spec.participants[${index}].label`),
      kind: oneOf(
        participant.kind ?? 'participant',
        PARTICIPANT_KINDS,
        `spec.participants[${index}].kind`,
      ),
    };
  });
  assertUnique(participants.map((participant) => participant.id), 'spec.participants[].id');

  const known = new Set(participants.map((participant) => participant.id));
  const requireParticipant = (value: string, path: string) => {
    if (!known.has(value)) {
      throw new DiagramInputError(`${path} references unknown participant "${value}".`, [
        `Declared participants: ${[...known].join(', ')}`,
      ]);
    }
    return value;
  };

  const messages: Message[] = rawMessages.map((entry, index) => {
    const message = expectObject(entry, `spec.messages[${index}]`);
    return {
      from: requireParticipant(
        expectId(message.from, `spec.messages[${index}].from`),
        `spec.messages[${index}].from`,
      ),
      to: requireParticipant(
        expectId(message.to, `spec.messages[${index}].to`),
        `spec.messages[${index}].to`,
      ),
      label: message.label === undefined ? '' : text(message.label, `spec.messages[${index}].label`),
      line: oneOf(message.line ?? 'solid', MESSAGE_LINES, `spec.messages[${index}].line`),
      arrow: oneOf(message.arrow ?? 'arrow', MESSAGE_ARROWS, `spec.messages[${index}].arrow`),
      activate: boolean(message.activate, `spec.messages[${index}].activate`),
      deactivate: boolean(message.deactivate, `spec.messages[${index}].deactivate`),
    };
  });

  const notes: SequenceNote[] = rawNotes.map((entry, index) => {
    const note = expectObject(entry, `spec.notes[${index}]`);
    const targets = expectArray(note.participants, `spec.notes[${index}].participants`, 1, 2).map(
      (value, position) =>
        requireParticipant(
          expectId(value, `spec.notes[${index}].participants[${position}]`),
          `spec.notes[${index}].participants[${position}]`,
        ),
    );
    const afterIndexRaw = note.afterIndex;
    const afterIndex =
      afterIndexRaw === undefined ? messages.length - 1 : integer(afterIndexRaw, `spec.notes[${index}].afterIndex`);
    return {
      afterIndex: Math.max(-1, Math.min(afterIndex, messages.length - 1)),
      placement: oneOf(note.placement ?? 'right', NOTE_PLACEMENTS, `spec.notes[${index}].placement`),
      participants: targets,
      text: text(note.text, `spec.notes[${index}].text`),
    };
  });

  return {
    kind: 'sequence',
    title: titleOverride ?? optionalText(spec.title, 'spec.title') ?? '',
    participants,
    messages,
    notes,
  };
}

/* -------------------------------------------------------------------- erd */

function normalizeErd(spec: JsonRecord, titleOverride?: string): ErdSpec {
  const rawEntities = expectArray(spec.entities, 'spec.entities', 1, LIMITS.entities);
  const rawRelationships =
    spec.relationships === undefined
      ? []
      : expectArray(spec.relationships, 'spec.relationships', 0, LIMITS.relationships);

  const entities: Entity[] = rawEntities.map((entry, index) => {
    const entity = expectObject(entry, `spec.entities[${index}]`);
    const id = expectId(entity.id, `spec.entities[${index}].id`);
    const rawFields =
      entity.fields === undefined
        ? []
        : expectArray(entity.fields, `spec.entities[${index}].fields`, 0, LIMITS.fields);
    const fields: EntityField[] = rawFields.map((fieldEntry, fieldIndex) => {
      const path = `spec.entities[${index}].fields[${fieldIndex}]`;
      const field = expectObject(fieldEntry, path);
      return {
        name: text(field.name, `${path}.name`),
        type: field.type === undefined ? '' : text(field.type, `${path}.type`),
        key: oneOf(field.key ?? 'none', FIELD_KEY_VALUES, `${path}.key`),
        comment: field.comment === undefined ? undefined : text(field.comment, `${path}.comment`),
      };
    });
    return { id, label: text(entity.label ?? id, `spec.entities[${index}].label`), fields };
  });
  assertUnique(entities.map((entity) => entity.id), 'spec.entities[].id');

  const known = new Set(entities.map((entity) => entity.id));
  const relationships: Relationship[] = rawRelationships.map((entry, index) => {
    const path = `spec.relationships[${index}]`;
    const relationship = expectObject(entry, path);
    const from = expectId(relationship.from, `${path}.from`);
    const to = expectId(relationship.to, `${path}.to`);
    for (const [value, side] of [[from, 'from'], [to, 'to']] as const) {
      if (!known.has(value)) {
        throw new DiagramInputError(`${path}.${side} references unknown entity "${value}".`, [
          `Declared entities: ${[...known].join(', ')}`,
        ]);
      }
    }
    return {
      from,
      to,
      fromCardinality: oneOf(
        relationship.fromCardinality ?? 'one',
        CARDINALITIES,
        `${path}.fromCardinality`,
      ),
      toCardinality: oneOf(
        relationship.toCardinality ?? 'zero-or-many',
        CARDINALITIES,
        `${path}.toCardinality`,
      ),
      label: relationship.label === undefined ? '' : text(relationship.label, `${path}.label`),
      identifying: boolean(relationship.identifying, `${path}.identifying`) ?? true,
    };
  });

  return {
    kind: 'erd',
    title: titleOverride ?? optionalText(spec.title, 'spec.title') ?? '',
    entities,
    relationships,
  };
}

/* ------------------------------------------------------------- primitives */

type JsonRecord = Record<string, unknown>;

function expectObject(value: unknown, path: string): JsonRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new DiagramInputError(`${path} must be an object.`);
  }
  return value as JsonRecord;
}

function expectArray(value: unknown, path: string, min: number, max: number): unknown[] {
  if (!Array.isArray(value)) throw new DiagramInputError(`${path} must be an array.`);
  if (value.length < min) {
    throw new DiagramInputError(`${path} must contain at least ${min} item(s).`);
  }
  if (value.length > max) {
    throw new DiagramInputError(`${path} must contain at most ${max} items.`, [
      `Received ${value.length}. Split the diagram into smaller ones.`,
    ]);
  }
  return value;
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DiagramInputError(`${path} must be a non-empty string.`);
  }
  return value.trim();
}

/** Ids are referenced by edges and reused as draw.io cell ids. */
function expectId(value: unknown, path: string): string {
  const id = expectString(value, path);
  if (id.length > 120) throw new DiagramInputError(`${path} must be at most 120 characters.`);
  return id;
}

function text(value: unknown, path: string): string {
  const raw = typeof value === 'number' ? String(value) : value;
  if (typeof raw !== 'string') throw new DiagramInputError(`${path} must be a string.`);
  const trimmed = raw.replace(/\\+n/g, '\n').trim();
  if (trimmed.length > LIMITS.label) {
    throw new DiagramInputError(`${path} must be at most ${LIMITS.label} characters.`, [
      `Received ${trimmed.length}.`,
    ]);
  }
  return trimmed;
}

function optionalText(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return text(value, path);
}

function oneOf<T extends string>(value: unknown, allowed: T[], path: string): T {
  const candidate = expectString(value, path);
  if (!(allowed as string[]).includes(candidate)) {
    throw new DiagramInputError(`${path} must be one of: ${allowed.join(', ')}.`, [
      `Received "${candidate}".`,
    ]);
  }
  return candidate as T;
}

function boolean(value: unknown, path: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new DiagramInputError(`${path} must be a boolean.`);
  return value;
}

function integer(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new DiagramInputError(`${path} must be an integer.`);
  }
  return value;
}

function assertUnique(values: string[], path: string): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  if (duplicates.size > 0) {
    throw new DiagramInputError(`${path} must be unique.`, [
      `Duplicated: ${[...duplicates].join(', ')}`,
    ]);
  }
}
