import { nodeName } from "../model/naming";
import { SceneError } from "../model/scene-error";
import type { ChannelValues } from "./channels";
import type { Emit } from "./css";
import { easeAt, splitEase } from "../model/ease-at";
import { num } from "../model/format";
import { ease, type Ease } from "../model/time";
import type { PathData } from "../model/paths";
import type { AttrValue } from "./tree";
import { arcPieces, contoursOf, mixGeometry, smilSafe } from "../model/geometry";
import type { Contour, Cubic, Geometry, Key, Lane, Paint, ShapeNode, Vec } from "../model/ir";
import { isLane } from "../model/lane";
import { same } from "../model/steps";
import { onCircle } from "../author/values";

export type GeometrySlot =
  | "d"
  | "draw"
  | "width"
  | "height"
  | "rx"
  | "ry"
  | "r"
  | "x1"
  | "y1"
  | "x2"
  | "y2";

export interface Written {
  readonly slot: GeometrySlot;
  readonly lane: Lane<ChannelValues>;
  readonly route: "css" | "smil";
  readonly emit?: Emit;
}

export type Moving =
  | {
      readonly kind: "still";
      readonly geometry: Geometry;
      readonly scale?: Lane<Vec>;
      readonly offset?: Lane<Vec>;
    }
  | {
      readonly kind: "element";
      readonly tag: string;
      readonly attrs: Record<string, AttrValue>;
      readonly placed: boolean;
      readonly lanes: readonly Written[];
    };

const smilNumber = (value: number): ChannelValues => ({ width: value });

const close = (a: number, b: number, size: number): boolean =>
  Math.abs(a - b) <= 1e-9 * Math.max(1, size);

const pointsOf = (contours: readonly Contour[]): Vec[] =>
  contours.flatMap((contour) => [contour.start, ...contour.curves.flat()]);

const extent = (points: readonly Vec[]): number =>
  Math.max(1, ...points.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y))));

const shifts = (keys: readonly Geometry[]): Vec[] | undefined => {
  const all = keys.map((key) => pointsOf(contoursOf(key)));
  const first = all[0]!;
  const size = extent(first);

  const found = all.map((points): Vec | undefined => {
    if (points.length !== first.length || points.length === 0) return undefined;
    const by: Vec = [points[0]![0] - first[0]![0], points[0]![1] - first[0]![1]];

    return points.every(
      (point, i) =>
        close(point[0], first[i]![0] + by[0], size) && close(point[1], first[i]![1] + by[1], size),
    )
      ? by
      : undefined;
  });

  return found.every((by) => by !== undefined) ? found : undefined;
};

const scales = (keys: readonly Geometry[], base: Geometry): Vec[] | undefined => {
  const reference = pointsOf(contoursOf(base));
  const size = extent(reference);

  const [wide, tall] = [0, 1].map((axis) =>
    reference.reduce(
      (best, point, i) => (Math.abs(point[axis]!) > Math.abs(reference[best]![axis]!) ? i : best),
      0,
    ),
  );

  const found = keys.map((key): Vec | undefined => {
    const points = pointsOf(contoursOf(key));

    if (points.length !== reference.length || reference.length === 0) return undefined;

    const ratio = (axis: 0 | 1, at: number): number =>
      reference[at]![axis] === 0 ? 1 : points[at]![axis] / reference[at]![axis];

    const by: Vec = [ratio(0, wide!), ratio(1, tall!)];

    return points.every(
      (point, i) =>
        close(point[0], reference[i]![0] * by[0], size) &&
        close(point[1], reference[i]![1] * by[1], size),
    )
      ? by
      : undefined;
  });

  return found.every((by) => by !== undefined) ? found : undefined;
};

const along = <T>(lane: Lane<Geometry>, values: readonly T[]): Lane<T> => {
  const [head, next, ...rest] = lane.keys.map((key, i) => ({ ...key, value: values[i]! }));

  return { ...lane, keys: [head!, next!, ...rest] };
};

const placedAt = ([x, y]: Vec, names: readonly [string, string]) => ({
  ...(x !== 0 && { [names[0]]: num(x) }),
  ...(y !== 0 && { [names[1]]: num(y) }),
});

interface Moved {
  readonly transform?: string;
}

const moved = ([x, y]: Vec): Moved =>
  x === 0 && y === 0 ? {} : { transform: `translate(${num(x)} ${num(y)})` };

type Numbers = Readonly<Partial<Record<GeometrySlot, number>>>;

const element = (
  tag: string,
  lane: Lane<Geometry>,
  names: readonly GeometrySlot[],
  values: readonly Numbers[],
  place: Readonly<Record<string, AttrValue>>,
): Moving => {
  const series = names.map((name) => ({ name, each: values.map((value) => value[name] ?? 0) }));

  return {
    kind: "element",
    tag,
    attrs: {
      ...place,
      ...Object.fromEntries(series.map(({ name, each }) => [name, num(each[0]!)])),
    },
    placed: true,
    lanes: series.flatMap(({ name, each }): Written[] =>
      each.some((value) => value !== each[0])
        ? [{ slot: name, lane: along(lane, each.map(smilNumber)), route: "smil" }]
        : [],
    ),
  };
};

const dashed = (node: ShapeNode, lane: Lane<Geometry>, at: Vec): Moving | undefined => {
  const arcs = lane.keys.map((key) => key.value);
  const { stroke } = node;

  if (
    !stroke ||
    node.fill !== undefined ||
    node.trim !== undefined ||
    stroke.dash !== undefined ||
    !arcs.every(isArc) ||
    !arcs.every((arc) => arc.radius === arcs[0]!.radius)
  )
    return undefined;

  const spans = arcs.map(({ start, sweep }) => {
    return { low: start + Math.min(0, sweep), length: Math.abs(sweep), sign: Math.sign(sweep) };
  });

  const signs = new Set(spans.map((each) => each.sign).filter((sign) => sign !== 0));
  const low = Math.min(...spans.map((each) => each.low));
  const widest = Math.max(...spans.map((each) => each.low + each.length)) - low;

  if (signs.size > 1 || !(widest > 0)) return undefined;
  const { radius } = arcs[0]!;
  const r = num(radius);
  const pieces = widest <= 340 ? 1 : Math.ceil(widest / 270 - 1e-9);
  const step = widest / pieces;
  let d = `M${pt(onCircle(radius, low))}`;

  for (let i = 1; i <= pieces; i++)
    d += `A${r} ${r} 0 ${step > 180 ? 1 : 0} 1 ${pt(onCircle(radius, low + step * i))}`;

  const dots = stroke.cap !== "butt" && spans.some((each) => each.length === 0);
  const grows = !dots && spans.every((each) => each.low === low);

  const values = spans.map((each): ChannelValues => {
    const [from, to] = [(each.low - low) / widest, (each.low + each.length - low) / widest];

    return grows ? { draw: to } : { draw: to, drawStart: from };
  });

  return {
    kind: "element",
    tag: "path",
    attrs: { d, ...moved(at) },
    placed: false,
    lanes: [{ slot: "draw", lane: along(lane, values), route: "css", emit: "dash" }],
  };
};

const pt = ([x, y]: Vec): string => `${num(x)} ${num(y)}`;

const ARC_TOLERANCE = 0.25;

const portion = (curve: Ease, from: number, to: number, where: string): Ease => {
  const tail = from > 0 ? splitEase(curve, from, where)[1] : curve;

  return to < 1 ? splitEase(tail, (to - from) / (1 - from), where)[0] : tail;
};

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

type Command = "" | "l" | "h" | "v" | "c";

const isStraight = (from: Vec, [c1, c2, to]: Cubic): boolean =>
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

const isPoint = (from: Vec, curve: Cubic): boolean =>
  curve.every(
    (point) => Math.abs(point[0] - from[0]) < 1e-9 && Math.abs(point[1] - from[1]) < 1e-9,
  );

const commandsOf = (keys: readonly (readonly Contour[])[]): Command[][] =>
  keys[0]!.map((contour, c) => {
    const commands = contour.curves.map((_, k): Command => {
      const all = keys.map((contours) => {
        const own = contours[c]!;

        return { from: k === 0 ? own.start : own.curves[k - 1]![2], curve: own.curves[k]! };
      });

      if (all.every(({ from, curve }) => isPoint(from, curve))) return "";

      if (!all.every(({ from, curve }) => isStraight(from, curve))) return "c";

      if (all.every(({ from, curve }) => Math.abs(curve[2][1] - from[1]) < 1e-9)) return "h";

      if (all.every(({ from, curve }) => Math.abs(curve[2][0] - from[0]) < 1e-9)) return "v";

      return "l";
    });

    const last = commands.findLastIndex((command) => command !== "");

    const returns = keys.every((contours) => {
      const own = contours[c]!;
      const end = own.curves[last]?.[2];

      return (
        end !== undefined &&
        Math.abs(end[0] - own.start[0]) < 1e-9 &&
        Math.abs(end[1] - own.start[1]) < 1e-9
      );
    });

    if (contour.closed && last >= 0 && commands[last] !== "c" && returns) commands[last] = "";

    return commands;
  });

const joined = (numbers: readonly string[]): string =>
  numbers.reduce(
    (out, value, i) => (i === 0 || value.startsWith("-") ? out + value : `${out} ${value}`),
    "",
  );

const writeData = (
  contours: readonly Contour[],
  commands: readonly Command[][],
  places: number,
): PathData => {
  const round = (value: number): number => Number(num(value, places));
  let d = "";

  contours.forEach((contour, c) => {
    const own = commands[c]!;
    const at: [number, number] = [round(contour.start[0]), round(contour.start[1])];

    const step = ([x, y]: Vec): string[] => [
      num(round(x) - at[0], places),
      num(round(y) - at[1], places),
    ];

    d += `M${joined([num(at[0], places), num(at[1], places)])}`;

    contour.curves.forEach((curve, k) => {
      const command = own[k]!;

      if (command === "") return;
      const to = curve[2];
      const [dx, dy] = step(to);

      d +=
        command === "c"
          ? `c${joined([...step(curve[0]), ...step(curve[1]), dx!, dy!])}`
          : command === "h"
            ? `h${dx}`
            : command === "v"
              ? `v${dy}`
              : `l${joined([dx!, dy!])}`;
      [at[0], at[1]] = [round(to[0]), round(to[1])];
    });

    if (contour.closed) d += "z";
  });

  // SAFETY: each contour is written from M, so the whole is path data.
  return d as PathData;
};

const placesFor = (outlines: readonly (readonly Contour[])[]): number => {
  const size = Math.max(...outlines.map((contours) => extent(pointsOf(contours))));

  return size < 10 ? 3 : 2;
};

const morph = (node: ShapeNode, lane: Lane<Geometry>, at: Vec): Moving => {
  const written = blendable(lane, node.key);

  const pieces = Math.max(
    ...written.keys.map((key) => (key.value.kind === "arc" ? arcPieces(key.value.sweep) : 1)),
  );

  const outlines = written.keys.map((key) => contoursOf(key.value, pieces));

  if (outlines.some((contours) => contours.length === 0))
    throw new SceneError(
      `${nodeName(node)} animates a geometry with no outline.`,
      "Give every key a point at least.",
      { key: node.key, ...(node.source && { source: node.source }) },
    );
  const commands = commandsOf(outlines);
  const places = placesFor(outlines);
  const data = outlines.map((contours) => writeData(contours, commands, places));
  const first = lane.keys[0].value;

  return {
    kind: "element",
    tag: "path",
    attrs: {
      d: data[0]!,
      ...(first.kind === "path" && first.rule === "evenodd" && { "fill-rule": "evenodd" }),
      ...moved(at),
    },
    placed: false,
    lanes: [
      {
        slot: "d",
        lane: along(
          written,
          data.map((d): ChannelValues => ({ d })),
        ),
        route: "smil",
      },
    ],
  };
};

const isGradient = (paint: Paint): boolean => !Array.isArray(paint) && "stops" in paint;

const framed = (node: ShapeNode): boolean =>
  [node.fill, node.stroke?.color].some(
    (paint) =>
      paint !== undefined &&
      (isLane(paint) ? paint.keys.map((key) => key.value) : [paint]).some(isGradient),
  );

const scalable = (node: ShapeNode): boolean => node.stroke === undefined && !framed(node);

type Arc = Extract<Geometry, { kind: "arc" }>;

type Rect = Extract<Geometry, { kind: "rect" }>;

type Ellipse = Extract<Geometry, { kind: "ellipse" }>;

type Line = Extract<Geometry, { kind: "line" }>;

const isArc = (value: Geometry): value is Arc => value.kind === "arc";

const isRect = (value: Geometry): value is Rect => value.kind === "rect";

const isEllipse = (value: Geometry): value is Ellipse => value.kind === "ellipse";

const isLine = (value: Geometry): value is Line => value.kind === "line";

const ENDS = ["x1", "y1", "x2", "y2"] as const;

const ownAttributes = (lane: Lane<Geometry>, at: Vec): Moving | undefined => {
  const keys = lane.keys.map((key) => key.value);

  if (keys.every(isRect)) {
    if (!keys.every(({ radius }) => radius.every((r) => r === radius[0]))) return undefined;
    const rounded = keys.some(({ radius }) => radius[0] > 0);

    return element(
      "rect",
      lane,
      rounded ? ["width", "height", "rx"] : ["width", "height"],
      keys.map(({ size, radius }) => ({ width: size[0], height: size[1], rx: radius[0] })),
      placedAt(at, ["x", "y"]),
    );
  }

  if (keys.every(isEllipse)) {
    const round = keys.every(({ radius: [rx, ry] }) => rx === ry);

    return element(
      round ? "circle" : "ellipse",
      lane,
      round ? ["r"] : ["rx", "ry"],
      keys.map(({ radius: [rx, ry] }) => ({ r: rx, rx, ry })),
      placedAt(at, ["cx", "cy"]),
    );
  }

  if (keys.every(isLine)) {
    const ends = keys.map(({ from, to }) => ({
      x1: from[0] + at[0],
      y1: from[1] + at[1],
      x2: to[0] + at[0],
      y2: to[1] + at[1],
    }));

    const changing = ENDS.filter((name) => ends.some((value) => value[name] !== ends[0]![name]));

    return changing.length === 1 ? element("line", lane, ENDS, ends, {}) : undefined;
  }

  return undefined;
};

export const drawMoving = (node: ShapeNode, lane: Lane<Geometry>, at: Vec): Moving => {
  const keys = lane.keys.map((key) => key.value);
  const moves = shifts(keys);

  if (moves && !framed(node))
    return moves.every(([x, y]) => x === 0 && y === 0)
      ? { kind: "still", geometry: keys[0]! }
      : { kind: "still", geometry: keys[0]!, offset: along(lane, moves) };

  const smil = smilSafe(lane, `geometry on "${node.key}"`);

  if (keys[0]!.kind === "arc") return dashed(node, lane, at) ?? morph(node, smil, at);

  if (scalable(node)) {
    const base = keys.reduce((best, key) =>
      extent(pointsOf(contoursOf(key))) > extent(pointsOf(contoursOf(best))) ? key : best,
    );

    const by = scales(keys, base);

    if (by) return { kind: "still", geometry: base, scale: along(lane, by) };
  }

  return ownAttributes(smil, at) ?? morph(node, smil, at);
};
