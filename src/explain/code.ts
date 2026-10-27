import { el } from "../el";
import { rect, type Point, type Rect } from "../geometry";
import { motion, type Motion, type Span } from "../motion";
import type { Color } from "../attributes";
import type { SvgNode } from "../svg";

export interface Token { readonly content: string; readonly color?: string; readonly fontStyle?: number }
export type Tokens = readonly (readonly Token[])[];
export interface CodeOptions {
  readonly x?: number; readonly y?: number; readonly fontSize?: number; readonly lineHeight?: number;
  readonly advance?: number; readonly gutter?: boolean; readonly color?: Color; readonly fontFamily?: string;
  readonly focus?: readonly { readonly lines: readonly [number, number]; readonly during: Span; readonly dim?: number }[];
}
export interface Code {
  readonly node: SvgNode;
  readonly bounds: Rect;
  lines(start: number, end?: number): Rect;
  find(text: string, occurrence?: number): Rect;
  at(line: number, column: number): Point;
}
export interface PlacedToken extends Token { readonly x: number; readonly y: number; readonly line: number; readonly column: number }
export interface Layout extends Code { readonly tokens: readonly PlacedToken[]; readonly options: Required<Pick<CodeOptions, "x" | "y" | "fontSize" | "lineHeight" | "advance">> }

export function code(input: string | Tokens, options: CodeOptions = {}): Layout {
  const fontSize = options.fontSize ?? 14, lineHeight = options.lineHeight ?? 1.6, advance = options.advance ?? fontSize * 0.6;
  const x = options.x ?? 0, y = options.y ?? 0, height = fontSize * lineHeight;
  if (![fontSize, lineHeight, advance].every(v => Number.isFinite(v) && v > 0) || !Number.isFinite(x) || !Number.isFinite(y)) throw new Error("code() needs finite coordinates and positive metrics.");
  const rows: Tokens = typeof input === "string" ? input.split("\n").map(content => [{ content }]) : input;
  if (rows.some(row => row.some(token => /[\n\r\t]/.test(token.content)))) throw new Error("code() tokens must not contain line breaks or tabs.");
  const gutter = options.gutter ? (String(rows.length).length + 2) * advance : 0;
  const origin = x + gutter;
  const lengths = rows.map(row => row.reduce((n, token) => n + token.content.length, 0));
  const tokens: PlacedToken[] = [];
  rows.forEach((row, index) => {
    let column = 0;
    for (const token of row) {
      tokens.push({ ...token, x: origin + column * advance, y: y + index * height, line: index + 1, column: column + 1 });
      column += token.content.length;
    }
  });
  const lineRect = (start: number, end = start): Rect => {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > rows.length) throw new Error("code.lines() needs a valid inclusive line range.");
    return rect(origin, y + (start - 1) * height, Math.max(...lengths.slice(start - 1, end), 0) * advance, (end - start + 1) * height);
  };
  const at = (line: number, column: number): Point => {
    if (!Number.isInteger(line) || line < 1 || line > rows.length || !Number.isInteger(column) || column < 1 || column > lengths[line - 1]! + 1) throw new Error("code.at() needs a valid 1-based line and column.");
    return { x: origin + (column - 1) * advance, y: y + (line - 1) * height };
  };
  const find = (text: string, occurrence = 1): Rect => {
    if (!text || !Number.isInteger(occurrence) || occurrence < 1 || /\n/.test(text)) throw new Error("code.find() needs a nonempty single-line string and positive occurrence.");
    let count = 0;
    for (let i = 0; i < rows.length; i++) {
      const content = rows[i]!.map(t => t.content).join("");
      let pos = -1;
      while ((pos = content.indexOf(text, pos + 1)) !== -1) if (++count === occurrence) return rect(origin + pos * advance, y + i * height, text.length * advance, height);
    }
    throw new Error(`code.find() cannot find occurrence ${occurrence} of ${JSON.stringify(text)}.`);
  };
  const fade = (line: number): Motion<"opacity"> | undefined => {
    let track: Motion<"opacity"> | undefined;
    for (const f of options.focus ?? []) {
      if (line >= f.lines[0] && line <= f.lines[1]) continue;
      const dim = f.dim ?? 0.25, duration = Math.min(0.25, f.during.over / 2);
      if (!(dim >= 0 && dim <= 1) || !(duration > 0)) throw new Error("code() focus needs a valid opacity and positive span.");
      track = (track ?? motion({ opacity: 1 })).at(f.during.at).to({ opacity: dim }, duration).at(f.during.at + f.during.over - duration).to({ opacity: 1 }, duration);
    }
    return track;
  };
  const rendered = rows.map((_, i) => el.g({ animation: fade(i + 1) }, [
    options.gutter && el.text({ x, y: y + i * height + fontSize, fill: options.color ?? "#888", opacity: 0.5, fontFamily: options.fontFamily ?? "monospace", fontSize }, String(i + 1)),
    ...tokens.filter(t => t.line === i + 1).map(t => el.text({ x: t.x, y: t.y + fontSize, fontFamily: options.fontFamily ?? "monospace", fontSize, fill: (t.color as Color | undefined) ?? options.color, fontStyle: (t.fontStyle ?? 0) & 1 ? "italic" : undefined, fontWeight: (t.fontStyle ?? 0) & 2 ? "bold" : undefined, textDecoration: (t.fontStyle ?? 0) & 4 ? "underline" : undefined, xmlSpace: "preserve" }, t.content)),
  ]));
  return { node: el.g({}, rendered), bounds: rect(origin, y, Math.max(...lengths, 0) * advance, rows.length * height), lines: lineRect, find, at, tokens, options: { x, y, fontSize, lineHeight, advance } };
}
