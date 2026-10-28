import {
  css,
  def,
  ease,
  el,
  motion,
  type Color,
  type Ease,
  type PathData,
  type Point,
  type Span,
  type SvgNode,
} from "svjeez";
import { defaultDark, type Base16 } from "svjeez/extras";
import { tex, type Tex } from "./index.ts";
import { apply, identity, multiply, round, type Matrix } from "./matrix.ts";
import { LEAN, warp, type Move, type PathAttrs, type Placement, type Vec2 } from "./warp.ts";

export type { Vec2 };

type Row = readonly [number, number] | readonly [number, number, number];

/** A map of the plane by rows, as written on paper: `[[a, b], [c, d]]` sends (x, y) to (ax + by, cx + dy). A third number in a row translates. */
export type PlaneMatrix = readonly [Row, Row];

/** A map of the plane that need not be linear, such as z ↦ z² as `(x, y) => [x * x - y * y, 2 * x * y]`. */
export type PlaneFunction = (x: number, y: number) => Vec2;

export interface StepOptions extends Span {
  /** Default `ease.inOut`. */
  readonly ease?: Ease;
}

export interface PlaneOptions {
  /** Where (0, 0) sits, in scene pixels. */
  readonly origin: Point;
  /** Pixels per unit. */
  readonly unit: number;
  /** How far the grid reaches, in units: a number for ±n on both axes, or a range per axis. Default 10. */
  readonly extent?: number | { readonly x: Vec2; readonly y: Vec2 };
  /** Units between grid lines. Default 1. */
  readonly step?: number;
  /** Paints the grid and axes. Default `defaultDark`. */
  readonly theme?: Base16;
}

export interface VectorOptions {
  /** Default the theme's base0D. */
  readonly color?: Color;
  /** Stroke width in pixels; the head scales with it. Default 3. */
  readonly width?: number;
  /** TeX source, or a `tex()` formula, kept just past the tip. */
  readonly label?: string | Tex;
  /** The tail, in plane units. Default the origin. */
  readonly from?: Vec2;
  /** The shaft grows from the tail during the span, then the head and the label appear. */
  readonly enter?: Span;
}

export interface PolygonOptions {
  /** Default the theme's base0A. */
  readonly color?: Color;
  /** Default 0.22. */
  readonly fillOpacity?: number;
  /** Outline width in pixels, 0 for none. Default 1.5. */
  readonly strokeWidth?: number;
}

export interface LineOptions {
  /** Default the theme's base0E. */
  readonly color?: Color;
  /** Default 1.5. */
  readonly width?: number;
  readonly opacity?: number;
}

export interface LabelOptions {
  /** For TeX source. Default the theme's base05. */
  readonly color?: Color;
  /** For TeX source. Default 17. */
  readonly fontSize?: number;
}

/**
 * A coordinate plane that moves. Steps chain, each returning a new plane, and everything drawn from the final
 * plane follows every step. When every step is a matrix, the scene carries one CSS transform driven by
 * registered properties; once a step is a function, outlines are sampled and morph through `d`.
 */
export interface Plane {
  /** Scene pixels of a point before any step. */
  point(x: number, y: number): Point;
  /** Scene pixels of a point after every step. */
  map(x: number, y: number): Point;
  /** Moves the plane by `matrix` during the span, on top of the steps before it. */
  apply(matrix: PlaneMatrix, step: StepOptions): Plane;
  /** Moves every point p to `f(p)` during the span, each along a straight line. */
  applyFunction(f: PlaneFunction, step: StepOptions): Plane;
  /** Moves every point back to where it started. */
  reset(step: StepOptions): Plane;
  /** The rules the plane's elements read. Pass it to `render`'s `css`. */
  readonly css: ReturnType<typeof css>;
  /** The grid as it was, staying put. */
  readonly background: SvgNode;
  /** The grid lines that move, without the axes. */
  readonly grid: SvgNode;
  readonly axes: SvgNode;
  /** An arrow to `to`, its head upright however the plane shears. */
  vector(to: Vec2, options?: VectorOptions): SvgNode;
  /** î and ĵ, labelled, with ĵ entering 0.2s after î. */
  basis(options?: { readonly enter?: Span }): SvgNode;
  /** A filled polygon whose corners move with the plane, so its area follows the determinant. */
  polygon(points: readonly Vec2[], options?: PolygonOptions): SvgNode;
  /** The line through the origin along `direction`, across the grid. An eigenvector's line stays on itself. */
  span(direction: Vec2, options?: LineOptions): SvgNode;
  /** Content centered on a point of the plane, riding it. A node is placed with its origin there. */
  label(at: Vec2, content: string | Tex | SvgNode, options?: LabelOptions): SvgNode;
}

type Place =
  | { readonly kind: "matrix"; readonly m: Matrix }
  | { readonly kind: "function"; readonly f: PlaneFunction };

interface Step {
  readonly place: Place;
  readonly at: number;
  readonly over: number;
  readonly ease: Ease;
}

interface Frame {
  readonly origin: Point;
  readonly unit: number;
  readonly x: Vec2;
  readonly y: Vec2;
  readonly step: number;
  readonly theme: Base16;
}

const shared = { syntax: "number", inherits: true } as const;
const A = def.property("plane-a", { ...shared, initial: 1 });
const B = def.property("plane-b", { ...shared, initial: 0 });
const C = def.property("plane-c", { ...shared, initial: 0 });
const D = def.property("plane-d", { ...shared, initial: 1 });
const E = def.property("plane-e", { ...shared, initial: 0 });
const F = def.property("plane-f", { ...shared, initial: 0 });
const UNIT = def.property("plane-u", { ...shared, initial: 1 });
const MATRIX = [A, B, C, D, E, F] as const;

const own = { syntax: "number", inherits: false, initial: 0 } as const;
const X = def.property("plane-x", own);
const Y = def.property("plane-y", own);
const DX = def.property("plane-dx", own);
const DY = def.property("plane-dy", own);
const K = def.property("plane-k", own);
const GROW = def.property("plane-grow", { ...own, initial: 1 });

const px = css`(${A} * ${X} + ${C} * ${Y} + ${E}) * ${UNIT}`;
const py = css`(${B} * ${X} + ${D} * ${Y} + ${F}) * ${UNIT}`;
const angle = css`atan2(calc(0 - ${B} * ${DX} - ${D} * ${DY}), calc(${A} * ${DX} + ${C} * ${DY}))`;

const PLANE_CSS = css`.plane-map{transform:matrix(${A},${B},${C},${D},${E},${F})}.plane-map *{vector-effect:non-scaling-stroke}.plane-head{translate:calc(${px} * 1px) calc(${py} * -1px);rotate:${angle}}.plane-at{translate:calc(${px} * 1px + ${K} * cos(${angle} - ${(LEAN * 180) / Math.PI}deg) * 1px) calc(${py} * -1px + ${K} * sin(${angle} - ${(LEAN * 180) / Math.PI}deg) * 1px)}.plane-grow{scale:${GROW};transform-origin:calc(${X} * 1px) calc(${Y} * 1px)}`;

const finite = (...n: readonly number[]) => n.every(Number.isFinite);

const toMatrix = (rows: PlaneMatrix): Matrix => {
  const [[a, b, e = 0], [c, d, f = 0]] = rows;

  if (!finite(a, b, c, d, e, f))
    throw new Error(
      `plane.apply() needs finite numbers in its matrix, got [[${rows[0].join(", ")}], [${rows[1].join(", ")}]].`,
    );

  return [a, c, b, d, e, f];
};

const functionOf = (place: Place): PlaneFunction =>
  place.kind === "function" ? place.f : (x, y) => apply(place.m, x, y);

const then = (before: Place, next: Place): Place => {
  if (before.kind === "matrix" && next.kind === "matrix")
    return { kind: "matrix", m: multiply(next.m, before.m) };
  const [f, g] = [functionOf(before), functionOf(next)];

  return { kind: "function", f: (x, y) => g(...f(x, y)) };
};

const IDENTITY: Place = { kind: "matrix", m: identity };

/** Grid lines at every multiple of `step` in range, as two-point polylines. */
const lines = (frame: Frame, keep: (k: number) => boolean): Vec2[][] => {
  const ticks = ([lo, hi]: Vec2) =>
    Array.from({ length: Math.floor(hi / frame.step) - Math.ceil(lo / frame.step) + 1 }, (_, i) =>
      round((Math.ceil(lo / frame.step) + i) * frame.step),
    ).filter(keep);

  const [[x0, x1], [y0, y1]] = [frame.x, frame.y];

  return [
    ...ticks(frame.x).map((k): Vec2[] => [
      [k, y0],
      [k, y1],
    ]),
    ...ticks(frame.y).map((k): Vec2[] => [
      [x0, k],
      [x1, k],
    ]),
  ];
};

/** How one plane draws: one CSS transform for matrices, or sampled outlines once a function moves it. */
interface Drawing {
  /** Polylines in plane units, as a path that moves with the plane. `grow` scales a single line from its first point. */
  path(
    polylines: readonly (readonly Vec2[])[],
    closed: boolean,
    attrs: PathAttrs,
    grow?: Span,
  ): SvgNode;
  head(from: Vec2, to: Vec2, polygon: readonly Vec2[], fill: Color): SvgNode;
  ride(point: Vec2, direction: Vec2, push: number, content: SvgNode): SvgNode;
}

/** Path data in plane units, with H and V for the axis-aligned edges a grid is made of. */
const plain = (polylines: readonly (readonly Vec2[])[], closed: boolean): PathData =>
  // SAFETY: every polyline starts with M, so the text is path data.
  polylines
    .map((line) => {
      const edges = line.slice(1).map(([x, y], i) => {
        const [px, py] = line[i]!;

        if (y === py) return `H${round(x)}`;

        return x === px ? `V${round(y)}` : `L${round(x)} ${round(y)}`;
      });

      return `M${round(line[0]![0])} ${round(line[0]![1])}${edges.join("")}${closed ? "Z" : ""}`;
    })
    .join("") as PathData;

const cssDrawing = (frame: Frame, steps: readonly Step[], placed: readonly Matrix[]): Drawing => {
  const { origin, unit } = frame;
  const matrices = [identity, ...placed];
  const moving = MATRIX.filter((_, i) => matrices.some((m) => m[i] !== identity[i]));

  const values = (m: Matrix): { [P in (typeof MATRIX)[number]]?: number } =>
    Object.fromEntries(moving.map((p) => [p, round(m[MATRIX.indexOf(p)]!)]));

  let timeline = moving.length > 0 ? motion(values(identity)) : undefined;

  for (const [i, s] of steps.entries())
    timeline = timeline?.at(s.at).to(values(matrices[i + 1]!), s.over, s.ease);

  const flat = `translate(${origin.x} ${origin.y})`;

  /** In pixels from the origin, where heads and labels read the unit, or in plane units, where paths don't. */
  const scope = (pixels: boolean, child: SvgNode) =>
    el.g(
      { transform: pixels ? flat : `${flat} scale(${unit} ${-unit})` },
      el.g({ animation: timeline, style: pixels ? { [UNIT]: unit } : undefined }, child),
    );

  /** A point and a direction for the rules to read. Zeros are left out, since every property starts at 0. */
  const at = (x: number, y: number, dx = 0, dy = 0, k = 0) => ({
    [X]: x || undefined,
    [Y]: y || undefined,
    [DX]: dx || undefined,
    [DY]: dy || undefined,
    [K]: round(k) || undefined,
  });

  return {
    path(polylines, closed, attrs, grow) {
      const [x, y] = polylines[0]![0]!;

      return scope(
        false,
        el.g(
          { class: "plane-map" },
          el.path({
            ...attrs,
            d: plain(polylines, closed),
            class: grow ? "plane-grow" : undefined,
            style: grow ? at(x, y) : undefined,
            animation: grow
              ? motion({ [GROW]: 0 })
                  .at(grow.at)
                  .to({ [GROW]: 1 }, grow.over, ease.inOut)
              : undefined,
          }),
        ),
      );
    },
    head(from, to, polygon, fill) {
      return scope(
        true,
        el.g(
          { class: "plane-head", style: at(to[0], to[1], to[0] - from[0], to[1] - from[1]) },
          el.polygon({ points: polygon.map((p) => p.join(",")).join(" "), fill }),
        ),
      );
    },
    ride(point, direction, push, content) {
      return scope(
        true,
        el.g(
          { class: "plane-at", style: at(point[0], point[1], direction[0], direction[1], push) },
          content,
        ),
      );
    },
  };
};

const warpDrawing = (frame: Frame, steps: readonly Step[]): Drawing => {
  const { origin, unit } = frame;

  const scene =
    (f: PlaneFunction): Placement =>
    (p) => {
      const [x, y] = f(p[0], p[1]);

      return [origin.x + x * unit, origin.y - y * unit];
    };

  const moves = steps.map((s): Move => ({
    place: scene(functionOf(s.place)),
    at: s.at,
    over: s.over,
    ease: s.ease,
  }));

  const w = warp(scene(functionOf(IDENTITY)), moves, 16 / unit);

  return {
    path(polylines, closed, attrs, grow) {
      const node = w.path(w.rings(polylines, closed), closed, attrs);

      return grow
        ? el.g(
            { animation: motion({ opacity: 0 }).at(grow.at).to({ opacity: 1 }, grow.over) },
            node,
          )
        : node;
    },
    head(from, to, polygon, fill) {
      return w.head(w.rings([[from, to]], false)[0]!, polygon, fill);
    },
    ride: w.ride,
  };
};

const appear = (at: number, over: number, child: SvgNode) =>
  el.g({ animation: motion({ opacity: 0 }).at(at).to({ opacity: 1 }, over) }, child);

const isSource = (content: string | Tex | SvgNode): content is string =>
  typeof content === "string";

const isRadius = (extent: number | { readonly x: Vec2; readonly y: Vec2 }): extent is number =>
  typeof extent === "number";

const centered = (
  content: string | Tex | SvgNode,
  color: Color,
  fontSize: number,
): readonly [SvgNode, number] => {
  const formula = isSource(content)
    ? tex(content, { fontSize, color, anchor: [0.5, 0.5] })
    : content;

  if (!("write" in formula)) return [formula, 8];
  const { x, y, w, h } = formula.bounds;

  return [
    el.g({ transform: `translate(${round(-x - w / 2)} ${round(-y - h / 2)})` }, formula.node),
    Math.hypot(w, h) / 2,
  ];
};

const make = (frame: Frame, steps: readonly Step[]): Plane => {
  const { theme } = frame;
  let drawing: Drawing | undefined;

  const matrices = steps.flatMap((s) => (s.place.kind === "matrix" ? [s.place.m] : []));

  const draw = () =>
    (drawing ??=
      matrices.length === steps.length
        ? cssDrawing(frame, steps, matrices)
        : warpDrawing(frame, steps));

  const toScene = (x: number, y: number): Point => ({
    x: round(frame.origin.x + x * frame.unit),
    y: round(frame.origin.y - y * frame.unit),
  });

  const push = (place: Place, step: StepOptions): Plane => {
    const last = steps.at(-1);

    if (!(step.over > 0) || !finite(step.at) || step.at < 0)
      throw new Error(
        `A plane step needs a non-negative start and a positive length, got at ${step.at} and over ${step.over}.`,
      );

    if (last && step.at < last.at + last.over)
      throw new Error(
        `A plane step starts at ${step.at}s, before the previous step ends at ${round(last.at + last.over)}s.`,
      );

    return make(frame, [
      ...steps,
      { place, at: step.at, over: step.over, ease: step.ease ?? ease.inOut },
    ]);
  };

  const current = steps.at(-1)?.place ?? IDENTITY;

  const vector = (to: Vec2, options: VectorOptions = {}): SvgNode => {
    const { color = theme.base0D, width = 3, from = [0, 0], enter } = options;

    if (!finite(...to, ...from) || (to[0] === from[0] && to[1] === from[1]))
      throw new Error(
        `plane.vector() needs a finite arrow of nonzero length, from [${from.join(", ")}] to [${to.join(", ")}].`,
      );

    const head: Vec2[] = [
      [(4 / 3) * width, 0],
      [(-8 / 3) * width, (-11 / 6) * width],
      [(-8 / 3) * width, (11 / 6) * width],
    ];

    const shaft = draw().path(
      [[from, to]],
      false,
      { fill: "none", stroke: color, strokeWidth: width },
      enter,
    );

    const tip = draw().head(from, to, head, color);
    const direction: Vec2 = [to[0] - from[0], to[1] - from[1]];
    const words = options.label === undefined ? undefined : centered(options.label, color, 17);
    const label = words && draw().ride(to, direction, (4 / 3) * width + 6 + words[1], words[0]);

    if (!enter) return el.g({}, [shaft, tip, label]);
    const { at, over } = enter;

    return el.g({}, [
      shaft,
      appear(at + over * 0.8, over * 0.4, tip),
      label && appear(at + over, over * 0.8, label),
    ]);
  };

  return {
    point: toScene,
    map: (x, y) => toScene(...functionOf(current)(x, y)),
    apply: (matrix, step) => push(then(current, { kind: "matrix", m: toMatrix(matrix) }), step),
    applyFunction: (f, step) => {
      const checked: PlaneFunction = (x, y) => {
        const out = f(x, y);

        if (!finite(...out))
          throw new Error(
            `plane.applyFunction() sent (${round(x)}, ${round(y)}) to (${out.join(", ")}), which is not a finite point.`,
          );

        return out;
      };

      return push(then(current, { kind: "function", f: checked }), step);
    },
    reset: (step) => push(IDENTITY, step),
    css: PLANE_CSS,
    get background() {
      return el.g(
        {
          transform: `translate(${frame.origin.x} ${frame.origin.y}) scale(${frame.unit} ${-frame.unit})`,
        },
        el.path({
          d: plain(
            lines(frame, () => true),
            false,
          ),
          fill: "none",
          stroke: theme.base02,
          style: "vector-effect:non-scaling-stroke",
        }),
      );
    },
    get grid() {
      return draw().path(
        lines(frame, (k) => k !== 0),
        false,
        { fill: "none", stroke: theme.base0D, strokeOpacity: 0.55 },
      );
    },
    get axes() {
      return draw().path(
        lines(frame, (k) => k === 0),
        false,
        { fill: "none", stroke: theme.base05, strokeWidth: 1.5 },
      );
    },
    vector,
    basis: ({ enter } = {}) =>
      el.g({}, [
        vector([1, 0], { color: theme.base0B, label: String.raw`\hat\imath`, enter }),
        vector([0, 1], {
          color: theme.base08,
          label: String.raw`\hat\jmath`,
          enter: enter && { at: enter.at + 0.2, over: enter.over },
        }),
      ]),
    polygon: (points, { color = theme.base0A, fillOpacity = 0.22, strokeWidth = 1.5 } = {}) =>
      draw().path([points], true, {
        fill: color,
        fillOpacity,
        stroke: strokeWidth > 0 ? color : undefined,
        strokeWidth: strokeWidth > 0 ? strokeWidth : undefined,
      }),
    span: ([dx, dy], { color = theme.base0E, width = 1.5, opacity } = {}) => {
      const len = Math.hypot(dx, dy);

      if (!(len > 0))
        throw new Error(`plane.span() needs a nonzero direction, got [${dx}, ${dy}].`);

      const reach =
        (Math.max(...frame.x.map(Math.abs), ...frame.y.map(Math.abs)) * Math.SQRT2) / len;

      return draw().path(
        [
          [
            [-dx * reach, -dy * reach],
            [dx * reach, dy * reach],
          ],
        ],
        false,
        { fill: "none", stroke: color, strokeWidth: width, strokeOpacity: opacity },
      );
    },
    label: (at, content, { color = theme.base05, fontSize = 17 } = {}) =>
      draw().ride(at, [0, 0], 0, centered(content, color, fontSize)[0]),
  };
};

/**
 * A coordinate plane at `origin`, `unit` pixels to a unit, with y up. Chain `apply`, `applyFunction` and
 * `reset` to move it, then draw from the plane those calls return: its grid, axes, vectors, shapes and labels.
 */
export function plane(options: PlaneOptions): Plane {
  const { origin, unit, extent = 10, step = 1, theme = defaultDark } = options;

  if (!(unit > 0) || !(step > 0) || !finite(origin.x, origin.y))
    throw new Error(
      `plane() needs a finite origin and a positive unit and step, got origin (${origin.x}, ${origin.y}), unit ${unit} and step ${step}.`,
    );

  const [x, y]: readonly [Vec2, Vec2] = isRadius(extent)
    ? [
        [-extent, extent],
        [-extent, extent],
      ]
    : [extent.x, extent.y];

  return make({ origin, unit, x, y, step, theme }, []);
}
