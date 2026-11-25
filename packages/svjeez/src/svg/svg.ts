import { cssFontStyle } from "../font/font";
import type { Backend as Route, Channel, ChannelValues } from "./channels";
import type { Canvas, Lane as CssLane } from "./compile";
import type { Emit } from "./css";
import { num } from "../model/format";
import { moving, type Key as Held } from "./keys";
import { DEFAULT_EASE, EPSILON, isHold } from "../model/time";
import { render } from "./render";
import { element, text, type AttrValue, type Element, type SvgNode } from "./tree";
import { admit, type Backend, type Feature, type LaneReport, type Support } from "../model/backend";
import { foldLayers } from "../model/fold";
import { drawMoving, isStraight, type GeometrySlot } from "./svg-geometry";
import type {
  Animated,
  Box,
  ClockMark,
  Color,
  Gradient,
  Contour,
  Geometry,
  Lane,
  Layer,
  Paint,
  Pattern,
  Scene,
  Face,
  GroupNode,
  Rgba,
  SceneNode,
  Scheme,
  ShaderMark,
  ShapeNode,
  Stroke,
  TextNode,
  TextRun,
  Vec,
} from "../model/ir";
import { curveLength, isCurved } from "../model/curve";
import { placeOf } from "../model/scene-error";
import { atRest, isLane, mapLane } from "../model/lane";
import { mixNumber, same } from "../model/steps";
import { homed } from "../author/pin";
import { growBox, lengthOf, onCircle, smilSafeWith } from "../model/geometry";
import { blendable, isGradient } from "../author/paint";
import { isColor } from "../model/painted";
import { reachOf } from "../model/reach";
import { walkScene } from "../model/walk";
import {
  clipUrl,
  clockAttrs,
  colorText,
  filterUrl,
  gradientUrl,
  maskUrl,
  pathId,
  patternUrl,
  working,
  type Defs,
} from "./svg-paint";
import { REDUCED_MOTION, length } from "./css";

export interface SvgOptions {
  readonly prefix?: string;
  /**
   * Tokens to set to one CSS value in place of their light and dark ones, by name: `{ ink: "currentColor" }` paints the
   * scene with the color of the page it is inlined in, and `"inherit"` takes the page's own custom property of that name.
   */
  readonly resolve?: Readonly<Record<string, string>>;
  readonly playbackRate?: number;
  readonly sources?: boolean;
  /** Emit `data-svz-id` on every element whose node has an `id`, for a host that finds and drives them. Off by default. */
  readonly ids?: boolean;
}

const EXACT: Support = { level: "exact" };

const SOFT_BLUR: Support = {
  level: "close",
  note: "WebKit draws any blur under about 1.5 units about that soft, so a blur that eases out to 0 looks softer there in its last moments. Chromium and Firefox draw it exactly.",
};

const supports: Readonly<Record<Feature, Support>> = {
  text: EXACT,
  unoutlinedText: EXACT,
  picture: EXACT,
  clip: EXACT,
  mask: EXACT,
  blur: EXACT,
  shadow: EXACT,
  adjust: EXACT,
  displace: EXACT,
  softBlur: SOFT_BLUR,
  linearGradient: EXACT,
  radialGradient: EXACT,
  pattern: EXACT,
  fixedWidthStroke: EXACT,
  liveTokens: EXACT,
  curvedMotion: EXACT,
  movingDashedTrim: {
    level: "close",
    note: "a dash that starts just past a moving end of the trim can show a sliver of its cap there. Flat caps, a still trim or no dash draw it exactly.",
  },
};

interface Ctx {
  readonly scene: Scene;
  readonly prefix: string;
  readonly hides: Map<string, boolean>;
  readonly sources: boolean;
  readonly ids: boolean;
  readonly around: Partial<Face>;
  readonly defs: Defs;
  readonly onLane?: (lane: LaneReport) => void;
  readonly reported: Set<string>;
  /** The schemes some node shows only in. */
  readonly schemes: Set<Scheme>;
  /** The node being emitted: the owner of every lane written meanwhile. */
  current?: SceneNode;
  /** The clock of the clocked sequence the node being emitted is in, if it is in one. */
  clock: ClockMark | undefined;
}

const pt = ([x, y]: Vec): string => `${num(x)} ${num(y)}`;

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

const roundedRect = ({
  size: [w, h],
  radius: [tl, tr, br, bl],
}: Extract<Geometry, { kind: "rect" }>): string => {
  const corner = (r: number, x: number, y: number): string =>
    r > 0 ? `A${num(r)} ${num(r)} 0 0 1 ${num(x)} ${num(y)}` : "";

  return [
    `M${num(tl)} 0H${num(w - tr)}`,
    corner(tr, w, tr),
    `V${num(h - br)}`,
    corner(br, w - br, h),
    `H${num(bl)}`,
    corner(bl, 0, h - bl),
    `V${num(tl)}`,
    corner(tl, tl, 0),
    "Z",
  ].join("");
};

interface Drawn {
  readonly tag: string;
  readonly attrs: Record<string, AttrValue>;
  readonly placed: boolean;
  readonly scale?: Lane<Vec>;
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
          attrs: { d: roundedRect(geometry), ...moved(at) },
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
    case "points":
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

const held = <T>(lane: Lane<T>, duration: number, values: (value: T) => ChannelValues) => {
  const period = lane.period ?? duration;

  const keys = lane.keys.map((key, index): Held => ({
    t: key.t,
    values: values(key.value),
    ease: lane.keys[index + 1]?.ease ?? DEFAULT_EASE,
  }));

  const [first, last] = [keys[0]!, keys.at(-1)!];

  return {
    keys: [
      ...(first.t > EPSILON ? [{ ...first, t: 0, ease: DEFAULT_EASE }] : []),
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
  | "skew"
  | "opacity"
  | "draw"
  | "fill"
  | "stroke"
  | "stroke-width"
  | "stroke-dashoffset"
  | "fill-opacity"
  | "d";

const isCut = (keys: readonly Held[]): boolean =>
  keys.every((key, index) => {
    const value = key.values.opacity;
    const next = keys[index + 1];

    return (
      (value === 0 || value === 1) &&
      (next === undefined || next.values.opacity === value || isHold(key.ease))
    );
  });

const report = (ctx: Ctx, slot: string, lane: CssLane): void => {
  const { onLane, current } = ctx;

  if (!onLane || !current) return;
  const scale = lane.snapped / lane.period;

  const spans = lane.keys.flatMap((key, index) => {
    if (!moving(lane.keys, index)) return [];
    const next = lane.keys[index + 1]!;
    const start = (isHold(key.ease) ? next.t : key.t) * scale;

    return [{ start, over: Math.max(0, next.t * scale - start) }];
  });

  if (spans.length === 0) return;

  const record: LaneReport = {
    key: current.key,
    ...(current.source && { source: current.source }),
    lane: slot,
    backend: lane.backend,
    spans,
    period: lane.snapped,
  };

  const id = JSON.stringify(record);

  if (ctx.reported.has(id)) return;
  ctx.reported.add(id);
  onLane(record);
};

const cssLane = <T>(
  ctx: Ctx,
  slot: Slot | GeometrySlot | (string & {}),
  lane: Lane<T>,
  values: (value: T) => ChannelValues,
  {
    route = "css",
    cuts = true,
    emit,
    joins = false,
  }: {
    readonly route?: Route;
    readonly cuts?: boolean;
    readonly emit?: Emit;
    readonly joins?: boolean;
  } = {},
): CssLane => {
  const { keys, period } = held(lane, ctx.scene.duration, values);

  const written: CssLane = {
    key: slot,
    backend: route,
    // SAFETY: every values() above returns a ChannelValues, so the names of its first key are Channels.
    channels: Object.keys(keys[0]!.values) as Channel[],
    keys,
    period,
    snapped: period,
    emit: emit ?? (cuts && slot === "opacity" && isCut(keys) ? "visibility" : "value"),
    joins,
  };

  report(ctx, slot, written);

  return written;
};

interface Shell {
  readonly lanes: CssLane[];
  readonly style: string[];
  readonly taken: Set<Slot>;
  readonly attrs: Record<string, AttrValue>;
  rank: number;
  opacity?: number;
  pivots: boolean;
  origin?: Vec;
}

const RANK: Partial<Record<Slot, number>> = { translate: 0, rotate: 1, scale: 2, skew: 3 };

const shell = (): Shell => ({
  lanes: [],
  style: [],
  taken: new Set(),
  attrs: {},
  rank: 4,
  pivots: false,
});

const open = (shells: Shell[], slot: Slot): Shell => {
  const rank = RANK[slot];
  let current = shells.at(-1)!;

  if (
    current.origin !== undefined ||
    current.taken.has(slot) ||
    (slot === "skew" && shells.length === 1) ||
    (rank !== undefined && rank >= current.rank) ||
    ((slot === "rotate" || slot === "scale") && current.taken.has("offset-distance"))
  ) {
    current = shell();
    shells.push(current);
  }

  current.taken.add(slot);

  if (rank !== undefined) current.rank = rank;

  if (slot === "rotate" || slot === "scale" || slot === "skew") current.pivots = true;

  return current;
};

const isUniform = ([x, y]: Vec): boolean => Math.abs(x - y) < 1e-9;

const place = (ctx: Ctx, shells: Shell[], layer: Layer, cuts: boolean): void => {
  const { scale, rotate, skew, offset, opacity } = layer;

  if (isLane(skew))
    open(shells, "skew").lanes.push(cssLane(ctx, "skew", skew, (value) => ({ skew: value })));
  else if (skew !== 0) open(shells, "skew").style.push(`transform:skewX(${num(skew)}deg)`);

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

const PATH_SCALE = 16;

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
  const transforms: readonly Slot[] = ["translate", "rotate", "scale", "skew"];
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

const asColor = (paint: Paint, where: string): Color => {
  if (isColor(paint)) return paint;

  throw new Error(
    `${where} holds a color and a gradient in one lane, which lowering never writes. This is a bug in svjeez; please report it with the scene.`,
  );
};

const asGradient = (paint: Paint, where: string): Gradient => {
  if (isGradient(paint)) return paint;

  throw new Error(
    `${where} holds a gradient and another kind of paint in one lane, which lowering never writes. This is a bug in svjeez; please report it with the scene.`,
  );
};

const urlOf = (
  ctx: Ctx,
  paint: Gradient | Pattern,
  slot: "fill" | "stroke",
  shift: Vec,
  key: string,
): string =>
  paint.kind === "pattern"
    ? patternUrl(ctx.defs, paint, shift, slot, key)
    : gradientUrl(ctx.defs, paint, shift, slot, key);

const painted = (
  ctx: Ctx,
  slot: "fill" | "stroke",
  paint: Animated<Paint> | undefined,
  attrs: Record<string, AttrValue>,
  lanes: CssLane[],
  shift: Vec,
  key: string,
): void => {
  if (paint === undefined) {
    if (slot === "fill") attrs.fill = "none";

    return;
  }

  if (!isLane(paint)) {
    attrs[slot] = isColor(paint) ? colorText(paint) : urlOf(ctx, paint, slot, shift, key);

    return;
  }

  const where = `${slot} on "${key}"`;

  blendable(paint, where);

  const first = paint.keys[0].value;

  if (!isColor(first)) {
    attrs[slot] =
      first.kind === "pattern"
        ? urlOf(ctx, first, slot, shift, key)
        : gradientUrl(
            ctx.defs,
            mapLane(paint, (value) => asGradient(value, where)),
            shift,
            slot,
            key,
          );

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

const emptyTrim = (trim: ShapeNode["trim"]): boolean =>
  trim !== undefined && !isLane(trim) && trim[1] - trim[0] <= 0;

const trimmedDash = (
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

const noDashLeft = (node: ShapeNode): boolean =>
  node.stroke?.dash !== undefined &&
  node.trim !== undefined &&
  !isLane(node.trim) &&
  !isLane(node.geometry) &&
  trimmedDash(node.stroke.dash, lengthOf(node.geometry), node.trim) === undefined;

const strokeAttrs = (
  ctx: Ctx,
  stroke: Stroke | undefined,
  attrs: Record<string, AttrValue>,
  lanes: CssLane[],
  shift: Vec,
  key: string,
): void => {
  painted(ctx, "stroke", stroke?.color, attrs, lanes, shift, key);

  if (!stroke) return;
  const width = isLane(stroke.width) ? stroke.width.keys[0].value : stroke.width;

  if (isLane(stroke.width))
    lanes.push(cssLane(ctx, "stroke-width", stroke.width, (value) => ({ strokeWidth: value })));

  if (width !== 1) attrs["stroke-width"] = num(width);

  if (stroke.cap !== "flat") attrs["stroke-linecap"] = stroke.cap;

  if (stroke.join !== "sharp")
    attrs["stroke-linejoin"] = stroke.join === "flat" ? "bevel" : stroke.join;

  if (stroke.dash) attrs["stroke-dasharray"] = stroke.dash.map((n) => num(n)).join(" ");

  const { dashOffset } = stroke;

  if (dashOffset !== undefined) {
    const first = isLane(dashOffset) ? dashOffset.keys[0].value : dashOffset;

    if (isLane(dashOffset))
      lanes.push(cssLane(ctx, "stroke-dashoffset", dashOffset, (value) => ({ dashOffset: value })));

    if (first !== 0) attrs["stroke-dashoffset"] = num(first);
  }

  if (stroke.fixedWidth) attrs["vector-effect"] = "non-scaling-stroke";

  if (stroke.under) attrs["paint-order"] = "stroke";
};

const stroked = (
  ctx: Ctx,
  node: ShapeNode,
  attrs: Record<string, AttrValue>,
  lanes: CssLane[],
  shift: Vec,
): void => {
  const { trim } = node;
  const stroke = emptyTrim(trim) || noDashLeft(node) ? undefined : node.stroke;

  strokeAttrs(ctx, stroke, attrs, lanes, shift, node.key);

  if (trim === undefined || !stroke) return;

  if (stroke.dash && !isLane(trim) && !isLane(node.geometry)) {
    const { array, offset } = trimmedDash(stroke.dash, lengthOf(node.geometry), trim)!;

    attrs["stroke-dasharray"] = array.map((n) => num(n)).join(" ");

    if (offset !== 0) attrs["stroke-dashoffset"] = num(-offset);

    return;
  }

  if (isLane(trim)) {
    const moving = trim.keys.some((key) => key.value[0] !== 0);

    lanes.push(
      cssLane(
        ctx,
        "draw",
        trim,
        ([from, to]) => (moving ? { draw: to, drawStart: from } : { draw: to }),
        trimHides(node)
          ? { joins: closed(node.geometry) }
          : { emit: "dash", joins: closed(node.geometry) },
      ),
    );
  } else if (trim[0] !== 0 || trim[1] !== 1) {
    attrs.pathLength = "1";
    attrs["stroke-dasharray"] = `${num(trim[1] - trim[0])} 2`;
    attrs["stroke-dashoffset"] = num(-trim[0]);
  }
};

const applyFillOpacity = (
  ctx: Ctx,
  value: Animated<number> | undefined,
  attrs: Record<string, AttrValue>,
  lanes: CssLane[],
): void => {
  if (value === undefined) return;

  if (!isLane(value)) {
    if (value !== 1) attrs["fill-opacity"] = num(value);

    return;
  }

  attrs["fill-opacity"] = num(value.keys[0].value);
  lanes.push(cssLane(ctx, "fill-opacity", value, (each) => ({ fillOpacity: each })));
};

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
  applyFillOpacity(ctx, node.fillOpacity, drawn.attrs, lanes);
  stroked(ctx, node, drawn.attrs, lanes, shift);

  return drawn;
};

/** Whether a stroke around this geometry has a join where it starts. An animated geometry might, so it counts. */
const closed = (geometry: ShapeNode["geometry"]): boolean => {
  if (isLane(geometry)) return true;

  switch (geometry.kind) {
    case "rect":
    case "ellipse":
      return true;
    case "points":
      return geometry.closed;
    case "path":
      return geometry.contours.some((contour) => contour.closed);
    default:
      return false;
  }
};

const trimHides = (node: ShapeNode): boolean =>
  node.stroke !== undefined &&
  node.trim !== undefined &&
  isLane(node.trim) &&
  node.stroke.cap !== "flat" &&
  node.trim.keys.some(({ value: [from, to] }) => to - from <= 0);

const hidesStroke = (ctx: Ctx, node: SceneNode): boolean => {
  const known = ctx.hides.get(node.key);

  if (known !== undefined) return known;

  const found =
    node.kind === "shape"
      ? trimHides(node)
      : node.kind === "group"
        ? node.children.some((child) => hidesStroke(ctx, child))
        : false;

  ctx.hides.set(node.key, found);

  return found;
};

interface DrawnText {
  readonly drawn: Drawn;
  readonly children: SvgNode[];
}

const lookOf = (run: TextRun): string =>
  JSON.stringify([run.face, run.fill, run.opacity ?? 1, run.letterSpacing ?? 0]);

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

const textElement = (ctx: Ctx, node: TextNode, at: Vec, lanes: CssLane[]): DrawnText => {
  const { fonts } = ctx.scene;
  const runs = node.lines.flatMap((line) => line.runs);
  const base = commonest(runs);

  if (node.trim !== undefined) {
    const contours = runs.flatMap((run) => run.outline ?? []);
    const clear: Rgba = [0, 0, 0, 0];

    const fill = base && !same(base.fill, clear) ? base.fill : undefined;

    const outlined: ShapeNode = {
      kind: "shape",
      key: node.key,
      box: node.box,
      at: [0, 0],
      origin: node.origin,
      layers: [],
      effects: [],
      geometry: { kind: "path", contours, rule: "nonzero" },
      ...(fill !== undefined && { fill }),
      ...(node.fillOpacity !== undefined && { fillOpacity: node.fillOpacity }),
      ...(node.stroke && { stroke: node.stroke }),
      trim: node.trim,
    };

    const drawn = shapeElement(ctx, outlined, at, lanes);

    const words = node.lines
      .map((each) => each.runs.map((run) => run.text).join(""))
      .join(" ")
      .trim();

    if (words) drawn.attrs["aria-label"] = words;

    return { drawn, children: [] };
  }

  const [line, ...more] = node.lines;
  const single = more.length === 0 && (line?.runs.length ?? 0) <= 1;

  const where = ([px, py]: Vec, x: boolean, y: boolean) => ({
    ...(x && { x: num(at[0] + px) }),
    ...(y && { y: num(at[1] + py) }),
  });

  const facing = (face: Face, around: Partial<Face>) => {
    const { faces } = fonts[face.family]!;

    const weight =
      around.weight === undefined
        ? face.weight !== 400 || faces.some((each) => each.weight !== face.weight)
        : face.weight !== around.weight;

    const style =
      around.italic === undefined
        ? face.italic || faces.some((each) => each.italic !== face.italic)
        : face.italic !== around.italic;

    return {
      ...(face.family !== around.family && { "font-family": fonts[face.family]! }),
      ...(weight && { "font-weight": num(face.weight) }),
      ...(style && { "font-style": cssFontStyle(face) }),
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

  const { along } = node;

  /** Along a path the runs sit in a <textPath>, which starts `start` of the way along it. */
  const onPath = (inside: SvgNode[]): SvgNode[] => {
    if (!along) return inside;
    const length = lengthOf(along.path);
    const { start } = along;

    const attrs = {
      href: `#${pathId(ctx.defs, along.path, at, node.key)}`,
      startOffset: num(atRest(start) * length),
    };

    if (!isLane(start)) return [element("textPath", attrs, inside)];

    const lane = cssLane(
      ctx,
      "startOffset",
      smilSafeWith(start, mixNumber, `the start of "${node.key}"`),
      (value) => ({ startOffset: value * length }),
      { route: "smil" },
    );

    return [{ ...element("textPath", attrs, inside), lanes: [lane] }];
  };

  const firstLine = line?.at ?? [0, 0];
  const start = line?.runs[0]?.at ?? firstLine;

  const drawn: Drawn = {
    tag: "text",
    placed: true,
    attrs: {
      ...(single && !along && where(start, start[0] + at[0] !== 0, start[1] + at[1] !== 0)),
      ...(base && facing(base.face, ctx.around)),
      "font-size": num(node.size),
      ...(base?.letterSpacing && { "letter-spacing": num(base.letterSpacing) }),
      ...(along &&
        along.align !== "start" && { "text-anchor": along.align === "center" ? "middle" : "end" }),
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
    else applyFillOpacity(ctx, node.fillOpacity, drawn.attrs, lanes);
  } else drawn.attrs.fill = "none";

  if (node.stroke) strokeAttrs(ctx, node.stroke, drawn.attrs, lanes, at, node.key);

  if (single)
    return {
      drawn,
      children: onPath(line?.runs[0] ? [{ kind: "text", value: line.runs[0].text }] : []),
    };

  if (
    !along &&
    node.lines.every((each) => each.runs.length === 1) &&
    runs.every((run) => base && [...run.text].length === 1 && lookOf(run) === lookOf(base))
  ) {
    drawn.attrs.x = runs.map((run) => num(at[0] + run.at[0])).join(" ");
    drawn.attrs.y = runs.map((run) => num(at[1] + run.at[1])).join(" ");

    return { drawn, children: [{ kind: "text", value: runs.map((run) => run.text).join("") }] };
  }

  let first = true;

  const children = node.lines.flatMap((each) =>
    each.runs.map((run, index): SvgNode => {
      const own: CssLane[] = [];

      const placed = along
        ? {}
        : where(
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

      if ((run.letterSpacing ?? 0) !== (base!.letterSpacing ?? 0))
        tspan.attrs["letter-spacing"] = num(run.letterSpacing ?? 0);

      return {
        ...element("tspan", tspan.attrs, [{ kind: "text", value: run.text }]),
        ...(own.length > 0 && { lanes: own }),
      };
    }),
  );

  return { drawn, children: onPath(children) };
};

interface Holder {
  readonly own: Shell;
  readonly shift: Vec;
}

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

  if (node.clip !== undefined || node.mask) {
    const { own, shift } = holder();

    if (node.clip !== undefined)
      own.attrs["clip-path"] = clipUrl(ctx.defs, node.clip, shift, node.key);

    if (node.mask) {
      const reach = reachOf(node.mask, `the mask of "${node.key}"`);
      const region = reach ? moved(growBox(reach, 1), shift) : { x: 0, y: 0, width: 0, height: 0 };

      own.attrs.mask = maskUrl(ctx.defs, node.mask, region, shift);
    }
  }

  const effects = working(node.effects);

  if (effects.length === 0) return;
  const reach = reachOf({ ...node, effects }, `the effects of "${node.key}"`);

  if (!reach) return;
  const { own, shift } = holder();

  own.attrs.filter = filterUrl(ctx.defs, effects, moved(growBox(reach, 1), shift), node.key);
};

const ISOLATE = "isolation:isolate";

/** What lets page code find a <Slot>: its name, and its box in the units of the group that holds its fallback. */
const slotAttrs = (slot: string, { x, y, width, height }: Box) => ({
  "data-slot": slot,
  "data-slot-box": [x, y, width, height].map(num).join(" "),
});

/**
 * What a page's shader runner needs: the uniform layout as an attribute of the slot's group, and the WGSL in a script
 * that browsers do not run, the first child of the group.
 */
const shaderAttrs = ({ size, fields }: ShaderMark) => ({
  "data-shader-inputs": JSON.stringify({ size, fields }),
});

const shaderScript = ({ wgsl }: ShaderMark): Element =>
  element("script", { type: "text/wgsl" }, [text(wgsl)]);

/**
 * A node blends with what is drawn beneath it in its nearest isolated group, so a group
 * whose children blend is isolated: they blend with their earlier siblings and never
 * with whatever the group itself sits on. The root counts as a group.
 */
const isolates = (children: readonly SceneNode[]): boolean =>
  children.some((child) => child.blend !== undefined);

const lifted = (ctx: Ctx, node: SceneNode): SceneNode => {
  if (ctx.sources || node.kind !== "group" || node.children.length !== 1) return node;

  if (ctx.ids && node.id !== undefined) return node;
  const [child] = node.children;

  if (
    child!.clock !== undefined ||
    node.slot !== undefined ||
    node.clip !== undefined ||
    node.mask !== undefined ||
    node.blend !== undefined ||
    node.scheme !== undefined ||
    node.effects.length > 0 ||
    isolates(node.children) ||
    isLane(child!.at) ||
    (node.layers.length > 0 && child!.layers.length > 0)
  )
    return node;
  const [x, y] = child!.at;

  return lifted(ctx, {
    ...child!,
    ...(node.clock && { clock: node.clock }),
    at: homed(node.at, [-x, -y]),
    ...(node.layers.length > 0 && {
      layers: node.layers,
      origin: [node.origin[0] - x, node.origin[1] - y],
    }),
  });
};

const OPAQUE: Rgba = [1, 1, 1, 1];

const dashedTrim = (node: SceneNode): GroupNode | undefined => {
  if (node.kind !== "shape" || !node.stroke?.dash || node.trim === undefined) return undefined;

  if (!isLane(node.trim) && !isLane(node.geometry)) return undefined;
  const { kind: _, geometry, fill, fillOpacity, stroke, trim, clip, mask, ...base } = node;

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
        : [
            {
              kind: "shape",
              ...still,
              key: `${node.key}#fill`,
              geometry,
              fill,
              ...(fillOpacity !== undefined && { fillOpacity }),
            } as const,
          ]),
      { kind: "shape", ...still, key: `${node.key}#stroke`, geometry, stroke, mask: outline },
    ],
  };
};

const emitNode = (ctx: Ctx, given: SceneNode): SvgNode => {
  const [outer, outerClock] = [ctx.current, ctx.clock];

  ctx.current = given;
  ctx.clock = given.clock ?? outerClock;

  try {
    return emitOne(ctx, given);
  } finally {
    ctx.current = outer;
    ctx.clock = outerClock;
  }
};

const emitOne = (ctx: Ctx, given: SceneNode): SvgNode => {
  const node = lifted(ctx, given);
  const split = dashedTrim(node);

  if (split) return emitNode(ctx, split);

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

    case "picture": {
      const [width, height] = node.size;

      const place = {
        ...(at[0] !== 0 && { x: num(at[0]) }),
        ...(at[1] !== 0 && { y: num(at[1]) }),
      };

      if (node.view) {
        const inner = element(
          "image",
          {
            width: num(node.natural[0]),
            height: num(node.natural[1]),
            preserveAspectRatio: "none",
            href: node.href,
          },
          [],
        );

        children = [
          element(
            "svg",
            {
              width: num(width),
              height: num(height),
              viewBox: node.view.map(num).join(" "),
              preserveAspectRatio: "none",
            },
            [inner],
          ),
        ];

        drawn = { tag: "g", attrs: moved(at), placed: false };
      } else {
        drawn = {
          tag: "image",
          attrs: {
            ...place,
            width: num(width),
            height: num(height),
            preserveAspectRatio: "none",
            href: node.href,
          },
          placed: true,
        };
      }

      break;
    }

    case "text":
      ({ drawn, children } = textElement(ctx, node, at, lanes));
      break;
  }

  const shells = [shell()];
  const cuts = !hidesStroke(ctx, node);
  const [ox, oy] = [at[0] + node.origin[0], at[1] + node.origin[1]];

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

  if (node.kind === "group" && isolates(node.children)) shells[0]!.style.push(ISOLATE);

  if (node.blend !== undefined) shells.at(-1)!.style.push(`mix-blend-mode:${node.blend}`);

  const { box } = node;

  const centered =
    Math.abs(node.origin[0] - (box.x + box.width / 2)) < 1e-9 &&
    Math.abs(node.origin[1] - (box.y + box.height / 2)) < 1e-9;

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
        ? [`transform-origin:${length(own.origin?.[0] ?? ox)} ${length(own.origin?.[1] ?? oy)}`]
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

  const still = lanes.length === 0 && drawn.tag !== "g" && !drawn.scale && !drawn.offset;

  const first: Element = {
    ...element(
      drawn.tag,
      {
        ...drawn.attrs,
        ...dress(inner!),
        ...(node.slot !== undefined && slotAttrs(node.slot, node.box)),
        ...(node.shader && shaderAttrs(node.shader)),
      },
      node.shader ? [shaderScript(node.shader), ...children] : children,
    ),
    ...(innerLanes.length > 0 && { lanes: innerLanes }),
    ...(still && { drawn: Object.keys(drawn.attrs) }),
  };

  const wrapped = outer.reduce<Element>(
    (content, own) => ({
      ...element("g", dress(own), [content]),
      ...(own.lanes.length > 0 && { lanes: own.lanes }),
    }),
    first,
  );

  const shown = node.scheme === undefined ? wrapped : schemed(ctx, node.scheme, wrapped);

  const out = node.clock
    ? { ...shown, attrs: { ...shown.attrs, ...clockAttrs(node.clock) } }
    : shown;

  if (ctx.sources)
    return {
      ...out,
      attrs: {
        ...out.attrs,
        "data-key": node.key,
        ...(node.source && { "data-source": placeOf(node.source) }),
        ...(ctx.ids && node.id !== undefined && { "data-svz-id": node.id }),
      },
    };

  if (ctx.ids && node.id !== undefined)
    return { ...out, attrs: { ...out.attrs, "data-svz-id": node.id } };

  return node.kind === "group" &&
    out.tag === "g" &&
    out.lanes === undefined &&
    Object.keys(out.attrs).length === 0
    ? { kind: "fragment", children: out.children }
    : out;
};

/** The class a node shown only in `scheme` carries: one rule per scheme hides them all in the other. */
const schemeClass = (prefix: string, scheme: Scheme): string =>
  `${prefix}${scheme === "light" ? "sl" : "sd"}`;

const schemed = (ctx: Ctx, scheme: Scheme, out: Element): Element => {
  ctx.schemes.add(scheme);

  return {
    ...out,
    attrs: {
      ...out.attrs,
      class: [out.attrs.class, schemeClass(ctx.prefix, scheme)].filter(Boolean).join(" "),
    },
  };
};

const schemeCss = (schemes: ReadonlySet<Scheme>, prefix: string): string =>
  (["light", "dark"] as const)
    .flatMap((scheme) =>
      schemes.has(scheme)
        ? [
            `@media (prefers-color-scheme:${scheme === "light" ? "dark" : "light"}){.${schemeClass(prefix, scheme)}{display:none!important}}`,
          ]
        : [],
    )
    .join("\n");

const tokenCss = (
  scene: Scene,
  prefix: string,
  resolve: Readonly<Record<string, string>> = {},
): string => {
  const names = Object.keys(scene.tokens);
  const unknown = Object.keys(resolve).filter((name) => !names.includes(name));

  if (unknown.length > 0)
    throw new Error(
      `svg.emit() was asked to resolve ${unknown.map((name) => `"${name}"`).join(", ")}, which this scene has no token for. Its tokens are ${names.map((name) => `"${name}"`).join(", ") || "none"}.`,
    );

  if (names.length === 0) return "";
  const scope = prefix ? `svg.${prefix}root` : "svg";
  const fixed = Object.entries(resolve).map(([name, value]) => `--${name}:${value}`);
  const base = names.filter((name) => !scene.tokens[name]!.mix && !(name in resolve));

  const mixed = names.flatMap((name) => {
    const { mix } = scene.tokens[name]!;

    return mix
      ? [
          `--${name}:color-mix(in srgb,${colorText(mix.a)} ${num(mix.share * 100)}%,${colorText(mix.b)})`,
        ]
      : [];
  });

  const declared = (scheme: "light" | "dark") =>
    base.map((name) => `--${name}:${colorText(scene.tokens[name]![scheme])}`);

  return `${scope}{${[...fixed, ...declared("dark"), ...mixed].join(";")}}\n@media (prefers-color-scheme:light){${scope}{${declared("light").join(";")}}}`;
};

const aroundOf = (scene: Scene): Partial<Face> => {
  const counts = new Map<string, number>();

  walkScene(scene, (node) => {
    if (node.kind !== "text") return;
    const family = commonest(node.lines.flatMap((line) => line.runs))?.face.family;

    if (family !== undefined) counts.set(family, (counts.get(family) ?? 0) + 1);
  });
  const [best] = [...counts].sort((a, b) => b[1] - a[1]);
  const faces = Object.values(scene.fonts).map((family) => family.faces);

  return {
    ...(best && best[1] >= 2 && { family: best[0] }),
    ...(faces.some((each) => each.some((face) => face.weight !== each[0]!.weight)) && {
      weight: 400,
    }),
    ...(faces.some((each) => each.some((face) => face.italic !== each[0]!.italic)) && {
      italic: false,
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
      ids: options.ids ?? false,
      ...(options.onLane && { onLane: options.onLane }),
      reported: new Set(),
      schemes: new Set(),
      clock: undefined,
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
        clock: () => ctx.clock,
      },
    };

    const body = scene.root.children.map((child) => emitNode(ctx, child));
    const all = ctx.defs.nodes;
    const { stills } = ctx.defs;

    return render(
      {
        width: scene.size[0],
        height: scene.size[1],
        duration: scene.duration,
        title: scene.title,
        ...(scene.desc !== undefined && { desc: scene.desc }),
        css: [
          tokenCss(scene, prefix, options.resolve),
          schemeCss(ctx.schemes, prefix),
          stills.length > 0 && `${REDUCED_MOTION}${stills.join("")}}`,
        ]
          .filter(Boolean)
          .join("\n"),
        loop: scene.loop,
        share: !ctx.sources,
        still: scene.still === undefined ? false : { at: scene.still },
        ...(options.prefix !== undefined && { prefix: options.prefix }),
        ...(options.playbackRate !== undefined && { playbackRate: options.playbackRate }),
        ...(Object.keys(around).length > 0 && {
          font: {
            ...(around.family !== undefined && { family: scene.fonts[around.family]! }),
            ...(around.weight !== undefined && { weight: around.weight }),
            ...(around.italic !== undefined && { italic: around.italic }),
          },
        }),
      },
      [
        ...(all.length > 0 ? [element("defs", {}, all)] : []),
        ...(isolates(scene.root.children) ? [element("g", { style: ISOLATE }, body)] : body),
      ],
    );
  },
};
