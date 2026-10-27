import type { Color } from "../attributes";
import { def } from "../defs";
import { el } from "../el";
import { ease, motion, type Motion, type Seconds } from "../motion";
import type { SvgNode } from "../svg";
import { number, text, type Code, type Metrics } from "./code";

export interface TypewriterOptions {
  readonly at: Seconds;
  /** Characters per second. */
  readonly cps?: number;
  /** A block cursor that follows the typing and blinks when idle. `true` uses the code color. */
  readonly cursor?: boolean | Color;
}

/** Type `code` out line by line, one character per step. A line costs its characters plus one for the newline. */
export function typewriter(code: Code, { at, cps = 28, cursor = false }: TypewriterOptions): { readonly node: SvgNode; readonly end: Seconds } {
  if (!(at >= 0 && cps > 0)) throw new Error("typewriter() needs a non-negative start and a positive cps.");
  const m = code.metrics;
  let t = at - 1 / cps;
  const lines = Array.from({ length: code.lineCount }, (_, i) => {
    const words = code.words.filter((w) => w.line === i + 1);
    const [first, last] = [words[0], words.at(-1)];
    const from = first ? first.x : m.origin;
    const chars = first && last ? last.column + last.text.length - first.column : 0;
    const start = t + 1 / cps;
    t = start + chars / cps;
    return { words, start, chars, from, top: m.y + i * m.height };
  });
  const rows = lines.map(({ words, start, chars, from, top }, i) => {
    const numbered = code.gutter && number(i + 1, m, motion({ opacity: 0 }).at(start).set({ opacity: 1 }));
    if (chars === 0) return numbered;
    const reveal = motion({ width: 0 }).at(start).to({ width: chars * m.advance }, chars / cps, ease.steps(chars));
    const clip = def.clipPath({}, el.rect({ x: from, y: top, width: 0, height: m.height, animation: reveal }));
    return [numbered, el.g({ clipPath: clip }, words.map((w) => text(w, m)))];
  });
  return { node: el.g({}, [rows, cursor && caret(lines, m, cursor === true ? (m.color ?? "#888") : cursor, at, t, cps)]), end: t };
}

type Line = { readonly start: Seconds; readonly chars: number; readonly from: number; readonly top: number };

const caret = (lines: readonly Line[], m: Metrics, color: Color, at: Seconds, end: Seconds, cps: number): SvgNode => {
  const { from: x, top: y } = lines[0]!;
  const path = lines.reduce<Motion<"x" | "y">>((track, { start, chars, from, top }) => {
    const placed = track.at(start).set({ x: from - x, y: top - y });
    return chars > 0 ? placed.to({ x: from - x + chars * m.advance }, chars / cps, ease.steps(chars)) : placed;
  }, motion({ x: 0, y: 0 }));
  const height = m.fontSize * 1.25;
  const block = (animation: Motion<"opacity">) => el.rect({ x, y: y + (m.height - height) / 2, width: m.advance, height, fill: color, fillOpacity: 0.8, animation });
  return el.g({ animation: path }, [
    block(motion({ opacity: 1 }).at(0.5).set({ opacity: 0 }).loop(1)),
    block(motion({ opacity: 0 }).at(at).set({ opacity: 1 }).at(end).set({ opacity: 0 })),
  ]);
};
