import type { Font } from "../font/font";
import { ringsOf } from "../paths";
import type { Box, TextLine } from "./ir";

/** How lines sit in their column: from the start, around the middle, or to the end. */
export type TextAlign = "start" | "center" | "end";

export interface TextLayoutOptions {
  /** Font size in px. */
  readonly size: number;
  /** Wrap lines to this many px. Without it a line breaks only where the text has a line break. */
  readonly width?: number;
  /** Baseline to baseline, in multiples of `size`. Default: the font's own, its ascent, descent and line gap. */
  readonly lineHeight?: number;
  readonly align?: TextAlign;
}

export interface TextLayout {
  readonly lines: readonly TextLine[];
  /** What the text covers, from the top of its first line to the bottom of its last. */
  readonly box: Box;
}

const SHARE: Readonly<Record<TextAlign, number>> = { start: 0, center: 0.5, end: 1 };

/** A word too wide for the line, cut into pieces that fit: the last piece starts the next line. */
const cut = (word: string, fits: (text: string) => boolean): string[] => {
  const pieces: string[] = [];
  let piece = "";

  for (const char of word) {
    if (piece !== "" && !fits(piece + char)) {
      pieces.push(piece);
      piece = "";
    }

    piece += char;
  }

  return [...pieces, piece];
};

/** One paragraph broken greedily at spaces so every line fits `width`. Spaces at a break are dropped. */
const wrap = (paragraph: string, fits: (text: string) => boolean): string[] => {
  const lines: string[] = [];
  let line = "";

  for (const token of paragraph.split(/(\s+)/)) {
    if (token === "") continue;
    const blank = /^\s+$/.test(token);

    if (fits(line + token)) {
      line += token;
      continue;
    }

    if (blank) {
      lines.push(line);
      line = "";
      continue;
    }

    if (line.trim() !== "") lines.push(line.trimEnd());
    const pieces = cut(token, fits);

    lines.push(...pieces.slice(0, -1));
    line = pieces.at(-1)!;
  }

  return [...lines, line.trimEnd()];
};

/**
 * Text laid out at compile time: broken into lines at line breaks and, with a `width`, wherever the next word would
 * not fit; each line measured with the font, aligned, and placed on its baseline. The frame's origin is on the first
 * line's baseline: `align` says which point of it, the start, the middle or the end of the column. A column is
 * `width` wide when there is one, else as wide as the widest line.
 */
export const layoutText = (
  face: Font,
  text: string,
  { size, width, lineHeight, align = "start" }: TextLayoutOptions,
  where: string,
): TextLayout => {
  if (!(size > 0 && Number.isFinite(size)))
    throw new Error(`Text ${where} needs a positive size, got ${size}.`);

  if (width !== undefined && !(width > 0 && Number.isFinite(width)))
    throw new Error(`Text ${where} needs a positive width to wrap to, got ${width}.`);

  if (lineHeight !== undefined && !(lineHeight > 0 && Number.isFinite(lineHeight)))
    throw new Error(`Text ${where} needs a positive lineHeight, got ${lineHeight}.`);
  const share = SHARE[align];

  if (share === undefined)
    throw new Error(
      `Text ${where} takes align "start", "center" or "end", got "${String(align)}".`,
    );
  const { ascent, descent, lineGap } = face.metrics;
  const step = (lineHeight ?? ascent + descent + lineGap) * size;
  const fits = (line: string): boolean => width === undefined || face.measure(line, size) <= width;
  const broken = text.split(/\r?\n/).flatMap((paragraph) => wrap(paragraph, fits));
  const measured = broken.map((line) => face.measure(line, size));
  const column = width ?? Math.max(0, ...measured);
  const left = -column * share;

  const lines = broken.map((line, index): TextLine => {
    const x = left + (column - measured[index]!) * share;
    const y = index * step;

    const outlined = (() => {
      try {
        return face.path(line, { size, x, y });
      } catch {
        return undefined;
      }
    })();

    return {
      text: line,
      at: [x, y],
      advances: outlined
        ? outlined.glyphs.map((glyph) => glyph.advance)
        : face.advances(line, size),
      ...(outlined && { outline: ringsOf(outlined.d) }),
    };
  });

  return {
    lines,
    box: {
      x: left,
      y: -ascent * size,
      width: column,
      height: (lines.length - 1) * step + (ascent + descent) * size,
    },
  };
};
