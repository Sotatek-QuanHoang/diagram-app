/**
 * On-demand registry for cloud provider glyphs.
 *
 * The three provider modules hold roughly 220 KB of path data between them —
 * far more than the rest of the app — while a given diagram draws at most one
 * cloud, and most diagrams draw none. Importing them statically made every
 * surface pay for all three before it could render anything, so each provider
 * sits behind a dynamic import and arrives only once a scene actually
 * references it.
 *
 * Drawing stays synchronous: `sceneToSvg` reads whatever is resolved at the
 * moment it runs, and a shape whose glyph has not arrived falls back to its
 * service name. Callers await `loadProvidersForScene` and redraw, so the first
 * frame is a readable diagram rather than a blank one.
 */

import type { Scene } from '../../backend/diagram/types.js';
import type { CloudGlyph } from './types.js';

export type { CloudGlyph, GlyphPath } from './types.js';

export type CloudProvider = 'aws' | 'azure' | 'gcp';

/**
 * draw.io stencil set prefixes. The shape id the backend emits carries its set,
 * so the provider is derived from the scene itself — nothing has to be threaded
 * through the layout to say which cloud a diagram uses.
 */
const PROVIDER_PREFIXES: ReadonlyArray<readonly [CloudProvider, string]> = [
  ['aws', 'mxgraph.aws4.'],
  ['azure', 'mxgraph.mscae.cloud.'],
  ['gcp', 'mxgraph.gcp2.'],
];

const resolved = new Map<CloudProvider, Record<string, CloudGlyph>>();
const pending = new Map<CloudProvider, Promise<void>>();

export function providerForShape(shapeId: string): CloudProvider | undefined {
  for (const [provider, prefix] of PROVIDER_PREFIXES) {
    if (shapeId.startsWith(prefix)) return provider;
  }
  return undefined;
}

/** The glyph for a shape id, or undefined if its provider is not loaded yet. */
export function glyphFor(shapeId: string): CloudGlyph | undefined {
  const provider = providerForShape(shapeId);
  return provider ? resolved.get(provider)?.[shapeId] : undefined;
}

/** Which providers one scene draws. Empty for every non-cloud diagram. */
export function providersInScene(scene: Scene): CloudProvider[] {
  const found = new Set<CloudProvider>();
  for (const shape of scene.shapes) {
    const provider = shape.shapeId ? providerForShape(shape.shapeId) : undefined;
    if (provider) found.add(provider);
  }
  return [...found];
}

/**
 * Literal specifiers, one per provider: the bundler has to see each import site
 * statically to emit a chunk for it. A computed `import(\`./${provider}.js\`)`
 * would still work at runtime but bundles all three together.
 */
function importProvider(provider: CloudProvider): Promise<{ GLYPHS: Record<string, CloudGlyph> }> {
  switch (provider) {
    case 'aws':
      return import('./aws.js');
    case 'azure':
      return import('./azure.js');
    case 'gcp':
      return import('./gcp.js');
  }
}

function loadProvider(provider: CloudProvider): Promise<void> {
  const already = pending.get(provider);
  if (already) return already;

  const load = importProvider(provider)
    .then((module) => {
      resolved.set(provider, module.GLYPHS);
    })
    .catch((error: unknown) => {
      // A chunk that fails to arrive costs icons, not the diagram: every shape
      // falls back to its service name. Drop the memo so a later render can
      // retry rather than caching the failure for the life of the page.
      pending.delete(provider);
      console.warn(`diagram-app: could not load ${provider} glyphs`, error);
    });

  pending.set(provider, load);
  return load;
}

/**
 * Resolve every provider a scene needs. Returns synchronously-settled work when
 * there is nothing to fetch, so non-cloud diagrams never wait on a microtask
 * chain or trigger a second render.
 */
export async function loadProvidersForScene(scene: Scene): Promise<void> {
  const needed = providersInScene(scene).filter((provider) => !resolved.has(provider));
  if (needed.length === 0) return;
  await Promise.all(needed.map(loadProvider));
}

/** True when nothing in the scene is still waiting on a chunk. */
export function sceneGlyphsReady(scene: Scene): boolean {
  return providersInScene(scene).every((provider) => resolved.has(provider));
}
