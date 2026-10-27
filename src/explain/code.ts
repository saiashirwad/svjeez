import type { Color } from "../attributes";
import { el } from "../el";
import { rect, type Point, type Rect } from "../geometry";
import type { Stack } from "../motion";
import type { SvgNode } from "../svg";

/** `fontStyle` is a bit set, as Shiki emits it: 1 italic, 2 bold. */
export interface Token {
  readonly content: string;
  readonly color?: Color;
  readonly fontStyle?: number;
}

export type Tokens = readonly (readonly Token[])[];

export interface CodeOptions {
  readonly x?: number;
  readonly y?: number;
  readonly fontSize?: number;
  /** Multiple of `fontSize`. */
  readonly lineHeight?: number;
  /** Column width. Default 0.6 × fontSize. */
  readonly advance?: number;
  readonly fontFamily?: string;
  readonly color?: Color;
  /** Line numbers, right-aligned two columns left of the code. */
  readonly gutter?: boolean;
}

/** One run of non-space characters, placed. `y` is the top of its line. */
export interface Word {
  readonly text: string;
  readonly line: number;
  readonly column: number;
  readonly x: number;
  readonly y: number;
  readonly color?: Color;
  readonly fontStyle?: number;
}

export interface Metrics {
  /** x of column 1. */
  readonly origin: number;
  readonly y: number;
  readonly fontSize: number;
  /** Line height in px. */
  readonly height: number;
  readonly advance: number;
  readonly fontFamily: string;
  readonly color?: Color;
}

/** Laid-out code. Lines and columns are 1-based. */
export interface Code {
  readonly node: SvgNode;
  readonly words: readonly Word[];
  readonly metrics: Metrics;
  readonly lineCount: number;
  readonly gutter: boolean;
  readonly bounds: Rect;
  lines(first: number, last?: number): Rect;
  find(text: string, nth?: number): Rect;
  at(line: number, column: number): Point;
}

const baseline = (m: Metrics, top: number): number => top + m.height / 2 + m.fontSize * 0.35;

/** One word as a <text>. Shared by `code`, `morph` and `typewriter` so they render identically. */
export const text = ({ text, x, y, color, fontStyle = 0 }: Word, m: Metrics, animation?: Stack<"x" | "y" | "opacity">): SvgNode =>
  el.text(
    {
      x,
      y: baseline(m, y),
      fontFamily: m.fontFamily,
      fontSize: m.fontSize,
      fill: color ?? m.color,
      fontStyle: fontStyle & 1 ? "italic" : undefined,
      fontWeight: fontStyle & 2 ? "bold" : undefined,
      animation,
    },
    text,
  );

/** Line number `n`, right-aligned in the gutter. */
export const number = (n: number, m: Metrics, animation?: Stack<"x" | "y" | "opacity">): SvgNode =>
  el.text(
    { x: m.origin - 2 * m.advance, y: baseline(m, m.y + (n - 1) * m.height), textAnchor: "end", fontFamily: m.fontFamily, fontSize: m.fontSize, fill: m.color ?? "#888", opacity: 0.4, animation },
    String(n),
  );

export function code(input: string | Tokens, options: CodeOptions = {}): Code {
  const { x = 0, y = 0, fontSize = 14, lineHeight = 1.6, fontFamily = "monospace", color, gutter = false } = options;
  const advance = options.advance ?? fontSize * 0.6;
  if (![fontSize, lineHeight, advance].every((v) => v > 0) || !Number.isFinite(x + y)) throw new Error("code() needs finite coordinates and positive metrics.");
  const rows: Tokens = typeof input === "string" ? input.split("\n").map((content) => [{ content }]) : input;
  if (rows.some((row) => row.some((token) => /[\n\r\t]/.test(token.content)))) throw new Error("code() tokens must not contain line breaks or tabs.");
  const texts = rows.map((row) => row.map((token) => token.content).join(""));
  const m: Metrics = { origin: x + (gutter ? (String(rows.length).length + 2) * advance : 0), y, fontSize, height: fontSize * lineHeight, advance, fontFamily, color };
  const top = (line: number) => y + (line - 1) * m.height;
  const words = rows.flatMap((row, i) => {
    let column = 0;
    return row.flatMap(({ content, color, fontStyle }) => {
      const placed = [...content.matchAll(/\S+/g)].map((run): Word => {
        const col = column + run.index;
        return { text: run[0], line: i + 1, column: col + 1, x: m.origin + col * advance, y: top(i + 1), color, fontStyle };
      });
      column += content.length;
      return placed;
    });
  });
  const lines = (first: number, last = first): Rect => {
    if (!Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first || last > rows.length) throw new Error(`code.lines(${first}, ${last}) is outside lines 1-${rows.length}.`);
    return rect(m.origin, top(first), Math.max(...texts.slice(first - 1, last).map((t) => t.length)) * advance, (last - first + 1) * m.height);
  };
  const at = (line: number, column: number): Point => {
    const length = texts[line - 1]?.length ?? -1;
    if (!Number.isInteger(column) || column < 1 || column > length + 1) throw new Error(`code.at(${line}, ${column}) is outside the code.`);
    return { x: m.origin + (column - 1) * advance, y: top(line) };
  };
  const find = (needle: string, nth = 1): Rect => {
    let seen = 0;
    for (const [i, line] of texts.entries()) {
      for (let pos = line.indexOf(needle); needle && pos >= 0; pos = line.indexOf(needle, pos + 1)) {
        if (++seen === nth) return rect(m.origin + pos * advance, top(i + 1), needle.length * advance, m.height);
      }
    }
    throw new Error(`code.find() found ${seen} of ${JSON.stringify(needle)}, not ${nth}.`);
  };
  const node = el.g({}, [gutter && rows.map((_, i) => number(i + 1, m)), words.map((w) => text(w, m))]);
  return { node, words, metrics: m, lineCount: rows.length, gutter, bounds: lines(1, rows.length), lines, find, at };
}
