import type { RestChannel, Values } from "../channels";
import { el } from "../el";
import { ease, type Seconds, type Span } from "../motion";
import { enter } from "../recipes";
import type { SvgNode } from "../svg";
import { number, text, type Code } from "./code";
import { beats, type Beats } from "./timeline";

export interface RevealOptions {
  /** A start, from which blocks follow `step` apart, or one time per block. */
  readonly at: Beats;
  /**
   * Line ranges, shown in order. Lines in no block are there from the start, so a skeleton can stay put while its
   * bodies arrive. `"line"` shows one line at a time. Default: paragraphs, split at blank lines.
   */
  readonly blocks?: readonly (readonly [first: number, last?: number])[] | "line";
  /** Seconds from one block to the next. Default 0.6. */
  readonly step?: Seconds;
  /** Each block's entrance. Default 0.4. */
  readonly over?: Seconds;
  /** Where each block enters from. Default `{ opacity: 0, y: 6 }`. */
  readonly from?: Values<RestChannel>;
}

/** Show `code` a block of lines at a time. `spans[i]` is when block `i` enters; `end` is when the last one settles. */
export function reveal(
  code: Code,
  {
    at,
    blocks = paragraphs(code),
    step = 0.6,
    over = 0.4,
    from = { opacity: 0, y: 6 },
  }: RevealOptions,
): { readonly node: SvgNode; readonly spans: readonly Span[]; readonly end: Seconds } {
  if (!(step >= 0 && over > 0))
    throw new Error(
      `reveal() needs a non-negative step and a positive duration, got step ${step} and over ${over}.`,
    );

  const ranges =
    blocks === "line"
      ? Array.from({ length: code.lineCount }, (_, i) => [i + 1, i + 1] as const)
      : blocks.map(([first, last = first]) => [first, last] as const);

  const owner = new Map<number, number>();
  ranges.forEach(([first, last], k) => {
    if (
      !(
        Number.isInteger(first) &&
        Number.isInteger(last) &&
        first >= 1 &&
        last >= first &&
        last <= code.lineCount
      )
    )
      throw new Error(`reveal() block ${first}-${last} is outside lines 1-${code.lineCount}.`);

    for (let line = first; line <= last; line++) {
      if (owner.has(line)) throw new Error(`reveal() has line ${line} in two blocks.`);
      owner.set(line, k);
    }
  });
  const spans = beats(at, ranges.length, step, "reveal()").map((t): Span => ({ at: t, over }));

  const lines = (k: number | undefined) =>
    Array.from({ length: code.lineCount }, (_, i) => i + 1).filter((line) => owner.get(line) === k);

  const draw = (k: number | undefined) =>
    lines(k).map((line) => [
      code.gutter && number(line, code.metrics),
      code.words.filter((w) => w.line === line).map((w) => text(w, code.metrics)),
    ]);

  return {
    node: el.g({}, [
      draw(undefined),
      spans.map((span, k) => el.g({ animation: enter(span, from, ease.out) }, draw(k))),
    ]),
    spans,
    end: Math.max(...spans.map((span) => span.at + span.over)),
  };
}

/** Runs of lines split at blank lines; each blank line joins the block after it. */
const paragraphs = (code: Code): [number, number][] => {
  const filled = new Set(code.words.map((w) => w.line));
  const out: [number, number][] = [];
  let start = 1;

  for (let line = 1; line <= code.lineCount; line++) {
    const ends = line === code.lineCount || (filled.has(line) && !filled.has(line + 1));

    if (ends) {
      out.push([start, line]);
      start = line + 1;
    }
  }

  return out;
};
