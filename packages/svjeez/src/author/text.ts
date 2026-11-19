import { SceneError } from "../model/scene-error";
import type { Font } from "../font/font";
import { ringsOf } from "../model/paths";
import type { Box, Contour, Geometry, Vec } from "../model/ir";
import { alongOutline, boundsOfPoints, lengthOf } from "../model/geometry";

export type TextAlign = "start" | "center" | "end";

export interface TextLayoutOptions {
  readonly size: number;
  readonly width?: number;
  readonly lineHeight?: number;
  readonly align?: TextAlign;
}

export interface TextPiece<S> {
  readonly text: string;
  readonly face: Font;
  readonly style: S;
}

export interface LaidRun<S> {
  readonly text: string;
  readonly at: Vec;
  readonly advances: readonly number[];
  readonly face: Font;
  readonly style: S;
  readonly outline?: readonly Contour[];
}

export interface LaidLine<S> {
  readonly at: Vec;
  readonly runs: readonly LaidRun<S>[];
}

export interface TextLayout<S = Font> {
  readonly lines: readonly LaidLine<S>[];
  readonly box: Box;
  readonly cuts: readonly number[];
}

const SHARE: Readonly<Record<TextAlign, number>> = { start: 0, center: 0.5, end: 1 };

const isBlank = (text: string): boolean => /^\s+$/.test(text);

const joined = <S>(parts: readonly TextPiece<S>[], part: TextPiece<S>): TextPiece<S>[] => {
  const last = parts.at(-1);

  if (part.text === "") return [...parts];

  if (!last || last.face !== part.face) return [...parts, part];

  if (last.style === part.style || isBlank(part.text))
    return [...parts.slice(0, -1), { ...last, text: last.text + part.text }];

  return isBlank(last.text)
    ? [...parts.slice(0, -1), { ...part, text: last.text + part.text }]
    : [...parts, part];
};

const concat = <S>(parts: readonly TextPiece<S>[], more: readonly TextPiece<S>[]): TextPiece<S>[] =>
  more.reduce<TextPiece<S>[]>(joined, [...parts]);

const textOf = <S>(parts: readonly TextPiece<S>[]): string =>
  parts.map((part) => part.text).join("");

const trimmed = <S>(parts: readonly TextPiece<S>[]): TextPiece<S>[] => {
  const out = [...parts];

  while (out.length > 0) {
    const last = out.at(-1)!;
    const text = last.text.trimEnd();

    if (text !== "") {
      out[out.length - 1] = { ...last, text };
      break;
    }

    out.pop();
  }

  return out;
};

const tokens = <S>(paragraph: readonly TextPiece<S>[]): TextPiece<S>[][] => {
  const out: TextPiece<S>[][] = [];

  for (const part of paragraph)
    for (const text of part.text.split(/(\s+)/)) {
      if (text === "") continue;
      const last = out.at(-1);
      const piece = { ...part, text };

      if (last && isBlank(textOf(last)) === isBlank(text))
        out[out.length - 1] = joined(last, piece);
      else out.push([piece]);
    }

  return out;
};

const cutWord = <S>(
  word: readonly TextPiece<S>[],
  fits: (parts: readonly TextPiece<S>[]) => boolean,
): TextPiece<S>[][] => {
  const pieces: TextPiece<S>[][] = [];
  let piece: TextPiece<S>[] = [];

  for (const part of word)
    for (const char of part.text) {
      const next = joined(piece, { ...part, text: char });

      if (piece.length > 0 && !fits(next)) {
        pieces.push(piece);
        piece = [{ ...part, text: char }];
      } else piece = next;
    }

  return [...pieces, piece];
};

const wrap = <S>(
  paragraph: readonly TextPiece<S>[],
  fits: (parts: readonly TextPiece<S>[]) => boolean,
  cut: Set<readonly TextPiece<S>[]>,
): TextPiece<S>[][] => {
  const lines: TextPiece<S>[][] = [];
  let line: TextPiece<S>[] = [];

  for (const token of tokens(paragraph)) {
    const next = concat(line, token);

    if (fits(next)) {
      line = next;
      continue;
    }

    if (isBlank(textOf(token))) {
      lines.push(line);
      line = [];
      continue;
    }

    if (textOf(line).trim() !== "") lines.push(trimmed(line));
    const pieces = cutWord(token, fits);

    for (const piece of pieces.slice(0, -1)) cut.add(piece);
    lines.push(...pieces.slice(0, -1));
    line = pieces.at(-1)!;
  }

  return [...lines, trimmed(line)];
};

const paragraphs = <S>(pieces: readonly TextPiece<S>[]): TextPiece<S>[][] => {
  const out: TextPiece<S>[][] = [[]];

  for (const piece of pieces)
    piece.text.split(/\r?\n/).forEach((text, index) => {
      if (index > 0) out.push([]);
      out[out.length - 1] = joined(out.at(-1)!, { text, face: piece.face, style: piece.style });
    });

  return out;
};

export const layoutRuns = <S>(
  base: Font,
  pieces: readonly TextPiece<S>[],
  { size, width, lineHeight, align = "start" }: TextLayoutOptions,
  where: string,
): TextLayout<S> => {
  if (!(size > 0 && Number.isFinite(size)))
    throw new SceneError(`${where} needs a positive size, got ${size}.`);

  if (width !== undefined && !(width > 0 && Number.isFinite(width)))
    throw new SceneError(`${where} needs a positive width to wrap to, got ${width}.`);

  if (lineHeight !== undefined && !(lineHeight > 0 && Number.isFinite(lineHeight)))
    throw new SceneError(`${where} needs a positive lineHeight, got ${lineHeight}.`);
  const share = SHARE[align];

  if (share === undefined)
    throw new SceneError(
      `${where} takes align "start", "center" or "end", got "${String(align)}".`,
    );
  const { ascent, descent, lineGap } = base.metrics;
  const step = (lineHeight ?? ascent + descent + lineGap) * size;

  const measure = (parts: readonly TextPiece<S>[]): number =>
    parts.reduce((sum, part) => sum + part.face.measure(part.text, size), 0);

  const fits = (parts: readonly TextPiece<S>[]): boolean =>
    width === undefined || measure(parts) <= width;

  const cut = new Set<readonly TextPiece<S>[]>();
  const broken = paragraphs(pieces).flatMap((paragraph) => wrap(paragraph, fits, cut));
  const measured = broken.map(measure);
  const column = width ?? Math.max(0, ...measured);
  const faces = new Set([base, ...broken.flatMap((parts) => parts.map((part) => part.face))]);
  const top = Math.max(...[...faces].map((face) => face.metrics.ascent)) * size;
  const bottom = Math.max(...[...faces].map((face) => face.metrics.descent)) * size;

  const lines = broken.map((parts, index): LaidLine<S> => {
    const start = (column - measured[index]!) * share;
    const y = top + index * step;
    let x = start;

    const runs = parts.map((part): LaidRun<S> => {
      const { text, face, style } = part;

      const outlined = face.outlines ? face.path(text, { size, x, y }) : undefined;

      const run: LaidRun<S> = {
        text,
        at: [x, y],
        advances: outlined
          ? outlined.glyphs.map((glyph) => glyph.advance)
          : face.advances(text, size),
        face,
        style,
        ...(outlined && { outline: ringsOf(outlined.d) }),
      };

      x += face.measure(text, size);

      return run;
    });

    return { at: [start, y], runs };
  });

  return {
    lines,
    box: { x: 0, y: 0, width: column, height: (lines.length - 1) * step + top + bottom },
    cuts: broken.flatMap((line, index) => (cut.has(line) ? [index] : [])),
  };
};

export const layoutText = (
  face: Font,
  text: string,
  options: TextLayoutOptions,
  where: string,
): TextLayout => layoutRuns(face, [{ text, face, style: face }], options, where);

/** Sets a laid-out single line along an outline: each run starts where the path is, and the box wraps every glyph. */
export const setAlong = <S>(
  layout: TextLayout<S>,
  path: Geometry,
  start: number,
  align: TextAlign,
): TextLayout<S> => {
  const [line] = layout.lines;
  const begin = start * lengthOf(path) - SHARE[align] * layout.box.width;
  const ascent = line?.at[1] ?? 0;
  const descent = layout.box.height - ascent;
  const corners: Vec[] = [];

  const runs = (line?.runs ?? []).map((run): LaidRun<S> => {
    let distance = begin + run.at[0];
    const { point } = alongOutline(path, distance);

    for (const advance of run.advances) {
      const { point: middle, angle } = alongOutline(path, distance + advance / 2);
      const [cos, sin] = [Math.cos(angle), Math.sin(angle)];

      const glyph: Vec[] = [
        [-advance / 2, -ascent],
        [advance / 2, -ascent],
        [advance / 2, descent],
        [-advance / 2, descent],
      ];

      for (const [u, v] of glyph)
        corners.push([middle[0] + u * cos - v * sin, middle[1] + u * sin + v * cos]);
      distance += advance;
    }

    const { outline: _flat, ...placed } = run;

    return { ...placed, at: point };
  });

  return {
    lines: [{ at: runs[0]?.at ?? [0, 0], runs }],
    box: corners.length > 0 ? boundsOfPoints(corners) : { x: 0, y: 0, width: 0, height: 0 },
    cuts: [],
  };
};
