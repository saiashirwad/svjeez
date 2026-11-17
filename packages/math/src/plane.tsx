/** @jsxImportSource svjeez */
import {
  css,
  draw as drawOn,
  ease,
  motion,
  span as spanOf,
  type Drawn,
  type Part,
  type Spanned,
  tint,
  type Base16,
  type Color,
  type Ease,
  type FontValue,
  type PathData,
  type Point,
  type Rect,
  type Span,
  type SvgNode,
  defaultDark,
} from "svjeez";
import { rect } from "svjeez/geometry";

import { calculus, type Calculus } from "./calculus.tsx";
import { faintGrid, frameOf, furniture, sample, type Frame, type SampleOptions } from "./graph.tsx";
import { tex, type Tex } from "./index.ts";
import { apply, identity, multiply, round, type Matrix } from "./matrix.ts";
import { LEAN, warp, type Move, type PathAttrs, type Placement, type Vec2 } from "./warp.tsx";

export type { Vec2 };

type Row = readonly [number, number] | readonly [number, number, number];

export type PlaneMatrix = readonly [Row, Row];

export type PlaneFunction = (x: number, y: number) => Vec2;

export interface StepOptions {
  /** Default `ease.inOut`. */
  readonly ease?: Ease;
}

export interface PlaneOptions {
  readonly frame: Rect;
  /** Graph range of the x axis, `[min, max]`. */
  readonly xRange: Vec2;
  /** Graph range of the y axis, `[min, max]`. */
  readonly yRange: Vec2;
  readonly ticks?: number | { readonly x?: number; readonly y?: number };
  /** Numbers at the ticks. Default true. */
  readonly labels?: boolean;
  /** Faint lines across the plot at the ticks, in `node`. Default false. */
  readonly grid?: boolean;
  /** Paints the axes, the grid and the curves. Default `defaultDark`. */
  readonly theme?: Base16;
  readonly fontSize?: number;
  readonly font?: FontValue | string;
}

export interface VectorOptions {
  /** Default the theme's base0D. */
  readonly color?: Color;
  /** Stroke width in pixels; the head scales with it. Default 3. */
  readonly width?: number;
  readonly label?: string | Tex;
  /** The tail, in plane units. Default the origin. */
  readonly from?: Vec2;
}

export interface PlanePolygonOptions {
  /** Default the theme's base0A. */
  readonly color?: Color;
  /** Default 0.22. */
  readonly fillOpacity?: number;
  /** Outline width in pixels, 0 for none. Default 1.5. */
  readonly strokeWidth?: number;
}

export interface PlaneLineOptions {
  /** Default the theme's base0E. */
  readonly color?: Color;
  /** Default 1.5. */
  readonly width?: number;
  readonly opacity?: number;
}

export interface PlaneLabelOptions {
  /** For TeX source. Default the theme's base05. */
  readonly color?: Color;
  /** For TeX source. Default 17. */
  readonly fontSize?: number;
}

/**
 * What a plane draws. `bounds` is where it sits after every step; `span` runs from when it starts to draw to when the
 * last step moving it ends, or is the instant 0 if static. Only `basis()` has parts, `"i"` and `"j"`.
 */
export type PlaneDrawn<P extends Part = Part> = Drawn<P>;

export interface Plot extends PlaneDrawn<never> {
  readonly d: string;
  readonly points: readonly Point[];
}

export type PlotOptions = SampleOptions;

export interface Plane extends Calculus {
  readonly node: SvgNode;
  readonly bounds: Rect;
  point(x: number, y: number): Point;
  map(x: number, y: number): Point;
  apply(span: Span, matrix: PlaneMatrix, options?: StepOptions): Plane;
  applyFunction(span: Span, f: PlaneFunction, options?: StepOptions): Plane;
  reset(span: Span, options?: StepOptions): Plane;
  readonly css: ReturnType<typeof css>;
  readonly background: SvgNode;
  readonly grid: SvgNode;
  readonly axes: SvgNode;
  plot(f: (x: number) => number, options?: PlotOptions): Plot;
  plot(span: Span, f: (x: number) => number, options?: PlotOptions): Plot;
  vector(to: Vec2, options?: VectorOptions): PlaneDrawn<never>;
  vector(span: Span, to: Vec2, options?: VectorOptions): PlaneDrawn<never>;
  /** î and ĵ, labelled, as the parts `"i"` and `"j"`. Given a span, they grow in it, with ĵ entering 0.2s after î. */
  basis(span?: Span): PlaneDrawn<Part<"i" | "j">>;
  polygon(points: readonly Vec2[], options?: PlanePolygonOptions): PlaneDrawn<never>;
  line(direction: Vec2, options?: PlaneLineOptions): PlaneDrawn<never>;
  /** Content centered on a point of the plane, riding it. A node is placed with its origin there, and has an empty box. */
  label(at: Vec2, content: string | Tex | SvgNode, options?: PlaneLabelOptions): PlaneDrawn<never>;
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

const shared = { syntax: "number", inherits: true } as const;
const A = css.property("plane-a", { ...shared, initial: 1 });
const B = css.property("plane-b", { ...shared, initial: 0 });
const C = css.property("plane-c", { ...shared, initial: 0 });
const D = css.property("plane-d", { ...shared, initial: 1 });
const E = css.property("plane-e", { ...shared, initial: 0 });
const F = css.property("plane-f", { ...shared, initial: 0 });
const UX = css.property("plane-ux", { ...shared, initial: 1 });
const UY = css.property("plane-uy", { ...shared, initial: 1 });
const MATRIX = [A, B, C, D, E, F] as const;

const own = { syntax: "number", inherits: false, initial: 0 } as const;
const X = css.property("plane-x", own);
const Y = css.property("plane-y", own);
const DX = css.property("plane-dx", own);
const DY = css.property("plane-dy", own);
const K = css.property("plane-k", own);
const GROW = css.property("plane-grow", { ...own, initial: 1 });

const px = css`(${A} * ${X} + ${C} * ${Y} + ${E}) * ${UX}`;
const py = css`(${B} * ${X} + ${D} * ${Y} + ${F}) * ${UY}`;
const angle = css`atan2(calc(0 - (${B} * ${DX} + ${D} * ${DY}) * ${UY}), calc((${A} * ${DX} + ${C} * ${DY}) * ${UX}))`;

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

const rules = (frame: Frame, bare: boolean): Vec2[][] => {
  const [[x0, x1], [y0, y1]] = [frame.x, frame.y];
  const [cx, cy] = frame.cross;

  return [
    ...frame.xs
      .filter((k) => !bare || k !== cx)
      .map((k): Vec2[] => [
        [k, y0],
        [k, y1],
      ]),
    ...frame.ys
      .filter((k) => !bare || k !== cy)
      .map((k): Vec2[] => [
        [x0, k],
        [x1, k],
      ]),
  ];
};

const axisLines = (frame: Frame): Vec2[][] => [
  [
    [frame.cross[0], frame.y[0]],
    [frame.cross[0], frame.y[1]],
  ],
  [
    [frame.x[0], frame.cross[1]],
    [frame.x[1], frame.cross[1]],
  ],
];

interface Drawing {
  path(
    polylines: readonly (readonly Vec2[])[],
    closed: boolean,
    attrs: PathAttrs,
    grow?: Span,
  ): SvgNode;
  head(from: Vec2, to: Vec2, polygon: readonly Vec2[], fill: Color): SvgNode;
  ride(point: Vec2, direction: Vec2, push: number, content: SvgNode): SvgNode;
}

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
  const { origin, sx, sy } = frame;
  const matrices = [identity, ...placed];
  const moving = MATRIX.filter((_, i) => matrices.some((m) => m[i] !== identity[i]));

  const values = (m: Matrix): { [P in (typeof MATRIX)[number]]?: number } =>
    Object.fromEntries(moving.map((p) => [p, round(m[MATRIX.indexOf(p)]!)]));

  let timeline = moving.length > 0 ? motion(values(identity)) : undefined;

  for (const [i, s] of steps.entries())
    timeline = timeline?.to(values(matrices[i + 1]!), s, s.ease);

  const flat = `translate(${origin.x} ${origin.y})`;

  const scope = (pixels: boolean, child: SvgNode) => (
    <g transform={pixels ? flat : `${flat} scale(${sx} ${-sy})`}>
      <g animation={timeline} style={pixels ? { [UX]: sx, [UY]: sy } : undefined}>
        {child}
      </g>
    </g>
  );

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
        <g class="plane-map">
          <path
            {...attrs}
            d={plain(polylines, closed)}
            class={grow ? "plane-grow" : undefined}
            style={grow ? at(x, y) : undefined}
            animation={
              grow
                ? motion({ [GROW]: 0 }).to({ [GROW]: 1 }, spanOf(grow.at, grow.over), ease.inOut)
                : undefined
            }
          />
        </g>,
      );
    },
    head(from, to, polygon, fill) {
      return scope(
        true,
        <g class="plane-head" style={at(to[0], to[1], to[0] - from[0], to[1] - from[1])}>
          <polygon points={polygon.map((p) => p.join(",")).join(" ")} fill={fill} />
        </g>,
      );
    },
    ride(point, direction, push, content) {
      return scope(
        true,
        <g class="plane-at" style={at(point[0], point[1], direction[0], direction[1], push)}>
          {content}
        </g>,
      );
    },
  };
};

const warpDrawing = (frame: Frame, steps: readonly Step[]): Drawing => {
  const { origin, sx, sy } = frame;

  const scene =
    (f: PlaneFunction): Placement =>
    (p) => {
      const [x, y] = f(p[0], p[1]);

      return [origin.x + x * sx, origin.y - y * sy];
    };

  const moves = steps.map((s): Move => ({
    place: scene(functionOf(s.place)),
    at: s.at,
    over: s.over,
    ease: s.ease,
  }));

  const w = warp(scene(functionOf(IDENTITY)), moves, 16 / Math.min(sx, sy));

  return {
    path(polylines, closed, attrs, grow) {
      const node = w.path(w.rings(polylines, closed), closed, attrs);

      return grow ? (
        <g animation={motion({ opacity: 0 }).to({ opacity: 1 }, spanOf(grow.at, grow.over))}>
          {node}
        </g>
      ) : (
        node
      );
    },
    head(from, to, polygon, fill) {
      return w.head(w.rings([[from, to]], false)[0]!, polygon, fill);
    },
    ride: w.ride,
  };
};

const appear = (at: number, over: number, child: SvgNode) => (
  <g animation={motion({ opacity: 0 }).to({ opacity: 1 }, spanOf(at, over))}>{child}</g>
);

const isSource = (content: string | Tex | SvgNode): content is string =>
  typeof content === "string";

const centered = (
  content: string | Tex | SvgNode,
  color: Color,
  fontSize: number,
): readonly [SvgNode, number, { readonly w: number; readonly h: number }] => {
  const formula = isSource(content)
    ? tex(content, { fontSize, color, anchor: [0.5, 0.5] })
    : content;

  if (!("write" in formula)) return [formula, 8, { w: 0, h: 0 }];
  const { x, y, w, h } = formula.bounds;

  return [
    <g transform={`translate(${round(-x - w / 2)} ${round(-y - h / 2)})`}>{formula.node}</g>,
    Math.hypot(w, h) / 2,
    { w, h },
  ];
};

const around = (points: readonly Point[]): Rect => {
  const [xs, ys] = [points.map((p) => p.x), points.map((p) => p.y)];
  const [left, top] = [Math.min(...xs), Math.min(...ys)];

  return rect(left, top, Math.max(...xs) - left, Math.max(...ys) - top);
};

const within = (box: Rect, frame: Rect): Rect => {
  const [left, top] = [Math.max(box.x, frame.x), Math.max(box.y, frame.y)];
  const right = Math.max(left, Math.min(box.x + box.w, frame.x + frame.w));
  const bottom = Math.max(top, Math.min(box.y + box.h, frame.y + frame.h));

  return rect(left, top, right - left, bottom - top);
};

const covering = (spans: readonly (Span | undefined)[]): Spanned => {
  const all = spans.filter((s): s is Span => s !== undefined);

  if (all.length === 0) return spanOf(0, 0);
  const first = Math.min(...all.map((s) => s.at));

  return spanOf(first, Math.max(...all.map((s) => s.at + s.over)) - first);
};

const drawnOf = <P extends Part>(
  what: string,
  node: SvgNode,
  bounds: Rect,
  span: Spanned,
  parts: readonly P[] = [],
): Drawn<P> => ({
  node,
  bounds,
  span,
  parts,
  part(id) {
    const found = parts.find((p) => p.id === id);

    if (!found)
      throw new Error(
        `${what} has no part ${JSON.stringify(id)}.${parts.length > 0 ? ` Its parts are ${parts.map((p) => JSON.stringify(p.id)).join(", ")}.` : " It draws one thing, so read its bounds and span."}`,
      );

    return found;
  },
});

const make = (frame: Frame, steps: readonly Step[]): Plane => {
  const { theme } = frame;
  let drawing: Drawing | undefined;

  const matrices = steps.flatMap((s) => (s.place.kind === "matrix" ? [s.place.m] : []));

  const draw = () =>
    (drawing ??=
      matrices.length === steps.length
        ? cssDrawing(frame, steps, matrices)
        : warpDrawing(frame, steps));

  const push = (place: Place, span: Span, options: StepOptions = {}): Plane => {
    const last = steps.at(-1);

    if (!(span.over > 0) || !finite(span.at) || span.at < 0)
      throw new Error(
        `A plane step needs a non-negative start and a positive length, got at ${span.at} and over ${span.over}.`,
      );

    if (last && span.at < last.at + last.over)
      throw new Error(
        `A plane step starts at ${span.at}s, before the previous step ends at ${round(last.at + last.over)}s.`,
      );

    return make(frame, [
      ...steps,
      { place, at: span.at, over: span.over, ease: options.ease ?? ease.inOut },
    ]);
  };

  const current = steps.at(-1)?.place ?? IDENTITY;

  const settled = (q: Vec2): Point => frame.point(...functionOf(current)(q[0], q[1]));

  const traced = (polylines: readonly (readonly Vec2[])[], samples = 16): Rect =>
    around(
      polylines.flatMap((line) =>
        line.length === 1
          ? [settled(line[0]!)]
          : line.slice(1).flatMap((q, i) => {
              const from = line[i]!;

              return Array.from({ length: samples + 1 }, (_, k) =>
                settled([
                  from[0] + ((q[0] - from[0]) * k) / samples,
                  from[1] + ((q[1] - from[1]) * k) / samples,
                ]),
              );
            }),
      ),
    );

  const moving: Span | undefined =
    steps.length === 0
      ? undefined
      : {
          at: steps[0]!.at,
          over: steps.at(-1)!.at + steps.at(-1)!.over - steps[0]!.at,
        };

  function vector(to: Vec2, options?: VectorOptions): PlaneDrawn<never>;
  function vector(span: Span, to: Vec2, options?: VectorOptions): PlaneDrawn<never>;
  function vector(
    first: Span | Vec2,
    second?: Vec2 | VectorOptions,
    third?: VectorOptions,
  ): PlaneDrawn<never> {
    // SAFETY: the overloads pair a span with a tip and options, or a tip alone with options.
    const [enter, to, options = {}] = Array.isArray(first)
      ? [undefined, first as Vec2, second as VectorOptions | undefined]
      : [first as Span, second as Vec2, third];

    const { color = theme.base0D, width = 3, from = [0, 0] } = options;

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
    const push = (4 / 3) * width + 6 + (words?.[1] ?? 0);
    const label = words && draw().ride(to, direction, push, words[0]);

    const [tail, end] = [
      settled([to[0] - direction[0] * 0.01, to[1] - direction[1] * 0.01]),
      settled(to),
    ];

    const angle = Math.atan2(end.y - tail.y, end.x - tail.x) - LEAN;
    const box = traced([[from, to]]).pad((8 / 3) * width);

    const bounds = words
      ? box.union(
          rect(
            end.x + push * Math.cos(angle) - words[2].w / 2,
            end.y + push * Math.sin(angle) - words[2].h / 2,
            words[2].w,
            words[2].h,
          ),
        )
      : box;

    if (!enter)
      return drawnOf(
        "plane.vector()",
        <g>
          {shaft}
          {tip}
          {label}
        </g>,
        bounds,
        covering([moving]),
      );
    const { at, over } = enter;

    return drawnOf(
      "plane.vector()",
      <g>
        {shaft}
        {appear(at + over * 0.8, over * 0.4, tip)}
        {label && appear(at + over, over * 0.8, label)}
      </g>,
      bounds,
      covering([{ at, over: over * (label ? 1.8 : 1.2) }, moving]),
    );
  }

  function plot(f: (x: number) => number, options?: PlotOptions): Plot;
  function plot(span: Span, f: (x: number) => number, options?: PlotOptions): Plot;
  function plot(
    first: Span | ((x: number) => number),
    second?: ((x: number) => number) | PlotOptions,
    third?: PlotOptions,
  ): Plot {
    // SAFETY: the overloads pair a span with a function and options, or a function alone with options.
    const [on, f, options = {}] =
      first instanceof Function
        ? [undefined, first, second as PlotOptions | undefined]
        : [first, second as (x: number) => number, third];

    const curve = sample(frame, f, options);
    const { color = tint(theme, "blue"), strokeWidth = 2.5 } = options;
    const look = { fill: "none", stroke: color, strokeWidth } as const;
    const joins = { strokeLinejoin: "round", strokeLinecap: "round" } as const;

    if (steps.length > 0 && on)
      throw new Error(
        `plot() cannot draw on a plane that has steps. Plot on the plane before its first step, or leave out the span.`,
      );

    const runs = curve.runs.filter((run) => run.length > 1);

    const box = within(
      steps.length > 0 && runs.length > 0 ? traced(runs, 1) : around(curve.points),
      frame.bounds,
    );

    return {
      d: curve.d,
      points: curve.points,
      ...drawnOf<never>(
        "plot()",
        <g clipPath={frame.clip}>
          {steps.length > 0 ? (
            draw().path(runs, false, { ...look, ...joins })
          ) : (
            <path d={curve.d} {...look} {...joins} animation={on && drawOn(on)} />
          )}
        </g>,
        box,
        covering([on, moving]),
      ),
    };
  }

  const graph = calculus({
    x: frame.x,
    y: frame.y,
    bounds: frame.bounds,
    theme,
    clip: frame.clip,
    point: frame.point,
  });

  const refuse = (name: string) => (): never => {
    throw new Error(
      `plane.${name}() draws on a plane that does not move. Call it on the plane before its first step.`,
    );
  };

  const still: Calculus =
    steps.length === 0
      ? graph
      : {
          dot: refuse("dot"),
          tangent: refuse("tangent"),
          secant: refuse("secant"),
          area: refuse("area"),
          riemann: refuse("riemann"),
          morph: refuse("morph"),
          parametric: refuse("parametric"),
          polar: refuse("polar"),
        };

  return {
    point: frame.point,
    map: (x, y) => frame.point(...functionOf(current)(x, y)),
    apply: (span, matrix, options) =>
      push(then(current, { kind: "matrix", m: toMatrix(matrix) }), span, options),
    applyFunction: (span, f, options) => {
      const checked: PlaneFunction = (x, y) => {
        const out = f(x, y);

        if (!finite(...out))
          throw new Error(
            `plane.applyFunction() sent (${round(x)}, ${round(y)}) to (${out.join(", ")}), which is not a finite point.`,
          );

        return out;
      };

      return push(then(current, { kind: "function", f: checked }), span, options);
    },
    reset: (span, options) => push(IDENTITY, span, options),
    css: PLANE_CSS,
    get node() {
      return furniture(frame);
    },
    bounds: frame.bounds,
    get background() {
      return faintGrid(frame);
    },
    get grid() {
      const lines = rules(frame, true);

      return lines.length === 0 ? (
        <g />
      ) : (
        draw().path(lines, false, { fill: "none", stroke: theme.base0D, strokeOpacity: 0.55 })
      );
    },
    get axes() {
      return draw().path(axisLines(frame), false, {
        fill: "none",
        stroke: theme.base05,
        strokeWidth: 1.5,
      });
    },
    plot,
    ...still,
    vector,
    basis: (enter) => {
      const i = enter
        ? vector(enter, [1, 0], { color: theme.base0B, label: String.raw`\hat\imath` })
        : vector([1, 0], { color: theme.base0B, label: String.raw`\hat\imath` });

      const j = enter
        ? vector({ at: enter.at + 0.2, over: enter.over }, [0, 1], {
            color: theme.base08,
            label: String.raw`\hat\jmath`,
          })
        : vector([0, 1], { color: theme.base08, label: String.raw`\hat\jmath` });

      const parts = [
        { id: "i", box: i.bounds, span: i.span },
        { id: "j", box: j.bounds, span: j.span },
      ] as const;

      return drawnOf(
        "plane.basis()",
        <g>
          {i}
          {j}
        </g>,
        i.bounds.union(j.bounds),
        covering([i.span, j.span]),
        parts,
      );
    },
    polygon: (points, { color = theme.base0A, fillOpacity = 0.22, strokeWidth = 1.5 } = {}) =>
      drawnOf(
        "plane.polygon()",
        draw().path([points], true, {
          fill: color,
          fillOpacity,
          stroke: strokeWidth > 0 ? color : undefined,
          strokeWidth: strokeWidth > 0 ? strokeWidth : undefined,
        }),
        traced([[...points, points[0]!]]),
        covering([moving]),
      ),
    line: ([dx, dy], { color = theme.base0E, width = 1.5, opacity } = {}) => {
      const len = Math.hypot(dx, dy);

      if (!(len > 0))
        throw new Error(`plane.line() needs a nonzero direction, got [${dx}, ${dy}].`);

      const reach =
        (Math.max(...frame.x.map(Math.abs), ...frame.y.map(Math.abs)) * Math.SQRT2) / len;

      const ends: Vec2[] = [
        [-dx * reach, -dy * reach],
        [dx * reach, dy * reach],
      ];

      return drawnOf(
        "plane.line()",
        draw().path([ends], false, {
          fill: "none",
          stroke: color,
          strokeWidth: width,
          strokeOpacity: opacity,
        }),
        traced([ends]),
        covering([moving]),
      );
    },
    label: (at, content, { color = theme.base05, fontSize = 17 } = {}) => {
      const [node, , { w, h }] = centered(content, color, fontSize);
      const { x, y } = settled(at);

      return drawnOf(
        "plane.label()",
        draw().ride(at, [0, 0], 0, node),
        rect(x - w / 2, y - h / 2, w, h),
        covering([moving]),
      );
    },
  };
};

/**
 * Axes over `xRange` and `yRange` in a plot area `frame`, y up. Draw its `node` and `plot()`s, or chain `apply`,
 * `applyFunction` and `reset` and draw from the plane those return.
 */
export function plane(options: PlaneOptions): Plane {
  return make(frameOf({ ...options, theme: options.theme ?? defaultDark }), []);
}
