import type { Color } from "../attributes";
import { el } from "../el";
import { regularFace, type Font, type FontValue } from "../font/font";
import { rect, type Point, type Rect } from "../geometry";
import { defaultDark, tint, type Base16, type CodeRole } from "./theme";
import type { Stack } from "../motion";
import type { SvgNode } from "../svg";

/** `fontStyle` is a bit set, as Shiki emits it: 1 italic, 2 bold. */
export interface CodeToken {
  readonly content: string;
  readonly color?: Color;
  readonly fontStyle?: number;
}

/** `[role, text]` colored by the theme, or `[role, text, id]` to name it for `get()` and exact morphs. */
export type CodeRun = readonly [role: CodeRole, text: string, id?: string];

/** Plain text, a role-tagged run, or a Shiki-style token. */
export type CodePiece = string | CodeRun | CodeToken;

export type CodeTokens = readonly (readonly CodePiece[])[];

export interface CodeOptions {
  readonly x?: number;
  readonly y?: number;
  readonly fontSize?: number;
  /** Multiple of `fontSize`. */
  readonly lineHeight?: number;
  /** Column width. Default: measured from `font`, else 0.6 × fontSize. */
  readonly advance?: number;
  readonly fontFamily?: string;
  /** A monospaced font to embed. Sets the family and the column width. */
  readonly font?: FontValue;
  /** Colors runs by role, plain text with `plain` and line numbers with `comment`. Default `defaultDark`. */
  readonly theme?: Base16;
  /** Line numbers, right-aligned two columns left of the code. */
  readonly gutter?: boolean;
}

/** One run of non-space characters, placed. `y` is the top of its line. */
export interface CodeWord {
  readonly text: string;
  readonly line: number;
  readonly column: number;
  readonly x: number;
  readonly y: number;
  readonly color?: Color;
  readonly fontStyle?: number;
  readonly id?: string;
}

export interface CodeMetrics {
  /** x of column 1. */
  readonly origin: number;
  readonly y: number;
  readonly fontSize: number;
  /** Line height in px. */
  readonly height: number;
  readonly advance: number;
  readonly fontFamily: string | FontValue;
  readonly theme: Base16;
}

/** Laid-out code. Lines and columns are 1-based. */
export interface Code {
  readonly node: SvgNode;
  readonly words: readonly CodeWord[];
  readonly metrics: CodeMetrics;
  readonly lineCount: number;
  readonly gutter: boolean;
  readonly bounds: Rect;
  lines(first: number, last?: number): Rect;
  find(text: string, nth?: number): Rect;
  /** Bounds of every run named `id`. */
  get(id: string): Rect;
  at(line: number, column: number): Point;
}

const baseline = (m: CodeMetrics, top: number): number => top + m.height / 2 + m.fontSize * 0.35;

/** One word as a <text>. Shared by `code`, `morph` and `typewriter` so they render identically. */
export const text = (
  { text, x, y, color, fontStyle = 0 }: CodeWord,
  m: CodeMetrics,
  animation?: Stack<"x" | "y" | "opacity">,
): SvgNode =>
  el.text(
    {
      x,
      y: baseline(m, y),
      fontFamily: m.fontFamily,
      fontSize: m.fontSize,
      fill: color ?? tint(m.theme, "plain"),
      fontStyle: fontStyle & 1 ? "italic" : undefined,
      fontWeight: fontStyle & 2 ? "bold" : undefined,
      animation,
    },
    text,
  );

/** Line number `n`, right-aligned in the gutter. */
export const number = (
  n: number,
  m: CodeMetrics,
  animation?: Stack<"x" | "y" | "opacity">,
): SvgNode =>
  el.text(
    {
      x: m.origin - 2 * m.advance,
      y: baseline(m, m.y + (n - 1) * m.height),
      textAnchor: "end",
      fontFamily: m.fontFamily,
      fontSize: m.fontSize,
      fill: tint(m.theme, "comment"),
      animation,
    },
    String(n),
  );

/** Columns, typewriter and morph all step by one advance, so every glyph must share it. */
const monospaceAdvance = (face: Font, fontSize: number): number => {
  const [narrow, wide] = [face.measure("i", fontSize), face.measure("W", fontSize)];

  if (Math.abs(narrow - wide) > 0.01)
    throw new Error(
      `code() needs a monospaced font, and ${face.family} is proportional. Draw prose with <text fontFamily={font}>.`,
    );

  return wide;
};

const isSourceText = (input: string | CodeTokens): input is string => typeof input === "string";

const isPlainPiece = (p: CodePiece): p is string => typeof p === "string";

const isRun = (p: CodePiece): p is CodeRun => Array.isArray(p);

export function code(input: string | CodeTokens, options: CodeOptions = {}): Code {
  const {
    x = 0,
    y = 0,
    fontSize = 14,
    lineHeight = 1.6,
    font,
    theme = defaultDark,
    gutter = false,
  } = options;

  const fontFamily = font ?? options.fontFamily ?? "monospace";

  const advance =
    options.advance ?? (font ? monospaceAdvance(regularFace(font), fontSize) : fontSize * 0.6);

  if (![fontSize, lineHeight, advance].every((v) => v > 0) || !Number.isFinite(x + y))
    throw new Error(
      `code() needs finite coordinates and positive metrics, got x ${x}, y ${y}, fontSize ${fontSize}, lineHeight ${lineHeight} and advance ${advance}.`,
    );

  const piece = (p: CodePiece): CodeToken & { readonly id?: string } => {
    if (isPlainPiece(p)) return { content: p };

    if (!isRun(p)) return p;
    const [role, content, id] = p;

    return { content, color: tint(theme, role), id };
  };

  const rows = (isSourceText(input) ? input.split("\n").map((line) => [line]) : input).map((row) =>
    row.map(piece),
  );

  if (rows.some((row) => row.some((token) => /[\n\r\t]/.test(token.content))))
    throw new Error("code() tokens must not contain line breaks or tabs.");
  const texts = rows.map((row) => row.map((token) => token.content).join(""));

  const m: CodeMetrics = {
    origin: x + (gutter ? (String(rows.length).length + 2) * advance : 0),
    y,
    fontSize,
    height: fontSize * lineHeight,
    advance,
    fontFamily,
    theme,
  };

  const top = (line: number) => y + (line - 1) * m.height;

  const words = rows.flatMap((row, i) => {
    let column = 0;

    return row.flatMap(({ content, color, fontStyle, id }) => {
      const placed = [...content.matchAll(/\S+/g)].map((run): CodeWord => {
        const col = column + run.index;

        return {
          text: run[0],
          line: i + 1,
          column: col + 1,
          x: m.origin + col * advance,
          y: top(i + 1),
          color,
          fontStyle,
          id,
        };
      });

      column += content.length;

      return placed;
    });
  });

  const lines = (first: number, last = first): Rect => {
    if (
      !Number.isInteger(first) ||
      !Number.isInteger(last) ||
      first < 1 ||
      last < first ||
      last > rows.length
    )
      throw new Error(`code.lines(${first}, ${last}) is outside lines 1-${rows.length}.`);

    return rect(
      m.origin,
      top(first),
      Math.max(...texts.slice(first - 1, last).map((t) => t.length)) * advance,
      (last - first + 1) * m.height,
    );
  };

  const at = (line: number, column: number): Point => {
    const length = texts[line - 1]?.length ?? -1;

    if (!Number.isInteger(column) || column < 1 || column > length + 1)
      throw new Error(`code.at(${line}, ${column}) is outside the code.`);

    return { x: m.origin + (column - 1) * advance, y: top(line) };
  };

  const find = (needle: string, nth = 1): Rect => {
    let seen = 0;

    for (const [i, line] of texts.entries()) {
      for (
        let pos = line.indexOf(needle);
        needle && pos >= 0;
        pos = line.indexOf(needle, pos + 1)
      ) {
        if (++seen === nth)
          return rect(m.origin + pos * advance, top(i + 1), needle.length * advance, m.height);
      }
    }

    throw new Error(`code.find() found ${seen} of ${JSON.stringify(needle)}, not ${nth}.`);
  };

  const get = (id: string): Rect => {
    const named = words.filter((w) => w.id === id);

    if (named.length === 0) throw new Error(`code.get() found no run named ${JSON.stringify(id)}.`);

    return named
      .map((w) => rect(w.x, w.y, w.text.length * advance, m.height))
      .reduce((a, b) => a.union(b));
  };

  const node = el.g({}, [
    gutter && rows.map((_, i) => number(i + 1, m)),
    words.map((w) => text(w, m)),
  ]);

  return {
    node,
    words,
    metrics: m,
    lineCount: rows.length,
    gutter,
    bounds: lines(1, rows.length),
    lines,
    find,
    get,
    at,
  };
}
