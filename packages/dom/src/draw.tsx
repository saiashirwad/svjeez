/** @jsxImportSource svjeez */
/** @jsxRuntime automatic */
import {
  def,
  ease as eases,
  font,
  motion,
  num,
  show,
  type Child,
  Style,
  type Ease,
  type Font,
  type FontValue,
  type Stack,
  type SvgNode,
  type TagChannels,
} from "svjeez";
import { jsx } from "svjeez/jsx-runtime";
import { mapPaint, schemeCss, sides, transparent, variable } from "./scheme.ts";
import type { Timing, Wait } from "./flow.ts";
import type { Box, Item, Paint, Radii, Rect, Snapshot, TextRun, Vector } from "./tree.ts";

type GroupStack = Stack<TagChannels<"g">>;

type Parts = Readonly<Record<string, GroupStack | ((index: number) => GroupStack)>>;

/**
 * A state, with how the timeline moves into it if not the default, or a wait. What `card.run` gives, and what
 * `<Dom states>` plays.
 */
export type Step = Snapshot | readonly [Snapshot, Timing] | Wait;

export interface DomProps {
  /** One snapshot draws statically. Several play in order, each turning into the next, with waits between. */
  readonly states: Snapshot | readonly Step[];
  /** The fonts the page used, so the drawn text matches the layout. */
  readonly fonts?: readonly FontValue[];
  /** The ease of a move whose step has none. Default `ease.inOut`. */
  readonly ease?: Ease;
  /** Motions by part. A function gets each element with that part, in document order. */
  readonly parts?: Parts;
  /** Runs on every text line, as in `(run, i) => enter(...)`. Only on a single snapshot. */
  readonly text?: (run: TextRun, index: number) => Stack<TagChannels<"text">> | undefined;
  /** Overrides how elements pair across states: boxes that get the same string pair, whatever their tag. */
  readonly pair?: (box: Box) => string | undefined;
  readonly x?: number;
  readonly y?: number;
  readonly animation?: GroupStack;
}

interface Tween {
  readonly at: number;
  readonly over: number;
  readonly ease: Ease;
}

/** A rounded rectangle with a radius per corner. Corners are always arcs, so any two of these morph into each other. */
const rounded = ({ x, y, width: w, height: h }: Rect, [tl, tr, br, bl]: Radii): string => {
  const arc = (r: number, ex: number, ey: number) =>
    `A${num(r)} ${num(r)} 0 0 1 ${num(ex)} ${num(ey)}`;

  return (
    `M${num(x + tl)} ${num(y)}H${num(x + w - tr)}${arc(tr, x + w, y + tr)}V${num(y + h - br)}${arc(br, x + w - br, y + h)}` +
    `H${num(x + bl)}${arc(bl, x, y + h - bl)}V${num(y + tl)}${arc(tl, x + tl, y)}Z`
  );
};

const grow = ({ x, y, width, height }: Rect, by: number, dx = 0, dy = 0): Rect => ({
  x: x - by + dx,
  y: y - by + dy,
  width: Math.max(0, width + 2 * by),
  height: Math.max(0, height + 2 * by),
});

const shrinkRadii = (r: Radii, [t, ri, b, l]: readonly number[]): Radii => [
  Math.max(0, r[0] - Math.max(t!, l!)),
  Math.max(0, r[1] - Math.max(t!, ri!)),
  Math.max(0, r[2] - Math.max(b!, ri!)),
  Math.max(0, r[3] - Math.max(b!, l!)),
];

const growRadii = (r: Radii, by: number): Radii => [
  Math.max(0, r[0] + by),
  Math.max(0, r[1] + by),
  Math.max(0, r[2] + by),
  Math.max(0, r[3] + by),
];

const contentOf = (b: Box): { rect: Rect; radii: Radii } => {
  const widths = b.border?.widths ?? [0, 0, 0, 0];
  const [t, r, bo, l] = widths;

  return {
    rect: {
      x: b.box.x + l,
      y: b.box.y + t,
      width: b.box.width - l - r,
      height: b.box.height - t - bo,
    },
    radii: shrinkRadii(b.radii, widths),
  };
};

/** Where the element's own outer shadows are drawn: everywhere but its border box. */
const outsideOf = (b: Box, region: Rect): string =>
  rounded(region, [0, 0, 0, 0]) + rounded(b.box, b.radii);

/** Everything a shadow can paint: its shape plus three standard deviations of blur. */
const shadowBounds = (b: Box, i: number): Rect => {
  const s = b.shadows[i]!;

  return grow(b.box, s.spread + 1.5 * s.blur + 1, s.x, s.y);
};

const union = (rects: readonly Rect[]): Rect | undefined => {
  if (rects.length === 0) return undefined;
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));

  return {
    x,
    y,
    width: Math.max(...rects.map((r) => r.x + r.width)) - x,
    height: Math.max(...rects.map((r) => r.y + r.height)) - y,
  };
};

const opaque = (color: Paint | undefined): boolean =>
  color !== undefined && sides(color).every((c) => c.startsWith("rgb("));

const invisible = (color: Paint): boolean => sides(color).every((c) => /,\s*0\)$/.test(c));

/** The same color with nothing showing, so a fill one side lacks fades as a color change. */
const clear = (color: Paint): Paint => mapPaint(color, transparent);

/** Both boxes with the same number of shadows: the missing ones are clear copies of the other side's. */
const padShadows = (a: Box, b: Box): [Box, Box] => {
  const n = Math.max(a.shadows.length, b.shadows.length);

  const pad = (own: Box, other: Box): Box => ({
    ...own,
    shadows: Array.from({ length: n }, (_, i) => {
      const s = own.shadows[i] ?? other.shadows[i]!;

      return own.shadows[i] ? s : { ...s, color: clear(s.color) };
    }),
  });

  return [pad(a, b), pad(b, a)];
};

const shadowPath = (b: Box, i: number, extra = 0): string => {
  const s = b.shadows[i]!;
  const by = s.spread + extra;

  return rounded(grow(b.box, by, s.x, s.y), growRadii(b.radii, by));
};

/** How many nested copies stand in for a blur: one for a hard shadow, up to six for a soft one. */
const layersFor = (blur: number): number =>
  blur <= 0 ? 1 : Math.min(6, Math.max(2, Math.round(blur)));

/** Copy k of n spreads from -blur to +blur, so together they ramp off like the blur's edge. */
const spreadAt = (blur: number, k: number, n: number): number =>
  n === 1 ? 0 : blur * ((2 * k + 1) / n - 1) * 0.8;

/** The alpha each of n stacked copies needs so the middle, where all overlap, matches the shadow's color. */
const layerColor = (color: Paint, n: number): Paint =>
  n === 1
    ? color
    : mapPaint(color, (c) => {
        const [r = 0, g = 0, b = 0, a = 1] = (c.match(/[\d.]+/g) ?? []).map(Number);

        return `rgba(${r},${g},${b},${Math.round((1 - (1 - a) ** (1 / n)) * 1000) / 1000})`;
      });

/**
 * What two children must share to pair up: a key, else a part, else the tag. Classes don't count, because a state
 * change is often a class change and that element should morph. Text pairs with text, in order.
 */
const signature = (it: Item, pair?: (box: Box) => string | undefined): string => {
  if (it.kind !== "box") return it.kind;
  const own = pair?.(it);

  if (own !== undefined) return `pair:${own}`;

  if (it.key !== undefined) return `key:${it.key}`;

  return it.part !== undefined ? `#${it.part}` : it.tag;
};

/** All the text under an item, so siblings that share a signature can be told apart by what they say. */
const textOf = (it: Item): string =>
  it.kind === "text" ? it.text : it.kind === "box" ? it.children.map(textOf).join(" ") : "";

/** How alike two texts are, from 0 to 1: the words they share over the words either has. */
const likeness = (a: string, b: string): number => {
  if (a === b) return 1;
  const x = new Set(a.split(/\s+/).filter(Boolean));
  const y = new Set(b.split(/\s+/).filter(Boolean));
  const shared = [...x].filter((w) => y.has(w)).length;

  return shared / (x.size + y.size - shared || 1);
};

/**
 * Pairs two lists of siblings by their longest common run of signatures, so an element inserted in the middle leaves
 * the ones around it paired. Among pairings of the same length, the one whose pairs say the most alike wins, so a
 * `<div>` inserted before another `<div>` doesn't take its place. Unpaired items come back with the other side
 * undefined, in drawing order.
 */
const align = (
  olds: readonly Item[],
  news: readonly Item[],
  pair?: (box: Box) => string | undefined,
): [Item | undefined, Item | undefined][] => {
  const a = olds.map((it) => signature(it, pair));
  const b = news.map((it) => signature(it, pair));
  const ta = olds.map(textOf);
  const tb = news.map(textOf);
  // A pair counts 1, plus a likeness bonus too small for all of them together to outweigh one more pair.
  const bonus = 0.5 / (Math.min(a.length, b.length) + 1);
  const weight = (i: number, j: number) => 1 + bonus * likeness(ta[i]!, tb[j]!);
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));

  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i]![j] = Math.max(
        a[i] === b[j] ? lcs[i + 1]![j + 1]! + weight(i, j) : 0,
        lcs[i + 1]![j]!,
        lcs[i]![j + 1]!,
      );

  const out: [Item | undefined, Item | undefined][] = [];
  let i = 0;
  let j = 0;

  while (i < a.length || j < b.length) {
    if (
      i < a.length &&
      j < b.length &&
      a[i] === b[j] &&
      lcs[i]![j]! === lcs[i + 1]![j + 1]! + weight(i, j)
    )
      out.push([olds[i++], news[j++]]);
    else if (j < b.length && (i >= a.length || lcs[i]![j + 1]! >= lcs[i + 1]![j]!))
      out.push([undefined, news[j++]]);
    else out.push([olds[i++], undefined]);
  }

  return out;
};

/** Code points, so a character outside the BMP types as one keystroke. */
const chars = (s: string): string[] => Array.from(s);

/** What a field shows as typed: a placeholder is an empty field. */
const shown = (run: TextRun): string => (run.placeholder ? "" : run.text);

const sameFace = (a: TextRun, b: TextRun): boolean =>
  a.size === b.size &&
  a.weight === b.weight &&
  a.family === b.family &&
  a.style === b.style &&
  a.letterSpacing === b.letterSpacing;

/** One text grew from or shrank to the other, and the longer one knows where its characters end. */
const typable = (a: TextRun, b: TextRun): boolean => {
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
const blank = (run: TextRun, from: Rect, to: Rect): TextRun => ({
  ...run,
  x: run.x + to.x - from.x,
  y: run.y + to.y - from.y,
  text: "",
  advances: [],
  placeholder: false,
});

const FIELDS = new Set(["input", "textarea"]);

/** At most this many values between two counted numbers, so a big jump stays a few keyframes. */
const MAX_COUNTS = 20;

interface Count {
  readonly before: string;
  readonly after: string;
  readonly from: number;
  readonly to: number;
  readonly format: (n: number) => string;
}

const NUMBER = /(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/;

/** The one number that differs between two texts that are otherwise the same, written as the texts write it. */
const countOf = (a: string, b: string): Count | undefined => {
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

/** The drawing code for `Dom`. */
const painter = (
  fonts: readonly FontValue[],
  parts: Parts,
  pairOf?: (box: Box) => string | undefined,
) => {
  // The variables the drawn paints need, so the scene defines those and no others.
  const used = new Map<string, Exclude<Paint, string>>();

  /** A paint as CSS: the color, or the variable that follows the viewer's scheme. */
  const v = (color: Paint): string => {
    if (typeof color === "string") return color;
    const name = variable(color);
    used.set(name, color);

    return `var(--${name})`;
  };

  // Faces that share a family name become one family, so `font-weight` picks among them as on the page.
  const byName = new Map<string, FontValue>();
  const grouped = new Map<string, Font[]>();

  for (const value of fonts) {
    if ("faces" in value) byName.set(value.name, value);
    else grouped.set(value.family, [...(grouped.get(value.family) ?? []), value]);
  }

  for (const [name, faces] of grouped)
    byName.set(name, faces.length === 1 ? faces[0]! : font.family(...(faces as [Font, ...Font[]])));

  const seen = new Map<string, number>();

  const partMotion = (b: Box): GroupStack | undefined => {
    if (b.part === undefined) return undefined;
    const index = seen.get(b.part) ?? 0;
    seen.set(b.part, index + 1);
    const m = parts[b.part];

    return typeof m === "function" ? m(index) : m;
  };

  const text = (run: TextRun, animation?: Stack<TagChannels<"text">>): SvgNode =>
    jsx("text", {
      x: num(run.x),
      y: num(run.y),
      fontFamily: byName.get(run.family) ?? run.family,
      fontSize: num(run.size),
      fontWeight: String(run.weight),
      fontStyle: run.style === "italic" ? "italic" : undefined,
      letterSpacing: run.letterSpacing ? num(run.letterSpacing) : undefined,
      fill: v(run.color),
      animation,
      children: run.text,
    } as never);

  const vector = ({ tag, attrs, children }: Vector): SvgNode =>
    jsx(tag, {
      ...Object.fromEntries(
        Object.entries(attrs).map(([k, value]) => [
          k.replace(/-(\w)/g, (_, c: string) => c.toUpperCase()),
          v(value),
        ]),
      ),
      children: children.map(vector),
    } as never);

  /** Path data, a fill, and optionally where both start from. */
  const path = (
    d: string,
    fill: string,
    from?: { d: string; fill: string },
    tween?: Tween,
    extra: Record<string, unknown> = {},
  ): SvgNode => {
    const moving = from && tween && (from.d !== d || from.fill !== fill);

    const animation = moving
      ? motion({ d: from.d as never, fill: from.fill as never })
          .at(tween.at)
          .to({ d: d as never, fill: fill as never }, tween.over, tween.ease)
      : undefined;

    return jsx("path", {
      d: (moving ? from.d : d) as never,
      fill: moving ? from.fill : fill,
      ...extra,
      animation,
    } as never);
  };

  const item = (
    it: Item,
    textMotion?: (run: TextRun) => Stack<TagChannels<"text">> | undefined,
  ): SvgNode => {
    switch (it.kind) {
      case "text":
        return text(it, textMotion?.(it));
      case "graphic": {
        const [vx, vy, vw, vh] = it.viewBox;
        const t = `translate(${num(it.box.x)} ${num(it.box.y)}) scale(${num(it.box.width / vw)} ${num(it.box.height / vh)}) translate(${num(-vx)} ${num(-vy)})`;

        return <g transform={t}>{it.children.map(vector)}</g>;
      }

      case "image": {
        const clip = it.radii.some((r) => r > 0)
          ? def.clipPath({}, <path d={rounded(it.box, it.radii)} />)
          : undefined;

        return jsx("image", {
          href: it.href,
          x: num(it.box.x),
          y: num(it.box.y),
          width: num(it.box.width),
          height: num(it.box.height),
          clipPath: clip,
        } as never);
      }

      case "box":
        return box(it, undefined, undefined, textMotion);
    }
  };

  /**
   * Opacity over part of the tween. An element that leaves goes in the first half and one that arrives comes in the
   * second, so neither overlaps siblings still sliding. Two versions of one element swap in the middle.
   */
  const WINDOWS = {
    exit: [0, 0.5, 1, 0],
    enter: [0.5, 0.5, 0, 1],
    swapOut: [0.2, 0.5, 1, 0],
    swapIn: [0.2, 0.5, 0, 1],
  } as const;

  const fade = (tween: Tween, mode: keyof typeof WINDOWS) => {
    const [start, length, from, to] = WINDOWS[mode];

    return motion({ opacity: from })
      .at(tween.at + start * tween.over)
      .to({ opacity: to }, length * tween.over, tween.ease);
  };

  const center = (it: Item) => (it.kind === "text" ? { x: it.x, y: it.y } : it.box);

  /**
   * One run typed into or deleted from: the longer text drawn once behind a clip whose width steps from character to
   * character, with a caret at its edge. A placeholder leaves at the first keystroke and comes back at the last.
   */
  const typing = (a: TextRun, b: TextRun, tween: Tween): SvgNode => {
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
      } as never),
    );

    return (
      <>
        {a.placeholder && text(a, motion({ opacity: 1 }).at(tween.at).set({ opacity: 0 }))}
        {b.placeholder && text(b, motion({ opacity: 0 }).at(times.at(-1)!).set({ opacity: 1 }))}
        <g
          animation={
            dx || dy
              ? motion({ x: dx, y: dy }).at(tween.at).to({ x: 0, y: 0 }, tween.over, tween.ease)
              : undefined
          }
        >
          <g clipPath={clip}>
            {text(
              { ...long, x: b.x, y: b.y },
              recolor
                ? motion({ fill: v(a.color) as never })
                    .at(tween.at)
                    .to({ fill: v(b.color) as never }, tween.over, tween.ease)
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
          } as never)}
        </g>
      </>
    );
  };

  /** One run whose only change is a number: the in-between values, each shown for its slice of the tween. */
  const counting = (a: TextRun, b: TextRun, change: Count, tween: Tween): SvgNode => {
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

          return text(
            run,
            show(k === slices ? { at } : { at, over: switchAt(k + 1) - at }, { fade: 0 }),
          );
        })}
      </>
    );
  };

  /** Two versions of one leaf: slide from the old place to the new, crossfading when they differ. */
  const pair = (a: Item, b: Item, tween: Tween): SvgNode => {
    const from = center(a);
    const to = center(b);
    const dx = from.x - to.x;
    const dy = from.y - to.y;

    if (
      a.kind === "text" &&
      b.kind === "text" &&
      a.text === b.text &&
      a.size === b.size &&
      a.weight === b.weight &&
      a.family === b.family
    )
      return dx === 0 && dy === 0 && v(a.color) === v(b.color)
        ? text(b)
        : text(
            b,
            motion({ x: dx, y: dy, fill: v(a.color) as never })
              .at(tween.at)
              .to({ x: 0, y: 0, fill: v(b.color) as never }, tween.over, tween.ease),
          );

    if (a.kind === "text" && b.kind === "text" && sameFace(a, b)) {
      if (typable(a, b)) return typing(a, b, tween);
      const change = !a.placeholder && !b.placeholder && countOf(a.text, b.text);

      if (change) return counting(a, b, change, tween);
    }

    if (
      a.kind === "graphic" &&
      b.kind === "graphic" &&
      JSON.stringify(a.children) === JSON.stringify(b.children)
    )
      return (
        <g
          animation={motion({ x: dx, y: dy })
            .at(tween.at)
            .to({ x: 0, y: 0 }, tween.over, tween.ease)}
        >
          {item(b)}
        </g>
      );

    return (
      <>
        <g
          animation={[
            motion({ x: 0, y: 0 }).at(tween.at).to({ x: -dx, y: -dy }, tween.over, tween.ease),
            fade(tween, "swapOut"),
          ]}
        >
          {item(a)}
        </g>
        <g
          animation={[
            motion({ x: dx, y: dy }).at(tween.at).to({ x: 0, y: 0 }, tween.over, tween.ease),
            fade(tween, "swapIn"),
          ]}
        >
          {item(b)}
        </g>
      </>
    );
  };

  /** One element. With `a` and `tween`, it starts as `a` and becomes `b`. */
  const box = (
    b: Box,
    a?: Box,
    tween?: Tween,
    textMotion?: (run: TextRun) => Stack<TagChannels<"text">> | undefined,
  ): SvgNode => {
    const both = a && tween ? { a, tween } : undefined;
    const content = contentOf(b);
    const before = both && contentOf(both.a);
    const clipD = rounded(content.rect, content.radii);
    const clipFrom = before && rounded(before.rect, before.radii);
    const clipped = b.clip || (both?.a.clip ?? false);

    const clip = clipped
      ? def.clipPath(
          {},
          path(
            clipD,
            "#000",
            clipFrom === undefined ? undefined : { d: clipFrom, fill: "#000" },
            tween,
          ),
        )
      : undefined;

    // CSS draws an outer shadow only outside the border box. Under an opaque background nothing shows anyway, so
    // only a box you can see through needs the mask that cuts it out.
    const boxes = both ? [both.a, b] : [b];
    const anyShadows = boxes.some((x) => x.shadows.length > 0);
    const seeThrough = boxes.some((x) => !opaque(x.background));
    const reach = union(boxes.flatMap((x) => x.shadows.map((_, i) => shadowBounds(x, i))));

    const mask =
      anyShadows && seeThrough && reach
        ? def.mask(
            {
              maskUnits: "userSpaceOnUse",
              x: num(reach.x),
              y: num(reach.y),
              width: num(reach.width),
              height: num(reach.height),
            } as never,
            path(
              outsideOf(b, reach),
              "#fff",
              both && { d: outsideOf(both.a, reach), fill: "#fff" },
              tween,
              {
                fillRule: "evenodd",
              },
            ),
          )
        : undefined;

    const shadowNodes = (end: Box, start?: Box): SvgNode[] => {
      if (!start) return draw(end);
      const [a, b] = padShadows(start, end);

      return draw(b, a);
    };

    // A blurred shadow is drawn as a few nested, faint copies instead of through a filter. A filter on a moving shape
    // re-blurs every frame at the zoomed size, which is what made zooming in stutter; plain paths stay cheap.
    const draw = (owner: Box, from?: Box): SvgNode[] =>
      owner.shadows
        .flatMap((s, i) => {
          if (invisible(s.color) && (!from || invisible(from.shadows[i]!.color))) return [];
          const was = from?.shadows[i];
          const n = layersFor(Math.max(s.blur, was?.blur ?? 0));

          return Array.from({ length: n }, (_, k) =>
            path(
              shadowPath(owner, i, spreadAt(s.blur, k, n)),
              v(layerColor(s.color, n)),
              from &&
                was && {
                  d: shadowPath(from, i, spreadAt(was.blur, k, n)),
                  fill: v(layerColor(was.color, n)),
                },
              tween,
            ),
          );
        })
        .reverse();

    const shadows = both ? shadowNodes(b, both.a) : shadowNodes(b);

    // A fill that only one side has fades, drawn on the shape of the side that has it.
    const layer = (
      pick: (x: Box) => Paint | undefined,
      shape: (x: Box) => string,
      extra: Record<string, unknown> = {},
    ): Child => {
      const end = pick(b);
      const start = both && pick(both.a);

      if (!both) return end ? path(shape(b), v(end), undefined, undefined, extra) : null;

      const from = (fill: Paint) => ({ d: shape(both.a), fill: v(fill) });

      if (end && start) return path(shape(b), v(end), from(start), tween, extra);

      if (end) return path(shape(b), v(end), from(clear(end)), tween, extra);

      if (start) return path(shape(b), v(clear(start)), from(start), tween, extra);

      return null;
    };

    const ring = (x: Box) => {
      const c = contentOf(x);

      return rounded(x.box, x.radii) + rounded(c.rect, c.radii);
    };

    let children: SvgNode[];

    if (!both) children = b.children.map((it) => item(it, textMotion));
    else {
      children = align(both.a.children, b.children, pairOf).map(([old, it]) => {
        // Text that appears in or leaves a field is typed in or deleted.
        if (!it && old!.kind === "text" && FIELDS.has(both.a.tag)) {
          const gone = blank(old!, both.a.box, b.box);

          if (typable(old!, gone)) return typing(old!, gone, both.tween);
        }

        if (!old && it!.kind === "text" && FIELDS.has(b.tag)) {
          const empty = blank(it!, b.box, both.a.box);

          if (typable(empty, it!)) return typing(empty, it!, both.tween);
        }

        if (!it) return <g animation={fade(both.tween, "exit")}>{item(old!)}</g>;

        if (!old) return <g animation={fade(both.tween, "enter")}>{item(it)}</g>;

        if (old.kind === "box" && it.kind === "box") return box(it, old, both.tween);

        if (old.kind === it.kind) return pair(old, it, both.tween);

        return (
          <>
            <g animation={fade(both.tween, "swapOut")}>{item(old)}</g>
            <g animation={fade(both.tween, "swapIn")}>{item(it)}</g>
          </>
        );
      });
    }

    const opacity =
      both && both.a.opacity !== b.opacity
        ? motion({ opacity: both.a.opacity })
            .at(both.tween.at)
            .to({ opacity: b.opacity }, both.tween.over, both.tween.ease)
        : undefined;

    return (
      <g
        opacity={!opacity && b.opacity < 1 ? b.opacity : undefined}
        animation={[...[partMotion(b)].flat(), opacity] as GroupStack}
      >
        {anyShadows && (mask ? <g mask={mask}>{shadows}</g> : shadows)}
        {layer(
          (x) => x.background,
          (x) => rounded(x.box, x.radii),
        )}
        {layer((x) => x.border?.color, ring, { fillRule: "evenodd" })}
        {clip ? <g clipPath={clip}>{children}</g> : children}
      </g>
    );
  };

  /** The rule that defines the variables drawn so far. */
  const style = (): SvgNode | null => {
    const css = schemeCss(used);

    return css ? <Style css={css} /> : null;
  };

  /** A whole tree, as `b`, or as `a` turning into `b`. */
  const root = (
    b: Box,
    a?: Box,
    tween?: Tween,
    textMotion?: (run: TextRun) => Stack<TagChannels<"text">> | undefined,
  ) => {
    seen.clear();

    return box(b, a, tween, textMotion);
  };

  return { root, text, style };
};

const at = (x: number, y: number) => (x || y ? `translate(${num(x)} ${num(y)})` : undefined);

/** Default length of a move into a snapshot. */
const OVER = 0.6;

const isWait = (step: Step): step is Wait => "wait" in step;

/**
 * Walks a cursor over the steps: the first snapshot holds from 0, each later one moves in from where the cursor is
 * and leaves it at the move's end, and a wait pushes it on.
 */
const timeline = (states: Snapshot | readonly Step[]) => {
  const snaps: Snapshot[] = [];
  const moves: { at: number; over: number; ease?: Ease }[] = [];
  let cursor = 0;

  for (const step of "root" in states ? [states] : states) {
    if (isWait(step)) {
      if (snaps.length === 0)
        throw new Error("<Dom> a wait comes before the first state, but nothing is drawn yet.");

      if (!(step.wait >= 0)) throw new Error(`<Dom> needs a wait of 0 or more, got ${step.wait}.`);
      cursor += step.wait;
      continue;
    }

    const [state, timing] = "root" in step ? [step, undefined] : step;

    if (snaps.length === 0 && timing)
      throw new Error(
        "<Dom> the first state has timing, but nothing moves into it. Put it on the next state.",
      );

    if (snaps.length > 0) {
      const over = timing?.over ?? OVER;

      if (!(over > 0)) throw new Error(`<Dom> needs a positive over, got ${over}.`);
      moves.push({ at: cursor, over, ease: timing?.ease });
      cursor += over;
    }

    snaps.push(state);
  }

  return { snaps, moves, length: cursor };
};

/** The picture's size: the largest of the states, so one frame holds them all. */
export const size = (states: Snapshot | readonly Step[]): { width: number; height: number } => {
  const all = timeline(states).snaps;

  return {
    width: Math.max(...all.map((s) => s.width)),
    height: Math.max(...all.map((s) => s.height)),
  };
};

/** Seconds from the first state to the end of the last move or wait, so a scene can pick its duration. */
export const duration = (states: Snapshot | readonly Step[]): number => timeline(states).length;

/**
 * Draws snapshots as svjeez nodes: one `<g>` per element, text in the page's own fonts. With several states, each
 * turns into the next. Paired boxes reshape and recolor, paired text and icons slide (crossfading when they changed),
 * and the rest fade out or in. Time starts at 0 on the clock around it, so a `<Clip at>` places a whole flow.
 *
 * Transition `i` is one two-state drawing, shown from the middle of the gap before it to the middle of the gap after,
 * so only one is up at a time and the cut between two shows the same picture on both sides.
 */
export function Dom({
  states,
  fonts = [],
  ease = eases.inOut,
  parts = {},
  text,
  pair,
  x = 0,
  y = 0,
  animation,
}: DomProps): SvgNode {
  const paint = painter(fonts, parts, pair);
  const { snaps, moves } = timeline(states);

  if (snaps.length === 0) throw new Error("<Dom> needs at least one state.");

  let segments: SvgNode[];

  if (snaps.length === 1) {
    let lines = 0;

    segments = [
      paint.root(snaps[0]!.root, undefined, undefined, text && ((run) => text(run, lines++))),
    ];
  } else {
    if (text) throw new Error("<Dom text> works on a single snapshot, not on states.");

    const tweens: Tween[] = moves.map((m) => ({ at: m.at, over: m.over, ease: m.ease ?? ease }));

    // Where each hand-over happens: halfway between one transition's end and the next one's start.
    const cuts = tweens.slice(1).map((next, i) => (tweens[i]!.at + tweens[i]!.over + next.at) / 2);

    segments = tweens.map((tween, i) => {
      const drawn = paint.root(snaps[i + 1]!.root, snaps[i]!.root, tween);

      if (tweens.length === 1) return drawn;
      const from = i === 0 ? 0 : cuts[i - 1]!;
      const to = i === cuts.length ? undefined : cuts[i]!;

      return (
        <g
          animation={show(to === undefined ? { at: from } : { at: from, over: to - from }, {
            fade: 0,
          })}
        >
          {drawn}
        </g>
      );
    });
  }

  return (
    <g transform={at(x, y)} animation={animation}>
      {paint.style()}
      {segments}
    </g>
  );
}
