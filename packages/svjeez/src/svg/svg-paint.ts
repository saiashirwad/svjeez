import type { Color as CssColor } from "../model/color";
import type { ChannelValues } from "./channels";
import type { Canvas, Lane as CssLane } from "./compile";
import { num } from "../model/format";
import { animate, windowEnd } from "./smil";
import { element, type SvgNode } from "./tree";
import { outlineBoxOf, smilSafeWith } from "../model/geometry";
import type {
  Animated,
  Box,
  Color,
  Effect,
  Geometry,
  Gradient,
  Lane,
  Pattern,
  Rgba,
  Scene,
  SceneNode,
  ShapeNode,
  Vec,
} from "../model/ir";
import { atRest, isLane, mapLane } from "../model/lane";
import { blendNumber, valueAt } from "../model/sample";
import { mixNumber, same } from "../model/steps";

export interface Defs {
  readonly scene: Scene;
  readonly canvas: Canvas;
  readonly nodes: SvgNode[];
  readonly stills: string[];
  readonly ids: Map<string, string>;
  readonly counts: Map<string, number>;
  readonly lane: <T>(
    slot: string,
    lane: Lane<T>,
    values: (value: T) => ChannelValues,
    route: "css" | "smil",
  ) => CssLane;
  readonly draw: (node: SceneNode) => SvgNode;
}

const isRgba = (color: Color): color is Rgba => Array.isArray(color);

const byte = (unit: number): string =>
  Math.round(Math.min(1, Math.max(0, unit)) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();

export const colorText = (color: Color): CssColor =>
  isRgba(color)
    ? `#${byte(color[0])}${byte(color[1])}${byte(color[2])}${color[3] < 1 ? byte(color[3]) : ""}`
    : `var(--${color.name})`;

const nextId = (defs: Defs, base: string): string => {
  const count = (defs.counts.get(base) ?? 0) + 1;

  defs.counts.set(base, count);

  return `${defs.canvas.prefix}${base}${count}`;
};

interface Moving {
  readonly value: string;
  readonly still: string;
  readonly nodes: readonly SvgNode[];
}

const settled = <T>(value: Animated<T>): Animated<T> =>
  isLane(value) && value.keys.every((key) => same(key.value, value.keys[0].value))
    ? value.keys[0].value
    : value;

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

interface Built {
  readonly node: SvgNode;
  readonly moves: boolean;
}

interface Written {
  readonly id: string;
  readonly twin: boolean;
}

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

const pick = (written: Moving, still: boolean): string => (still ? written.still : written.value);

const children = (list: readonly Moving[], still: boolean): SvgNode[] =>
  still ? [] : list.flatMap((written) => [...written.nodes]);

const swap = (defs: Defs, property: string, id: string): void => {
  const rule = `[${property}="url(#${id})"]{${property}:url(#${id}s)}`;

  if (!defs.stills.includes(rule)) defs.stills.push(rule);
};

const part = <T>(paint: Gradient | Lane<Gradient>, read: (gradient: Gradient) => T): Animated<T> =>
  settled(isLane(paint) ? mapLane(paint, read) : read(paint));

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

export const patternUrl = (
  defs: Defs,
  pattern: Pattern,
  shift: Vec,
  property: "fill" | "stroke",
  key: string,
): string => {
  const where = `the pattern on "${key}"`;

  const at = (name: "x" | "y", axis: 0 | 1) =>
    [
      name,
      smil(
        defs,
        name,
        settled(
          isLane(pattern.offset)
            ? mapLane(pattern.offset, (value) => value[axis] + shift[axis])
            : pattern.offset[axis] + shift[axis],
        ),
        where,
      ),
    ] as const;

  const corner = [at("x", 0), at("y", 1)];

  const { id, twin } = twinned(
    defs,
    JSON.stringify(["p", pattern.tile.key, shift]),
    "p",
    (own, still) => ({
      moves: corner.some(([, written]) => written.nodes.length > 0),
      node: element(
        "pattern",
        {
          id: own,
          patternUnits: "userSpaceOnUse",
          ...Object.fromEntries(corner.map(([name, written]) => [name, pick(written, still)])),
          width: num(pattern.size[0]),
          height: num(pattern.size[1]),
        },
        [
          ...children(
            corner.map(([, written]) => written),
            still,
          ),
          defs.draw(pattern.tile),
        ],
      ),
    }),
  );

  if (twin) swap(defs, property, id);

  return `url(#${id})`;
};

const idle = (effect: Effect): boolean =>
  effect.kind === "blur"
    ? !isLane(effect.radius) && effect.radius <= 0
    : (!isLane(effect.opacity) && effect.opacity <= 0) ||
      (!isLane(effect.color) && isRgba(effect.color) && effect.color[3] <= 0);

export const working = (effects: readonly Effect[]): Effect[] =>
  effects.filter((effect) => !idle(effect));

const box = ({ x, y, width, height }: Box) => ({
  x: num(Math.floor(x)),
  y: num(Math.floor(y)),
  width: num(Math.ceil(x + width) - Math.floor(x)),
  height: num(Math.ceil(y + height) - Math.floor(y)),
});

const length = (value: number): number => Math.max(0, value);

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
      flood: effect.color,
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
      primitives
        .map(({ tag, numbers, flood }) =>
          element(
            tag,
            {
              ...Object.fromEntries(numbers.map(([name, written]) => [name, pick(written, still)])),
              ...(flood !== undefined && { "flood-color": colorText(atRest(flood)) }),
            },
            children(
              numbers.map(([, written]) => written),
              still,
            ),
          ),
        )
        .map((primitive, i) => {
          const flood = primitives[i]!.flood;

          return flood !== undefined && isLane(flood)
            ? {
                ...primitive,
                lanes: [
                  defs.lane(
                    "flood-color",
                    flood,
                    (value) => ({ floodColor: colorText(value) }),
                    "css",
                  ),
                ],
              }
            : primitive;
        }),
    ),
  }));

  if (twin) swap(defs, "filter", id);

  return `url(#${id})`;
};

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

export const clipUrl = (defs: Defs, clip: Animated<Geometry>, shift: Vec, key: string): string => {
  const { id } = twinned(defs, JSON.stringify(["c", clip, shift]), "c", (own) => {
    const outline: ShapeNode = {
      kind: "shape",
      key: `${key}#clip`,
      box: outlineBoxOf(atRest(clip)),
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
