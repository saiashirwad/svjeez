/** @jsxImportSource svjeez */
import {
  Group,
  Shape,
  Text,
  path,
  polygon,
  type Anim,
  type Geometry,
  type Paint,
  type SceneElement,
  type Vec,
} from "svjeez";
import {
  SceneError,
  type Common,
  type FontValue,
  type PathBuilder,
  type StrokeProps,
} from "svjeez/tools";

export type Range = readonly [min: number, max: number];

export type Matrix2 = readonly [readonly [number, number], readonly [number, number]];

export type PlaneMap = ((point: Vec) => Vec) | Matrix2;

export interface PlaneOptions {
  readonly x: Range;
  readonly y: Range;
  readonly size: Vec;
}

export interface PlotOptions {
  readonly from?: number;
  readonly to?: number;
  readonly samples?: number;
}

export interface AreaOptions {
  readonly from: number;
  readonly to: number;
  readonly base?: number | ((x: number) => number);
  readonly samples?: number;
}

export interface RiemannOptions {
  readonly from: number;
  readonly to: number;
  readonly n: number;
  /** Where in each bar f is sampled: 0 is the left edge, 0.5 the middle, 1 the right. Default 0. */
  readonly at?: number;
}

export interface Bar {
  readonly key: string;
  readonly geometry: Geometry;
  readonly height: number;
}

export interface Riemann {
  readonly bars: readonly Bar[];
  readonly sum: number;
}

export interface LineOptions {
  readonly length?: number;
}

export interface VectorOptions {
  readonly from?: Vec;
  /** The shaft is a filled outline, so only its width can be set. */
  readonly stroke?: { readonly width?: number };
  readonly head?: number;
}

export interface Plane {
  readonly x: Range;
  readonly y: Range;
  readonly size: Vec;
  point(at: Vec): Vec;
  plot(f: (x: number) => number, options?: PlotOptions): Geometry;
  parametric(f: (t: number) => Vec, over: Range, options?: { readonly samples?: number }): Geometry;
  area(f: (x: number) => number, options: AreaOptions): Geometry;
  riemann(f: (x: number) => number, options: RiemannOptions): Riemann;
  slope(f: (x: number) => number, x: number): number;
  tangent(f: (x: number) => number, x: number, options?: LineOptions): Geometry;
  secant(f: (x: number) => number, x: number, h: number, options?: LineOptions): Geometry;
  vector(to: Vec, options?: VectorOptions): Geometry;
  polygon(points: readonly Vec[]): Geometry;
  segment(from: Vec, to: Vec, options?: { readonly samples?: number }): Geometry;
  grid(step?: number | Vec): Geometry;
  axes(): Geometry;
  transform(map: PlaneMap, amount?: number): Plane;
}

const finite = (...values: readonly number[]): boolean => values.every(Number.isFinite);

const isMatrix = (map: PlaneMap): map is Matrix2 => Array.isArray(map);

const isNumber = <T,>(value: number | T): value is number => typeof value === "number";

const pairOf = (step: number | Vec): Vec => (isNumber(step) ? [step, step] : step);

const DENSE = 12;

const ORIGIN: Vec = [0, 0];

const range = (given: Range, what: string): Range => {
  if (!(Array.isArray(given) && given.length === 2 && finite(...given) && given[0] < given[1]))
    throw new SceneError(
      `plane() needs ${what} as [min, max] with min below max, got ${JSON.stringify(given)}.`,
    );

  return given;
};

const handles = (points: readonly Vec[], i: number): readonly [Vec, Vec] => {
  const [a, b] = [points[i]!, points[i + 1]!];
  const before = points[i - 1] ?? [2 * a[0] - b[0], 2 * a[1] - b[1]];
  const after = points[i + 2] ?? [2 * b[0] - a[0], 2 * b[1] - a[1]];

  return [
    [a[0] + (b[0] - before[0]) / 6, a[1] + (b[1] - before[1]) / 6],
    [b[0] - (after[0] - a[0]) / 6, b[1] - (after[1] - a[1]) / 6],
  ];
};

const traced = (built: PathBuilder, points: readonly Vec[], smooth: boolean): PathBuilder =>
  points.slice(1).reduce((open, point, i) => {
    if (!smooth) return open.lineTo(point);
    const [c1, c2] = handles(points, i);

    return open.curveTo(c1, c2, point);
  }, built);

const pathOf = (
  lines: readonly (readonly Vec[])[],
  { closed = false, smooth = false }: { readonly closed?: boolean; readonly smooth?: boolean } = {},
): Geometry =>
  lines
    .filter((line) => line.length > 1)
    .reduce((built, line) => {
      const drawn = traced(built.moveTo(line[0]!), line, smooth);

      return closed ? drawn.close() : drawn;
    }, path());

const round = (n: number): number => Math.round(n * 100) / 100 + 0;

const stepsOf = ([min, max]: Range, step: number): number[] => {
  const out: number[] = [];

  for (let k = Math.ceil(min / step - 1e-9); k * step <= max + 1e-9; k++)
    out.push(round(k * step * 1e4) / 1e4);

  return out;
};

const lerp = (a: Vec, b: Vec, u: number): Vec => [
  a[0] + (b[0] - a[0]) * u,
  a[1] + (b[1] - a[1]) * u,
];

const build = (options: PlaneOptions, map: (p: Vec) => Vec, curved: boolean): Plane => {
  const x = range(options.x, "x");
  const y = range(options.y, "y");
  const [width, height] = options.size;

  if (!(width! > 0 && height! > 0))
    throw new SceneError(
      `plane() needs a size of two lengths above 0, got ${JSON.stringify(options.size)}.`,
    );
  const [sx, sy] = [width / (x[1] - x[0]), height / (y[1] - y[0])];

  const pixel = ([px, py]: Vec): Vec => [(px - x[0]) * sx, (y[1] - py) * sy];

  const point = (at: Vec): Vec => {
    const moved = map(at);

    if (!finite(...moved))
      throw new SceneError(
        `A plane's transform sent [${at.join(", ")}] to [${moved.join(", ")}], which is not a point.`,
      );

    return pixel(moved);
  };

  const along = (from: Vec, to: Vec, samples = curved ? DENSE : 1): Vec[] =>
    Array.from({ length: samples + 1 }, (_, i) => point(lerp(from, to, i / samples)));

  const sampled = (f: (x: number) => number, from: number, to: number, samples: number): Vec[] =>
    Array.from({ length: samples + 1 }, (_, i) => {
      const at = from + ((to - from) * i) / samples;

      return [at, f(at)];
    });

  const checkSpan = (from: number, to: number, what: string) => {
    if (!(finite(from, to) && from < to))
      throw new SceneError(`${what} needs from below to, got from ${from} and to ${to}.`);
  };

  const plot: Plane["plot"] = (f, { from = x[0], to = x[1], samples = 48 } = {}) => {
    checkSpan(from, to, "plot()");
    const runs: Vec[][] = [[]];
    const [low, high] = [y[0] - (y[1] - y[0]) * 0.02, y[1] + (y[1] - y[0]) * 0.02];

    for (const [px, py] of sampled(f, from, to, samples)) {
      if (Number.isFinite(py) && py >= low && py <= high) runs.at(-1)!.push(point([px, py]));
      else if (runs.at(-1)!.length > 0) runs.push([]);
    }

    if (runs.every((run) => run.length < 2))
      throw new SceneError(
        `plot() draws nothing: the function stays outside y ${JSON.stringify(y)} from ${from} to ${to}.`,
      );

    return pathOf(runs, { smooth: true });
  };

  const slope: Plane["slope"] = (f, at) => {
    const h = (x[1] - x[0]) * 1e-5;

    return (f(at + h) - f(at - h)) / (2 * h);
  };

  const lineThrough = (at: Vec, direction: Vec, length: number): Geometry => {
    const [a, b] = [point(at), point([at[0] + direction[0], at[1] + direction[1]])];
    const reach = Math.hypot(b[0] - a[0], b[1] - a[1]);

    if (!(reach > 0))
      throw new SceneError("A plane line needs two different points to pass through.");

    const [ux, uy] = [
      ((b[0] - a[0]) / reach) * (length / 2),
      ((b[1] - a[1]) / reach) * (length / 2),
    ];

    return pathOf([
      [
        [round(a[0] - ux), round(a[1] - uy)],
        [round(a[0] + ux), round(a[1] + uy)],
      ],
    ]);
  };

  return {
    x,
    y,
    size: [width, height],
    point,
    plot,
    parametric: (f, [t0, t1], { samples = 64 } = {}) => {
      checkSpan(t0, t1, "parametric()");

      return pathOf(
        [Array.from({ length: samples + 1 }, (_, i) => point(f(t0 + ((t1 - t0) * i) / samples)))],
        { smooth: true },
      );
    },
    area: (f, { from, to, base = 0, samples = 48 }) => {
      checkSpan(from, to, "area()");
      const under = isNumber(base) ? () => base : base;
      const top = sampled(f, from, to, samples);
      const bottom = sampled(under, from, to, curved || !isNumber(base) ? samples : 1).reverse();

      const [upper, lower] = [top.map(point), bottom.map(point)];

      return traced(
        traced(path().moveTo(upper[0]!), upper, true).lineTo(lower[0]!),
        lower,
        lower.length > 2,
      ).close();
    },
    riemann: (f, { from, to, n, at = 0 }) => {
      checkSpan(from, to, "riemann()");

      if (!(Number.isInteger(n) && n > 0))
        throw new SceneError(`riemann() needs a whole number of bars above 0, got n = ${n}.`);
      const width = (to - from) / n;

      if (!(Number.isFinite(at) && at >= 0 && at <= 1))
        throw new SceneError(`riemann() needs at between 0 and 1, got at = ${at}.`);

      const bars = Array.from({ length: n }, (_, i): Bar => {
        const left = from + i * width;
        const value = f(left + width * at);

        if (!Number.isFinite(value))
          throw new SceneError(
            `riemann() can't draw a bar where the function is ${value}, at x = ${left + width * at}.`,
          );

        return {
          key: String(round(left * 1e4) / 1e4),
          height: value,
          geometry: polygon(
            ...(
              [
                [left, 0],
                [left + width, 0],
                [left + width, value],
                [left, value],
              ] satisfies Vec[]
            ).map(point),
          ),
        };
      });

      return { bars, sum: bars.reduce((total, bar) => total + bar.height * width, 0) };
    },
    slope,
    tangent: (f, at, { length = 160 } = {}) => lineThrough([at, f(at)], [1, slope(f, at)], length),
    secant: (f, at, h, { length = 160 } = {}) => {
      if (Math.abs(h) < 1e-9) return lineThrough([at, f(at)], [1, slope(f, at)], length);

      return lineThrough([at, f(at)], [h, f(at + h) - f(at)], length);
    },
    vector: (to, { from = ORIGIN, stroke, head } = {}) => {
      const width = stroke?.width ?? 3;
      const tip = head ?? width * 3.5;
      const a = point(from);
      const b = point(to);
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);

      if (!(length > 0))
        throw new SceneError(
          `vector() needs a tip away from its tail, got [${to.join(", ")}] from [${from.join(", ")}].`,
        );
      const [ux, uy] = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
      const [nx, ny] = [-uy, ux];
      const neck = Math.max(0, length - tip);

      const at = (along: number, across: number): Vec => [
        round(a[0] + ux * along + nx * across),
        round(a[1] + uy * along + ny * across),
      ];

      return polygon(
        at(0, -width / 2),
        at(neck, -width / 2),
        at(neck, -tip * 0.55),
        at(length, 0),
        at(neck, tip * 0.55),
        at(neck, width / 2),
        at(0, width / 2),
      );
    },
    polygon: (points) => {
      if (points.length < 3)
        throw new SceneError(`A plane polygon needs three points or more, got ${points.length}.`);

      if (!curved) return polygon(...points.map(point));

      return points
        .reduce(
          (built, p, i) => traced(built, along(p, points[(i + 1) % points.length]!), true),
          path().moveTo(point(points[0]!)),
        )
        .close();
    },
    segment: (from, to, { samples } = {}) => pathOf([along(from, to, samples)], { smooth: curved }),
    grid: (step = 1) => {
      const [gx, gy] = pairOf(step);

      if (!(gx! > 0 && gy! > 0))
        throw new SceneError(`grid() needs a step above 0, got ${JSON.stringify(step)}.`);

      return pathOf(
        [
          ...stepsOf(x, gx!).map((k) => along([k, y[0]], [k, y[1]])),
          ...stepsOf(y, gy!).map((k) => along([x[0], k], [x[1], k])),
        ],
        { smooth: curved },
      );
    },
    axes: () => {
      const [cx, cy] = [Math.min(Math.max(0, x[0]), x[1]), Math.min(Math.max(0, y[0]), y[1])];

      return pathOf([along([x[0], cy], [x[1], cy]), along([cx, y[0]], [cx, y[1]])], {
        smooth: curved,
      });
    },
    transform: (given, amount = 1) => {
      if (!Number.isFinite(amount))
        throw new SceneError(`transform() needs a finite amount, got ${amount}.`);

      const f = isMatrix(given)
        ? ([px, py]: Vec): Vec => [
            given[0][0] * px + given[0][1] * py,
            given[1][0] * px + given[1][1] * py,
          ]
        : given;

      return build(options, (p) => lerp(map(p), f(map(p)), amount), curved || !isMatrix(given));
    },
  };
};

export const plane = (options: PlaneOptions): Plane => build(options, (p) => p, false);

export interface AxesLabels {
  readonly font: FontValue;
  readonly size: number;
  readonly fill: Anim<Paint>;
}

export interface AxesProps extends Omit<Common, "anchor"> {
  readonly plane: Plane;
  readonly stroke: StrokeProps;
  readonly ticks?: number | Vec;
  readonly grid?: StrokeProps | false;
  readonly labels?: AxesLabels;
}

const label = (n: number): string => String(round(n * 1e4) / 1e4);

export function Axes({
  plane: p,
  stroke,
  ticks = 1,
  grid,
  labels,
  at,
  ...common
}: AxesProps): SceneElement {
  const [tx, ty] = pairOf(ticks);

  if (!(tx! > 0 && ty! > 0))
    throw new SceneError(`<Axes> needs ticks above 0, got ${JSON.stringify(ticks)}.`);
  const [cx, cy] = [Math.min(Math.max(0, p.x[0]), p.x[1]), Math.min(Math.max(0, p.y[0]), p.y[1])];
  const tick = 5;
  const xs = stepsOf(p.x, tx!);
  const ys = stepsOf(p.y, ty!);

  const marks = pathOf([
    ...xs.map((k): Vec[] => {
      const [px, py] = p.point([k, cy]);

      return [
        [px, py - tick / 2],
        [px, py + tick / 2],
      ];
    }),
    ...ys.map((k): Vec[] => {
      const [px, py] = p.point([cx, k]);

      return [
        [px - tick / 2, py],
        [px + tick / 2, py],
      ];
    }),
  ]);

  const number = (key: string, at: Vec, anchor: "top" | "right", value: number) =>
    labels && (
      <Text
        key={key}
        font={labels.font}
        size={labels.size}
        fill={labels.fill}
        at={at}
        anchor={anchor}
      >
        {label(value)}
      </Text>
    );

  return (
    <Group {...common} {...(at !== undefined && { offset: at })}>
      {grid && <Shape key="grid" geometry={p.grid([tx!, ty!])} stroke={grid} />}
      <Shape key="axes" geometry={p.axes()} stroke={stroke} />
      <Shape key="ticks" geometry={marks} stroke={stroke} />
      {labels && (
        <Group key="labels">
          {[
            ...xs.map((k) => {
              const [px, py] = p.point([k, cy]);

              return number(`x ${label(k)}`, [px, py + tick + 2], "top", k);
            }),
            ...ys.flatMap((k) => {
              const [px, py] = p.point([cx, k]);

              return k === cy ? [] : [number(`y ${label(k)}`, [px - tick - 2, py], "right", k)];
            }),
          ]}
        </Group>
      )}
    </Group>
  );
}
