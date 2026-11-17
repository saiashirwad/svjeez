/** @jsxImportSource svjeez */
import {
  ease,
  motion,
  type Seconds,
  type Span,
  type SvgNode,
  defaultDark,
  morph,
  tint,
  type Base16,
} from "svjeez";

import { type Color, type Drawn, type Part } from "svjeez";
import { rect } from "svjeez/geometry";
import { span as spanOf } from "svjeez";
import { tex, type Tex } from "./index.ts";

/** One line of a derivation: TeX, and what was done to reach it. */
export interface DeriveStep {
  readonly tex: string;
  /** TeX typeset small beside the line with an arrow, such as `\div 2 \text{ both sides}`. Ignored on the first line. */
  readonly note?: string;
}

export interface DeriveOptions {
  /** Seconds each change takes. The changes are spaced evenly, so the last one ends with the span. Default 0.9. */
  readonly change?: Seconds;
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

/** One line of a derivation, by its TeX. Its box is where it sits, and its span runs from when it appears to when its change settles. */
export interface DeriveLine extends Part {
  /** The line's TeX. Two lines with the same TeX share an id, and `part()` finds the first. */
  readonly id: string;
  /** The line as typeset and aligned, to find a glyph or a `\cssId` part inside it. */
  readonly tex: Tex;
}

/** Its parts are the lines, in order. `span` runs from the first line to when the last change settles, and `bounds` covers everything it can draw, notes included. */
export interface Derivation extends Drawn<DeriveLine> {}

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

  const { box } = line.part(align);

  return box.x + box.w / 2;
};

/**
 * A step-by-step derivation over `when`. Every line sits with its alignment point (the `=` by default) on the same x, so the
 * equals sign stays put while the sides change. By default one line transforms into the next with `morph()`; with
 * `stack` each new line appears below the last.
 */
export function derive(
  when: Span,
  steps: readonly (string | DeriveStep)[],
  options: DeriveOptions = {},
): Derivation {
  const { at, over: total } = when;

  const {
    change: over = 0.9,
    x = 0,
    y = 0,
    fontSize = 36,
    align = "=",
    stack = false,
    theme = defaultDark,
  } = options;

  const lineHeight = options.lineHeight ?? fontSize * 1.9;
  const list = steps.map((s): DeriveStep => (isText(s) ? { tex: s } : s));

  const every = list.length > 1 ? (total - over) / (list.length - 1) : total;

  if (list.length === 0 || !(every >= over) || !(over > 0) || !(fontSize > 0))
    throw new Error(
      `derive() needs a step, a span long enough for each change (${list.length} of them, ${over}s each), and a positive fontSize, got ${list.length} steps, over ${total}, change ${over} and fontSize ${fontSize}.`,
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
      const shown = motion({ opacity: 0 }).to(
        { opacity: 1 },
        spanOf(start(i) + over / 2, over / 2),
      );

      return stack || i === list.length - 1
        ? shown
        : shown.to({ opacity: 0 }, spanOf(start(i + 1) - 0.01, Math.min(0.3, over / 2)));
    })();

    return (
      <g animation={track}>
        <path
          d={`M${a} ${mid}H${b}M${b - head} ${mid - head}L${b} ${mid}L${b - head} ${mid + head}`}
          fill="none"
          stroke={muted}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {note.node}
      </g>
    );
  });

  const body = stack
    ? lines.map((line, i) => (
        <g
          animation={
            i === 0
              ? motion({ opacity: 0 }).to({ opacity: 1 }, spanOf(at, over))
              : motion({ opacity: 0, y: -fontSize * 0.3 }).to(
                  { opacity: 1, y: 0 },
                  spanOf(start(i), over),
                  ease.out,
                )
          }
        >
          {line.node}
        </g>
      ))
    : [
        <g animation={motion({ opacity: 0 }).to({ opacity: 1 }, spanOf(at, over))}>
          {
            morph(lines, {
              at: lines.slice(1).map((_, i) => start(i + 1)),
              over,
            }).node
          }
        </g>,
      ];

  const noteBoxes = list.flatMap((_, i) => (notes[i] ? [lines[i]!.bounds] : []));
  const box = lines.map((l) => l.bounds).reduce((p, q) => p.union(q));
  const full = noteBoxes.length > 0 ? box.union(rect(right, box.y, fontSize * 8, box.h)) : box;

  const parts = lines.map((line, i): DeriveLine => ({
    id: list[i]!.tex,
    box: line.bounds,
    span: spanOf(start(i), over),
    tex: line,
  }));

  return {
    node: (
      <g>
        {body}
        {notes.filter((n): n is SvgNode => n !== undefined)}
      </g>
    ),
    span: spanOf(at, total),
    bounds: full,
    parts,
    part(id) {
      const found = parts.find((p) => p.id === id);

      if (!found)
        throw new Error(
          `derive() has no line ${JSON.stringify(id)}. Its lines are ${parts
            .slice(0, 4)
            .map((p) => JSON.stringify(p.id))
            .join(", ")}${parts.length > 4 ? ", …" : ""}.`,
        );

      return found;
    },
  };
}
