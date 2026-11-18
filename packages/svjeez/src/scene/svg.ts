import type { Backend as Route, Target, TargetValues } from "../channels";
import type { Canvas, Lane as CssLane } from "../compile";
import type { Emit } from "../css";
import { num } from "../format";
import type { Key as Held } from "../keys";
import { EPSILON, ease } from "../motion";
import { render } from "../render";
import { element, type AttrValue, type SvgNode } from "../svg";
import { admit, type Backend, type Feature, type Support } from "./backend";
import { foldLayers } from "./fold";
import { drawMoving, type GeometrySlot } from "./svg-geometry";
import type {
  Animated,
  Box,
  Color,
  Gradient,
  Contour,
  Geometry,
  Lane,
  Layer,
  Paint,
  Scene,
  Face,
  GroupNode,
  Rgba,
  SceneNode,
  ShapeNode,
  TextNode,
  TextRun,
  Vec,
} from "./ir";
import { curveLength, isCurved } from "./curve";
import { labelled } from "./identity";
import { isLane, mapLane } from "./lane";
import { same } from "./steps";
import { onCircle } from "./values";
import { homed } from "./pin";
import { lengthOf } from "./geometry";
import { blendable, isGradient } from "./paint";
import { grown, reachOf } from "./reach";
import {
  clipUrl,
  colorText,
  filterUrl,
  gradientUrl,
  maskUrl,
  working,
  type Defs,
} from "./svg-paint";
import { REDUCED_MOTION } from "../css";

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
  /**
   * Write each node's key on its outermost element as `data-key`, and where it was written as `data-source` when
   * the model knows, as the old API's `sources` does: what editors and `svjeez check` read. Default false.
   */
  readonly sources?: boolean;
}

const EXACT: Support = { level: "exact" };

/** Measured against Chromium and Firefox, which draw a small blur as small as it is. */
const SOFT_BLUR: Support = {
  level: "close",
  note: "WebKit draws any blur under about 1.5 units about that soft, so a blur that eases out to 0 looks softer there in its last moments. Chromium and Firefox draw it exactly.",
};

const supports: Readonly<Record<Feature, Support>> = {
  text: EXACT,
  outlinedText: EXACT,
  image: EXACT,
  instance: EXACT,
  clip: EXACT,
  mask: EXACT,
  blur: SOFT_BLUR,
  shadow: SOFT_BLUR,
  linearGradient: EXACT,
  radialGradient: EXACT,
  nonScalingStroke: EXACT,
  liveTokens: EXACT,
  curvedMotion: EXACT,
  movingDashedTrim: {
    level: "close",
    note: "a dash that starts just past a moving end of the trim can show a sliver of its cap there. Butt caps, a still trim or no dash draw it exactly.",
  },
};

interface Ctx {
  readonly scene: Scene;
  readonly prefix: string;
  /** Whether a node or anything under it hides its stroke with `visibility`, by key. */
  readonly hides: Map<string, boolean>;
  readonly sources: boolean;
  /** What the root `<svg>` states for every text in it, so each text writes only what differs. */
  readonly around: Partial<Face>;
  /** Gradients, clips, masks and filters, written once each. */
  readonly defs: Defs;
  /** Where the node being drawn has its frame in its element's own coordinates: what a gradient's points move by. */
  frame: Vec;
  /** The key of the node being drawn, for errors. */
  key: string;
}

const isColor = (paint: Paint): paint is Color => !isGradient(paint);

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
  /** A CSS scale of the element around its frame's origin, under every layer. */
  readonly scale?: Lane<Vec>;
  /** A CSS translate of the element, under every layer. */
  readonly offset?: Lane<Vec>;
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
  | "offset-distance"
  | "translate"
  | "rotate"
  | "scale"
  | "opacity"
  | "draw"
  | "fill"
  | "stroke"
  | "stroke-width"
  | "fill-opacity"
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
  slot: Slot | GeometrySlot | (string & {}),
  lane: Lane<T>,
  values: (value: T) => TargetValues,
  {
    route = "css",
    cuts = true,
    emit,
  }: { readonly route?: Route; readonly cuts?: boolean; readonly emit?: Emit } = {},
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
    emit: emit ?? (cuts && slot === "opacity" && isCut(keys) ? "visibility" : "value"),
  };
};

/** One element's worth of placement: the lanes and still values that can share it without changing the order they apply in. */
interface Shell {
  readonly lanes: CssLane[];
  readonly style: string[];
  readonly taken: Set<Slot>;
  /** A clip, a mask or a filter: what the element does to what it holds, before its own transforms. */
  readonly attrs: Record<string, AttrValue>;
  /** The outermost of translate (0), rotate (1) and scale (2) already here. A new one must come before it. */
  rank: number;
  opacity?: number;
  pivots: boolean;
  /** Where this shell turns and scales, when that is not the node's origin. Nothing else joins such a shell. */
  origin?: Vec;
}

const RANK: Partial<Record<Slot, number>> = { translate: 0, rotate: 1, scale: 2 };

const shell = (): Shell => ({
  lanes: [],
  style: [],
  taken: new Set(),
  attrs: {},
  rank: 3,
  pivots: false,
});

const open = (shells: Shell[], slot: Slot): Shell => {
  const rank = RANK[slot];
  let current = shells.at(-1)!;

  // A motion path's element (see `along`) takes nothing that turns or scales: its own scale is fixed.
  if (
    current.origin !== undefined ||
    current.taken.has(slot) ||
    (rank !== undefined && rank >= current.rank) ||
    ((slot === "rotate" || slot === "scale") && current.taken.has("offset-distance"))
  ) {
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

/**
 * How much larger a motion path is written than it is drawn. Chromium walks a path by straight pieces that stray up to
 * half a unit of its coordinates, about 0.15px on our examples; written this much larger inside a wrapper scaled this
 * much smaller, that is a hundredth of a pixel, as in Firefox and WebKit.
 */
const PATH_SCALE = 16;

/**
 * A lane with curved keys as a CSS motion path: the keys joined into one path, a line for a straight key and a cubic
 * for a curved one (a cut crosses a line it never shows), and `offset-distance` keyframed to each key's share of the
 * path's length. The lane's eases run on those shares unchanged, which is what `Key.via` means: each ease shapes the
 * share of its own piece's length covered. The percent is of the whole path, so each engine's measure of the length
 * cancels out, and `offset-rotate` keeps the element upright.
 *
 * The path moves an element by its transform-origin, after its own translate, rotate and scale, so it gets an element
 * that turns and scales nothing else: a wrapper scaled down by `PATH_SCALE`, its path written that much larger, around
 * content scaled back up as the outermost thing it does.
 */
const along = (ctx: Ctx, shells: Shell[], lane: Lane<Vec>): void => {
  const [first, ...rest] = lane.keys;
  const big = ([x, y]: Vec): string => `${num(x * PATH_SCALE, 1)} ${num(y * PATH_SCALE, 1)}`;
  const lengths = [0];
  let d = `M${big(first.value)}`;

  rest.forEach((key, i) => {
    const from = lane.keys[i]!.value;
    const hold = key.ease?.kind === "steps";

    const length =
      key.via && !hold
        ? curveLength(from, key.via, key.value)
        : Math.hypot(key.value[0] - from[0], key.value[1] - from[1]);

    if (key.via && !hold) d += `C${big(key.via[0])} ${big(key.via[1])} ${big(key.value)}`;
    else if (length > 0) d += `L${big(key.value)}`;
    lengths.push(lengths[i]! + length);

    if (
      key.ease?.kind === "bezier" &&
      key.ease.points.some((value, c) => c % 2 === 1 && (value < 0 || value > 1))
    )
      throw new Error(
        `A curved move at ${num(key.t)}s has an ease that leaves 0 to 1, which lowering never writes. This is a bug in svjeez; please report it with the scene.`,
      );
  });

  const total = lengths.at(-1)!;

  const [head, next, ...others] = lane.keys.map((key, i) => ({
    t: key.t,
    value: total > 0 ? (lengths[i]! / total) * 100 : 0,
    ...(key.ease && { ease: key.ease }),
  }));

  const inner = shells.at(-1)!;
  const transforms: readonly Slot[] = ["translate", "rotate", "scale"];
  const bare = transforms.every((slot) => !inner.taken.has(slot));

  const holder = bare && !inner.pivots && inner.origin === undefined ? inner : shell();

  if (holder !== inner) shells.push(holder);
  holder.style.push(`scale:${PATH_SCALE}`);
  holder.taken.add("scale");

  const own = shell();

  shells.push(own);
  own.taken.add("offset-distance");
  own.taken.add("scale");
  own.style.push(
    `scale:${num(1 / PATH_SCALE, 4).replace(/^0\./, ".")}`,
    `offset-path:path('${d}')`,
    "offset-rotate:0deg",
  );
  own.lanes.push(
    cssLane(ctx, "offset-distance", { ...lane, keys: [head!, next!, ...others] }, (value) => ({
      offsetDistance: value,
    })),
  );
};

const travel = (ctx: Ctx, shells: Shell[], by: Animated<Vec>): void => {
  if (isLane(by) && isCurved(by.keys)) along(ctx, shells, by);
  else if (isLane(by))
    open(shells, "translate").lanes.push(cssLane(ctx, "translate", by, ([x, y]) => ({ x, y })));
  else if (by[0] !== 0 || by[1] !== 0)
    open(shells, "translate").style.push(`translate:${num(by[0])}px ${num(by[1])}px`);
};

/** One key of a paint lane that `blendable` passed, as the kind its first key is. */
const asColor = (paint: Paint, where: string): Color => {
  if (isColor(paint)) return paint;

  throw new Error(
    `${where} holds a color and a gradient in one lane, which lowering never writes. This is a bug in svjeez; please report it with the scene.`,
  );
};

const asGradient = (paint: Paint, where: string): Gradient => {
  if (!isColor(paint)) return paint;

  throw new Error(
    `${where} holds a color and a gradient in one lane, which lowering never writes. This is a bug in svjeez; please report it with the scene.`,
  );
};

/**
 * A fill or stroke. A gradient is laid out in the node's frame, which sits at `shift` in the element's own
 * coordinates: where the node's frame is for the element being drawn, unless the caller says.
 */
const painted = (
  ctx: Ctx,
  slot: "fill" | "stroke",
  paint: Animated<Paint> | undefined,
  attrs: Record<string, AttrValue>,
  lanes: CssLane[],
  shift: Vec = ctx.frame,
  key = ctx.key,
): void => {
  if (paint === undefined) {
    if (slot === "fill") attrs.fill = "none";

    return;
  }

  if (!isLane(paint)) {
    attrs[slot] = isColor(paint)
      ? colorText(paint)
      : gradientUrl(ctx.defs, paint, shift, slot, key);

    return;
  }

  const where = `${slot} on "${key}"`;

  blendable(paint, where);

  if (!isColor(paint.keys[0].value)) {
    const gradients = mapLane(paint, (value) => asGradient(value, where));

    attrs[slot] = gradientUrl(ctx.defs, gradients, shift, slot, key);

    return;
  }

  const colors = mapLane(paint, (value) => asColor(value, where));

  attrs[slot] = colorText(colors.keys[0].value);
  lanes.push(
    cssLane(ctx, slot, colors, (value) =>
      slot === "fill" ? { fill: colorText(value) } : { stroke: colorText(value) },
    ),
  );
};

/** Whether a static trim leaves nothing of the outline. Such a stroke is left out, so no cap draws a dot. */
const emptyTrim = (trim: ShapeNode["trim"]): boolean =>
  trim !== undefined && !isLane(trim) && trim[1] - trim[0] <= 0;

/**
 * The dashes of `dash`, laid from the start of an outline `length` long, that lie inside `trim`: each cut at the
 * trim's ends, as one dash array from the first and the offset that puts the first in place. Undefined when no dash
 * lies inside. A pattern of no length is a solid line.
 */
export const trimmedDash = (
  dash: readonly number[],
  length: number,
  [from, to]: Vec,
): { readonly array: number[]; readonly offset: number } | undefined => {
  const pattern = dash.length % 2 === 1 ? [...dash, ...dash] : [...dash];
  const period = pattern.reduce((sum, n) => sum + n, 0);
  const [start, end] = [from * length, to * length];
  const kept: (readonly [number, number])[] = [];

  if (!(period > 0)) kept.push([start, end]);

  for (let at = 0, i = 0; period > 0 && at <= end; i++) {
    const piece = pattern[i % pattern.length]!;
    const [a, b] = [Math.max(at, start), Math.min(at + piece, end)];

    // A dash that is a dot is kept where it lies; one cut down to nothing is not.
    if (i % 2 === 0 && (piece === 0 ? at >= start : b > a)) kept.push([a, b]);
    at += piece;
  }

  if (kept.length === 0) return undefined;

  return {
    array: [
      ...kept.flatMap(([a, b], k) => (k === 0 ? [b - a] : [a - kept[k - 1]![1], b - a])),
      length + 1,
    ],
    offset: kept[0]![0],
  };
};

/** Whether a dashed stroke under a still trim on a still outline keeps no dash at all. */
const noDashLeft = (node: ShapeNode): boolean =>
  node.stroke?.dash !== undefined &&
  node.trim !== undefined &&
  !isLane(node.trim) &&
  !isLane(node.geometry) &&
  trimmedDash(node.stroke.dash, lengthOf(node.geometry), node.trim) === undefined;

const stroked = (
  ctx: Ctx,
  node: ShapeNode,
  attrs: Record<string, AttrValue>,
  lanes: CssLane[],
  shift: Vec,
): void => {
  const { trim } = node;
  const stroke = emptyTrim(trim) || noDashLeft(node) ? undefined : node.stroke;

  painted(ctx, "stroke", stroke?.color, attrs, lanes, shift, node.key);

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

  // A dash under a still trim on a still outline is one dash array: the dashes inside the trim, each cut at its ends.
  // `dashedTrim` draws any other dash and trim before this is reached.
  if (stroke.dash && !isLane(trim) && !isLane(node.geometry)) {
    const { array, offset } = trimmedDash(stroke.dash, lengthOf(node.geometry), trim)!;

    attrs["stroke-dasharray"] = array.map((n) => num(n)).join(" ");

    if (offset !== 0) attrs["stroke-dashoffset"] = num(-offset);

    return;
  }

  // A trim that grows from the start moves only the dash offset, as the old `draw` does. One whose start moves writes
  // the dash too. Either way `visibility` hides the stroke while it has no length, so a round cap draws no dot.
  if (isLane(trim)) {
    const moving = trim.keys.some((key) => key.value[0] !== 0);

    lanes.push(
      cssLane(
        ctx,
        "draw",
        trim,
        ([from, to]) => (moving ? { draw: to, drawStart: from } : { draw: to }),
        trimHides(node) ? {} : { emit: "dash" },
      ),
    );
  } else if (trim[0] !== 0 || trim[1] !== 1) {
    attrs.pathLength = "1";
    attrs["stroke-dasharray"] = `${num(trim[1] - trim[0])} 2`;
    attrs["stroke-dashoffset"] = num(-trim[0]);
  }
};

/**
 * The shape's own element, with its paint, stroke and lanes. A geometry drawn still may move or scale as a whole. The
 * route is the one `routed` takes, so the two parts of a split shape move as one.
 */
const shapeElement = (
  ctx: Ctx,
  node: ShapeNode,
  at: Vec,
  lanes: CssLane[],
  routed: ShapeNode = node,
): Drawn => {
  const moving = isLane(routed.geometry) ? drawMoving(routed, routed.geometry, at) : undefined;
  let drawn: Drawn;

  if (!isLane(node.geometry)) drawn = outline(node.geometry, at);
  else if (moving?.kind === "element") {
    drawn = { tag: moving.tag, attrs: { ...moving.attrs }, placed: moving.placed };

    for (const { slot, lane, route, emit } of moving.lanes)
      lanes.push(cssLane(ctx, slot, lane, (value) => value, { route, ...(emit && { emit }) }));
  } else {
    const still = moving?.kind === "still" ? moving : undefined;

    drawn = {
      ...outline(still?.geometry ?? node.geometry.keys[0].value, at),
      ...(still?.scale && { scale: still.scale }),
      ...(still?.offset && { offset: still.offset }),
    };
  }

  const shift: Vec = drawn.placed ? at : [0, 0];

  painted(ctx, "fill", node.fill, drawn.attrs, lanes, shift, node.key);
  stroked(ctx, node, drawn.attrs, lanes, shift);

  return drawn;
};

/** Whether a trim's stroke must hide while it has no length: a round or square cap draws a dot there. */
const trimHides = (node: ShapeNode): boolean =>
  node.stroke !== undefined &&
  node.trim !== undefined &&
  isLane(node.trim) &&
  node.stroke.cap !== "butt" &&
  node.trim.keys.some(({ value: [from, to] }) => to - from <= 0);

/** Whether a node, or anything it draws, hides its stroke with `visibility` while the stroke has no length. */
const hidesStroke = (ctx: Ctx, node: SceneNode): boolean => {
  const known = ctx.hides.get(node.key);

  if (known !== undefined) return known;

  const found =
    node.kind === "shape"
      ? trimHides(node)
      : node.kind === "group"
        ? node.children.some((child) => hidesStroke(ctx, child))
        : node.kind === "instance" && hidesStroke(ctx, ctx.scene.symbols[node.symbol]!);

  ctx.hides.set(node.key, found);

  return found;
};

/** A text's element, and the runs inside it. */
interface DrawnText {
  readonly drawn: Drawn;
  readonly children: SvgNode[];
}

/** A run's face and paints, as a key: two runs with the same one draw alike. */
const lookOf = (run: TextRun): string => JSON.stringify([run.face, run.fill, run.opacity ?? 1]);

/** The look most runs share, the first of them on a tie: the `<text>` states it, and each run only what differs. */
const commonest = (runs: readonly TextRun[]): TextRun | undefined => {
  const counts = new Map<string, { run: TextRun; count: number }>();

  for (const run of runs) {
    const known = counts.get(lookOf(run)) ?? { run, count: 0 };

    known.count++;
    counts.set(lookOf(run), known);
  }

  return [...counts.values()].reduce<{ run: TextRun; count: number } | undefined>(
    (best, each) => (best === undefined || each.count > best.count ? each : best),
    undefined,
  )?.run;
};

/**
 * One `<text>` with a `<tspan>` for each run, each where layout put it, so no browser anchors or wraps it. The
 * `<text>` states the look most runs share and each `<tspan>` only what differs, so every run's face is known to
 * the emitter, which puts its characters into that face's subset and no other.
 */
const textElement = (ctx: Ctx, node: TextNode, at: Vec, lanes: CssLane[]): DrawnText => {
  const { fonts } = ctx.scene;
  const runs = node.lines.flatMap((line) => line.runs);
  const base = commonest(runs);
  const [line, ...more] = node.lines;
  const single = more.length === 0 && (line?.runs.length ?? 0) <= 1;

  const where = ([px, py]: Vec, x: boolean, y: boolean) => ({
    ...(x && { x: num(at[0] + px) }),
    ...(y && { y: num(at[1] + py) }),
  });

  // Where nothing around says, a weight or style is written unless it is the browser's own, 400 and normal, and the
  // family has no other: the emitter must know each text's face to put its characters in that face's subset.
  const facing = (face: Face, around: Partial<Face>) => {
    const { faces } = fonts[face.family]!;

    const weight =
      around.weight === undefined
        ? face.weight !== 400 || faces.some((each) => each.weight !== face.weight)
        : face.weight !== around.weight;

    const style =
      around.style === undefined
        ? face.style !== "normal" || faces.some((each) => each.style !== face.style)
        : face.style !== around.style;

    return {
      ...(face.family !== around.family && { "font-family": fonts[face.family]! }),
      ...(weight && { "font-weight": num(face.weight) }),
      ...(style && { "font-style": face.style }),
    };
  };

  const opacity = (run: TextRun, attrs: Record<string, AttrValue>, own: CssLane[]): void => {
    const value = run.opacity ?? 1;

    if (!isLane(value)) {
      attrs["fill-opacity"] = num(value);

      return;
    }

    attrs["fill-opacity"] = num(value.keys[0].value);
    own.push(cssLane(ctx, "fill-opacity", value, (each) => ({ fillOpacity: each })));
  };

  const firstLine = line?.at ?? [0, 0];
  const start = line?.runs[0]?.at ?? firstLine;

  const drawn: Drawn = {
    tag: "text",
    placed: true,
    attrs: {
      ...(single && where(start, start[0] + at[0] !== 0, start[1] + at[1] !== 0)),
      ...(base && facing(base.face, ctx.around)),
      "font-size": num(node.size),
      ...(node.lines.some((each) =>
        /^\s|\s$|\s\s/.test(each.runs.map((run) => run.text).join("")),
      ) && {
        "xml:space": "preserve",
      }),
    },
  };

  if (base) {
    painted(ctx, "fill", base.fill, drawn.attrs, lanes, at, node.key);

    if (base.opacity !== undefined) opacity(base, drawn.attrs, lanes);
  } else drawn.attrs.fill = "none";

  if (single)
    return { drawn, children: line?.runs[0] ? [{ kind: "text", value: line.runs[0].text }] : [] };

  // The first tspan starts where the text does, at 0 0 of its frame unless it says; every later one says where.
  let first = true;

  const children = node.lines.flatMap((each) =>
    each.runs.map((run, index): SvgNode => {
      const own: CssLane[] = [];

      const placed = where(
        run.at,
        !first || at[0] + run.at[0] !== 0,
        index === 0 && (!first || at[1] + run.at[1] !== 0),
      );

      const tspan: Drawn = {
        tag: "tspan",
        placed: true,
        attrs: { ...placed, ...facing(run.face, base!.face) },
      };

      first = false;

      if (!same(run.fill, base!.fill))
        painted(ctx, "fill", run.fill, tspan.attrs, own, at, node.key);

      if (!same(run.opacity ?? 1, base!.opacity ?? 1)) opacity(run, tspan.attrs, own);

      return {
        ...element("tspan", tspan.attrs, [{ kind: "text", value: run.text }]),
        ...(own.length > 0 && { lanes: own }),
      };
    }),
  );

  return { drawn, children };
};

/** The element that takes a clip, a mask or a filter, and where the node's frame sits in its coordinates. */
interface Holder {
  readonly own: Shell;
  readonly shift: Vec;
}

/**
 * Clip and mask on one element, then effects on one around it, inside every layer: the order rule 4 of ir.ts sets.
 * The element drawn takes them itself when nothing else is on it yet, and a group of their own holds them otherwise.
 * Each is laid out in its element's own coordinates, where the node's frame sits at `shift`.
 */
const dressed = (ctx: Ctx, node: SceneNode, shells: Shell[], at: Vec, drawn: Drawn): void => {
  const holder = (): Holder => {
    const current = shells.at(-1)!;

    const bare =
      shells.length === 1 &&
      current.taken.size === 0 &&
      current.style.length === 0 &&
      current.lanes.length === 0 &&
      current.opacity === undefined &&
      Object.keys(current.attrs).length === 0;

    if (bare) return { own: current, shift: drawn.placed ? at : [0, 0] };
    const own = shell();

    shells.push(own);

    return { own, shift: at };
  };

  const moved = (box: Box, [x, y]: Vec): Box => ({ ...box, x: box.x + x, y: box.y + y });
  const { scene } = ctx;

  if (node.clip !== undefined || node.mask) {
    const { own, shift } = holder();

    if (node.clip !== undefined)
      own.attrs["clip-path"] = clipUrl(ctx.defs, node.clip, shift, node.key);

    if (node.mask) {
      const reach = reachOf(node.mask, scene.symbols, `the mask of "${node.key}"`);
      const region = reach ? moved(grown(reach, 1), shift) : { x: 0, y: 0, width: 0, height: 0 };

      own.attrs.mask = maskUrl(ctx.defs, node.mask, region, shift);
    }
  }

  const effects = working(node.effects);

  if (effects.length === 0) return;
  const reach = reachOf({ ...node, effects }, scene.symbols, `the effects of "${node.key}"`);

  // A node that draws nothing has nothing for its effects to work on.
  if (!reach) return;
  const { own, shift } = holder();

  own.attrs.filter = filterUrl(ctx.defs, effects, moved(grown(reach, 1), shift), node.key);
};

const symbolId = (ctx: Ctx, name: string): string => `${ctx.prefix}symbol-${name}`;

/**
 * A group that holds one node and does nothing but place it, as the frame around a path drawn by its own coordinates
 * does, written as that node placed by both: one element fewer. Its layers go to the node when the node has none,
 * turned around the same point. With sources asked for, every node keeps its own element, so its key is on it.
 */
const lifted = (ctx: Ctx, node: SceneNode): SceneNode => {
  if (ctx.sources || node.kind !== "group" || node.children.length !== 1) return node;
  const [child] = node.children;

  if (
    node.clip !== undefined ||
    node.mask !== undefined ||
    node.effects.length > 0 ||
    isLane(child!.at) ||
    (node.layers.length > 0 && child!.layers.length > 0)
  )
    return node;
  const [x, y] = child!.at;

  return lifted(ctx, {
    ...child!,
    at: homed(node.at, [-x, -y]),
    ...(node.layers.length > 0 && {
      layers: node.layers,
      origin: [node.origin[0] - x, node.origin[1] - y],
    }),
  });
};

/** Opaque white, what a mask's content is drawn in: only its alpha counts. */
const OPAQUE: Rgba = [1, 1, 1, 1];

/**
 * A dashed stroke whose trim or outline moves, as a group that draws the same: the fill on its own, then the dashed
 * stroke masked by the trimmed stroke undashed. With butt caps it is exact; with round or square ones, a dash that
 * starts just past a moving end can show a sliver of its cap, which `diagnose` reports.
 */
const dashedTrim = (node: SceneNode): GroupNode | undefined => {
  if (node.kind !== "shape" || !node.stroke?.dash || node.trim === undefined) return undefined;

  if (!isLane(node.trim) && !isLane(node.geometry)) return undefined;
  const { kind: _, geometry, fill, stroke, trim, clip, mask, ...base } = node;

  const still = {
    box: node.box,
    at: [0, 0] as const,
    origin: node.origin,
    layers: [],
    effects: [],
  };

  const { dash: _dash, ...solid } = stroke;

  const outline: GroupNode = {
    kind: "group",
    ...still,
    key: `${node.key}#trim`,
    children: [
      {
        kind: "shape",
        ...still,
        key: `${node.key}#trim/stroke`,
        geometry,
        stroke: { ...solid, color: OPAQUE },
        trim,
      },
    ],
  };

  return {
    ...base,
    kind: "group",
    ...(clip !== undefined && { clip }),
    ...(mask !== undefined && { mask }),
    children: [
      ...(fill === undefined
        ? []
        : [{ kind: "shape", ...still, key: `${node.key}#fill`, geometry, fill } as const]),
      { kind: "shape", ...still, key: `${node.key}#stroke`, geometry, stroke, mask: outline },
    ],
  };
};

const emitNode = (ctx: Ctx, given: SceneNode): SvgNode => {
  const node = lifted(ctx, given);
  const split = dashedTrim(node);

  if (split) return emitNode(ctx, split);

  const at: Vec = isLane(node.at) ? [0, 0] : node.at;

  ctx.frame = at;
  ctx.key = node.key;
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
      if (node.fill === undefined || !hidesStroke(ctx, node)) {
        drawn = shapeElement(ctx, node, at, lanes);
        break;
      }

      drawn = { tag: "g", attrs: moved(at), placed: false };
      children = [
        { ...node, stroke: undefined, trim: undefined },
        { ...node, fill: undefined },
      ].map((part) => {
        const own: CssLane[] = [];
        const { tag, attrs, offset } = shapeElement(ctx, part, [0, 0], own, node);

        if (offset) own.push(cssLane(ctx, "translate", offset, ([x, y]) => ({ x, y })));

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

    case "text":
      ({ drawn, children } = textElement(ctx, node, at, lanes));
      break;
  }

  const shells = [shell()];
  const cuts = !hidesStroke(ctx, node);
  const [ox, oy] = [at[0] + node.origin[0], at[1] + node.origin[1]];

  // A geometry drawn still and scaled scales around its frame's origin, under every layer. A shell of its own holds
  // it when that is not where the layers turn.
  if (drawn.scale) {
    const even = drawn.scale.keys.every((key) => isUniform(key.value));
    const own = open(shells, "scale");

    own.lanes.push(
      cssLane(ctx, "scale", drawn.scale, ([x, y]) =>
        even ? { scale: x } : { scale: x, scaleY: y },
      ),
    );

    if (Math.abs(ox - at[0]) > 1e-9 || Math.abs(oy - at[1]) > 1e-9) own.origin = at;
  }

  if (drawn.offset) travel(ctx, shells, drawn.offset);

  dressed(ctx, node, shells, at, drawn);

  for (const layer of [...foldLayers(node.layers)].reverse()) place(ctx, shells, layer, cuts);

  if (isLane(node.at)) travel(ctx, shells, node.at);

  const { box } = node;

  const centered =
    Math.abs(node.origin[0] - (box.x + box.width / 2)) < 1e-9 &&
    Math.abs(node.origin[1] - (box.y + box.height / 2)) < 1e-9;

  // The fill box is exact, and shorter to write, when one element carries everything and its own coordinates place it.
  const fillBox =
    shells.length === 1 &&
    shells[0]!.origin === undefined &&
    drawn.placed &&
    centered &&
    node.kind === "shape" &&
    shells[0]!.style.length === 0;

  const dress = (own: Shell) => {
    const style = [
      ...(own.pivots && !fillBox
        ? [`transform-origin:${num(own.origin?.[0] ?? ox)}px ${num(own.origin?.[1] ?? oy)}px`]
        : []),
      ...own.style,
    ];

    return {
      ...own.attrs,
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

  const out = outer.reduce<SvgNode>(
    (content, own) => ({
      ...element("g", dress(own), [content]),
      ...(own.lanes.length > 0 && { lanes: own.lanes }),
    }),
    first,
  );

  if (ctx.sources) return labelled(node, out);

  // A group with nothing of its own (no placement, opacity or lanes) changes nothing it holds: paint order, paint and
  // place are all the parent's. Its children stand in its place, so a layout container costs no element.
  return node.kind === "group" &&
    out.kind === "element" &&
    out.tag === "g" &&
    out.lanes === undefined &&
    Object.keys(out.attrs).length === 0
    ? { kind: "fragment", children: out.children }
    : out;
};

const tokenCss = (scene: Scene, prefix: string): string => {
  const names = Object.keys(scene.tokens);

  if (names.length === 0) return "";
  const scope = prefix ? `svg.${prefix}root` : "svg";

  const declared = (scheme: "light" | "dark") =>
    names.map((name) => `--${name}:${colorText(scene.tokens[name]![scheme])}`).join(";");

  return `${scope}{${declared("dark")}}\n@media (prefers-color-scheme:light){${scope}{${declared("light")}}}`;
};

/**
 * What the root `<svg>` states for the texts in it: the family most of them are drawn in, when two or more are, and
 * weight 400 and style normal when a family has others, so a text in the regular face need not say so.
 */
const aroundOf = (scene: Scene): Partial<Face> => {
  const counts = new Map<string, number>();

  const visit = (node: SceneNode): void => {
    if (node.kind === "text") {
      const family = commonest(node.lines.flatMap((line) => line.runs))?.face.family;

      if (family !== undefined) counts.set(family, (counts.get(family) ?? 0) + 1);
    }

    if (node.kind === "group") node.children.forEach(visit);

    if (node.mask) visit(node.mask);
  };

  visit(scene.root);
  Object.values(scene.symbols).forEach(visit);
  const [best] = [...counts].sort((a, b) => b[1] - a[1]);
  const faces = Object.values(scene.fonts).map((family) => family.faces);

  return {
    ...(best && best[1] >= 2 && { family: best[0] }),
    ...(faces.some((each) => each.some((face) => face.weight !== each[0]!.weight)) && {
      weight: 400,
    }),
    ...(faces.some((each) => each.some((face) => face.style !== each[0]!.style)) && {
      style: "normal" as const,
    }),
  };
};

export const svg: Backend<string, SvgOptions> = {
  name: "SVG",
  supports,
  emit: (scene, options = {}) => {
    admit(scene, svg, options.onWarning);
    const around = aroundOf(scene);

    const prefix = options.prefix ?? "";

    const canvas: Canvas = {
      width: scene.size[0],
      height: scene.size[1],
      duration: scene.duration,
      playbackRate: options.playbackRate ?? 1,
      prefix,
      ...(scene.still !== undefined && { stillAt: scene.still }),
      loop: scene.loop,
    };

    const ctx: Ctx = {
      scene,
      prefix,
      hides: new Map(),
      sources: options.sources ?? false,
      around,
      defs: {
        scene,
        canvas,
        nodes: [],
        stills: [],
        ids: new Map(),
        counts: new Map(),
        lane: (slot, lane, values, route) => cssLane(ctx, slot, lane, values, { route }),
        draw: (node) => emitNode(ctx, node),
      },
      frame: [0, 0],
      key: "",
    };

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

    const body = scene.root.children.map((child) => emitNode(ctx, child));
    const all = [...defs, ...ctx.defs.nodes];
    const { stills } = ctx.defs;

    return render(
      {
        width: scene.size[0],
        height: scene.size[1],
        duration: scene.duration,
        title: scene.title,
        ...(scene.desc !== undefined && { desc: scene.desc }),
        css: [tokenCss(scene, prefix), stills.length > 0 && `${REDUCED_MOTION}${stills.join("")}}`]
          .filter(Boolean)
          .join("\n"),
        loop: scene.loop,
        reducedMotion: scene.still === undefined ? false : { at: scene.still },
        ...(options.prefix !== undefined && { prefix: options.prefix }),
        ...(options.playbackRate !== undefined && { playbackRate: options.playbackRate }),
        // Font properties inherit, so what the root states reaches every text, and the emitter still knows each
        // text's face, so each face's subset holds only what is drawn in it.
        ...(Object.keys(around).length > 0 && {
          font: {
            ...(around.family !== undefined && { family: scene.fonts[around.family]! }),
            ...(around.weight !== undefined && { weight: around.weight }),
            ...(around.style !== undefined && { style: around.style }),
          },
        }),
      },
      [...(all.length > 0 ? [element("defs", {}, all)] : []), ...body],
    );
  },
};
