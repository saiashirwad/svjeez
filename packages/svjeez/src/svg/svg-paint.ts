import type { Color as CssColor } from "../model/color";
import type { ChannelValues } from "./channels";
import type { Canvas, Lane as CssLane } from "./compile";
import { num } from "../model/format";
import { animate, windowEnd } from "./smil";
import { element, type Element, type SvgNode } from "./tree";
import { contoursOf, outlineBoxOf, smilSafeWith } from "../model/geometry";
import type {
  Animated,
  Box,
  ClockMark,
  Color,
  Effect,
  Geometry,
  Gradient,
  Lane,
  Pattern,
  Scene,
  SceneNode,
  ShapeNode,
  Vec,
} from "../model/ir";
import { atRest, isLane, mapLane } from "../model/lane";
import { blendNumber, valueAt } from "../model/sample";
import { mixNumber, same } from "../model/steps";
import { isArray } from "../model/guards";

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
  /** The clock of the clocked sequence whose node is being drawn, if it is in one. */
  readonly clock: () => ClockMark | undefined;
}

/** The attributes that let page code find what runs on a clock: its name, where it plays in the static file, and its length. */
export const clockAttrs = (mark: ClockMark) => ({
  "data-clock": mark.name,
  "data-clock-at": num(mark.start),
  "data-clock-over": num(mark.over),
});

const byte = (unit: number): string =>
  Math.round(Math.min(1, Math.max(0, unit)) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();

export const colorText = (color: Color): CssColor =>
  isArray(color)
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
  readonly node: Element;
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
  const mark = defs.clock();
  const sign = mark ? `${signature}${JSON.stringify(mark)}` : signature;
  const known = defs.ids.get(sign);

  if (known !== undefined) return { id: known, twin: defs.ids.has(`${sign}#still`) };
  const id = nextId(defs, base);

  const stamped = (own: string, still: boolean): Built => {
    const built = build(own, still);

    return mark
      ? { ...built, node: { ...built.node, attrs: { ...built.node.attrs, ...clockAttrs(mark) } } }
      : built;
  };

  const { node, moves } = stamped(id, false);

  defs.ids.set(sign, id);
  defs.nodes.push(node);

  if (!moves || defs.scene.still === undefined) return { id, twin: false };
  defs.ids.set(`${sign}#still`, `${id}s`);
  defs.nodes.push(stamped(`${id}s`, true).node);

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

  const stops = first.stops.map((_, i) => {
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
    JSON.stringify(["p", pattern.tile.key, shift, pattern.rotate ?? 0]),
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
          ...(pattern.rotate !== undefined &&
            pattern.rotate !== 0 && { patternTransform: `rotate(${num(pattern.rotate)})` }),
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

const rests = (value: Animated<number>, at: number): boolean => !isLane(value) && value === at;

const idle = (effect: Effect): boolean => {
  switch (effect.kind) {
    case "blur":
      return rests(effect.radius, 0);
    case "adjust":
      return (
        rests(effect.saturate, 1) &&
        rests(effect.hue, 0) &&
        rests(effect.brightness, 1) &&
        rests(effect.contrast, 1)
      );
    case "displace":
      return rests(effect.scale, 0);
    case "shadow":
      return (
        (!isLane(effect.opacity) && effect.opacity <= 0) ||
        (!isLane(effect.color) && isArray(effect.color) && effect.color[3] <= 0)
      );
  }
};

export const working = (effects: readonly Effect[]): Effect[] =>
  effects.filter((effect) => !idle(effect));

const box = ({ x, y, width, height }: Box) => ({
  x: num(Math.floor(x)),
  y: num(Math.floor(y)),
  width: num(Math.ceil(x + width) - Math.floor(x)),
  height: num(Math.ceil(y + height) - Math.floor(y)),
});

const length = (value: number): number => Math.max(0, value);

interface Primitive {
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string>>;
  readonly numbers: readonly (readonly [string, Moving])[];
  readonly flood?: Animated<Color>;
  readonly inside?: readonly Primitive[];
}

const moving = (primitive: Primitive): boolean =>
  primitive.numbers.some(([, written]) => written.nodes.length > 0) ||
  (primitive.inside ?? []).some(moving);

const drawPrimitive = (primitive: Primitive, still: boolean, defs: Defs): SvgNode => {
  const { tag, attrs, numbers, flood, inside = [] } = primitive;

  const node = element(
    tag,
    {
      ...attrs,
      ...Object.fromEntries(numbers.map(([name, written]) => [name, pick(written, still)])),
      ...(flood !== undefined && { "flood-color": colorText(atRest(flood)) }),
    },
    [
      ...children(
        numbers.map(([, written]) => written),
        still,
      ),
      ...inside.map((each) => drawPrimitive(each, still, defs)),
    ],
  );

  return flood !== undefined && isLane(flood)
    ? {
        ...node,
        lanes: [
          defs.lane("flood-color", flood, (value) => ({ floodColor: colorText(value) }), "css"),
        ],
      }
    : node;
};

const primitivesOf = (
  defs: Defs,
  effect: Exclude<Effect, { kind: "displace" }>,
  where: string,
): Primitive[] => {
  const amount = (name: string, value: Animated<number>) =>
    [name, smil(defs, name, value, where, length)] as const;

  switch (effect.kind) {
    case "blur":
      return [
        {
          tag: "feGaussianBlur",
          attrs: {},
          numbers: [amount("stdDeviation", effect.radius)],
        },
      ];
    case "adjust": {
      const out: Primitive[] = [];

      if (!rests(effect.saturate, 1))
        out.push({
          tag: "feColorMatrix",
          attrs: { type: "saturate" },
          numbers: [amount("values", effect.saturate)],
        });

      if (!rests(effect.hue, 0))
        out.push({
          tag: "feColorMatrix",
          attrs: { type: "hueRotate" },
          numbers: [["values", smil(defs, "values", effect.hue, where)]],
        });

      const transfer = (numbers: () => Primitive["numbers"]): Primitive => ({
        tag: "feComponentTransfer",
        attrs: {},
        numbers: [],
        inside: ["feFuncR", "feFuncG", "feFuncB"].map((tag) => ({
          tag,
          attrs: { type: "linear" },
          numbers: numbers(),
        })),
      });

      if (!rests(effect.brightness, 1))
        out.push(transfer(() => [amount("slope", effect.brightness)]));

      if (!rests(effect.contrast, 1)) {
        const intercept = settled(
          isLane(effect.contrast)
            ? mapLane(effect.contrast, (value) => 0.5 - 0.5 * value)
            : 0.5 - 0.5 * effect.contrast,
        );

        out.push(
          transfer(() => [
            amount("slope", effect.contrast),
            ["intercept", smil(defs, "intercept", intercept, where)],
          ]),
        );
      }

      return out;
    }

    case "shadow": {
      const offset = (axis: 0 | 1) =>
        settled(
          isLane(effect.offset)
            ? mapLane(effect.offset, (value) => value[axis])
            : effect.offset[axis],
        );

      const opacity = smil(defs, "flood-opacity", effect.opacity, where, (value) =>
        Math.min(1, Math.max(0, value)),
      );

      return [
        {
          tag: "feDropShadow",
          attrs: {},
          numbers: [
            ["dx", smil(defs, "dx", offset(0), where)],
            ["dy", smil(defs, "dy", offset(1), where)],
            amount("stdDeviation", effect.blur),
            ...(opacity.nodes.length === 0 && opacity.value === "1"
              ? []
              : [["flood-opacity", opacity] as const]),
          ],
          flood: effect.color,
        },
      ];
    }
  }
};

export const filterUrl = (
  defs: Defs,
  effects: readonly Effect[],
  region: Box,
  key: string,
): string => {
  const where = `the effects on "${key}"`;
  const primitives: Primitive[] = [];

  for (const effect of effects) {
    if (effect.kind !== "displace") {
      primitives.push(...primitivesOf(defs, effect, where));
      continue;
    }

    const before = primitives.pop();
    const input = before === undefined ? "SourceGraphic" : `e${primitives.length}`;
    const noise = `n${primitives.length}`;

    if (before !== undefined)
      primitives.push({ ...before, attrs: { ...before.attrs, result: input } });
    primitives.push(
      {
        tag: "feTurbulence",
        attrs: {
          type: "fractalNoise",
          numOctaves: String(effect.octaves),
          seed: String(effect.seed),
          result: noise,
        },
        numbers: [["baseFrequency", smil(defs, "baseFrequency", effect.frequency, where, length)]],
      },
      {
        tag: "feDisplacementMap",
        attrs: { in: input, in2: noise, xChannelSelector: "R", yChannelSelector: "G" },
        numbers: [["scale", smil(defs, "scale", effect.scale, where, length)]],
      },
    );
  }

  const { id, twin } = twinned(defs, JSON.stringify(["f", effects, region]), "f", (own, still) => ({
    moves: primitives.some(moving),
    node: element(
      "filter",
      {
        id: own,
        filterUnits: "userSpaceOnUse",
        ...box(region),
        "color-interpolation-filters": "sRGB",
      },
      primitives.map((primitive) => drawPrimitive(primitive, still, defs)),
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

/** The id of a <path> in defs that text runs along, written `shift` away from the origin. */
export const pathId = (defs: Defs, path: Geometry, shift: Vec, key: string): string =>
  twinned(defs, JSON.stringify(["p", path, shift]), "p", (own) => {
    const [dx, dy] = shift;
    const toward = ([x, y]: Vec): Vec => [x + dx, y + dy];

    // A <textPath> reads its path in the text's own space and ignores a transform on the path, so the shift is written
    // into the points.
    const geometry: Geometry = {
      kind: "path",
      contours: contoursOf(path).map((contour) => ({
        ...contour,
        start: toward(contour.start),
        curves: contour.curves.map(([a, b, c]) => [toward(a), toward(b), toward(c)] as const),
      })),
      rule: "nonzero",
    };

    const drawn = defs.draw({
      kind: "shape",
      key: `${key}#path`,
      box: outlineBoxOf(geometry),
      at: [0, 0],
      origin: [0, 0],
      layers: [],
      effects: [],
      geometry,
    });

    if (drawn.kind !== "element" || drawn.tag !== "path")
      throw new Error(
        `The path of "${key}" did not draw as a single <path>, which lowering never writes. This is a bug in svjeez; please report it with the scene.`,
      );

    return { moves: false, node: element("path", { d: drawn.attrs.d!, id: own }) };
  }).id;
