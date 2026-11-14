/** @jsxImportSource svjeez */
/** @jsxRuntime automatic */
import {
  def,
  motion,
  num,
  Style,
  type Child,
  type Color,
  type FontValue,
  type PathData,
  type Ref,
  type Stack,
  type SvgNode,
  type TagChannels,
} from "svjeez";
import { jsx } from "svjeez/jsx-runtime";
import { clear, invisible, isPair, opaque, schemeCss, variable } from "../paint.ts";
import type { Box, Face, Item, Paint, Pair, Shadow, TextRun, Vector } from "../tree.ts";
import { typefaces } from "./faces.ts";
import {
  borderRing,
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
  movesOf,
  runsOf,
  sameFace,
  sameTransform,
  without,
  type Boxed,
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

const transformed = (it: Boxed, node: SvgNode): SvgNode =>
  it.transform ? <g transform={matrix(it.transform)}>{node}</g> : node;

/** The drawing code for `Dom`: one painter per `Dom`, so variables, fonts and gradients are shared across states. */
export const painter = (
  fonts: readonly FontValue[],
  captured: readonly Face[],
  parts: Parts,
  pairBy?: PairBy,
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

  const { byName, rules } = typefaces(fonts, captured);
  const server = paintServers(v);
  // How many boxes of each part are drawn so far, so a part's function gets each one's index.
  const seen = new Map<string, number>();
  // Text that moves between elements in the transition being drawn.
  let moves: Moves = { moved: new Map(), gone: new Set() };

  const partMotion = (b: Box): GroupStack | undefined => {
    if (b.part === undefined) return undefined;

    const index = seen.get(b.part) ?? 0;

    seen.set(b.part, index + 1);

    const m = parts[b.part];

    return m instanceof Function ? m(index) : m;
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
    });

  const ink: Ink = { v, text };

  const vector = ({ tag, attrs, children }: Vector): SvgNode =>
    jsx(tag, {
      ...Object.fromEntries(
        Object.entries(attrs).map(([k, value]) => [
          k.replace(/-(\w)/g, (_, c: string) => c.toUpperCase()),
          v(value),
        ]),
      ),
      children: children.map(vector),
    });

  /** A path, tweened from `from` when given and different. */
  const path = (
    d: PathData,
    fill: Color,
    from?: From,
    tween?: Tween,
    extra: Extra = {},
  ): SvgNode => {
    const moving = from && tween && (from.d !== d || from.fill !== fill);

    return jsx("path", {
      d: moving ? from.d : d,
      fill: moving ? from.fill : fill,
      ...extra,
      animation: moving
        ? motion({ d: from.d, fill: from.fill })
            .at(tween.at)
            .to({ d, fill }, tween.over, tween.ease)
        : undefined,
    });
  };

  const item = (it: Item, textMotion?: TextMotion): SvgNode => {
    switch (it.kind) {
      case "text":
        return text(it, textMotion?.(it));

      case "graphic": {
        const [vx, vy, vw, vh] = it.viewBox;
        const t = `translate(${num(it.box.x)} ${num(it.box.y)}) scale(${num(it.box.width / vw)} ${num(it.box.height / vh)}) translate(${num(-vx)} ${num(-vy)})`;

        return transformed(it, <g transform={t}>{it.children.map(vector)}</g>);
      }

      case "image": {
        const clip = it.radii.some((r) => r > 0)
          ? def.clipPath({}, <path d={rounded(it.box, it.radii)} />)
          : undefined;

        const image = jsx("image", {
          href: it.href,
          x: num(it.box.x),
          y: num(it.box.y),
          width: num(it.box.width),
          height: num(it.box.height),
        });

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
        : text(
            b,
            motion({ x: dx, y: dy, fill: v(a.color) })
              .at(tween.at)
              .to({ x: 0, y: 0, fill: v(b.color) }, tween.over, tween.ease),
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
      return <g animation={slideIn(tween, dx, dy)}>{item(b)}</g>;

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
        <g animation={[slideIn(tween, dx, dy), fade(tween, "swapIn")]}>{item(b)}</g>
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

      return [
        jsx("path", {
          d: before && tween ? before.d : p.d,
          fill: gradientOf(p.fill, color),
          ...extra,
          animation:
            before && tween && before.d !== p.d
              ? motion({ d: before.d }).at(tween.at).to({ d: p.d }, tween.over, tween.ease)
              : undefined,
        }),
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

      /** One side's shadow on both boxes, morphing when it can. */
      const follow = (shadow: Shadow) => {
        const from = piecesOf(a, shadow);
        const to = piecesOf(b, shadow);

        return morphs(from, to, shadow.color, shadow.color)
          ? pieces(to, shadow.color, { pieces: from, color: shadow.color }, tween)
          : pieces(to, shadow.color);
      };

      return [
        !invisible(p.color) && (
          <g animation={fade(tween, shown ? "swapOut" : "out")}>{follow(p)}</g>
        ),
        shown && <g animation={fade(tween, invisible(p.color) ? "in" : "swapIn")}>{follow(s)}</g>,
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
        ? def.mask(
            {
              maskUnits: "userSpaceOnUse",
              x: reach.x,
              y: reach.y,
              width: reach.width,
              height: reach.height,
            },
            path(outside(b, reach), "#fff", a && { d: outside(a, reach), fill: "#fff" }, tween, {
              fillRule: "evenodd",
            }),
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

    const clip = def.clipPath({}, padding());

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

    const layered = (fill: (typeof now)[number]["ref"], opacity?: ReturnType<typeof fade>) =>
      jsx("path", {
        d: from,
        fill,
        animation: [
          from !== d && motion({ d: from }).at(tween.at).to({ d }, tween.over, tween.ease),
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

    return align(a.children, b.children, pairBy).map(([old, it]) => {
      if (!it) {
        // Text that moved to another element slides there, drawn where it arrives.
        if (old!.kind === "text" && gone.has(old!)) return null;

        // Text that leaves a field is deleted.
        if (old!.kind === "text" && FIELDS.has(a.tag)) {
          const empty = blank(old!, a.box, b.box);

          if (typable(old!, empty)) return typing(ink, old!, empty, tween);
        }

        const left = without(old!, gone);

        return left && <g animation={fade(tween, "exit")}>{item(left)}</g>;
      }

      if (!old) {
        if (it.kind === "text" && moved.has(it)) return pair(moved.get(it)!, it, tween);

        // Text that appears in a field is typed in.
        if (it.kind === "text" && FIELDS.has(b.tag)) {
          const empty = blank(it, b.box, a.box);

          if (typable(empty, it)) return typing(ink, empty, it, tween);
        }

        const came = without(it, arrived);

        return (
          <>
            {came && <g animation={fade(tween, "enter")}>{item(came)}</g>}
            {slides(it)}
          </>
        );
      }

      // A box that turned or scaled crossfades: a matrix doesn't tween as a whole.
      if (old.kind === "box" && it.kind === "box" && sameTransform(old, it))
        return box(it, { a: old, tween });

      if (old.kind === it.kind) return pair(old, it, tween);

      return (
        <>
          <g animation={fade(tween, "swapOut")}>{item(old)}</g>
          <g animation={fade(tween, "swapIn")}>{item(it)}</g>
        </>
      );
    });
  };

  /** One element. With `from`, it starts as `from.a` and becomes `b` over `from.tween`. */
  const box = (b: Box, from?: { a: Box; tween: Tween }, textMotion?: TextMotion): SvgNode => {
    const a = from?.a;
    const tween = from?.tween;
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

    const clip = spills(b) || (a ? spills(a) : false) ? def.clipPath({}, padding()) : undefined;
    const shadows = outerShadows(b, a, tween);
    const kids = children(b, a, tween, textMotion);

    const opacity =
      a && tween && a.opacity !== b.opacity
        ? motion({ opacity: a.opacity })
            .at(tween.at)
            .to({ opacity: b.opacity }, tween.over, tween.ease)
        : undefined;

    const motions = [...[partMotion(b)].flat(), opacity].filter(Boolean);

    const drawn = (
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
        {insetShadows(b, padding, a, tween)}
        {layer(b, a, tween, (x) => x.border?.color, borderRing, { fillRule: "evenodd" })}
        {clip ? <g clipPath={clip}>{kids}</g> : kids}
      </>
    );

    // A box with nothing of its own to apply adds no group: deep pages nest hundreds of plain wrappers.
    if (motions.length === 0 && b.opacity >= 1) return transformed(b, drawn);

    return transformed(
      b,
      <g opacity={!opacity && b.opacity < 1 ? b.opacity : undefined} animation={motions}>
        {drawn}
      </g>,
    );
  };

  /** The rules that define the variables drawn so far, and the page's fonts svjeez doesn't embed itself. */
  const style = (): SvgNode | null => {
    const css = rules.join("") + schemeCss(used);

    return css ? <Style css={css} /> : null;
  };

  /** A whole tree, as `b`, or as `a` turning into `b`. */
  const root = (b: Box, from?: { a: Box; tween: Tween }, textMotion?: TextMotion) => {
    seen.clear();

    if (from) moves = movesOf(from.a, b, pairBy);

    return box(b, from, textMotion);
  };

  return { root, style };
};
