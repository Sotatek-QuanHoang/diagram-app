/**
 * UML sequence layout.
 *
 * Participants are spread along the top, each owning a full-height lifeline;
 * messages consume vertical slots in source order. Activation bars are opened
 * and closed by an explicit stack per participant, so `activate`/`deactivate`
 * statements and the `+`/`-` message suffixes both land on the same mechanism.
 */

import { MARGIN, TITLE_SPACE, finalize } from './layout-common.js';
import { snap, wrapLabel } from './text.js';
import { PALETTE, SEQUENCE_STYLE, drawioEndArrow, drawioStartArrow } from './theme.js';
import type {
  ArrowHead,
  Message,
  MessageArrow,
  Scene,
  SceneEdge,
  ScenePoint,
  SceneShape,
  SequenceSpec,
} from './types.js';

const FONT_SIZE = 12;
const HEAD_MIN_WIDTH = 110;
const HEAD_MAX_LABEL = 150;
const HEAD_GAP = 56;
const FIRST_MESSAGE_OFFSET = 44;
const MESSAGE_GAP = 46;
const SELF_MESSAGE_GAP = 70;
const SELF_MESSAGE_REACH = 46;
const NOTE_WIDTH = 190;
const NOTE_GAP = 18;
const BOTTOM_PADDING = 36;

const MESSAGE_ARROWS: Record<MessageArrow, ArrowHead> = {
  arrow: 'arrow',
  open: 'open',
  none: 'none',
  cross: 'cross',
  async: 'open',
};

interface Lane {
  id: string;
  label: string;
  labelLines: string[];
  x: number;
  w: number;
  centerX: number;
  /** Stack of activation bars currently open on this lifeline. */
  open: Array<{ startY: number; depth: number }>;
}

interface ActivationBar {
  lane: Lane;
  startY: number;
  endY: number;
  depth: number;
}

export function layoutSequence(spec: SequenceSpec): Scene {
  const headTop = MARGIN + TITLE_SPACE;
  const lanes = placeLanes(spec, headTop);
  const laneById = new Map(lanes.map((lane) => [lane.id, lane]));

  const edges: SceneEdge[] = [];
  const notes: SceneShape[] = [];
  const activations: ActivationBar[] = [];

  let cursor = headTop + SEQUENCE_STYLE.headHeight + FIRST_MESSAGE_OFFSET;

  const notesAfter = new Map<number, SequenceSpec['notes']>();
  for (const note of spec.notes) {
    const bucket = notesAfter.get(note.afterIndex);
    if (bucket) bucket.push(note);
    else notesAfter.set(note.afterIndex, [note]);
  }

  const emitNotes = (index: number) => {
    for (const note of notesAfter.get(index) ?? []) {
      const wrapped = wrapLabel(note.text, FONT_SIZE, NOTE_WIDTH - 24);
      const height = snap(Math.max(42, wrapped.height + 26));
      const targets = note.participants
        .map((id) => laneById.get(id))
        .filter((lane): lane is Lane => lane !== undefined);
      if (targets.length === 0) continue;

      let x: number;
      let width = NOTE_WIDTH;
      if (note.placement === 'over' && targets.length > 1) {
        const left = Math.min(...targets.map((lane) => lane.centerX));
        const right = Math.max(...targets.map((lane) => lane.centerX));
        x = left - 40;
        width = right - left + 80;
      } else if (note.placement === 'over') {
        x = targets[0].centerX - NOTE_WIDTH / 2;
      } else if (note.placement === 'left') {
        x = targets[0].centerX - NOTE_WIDTH - 24;
      } else {
        x = targets[0].centerX + 24;
      }

      notes.push({
        id: `note-${notes.length}`,
        geom: 'note',
        x,
        y: cursor,
        w: width,
        h: height,
        label: note.text,
        labelLines: wrapped.lines,
        fill: SEQUENCE_STYLE.noteFill,
        stroke: SEQUENCE_STYLE.noteStroke,
        fontColor: PALETTE.ink,
        fontSize: FONT_SIZE,
        align: 'left',
        verticalAlign: 'top',
        drawioStyle: SEQUENCE_STYLE.noteDrawioStyle,
      });
      cursor += height + NOTE_GAP;
    }
  };

  emitNotes(-1);

  spec.messages.forEach((message, index) => {
    const source = laneById.get(message.from);
    const target = laneById.get(message.to);
    if (!source || !target) return;

    if (isControlOnly(message)) {
      // A bare `activate X` / `deactivate X` moves the bar stack without
      // drawing anything or consuming a vertical slot.
      if (message.activate) openActivation(source, cursor);
      if (message.deactivate) closeActivation(source, cursor, activations);
      return;
    }

    const y = cursor;
    if (message.activate) openActivation(target, y);

    const selfCall = source.id === target.id;
    edges.push(
      selfCall
        ? routeSelfMessage(message, source, y, index)
        : routeMessage(message, source, target, y, index),
    );

    if (message.deactivate) {
      closeActivation(source, selfCall ? y + SELF_MESSAGE_GAP - 20 : y, activations);
    }
    cursor += selfCall ? SELF_MESSAGE_GAP : MESSAGE_GAP;
    emitNotes(index);
  });

  const lifelineBottom = cursor + BOTTOM_PADDING;
  for (const lane of lanes) {
    while (lane.open.length > 0) closeActivation(lane, lifelineBottom - 16, activations);
  }

  const shapes: SceneShape[] = [
    ...lanes.map((lane) => buildLifeline(spec, lane, headTop, lifelineBottom - headTop)),
    ...activations.map((bar, index) => buildActivation(bar, index)),
    ...notes,
  ];

  return finalize('sequence', spec.title, shapes, edges);
}

function isControlOnly(message: Message): boolean {
  return (
    message.from === message.to &&
    message.label === '' &&
    message.arrow === 'none' &&
    Boolean(message.activate || message.deactivate)
  );
}

function openActivation(lane: Lane, y: number): void {
  lane.open.push({ startY: y, depth: lane.open.length });
}

function closeActivation(lane: Lane, y: number, out: ActivationBar[]): void {
  const bar = lane.open.pop();
  if (!bar) return;
  out.push({ lane, startY: bar.startY, endY: Math.max(y, bar.startY + 24), depth: bar.depth });
}

/** Horizontal offset of a message endpoint when activation bars are stacked. */
function laneEdgeX(lane: Lane, towardRight: boolean): number {
  const depth = lane.open.length;
  if (depth === 0) return lane.centerX;
  const half = SEQUENCE_STYLE.activationWidth / 2 + (depth - 1) * 4;
  return lane.centerX + (towardRight ? half : -half);
}

function placeLanes(spec: SequenceSpec, headTop: number): Lane[] {
  let cursor = MARGIN;
  return spec.participants.map((participant) => {
    const wrapped = wrapLabel(participant.label, FONT_SIZE, HEAD_MAX_LABEL, true);
    const w = snap(Math.max(HEAD_MIN_WIDTH, wrapped.width + 36));
    const lane: Lane = {
      id: participant.id,
      label: participant.label,
      labelLines: wrapped.lines,
      x: cursor,
      w,
      centerX: cursor + w / 2,
      open: [],
    };
    cursor += w + HEAD_GAP;
    return lane;
  });
}

function buildLifeline(
  spec: SequenceSpec,
  lane: Lane,
  top: number,
  height: number,
): SceneShape {
  const participant = spec.participants.find((candidate) => candidate.id === lane.id)!;
  const actor = participant.kind === 'actor';
  return {
    id: `lifeline-${lane.id}`,
    geom: actor ? 'actorLifeline' : 'lifeline',
    x: lane.x,
    y: top,
    w: lane.w,
    h: height,
    label: lane.label,
    labelLines: lane.labelLines,
    fill: SEQUENCE_STYLE.lifelineFill,
    stroke: SEQUENCE_STYLE.lifelineStroke,
    fontColor: PALETTE.ink,
    fontSize: FONT_SIZE,
    bold: true,
    align: 'center',
    verticalAlign: 'middle',
    headerHeight: SEQUENCE_STYLE.headHeight,
    drawioStyle:
      SEQUENCE_STYLE.lifelineDrawioStyle +
      `size=${SEQUENCE_STYLE.headHeight};` +
      (actor ? 'participant=umlActor;' : ''),
  };
}

function buildActivation(bar: ActivationBar, index: number): SceneShape {
  const width = SEQUENCE_STYLE.activationWidth;
  return {
    id: `activation-${index}`,
    geom: 'activation',
    x: bar.lane.centerX - width / 2 + bar.depth * 4,
    y: bar.startY,
    w: width,
    h: bar.endY - bar.startY,
    label: '',
    labelLines: [],
    parent: `lifeline-${bar.lane.id}`,
    fill: SEQUENCE_STYLE.activationFill,
    stroke: SEQUENCE_STYLE.activationStroke,
    fontColor: PALETTE.ink,
    fontSize: FONT_SIZE,
    drawioStyle: SEQUENCE_STYLE.activationDrawioStyle,
  };
}

function routeMessage(
  message: Message,
  source: Lane,
  target: Lane,
  y: number,
  index: number,
): SceneEdge {
  const rightward = target.centerX > source.centerX;
  const from: ScenePoint = { x: laneEdgeX(source, rightward), y };
  const to: ScenePoint = { x: laneEdgeX(target, !rightward), y };
  const arrow = MESSAGE_ARROWS[message.arrow];
  return {
    id: `message-${index}`,
    label: message.label,
    route: [from, to],
    labelAt: { x: (from.x + to.x) / 2, y: y - 10 },
    stroke: PALETTE.edge,
    dashed: message.line === 'dashed',
    startArrow: 'none',
    endArrow: arrow,
    drawioStyle:
      'html=1;verticalAlign=bottom;labelBackgroundColor=none;rounded=0;edgeStyle=none;' +
      drawioEndArrow(arrow) +
      drawioStartArrow('none'),
  };
}

function routeSelfMessage(message: Message, lane: Lane, y: number, index: number): SceneEdge {
  const startX = laneEdgeX(lane, true);
  const reach = startX + SELF_MESSAGE_REACH;
  const bottom = y + SELF_MESSAGE_GAP - 26;
  const route: ScenePoint[] = [
    { x: startX, y },
    { x: reach, y },
    { x: reach, y: bottom },
    { x: startX, y: bottom },
  ];
  const arrow = MESSAGE_ARROWS[message.arrow];
  return {
    id: `message-${index}`,
    label: message.label,
    route,
    labelAt: { x: reach + 10, y: (y + bottom) / 2 },
    labelAnchor: 'start',
    stroke: PALETTE.edge,
    dashed: message.line === 'dashed',
    startArrow: 'none',
    endArrow: arrow,
    drawioStyle:
      'edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;align=left;verticalAlign=middle;' +
      'labelBackgroundColor=none;' +
      drawioEndArrow(arrow) +
      drawioStartArrow('none'),
  };
}
