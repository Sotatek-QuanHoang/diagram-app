/**
 * The wire shape of the diagram API, mirroring
 * `src/schemas/generate-diagram-output.schema.json`.
 *
 * `Scene` is imported as a type only, so the UI bundle carries no backend code —
 * it just avoids a second, drifting definition of the geometry both sides agree
 * on.
 */

import type { Scene } from '../backend/diagram/types.js';

export type { Scene };

export type StudioMode = 'mermaid' | 'spec';

export interface GenerateInput {
  title?: string;
  fileName?: string;
  mermaid?: string;
  spec?: unknown;
}

export interface DiagramResult {
  ok: true;
  kind: 'flowchart' | 'sequence' | 'erd';
  title: string;
  fileName: string;
  mimeType: string;
  /** Geometry; the .drawio file is built from this in the browser. */
  preview: Scene;
  stats: { nodes: number; edges: number; groups: number };
  warnings: string[];
  summary: string;
}
