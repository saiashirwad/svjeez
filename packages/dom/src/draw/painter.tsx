/** @jsxImportSource svjeez */
/** @jsxRuntime automatic */
import {
  def,
  motion,
  Style,
  span,
  type Attrs,
  type Child,
  type Color,
  type FontValue,
  type PathData,
  type Ref,
  type Stack,
  type SvgNode,
  type TagChannels,
} from "svjeez";
import { num } from "svjeez/geometry";
import { jsx } from "svjeez/jsx-runtime";
import { clear, invisible, isPair, opaque, schemeCss, variable } from "../paint.ts";
import type {
  Box,
  Face,
  Item,
  Paint,
  Pair,
  Placement,
  Rect,
  Shadow,
  TextRun,
  Vector,
} from "../tree.ts";

/** Generic and system font names: not files the drawing can embed. */
const SYSTEM =
  /^(system-ui|ui-[\w-]+|-apple-system|BlinkMacSystemFont|sans-serif|serif|monospace|cursive|fantasy)$/;

import { typefaces } from "./faces.ts";
import { defines, keyOf, moving, settles } from "./hold.ts";
import {
  borderRing,
  morphable,
  offset,
  shifted,
  outlineRing,
  matrix,
  paddingBox,
  rounded,
  shadowBounds,
  spills,
  union,
} from "./geometry.ts";
import { paintServers } from "./gradients.ts";
import {
  align,
  carriedOf,
  movesOf,
  runsOf,
  sameFace,
  sameTransform,
  insideOf,
  without,
  type Boxed,
  type Carried,
  type Moves,
  type PairBy,
} from "./pairing.ts";
import {
  fainter,
  insetPieces,
  outerPieces,
  outside,
  padInsets,
  padShadows,
  type Fill,
  type Piece,
} from "./shadows.ts";
import { blank, countOf, counting, FIELDS, typable, typing, type Ink } from "./text.tsx";
import { fade, slideIn, type Tween } from "./tween.ts";

export type GroupStack = Stack<TagChannels<"g">>;

/** Motions by part. A function gets each element with that part, in document order. */
export type Parts = Readonly<Record<string, GroupStack | ((index: number) => GroupStack)>>;

/** Motions for text lines, on a single snapshot. */
export type TextMotion = (run: TextRun) => Stack<TagChannels<"text">> | undefined;

/** A path's shape and fill where a tween starts. */
interface From {
  readonly d: PathData;
  readonly fill: Color;
}

/** Path attributes beyond its shape and fill. */
interface Extra {
  readonly fillRule?: "evenodd";
}

const within = (r: Rect, outer: Rect): boolean =>
  r.x >= outer.x &&
  r.y >= outer.y &&
  r.x + r.width <= outer.x + outer.width &&
  r.y + r.height <= outer.y + outer.height;

/** Whether a node draws nothing: no marks, only groups and fragments around none. */
const drawsNothing = (node: SvgNode | readonly SvgNode[]): boolean =>
  "kind" in node
    ? node.kind === "fragment"
      ? node.children.every(drawsNothing)
      : node.kind === "element"
        ? node.tag === "g" && node.children.every(drawsNothing)
        : node.kind === "text" && node.value.trim() === ""
    : node.every(drawsNothing);

/** A group that carries `animation` around `node`, or nothing when `node` draws nothing: an empty animated group is dead weight in the file and in the browser. */
const animated = (
  animation: Stack<TagChannels<"g">>,
  node: SvgNode | readonly SvgNode[],
): SvgNode => (drawsNothing(node) ? <></> : <g animation={animation}>{node}</g>);

const transformed = (it: Boxed, node: SvgNode): SvgNode =>
  it.transform ? <g transform={matrix(it.transform)}>{node}</g> : node;

/** The drawing code for `Dom`: one painter per `Dom`, so variables, fonts and gradients are shared across states. */
export const painter = (
  fonts: readonly FontValue[],
  captured: readonly Face[],
  parts: Parts,
  pairBy?: PairBy,
  drawn?: ReadonlyMap<string, readonly TextRun[]>,
) => {
  // The variables the drawn paints need, so the scene defines those and no others.
  const used = new Map<string, Pair<string>>();

  /** A paint as CSS: the color, or the variable that follows the viewer's scheme. */
  const v = <C extends string>(color: Paint<C>): C | `var(--${string})` => {
    if (!isPair(color)) return color;

    const name = variable(color);

    used.set(name, color);

    return `var(--${name})`;
  };

  const { byName, rules } = typefaces(fonts, captured, drawn);
  const embedded = new Set([...byName.keys(), ...captured.map((f) => f.family)]);
  const server = paintServers(v);
  // How many boxes of each part are drawn so far, so a part's function gets each one's index.
  const seen = new Map<string, number>();
  // Whether a box that only moved is slid whole; off, it is drawn shape by shape as before `hold` existed.
  let rigid = true;
  // Whether a box that moved is slid as one group even when it changed too; off only to count what drawing every
  // shape on its own would run.
  let slide = true;
  // Keyed elements that change parent in the transition being drawn.
  let carry: Carried = { carried: new Map(), left: new Set(), above: new Set() };
  // Text that moves between elements in the transition being drawn.
  let moves: Moves = { moved: new Map(), gone: new Set() };

  const partMotion = (b: Box): GroupStack | undefined => {
    if (b.part === undefined) return undefined;

    const index = seen.get(b.part) ?? 0;

    seen.set(b.part, index + 1);

    const m = parts[b.part];

    return m instanceof Function ? m(index) : m;
  };

  // Clips and masks by what they hold, so a box drawn the same in two transitions uses the same def in both, and the
  // two drawings come out equal for `hold` to draw once.
  const clips = new Map<number, Ref<"clipPath">>();
  const masks = new Map<string, Ref<"mask">>();

  const clipOf = (content: SvgNode): Ref<"clipPath"> => {
    const k = keyOf(content);

    if (k === undefined) return defines(def.clipPath({}, content), [content]);

    let ref = clips.get(k);

    if (!ref) {
      ref = defines(def.clipPath({}, content), [content]);
      clips.set(k, ref);
    }

    return ref;
  };

  const maskOf = (attrs: Attrs<"mask">, list: readonly SvgNode[]): Ref<"mask"> => {
    const ks = list.map(keyOf);

    if (ks.some((k) => k === undefined)) return defines(def.mask(attrs, list), list);

    const key = `m${JSON.stringify(attrs)}${ks.join(",")}`;
    let ref = masks.get(key);

    if (!ref) {
      ref = defines(def.mask(attrs, list), list);
      masks.set(key, ref);
    }

    return ref;
  };

  // An image file is defined once however many times it is drawn, scaled into each place it is used.
  const files = new Map<string, Ref<"symbol">>();

  const tile = (href: string, r: Rect): SvgNode => {
    let ref = files.get(href);

    if (!ref) {
      ref = def.symbol(
        {},
        jsx("image", { href, x: 0, y: 0, width: 1, height: 1, preserveAspectRatio: "none" }),
      );
      files.set(href, ref);
    }

    return jsx("use", {
      href: ref,
      transform: `translate(${num(r.x)} ${num(r.y)}) scale(${num(r.width)} ${num(r.height)})`,
    });
  };

  const tiles = (list: readonly Placement[]): SvgNode[] =>
    list.flatMap((p) => p.tiles.map((r) => tile(p.href, r)));

  /** `background-image` urls, clipped to the box's shape. */
  const pictures = (b: Box): Child => {
    if (!b.pictures) return null;
    const all = tiles(b.pictures);
    const inside = b.pictures.every((p) => p.tiles.every((r) => within(r, b.box)));

    return b.radii.some((r) => r > 0) || !inside ? (
      <g clipPath={clipOf(<path d={rounded(b.box, b.radii)} />)}>{all}</g>
    ) : (
      all
    );
  };

  /** What shows of `drawn` where the `mask-image` is opaque. */
  const masked = (b: Box, drawn: SvgNode): SvgNode => {
    if (!b.mask) return drawn;

    const mask = maskOf(
      {
        maskUnits: "userSpaceOnUse",
        maskType: "alpha",
        x: b.box.x,
        y: b.box.y,
        width: b.box.width,
        height: b.box.height,
      },
      tiles(b.mask),
    );

    return <g mask={mask}>{drawn}</g>;
  };

  const unembedded = (run: TextRun) =>
    run.advances.length > 0 && !embedded.has(run.family) && !SYSTEM.test(run.family);

  const text = (run: TextRun, animation?: Stack<TagChannels<"text">>): SvgNode =>
    jsx("text", {
      x: num(run.x),
      y: num(run.y),
      fontFamily:
        byName.get(run.family) ?? (run.fallback ? `${run.family}, ${run.fallback}` : run.family),
      fontSize: num(run.size),
      fontWeight: String(run.weight),
      fontStyle: run.style === "italic" ? "italic" : undefined,
      fontStretch: run.stretch ? `${run.stretch}%` : undefined,
      textDecoration: run.decoration,
      letterSpacing: run.letterSpacing ? num(run.letterSpacing) : undefined,
      // A face the SVG doesn't carry is drawn in a fallback of another width: keep the page's, so runs don't collide.
      textLength: unembedded(run) ? num(run.advances.at(-1)!) : undefined,
      lengthAdjust: unembedded(run) ? "spacing" : undefined,
      fill: v(run.color),
      animation,
      children: run.text,
    });

  const ink: Ink = { v, text };

  /** `back` undoes the graphic's scaling, for a mask's text, whose position is in the page's coordinates. */
  const vector = ({ tag, attrs, children, mask, run }: Vector, back?: string): SvgNode => {
    if (run) return <g transform={back}>{text(run)}</g>;

    const drawn = jsx(tag, {
      ...Object.fromEntries(
        Object.entries(attrs).map(([k, value]) => [
          k.replace(/-(\w)/g, (_, c: string) => c.toUpperCase()),
          v(value),
        ]),
      ),
      children: children.map((c) => vector(c, back)),
    });

    return mask ? (
      <g
        mask={maskOf(
          {},
          mask.map((c) => vector(c, back)),
        )}
      >
        {drawn}
      </g>
    ) : (
      drawn
    );
  };

  /** A path, tweened from `from` when given and different. */
  const path = (
    d: PathData,
    fill: Color,
    from?: From,
    tween?: Tween,
    extra: Extra = {},
  ): SvgNode => {
    const still = jsx("path", { d, fill, ...extra });

    if (!from || !tween || (from.d === d && from.fill === fill)) return still;

    const [start, end] = morphable(from.d, d);

    return moving(
      {
        from: { d: start, fill: from.fill },
        steps: [{ to: { d: end, fill }, ...tween }],
        draw: (f, animation) => jsx("path", { d: f.d, fill: f.fill, ...extra, animation }),
      },
      jsx("path", { d: from.d, fill: from.fill, ...extra }),
      still,
    );
  };

  const item = (it: Item, textMotion?: TextMotion): SvgNode => {
    switch (it.kind) {
      case "text":
        return text(it, textMotion?.(it));

      case "graphic": {
        const [vx, vy, vw, vh] = it.viewBox;
        const t = `translate(${num(it.box.x)} ${num(it.box.y)}) scale(${num(it.box.width / vw)} ${num(it.box.height / vh)}) translate(${num(-vx)} ${num(-vy)})`;

        const back = `translate(${num(vx)} ${num(vy)}) scale(${num(vw / it.box.width)} ${num(vh / it.box.height)}) translate(${num(-it.box.x)} ${num(-it.box.y)})`;

        return transformed(it, <g transform={t}>{it.children.map((c) => vector(c, back))}</g>);
      }

      case "image": {
        const clip =
          it.radii.some((r) => r > 0) || it.fit
            ? clipOf(<path d={rounded(it.box, it.radii)} />)
            : undefined;

        const image = tile(it.href, it.fit ?? it.box);

        // An `<image>` takes no clip-path in svjeez, so a group around it does.
        return transformed(it, clip ? <g clipPath={clip}>{image}</g> : image);
      }

      case "box":
        return box(it, undefined, textMotion);
    }
  };

  /** Two versions of one leaf: slide from the old place to the new, crossfading when they differ. */
  const pair = (a: Item, b: Item, tween: Tween): SvgNode => {
    const from = a.kind === "text" ? a : a.box;
    const to = b.kind === "text" ? b : b.box;
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
        : moving(
            {
              from: { x: dx, y: dy, fill: v(a.color) },
              steps: [{ to: { x: 0, y: 0, fill: v(b.color) }, ...tween }],
              // SAFETY: this recipe moves x, y and fill, all channels a <text> takes.
              draw: (_, animation) => text(b, animation as Stack<TagChannels<"text">>),
              origin: { x: b.x, y: b.y },
            },
            // It starts as the old text only when nothing else about the two differs.
            keyOf(text({ ...b, x: a.x, y: a.y, color: a.color })) === keyOf(text(a))
              ? text(a)
              : undefined,
            text(b),
          );

    if (a.kind === "text" && b.kind === "text" && sameFace(a, b)) {
      if (typable(a, b)) return typing(ink, a, b, tween);

      const change = !a.placeholder && !b.placeholder && countOf(a.text, b.text);

      if (change) return counting(ink, a, b, change, tween);
    }

    if (
      a.kind === "graphic" &&
      b.kind === "graphic" &&
      JSON.stringify(a.children) === JSON.stringify(b.children) &&
      sameTransform(a, b)
    )
      return dx === 0 && dy === 0
        ? item(b)
        : settles(
            animated(slideIn(tween, dx, dy), item(b)),
            a.box.width === b.box.width && a.box.height === b.box.height ? item(a) : undefined,
            item(b),
          );

    // Glyphs one over the other read as noise, so text and icons leave before the new ones come in.
    const [out, into] =
      a.kind === "box" ? (["swapOut", "swapIn"] as const) : (["textOut", "textIn"] as const);

    return (
      <>
        {animated(
          [
            motion({ x: 0, y: 0 }).to({ x: -dx, y: -dy }, span(tween.at, tween.over), tween.ease),
            fade(tween, out),
          ],
          item(a),
        )}
        {animated([slideIn(tween, dx, dy), fade(tween, into)], item(b))}
      </>
    );
  };

  // Shadow gradients, by fill and color: the same fade on the same color is one server however big the piece.
  const fades = new Map<string, Ref<"linearGradient" | "radialGradient">>();

  /** A gradient piece's paint: a shared server for its fade in `color`. */
  const gradientOf = (
    fill: Exclude<Fill, { kind: "solid" }>,
    color: Paint,
  ): Ref<"linearGradient" | "radialGradient"> => {
    const stopColor = v(color);
    const key = JSON.stringify([fill, stopColor]);
    let ref = fades.get(key);

    if (!ref) {
      const last = fill.stops.length - 1;
      const from = fill.kind === "radial" ? fill.from : 0;

      const stops = fill.stops.map((stopOpacity, k) =>
        jsx("stop", { offset: num(from + (k / last) * (1 - from), 4), stopColor, stopOpacity }),
      );

      // Bounding-box units, so one gradient fits every piece it paints and follows a piece's tweened shape.
      ref =
        fill.kind === "linear"
          ? def.linearGradient(
              [
                { x1: 0, y1: 1, x2: 0, y2: 0 },
                { x1: 0, y1: 0, x2: 1, y2: 0 },
                { x1: 0, y1: 0, x2: 0, y2: 1 },
                { x1: 1, y1: 0, x2: 0, y2: 0 },
              ][fill.side]!,
              stops,
            )
          : def.radialGradient(
              {
                cx: fill.corner === 1 || fill.corner === 2 ? 0 : 1,
                cy: fill.corner < 2 ? 1 : 0,
                r: 1,
              },
              stops,
            );
      fades.set(key, ref);
    }

    return ref;
  };

  /** Pieces that morph into each other: the same count, and the same paint wherever it is a gradient. */
  const morphs = (a: readonly Piece[], b: readonly Piece[], ca: Paint, cb: Paint): boolean =>
    a.length === b.length &&
    a.every((p, i) => {
      const q = b[i]!;

      return p.fill.kind === "solid"
        ? q.fill.kind === "solid"
        : JSON.stringify([p.fill, v(ca)]) === JSON.stringify([q.fill, v(cb)]);
    });

  /** Pieces in `color`, each tweened from the same-numbered one of `was`. A piece empty on both sides is left out. */
  const pieces = (
    now: readonly Piece[],
    color: Paint,
    was?: { readonly pieces: readonly Piece[]; readonly color: Paint },
    tween?: Tween,
  ): SvgNode[] =>
    now.flatMap((p, i) => {
      const before = was?.pieces[i];

      if (p.empty && (!before || before.empty)) return [];

      const extra: Extra = p.evenodd ? { fillRule: "evenodd" } : {};

      if (p.fill.kind === "solid")
        return [
          path(
            p.d,
            v(fainter(color, p.fill.opacity)),
            before?.fill.kind === "solid"
              ? { d: before.d, fill: v(fainter(was!.color, before.fill.opacity)) }
              : undefined,
            tween,
            extra,
          ),
        ];

      const paint = gradientOf(p.fill, color);
      const still = jsx("path", { d: p.d, fill: paint, ...extra });

      if (!before || !tween || before.d === p.d) return [still];

      const [start, end] = morphable(before.d, p.d);

      return [
        moving(
          {
            from: { d: start },
            steps: [{ to: { d: end }, ...tween }],
            draw: (f, animation) => jsx("path", { d: f.d, fill: paint, ...extra, animation }),
          },
          jsx("path", { d: before.d, fill: paint, ...extra }),
          still,
        ),
      ];
    });

  /**
   * Shadows of `b`, each turning from `a`'s same-numbered one. Pieces that match morph; otherwise the old shadow fades
   * out and the new one in, each following the box from one shape to the other.
   */
  const cast = (
    b: Box,
    now: readonly Shadow[],
    a: Box | undefined,
    was: readonly Shadow[] | undefined,
    tween: Tween | undefined,
    piecesOf: (x: Box, s: Shadow) => Piece[],
  ): SvgNode[] =>
    now.flatMap((s, i) => {
      const p = was?.[i];
      const shown = !invisible(s.color);

      if (!a || !p || !tween) return shown ? pieces(piecesOf(b, s), s.color) : [];

      if (!shown && invisible(p.color)) return [];

      const start = piecesOf(a, p);
      const end = piecesOf(b, s);

      if (morphs(start, end, p.color, s.color))
        return pieces(end, s.color, { pieces: start, color: p.color }, tween);

      /**
       * One side's shadow on both boxes, following the box from one shape to the other. When its fades differ
       * between the two (a box shrunk below its blur), the outgoing copy keeps the old fades and the incoming one the
       * new, each stretched over the moving pieces, so neither stands still while the box resizes.
       */
      const follow = (shadow: Shadow, keep: "start" | "end") => {
        const from = piecesOf(a, shadow);
        const to = piecesOf(b, shadow);
        const c = shadow.color;

        if (morphs(from, to, c, c)) return pieces(to, c, { pieces: from, color: c }, tween);

        if (from.length !== to.length) return pieces(keep === "start" ? from : to, c);

        /** `paint`'s pieces where `spots` lie. */
        const over = (paint: readonly Piece[], spots: readonly Piece[]): Piece[] =>
          paint.map((q, i) => ({
            ...q,
            d: spots[i]!.d,
            empty: q.empty && spots[i]!.empty ? true : undefined,
          }));

        return keep === "start"
          ? pieces(over(from, to), c, { pieces: from, color: c }, tween)
          : pieces(to, c, { pieces: over(to, from), color: c }, tween);
      };

      return [
        !invisible(p.color) && animated(fade(tween, shown ? "swapOut" : "out"), follow(p, "start")),
        shown && animated(fade(tween, invisible(p.color) ? "in" : "swapIn"), follow(s, "end")),
      ].filter((n): n is SvgNode => Boolean(n));
    });

  /**
   * Outer shadows, under the box. CSS draws them only outside the border box; under an opaque background nothing
   * shows anyway, so only a box you can see through needs the mask that cuts it out.
   */
  const outerShadows = (b: Box, a?: Box, tween?: Tween): Child => {
    const boxes = a ? [a, b] : [b];

    if (!boxes.some((x) => x.shadows.length > 0)) return null;

    const reach = union(boxes.flatMap((x) => x.shadows.map((_, i) => shadowBounds(x, i))));
    const seeThrough = boxes.some((x) => !opaque(x.background));

    const mask =
      seeThrough && reach
        ? maskOf(
            {
              maskUnits: "userSpaceOnUse",
              x: reach.x,
              y: reach.y,
              width: reach.width,
              height: reach.height,
            },
            [
              path(outside(b, reach), "#fff", a && { d: outside(a, reach), fill: "#fff" }, tween, {
                fillRule: "evenodd",
              }),
            ],
          )
        : undefined;

    const [from, to] = a ? padShadows(a, b) : [undefined, b];

    // CSS paints the first shadow on top.
    const shadows = to.shadows
      .map((s, i) => cast(b, [s], a, from && [from.shadows[i]!], tween, outerPieces))
      .reverse()
      .flat();

    return mask ? <g mask={mask}>{shadows}</g> : shadows;
  };

  /** Inset shadows: the padding box less a copy shrunk by the spread and moved by the offset, kept inside it. */
  const insetShadows = (b: Box, padding: () => SvgNode, a?: Box, tween?: Tween): Child => {
    const [from, to] = a ? padInsets(a, b) : [undefined, b];
    const insets = to.insets ?? [];

    if (insets.length === 0) return null;

    const clip = clipOf(padding());

    const drawn = cast(b, insets, a, from?.insets, tween, insetPieces);

    return drawn.length > 0 && <g clipPath={clip}>{drawn}</g>;
  };

  /** A fill only one side has fades, drawn on the shape of the side that has it. */
  const layer = (
    b: Box,
    a: Box | undefined,
    tween: Tween | undefined,
    pick: (x: Box) => Paint | undefined,
    outline: (x: Box) => PathData,
    extra: Extra = {},
  ): Child => {
    const end = pick(b);

    if (!a || !tween) return end ? path(outline(b), v(end), undefined, undefined, extra) : null;

    const start = pick(a);
    const from = (fill: Paint) => ({ d: outline(a), fill: v(fill) });

    if (end && start) return path(outline(b), v(end), from(start), tween, extra);

    if (end) return path(outline(b), v(end), from(clear(end)), tween, extra);

    if (start) return path(outline(b), v(clear(start)), from(start), tween, extra);

    return null;
  };

  /** Gradients paint over the fill in the box's shape. The same ones on both sides ride along; others crossfade. */
  const gradients = (b: Box, a?: Box, tween?: Tween): Child => {
    const now = (b.gradients ?? []).flatMap((g) => server(g, b.box) ?? []);
    const d = rounded(b.box, b.radii);

    if (!a || !tween) return now.map((s) => jsx("path", { d, fill: s.ref }));

    const before = (a.gradients ?? []).flatMap((g) => server(g, a.box) ?? []);
    const from = rounded(a.box, a.radii);
    const same = now.length === before.length && now.every((s, i) => s.key === before[i]!.key);

    const [start, end] = morphable(from, d);

    const layered = (fill: (typeof now)[number]["ref"], opacity?: ReturnType<typeof fade>) =>
      jsx("path", {
        d: start,
        fill,
        animation: [
          from !== d && motion({ d: start }).to({ d: end }, span(tween.at, tween.over), tween.ease),
          opacity,
        ],
      });

    if (same) return now.map((s) => layered(s.ref));

    return [
      ...before.map((s) => layered(s.ref, fade(tween, "swapOut"))),
      ...now.map((s) => layered(s.ref, fade(tween, "swapIn"))),
    ];
  };

  /** `b`'s children, or `a`'s turning into them: paired ones morph, the rest fade, and text slides, types or counts. */
  const children = (
    b: Box,
    a: Box | undefined,
    tween: Tween | undefined,
    textMotion?: TextMotion,
  ): Child[] => {
    if (!a || !tween) return b.children.map((it) => item(it, textMotion));

    const { moved, gone } = moves;
    const arrived = new Set(moved.keys());

    const slides = (it: Item) =>
      runsOf(it).flatMap((r) => {
        const was = moved.get(r);

        return was ? [pair(was, r, tween)] : [];
      });

    const aligned = align(a.children, b.children, pairBy);

    // Nothing pairs and both sides have something: the content is replaced whole, and hands over rather than
    // leaving the box empty halfway.
    const replaced =
      aligned.every(([old, it]) => !old || !it) &&
      aligned.some(([old]) => old) &&
      aligned.some(([, it]) => it);

    return aligned.map(([old, it]) => {
      if (!it) {
        // Text that moved to another element slides there, drawn where it arrives.
        if (old!.kind === "text" && gone.has(old!)) return null;

        // Text that leaves a field is deleted.
        if (old!.kind === "text" && FIELDS.has(a.tag)) {
          const empty = blank(old!, a.box, b.box);

          if (typable(old!, empty)) return typing(ink, old!, empty, tween);
        }

        // A keyed element that moved to another parent is drawn there.
        if (old!.kind === "box" && carry.left.has(old!)) return null;

        const left = without(old!, gone, carry.left);

        return left && animated(fade(tween, replaced ? "handOut" : "exit"), item(left));
      }

      if (!old) {
        if (it.kind === "text" && moved.has(it)) return pair(moved.get(it)!, it, tween);

        // Text that appears in a field is typed in.
        if (it.kind === "text" && FIELDS.has(b.tag)) {
          const empty = blank(it, b.box, a.box);

          if (typable(empty, it)) return typing(ink, empty, it, tween);
        }

        const was = it.kind === "box" ? carry.carried.get(it) : undefined;

        // A keyed element that came from another parent moves here from where it was, or over the page.
        if (it.kind === "box" && was)
          return carry.above.has(it) ? null : box(it, { a: was, tween });

        const came = without(it, arrived, new Set(carry.carried.keys()));

        return (
          <>
            {came && animated(fade(tween, replaced ? "handIn" : "enter"), item(came))}
            {slides(it)}
            {insideOf(it, new Set(carry.carried.keys()))
              .filter((c) => !carry.above.has(c))
              .map((c) => box(c, { a: carry.carried.get(c)!, tween }))}
          </>
        );
      }

      // A box that turned or scaled crossfades: a matrix doesn't tween as a whole.
      if (old.kind === "box" && it.kind === "box" && sameTransform(old, it))
        return box(it, { a: old, tween });

      // A field's text that went elsewhere leaves its placeholder to come back.
      if (old.kind === "text" && gone.has(old))
        return it.kind === "text" ? animated(fade(tween, "enter"), item(it)) : null;

      if (old.kind === it.kind) return pair(old, it, tween);

      return (
        <>
          {animated(fade(tween, "swapOut"), item(old))}
          {animated(fade(tween, "swapIn"), item(it))}
        </>
      );
    });
  };

  /** One element. With `from`, it starts as `from.a` and becomes `b` over `from.tween`. */
  const box = (b: Box, from?: { a: Box; tween: Tween }, textMotion?: TextMotion): SvgNode => {
    const a = from?.a;
    const tween = from?.tween;
    const shift = a && !textMotion && offset(a, b);

    // A box that only moved is drawn once where it lands and slid there whole: its shapes, text and clips stay still
    // inside one moving group, so the next transition draws it the same and the two are one element. Text that moves
    // to or from another element is drawn by the walk instead.
    if (
      rigid &&
      shift &&
      tween &&
      !runsOf(b).some((r) => moves.moved.has(r)) &&
      !runsOf(a).some((r) => moves.gone.has(r))
    ) {
      const still = box(b);

      if (drawsNothing(still)) return still;

      return moving(
        {
          from: { x: -shift.dx, y: -shift.dy },
          steps: [{ to: { x: 0, y: 0 }, ...tween }],
          // SAFETY: this recipe moves x and y, which a <g> takes.
          draw: (_, animation) => <g animation={animation as GroupStack}>{still}</g>,
          origin: { x: b.box.x, y: b.box.y },
        },
        // Drawing `a` again would count its parts twice.
        Object.keys(parts).length === 0 ? box(a) : undefined,
        still,
      );
    }

    // A box that moved and changed too, or any box that moved when drawing shape by shape, is still slid whole: one group carries everything in it from `a`'s place to
    // `b`'s, and inside it `a`, drawn where `b` is, turns into `b`. Moving each shape on its own would put the
    // outline on SMIL's clock and the text on CSS's, and browsers start those apart (WebKit by ~50ms), so the
    // contents would drift off the box while it moves.
    const dx = a && b.box.x - a.box.x;
    const dy = a && b.box.y - a.box.y;

    if (
      slide &&
      a &&
      tween &&
      !textMotion &&
      (dx || dy) &&
      !runsOf(b).some((r) => moves.moved.has(r)) &&
      !runsOf(a).some((r) => moves.gone.has(r)) &&
      // A keyed element that changed parent inside it moves on its own; `a` and `b` themselves may be one.
      a.children.every((c) => insideOf(c, carry.left).length === 0) &&
      b.children.every((c) => insideOf(c, new Set(carry.carried.keys())).length === 0)
    ) {
      // A box that is see-through at one end can't be followed there, so it fades where it can be seen instead of
      // sliding: Logseq's add button drops below the new block as it hides, and drawn sliding it reads as the bullet
      // jumping down.
      if (a.opacity === 0 || b.opacity === 0) {
        const there = a.opacity === 0 ? b.box : a.box;

        return a.opacity === 0
          ? box(b, { a: shifted(a, there.x - a.box.x, there.y - a.box.y), tween })
          : box(shifted(b, there.x - b.box.x, there.y - b.box.y), { a, tween });
      }

      const turned = box(b, { a: shifted(a, dx!, dy!), tween });

      if (drawsNothing(turned)) return turned;

      const node = <g animation={slideIn(tween, -dx!, -dy!)}>{turned}</g>;

      // Drawing `b` again would count its parts twice.
      return Object.keys(parts).length === 0 ? settles(node, undefined, box(b)) : node;
    }

    const inner = paddingBox(b);
    const innerFrom = a && paddingBox(a);
    const clipD = rounded(inner.rect, inner.radii);
    const clipFrom = innerFrom && rounded(innerFrom.rect, innerFrom.radii);

    // The padding box, which clips what spills and keeps inset shadows inside.
    const padding = () =>
      path(
        clipD,
        "#000",
        clipFrom === undefined ? undefined : { d: clipFrom, fill: "#000" },
        tween,
      );

    const clip = spills(b) || (a ? spills(a) : false) ? clipOf(padding()) : undefined;
    const shadows = outerShadows(b, a, tween);
    const kids = children(b, a, tween, textMotion);

    const opacity =
      a && tween && a.opacity !== b.opacity
        ? motion({ opacity: a.opacity }).to(
            { opacity: b.opacity },
            span(tween.at, tween.over),
            tween.ease,
          )
        : undefined;

    const motions = [...[partMotion(b)].flat(), opacity].filter(Boolean);

    const drawn = masked(
      b,
      <>
        {shadows}
        {layer(
          b,
          a,
          tween,
          (x) => x.background,
          (x) => rounded(x.box, x.radii),
        )}
        {gradients(b, a, tween)}
        {pictures(b)}
        {insetShadows(b, padding, a, tween)}
        {layer(b, a, tween, (x) => x.border?.color, borderRing, { fillRule: "evenodd" })}
        {clip ? <g clipPath={clip}>{kids}</g> : kids}
        {layer(b, a, tween, (x) => x.outline?.color, outlineRing, { fillRule: "evenodd" })}
      </>,
    );

    if (drawsNothing(drawn)) return <></>;

    // A box with nothing of its own to apply adds no group: deep pages nest hundreds of plain wrappers.
    const dim = b.darkOpacity !== undefined && !opacity;

    if (motions.length === 0 && b.opacity >= 1 && !dim && !b.blend && !b.isolate)
      return transformed(b, drawn);

    // Faded in one scheme only: the opacity is a variable that follows the viewer's scheme, as colors are.
    const faded = dim
      ? v({ light: String(b.opacity), dark: String(b.darkOpacity) })
      : !opacity && b.opacity < 1
        ? b.opacity
        : undefined;

    // A blend mode blends this group with what is drawn under it; isolation keeps what's inside from reaching out.
    const mode = [b.blend && `mix-blend-mode:${b.blend}`, b.isolate && "isolation:isolate"]
      .filter(Boolean)
      .join(";");

    return transformed(
      b,
      jsx("g", { opacity: faded, style: mode || undefined, animation: motions, children: drawn }),
    );
  };

  /** The rules that define the variables drawn so far, and the page's fonts svjeez doesn't embed itself. */
  const style = (): SvgNode | null => {
    const css = rules.join("") + schemeCss(used);

    return css ? <Style css={css} /> : null;
  };

  /** A whole tree, as `b`, or as `a` turning into `b`. */
  const root = (
    b: Box,
    from?: { a: Box; tween: Tween },
    textMotion?: TextMotion,
    whole = true,
    slides = true,
  ) => {
    seen.clear();
    rigid = whole;
    slide = slides;

    carry = from
      ? carriedOf(from.a, b, pairBy)
      : { carried: new Map(), left: new Set(), above: new Set() };

    if (from) moves = movesOf(from.a, b, pairBy, carry);

    const drawn = box(b, from, textMotion);

    if (!from || carry.above.size === 0) return drawn;

    return (
      <>
        {drawn}
        {[...carry.above].map((c) => box(c, { a: carry.carried.get(c)!, tween: from.tween }))}
      </>
    );
  };

  return { root, style };
};
