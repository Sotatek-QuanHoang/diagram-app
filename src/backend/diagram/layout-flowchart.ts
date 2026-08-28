/**
 * Layered ("Sugiyama-style") flowchart layout.
 *
 * Rank by longest path over the acyclic part of the graph, order each rank by
 * repeated barycenter sweeps to cut edge crossings, then assign coordinates and
 * route every edge orthogonally. The whole thing is computed on a rank/cross
 * axis pair and mapped to x/y at the end, so TB, BT, LR, and RL share one
 * implementation rather than four.
 */

import {
  AWS_CATEGORY_COLOR,
  ICON_LABEL_GAP,
  ICON_TILE,
  PROVIDER_TINT,
  cloudIconStyle,
  cloudService,
  shapeId,
} from './clouds.js';
import { MARGIN, TITLE_SPACE, finalize, labelPointFor } from './layout-common.js';
import { snap, wrapLabel } from './text.js';
import {
  GROUP_STYLE,
  PALETTE,
  drawioEndArrow,
  drawioStartArrow,
  edgeLineDecoration,
  flowShapeStyle,
} from './theme.js';
import type {
  ArrowHead,
  FlowEdge,
  FlowchartSpec,
  Scene,
  SceneEdge,
  ScenePoint,
  SceneShape,
} from './types.js';

const FONT_SIZE = 12;
const MAX_LABEL_WIDTH = 190;
const RANK_GAP = 70;
const CROSS_GAP = 46;
const GROUP_GAP_EXTRA = 34;

interface Box {
  id: string;
  label: string;
  lines: string[];
  w: number;
  h: number;
  group?: string;
  /** Edge length of the AWS icon tile, when this node is drawn as one. */
  tile?: number;
  /** Height reserved beneath the tile for the label. */
  labelBand?: number;
  /** Size along the cross axis / rank axis for the direction being laid out. */
  crossExtent: number;
  rankExtent: number;
  rank: number;
  order: number;
  cross: number;
  /** Absolute centre, filled in once the rank/cross grid is mapped to x/y. */
  cx: number;
  cy: number;
}

export function layoutFlowchart(spec: FlowchartSpec): Scene {
  const boxes = sizeNodes(spec);

  const byId = new Map(boxes.map((box) => [box.id, box]));

  const edges = spec.edges.filter((edge) => byId.has(edge.from) && byId.has(edge.to));
  const selfEdges = edges.filter((edge) => edge.from === edge.to);
  const linkEdges = edges.filter((edge) => edge.from !== edge.to);

  const backEdges = findBackEdges(boxes, linkEdges);
  assignRanks(boxes, byId, linkEdges, backEdges);
  orderRanks(boxes, byId, linkEdges, backEdges);
  assignCrossPositions(boxes, byId, linkEdges, spec.groups.length > 0);
  mapToCanvas(boxes, spec.direction);

  const shapes: SceneShape[] = [];
  const groupShapes = buildGroups(spec, boxes);
  shapes.push(...groupShapes);
  shapes.push(...boxes.map((box) => buildNodeShape(spec, box, groupShapes)));

  const forwardEdges = linkEdges.filter((edge) => {
    const source = byId.get(edge.from)!;
    const target = byId.get(edge.to)!;
    return !backEdges.has(edge) && target.rank > source.rank;
  });
  const exits = spreadAnchors(forwardEdges, byId, spec.direction, 'from');
  const entries = spreadAnchors(forwardEdges, byId, spec.direction, 'to');

  const sceneEdges: SceneEdge[] = [];
  let backEdgeIndex = 0;
  linkEdges.forEach((edge, index) => {
    const source = byId.get(edge.from)!;
    const target = byId.get(edge.to)!;
    const isBack = backEdges.has(edge) || target.rank <= source.rank;
    sceneEdges.push(
      routeEdge(
        edge,
        source,
        target,
        spec.direction,
        index,
        isBack ? backEdgeIndex++ : -1,
        exits.get(edge) ?? 0.5,
        entries.get(edge) ?? 0.5,
      ),
    );
  });
  selfEdges.forEach((edge, index) => {
    sceneEdges.push(routeSelfEdge(edge, byId.get(edge.from)!, index));
  });

  return finalize('flowchart', spec.title, shapes, sceneEdges);
}

/* ------------------------------------------------------------- 1. sizing */

function sizeNodes(spec: FlowchartSpec): Box[] {
  const vertical = spec.direction === 'TB' || spec.direction === 'BT';
  return spec.nodes.map((node, index) => {
    const service = node.icon ? cloudService(node.icon) : undefined;
    const style = flowShapeStyle(node.shape);
    // An icon node is a fixed square tile with its label underneath, so its
    // footprint is the wider of the two and tall enough for both.
    const maxLabel = service ? Math.max(MAX_LABEL_WIDTH, ICON_TILE + 60) : MAX_LABEL_WIDTH;
    const wrapped = wrapLabel(node.label, FONT_SIZE, maxLabel);
    const labelBand = service ? ICON_LABEL_GAP + wrapped.height + 4 : 0;
    const w = service
      ? snap(Math.max(ICON_TILE, wrapped.width + 12))
      : snap(Math.max(style.minWidth, wrapped.width + style.padX));
    const h = service
      ? snap(ICON_TILE + labelBand)
      : snap(Math.max(style.minHeight, wrapped.height + style.padY));
    return {
      id: node.id,
      label: node.label,
      lines: wrapped.lines,
      tile: service ? ICON_TILE : undefined,
      labelBand: service ? labelBand : undefined,
      w,
      h,
      group: node.group,
      crossExtent: vertical ? w : h,
      rankExtent: vertical ? h : w,
      rank: 0,
      order: index,
      cross: 0,
      cx: 0,
      cy: 0,
    };
  });
}

/* ------------------------------------------------------------ 2. ranking */

/**
 * Depth-first search marking edges that close a cycle. Those edges are excluded
 * from ranking (so the longest-path pass terminates) and routed as return paths.
 */
function findBackEdges(boxes: Box[], edges: FlowEdge[]): Set<FlowEdge> {
  const outgoing = new Map<string, FlowEdge[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.from);
    if (list) list.push(edge);
    else outgoing.set(edge.from, [edge]);
  }

  const back = new Set<FlowEdge>();
  const state = new Map<string, 'open' | 'done'>();

  const visit = (id: string) => {
    state.set(id, 'open');
    for (const edge of outgoing.get(id) ?? []) {
      const next = state.get(edge.to);
      if (next === 'open') back.add(edge);
      else if (next === undefined) visit(edge.to);
    }
    state.set(id, 'done');
  };

  // Prefer real entry points so the dominant flow direction reads correctly.
  const indegree = new Map(boxes.map((box) => [box.id, 0]));
  for (const edge of edges) indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  const roots = boxes.filter((box) => (indegree.get(box.id) ?? 0) === 0);
  for (const box of [...roots, ...boxes]) {
    if (!state.has(box.id)) visit(box.id);
  }
  return back;
}

function assignRanks(
  boxes: Box[],
  byId: Map<string, Box>,
  edges: FlowEdge[],
  backEdges: Set<FlowEdge>,
): void {
  const forward = edges.filter((edge) => !backEdges.has(edge));
  const incoming = new Map<string, FlowEdge[]>();
  const outgoing = new Map<string, FlowEdge[]>();
  const indegree = new Map(boxes.map((box) => [box.id, 0]));
  for (const edge of forward) {
    (outgoing.get(edge.from) ?? outgoing.set(edge.from, []).get(edge.from)!).push(edge);
    (incoming.get(edge.to) ?? incoming.set(edge.to, []).get(edge.to)!).push(edge);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }

  // Kahn topological order; longest path gives each node the deepest rank that
  // still sits after all of its predecessors.
  const queue = boxes.filter((box) => (indegree.get(box.id) ?? 0) === 0).map((box) => box.id);
  const remaining = new Map(indegree);
  const ordered: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    ordered.push(id);
    for (const edge of outgoing.get(id) ?? []) {
      const left = (remaining.get(edge.to) ?? 0) - 1;
      remaining.set(edge.to, left);
      if (left === 0) queue.push(edge.to);
    }
  }
  // Any node left over sits on a cycle every entry of which was a back edge.
  for (const box of boxes) if (!ordered.includes(box.id)) ordered.push(box.id);

  for (const id of ordered) {
    const box = byId.get(id)!;
    let rank = 0;
    for (const edge of incoming.get(id) ?? []) {
      const source = byId.get(edge.from);
      if (source) rank = Math.max(rank, source.rank + 1);
    }
    box.rank = rank;
  }
}

/* ----------------------------------------------------------- 3. ordering */

/**
 * Group boxes by rank, each rank in its established left-to-right order.
 *
 * The sort matters: this is called again after the ordering pass, and without it
 * the ranks come back in node-declaration order, silently discarding the
 * crossing-reduction and grouping work that `orderRanks` just did.
 */
function ranksOf(boxes: Box[]): Box[][] {
  const ranks: Box[][] = [];
  for (const box of boxes) {
    (ranks[box.rank] ??= []).push(box);
  }
  for (let index = 0; index < ranks.length; index += 1) {
    ranks[index] ??= [];
    ranks[index].sort((a, b) => a.order - b.order);
  }
  return ranks;
}

function orderRanks(
  boxes: Box[],
  byId: Map<string, Box>,
  edges: FlowEdge[],
  backEdges: Set<FlowEdge>,
): void {
  const ranks = ranksOf(boxes);
  ranks.forEach((rank) => rank.forEach((box, index) => (box.order = index)));

  const forward = edges.filter((edge) => !backEdges.has(edge));
  const predecessors = new Map<string, string[]>();
  const successors = new Map<string, string[]>();
  for (const edge of forward) {
    (predecessors.get(edge.to) ?? predecessors.set(edge.to, []).get(edge.to)!).push(edge.from);
    (successors.get(edge.from) ?? successors.set(edge.from, []).get(edge.from)!).push(edge.to);
  }

  const sweep = (rank: Box[], neighbors: Map<string, string[]>) => {
    const keyed = rank.map((box) => {
      const linked = (neighbors.get(box.id) ?? [])
        .map((id) => byId.get(id)?.order)
        .filter((order): order is number => order !== undefined);
      const barycenter =
        linked.length === 0
          ? box.order
          : linked.reduce((sum, order) => sum + order, 0) / linked.length;
      return { box, barycenter };
    });
    keyed.sort((a, b) => a.barycenter - b.barycenter || a.box.order - b.box.order);
    keyed.forEach(({ box }, index) => (box.order = index));
    rank.sort((a, b) => a.order - b.order);
  };

  for (let pass = 0; pass < 4; pass += 1) {
    for (let index = 1; index < ranks.length; index += 1) sweep(ranks[index], predecessors);
    for (let index = ranks.length - 2; index >= 0; index -= 1) sweep(ranks[index], successors);
  }

  groupTogether(ranks);
}

/**
 * Give every subgraph the same relative slot in each rank it appears in.
 *
 * Ranks differ in length, so positions are normalised to 0..1 before a group's
 * mean is taken; comparing raw indices across ranks of different sizes lets a
 * group drift sideways from rank to rank, and its bounding box then stretches
 * across unrelated nodes. With a consistent slot order the boxes stay narrow
 * and cannot interleave.
 */
function groupTogether(ranks: Box[][]): void {
  const scaled = (box: Box, rank: Box[]) =>
    rank.length <= 1 ? 0.5 : box.order / (rank.length - 1);

  const totals = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const rank of ranks) {
    for (const box of rank) {
      if (!box.group) continue;
      totals.set(box.group, (totals.get(box.group) ?? 0) + scaled(box, rank));
      counts.set(box.group, (counts.get(box.group) ?? 0) + 1);
    }
  }
  if (totals.size === 0) return;

  // Means alone are not enough to separate groups: with several subgraphs spread
  // over the drawing their averages land close together, ties break on the old
  // order, and members end up interleaved. Collapse the means to distinct
  // integer slots so every member of a group sorts to exactly the same key and
  // is therefore contiguous.
  const means = [...totals].map(([group, total]) => ({
    group,
    mean: total / (counts.get(group) ?? 1),
  }));
  means.sort((a, b) => a.mean - b.mean);
  const slotOf = new Map(means.map(({ group }, index) => [group, index]));
  const slots = means.length;

  for (const rank of ranks) {
    const keyed = rank.map((box) => ({
      box,
      // Ungrouped nodes are placed into the same slot space by position, so they
      // sit between the groups they belong near rather than always at one end.
      key: box.group ? (slotOf.get(box.group) ?? 0) : scaled(box, rank) * slots - 0.5,
    }));
    keyed.sort((a, b) => a.key - b.key || a.box.order - b.box.order);
    keyed.forEach(({ box }, index) => (box.order = index));
    rank.sort((a, b) => a.order - b.order);
  }
}

/* -------------------------------------------------- 4. cross positioning */

function assignCrossPositions(
  boxes: Box[],
  byId: Map<string, Box>,
  edges: FlowEdge[],
  hasGroups: boolean,
): void {
  const ranks = ranksOf(boxes);
  const neighbors = new Map<string, string[]>();
  for (const edge of edges) {
    (neighbors.get(edge.to) ?? neighbors.set(edge.to, []).get(edge.to)!).push(edge.from);
    (neighbors.get(edge.from) ?? neighbors.set(edge.from, []).get(edge.from)!).push(edge.to);
  }

  const gapBefore = (previous: Box | undefined, box: Box) =>
    previous && previous.group !== box.group ? CROSS_GAP + GROUP_GAP_EXTRA : CROSS_GAP;

  // Initial packing, measured on the cross axis of the chosen direction.
  const sizeOf = (box: Box) => box.crossExtent;
  for (const rank of ranks) {
    let cursor = 0;
    rank.forEach((box, index) => {
      const gap = index === 0 ? 0 : gapBefore(rank[index - 1], box);
      cursor += gap + sizeOf(box) / 2;
      box.cross = cursor;
      cursor += sizeOf(box) / 2;
    });
  }

  // Straighten: pull each node toward the mean of its neighbours, then restore
  // the minimum separation left-to-right and clamp back right-to-left.
  for (let pass = 0; pass < 6; pass += 1) {
    for (const rank of ranks) {
      const desired = rank.map((box) => {
        const linked = (neighbors.get(box.id) ?? [])
          .map((id) => byId.get(id))
          .filter((other): other is Box => other !== undefined && other.rank !== box.rank);
        if (linked.length === 0) return box.cross;
        return linked.reduce((sum, other) => sum + other.cross, 0) / linked.length;
      });

      rank.forEach((box, index) => {
        const previous = rank[index - 1];
        const minimum = previous
          ? previous.cross + sizeOf(previous) / 2 + gapBefore(previous, box) + sizeOf(box) / 2
          : sizeOf(box) / 2;
        box.cross = Math.max(desired[index], minimum);
      });
      for (let index = rank.length - 2; index >= 0; index -= 1) {
        const box = rank[index];
        const next = rank[index + 1];
        const maximum = next.cross - sizeOf(next) / 2 - gapBefore(box, next) - sizeOf(box) / 2;
        const previous = rank[index - 1];
        const minimum = previous
          ? previous.cross + sizeOf(previous) / 2 + gapBefore(previous, box) + sizeOf(box) / 2
          : sizeOf(box) / 2;
        box.cross = Math.max(minimum, Math.min(box.cross, maximum));
      }
    }
  }

  // Bands stop one subgraph's frame reaching across another's, but they cost
  // width: every group claims its own slice of the cross axis for the whole
  // drawing. Only pay that when the frames would actually collide.
  if (hasGroups && framesCollide(ranks, sizeOf)) {
    alignLanes(ranks, gapBefore, sizeOf);
    return;
  }

  // Centre every rank on the widest one so the diagram reads symmetrically.
  const extents = ranks.map((rank) =>
    rank.length === 0
      ? 0
      : Math.max(...rank.map((box) => box.cross + sizeOf(box) / 2)) -
        Math.min(...rank.map((box) => box.cross - sizeOf(box) / 2)),
  );
  const widest = Math.max(0, ...extents);
  ranks.forEach((rank, index) => {
    if (rank.length === 0) return;
    const start = Math.min(...rank.map((box) => box.cross - sizeOf(box) / 2));
    const shift = (widest - extents[index]) / 2 - start;
    rank.forEach((box) => (box.cross += shift));
  });
}

/** Do any two subgraph frames overlap on both the rank and the cross axis? */
function framesCollide(ranks: Box[][], sizeOf: (box: Box) => number): boolean {
  const frames = new Map<
    string,
    { low: number; high: number; first: number; last: number }
  >();
  ranks.forEach((rank, index) => {
    for (const box of rank) {
      if (!box.group) continue;
      const low = box.cross - sizeOf(box) / 2 - GROUP_STYLE.padding;
      const high = box.cross + sizeOf(box) / 2 + GROUP_STYLE.padding;
      const frame = frames.get(box.group);
      if (!frame) {
        frames.set(box.group, { low, high, first: index, last: index });
      } else {
        frame.low = Math.min(frame.low, low);
        frame.high = Math.max(frame.high, high);
        frame.first = Math.min(frame.first, index);
        frame.last = Math.max(frame.last, index);
      }
    }
  });

  const list = [...frames.values()];
  for (let a = 0; a < list.length; a += 1) {
    for (let b = a + 1; b < list.length; b += 1) {
      const overlapsRank = list[a].first <= list[b].last && list[b].first <= list[a].last;
      const overlapsCross = list[a].low < list[b].high && list[b].low < list[a].high;
      if (overlapsRank && overlapsCross) return true;
    }
  }
  return false;
}

/**
 * Reserve one cross-axis band per subgraph, shared by every rank.
 *
 * A group's frame is the bounding box of its members across all the ranks it
 * spans. Ranks hold different mixes of groups, so independently packed ranks let
 * a group drift sideways and its frame then swallows a neighbouring group. Fixed
 * bands remove the drift: members keep the relative positions the straightening
 * pass gave them and the block as a whole is centred in its band.
 *
 * Ungrouped nodes share a single band so they stay together rather than being
 * scattered between frames.
 */
function alignLanes(
  ranks: Box[][],
  gapBefore: (previous: Box | undefined, box: Box) => number,
  sizeOf: (box: Box) => number,
): void {
  const UNGROUPED = '\u0000free';
  const laneOf = (box: Box) => box.group ?? UNGROUPED;

  const centres = new Map<string, { total: number; count: number }>();
  for (const rank of ranks) {
    for (const box of rank) {
      const lane = laneOf(box);
      const entry = centres.get(lane) ?? { total: 0, count: 0 };
      entry.total += box.cross;
      entry.count += 1;
      centres.set(lane, entry);
    }
  }
  if (centres.size < 2) return;

  const order = [...centres]
    .map(([lane, { total, count }]) => ({ lane, mean: total / count }))
    .sort((a, b) => a.mean - b.mean)
    .map(({ lane }) => lane);

  // Widest span each lane needs in any single rank.
  const width = new Map<string, number>();
  for (const rank of ranks) {
    const perLane = new Map<string, Box[]>();
    for (const box of rank) {
      const lane = laneOf(box);
      (perLane.get(lane) ?? perLane.set(lane, []).get(lane)!).push(box);
    }
    for (const [lane, members] of perLane) {
      const low = Math.min(...members.map((box) => box.cross - sizeOf(box) / 2));
      const high = Math.max(...members.map((box) => box.cross + sizeOf(box) / 2));
      width.set(lane, Math.max(width.get(lane) ?? 0, high - low));
    }
  }

  const start = new Map<string, number>();
  let cursor = 0;
  for (const lane of order) {
    start.set(lane, cursor);
    cursor += (width.get(lane) ?? 0) + CROSS_GAP + GROUP_GAP_EXTRA;
  }

  for (const rank of ranks) {
    const perLane = new Map<string, Box[]>();
    for (const box of rank) {
      const lane = laneOf(box);
      (perLane.get(lane) ?? perLane.set(lane, []).get(lane)!).push(box);
    }
    for (const [lane, members] of perLane) {
      members.sort((a, b) => a.cross - b.cross);
      const low = Math.min(...members.map((box) => box.cross - sizeOf(box) / 2));
      const high = Math.max(...members.map((box) => box.cross + sizeOf(box) / 2));
      const band = width.get(lane) ?? high - low;
      const shift = (start.get(lane) ?? 0) + (band - (high - low)) / 2 - low;
      for (const box of members) box.cross += shift;
    }
    // Restore the minimum separation the shift may have eaten at a lane seam.
    for (let index = 1; index < rank.length; index += 1) {
      const previous = rank[index - 1];
      const box = rank[index];
      const minimum =
        previous.cross + sizeOf(previous) / 2 + gapBefore(previous, box) + sizeOf(box) / 2;
      if (box.cross < minimum) box.cross = minimum;
    }
  }
}

/* ------------------------------------------------------ 5. canvas mapping */

function mapToCanvas(boxes: Box[], direction: FlowchartSpec['direction']): void {
  const ranks = ranksOf(boxes);
  const rankCenters: number[] = [];
  let cursor = 0;
  ranks.forEach((rank, index) => {
    const extent = rank.length === 0 ? 0 : Math.max(...rank.map((box) => box.rankExtent));
    rankCenters[index] = cursor + extent / 2;
    cursor += extent + RANK_GAP;
  });
  const rankTotal = Math.max(0, cursor - RANK_GAP);

  for (const box of boxes) {
    const rankPos = rankCenters[box.rank];
    const flipped = rankTotal - rankPos;
    if (direction === 'TB') {
      box.cx = MARGIN + box.cross;
      box.cy = MARGIN + TITLE_SPACE + rankPos;
    } else if (direction === 'BT') {
      box.cx = MARGIN + box.cross;
      box.cy = MARGIN + TITLE_SPACE + flipped;
    } else if (direction === 'LR') {
      box.cx = MARGIN + rankPos;
      box.cy = MARGIN + TITLE_SPACE + box.cross;
    } else {
      box.cx = MARGIN + flipped;
      box.cy = MARGIN + TITLE_SPACE + box.cross;
    }
  }
}

/* ------------------------------------------------------------- 6. shapes */

function buildGroups(spec: FlowchartSpec, boxes: Box[]): SceneShape[] {
  return spec.groups
    .map((group): SceneShape | undefined => {
      const members = boxes.filter((box) => box.group === group.id);
      if (members.length === 0) return undefined;
      const left = Math.min(...members.map((box) => box.cx - box.w / 2)) - GROUP_STYLE.padding;
      const right = Math.max(...members.map((box) => box.cx + box.w / 2)) + GROUP_STYLE.padding;
      const top =
        Math.min(...members.map((box) => box.cy - box.h / 2)) -
        GROUP_STYLE.padding -
        GROUP_STYLE.headerHeight;
      const bottom = Math.max(...members.map((box) => box.cy + box.h / 2)) + GROUP_STYLE.padding;
      return {
        id: `group-${group.id}`,
        geom: 'group',
        x: left,
        y: top,
        w: right - left,
        h: bottom - top,
        label: group.label,
        labelLines: [group.label],
        fill: GROUP_STYLE.fill,
        stroke: GROUP_STYLE.stroke,
        fontColor: GROUP_STYLE.fontColor,
        fontSize: FONT_SIZE,
        bold: true,
        dashed: true,
        align: 'left',
        verticalAlign: 'top',
        headerHeight: GROUP_STYLE.headerHeight,
        drawioStyle: GROUP_STYLE.drawioStyle,
      };
    })
    .filter((shape): shape is SceneShape => shape !== undefined);
}

function buildNodeShape(spec: FlowchartSpec, box: Box, groups: SceneShape[]): SceneShape {
  const node = spec.nodes.find((candidate) => candidate.id === box.id)!;
  const parent = box.group
    ? groups.find((group) => group.id === `group-${box.group}`)?.id
    : undefined;
  const common = {
    id: box.id,
    x: box.cx - box.w / 2,
    y: box.cy - box.h / 2,
    w: box.w,
    h: box.h,
    label: box.label,
    labelLines: box.lines,
    parent,
    fontSize: FONT_SIZE,
  };

  const service = node.icon ? cloudService(node.icon) : undefined;
  if (service && box.tile) {
    // AWS sets its glyph on a category-coloured tile; Azure and Google draw the
    // glyph itself, so those get no tile and the glyph takes the brand tint.
    const tiled = service.provider === 'aws';
    // `fill` is what draw.io paints: the tile for AWS, the glyph itself for the
    // others. `fillColor=none` there would render an invisible icon.
    return {
      ...common,
      geom: 'cloudIcon',
      iconTile: tiled,
      fill: tiled ? AWS_CATEGORY_COLOR[service.category] : PROVIDER_TINT[service.provider],
      stroke: 'none',
      fontColor: PALETTE.ink,
      align: 'center',
      verticalAlign: 'top',
      headerHeight: box.tile,
      serviceName: service.name,
      shapeId: shapeId(service),
      tint: tiled ? '#ffffff' : PROVIDER_TINT[service.provider],
      drawioStyle: cloudIconStyle(service),
    };
  }

  const style = flowShapeStyle(node.shape);
  return {
    ...common,
    geom: style.geom,
    fill: style.fill,
    stroke: style.stroke,
    fontColor: style.fontColor,
    align: 'center',
    verticalAlign: 'middle',
    drawioStyle: style.drawioStyle,
  };
}

/* -------------------------------------------------------------- 7. edges */

interface Anchor {
  /** Absolute point the route starts or ends at. */
  point: ScenePoint;
  /** Position on the draw.io cell's own rectangle, 0..1 per axis. */
  fraction: ScenePoint;
  /** Pixel offset from that position to `point`, for draw.io's exitDx/exitDy. */
  delta: ScenePoint;
}

/**
 * `t` is the position along the face, 0..1. Edges sharing a face are given
 * distinct values so several connections leaving one node stay legible instead
 * of collapsing onto its midpoint.
 */
function faceAnchor(box: Box, side: 'top' | 'bottom' | 'left' | 'right', t = 0.5): Anchor {
  const half = { x: box.w / 2, y: box.h / 2 };
  const left = box.cx - half.x;
  const right = box.cx + half.x;
  const top = box.cy - half.y;
  const bottom = box.cy + half.y;

  if (box.tile) {
    // The draw.io cell is only the square tile; the label hangs below it. Routes
    // still run to the edge of the whole footprint so an arrow never crosses the
    // label, and the offset from tile to footprint travels as exitDx/exitDy.
    const tile = box.tile;
    const tx = box.cx - tile / 2;
    const ty = top;
    switch (side) {
      case 'top':
        return { point: { x: tx + tile * t, y: ty }, fraction: { x: t, y: 0 }, delta: ZERO };
      case 'bottom':
        return {
          point: { x: tx + tile * t, y: bottom },
          fraction: { x: t, y: 1 },
          delta: { x: 0, y: bottom - (ty + tile) },
        };
      case 'left':
        return {
          point: { x: left, y: ty + tile * t },
          fraction: { x: 0, y: t },
          delta: { x: left - tx, y: 0 },
        };
      default:
        return {
          point: { x: right, y: ty + tile * t },
          fraction: { x: 1, y: t },
          delta: { x: right - (tx + tile), y: 0 },
        };
    }
  }

  const alongX = left + box.w * t;
  const alongY = top + box.h * t;
  switch (side) {
    case 'top':
      return { point: { x: alongX, y: top }, fraction: { x: t, y: 0 }, delta: ZERO };
    case 'bottom':
      return { point: { x: alongX, y: bottom }, fraction: { x: t, y: 1 }, delta: ZERO };
    case 'left':
      return { point: { x: left, y: alongY }, fraction: { x: 0, y: t }, delta: ZERO };
    default:
      return { point: { x: right, y: alongY }, fraction: { x: 1, y: t }, delta: ZERO };
  }
}

const ZERO: ScenePoint = { x: 0, y: 0 };

/**
 * Distribute each node's forward edges evenly across the face they share,
 * ordered by where the far end sits so the connections do not cross each other
 * on the way out.
 */
function spreadAnchors(
  edges: FlowEdge[],
  byId: Map<string, Box>,
  direction: FlowchartSpec['direction'],
  end: 'from' | 'to',
): Map<FlowEdge, number> {
  const vertical = direction === 'TB' || direction === 'BT';
  const grouped = new Map<string, FlowEdge[]>();
  for (const edge of edges) {
    const key = edge[end];
    (grouped.get(key) ?? grouped.set(key, []).get(key)!).push(edge);
  }

  const anchors = new Map<FlowEdge, number>();
  for (const [, list] of grouped) {
    if (list.length === 1) {
      anchors.set(list[0], 0.5);
      continue;
    }
    const far = end === 'from' ? 'to' : 'from';
    const sorted = [...list].sort((a, b) => {
      const boxA = byId.get(a[far])!;
      const boxB = byId.get(b[far])!;
      return vertical ? boxA.cross - boxB.cross : boxA.cross - boxB.cross;
    });
    // Keep anchors inside the middle 70% of the face so arrowheads stay clear
    // of the corners.
    sorted.forEach((edge, index) => {
      anchors.set(edge, 0.15 + (0.7 * (index + 0.5)) / sorted.length);
    });
  }
  return anchors;
}

const FORWARD_FACE: Record<FlowchartSpec['direction'], 'top' | 'bottom' | 'left' | 'right'> = {
  TB: 'bottom',
  BT: 'top',
  LR: 'right',
  RL: 'left',
};
const BACKWARD_FACE: Record<FlowchartSpec['direction'], 'top' | 'bottom' | 'left' | 'right'> = {
  TB: 'top',
  BT: 'bottom',
  LR: 'left',
  RL: 'right',
};

function routeEdge(
  edge: FlowEdge,
  source: Box,
  target: Box,
  direction: FlowchartSpec['direction'],
  index: number,
  backIndex: number,
  exitAt: number,
  entryAt: number,
): SceneEdge {
  const vertical = direction === 'TB' || direction === 'BT';
  let from: Anchor;
  let to: Anchor;
  let route: ScenePoint[];

  if (backIndex >= 0) {
    // Return path: leave through a side face, travel in a reserved channel, and
    // re-enter the target through the matching side face.
    const goRight = source.cx + target.cx >= 0 && (vertical ? source.cx >= target.cx : true);
    const sideA = vertical ? (goRight ? 'right' : 'left') : 'bottom';
    const sideB = vertical ? (goRight ? 'right' : 'left') : 'bottom';
    from = faceAnchor(source, sideA);
    to = faceAnchor(target, sideB);
    const offset = 42 + backIndex * 18;
    if (vertical) {
      const channel = goRight
        ? Math.max(from.point.x, to.point.x) + offset
        : Math.min(from.point.x, to.point.x) - offset;
      route = [
        from.point,
        { x: channel, y: from.point.y },
        { x: channel, y: to.point.y },
        to.point,
      ];
    } else {
      const channel = Math.max(from.point.y, to.point.y) + offset;
      route = [
        from.point,
        { x: from.point.x, y: channel },
        { x: to.point.x, y: channel },
        to.point,
      ];
    }
  } else if (source.rank === target.rank) {
    const forwardSide = vertical
      ? source.cx <= target.cx
        ? 'right'
        : 'left'
      : source.cy <= target.cy
        ? 'bottom'
        : 'top';
    const oppositeSide = vertical
      ? forwardSide === 'right'
        ? 'left'
        : 'right'
      : forwardSide === 'bottom'
        ? 'top'
        : 'bottom';
    from = faceAnchor(source, forwardSide);
    to = faceAnchor(target, oppositeSide);
    route = [from.point, to.point];
  } else {
    from = faceAnchor(source, FORWARD_FACE[direction], exitAt);
    to = faceAnchor(target, BACKWARD_FACE[direction], entryAt);
    const aligned = vertical
      ? Math.abs(from.point.x - to.point.x) < 1
      : Math.abs(from.point.y - to.point.y) < 1;
    if (aligned) {
      route = [from.point, to.point];
    } else if (vertical) {
      const midY = (from.point.y + to.point.y) / 2;
      route = [
        from.point,
        { x: from.point.x, y: midY },
        { x: to.point.x, y: midY },
        to.point,
      ];
    } else {
      const midX = (from.point.x + to.point.x) / 2;
      route = [
        from.point,
        { x: midX, y: from.point.y },
        { x: midX, y: to.point.y },
        to.point,
      ];
    }
  }

  const decoration = edgeLineDecoration(edge.line);
  const endArrow: ArrowHead = edge.arrow;
  return {
    id: `edge-${index}`,
    source: source.id,
    target: target.id,
    label: edge.label,
    route,
    labelAt: labelPointFor(route),
    stroke: PALETTE.edge,
    dashed: decoration.dashed,
    thick: decoration.thick,
    startArrow: 'none',
    endArrow,
    drawioStyle:
      'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;' +
      `exitX=${from.fraction.x};exitY=${from.fraction.y};` +
      `exitDx=${Math.round(from.delta.x)};exitDy=${Math.round(from.delta.y)};` +
      `entryX=${to.fraction.x};entryY=${to.fraction.y};` +
      `entryDx=${Math.round(to.delta.x)};entryDy=${Math.round(to.delta.y)};` +
      drawioEndArrow(endArrow) +
      drawioStartArrow('none'),
  };
}

function routeSelfEdge(edge: FlowEdge, box: Box, index: number): SceneEdge {
  const right = box.cx + box.w / 2;
  const top = box.cy - box.h / 2;
  const channel = right + 44;
  const route: ScenePoint[] = [
    { x: right, y: box.cy },
    { x: channel, y: box.cy },
    { x: channel, y: top - 26 },
    { x: box.cx, y: top - 26 },
    { x: box.cx, y: top },
  ];
  const decoration = edgeLineDecoration(edge.line);
  return {
    id: `self-${index}`,
    source: box.id,
    target: box.id,
    label: edge.label,
    route,
    labelAt: { x: channel + 8, y: (box.cy + top - 26) / 2 },
    stroke: PALETTE.edge,
    dashed: decoration.dashed,
    thick: decoration.thick,
    startArrow: 'none',
    endArrow: edge.arrow,
    drawioStyle:
      'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;' +
      'exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;' +
      drawioEndArrow(edge.arrow) +
      drawioStartArrow('none'),
  };
}
