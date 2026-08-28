/**
 * Label measurement.
 *
 * draw.io lays text out with the browser's font metrics, which the backend does
 * not have. These approximations only need to be good enough that a box is never
 * visibly too small for its label, so the per-character table is deliberately
 * coarse and biased slightly wide.
 */

const NARROW = new Set([...'ijlt!.,;:\'"|()[]{}/\\`']);
const WIDE = new Set([...'mwMW@%']);
const UPPER_EXTRA = 0.08;

/** Width of one line of text in pixels at the given font size. */
export function measureLine(text: string, fontSize: number, bold = false): number {
  let units = 0;
  for (const char of text) {
    if (NARROW.has(char)) units += 0.32;
    else if (WIDE.has(char)) units += 0.92;
    else if (char === ' ') units += 0.28;
    else if (char >= 'A' && char <= 'Z') units += 0.62 + UPPER_EXTRA;
    else if (char >= '0' && char <= '9') units += 0.56;
    else units += 0.55;
  }
  return units * fontSize * (bold ? 1.06 : 1);
}

export interface WrappedLabel {
  lines: string[];
  width: number;
  height: number;
}

/**
 * Greedy word wrap. Honors explicit newlines first, then breaks on spaces, then
 * hard-splits any single word still wider than `maxWidth`.
 */
export function wrapLabel(
  text: string,
  fontSize: number,
  maxWidth: number,
  bold = false,
): WrappedLabel {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = current === '' ? word : `${current} ${word}`;
      if (measureLine(candidate, fontSize, bold) <= maxWidth || current === '') {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
      while (measureLine(current, fontSize, bold) > maxWidth && current.length > 1) {
        let cut = current.length - 1;
        while (cut > 1 && measureLine(current.slice(0, cut), fontSize, bold) > maxWidth) cut -= 1;
        lines.push(current.slice(0, cut));
        current = current.slice(cut);
      }
    }
    if (current !== '') lines.push(current);
  }
  if (lines.length === 0) lines.push('');
  return {
    lines,
    width: Math.max(...lines.map((line) => measureLine(line, fontSize, bold))),
    height: lines.length * Math.round(fontSize * 1.35),
  };
}

/** Round up to a 10px grid so draw.io's own snapping leaves geometry untouched. */
export function snap(value: number, grid = 10): number {
  return Math.ceil(value / grid) * grid;
}
