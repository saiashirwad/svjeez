import type { Color as CssColor } from "../attributes";
import type { Backend as Route, Target, TargetValues } from "../channels";
import type { Lane as CssLane } from "../compile";
import { easeAt, splitEase } from "../ease-at";
import { num } from "../format";
import type { Key as Held } from "../keys";
import { EPSILON, ease, type Ease } from "../motion";
import type { PathData } from "../paths";
import { render } from "../render";
import { element, type AttrValue, type SvgNode } from "../svg";
import { admit, type Backend, type Feature, type Support } from "./backend";
import { arcPieces, contoursOf, mixGeometry } from "./geometry";
import type {
  Animated,
  Color,
  Contour,
  Geometry,
  Key,
  Lane,
  Layer,
  Paint,
  Rgba,
  Scene,
  SceneNode,
  ShapeNode,
  Vec,
} from "./ir";
import { isLane } from "./lane";
import { same } from "./steps";
import { onCircle } from "./values";

/**
 * The SVG backend. It decides where each lane lands (a CSS property, or a wrapper group when two lanes would
 * collide or apply in the wrong order) and hands elements with placed lanes to the emitter the old API uses, so
 * every browser workaround there (visibility for cuts, SMIL twins, font subsets, the reduced-motion freeze) holds
 * here too.
 */
export interface SvgOptions {
  /** Put in front of every generated id, class, keyframe name and font family, so two scenes can share a page. */
  readonly prefix?: string;
  /** 2 plays twice as fast. Default 1. */
  readonly playbackRate?: number;
}

const LATER = "the SVG backend doesn't write it yet.";
const EXACT: Support = { level: "exact" };
const NONE: Support = { level: "none", note: LATER };

const supports: Readonly<Record<Feature, Support>> = {
  text: EXACT,
  outlinedText: EXACT,
  image: EXACT,
  instance: EXACT,
  clip: NONE,
  mask: NONE,
  blur: NONE,
  shadow: NONE,
  linearGradient: NONE,
  radialGradient: NONE,
  nonScalingStroke: EXACT,
  liveTokens: EXACT,
};

interface Ctx {
  readonly scene: Scene;
  readonly prefix: string;
  /** Whether a node or anything under it has a trim that moves, by key. */
  readonly trims: Map<string, boolean>;
}

const isRgba = (color: Color): color is Rgba => Array.isArray(color);

const byte = (unit: number): string =>
  Math.round(Math.min(1, Math.max(0, unit)) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();

// SAFETY: a "#" and hex digits, or var() of a token name, is a color as the attribute types spell one.
const colorText = (color: Color): CssColor =>
  (isRgba(color)
    ? `#${byte(color[0])}${byte(color[1])}${byte(color[2])}${color[3] < 1 ? byte(color[3]) : ""}`
    : `var(--${color.name})`) as CssColor;

const isRgbaPaint = (paint: Paint): paint is Rgba => Array.isArray(paint);

const isColor = (paint: Paint): paint is Color => isRgbaPaint(paint) || paint.kind === "token";

const solid = (paint: Paint): Color => {
  if (isColor(paint)) return paint;

  throw new Error(
    `A ${paint.kind} gradient reached the SVG backend, which doesn't write gradients yet.`,
  );
};

const pt = ([x, y]: Vec): string => `${num(x)} ${num(y)}`;

const isStraight = (from: Vec, [c1, c2, to]: Contour["curves"][number]): boolean =>
  [
    [c1, 1 / 3],
    [c2, 2 / 3],
  ].every(([control, share]) => {
    // SAFETY: each entry above is a control point paired with its share of the way, in that order.
    const [point, u] = [control as Vec, share as number];

    return (
      Math.abs(from[0] + (to[0] - from[0]) * u - point[0]) < 1e-6 &&
      Math.abs(from[1] + (to[1] - from[1]) * u - point[1]) < 1e-6
    );
  });

const contourData = (contour: Contour): string => {
  let from = contour.start;
  let d = `M${pt(from)}`;

  contour.curves.forEach((curve, index) => {
    const closing =
      contour.closed &&
      index === contour.curves.length - 1 &&
      curve[2][0] === contour.start[0] &&
      curve[2][1] === contour.start[1];

    if (!isStraight(from, curve)) d += `C${curve.map(pt).join(" ")}`;
    else if (!closing) d += `L${pt(curve[2])}`;
    from = curve[2];
  });

  return contour.closed ? `${d}Z` : d;
};

const roundedRect = ([w, h]: Vec, [tl, tr, br, bl]: readonly number[]): string => {
  const corner = (r: number, x: number, y: number): string =>
    r > 0 ? `A${num(r)} ${num(r)} 0 0 1 ${num(x)} ${num(y)}` : "";

  return [
    `M${num(tl!)} 0H${num(w - tr!)}`,
    corner(tr!, w, tr!),
    `V${num(h - br!)}`,
    corner(br!, w - br!, h),
    `H${num(bl!)}`,
    corner(bl!, 0, h - bl!),
    `V${num(tl!)}`,
    corner(tl!, tl!, 0),
    "Z",
  ].join("");
};

interface Drawn {
  readonly tag: string;
  readonly attrs: Record<string, AttrValue>;
  /** Whether `at` went into the element's own coordinates, so the fill box sits where the node does. */
  readonly placed: boolean;
}

const moved = ([x, y]: Vec): Record<string, AttrValue> =>
  x === 0 && y === 0 ? {} : { transform: `translate(${pt([x, y])})` };

const outline = (geometry: Geometry, at: Vec): Drawn => {
  const [x, y] = at;

  switch (geometry.kind) {
    case "rect": {
      const [w, h] = geometry.size;
      const [r] = geometry.radius;

      if (geometry.radius.some((radius) => radius !== r))
        return {
          tag: "path",
          attrs: { d: roundedRect(geometry.size, geometry.radius), ...moved(at) },
          placed: false,
        };

      return {
        tag: "rect",
        attrs: {
          ...(x !== 0 && { x: num(x) }),
          ...(y !== 0 && { y: num(y) }),
          width: num(w),
          height: num(h),
          ...(r > 0 && { rx: num(r) }),
        },
        placed: true,
      };
    }

    case "ellipse": {
      const [rx, ry] = geometry.radius;
      const center = { ...(x !== 0 && { cx: num(x) }), ...(y !== 0 && { cy: num(y) }) };

      return rx === ry
        ? { tag: "circle", attrs: { ...center, r: num(rx) }, placed: true }
        : { tag: "ellipse", attrs: { ...center, rx: num(rx), ry: num(ry) }, placed: true };
    }

    case "arc": {
      const { radius, start, sweep } = geometry;

      if (Math.abs(sweep) >= 360)
        return {
          tag: "circle",
          attrs: { ...(x !== 0 && { cx: num(x) }), ...(y !== 0 && { cy: num(y) }), r: num(radius) },
          placed: true,
        };
      const r = num(radius);

      return {
        tag: "path",
        attrs: {
          d: `M${pt(onCircle(radius, start))}A${r} ${r} 0 ${Math.abs(sweep) > 180 ? 1 : 0} ${sweep > 0 ? 1 : 0} ${pt(onCircle(radius, start + sweep))}`,
          ...moved(at),
        },
        placed: false,
      };
    }

    case "line":
      return {
        tag: "line",
        attrs: {
          x1: num(geometry.from[0] + x),
          y1: num(geometry.from[1] + y),
          x2: num(geometry.to[0] + x),
          y2: num(geometry.to[1] + y),
        },
        placed: true,
      };
    case "polygon":
      return {
        tag: geometry.closed ? "polygon" : "polyline",
        attrs: { points: geometry.points.map(pt).join(" "), ...moved(at) },
        placed: false,
      };
    case "path":
      return {
        tag: "path",
        attrs: {
          d: geometry.contours.map(contourData).join(""),
          ...(geometry.rule === "evenodd" && { "fill-rule": "evenodd" }),
          ...moved(at),
        },
        placed: false,
      };
  }
};

const held = <T>(lane: Lane<T>, duration: number, values: (value: T) => TargetValues) => {
  const period = lane.period ?? duration;

  const keys = lane.keys.map((key, index): Held => ({
    t: key.t,
    values: values(key.value),
    ease: lane.keys[index + 1]?.ease ?? ease.out,
  }));

  const [first, last] = [keys[0]!, keys.at(-1)!];

  return {
    keys: [
      ...(first.t > EPSILON ? [{ ...first, t: 0, ease: ease.out }] : []),
      ...keys,
      ...(last.t < period - EPSILON ? [{ ...last, t: period }] : []),
    ],
    period,
  };
};

type Slot =
  | "translate"
  | "rotate"
  | "scale"
  | "opacity"
  | "draw"
  | "fill"
  | "stroke"
  | "stroke-width"
  | "d";

const isCut = (keys: readonly Held[]): boolean =>
  keys.every((key, index) => {
    const value = key.values.opacity;
    const next = keys[index + 1];

    return (
      (value === 0 || value === 1) &&
      (next === undefined ||
        next.values.opacity === value ||
        (key.ease.kind === "steps" && key.ease.count === 1))
    );
  });

/** A lane for the emitter. Its channels are the names its values carry. An opacity cut hides with `visibility` unless `cuts` is false. */
const cssLane = <T>(
  ctx: Ctx,
  slot: Slot,
  lane: Lane<T>,
  values: (value: T) => TargetValues,
  { route = "css", cuts = true }: { readonly route?: Route; readonly cuts?: boolean } = {},
): CssLane => {
  const { keys, period } = held(lane, ctx.scene.duration, values);

  return {
    key: slot,
    backend: route,
    // SAFETY: every values() above returns a TargetValues, so the names of its first key are Targets.
    channels: Object.keys(keys[0]!.values) as Target[],
    keys,
    period,
    snapped: period,
    nest: false,
    emit: cuts && slot === "opacity" && isCut(keys) ? "visibility" : "value",
  };
};

/** One element's worth of placement: the lanes and still values that can share it without changing the order they apply in. */
interface Shell {
  readonly lanes: CssLane[];
  readonly style: string[];
  readonly taken: Set<Slot>;
  /** The outermost of translate (0), rotate (1) and scale (2) already here. A new one must come before it. */
  rank: number;
  opacity?: number;
  pivots: boolean;
}

const RANK: Partial<Record<Slot, number>> = { translate: 0, rotate: 1, scale: 2 };

const shell = (): Shell => ({ lanes: [], style: [], taken: new Set(), rank: 3, pivots: false });

const open = (shells: Shell[], slot: Slot): Shell => {
  const rank = RANK[slot];
  let current = shells.at(-1)!;

  if (current.taken.has(slot) || (rank !== undefined && rank >= current.rank)) {
    current = shell();
    shells.push(current);
  }

  current.taken.add(slot);

  if (rank !== undefined) current.rank = rank;

  if (slot === "rotate" || slot === "scale") current.pivots = true;

  return current;
};

const isUniform = ([x, y]: Vec): boolean => Math.abs(x - y) < 1e-9;

/**
 * One layer onto the shells. A scale that differs across and down writes both into one CSS `scale`. `cuts` is false
 * over a moving trim, whose own `visibility` hides its dot: an opacity cut there writes `opacity`, so the two never
 * override each other.
 */
const place = (ctx: Ctx, shells: Shell[], layer: Layer, cuts: boolean): void => {
  const { scale, rotate, offset, opacity } = layer;

  if (isLane(scale)) {
    const even = scale.keys.every((key) => isUniform(key.value));

    open(shells, "scale").lanes.push(
      cssLane(ctx, "scale", scale, ([x, y]) => (even ? { scale: x } : { scale: x, scaleY: y })),
    );
  } else if (scale[0] !== 1 || scale[1] !== 1)
    open(shells, "scale").style.push(
      `scale:${scale[0] === scale[1] ? num(scale[0]) : `${num(scale[0])} ${num(scale[1])}`}`,
    );

  if (isLane(rotate))
    open(shells, "rotate").lanes.push(
      cssLane(ctx, "rotate", rotate, (value) => ({ rotate: value })),
    );
  else if (rotate !== 0) open(shells, "rotate").style.push(`rotate:${num(rotate)}deg`);

  travel(ctx, shells, offset);

  if (isLane(opacity))
    open(shells, "opacity").lanes.push(
      cssLane(ctx, "opacity", opacity, (value) => ({ opacity: value }), { cuts }),
    );
  else if (opacity !== 1) open(shells, "opacity").opacity = opacity;
};

const travel = (ctx: Ctx, shells: Shell[], by: Animated<Vec>): void => {
  if (isLane(by))
    open(shells, "translate").lanes.push(cssLane(ctx, "translate", by, ([x, y]) => ({ x, y })));
  else if (by[0] !== 0 || by[1] !== 0)
    open(shells, "translate").style.push(`translate:${num(by[0])}px ${num(by[1])}px`);
};

const painted = (
  ctx: Ctx,
  slot: "fill" | "stroke",
  paint: Animated<Paint> | undefined,
  attrs: Record<string, AttrValue>,
  lanes: CssLane[],
): void => {
  if (paint === undefined) {
    if (slot === "fill") attrs.fill = "none";

    return;
  }

  if (!isLane(paint)) {
    attrs[slot] = colorText(solid(paint));

    return;
  }

  attrs[slot] = colorText(solid(paint.keys[0].value));
  lanes.push(
    cssLane(ctx, slot, paint, (value) =>
      slot === "fill" ? { fill: colorText(solid(value)) } : { stroke: colorText(solid(value)) },
    ),
  );
};

/** Whether a static trim leaves nothing of the outline. Such a stroke is left out, so no cap draws a dot. */
const emptyTrim = (trim: ShapeNode["trim"]): boolean =>
  trim !== undefined && !isLane(trim) && trim[1] - trim[0] <= 0;

const stroked = (
  ctx: Ctx,
  node: ShapeNode,
  attrs: Record<string, AttrValue>,
  lanes: CssLane[],
): void => {
  const { trim } = node;
  const stroke = emptyTrim(trim) ? undefined : node.stroke;

  painted(ctx, "stroke", stroke?.color, attrs, lanes);

  if (stroke) {
    const width = isLane(stroke.width) ? stroke.width.keys[0].value : stroke.width;

    if (isLane(stroke.width))
      lanes.push(cssLane(ctx, "stroke-width", stroke.width, (value) => ({ strokeWidth: value })));

    if (width !== 1) attrs["stroke-width"] = num(width);

    if (stroke.cap !== "butt") attrs["stroke-linecap"] = stroke.cap;

    if (stroke.join !== "miter") attrs["stroke-linejoin"] = stroke.join;

    if (stroke.dash) attrs["stroke-dasharray"] = stroke.dash.map((n) => num(n)).join(" ");

    if (stroke.nonScaling) attrs["vector-effect"] = "non-scaling-stroke";
  }

  if (trim === undefined || !stroke) return;

  if (stroke.dash)
    throw new Error(
      `"${node.key}" has both a dash and a trim. SVG draws both with one dash pattern, so pick one.`,
    );

  // A trim that grows from the start moves only the dash offset, as the old `draw` does. One whose start moves writes
  // the dash too. Either way `visibility` hides the stroke while it has no length, so a round cap draws no dot.
  if (isLane(trim)) {
    const moving = trim.keys.some((key) => key.value[0] !== 0);

    lanes.push(
      cssLane(ctx, "draw", trim, ([from, to]) =>
        moving ? { draw: to, drawStart: from } : { draw: to },
      ),
    );
  } else if (trim[0] !== 0 || trim[1] !== 1) {
    attrs.pathLength = "1";
    attrs["stroke-dasharray"] = `${num(trim[1] - trim[0])} 2`;
    attrs["stroke-dashoffset"] = num(-trim[0]);
  }
};

/** How far, in px, the path SMIL blends between two of an arc's keys may stray from the true arc. */
const ARC_TOLERANCE = 0.1;

/** The part of `curve` between two points of its progress, as an ease of its own. */
const portion = (curve: Ease, from: number, to: number, where: string): Ease => {
  const tail = from > 0 ? splitEase(curve, from, where)[1] : curve;

  return to < 1 ? splitEase(tail, (to - from) / (1 - from), where)[0] : tail;
};

/**
 * Where to cut a transition between two arcs so the path blend between cuts stays within ARC_TOLERANCE of the arc: an
 * end that turns by δ radians strays about r·δ²/8 from the circle. The cuts follow the ease, so they bunch where it is fast.
 */
const arcCuts = (curve: Ease, turn: number, radius: number): number[] => {
  const most = Math.sqrt((8 * ARC_TOLERANCE) / Math.max(radius, 1e-9));
  const cuts: number[] = [];

  const visit = (a: number, b: number, depth: number): void => {
    const seen = Array.from({ length: 17 }, (_, i) => easeAt(curve, a + ((b - a) * i) / 16));

    if ((Math.max(...seen) - Math.min(...seen)) * turn <= most || depth > 10) return;
    const middle = (a + b) / 2;

    visit(a, middle, depth + 1);
    cuts.push(middle);
    visit(middle, b, depth + 1);
  };

  visit(0, 1, 0);

  return cuts;
};

/**
 * A geometry lane with the keys SMIL needs to draw it exactly. SMIL blends path data point by point, which is exact for
 * every kind whose points move in step with its parameters (rects, ellipses, lines, polygons, matched paths). An arc's
 * ends move around a circle, so a transition between arcs is cut finely enough that each blend stays on the circle.
 * SMIL can't blend path data in steps, so `ease.steps(n)` is written as n cuts.
 */
const blendable = (lane: Lane<Geometry>, key: string): Lane<Geometry> => {
  const where = `geometry on "${key}"`;
  const [head, ...tail] = lane.keys;
  const keys: Key<Geometry>[] = [head];

  tail.forEach((to, index) => {
    const from = index === 0 ? head : tail[index - 1]!;
    const curve = to.ease ?? ease.out;
    const [a, b] = [from.value, to.value];
    const at = (progress: number): number => from.t + (to.t - from.t) * progress;

    if (same(a, b)) {
      keys.push(to);

      return;
    }

    if (curve.kind === "steps" && curve.count > 1) {
      for (let step = 1; step < curve.count; step++)
        keys.push({
          t: at(step / curve.count),
          value: mixGeometry(a, b, step / curve.count, where),
          ease: ease.hold,
        });
      keys.push({ ...to, ease: ease.hold });

      return;
    }

    if (a.kind !== "arc" || b.kind !== "arc" || curve.kind === "steps") {
      keys.push(to);

      return;
    }

    const turn =
      (Math.max(Math.abs(b.start - a.start), Math.abs(b.start + b.sweep - a.start - a.sweep)) *
        Math.PI) /
      180;

    const cuts = [0, ...arcCuts(curve, turn, Math.max(a.radius, b.radius)), 1];

    for (let i = 1; i < cuts.length; i++) {
      const [p, q] = [cuts[i - 1]!, cuts[i]!];

      keys.push({
        t: at(q),
        value: q === 1 ? b : mixGeometry(a, b, easeAt(curve, q), where),
        ease: portion(curve, p, q, where),
      });
    }
  });

  return { ...lane, keys: [head, keys[1]!, ...keys.slice(2)] };
};

/** Path data with one `C` for every curve, so every key of a lane has the same commands and SMIL can blend them. */
const blendData = (contours: readonly Contour[], key: string): PathData => {
  if (contours.length === 0)
    throw new Error(
      `"${key}" animates a geometry with no outline. Give every key a point at least.`,
    );

  // SAFETY: each contour is written from M, so the whole is path data.
  return contours
    .map(
      (contour) =>
        `M${pt(contour.start)}${contour.curves.map((curve) => `C${curve.map(pt).join(" ")}`).join("")}${contour.closed ? "Z" : ""}`,
    )
    .join("") as PathData;
};

/**
 * A geometry that moves is drawn as a `<path>` whose `d` animates through SMIL: the route ../channels.ts gives `d`,
 * since CSS `d` is not animated in Safari and CSS geometry properties (`r`, `rx`, `width`) are not applied in
 * Firefox. Every kind takes this one route, radii included, and the emitter writes the still twin for reduced motion.
 */
const morphing = (
  ctx: Ctx,
  node: ShapeNode,
  lane: Lane<Geometry>,
  at: Vec,
  lanes: CssLane[],
): Drawn => {
  const written = blendable(lane, node.key);

  const pieces = Math.max(
    ...written.keys.map((key) => (key.value.kind === "arc" ? arcPieces(key.value.sweep) : 1)),
  );

  const data = (value: Geometry): PathData => blendData(contoursOf(value, pieces), node.key);
  const first = lane.keys[0].value;

  lanes.push(cssLane(ctx, "d", written, (value) => ({ d: data(value) }), { route: "smil" }));

  return {
    tag: "path",
    attrs: {
      d: data(first),
      ...(first.kind === "path" && first.rule === "evenodd" && { "fill-rule": "evenodd" }),
      ...moved(at),
    },
    placed: false,
  };
};

/** The shape's own element, with its paint, stroke and lanes. */
const shapeElement = (ctx: Ctx, node: ShapeNode, at: Vec, lanes: CssLane[]): Drawn => {
  const drawn = isLane(node.geometry)
    ? morphing(ctx, node, node.geometry, at, lanes)
    : outline(node.geometry, at);

  painted(ctx, "fill", node.fill, drawn.attrs, lanes);
  stroked(ctx, node, drawn.attrs, lanes);

  return drawn;
};

/** Whether a node, or anything it draws, has a trim that moves. */
const hasMovingTrim = (ctx: Ctx, node: SceneNode): boolean => {
  const known = ctx.trims.get(node.key);

  if (known !== undefined) return known;

  const found =
    node.kind === "shape"
      ? node.stroke !== undefined && node.trim !== undefined && isLane(node.trim)
      : node.kind === "group"
        ? node.children.some((child) => hasMovingTrim(ctx, child))
        : node.kind === "instance" && hasMovingTrim(ctx, ctx.scene.symbols[node.symbol]!);

  ctx.trims.set(node.key, found);

  return found;
};

const symbolId = (ctx: Ctx, name: string): string => `${ctx.prefix}symbol-${name}`;

const emitNode = (ctx: Ctx, node: SceneNode): SvgNode => {
  const at: Vec = isLane(node.at) ? [0, 0] : node.at;
  const lanes: CssLane[] = [];
  let drawn: Drawn;
  let children: SvgNode[] = [];

  switch (node.kind) {
    case "group":
      drawn = { tag: "g", attrs: moved(at), placed: false };
      children = node.children.map((child) => emitNode(ctx, child));
      break;
    case "shape": {
      // A moving trim hides its stroke with `visibility` while it has no length. With a fill, the stroke is drawn as
      // an element of its own over the fill, so hiding it never hides the fill.
      if (node.fill === undefined || !hasMovingTrim(ctx, node)) {
        drawn = shapeElement(ctx, node, at, lanes);
        break;
      }

      drawn = { tag: "g", attrs: moved(at), placed: false };
      children = [
        { ...node, stroke: undefined, trim: undefined },
        { ...node, fill: undefined },
      ].map((part) => {
        const own: CssLane[] = [];
        const { tag, attrs } = shapeElement(ctx, part, [0, 0], own);

        return { ...element(tag, attrs, []), ...(own.length > 0 && { lanes: own }) };
      });
      break;
    }

    case "image": {
      const [width, height] = node.size;

      drawn = {
        tag: "image",
        attrs: {
          ...(at[0] !== 0 && { x: num(at[0]) }),
          ...(at[1] !== 0 && { y: num(at[1]) }),
          width: num(width),
          height: num(height),
          preserveAspectRatio: "none",
          href: node.data,
        },
        placed: true,
      };
      break;
    }

    case "instance":
      drawn = {
        tag: "use",
        attrs: { href: `#${symbolId(ctx, node.symbol)}`, ...moved(at) },
        placed: false,
      };
      break;

    case "text": {
      // Every line is placed where layout put it, so no browser anchors or wraps it.
      const [line, ...more] = node.lines;
      const where = (point: Vec) => ({ x: num(at[0] + point[0]), y: num(at[1] + point[1]) });

      drawn = {
        tag: "text",
        attrs: {
          ...(more.length === 0 && where(line?.at ?? [0, 0])),
          "font-family": ctx.scene.fonts[node.family]!,
          "font-size": num(node.size),
          ...(node.lines.some((each) => /^\s|\s$|\s\s/.test(each.text)) && {
            "xml:space": "preserve",
          }),
        },
        placed: true,
      };

      painted(ctx, "fill", node.fill, drawn.attrs, lanes);
      children =
        more.length === 0
          ? [{ kind: "text", value: line?.text ?? "" }]
          : node.lines
              .filter((each) => each.text !== "")
              .map((each) =>
                element("tspan", where(each.at), [{ kind: "text", value: each.text }]),
              );
      break;
    }
  }

  const shells = [shell()];
  const cuts = !hasMovingTrim(ctx, node);

  for (const layer of [...node.layers].reverse()) place(ctx, shells, layer, cuts);

  if (isLane(node.at)) travel(ctx, shells, node.at);

  const [ox, oy] = [at[0] + node.origin[0], at[1] + node.origin[1]];
  const { box } = node;

  const centered =
    Math.abs(node.origin[0] - (box.x + box.width / 2)) < 1e-9 &&
    Math.abs(node.origin[1] - (box.y + box.height / 2)) < 1e-9;

  // The fill box is exact, and shorter to write, when one element carries everything and its own coordinates place it.
  const fillBox =
    shells.length === 1 &&
    drawn.placed &&
    centered &&
    node.kind === "shape" &&
    shells[0]!.style.length === 0;

  const dress = (own: Shell) => {
    const style = [
      ...(own.pivots && !fillBox ? [`transform-origin:${num(ox)}px ${num(oy)}px`] : []),
      ...own.style,
    ];

    return {
      ...(own.opacity !== undefined && { opacity: num(own.opacity) }),
      ...(style.length > 0 && { style: style.join(";") }),
    };
  };

  const [inner, ...outer] = shells;
  const innerLanes = [...lanes, ...inner!.lanes];

  const first: SvgNode = {
    ...element(drawn.tag, { ...drawn.attrs, ...dress(inner!) }, children),
    ...(innerLanes.length > 0 && { lanes: innerLanes }),
  };

  return outer.reduce<SvgNode>(
    (content, own) => ({
      ...element("g", dress(own), [content]),
      ...(own.lanes.length > 0 && { lanes: own.lanes }),
    }),
    first,
  );
};

const tokenCss = (scene: Scene, prefix: string): string => {
  const names = Object.keys(scene.tokens);

  if (names.length === 0) return "";
  const scope = prefix ? `svg.${prefix}root` : "svg";

  const declared = (scheme: "light" | "dark") =>
    names.map((name) => `--${name}:${colorText(scene.tokens[name]![scheme])}`).join(";");

  return `${scope}{${declared("dark")}}\n@media (prefers-color-scheme:light){${scope}{${declared("light")}}}`;
};

export const svg: Backend<string, SvgOptions> = {
  name: "SVG",
  supports,
  emit: (scene, options = {}) => {
    admit(scene, svg, options.onWarning);
    const ctx: Ctx = { scene, prefix: options.prefix ?? "", trims: new Map() };
    const names = Object.keys(scene.symbols);

    // Each symbol is drawn once in <defs>, and each instance is a <use> of it. CSS and SMIL animations inside run in
    // every copy at once, which is what the model means: a symbol's tracks are on the scene's clock.
    const defs = names.map((name) => {
      const root = scene.symbols[name]!;

      return element(
        "g",
        { id: symbolId(ctx, name) },
        root.kind === "group"
          ? root.children.map((child) => emitNode(ctx, child))
          : [emitNode(ctx, root)],
      );
    });

    return render(
      {
        width: scene.size[0],
        height: scene.size[1],
        duration: scene.duration,
        title: scene.title,
        ...(scene.desc !== undefined && { desc: scene.desc }),
        css: tokenCss(scene, options.prefix ?? ""),
        loop: scene.loop,
        reducedMotion: scene.still === undefined ? false : { at: scene.still },
        ...(options.prefix !== undefined && { prefix: options.prefix }),
        ...(options.playbackRate !== undefined && { playbackRate: options.playbackRate }),
      },
      [
        ...(defs.length > 0 ? [element("defs", {}, defs)] : []),
        ...scene.root.children.map((child) => emitNode(ctx, child)),
      ],
    );
  },
};
