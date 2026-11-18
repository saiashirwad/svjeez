import type { Color as CssColor } from "../color";
import type { TargetValues } from "../channels";
import type { Canvas, Lane as CssLane } from "../compile";
import { num } from "../format";
import { animate } from "../smil";
import { element, type SvgNode } from "../svg";
import { smilSafeWith } from "./geometry";
import type {
  Animated,
  Box,
  Color,
  Effect,
  Geometry,
  Gradient,
  Lane,
  Rgba,
  Scene,
  SceneNode,
  ShapeNode,
  Vec,
} from "./ir";
import { atRest, isLane, mapLane } from "./lane";
import { blendNumber, valueAt } from "./sample";
import { mixNumber, same } from "./steps";
import { boxOf } from "./values";

/**
 * What the SVG backend writes into `<defs>`: gradients, clip paths, masks and filters. Ids are its own, and two uses
 * of the same thing share one. A def that SMIL moves gets a still twin, which a viewer who asked for reduced motion sees
 * instead, since CSS can pause CSS animations but not SMIL.
 */
export interface Defs {
  readonly scene: Scene;
  readonly canvas: Canvas;
  /** What goes into `<defs>`, in the order it was first asked for. */
  readonly nodes: SvgNode[];
  /** Rules for reduced motion, each swapping a def SMIL moves for its still twin. */
  readonly stills: string[];
  readonly ids: Map<string, string>;
  readonly counts: Map<string, number>;
  /** The emitter's own lane, so a stop's color moves as every other CSS lane does and SMIL reads the same keys. */
  readonly lane: <T>(
    slot: string,
    lane: Lane<T>,
    values: (value: T) => TargetValues,
    route: "css" | "smil",
  ) => CssLane;
  /** The emitter's own node, for a clip's outline and a mask's content. */
  readonly draw: (node: SceneNode) => SvgNode;
}

const isRgba = (color: Color): color is Rgba => Array.isArray(color);

const byte = (unit: number): string =>
  Math.round(Math.min(1, Math.max(0, unit)) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();

// SAFETY: a "#" and hex digits, or var() of a token name, is a color as the attribute types spell one.
export const colorText = (color: Color): CssColor =>
  (isRgba(color)
    ? `#${byte(color[0])}${byte(color[1])}${byte(color[2])}${color[3] < 1 ? byte(color[3]) : ""}`
    : `var(--${color.name})`) as CssColor;

const nextId = (defs: Defs, base: string): string => {
  const count = (defs.counts.get(base) ?? 0) + 1;

  defs.counts.set(base, count);

  return `${defs.canvas.prefix}${base}${count}`;
};

/** A value as a def writes it: the attribute, what it is at the still frame, and the SMIL that moves it. */
interface Moving {
  readonly value: string;
  readonly still: string;
  readonly nodes: readonly SvgNode[];
}

/** Where a windowed animation ends: the attribute holds it outside the window, as the old emitter's `windowEnd`. */
const windowEnd = (nodes: readonly SvgNode[]): string | undefined => {
  const [first] = nodes;

  return first?.kind === "element" && first.attrs["data-loop"] !== undefined
    ? String(first.attrs.values).split(";").at(-1)
    : undefined;
};

/** A lane that holds one value is that value. */
const settled = <T>(value: Animated<T>): Animated<T> =>
  isLane(value) && value.keys.every((key) => same(key.value, value.keys[0].value))
    ? value.keys[0].value
    : value;

/**
 * A number on a def's attribute, through SMIL when it moves: CSS can't animate a gradient's points, a stop's offset
 * or a filter's numbers. `clamp` keeps it where the attribute means something.
 */
const smil = (
  defs: Defs,
  attribute: string,
  given: Animated<number>,
  where: string,
  clamp: (value: number) => number = (value) => value,
): Moving => {
  const value = settled(given);
  const still = num(clamp(valueAt(value, defs.scene.still ?? 0, blendNumber)));

  if (!isLane(value)) return { value: still, still, nodes: [] };

  const lane = defs.lane(
    attribute,
    smilSafeWith(value, mixNumber, where),
    (each) => ({ width: clamp(each) }),
    "smil",
  );

  const nodes = animate(defs.canvas, attribute, lane, () => nextId(defs, "s"));

  return { value: windowEnd(nodes) ?? still, still, nodes };
};

/** A def as `twinned` builds it: its node, and whether SMIL moves it. */
interface Built {
  readonly node: SvgNode;
  readonly moves: boolean;
}

/** A def's id, and whether it has a still twin for reduced motion. */
interface Written {
  readonly id: string;
  readonly twin: boolean;
}

/** One def, written once for the picture that moves and, when SMIL moves it, once more still. */
const twinned = (
  defs: Defs,
  signature: string,
  base: string,
  build: (id: string, still: boolean) => Built,
): Written => {
  const known = defs.ids.get(signature);

  if (known !== undefined) return { id: known, twin: defs.ids.has(`${signature}#still`) };
  const id = nextId(defs, base);
  const { node, moves } = build(id, false);

  defs.ids.set(signature, id);
  defs.nodes.push(node);

  if (!moves || defs.scene.still === undefined) return { id, twin: false };
  defs.ids.set(`${signature}#still`, `${id}s`);
  defs.nodes.push(build(`${id}s`, true).node);

  return { id, twin: true };
};

/** What an attribute reads as, for the picture that moves or the still twin, and the SMIL children that go with it. */
const pick = (written: Moving, still: boolean): string => (still ? written.still : written.value);

const children = (list: readonly Moving[], still: boolean): SvgNode[] =>
  still ? [] : list.flatMap((written) => [...written.nodes]);

/** A reduced-motion rule that swaps `id` for its still twin wherever `property` names it. */
const swap = (defs: Defs, property: string, id: string): void => {
  const rule = `[${property}="url(#${id})"]{${property}:url(#${id}s)}`;

  if (!defs.stills.includes(rule)) defs.stills.push(rule);
};

const part = <T>(paint: Gradient | Lane<Gradient>, read: (gradient: Gradient) => T): Animated<T> =>
  settled(isLane(paint) ? mapLane(paint, read) : read(paint));

/**
 * A gradient as a paint server, its points in the user space of the element it paints, which is the node's frame moved
 * by `shift`. Its points and offsets move through SMIL, and its colors through CSS on each stop, so a token stays a
 * live variable.
 */
export const gradientUrl = (
  defs: Defs,
  paint: Gradient | Lane<Gradient>,
  shift: Vec,
  property: "fill" | "stroke",
  key: string,
): string => {
  const where = `the gradient on "${key}"`;
  const first = isLane(paint) ? paint.keys[0].value : paint;
  const along = (read: (gradient: Gradient) => number) => part(paint, read);

  const at = (name: string, read: (gradient: Gradient) => number, axis: 0 | 1 | undefined) =>
    [
      name,
      smil(
        defs,
        name,
        along((gradient) => read(gradient) + (axis === undefined ? 0 : shift[axis])),
        where,
      ),
    ] as const;

  const points =
    first.kind === "linear"
      ? [
          at("x1", (g) => (g.kind === "linear" ? g.from[0] : 0), 0),
          at("y1", (g) => (g.kind === "linear" ? g.from[1] : 0), 1),
          at("x2", (g) => (g.kind === "linear" ? g.to[0] : 0), 0),
          at("y2", (g) => (g.kind === "linear" ? g.to[1] : 0), 1),
        ]
      : [
          at("cx", (g) => (g.kind === "radial" ? g.center[0] : 0), 0),
          at("cy", (g) => (g.kind === "radial" ? g.center[1] : 0), 1),
          at("r", (g) => (g.kind === "radial" ? g.radius : 0), undefined),
        ];

  // A linear gradient's x1, y1 and y2 default to 0; x2 and every radial number default to percents, so they stay.
  const optional = new Set(["x1", "y1", "y2"]);

  const stops = first.stops.map((stop, i) => {
    const offset = smil(
      defs,
      "offset",
      along((g) => g.stops[i]!.offset),
      where,
      (value) => Math.min(1, Math.max(0, value)),
    );

    const color = part(paint, (g) => g.stops[i]!.color);

    return { offset, color };
  });

  const moves = [...points.map(([, written]) => written), ...stops.map((stop) => stop.offset)].some(
    (written) => written.nodes.length > 0,
  );

  const { id, twin } = twinned(defs, JSON.stringify(["g", paint, shift]), "g", (own, still) => ({
    moves,
    node: element(
      first.kind === "linear" ? "linearGradient" : "radialGradient",
      {
        id: own,
        gradientUnits: "userSpaceOnUse",
        ...Object.fromEntries(
          points.flatMap(([name, written]): [string, string][] =>
            optional.has(name) && written.nodes.length === 0 && written.value === "0"
              ? []
              : [[name, pick(written, still)]],
          ),
        ),
      },
      [
        ...children(
          points.map(([, written]) => written),
          still,
        ),
        ...stops.map(({ offset, color }) => {
          const stop = element(
            "stop",
            {
              ...(pick(offset, still) !== "0" && { offset: pick(offset, still) }),
              "stop-color": colorText(atRest(color)),
            },
            children([offset], still),
          );

          return isLane(color)
            ? {
                ...stop,
                lanes: [
                  defs.lane(
                    "stop-color",
                    color,
                    (value) => ({ stopColor: colorText(value) }),
                    "css",
                  ),
                ],
              }
            : stop;
        }),
      ],
    ),
  }));

  if (twin) swap(defs, property, id);

  return `url(#${id})`;
};

/** Whether an effect changes nothing it is given, so no filter needs to run for it. */
const idle = (effect: Effect): boolean =>
  effect.kind === "blur"
    ? !isLane(effect.radius) && effect.radius <= 0
    : (!isLane(effect.opacity) && effect.opacity <= 0) ||
      (isRgba(effect.color) && effect.color[3] <= 0);

/** The effects that change something, in order. */
export const working = (effects: readonly Effect[]): Effect[] =>
  effects.filter((effect) => !idle(effect));

const box = ({ x, y, width, height }: Box) => ({
  x: num(Math.floor(x)),
  y: num(Math.floor(y)),
  width: num(Math.ceil(x + width) - Math.floor(x)),
  height: num(Math.ceil(y + height) - Math.floor(y)),
});

const length = (value: number): number => Math.max(0, value);

/**
 * A filter that runs `effects` in order over `region`, in the user space of the element it is on. Its numbers move
 * through SMIL, the only way every engine animates a filter primitive. Colors blend in sRGB, as the model says.
 */
export const filterUrl = (
  defs: Defs,
  effects: readonly Effect[],
  region: Box,
  key: string,
): string => {
  const where = `the effects on "${key}"`;

  const primitives = effects.map((effect) => {
    if (effect.kind === "blur")
      return {
        tag: "feGaussianBlur",
        numbers: [
          ["stdDeviation", smil(defs, "stdDeviation", effect.radius, where, length)] as const,
        ],
        flood: undefined,
      };

    const offset = (axis: 0 | 1) =>
      settled(
        isLane(effect.offset)
          ? mapLane(effect.offset, (value) => value[axis])
          : effect.offset[axis],
      );

    const opacity = smil(defs, "flood-opacity", effect.opacity, where, (value) =>
      Math.min(1, Math.max(0, value)),
    );

    return {
      tag: "feDropShadow",
      numbers: [
        ["dx", smil(defs, "dx", offset(0), where)] as const,
        ["dy", smil(defs, "dy", offset(1), where)] as const,
        ["stdDeviation", smil(defs, "stdDeviation", effect.blur, where, length)] as const,
        ...(opacity.nodes.length === 0 && opacity.value === "1"
          ? []
          : [["flood-opacity", opacity] as const]),
      ],
      flood: colorText(effect.color),
    };
  });

  const moves = primitives.some(({ numbers }) =>
    numbers.some(([, written]) => written.nodes.length > 0),
  );

  const { id, twin } = twinned(defs, JSON.stringify(["f", effects, region]), "f", (own, still) => ({
    moves,
    node: element(
      "filter",
      {
        id: own,
        filterUnits: "userSpaceOnUse",
        ...box(region),
        "color-interpolation-filters": "sRGB",
      },
      primitives.map(({ tag, numbers, flood }) =>
        element(
          tag,
          {
            ...Object.fromEntries(numbers.map(([name, written]) => [name, pick(written, still)])),
            ...(flood !== undefined && { "flood-color": flood }),
          },
          children(
            numbers.map(([, written]) => written),
            still,
          ),
        ),
      ),
    ),
  }));

  if (twin) swap(defs, "filter", id);

  return `url(#${id})`;
};

/**
 * An alpha mask drawing `mask` in the user space of the element it is on, the node's frame moved by `shift`. What
 * lies outside `region` is hidden, which changes nothing, since the mask's content never reaches there.
 */
export const maskUrl = (defs: Defs, mask: SceneNode, region: Box, shift: Vec): string => {
  const { id } = twinned(defs, JSON.stringify(["m", mask.key, shift]), "m", (own) => ({
    moves: false,
    node: element(
      "mask",
      { id: own, maskUnits: "userSpaceOnUse", ...box(region), "mask-type": "alpha" },
      [defs.draw({ ...mask, at: shift })],
    ),
  }));

  return `url(#${id})`;
};

/**
 * A clip path holding `clip` in the user space of the element it is on, the node's frame moved by `shift`. It is
 * drawn as a shape is, so a clip that moves takes the same routes a geometry does.
 */
export const clipUrl = (defs: Defs, clip: Animated<Geometry>, shift: Vec, key: string): string => {
  const { id } = twinned(defs, JSON.stringify(["c", clip, shift]), "c", (own) => {
    const outline: ShapeNode = {
      kind: "shape",
      key: `${key}#clip`,
      box: boxOf(atRest(clip)),
      at: shift,
      origin: [0, 0],
      layers: [],
      effects: [],
      geometry: clip,
    };

    const drawn = defs.draw(outline);

    if (drawn.kind !== "element" || drawn.tag === "g")
      throw new Error(
        `The clip on "${key}" moves in a way its outline can't carry on its own, which lowering never writes. This is a bug in svjeez; please report it with the scene.`,
      );
    // A clip path takes its outline only: no paint, and its own name for the fill rule.
    const { fill: _fill, "fill-rule": rule, ...attrs } = drawn.attrs;

    return {
      moves: false,
      node: element("clipPath", { id: own }, [
        { ...drawn, attrs: { ...attrs, ...(rule !== undefined && { "clip-rule": rule }) } },
      ]),
    };
  });

  return `url(#${id})`;
};
