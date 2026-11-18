import type { Color as CssColor } from "../attributes";
import type { TargetValues } from "../channels";
import type { Lane as CssLane } from "../compile";
import { num } from "../format";
import type { Key as Held } from "../keys";
import { EPSILON, ease } from "../motion";
import { render } from "../render";
import { element, type AttrValue, type SvgNode } from "../svg";
import { admit, type Backend, type Feature, type Support } from "./backend";
import type {
  Animated,
  Color,
  Contour,
  Geometry,
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
  image: NONE,
  instance: NONE,
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

type Slot = "translate" | "rotate" | "scale" | "opacity" | "draw" | "fill" | "stroke";

const CHANNELS = {
  translate: ["x", "y"],
  rotate: ["rotate"],
  scale: ["scale"],
  opacity: ["opacity"],
  draw: ["draw"],
  fill: ["fill"],
  stroke: ["stroke"],
} as const;

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

const cssLane = <T>(
  ctx: Ctx,
  slot: Slot,
  lane: Lane<T>,
  values: (value: T) => TargetValues,
): CssLane => {
  const { keys, period } = held(lane, ctx.scene.duration, values);

  return {
    key: slot,
    backend: "css",
    channels: CHANNELS[slot],
    keys,
    period,
    snapped: period,
    nest: false,
    emit: slot === "opacity" && isCut(keys) ? "visibility" : "value",
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

const uniform = ([x, y]: Vec, key: string): number => {
  if (Math.abs(x - y) > 1e-9)
    throw new Error(
      `"${key}" animates a scale that differs across and down, and the SVG backend doesn't write that yet.`,
    );

  return x;
};

const place = (ctx: Ctx, shells: Shell[], layer: Layer, key: string): void => {
  const { scale, rotate, offset, opacity } = layer;

  if (isLane(scale))
    open(shells, "scale").lanes.push(
      cssLane(ctx, "scale", scale, (value) => ({ scale: uniform(value, key) })),
    );
  else if (scale[0] !== 1 || scale[1] !== 1)
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
      cssLane(ctx, "opacity", opacity, (value) => ({ opacity: value })),
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

const stroked = (
  ctx: Ctx,
  node: ShapeNode,
  attrs: Record<string, AttrValue>,
  lanes: CssLane[],
): void => {
  const { stroke, trim } = node;

  painted(ctx, "stroke", stroke?.color, attrs, lanes);

  if (stroke) {
    if (isLane(stroke.width))
      throw new Error(
        `"${node.key}" animates its stroke width, and the SVG backend doesn't write that yet.`,
      );

    if (stroke.width !== 1) attrs["stroke-width"] = num(stroke.width);

    if (stroke.cap !== "butt") attrs["stroke-linecap"] = stroke.cap;

    if (stroke.join !== "miter") attrs["stroke-linejoin"] = stroke.join;

    if (stroke.dash) attrs["stroke-dasharray"] = stroke.dash.map((n) => num(n)).join(" ");

    if (stroke.nonScaling) attrs["vector-effect"] = "non-scaling-stroke";
  }

  if (trim === undefined) return;

  if (stroke?.dash)
    throw new Error(
      `"${node.key}" has both a dash and a trim. SVG draws both with one dash pattern, so pick one.`,
    );

  if (isLane(trim)) {
    if (trim.keys.some((key) => key.value[0] !== 0))
      throw new Error(
        `"${node.key}" animates where its trim starts, and the SVG backend only writes a trim that grows from the start yet.`,
      );
    lanes.push(cssLane(ctx, "draw", trim, (value) => ({ draw: value[1] })));
  } else if (trim[0] !== 0 || trim[1] !== 1) {
    attrs.pathLength = "1";
    attrs["stroke-dasharray"] = `${num(trim[1] - trim[0])} 2`;
    attrs["stroke-dashoffset"] = num(-trim[0]);
  }
};

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
      if (isLane(node.geometry))
        throw new Error(
          `"${node.key}" animates its geometry, and the SVG backend doesn't write that yet.`,
        );
      drawn = outline(node.geometry, at);
      painted(ctx, "fill", node.fill, drawn.attrs, lanes);
      stroked(ctx, node, drawn.attrs, lanes);
      break;
    }

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

    default:
      throw new Error(
        `"${node.key}" is ${node.kind === "image" ? "an image" : "an instance"}, and ${LATER}`,
      );
  }

  const shells = [shell()];

  for (const layer of [...node.layers].reverse()) place(ctx, shells, layer, node.key);

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
    const ctx: Ctx = { scene };

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
      scene.root.children.map((child) => emitNode(ctx, child)),
    );
  },
};
