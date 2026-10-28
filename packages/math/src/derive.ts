import { ease, el, motion, type Seconds, type SvgNode } from "svjeez";
import { defaultDark, morph, tint, type Base16 } from "svjeez/extras";
import { rect, type Color, type Rect } from "svjeez";
import { tex, type Tex } from "./index.ts";

/** One line of a derivation: TeX, and what was done to reach it. */
export interface DeriveStep {
  /** The line's TeX. */
  readonly tex: string;
  /** TeX typeset small beside the line with an arrow, such as `\div 2 \text{ both sides}`. Ignored on the first line. */
  readonly note?: string;
}

export interface DeriveOptions {
  /** When the first line appears. */
  readonly at: Seconds;
  /** Seconds from one line's change to the next. Default 2.5. */
  readonly every?: Seconds;
  /** Seconds each change takes. Default 0.9. */
  readonly over?: Seconds;
  /** Where the alignment point of every line sits: `x` is its center, in pixels. Default 0. */
  readonly x?: number;
  /** Top of the first line's box. Default 0. */
  readonly y?: number;
  /** Pixels per em. Default 36. */
  readonly fontSize?: number;
  /** What every line lines up on: `"="`, the first equals sign, or the id of a `\cssId{id}{…}` in each line. Default `"="`. */
  readonly align?: string;
  /** Keep every earlier line and add each new one below, instead of transforming one line in place. Default false. */
  readonly stack?: boolean;
  /** Pixels between lines in a stack. Default 1.9 times `fontSize`. */
  readonly lineHeight?: number;
  /** Colors the lines with the theme's plain slot, and the notes with its muted one. Default `defaultDark`. */
  readonly theme?: Base16;
  readonly color?: Color;
}

export interface Derivation {
  readonly node: SvgNode;
  /** When the last change settles. */
  readonly end: Seconds;
  /** Every line as typeset, aligned. */
  readonly lines: readonly Tex[];
  /** Everything the derivation can draw, notes included. */
  readonly bounds: Rect;
}

const isText = (v: string | DeriveStep): v is string => typeof v === "string";

const alignPoint = (line: Tex, align: string, index: number): number => {
  if (align === "=") {
    const sign = line.words.find((g) => g.char === "=");

    if (!sign)
      throw new Error(
        `derive() found no "=" in step ${index}, ${JSON.stringify(line.words.map((g) => g.char).join(""))}. Put one in every step, or pass align as the id of a \\cssId in each.`,
      );

    return sign.bounds.x + sign.bounds.w / 2;
  }

  const part = line.get(align);

  return part.x + part.w / 2;
};

/**
 * A step-by-step derivation. Every line sits with its alignment point (the `=` by default) on the same x, so the
 * equals sign stays put while the sides change. By default one line transforms into the next with `morph()`; with
 * `stack` each new line appears below the last.
 */
export function derive(
  steps: readonly (string | DeriveStep)[],
  options: DeriveOptions,
): Derivation {
  const {
    at,
    every = 2.5,
    over = 0.9,
    x = 0,
    y = 0,
    fontSize = 36,
    align = "=",
    stack = false,
    theme = defaultDark,
  } = options;

  const lineHeight = options.lineHeight ?? fontSize * 1.9;
  const list = steps.map((s): DeriveStep => (isText(s) ? { tex: s } : s));

  if (list.length === 0 || !(every >= over) || !(over > 0) || !(fontSize > 0))
    throw new Error(
      `derive() needs a step, a positive over that fits in every, and a positive fontSize, got ${list.length} steps, over ${over}, every ${every} and fontSize ${fontSize}.`,
    );

  const style = { fontSize, theme, color: options.color } as const;

  const lines = list.map((step, i) => {
    const measured = tex(step.tex, style);
    const left = x - alignPoint(measured, align, i + 1);

    return tex(step.tex, { ...style, x: left, y: stack ? y + i * lineHeight : y });
  });

  const start = (i: number): Seconds => at + i * every;
  const right = Math.max(...lines.map((l) => l.bounds.x + l.bounds.w)) + fontSize * 0.8;
  const muted = tint(theme, "muted");

  const notes = list.map((step, i) => {
    if (!step.note || i === 0) return undefined;
    const line = lines[i]!;

    const note = tex(step.note, {
      fontSize: fontSize * 0.65,
      theme,
      color: muted,
      x: right + fontSize * 1.1,
      y: line.bounds.y + line.bounds.h / 2,
      anchor: [0, 0.5],
    });

    const mid = line.bounds.y + line.bounds.h / 2;
    const [a, b] = [right, right + fontSize * 0.8];
    const head = fontSize * 0.14;

    const track = (() => {
      const shown = motion({ opacity: 0 })
        .at(start(i) + over / 2)
        .to({ opacity: 1 }, over / 2);

      return stack || i === list.length - 1
        ? shown
        : shown.at(start(i + 1) - 0.01).to({ opacity: 0 }, Math.min(0.3, over / 2));
    })();

    return el.g({ animation: track }, [
      el.path({
        d: `M${a} ${mid}H${b}M${b - head} ${mid - head}L${b} ${mid}L${b - head} ${mid + head}`,
        fill: "none",
        stroke: muted,
        strokeWidth: 1.5,
        strokeLinecap: "round",
        strokeLinejoin: "round",
      }),
      note.node,
    ]);
  });

  const body = stack
    ? lines.map((line, i) =>
        el.g(
          {
            animation:
              i === 0
                ? motion({ opacity: 0 }).at(at).to({ opacity: 1 }, over)
                : motion({ opacity: 0, y: -fontSize * 0.3 })
                    .at(start(i))
                    .to({ opacity: 1, y: 0 }, over, ease.out),
          },
          line.node,
        ),
      )
    : [
        el.g(
          { animation: motion({ opacity: 0 }).at(at).to({ opacity: 1 }, over) },
          morph(lines, {
            at: lines.slice(1).map((_, i) => start(i + 1)),
            over,
          }).node,
        ),
      ];

  const noteBoxes = list.flatMap((_, i) => (notes[i] ? [lines[i]!.bounds] : []));
  const box = lines.map((l) => l.bounds).reduce((p, q) => p.union(q));
  const full = noteBoxes.length > 0 ? box.union(rect(right, box.y, fontSize * 8, box.h)) : box;

  return {
    node: el.g({}, [body, notes.filter((n): n is SvgNode => n !== undefined)]),
    end: start(list.length - 1) + (list.length > 1 ? over : 0),
    lines,
    bounds: full,
  };
}
