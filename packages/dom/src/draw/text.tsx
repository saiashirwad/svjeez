/** @jsxImportSource svjeez */
/** @jsxRuntime automatic */
import {
  def,
  motion,
  num,
  show,
  type Color,
  type Stack,
  type SvgNode,
  type TagChannels,
} from "svjeez";
import { jsx } from "svjeez/jsx-runtime";
import type { Paint, Rect, TextRun } from "../tree.ts";
import { slideIn, type Tween } from "./tween.ts";

/** What the text transitions draw with: a paint as CSS, and a run as a `<text>`. */
export interface Ink {
  readonly v: (color: Paint) => Color;
  readonly text: (run: TextRun, animation?: Stack<TagChannels<"text">>) => SvgNode;
}

/** Tags whose text appears or leaves by typing. */
export const FIELDS = new Set(["input", "textarea"]);

/** Code points, so a character outside the BMP types as one keystroke. */
const chars = (s: string): string[] => Array.from(s);

/** What a field shows as typed: a placeholder is an empty field. */
const shown = (run: TextRun): string => (run.placeholder ? "" : run.text);

/** One text grew from or shrank to the other, and the longer one knows where its characters end. */
export const typable = (a: TextRun, b: TextRun): boolean => {
  const from = shown(a);
  const to = shown(b);
  const long = to.length > from.length ? b : a;

  return (
    from !== to &&
    (to.startsWith(from) || from.startsWith(to)) &&
    long.advances?.length === chars(long.text).length
  );
};

/** An empty run in `run`'s place, moved as its field moved, so text that appears in a field types in from nothing. */
export const blank = (run: TextRun, from: Rect, to: Rect): TextRun => ({
  ...run,
  x: run.x + to.x - from.x,
  y: run.y + to.y - from.y,
  text: "",
  advances: [],
  placeholder: false,
});

/**
 * One run typed into or deleted from: the longer text drawn once behind a clip whose width steps from character to
 * character, with a caret at its edge. A placeholder leaves at the first keystroke and comes back at the last.
 */
export const typing = (ink: Ink, a: TextRun, b: TextRun, tween: Tween): SvgNode => {
  const { v, text } = ink;
  const from = chars(shown(a)).length;
  const to = chars(shown(b)).length;
  const long = to > from ? b : a;
  const count = Math.abs(to - from);
  const step = tween.over / count;
  const pad = long.size;
  const edge = (k: number) => (k === 0 ? 0 : long.advances[k - 1]!);
  // Past the last character the clip opens wide, so a glyph that overhangs its advance isn't cut.
  const width = (k: number) => pad + edge(k) + (k === chars(long.text).length ? pad : 0);
  const times = Array.from({ length: count }, (_, i) => tween.at + i * step);
  const lengths = times.map((_, i) => (to > from ? from + i + 1 : from - i - 1));

  const reveal = times.reduce(
    (m, t, i) => m.at(t).set({ width: width(lengths[i]!) }),
    motion({ width: width(from) }),
  );

  const caret = times
    .reduce(
      (m, t, i) => m.at(t).set({ x: edge(lengths[i]!), opacity: 1 }),
      motion({ x: edge(from), opacity: 0 }),
    )
    .at(tween.at + tween.over)
    .set({ opacity: 0 });

  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const recolor = !a.placeholder && !b.placeholder && v(a.color) !== v(b.color);

  const clip = def.clipPath(
    {},
    jsx("rect", {
      x: num(b.x - pad),
      y: num(b.y - 2 * pad),
      width: num(width(from)),
      height: num(3 * pad),
      animation: reveal,
    }),
  );

  return (
    <>
      {a.placeholder && text(a, motion({ opacity: 1 }).at(tween.at).set({ opacity: 0 }))}
      {b.placeholder && text(b, motion({ opacity: 0 }).at(times.at(-1)!).set({ opacity: 1 }))}
      <g animation={dx || dy ? slideIn(tween, dx, dy) : undefined}>
        <g clipPath={clip}>
          {text(
            { ...long, x: b.x, y: b.y },
            recolor
              ? motion({ fill: v(a.color) })
                  .at(tween.at)
                  .to({ fill: v(b.color) }, tween.over, tween.ease)
              : undefined,
          )}
        </g>
        {jsx("rect", {
          x: num(b.x),
          y: num(b.y - long.size * 0.9),
          width: num(Math.max(1, long.size / 14)),
          height: num(long.size * 1.15),
          fill: v(long.color),
          animation: caret,
        })}
      </g>
    </>
  );
};

/** At most this many values between two counted numbers, so a big jump stays a few keyframes. */
const MAX_COUNTS = 20;

/** Two texts the same but for one number, split around it. */
interface Count {
  readonly before: string;
  readonly after: string;
  readonly from: number;
  readonly to: number;
  readonly format: (n: number) => string;
}

const NUMBER = /(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/;

/** The one number that differs between two texts that are otherwise the same, written as the texts write it. */
export const countOf = (a: string, b: string): Count | undefined => {
  const pa = a.split(NUMBER);
  const pb = b.split(NUMBER);

  if (pa.length !== pb.length) return undefined;

  const changed = pa.flatMap((p, i) => (p === pb[i] ? [] : [i]));

  // Odd pieces are the numbers split matched.
  if (changed.length !== 1 || changed[0]! % 2 === 0) return undefined;

  const i = changed[0]!;
  const decimals = Math.max(...[pa[i]!, pb[i]!].map((s) => s.split(".")[1]?.length ?? 0));
  const grouped = pa[i]!.includes(",") || pb[i]!.includes(",");

  return {
    before: pa.slice(0, i).join(""),
    after: pa.slice(i + 1).join(""),
    from: Number(pa[i]!.replaceAll(",", "")),
    to: Number(pb[i]!.replaceAll(",", "")),
    format: (n) => {
      const s = n.toFixed(decimals);

      return grouped ? s.replace(/^\d+/, (w) => w.replace(/\B(?=(\d{3})+$)/g, ",")) : s;
    },
  };
};

/** One run whose only change is a number: the in-between values, each shown for its slice of the tween. */
export const counting = (
  ink: Ink,
  a: TextRun,
  b: TextRun,
  change: Count,
  tween: Tween,
): SvgNode => {
  const { before, after, from, to, format } = change;

  const n = Math.min(
    MAX_COUNTS,
    Number.isInteger(from - to) ? Math.abs(to - from) - 1 : MAX_COUNTS,
  );

  const slices = n + 1;
  const switchAt = (k: number) => tween.at + (tween.over * (k - 0.5)) / slices;

  return (
    <>
      {Array.from({ length: n + 2 }, (_, k) => {
        const p = k / slices;

        const run =
          k === 0
            ? a
            : k === slices
              ? b
              : {
                  ...b,
                  text: before + format(from + (to - from) * p) + after,
                  x: a.x + (b.x - a.x) * p,
                  y: a.y + (b.y - a.y) * p,
                };

        const at = k === 0 ? 0 : switchAt(k);

        return ink.text(
          run,
          show(k === slices ? { at } : { at, over: switchAt(k + 1) - at }, { fade: 0 }),
        );
      })}
    </>
  );
};
