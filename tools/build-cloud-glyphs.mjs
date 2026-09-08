/**
 * Extract the cloud-provider glyphs used by `src/backend/diagram/clouds.ts`
 * from draw.io's published stencil sets into `src/ui/cloud-glyphs/<provider>.ts`
 * — one module per provider, each loaded on demand by `cloud-glyphs/index.ts`.
 *
 * The inline preview cannot reference draw.io's shape library the way a
 * generated .drawio file can, so the paths for our catalog — and only our
 * catalog — are converted to SVG and checked in.
 *
 *   node tools/build-cloud-glyphs.mjs <dir-with-stencils>
 *
 * Expects these files, fetched from
 * https://github.com/jgraph/drawio/tree/dev/src/main/webapp/stencils :
 *   aws4.xml   mscae/cloud.xml   gcp2.xml
 *
 * AWS glyphs are monochrome and painted with the tile's colour. Azure is
 * monochrome and painted in the provider tint. GCP stencils carry their own
 * `<fillcolor>` runs, so those colours are preserved per sub-path.
 *
 * These are the providers' official architecture icons as redistributed by
 * draw.io; check each provider's icon terms before distributing this app.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node tools/build-cloud-glyphs.mjs <dir-with-stencils>');
  process.exit(1);
}

const SETS = {
  'mxgraph.aws4': 'aws4.xml',
  'mxgraph.mscae.cloud': join('mscae', 'cloud.xml'),
  'mxgraph.gcp2': 'gcp2.xml',
};

const sources = Object.fromEntries(
  Object.entries(SETS).map(([set, file]) => [set, readFileSync(join(dir, file), 'utf8')]),
);

const catalog = readFileSync('src/backend/diagram/clouds.ts', 'utf8');
// `set: 'mxgraph.gcp2', shape: 'Cloud Run'` — the two fields identify one glyph.
const wanted = [...catalog.matchAll(/set:\s*'([^']+)',\s*shape:\s*'([^']+)'/g)].map((m) => ({
  set: m[1],
  shape: m[2],
}));

const num = (value) => String(Math.round(Number(value) * 100) / 100);

/**
 * Walk one stencil's foreground, emitting a sub-path each time the stencil
 * paints. `<fillcolor>` runs and `save`/`restore` are tracked so multi-colour
 * icons keep their colours; monochrome sets emit a single uncoloured path.
 */
function extract(shapeXml) {
  const inner = shapeXml.replace(/^[\s\S]*?<foreground>/, '').replace(/<\/foreground>[\s\S]*$/, '');
  const tokens = inner.matchAll(
    /<(move|line|curve|arc|close|fill|fillstroke|stroke|fillcolor|save|restore|path)\b([^>]*?)\/?>/g,
  );

  const paths = [];
  const stack = [];
  let fill;
  let current = [];

  for (const [, kind, attrText] of tokens) {
    const a = Object.fromEntries(
      [...attrText.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]),
    );
    switch (kind) {
      case 'save':
        stack.push(fill);
        break;
      case 'restore':
        fill = stack.pop();
        break;
      case 'fillcolor': {
        // `color` may name a style variable; `default` carries the real value.
        const value = /^#/.test(a.color ?? '') ? a.color : a.default;
        if (value) fill = value.toLowerCase();
        break;
      }
      case 'path':
        current = [];
        break;
      case 'move':
        current.push(`M${num(a.x)} ${num(a.y)}`);
        break;
      case 'line':
        current.push(`L${num(a.x)} ${num(a.y)}`);
        break;
      case 'curve':
        current.push(
          `C${num(a.x1)} ${num(a.y1)} ${num(a.x2)} ${num(a.y2)} ${num(a.x3)} ${num(a.y3)}`,
        );
        break;
      case 'arc':
        current.push(
          `A${num(a.rx)} ${num(a.ry)} ${num(a['x-axis-rotation'])} ` +
            `${a['large-arc-flag']} ${a['sweep-flag']} ${num(a.x)} ${num(a.y)}`,
        );
        break;
      case 'close':
        current.push('Z');
        break;
      case 'fill':
      case 'fillstroke':
      case 'stroke': {
        // `stroke` alone would need outline geometry we do not model; filling it
        // reads correctly for these icons and avoids dropping the sub-path.
        if (current.length > 0) paths.push({ d: current.join(''), fill });
        current = [];
        break;
      }
      default:
        break;
    }
  }
  if (current.length > 0) paths.push({ d: current.join(''), fill });
  return paths;
}

const glyphs = [];
const missing = [];
for (const { set, shape } of wanted) {
  const raw = sources[set];
  if (!raw) {
    missing.push(`${set} (no stencil file)`);
    continue;
  }
  const escaped = shape.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = raw.match(new RegExp(`<shape\\b[^>]*name="${escaped}"[^>]*>[\\s\\S]*?</shape>`));
  if (!match) {
    missing.push(`${set}.${shape}`);
    continue;
  }
  const w = Number(/\bw="([\d.]+)"/.exec(match[0])?.[1] ?? 0);
  const h = Number(/\bh="([\d.]+)"/.exec(match[0])?.[1] ?? 0);
  const paths = extract(match[0]);
  if (!w || !h || paths.length === 0) {
    missing.push(`${set}.${shape} (empty)`);
    continue;
  }
  // draw.io ids lowercase the name and replace spaces with underscores.
  const id = `${set}.${shape.toLowerCase().replace(/ /g, '_')}`;
  glyphs.push({ id, w, h, paths });
}

if (missing.length > 0) {
  console.error(`could not extract:\n  ${missing.join('\n  ')}`);
  process.exit(1);
}

/** Which module each stencil set is written into, and how it is painted. */
const PROVIDERS = {
  'mxgraph.aws4': {
    file: 'aws',
    label: 'AWS',
    note:
      "Monochrome; every path takes the caller's colour and is painted white\n" +
      ' * on the category tile.',
  },
  'mxgraph.mscae.cloud': {
    file: 'azure',
    label: 'Azure',
    note:
      "Monochrome; every path takes the caller's colour and is painted in the\n" +
      ' * Azure brand tint.',
  },
  'mxgraph.gcp2': {
    file: 'gcp',
    label: 'Google Cloud',
    note:
      'Multi-colour; paths carry the `fill` values from the stencil and ignore\n' +
      " * the caller's colour.",
  },
};

const setForId = (id) =>
  Object.keys(PROVIDERS).find((set) => id.startsWith(`${set}.`));

/**
 * One module per provider rather than one shared table.
 *
 * The three sets together are the largest thing in the UI bundle by a wide
 * margin, while a diagram draws at most one cloud. `src/ui/cloud-glyphs/index.ts`
 * imports these dynamically so each becomes its own chunk, fetched only when a
 * scene references that provider. `types.ts` and `index.ts` are hand-written and
 * are never rewritten here.
 */
const written = [];
for (const [set, { file, label, note }] of Object.entries(PROVIDERS)) {
  const mine = glyphs.filter((g) => setForId(g.id) === set);
  const body = mine
    .map((g) => {
      const paths = g.paths
        .map((p) => `{ d: '${p.d}'${p.fill ? `, fill: '${p.fill}'` : ''} }`)
        .join(', ');
      return `  '${g.id}': { w: ${g.w}, h: ${g.h}, paths: [${paths}] },`;
    })
    .join('\n');

  const out = `/**
 * ${label} glyphs for the inline preview.
 *
 * GENERATED by tools/build-cloud-glyphs.mjs — do not edit by hand.
 *
 * ${note}
 *
 * Split per provider so a page pays only for the clouds its diagram draws:
 * this module is reached through a dynamic import in \`./index.ts\` and becomes
 * its own chunk. Import it directly and that saving is lost.
 *
 * These are the provider's official architecture icons. Check their icon terms
 * before distributing this app outside your organisation.
 */

import type { CloudGlyph } from './types.js';

export const GLYPHS: Record<string, CloudGlyph> = {
${body}
};
`;

  const path = `src/ui/cloud-glyphs/${file}.ts`;
  writeFileSync(path, out);
  written.push(`${path} (${mine.length} glyphs, ${(out.length / 1024).toFixed(1)} KB)`);
}

const orphans = glyphs.filter((g) => !setForId(g.id));
if (orphans.length > 0) {
  console.error(
    `no provider module for:\n  ${orphans.map((g) => g.id).join('\n  ')}\n` +
      'Add the set to PROVIDERS and give it a chunk in src/ui/cloud-glyphs/index.ts.',
  );
  process.exit(1);
}

const coloured = glyphs.filter((g) => g.paths.some((p) => p.fill)).length;
console.log(
  `extracted ${glyphs.length} glyphs (${coloured} multi-colour) ->\n  ${written.join('\n  ')}`,
);
