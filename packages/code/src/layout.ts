import type { Vec } from "svjeez";
import { SceneError, type Font, type FontFamily, type FontValue } from "svjeez/tools";
import { sourceLines } from "./highlight.ts";

/** What sets where code's characters land: the same props `<Code>` takes, and where it is placed. */
export interface CodeStyle {
  readonly font: FontValue;
  readonly size: number;
  readonly lineHeight?: number;
  readonly tabSize?: number;
  /** Where `anchor` of the block lands, so the boxes come out in the coordinates `<Code>` is placed in. Default [0, 0]. */
  readonly at?: Vec;
  /** The point of the block's `bounds` that `at` names, as fractions of its width and height: [0.5, 0] centers it on `at` horizontally. Default [0, 0], the top-left. */
  readonly anchor?: readonly [number, number];
}

/** A character range's cell: `at` is its top-left corner, `size` its width and height. */
export interface CodeBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly at: Vec;
  readonly size: Vec;
  readonly center: Vec;
}

/** Where code's characters are, with lines and columns counted from 0 like string indices. */
export interface CodeLayout {
  /** The source's lines, tabs expanded, as `<Code>` draws them. */
  readonly lines: readonly string[];
  /** The block's top-left corner once `anchor` is applied: give it to `<Code>` as `at`. */
  readonly origin: Vec;
  /** The whole block: its widest line by every line's cell, at `origin`. */
  readonly bounds: CodeBox;
  /** The top-left corner of column `col`'s cell on `line`. */
  point(line: number, col?: number): Vec;
  /** The cells of columns `from` up to (not including) `to` on `line`; the whole line by default. */
  box(line: number, from?: number, to?: number): CodeBox;
  /** The cells of the `occurrence`-th (from 0) place `text` appears in the source, on one line. */
  find(text: string, occurrence?: number): CodeBox;
}

const isFamily = (font: FontValue): font is FontFamily => "faces" in font;

export const faceOf = (font: FontValue): Font => (isFamily(font) ? font.face() : font);

const boxOf = (x: number, y: number, width: number, height: number): CodeBox => ({
  x,
  y,
  width,
  height,
  at: [x, y],
  size: [width, height],
  center: [x + width / 2, y + height / 2],
});

/**
 * Lays out `source` the way `<Code>` with this style does, so a highlight, a cursor or an arrow lands on a character range
 * with the font's real advances. Each line's cell is `lineHeight` × `size` tall, centered on its text, so cells tile with no gap.
 */
export const codeLayout = (
  { font, size, lineHeight = 1.5, tabSize = 2, at = [0, 0], anchor = [0, 0] }: CodeStyle,
  source: string,
): CodeLayout => {
  const lines = sourceLines(source, tabSize);
  const face = faceOf(font);
  const { ascent, descent } = face.metrics;
  const pitch = lineHeight * size;
  const width = Math.max(0, ...lines.map((text) => face.measure(text, size)));
  const height = lines.length * pitch;
  const left = at[0] - anchor[0] * width;
  const top = at[1] - anchor[1] * height;
  const lift = ((ascent + descent) * size - pitch) / 2;

  const checked = (line: number, col: number, where: string): string => {
    const text = lines[line];

    if (text === undefined || !Number.isInteger(line))
      throw new SceneError(
        `${where} asks for line ${line}, but the code has lines 0 to ${lines.length - 1}.`,
        "Lines count from 0, like string indices.",
      );

    if (!Number.isInteger(col) || col < 0 || col > text.length)
      throw new SceneError(
        `${where} asks for column ${col} of line ${line}, which has columns 0 to ${text.length}.`,
        "Columns count from 0, like string indices, after tabs become spaces.",
      );

    return text;
  };

  const point = (line: number, col = 0): Vec => {
    const text = checked(line, col, "point()");

    return [left + face.measure(text.slice(0, col), size), top + line * pitch + lift];
  };

  const box = (line: number, from = 0, to?: number): CodeBox => {
    const end = to ?? lines[line]?.length ?? 0;

    checked(line, from, "box()");
    const text = checked(line, end, "box()");

    if (end < from)
      throw new SceneError(
        `box() asks for columns ${from} to ${end}; the end comes before the start.`,
      );
    const [x, y] = point(line, from);

    return boxOf(x, y, face.measure(text.slice(from, end), size), pitch);
  };

  const find = (text: string, occurrence = 0): CodeBox => {
    if (text === "" || text.includes("\n"))
      throw new SceneError(
        `find() looks for text on one line, got ${JSON.stringify(text)}.`,
        "Find each line's part on its own, or use box() for a line.",
      );

    const hits = lines.flatMap((content, line) => {
      const cols: [number, number][] = [];

      for (let col = content.indexOf(text); col !== -1; col = content.indexOf(text, col + 1))
        cols.push([line, col]);

      return cols;
    });

    const hit = hits[occurrence];

    if (hit === undefined)
      throw new SceneError(
        `find() looks for ${JSON.stringify(text)} number ${occurrence}, but the code has it ${hits.length} time${hits.length === 1 ? "" : "s"}.`,
        "Occurrences count from 0.",
      );

    return box(hit[0], hit[1], hit[1] + text.length);
  };

  return { lines, origin: [left, top], bounds: boxOf(left, top, width, height), point, box, find };
};
