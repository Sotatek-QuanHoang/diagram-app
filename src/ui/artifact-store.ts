/**
 * Hand-off between the tool result and the side panel.
 *
 * `ui.openArtifact(kind, context)` takes a context object, but the artifact
 * surface's prop shape is not pinned by the published contract and the context
 * did not arrive in any of the shapes the surface tried. Both surfaces are
 * components in one app bundle, so they share this module instance: the opener
 * leaves the diagram here and the panel collects it.
 *
 * The context is still passed to `openArtifact` as well — if the host does
 * forward it, the panel prefers that and this store is never consulted.
 */

import type { DiagramResult } from './types.js';

/** Bounded so a long session cannot accumulate diagrams indefinitely. */
const LIMIT = 12;

const byToken = new Map<string, DiagramResult>();
let latest: string | undefined;
let counter = 0;

/** Store a diagram for the panel and return the token identifying it. */
export function rememberDiagram(result: DiagramResult): string {
  counter += 1;
  const token = `dg-${counter}`;
  byToken.set(token, result);
  latest = token;
  while (byToken.size > LIMIT) {
    const oldest = byToken.keys().next().value;
    if (oldest === undefined) break;
    byToken.delete(oldest);
  }
  return token;
}

/**
 * Recall a diagram by token, falling back to the most recently opened one.
 * The fallback is what carries the feature when no context reaches the panel.
 */
export function recallDiagram(token?: string): DiagramResult | undefined {
  if (token !== undefined) {
    const found = byToken.get(token);
    if (found) return found;
  }
  return latest === undefined ? undefined : byToken.get(latest);
}

/** True when the value carries the fields the renderer needs. */
export function isDiagramResult(value: unknown): value is DiagramResult {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as { kind?: unknown; preview?: { shapes?: unknown } };
  return typeof candidate.kind === 'string' && Array.isArray(candidate.preview?.shapes);
}

/**
 * Search a host-supplied props object for a diagram, wherever it nested it.
 * Breadth-first and bounded, so an unexpected shape cannot cost a deep walk.
 */
export function findDiagram(root: unknown, maxNodes = 200): DiagramResult | undefined {
  const queue: unknown[] = [root];
  const seen = new Set<unknown>();
  let visited = 0;

  while (queue.length > 0 && visited < maxNodes) {
    const value = queue.shift();
    if (value === null || typeof value !== 'object') continue;
    if (seen.has(value)) continue;
    seen.add(value);
    visited += 1;
    if (isDiagramResult(value)) return value;
    for (const child of Object.values(value as Record<string, unknown>)) {
      if (child !== null && typeof child === 'object') queue.push(child);
    }
  }
  return undefined;
}

/** First string that looks like one of our tokens, at any depth. */
export function findToken(root: unknown, maxNodes = 200): string | undefined {
  const queue: unknown[] = [root];
  const seen = new Set<unknown>();
  let visited = 0;

  while (queue.length > 0 && visited < maxNodes) {
    const value = queue.shift();
    if (value === null || typeof value !== 'object') continue;
    if (seen.has(value)) continue;
    seen.add(value);
    visited += 1;
    for (const child of Object.values(value as Record<string, unknown>)) {
      if (typeof child === 'string' && /^dg-\d+$/.test(child)) return child;
      if (child !== null && typeof child === 'object') queue.push(child);
    }
  }
  return undefined;
}

/** Compact description of an unexpected props shape, for the panel to show. */
export function describeShape(value: unknown, depth = 0): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array(${value.length})`;
  const type = typeof value;
  if (type !== 'object') return type === 'string' ? `"${String(value).slice(0, 24)}"` : type;
  if (depth >= 2) return 'object';
  const entries = Object.entries(value as Record<string, unknown>).slice(0, 8);
  if (entries.length === 0) return '{}';
  return `{ ${entries.map(([k, v]) => `${k}: ${describeShape(v, depth + 1)}`).join(', ')} }`;
}
