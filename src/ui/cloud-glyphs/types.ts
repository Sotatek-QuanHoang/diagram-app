/**
 * Shapes shared by the per-provider glyph modules and their loader.
 *
 * Kept in its own module so `./index.ts` can describe a glyph without importing
 * any provider's data — a value import here would pull all three chunks back
 * into the entry bundle and undo the split.
 */

export interface GlyphPath {
  d: string;
  /** Stencil-supplied colour; absent means "use the caller's colour". */
  fill?: string;
}

export interface CloudGlyph {
  w: number;
  h: number;
  paths: GlyphPath[];
}
