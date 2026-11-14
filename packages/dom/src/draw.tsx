/** @jsxImportSource svjeez */
/** @jsxRuntime automatic */
import {
  def,
  ease as eases,
  font,
  motion,
  num,
  type Child,
  Style,
  type Ease,
  type Font,
  type FontValue,
  type Ref,
  type Stack,
  type SvgNode,
  type TagChannels,
} from "svjeez";
import { jsx } from "svjeez/jsx-runtime";
import { mapColor, schemeCss, sides } from "./scheme.ts";
import type { Snapshot } from "./snapshot.ts";
import type { Box, Item, Radii, Rect, TextRun, Vector } from "./tree.ts";

type GroupStack = Stack<TagChannels<"g">>;

type Parts = Readonly<Record<string, GroupStack | ((index: number) => GroupStack)>>;

export interface DomProps {
  readonly snapshot: Snapshot;
  readonly x?: number;
  readonly y?: number;
  /** Motions by `data-part`. A function gets each element with that part, in document order. */
  readonly parts?: Parts;
  /** Runs on every text line, as in `(run, i) => enter(...)`. */
  readonly text?: (run: TextRun, index: number) => Stack<TagChannels<"text">> | undefined;
  readonly animation?: GroupStack;
}

export interface MorphProps {
  readonly from: Snapshot;
  readonly to: Snapshot;
  /** When the change starts, on the clock around it. */
  readonly at: number;
  /** Default 0.6. */
  readonly over?: number;
  /** Default `ease.inOut`. */
  readonly ease?: Ease;
  readonly x?: number;
  readonly y?: number;
  readonly parts?: Parts;
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

const opaque = (color: string | undefined): boolean =>
  color !== undefined && sides(color).every((c) => c.startsWith("rgb("));

const invisible = (color: string): boolean => sides(color).every((c) => /,\s*0\)$/.test(c));

/** The same color with nothing showing, so a fill one side lacks fades as a color change. */
const clear = (color: string): string =>
  mapColor(color, (c) => {
    const [r = 0, g = 0, b = 0] = (c.match(/[\d.]+/g) ?? []).map(Number);

    return `rgba(${r},${g},${b},0)`;
  });

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
const layerColor = (color: string, n: number): string =>
  n === 1
    ? color
    : mapColor(color, (c) => {
        const [r = 0, g = 0, b = 0, a = 1] = (c.match(/[\d.]+/g) ?? []).map(Number);

        return `rgba(${r},${g},${b},${Math.round((1 - (1 - a) ** (1 / n)) * 1000) / 1000})`;
      });

/** What two children must share to pair up: a part, or a tag and classes. Text pairs with text, in order. */
const signature = (it: Item): string =>
  it.kind === "box" ? (it.part !== undefined ? `#${it.part}` : `${it.tag}.${it.classes}`) : it.kind;

/**
 * Pairs two lists of siblings by their longest common run of signatures, so an element inserted in the middle leaves
 * the ones around it paired. Unpaired items come back with the other side undefined, in drawing order.
 */
const align = (
  olds: readonly Item[],
  news: readonly Item[],
): [Item | undefined, Item | undefined][] => {
  const a = olds.map(signature);
  const b = news.map(signature);
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));

  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i]![j] =
        a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);

  const out: [Item | undefined, Item | undefined][] = [];
  let i = 0;
  let j = 0;

  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) out.push([olds[i++], news[j++]]);
    else if (j < b.length && (i >= a.length || lcs[i]![j + 1]! >= lcs[i + 1]![j]!))
      out.push([undefined, news[j++]]);
    else out.push([olds[i++], undefined]);
  }

  return out;
};

/** The shared drawing code for `Dom` and `Morph`. */
const painter = (fonts: readonly FontValue[], parts: Parts) => {
  // Every color drawn, so the scene gets the variables its adaptive ones need and no others.
  const used = new Set<string>();

  const use = <T extends string | undefined>(color: T): T => {
    if (color) used.add(color);

    return color;
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
      fill: use(run.color),
      animation,
      children: run.text,
    } as never);

  const vector = ({ tag, attrs, children }: Vector): SvgNode =>
    jsx(tag, {
      ...Object.fromEntries(
        Object.entries(attrs).map(([k, v]) => [
          k.replace(/-(\w)/g, (_, c: string) => c.toUpperCase()),
          k === "fill" || k === "stroke" ? use(v) : v,
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
    use(fill);
    use(from?.fill);
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
      return dx === 0 && dy === 0 && a.color === b.color
        ? text(b)
        : text(
            b,
            motion({ x: dx, y: dy, fill: a.color as never })
              .at(tween.at)
              .to({ x: 0, y: 0, fill: b.color as never }, tween.over, tween.ease),
          );

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
              layerColor(s.color, n),
              from &&
                was && {
                  d: shadowPath(from, i, spreadAt(was.blur, k, n)),
                  fill: layerColor(was.color, n),
                },
              tween,
            ),
          );
        })
        .reverse();

    const shadows = both ? shadowNodes(b, both.a) : shadowNodes(b);

    // A fill that only one side has fades, drawn on the shape of the side that has it.
    const layer = (
      pick: (x: Box) => string | undefined,
      shape: (x: Box) => string,
      extra: Record<string, unknown> = {},
    ): Child => {
      const end = pick(b);
      const start = both && pick(both.a);

      if (!both) return end ? path(shape(b), end, undefined, undefined, extra) : null;

      if (end && start) return path(shape(b), end, { d: shape(both.a), fill: start }, tween, extra);

      if (end) return path(shape(b), end, { d: shape(both.a), fill: clear(end) }, tween, extra);

      if (start)
        return path(shape(b), clear(start), { d: shape(both.a), fill: start }, tween, extra);

      return null;
    };

    const ring = (x: Box) => {
      const c = contentOf(x);

      return rounded(x.box, x.radii) + rounded(c.rect, c.radii);
    };

    let children: SvgNode[];

    if (!both) children = b.children.map((it) => item(it, textMotion));
    else {
      children = align(both.a.children, b.children).map(([old, it]) => {
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
        class={b.part}
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

  /** The rule that defines the adaptive colors drawn so far. */
  const style = (): SvgNode | null => {
    const css = schemeCss(used);

    return css ? <Style css={css} /> : null;
  };

  return { box, text, style };
};

const at = (x: number, y: number) => (x || y ? `translate(${num(x)} ${num(y)})` : undefined);

/** Draws a snapshot as svjeez nodes: one `<g>` per element, text in the page's own fonts. */
export function Dom({ snapshot, x = 0, y = 0, parts = {}, text, animation }: DomProps): SvgNode {
  const paint = painter(snapshot.fonts, parts);
  let lines = 0;

  const drawn = paint.box(
    snapshot.root,
    undefined,
    undefined,
    text && ((run) => text(run, lines++)),
  );

  return (
    <g transform={at(x, y)} animation={animation}>
      {paint.style()}
      {drawn}
    </g>
  );
}

/**
 * Two snapshots of the same markup in two states, drawn as one picture that changes from the first to the second.
 * Elements pair up by `data-part`, else by their place in the tree. Paired boxes reshape and recolor, paired text and
 * icons slide (crossfading when they changed), and the rest fade out or in.
 */
export function Morph({
  from,
  to,
  at: start,
  over = 0.6,
  ease = eases.inOut,
  x = 0,
  y = 0,
  parts = {},
  animation,
}: MorphProps): SvgNode {
  const paint = painter([...new Set([...from.fonts, ...to.fonts])], parts);

  const drawn = paint.box(to.root, from.root, { at: start, over, ease });

  return (
    <g transform={at(x, y)} animation={animation}>
      {paint.style()}
      {drawn}
    </g>
  );
}
