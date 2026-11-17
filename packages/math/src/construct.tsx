/** @jsxImportSource svjeez */
import {
  ease,
  motion,
  type Base16,
  type Color,
  type Drawn,
  type Part,
  type Point,
  type Rect,
  type Span,
  type SvgNode,
  defaultDark,
} from "svjeez";
import { span as spanOf, type Spanned } from "svjeez";
import { rect } from "svjeez/geometry";

import { tex } from "./index.ts";

/** A place in the construction, in construction units with y up. Every method takes one where it needs a point. */
export interface ConstructSpot {
  readonly kind: "point";
  readonly x: number;
  readonly y: number;
  readonly label?: string;
}

/**
 * A point the construction draws, which `g.point()`, `g.midpoint()` and `g.intersect()` return. Its id is its label,
 * else its place as `(x, y)`; its box is the dot (a point with `dot: false` has an empty box where the dot would be);
 * and its span runs from the dot popping in until its label has faded in.
 */
export interface ConstructPoint extends ConstructSpot, Part {}

/**
 * A segment, a ray or a full line, by two points and how far the drawing reaches past each. Its id is its label, else
 * the names of its two points, as `AB`; its box covers the stroke as drawn; and its span runs from when it starts to
 * draw until its label has faded in.
 */
export interface ConstructLine extends Part {
  readonly kind: "line";
  readonly a: ConstructSpot;
  readonly b: ConstructSpot;
  /** Intersections treat the line as endless. A segment reaches only from `a` to `b`. */
  readonly endless: boolean;
  /** How far the drawn line runs past `a` and past `b`, in units. */
  readonly extend: readonly [number, number];
}

/** A circle by its center and radius in units. Its id is `circle` and its center's name, as `circle A`; its box covers the circle or arc drawn; and its span is when it sweeps. */
export interface ConstructCircle extends Part {
  readonly kind: "circle";
  readonly center: ConstructSpot;
  readonly radius: number;
}

export type ConstructCurve = ConstructLine | ConstructCircle;

/** Everything a construction draws that a scene can point at. */
export type ConstructPart = ConstructPoint | ConstructCurve;

/** A line as geometry, before it is drawn. */
type RuledLine = Omit<ConstructLine, keyof Part>;

/** A circle as geometry, before it is drawn. */
type CompassCircle = Omit<ConstructCircle, keyof Part>;

/** What intersections cross: lines and circles as geometry. */
type Figure = RuledLine | CompassCircle;

/** Seconds each kind of element takes to draw. `gap` separates one element from the next and `step` is the pause a `g.step()` adds. */
export interface ConstructPace {
  readonly point: number;
  readonly line: number;
  readonly circle: number;
  readonly angle: number;
  readonly fill: number;
  readonly label: number;
  readonly gap: number;
  readonly step: number;
}

export interface ConstructOptions {
  /** Paints lines, aids, angles and labels. Default `defaultDark`. */
  readonly theme?: Base16;
  /** Pixels per construction unit. Default 1. */
  readonly unit?: number;
  /** Where the origin sits in the scene, in px. Construction y grows up, scene y grows down. Default 0, 0. */
  readonly origin?: Point;
  /** Pixels per em for labels. Default 20. */
  readonly fontSize?: number;
  /** Where the first element starts, in seconds. Default 0. */
  readonly start?: number;
  readonly pace?: Partial<ConstructPace>;
  /** The opacity construction aids settle to after `g.settle()`. Default 0.22. */
  readonly faint?: number;
}

/** Every element takes an optional `at` and `over`. Without `at` an element starts when the one before it ends. */
export interface ConstructLook extends Partial<Span> {
  /** Overrides the theme's color for this element. */
  readonly color?: Color;
  /** A construction aid: drawn in a quieter color, and `g.settle()` fades it back. */
  readonly aid?: boolean;
}

export interface PointOptions extends ConstructLook {
  /** Draw no dot, only the label. Default true. */
  readonly dot?: boolean;
}

export interface ConstructLineOptions extends ConstructLook {
  /** A TeX label beside the middle of the line. */
  readonly label?: string;
  /** Units a line, parallel or perpendicular runs past each of its points. Default a quarter of the distance between them. */
  readonly extend?: number;
}

/** A segment ends where its points do. */
export type SegmentOptions = Omit<ConstructLineOptions, "extend">;

export interface CircleOptions extends ConstructLook {
  /** Draw only this arc, in degrees counterclockwise from the +x axis. Without it the whole circle sweeps, starting at the point it passes through. */
  readonly arc?: { readonly from: number; readonly to: number };
}

export interface IntersectOptions extends ConstructLook {
  /** Which crossing to keep: line and circle give them in the order along the line, two circles give the one on the left of center 1 to center 2 first. */
  readonly pick?: 0 | 1;
  readonly label?: string;
  /** Labels for the crossings in order, when you keep both. */
  readonly labels?: readonly [string?, string?];
  readonly dot?: boolean;
}

export interface ConstructPolygonOptions extends ConstructLook {
  /** Default the theme's blue. */
  readonly fill?: Color;
  /** Fill opacity. Default 0.2. */
  readonly opacity?: number;
  /** Also draw the outline on. Default false: lay the polygon over segments you drew. */
  readonly outline?: boolean;
  /** A TeX label at the polygon's center. */
  readonly label?: string;
}

export interface AngleOptions extends ConstructLook {
  /** A TeX label inside the angle. */
  readonly label?: string;
  /** Arc radius in px. Default 26. */
  readonly radius?: number;
  /** Arcs drawn, for telling equal angles apart. Default 1. */
  readonly count?: number;
  /** A square for a right angle, an arc otherwise. Default: a square within half a degree of 90. */
  readonly mark?: "arc" | "square";
}

export interface TickOptions extends ConstructLook {
  /** Ticks across the segment. Default 1. */
  readonly count?: number;
}

export interface BisectOptions extends ConstructLook {
  /** Draw the compass arcs that find it. Default true. */
  readonly compass?: boolean;
  /** Units the line runs past the points that fix it. Default a fifth of the segment, or of the arm. */
  readonly extend?: number;
  readonly label?: string;
}

export interface SettleOptions extends Partial<Span> {
  /** Overrides the construction's faint opacity. */
  readonly faint?: number;
}

/**
 * The builder, and what it has drawn so far: read `node`, `span`, `bounds` and `parts` after the last element. Its parts
 * are the points, lines and circles in the order they were made, construction aids included; `part(id)` finds the
 * first with that id. `span` runs from the start to when the last element finishes, and `bounds` covers the parts and
 * their labels.
 */
export interface Construction extends Drawn<ConstructPart> {
  /** When the next element starts, in seconds. Use it to time captions and other nodes beside the figure. */
  readonly time: number;
  /** A point at `x`, `y` in units. */
  point(x: number, y: number, label?: string, options?: PointOptions): ConstructPoint;
  /** A segment from `a` to `b`, drawn from `a`. */
  segment(a: ConstructSpot, b: ConstructSpot, options?: SegmentOptions): ConstructLine;
  /** A line through `a` and `b` that runs past both, drawn outward from `a`. */
  line(a: ConstructSpot, b: ConstructSpot, options?: ConstructLineOptions): ConstructLine;
  /** A circle about `center` that passes through a point, or has a radius in units. */
  circle(
    center: ConstructSpot,
    through: ConstructSpot | { readonly radius: number },
    options?: CircleOptions,
  ): ConstructCircle;
  /** Where two lines cross. */
  intersect(a: ConstructLine, b: ConstructLine, options?: IntersectOptions): ConstructPoint;
  /** One crossing of a line or circle with another. */
  intersect(
    a: ConstructCurve,
    b: ConstructCurve,
    options: IntersectOptions & { readonly pick: 0 | 1 },
  ): ConstructPoint;
  /** Both crossings of a line or circle with another. */
  intersect(
    a: ConstructCurve,
    b: ConstructCurve,
    options?: IntersectOptions,
  ): readonly [ConstructPoint, ConstructPoint];
  midpoint(
    a: ConstructSpot,
    b: ConstructSpot,
    label?: string,
    options?: PointOptions,
  ): ConstructPoint;
  /** The perpendicular bisector of `a` and `b`, found with two compass arcs unless `compass` is false. */
  perpendicularBisector(a: ConstructSpot, b: ConstructSpot, options?: BisectOptions): ConstructLine;
  /** The bisector of the angle at `b` between `a` and `c`, as a ray from `b`. */
  angleBisector(
    a: ConstructSpot,
    b: ConstructSpot,
    c: ConstructSpot,
    options?: BisectOptions,
  ): ConstructLine;
  /** The line through `p` parallel to `line`. */
  parallel(line: ConstructLine, p: ConstructSpot, options?: ConstructLineOptions): ConstructLine;
  /** The line through `p` perpendicular to `line`. */
  perpendicular(
    line: ConstructLine,
    p: ConstructSpot,
    options?: ConstructLineOptions,
  ): ConstructLine;
  polygon(points: readonly ConstructSpot[], options?: ConstructPolygonOptions): void;
  /** Marks the angle at `b` between rays `ba` and `bc`. */
  angle(a: ConstructSpot, b: ConstructSpot, c: ConstructSpot, options?: AngleOptions): void;
  /** Congruence ticks across a segment. */
  tick(segment: ConstructLine, options?: TickOptions): void;
  /** Everything made inside `build` starts together; the next element waits for the slowest. */
  together(build: () => void): void;
  /** Pauses between beats of the proof. Returns when the next beat starts. */
  step(pause?: number): number;
  /** Fades every construction aid so far back to faint. */
  settle(options?: SettleOptions): void;
}

const PACE: ConstructPace = {
  point: 0.3,
  line: 0.7,
  circle: 1,
  angle: 0.5,
  fill: 0.6,
  label: 0.35,
  gap: 0.15,
  step: 0.6,
};

const EPS = 1e-9;
const DOT = 3.6;
const LABEL_GAP = 5;
const DEG = Math.PI / 180;

type Vec = readonly [number, number];

const sub = (a: ConstructSpot, b: ConstructSpot): Vec => [a.x - b.x, a.y - b.y];
const length = (v: Vec): number => Math.hypot(v[0], v[1]);

const unit = (v: Vec): Vec => {
  const n = length(v);

  return n < EPS ? [0, 0] : [v[0] / n, v[1] / n];
};

const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1];
const polar = (angle: number): Vec => [Math.cos(angle), Math.sin(angle)];
const name = (p: ConstructSpot): string => p.label ?? `(${round(p.x)}, ${round(p.y)})`;
const round = (n: number): number => Math.round(n * 100) / 100;
const dist = (a: ConstructSpot, b: ConstructSpot): number => length(sub(a, b));

const same = (a: ConstructSpot, b: ConstructSpot): boolean => dist(a, b) < 1e-7;

/** A direction, widest-gap first, away from every ray. `away` breaks ties between equally wide gaps. */
const clearestDirection = (rays: readonly Vec[], away: Vec): Vec => {
  if (rays.length === 0) return length(away) > EPS ? unit(away) : [0, 1];
  const angles = rays.map(([x, y]) => Math.atan2(y, x)).sort((a, b) => a - b);

  const candidates = angles.map((from, i) => {
    const to = i + 1 < angles.length ? angles[i + 1]! : angles[0]! + 2 * Math.PI;
    const gap = to - from;
    const direction = polar(from + gap / 2);

    return { direction, score: Math.min(gap, Math.PI) + 0.8 * dot(direction, unit(away)) };
  });

  return candidates.reduce((best, c) => (c.score > best.score ? c : best)).direction;
};

const at = (x: number, y: number): ConstructSpot => ({ kind: "point", x, y });

const crossLines = (a: RuledLine, b: RuledLine): ConstructSpot[] => {
  const [d, e] = [sub(a.b, a.a), sub(b.b, b.a)];
  const cross = d[0] * e[1] - d[1] * e[0];

  if (Math.abs(cross) < EPS * length(d) * length(e)) return [];
  const [w0, w1] = sub(b.a, a.a);
  const t = (w0 * e[1] - w1 * e[0]) / cross;

  return [at(a.a.x + t * d[0], a.a.y + t * d[1])];
};

const crossCircles = (a: CompassCircle, b: CompassCircle): ConstructSpot[] => {
  const [u, d] = [unit(sub(b.center, a.center)), dist(a.center, b.center)];

  if (d < EPS) return [];
  const along = (d * d + a.radius ** 2 - b.radius ** 2) / (2 * d);
  const h2 = a.radius ** 2 - along ** 2;

  if (h2 < -1e-9 * a.radius ** 2) return [];
  const h = Math.sqrt(Math.max(0, h2));
  const [cx, cy] = [a.center.x + along * u[0], a.center.y + along * u[1]];

  return [at(cx - h * u[1], cy + h * u[0]), at(cx + h * u[1], cy - h * u[0])];
};

const crossLineCircle = (line: RuledLine, circle: CompassCircle): ConstructSpot[] => {
  const u = unit(sub(line.b, line.a));
  const w = sub(line.a, circle.center);
  const half = dot(w, u);
  const disc = half * half - (dot(w, w) - circle.radius ** 2);

  if (disc < -1e-9 * circle.radius ** 2) return [];
  const root = Math.sqrt(Math.max(0, disc));

  return [-half - root, -half + root].map((t) => at(line.a.x + t * u[0], line.a.y + t * u[1]));
};

const intersections = (a: Figure, b: Figure): ConstructSpot[] => {
  if (a.kind === "line") return b.kind === "line" ? crossLines(a, b) : crossLineCircle(a, b);

  return b.kind === "line" ? crossLineCircle(b, a) : crossCircles(a, b);
};

const withinSegment = (line: RuledLine, p: ConstructSpot): boolean => {
  const [d, w] = [sub(line.b, line.a), sub(p, line.a)];
  const t = dot(w, d) / dot(d, d);

  return line.endless || (t > -1e-7 && t < 1 + 1e-7);
};

const onLine = (line: RuledLine, p: ConstructSpot): boolean => {
  const u = unit(sub(line.b, line.a));
  const w = sub(p, line.a);

  return Math.abs(w[0] * u[1] - w[1] * u[0]) < 1e-6 * Math.max(1, length(w));
};

const onCircle = (circle: CompassCircle, p: ConstructSpot): boolean =>
  Math.abs(dist(p, circle.center) - circle.radius) < 1e-6 * Math.max(1, circle.radius);

/** A drawn thing, rendered once every other thing is known so labels can steer clear of them. */
interface Spot {
  readonly x: number;
  readonly y: number;
}

interface Slot {
  readonly at: number;
  readonly over: number;
}

interface Piece {
  readonly aid: boolean;
  settle?: { at: number; over: number; faint: number };
  render(world: World): SvgNode;
}

interface World {
  readonly points: readonly ConstructSpot[];
  readonly lines: readonly RuledLine[];
  readonly circles: readonly CompassCircle[];
  readonly polygons: readonly (readonly ConstructSpot[])[];
  /** Units to scene px. */
  readonly px: (p: { x: number; y: number }) => { x: number; y: number };
  /** The middle of the figure, in units. */
  readonly center: Vec;
}

/** The directions in which drawn lines, circles and polygon edges leave `p`. */
const raysAt = (world: World, p: ConstructSpot): Vec[] => {
  const rays: Vec[] = [];

  for (const line of world.lines) {
    if (!onLine(line, p)) continue;
    const u = unit(sub(line.b, line.a));
    const t = dot(sub(p, line.a), u);
    const span = dist(line.a, line.b);
    const [low, high] = [-line.extend[0], span + line.extend[1]];

    if (t < high - 1e-7) rays.push(u);

    if (t > low + 1e-7) rays.push([-u[0], -u[1]]);
  }

  for (const circle of world.circles) {
    if (!onCircle(circle, p)) continue;
    const radial = unit(sub(p, circle.center));

    rays.push([-radial[1], radial[0]], [radial[1], -radial[0]]);
  }

  for (const polygon of world.polygons) {
    const i = polygon.findIndex((q) => same(q, p));

    if (i < 0) continue;

    for (const q of [polygon[(i + 1) % polygon.length]!, polygon.at(i - 1)!])
      rays.push(unit(sub(q, p)));
  }

  return rays;
};

/** The box around scene points. */
const around = (points: readonly { x: number; y: number }[]): Rect => {
  const [xs, ys] = [points.map((p) => p.x), points.map((p) => p.y)];
  const [left, top] = [Math.min(...xs), Math.min(...ys)];

  return rect(left, top, Math.max(...xs) - left, Math.max(...ys) - top);
};

/** Pushes a label's center out of `from` along `direction` until its box clears the point by a gap. */
const stand = (
  from: Spot,
  direction: Vec,
  box: { w: number; h: number },
  clearance: number,
): Spot => {
  const reach =
    clearance + Math.abs(direction[0]) * (box.w / 2) + Math.abs(direction[1]) * (box.h / 2);

  // Scene y points down, construction y points up.
  return { x: from.x + direction[0] * reach, y: from.y - direction[1] * reach };
};

/**
 * Compass-and-straightedge geometry that draws itself in the order you write it. Build points, lines and circles on
 * the builder, read the crossings back as points, then render `g.node`. Labels are `tex()` formulas the builder
 * places away from the lines that meet at their point. Construction y grows up.
 */
export function construct(options: ConstructOptions = {}): Construction {
  const { theme = defaultDark, unit: scale = 1, origin = { x: 0, y: 0 }, fontSize = 20 } = options;

  const faint = options.faint ?? 0.22;
  const pace: ConstructPace = { ...PACE, ...options.pace };

  if (!(scale > 0) || !Number.isFinite(origin.x + origin.y) || !(fontSize > 0))
    throw new Error(
      `construct() needs a positive unit and fontSize and a finite origin, got unit ${scale}, fontSize ${fontSize} and origin ${origin.x}, ${origin.y}.`,
    );

  const palette = {
    ink: theme.base05,
    aid: theme.base04,
    angle: theme.base0A,
    fill: theme.base0D,
    point: theme.base06,
  };

  const pieces: Piece[] = [];
  const points: ConstructSpot[] = [];
  const lines: RuledLine[] = [];
  const circles: CompassCircle[] = [];
  const polygons: (readonly ConstructSpot[])[] = [];
  let cursor = options.start ?? 0;
  const firstAt = cursor;
  let end = cursor;
  let batch: { start: number; end: number } | undefined;
  /** Every point, line and circle drawn, in order, as parts. */
  const made: ConstructPart[] = [];
  /** Every label's size and where it lands, for `bounds`. */
  const labels: { w: number; h: number; place: (world: World) => { x: number; y: number } }[] = [];

  const px = (p: { x: number; y: number }) => ({
    x: origin.x + p.x * scale,
    y: origin.y - p.y * scale,
  });

  /** Where an element starts and how long it runs. The cursor moves on unless a `together` block holds it. */
  const slot = (kind: keyof ConstructPace, timing: Partial<Span>): Slot => {
    const at = timing.at ?? batch?.start ?? cursor;
    const over = timing.over ?? pace[kind];

    if (!(at >= 0 && over >= 0) || !Number.isFinite(at + over))
      throw new Error(
        `An element needs a finite start of 0 or more and a duration of 0 or more, got at ${timing.at} and over ${timing.over}.`,
      );
    end = Math.max(end, at + over);

    if (batch) batch.end = Math.max(batch.end, at + over);
    else cursor = at + over + pace.gap;

    return { at, over };
  };

  const add = (aid: boolean | undefined, render: Piece["render"]): void => {
    pieces.push({ aid: aid === true, render });
  };

  const colorOf = (look: ConstructLook, main: Color): Color =>
    look.color ?? (look.aid ? palette.aid : main);

  /** A stroke drawn on from nothing. It stays invisible until its turn, because a round cap shows a dot at zero length. */
  const drawOn = (span: { at: number; over: number }, curve?: typeof ease.out) =>
    motion({ draw: 0, opacity: 0 }).set({ opacity: 1 }, span.at).to({ draw: 1 }, span, curve);

  const label = (
    source: string | undefined,
    span: { at: number; over: number },
    look: ConstructLook,
    place: (world: World, box: { w: number; h: number }) => { x: number; y: number },
    main: Color = palette.ink,
  ): number | undefined => {
    if (source === undefined) return undefined;

    const formula = tex(source, {
      theme,
      fontSize,
      color: look.color ?? (look.aid ? palette.aid : main),
      anchor: [0.5, 0.5],
      display: false,
    });

    add(look.aid, (world) => {
      const { x, y } = place(world, { w: formula.width, h: formula.height });

      return (
        <g transform={`translate(${round(x)} ${round(y)})`}>
          <g
            animation={motion({ opacity: 0 }).to(
              { opacity: 1 },
              spanOf(span.at + span.over * 0.5, pace.label),
            )}
          >
            {formula.node}
          </g>
        </g>
      );
    });
    const box = { w: formula.width, h: formula.height };
    labels.push({ ...box, place: (world) => place(world, box) });
    end = Math.max(end, span.at + span.over * 0.5 + pace.label);

    return span.at + span.over * 0.5 + pace.label;
  };

  /** From the element's slot until its label, if any, has faded in. */
  const until = (span: Slot, labelled: number | undefined): Spanned =>
    spanOf(span.at, Math.max(span.at + span.over, labelled ?? 0) - span.at);

  const awayFrom = (world: World, p: { x: number; y: number }): Vec => [
    p.x - world.center[0],
    p.y - world.center[1],
  ];

  const addPoint = (
    p: ConstructSpot,
    label_: string | undefined,
    o: PointOptions,
  ): ConstructPoint => {
    const span = slot("point", o);
    const color = colorOf(o, palette.point);

    points.push(p);

    if (o.dot !== false)
      add(o.aid, (world) => {
        const c = world.px(p);

        return (
          <g transform={`translate(${round(c.x)} ${round(c.y)})`}>
            <circle
              r={DOT}
              fill={color}
              animation={motion({ opacity: 0, scale: 0.2 }).to(
                { opacity: 1, scale: 1 },
                span,
                ease.pop,
              )}
            />
          </g>
        );
      });

    const labelled = label(label_, span, o, (world, box) => {
      const direction = clearestDirection(raysAt(world, p), awayFrom(world, p));

      return stand(world.px(p), direction, box, DOT + LABEL_GAP);
    });

    const c = px(p);

    const part: ConstructPoint = {
      ...p,
      id: name(p),
      box: o.dot === false ? rect(c.x, c.y, 0, 0) : rect(c.x - DOT, c.y - DOT, 2 * DOT, 2 * DOT),
      span: until(span, labelled),
    };

    made.push(part);

    return part;
  };

  const cross = (a: Figure, b: Figure, o: IntersectOptions = {}): ConstructPoint[] => {
    const found = intersections(a, b);

    const describe = (s: Figure): string =>
      s.kind === "line" ? `line ${name(s.a)}${name(s.b)}` : `circle about ${name(s.center)}`;

    if (found.length === 0)
      throw new Error(
        `intersect() found no crossing of ${describe(a)} and ${describe(b)}. Raise a radius, move a center, or use lines that are not parallel.`,
      );

    if (o.pick !== undefined && o.pick !== 0 && o.pick !== 1)
      throw new Error(`intersect() pick is 0 or 1, got ${o.pick}.`);

    // Only the crossings that are kept have to lie on their segments, so pick can choose the one that does.
    const checked = o.pick === undefined || found.length === 1 ? found : [found[o.pick]!];

    for (const s of [a, b])
      for (const p of checked)
        if (s.kind === "line" && !withinSegment(s, p))
          throw new Error(
            `intersect() crossing (${round(p.x)}, ${round(p.y)}) lies past the end of segment ${name(s.a)}${name(s.b)}. Draw it with g.line() so it runs on, or use g.line(…, { extend }).`,
          );

    const keep = (p: ConstructSpot, label_: string | undefined): ConstructPoint =>
      addPoint(label_ === undefined ? p : { ...p, label: label_ }, label_, o);

    if (found.length === 1) return [keep(found[0]!, o.label ?? o.labels?.[0])];

    if (o.pick !== undefined) {
      return [keep(found[o.pick]!, o.label ?? o.labels?.[o.pick])];
    }

    return [keep(found[0]!, o.labels?.[0]), keep(found[1]!, o.labels?.[1])];
  };

  const intersect = (
    a: Figure,
    b: Figure,
    o: IntersectOptions = {},
  ): ConstructPoint | readonly [ConstructPoint, ConstructPoint] => {
    const kept = cross(a, b, o);

    return kept.length === 1 ? kept[0]! : [kept[0]!, kept[1]!];
  };

  const addLine = (
    a: ConstructSpot,
    b: ConstructSpot,
    endless: boolean,
    extend: readonly [number, number],
    o: ConstructLineOptions,
  ): ConstructLine => {
    if (same(a, b)) throw new Error(`A line needs two different points, got ${name(a)} twice.`);
    const span = slot("line", o);
    const color = colorOf(o, palette.ink);
    const u = unit(sub(b, a));

    const ends = [
      px({ x: a.x - u[0] * extend[0], y: a.y - u[1] * extend[0] }),
      px({ x: b.x + u[0] * extend[1], y: b.y + u[1] * extend[1] }),
    ];

    add(o.aid, (world) => {
      const u = unit(sub(b, a));
      const len = dist(a, b);
      const reach = (t: number) => world.px({ x: a.x + u[0] * t, y: a.y + u[1] * t });

      const stroke = (from: number, to: number) => {
        const [p, q] = [reach(from), reach(to)];

        return (
          <path
            d={`M${round(p.x)} ${round(p.y)}L${round(q.x)} ${round(q.y)}`}
            fill="none"
            stroke={color}
            strokeWidth={o.aid ? 1.2 : 1.8}
            strokeLinecap="round"
            animation={drawOn(span)}
          />
        );
      };

      // Runs outward from `a` both ways when the line runs past it, so it grows from the first point.
      return (
        <g>
          {stroke(0, len + extend[1])}
          {extend[0] > 0 && stroke(0, -extend[0])}
        </g>
      );
    });

    const labelled = label(o.label, span, o, (world, box) => {
      const mid = { kind: "point" as const, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const n = unit([-(b.y - a.y), b.x - a.x]);
      const side: Vec = dot(n, awayFrom(world, mid)) >= 0 ? n : [-n[0], -n[1]];

      return stand(world.px(mid), side, box, LABEL_GAP);
    });

    const line: ConstructLine = {
      kind: "line",
      a,
      b,
      endless,
      extend,
      id: o.label ?? `${name(a)}${name(b)}`,
      box: around(ends),
      span: until(span, labelled),
    };

    lines.push(line);
    made.push(line);

    return line;
  };

  const extension = (o: ConstructLineOptions, fallback: number): readonly [number, number] => [
    o.extend ?? fallback,
    o.extend ?? fallback,
  ];

  const circle = (
    center: ConstructSpot,
    through: ConstructSpot | { readonly radius: number },
    o: CircleOptions = {},
  ): ConstructCircle => {
    const radius = "radius" in through ? through.radius : dist(center, through);

    if (!(radius > 0) || !Number.isFinite(radius))
      throw new Error(
        `circle() needs a positive radius, got ${radius}. Pass a point other than the center, or a radius above 0.`,
      );
    const span = slot("circle", o);
    const [from, to] = o.arc ? [o.arc.from * DEG, o.arc.to * DEG] : [0, 2 * Math.PI];

    const ring: ConstructCircle = {
      kind: "circle",
      center,
      radius,
      id: `circle ${name(center)}`,
      box: around(
        Array.from({ length: 49 }, (_, i) => {
          const angle = from + ((to - from) * i) / 48;

          return px({
            x: center.x + radius * Math.cos(angle),
            y: center.y + radius * Math.sin(angle),
          });
        }),
      ),
      span: spanOf(span.at, span.over),
    };

    const color = colorOf(o, palette.ink);

    const start = "radius" in through ? 0 : Math.atan2(through.y - center.y, through.x - center.x);

    circles.push(ring);
    made.push(ring);
    add(o.aid, (world) => {
      const r = radius * scale;
      const c = world.px(center);

      const spot = (angle: number) =>
        `${round(c.x + r * Math.cos(angle))} ${round(c.y - r * Math.sin(angle))}`;

      const arc = (to: number, big: boolean) =>
        `A${round(r)} ${round(r)} 0 ${big ? 1 : 0} 0 ${spot(to)}`;

      const d = o.arc
        ? `M${spot(o.arc.from * DEG)}${arc(o.arc.to * DEG, (o.arc.to - o.arc.from) % 360 > 180)}`
        : `M${spot(start)}${arc(start + Math.PI, false)}${arc(start + 2 * Math.PI, false)}`;

      return (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={o.aid ? 1.2 : 1.8}
          strokeLinecap="round"
          animation={drawOn(span, ease.inOut)}
        />
      );
    });

    return ring;
  };

  const point = (x: number, y: number, label_?: string, o: PointOptions = {}): ConstructPoint => {
    if (!Number.isFinite(x + y))
      throw new Error(`point() needs finite coordinates, got ${x}, ${y}.`);

    return addPoint(
      label_ === undefined ? { kind: "point", x, y } : { kind: "point", x, y, label: label_ },
      label_,
      o,
    );
  };

  const together = (build: () => void): void => {
    if (batch) throw new Error("together() cannot nest. Put the elements in one together() block.");
    batch = { start: cursor, end: cursor };

    try {
      build();
      cursor = batch.end + pace.gap;
    } finally {
      batch = undefined;
    }
  };

  /** Aims the composite constructions at `o.at` and drops the timing that belongs to their last element. */
  const begin = (o: Partial<Span>): void => {
    if (o.at !== undefined && !batch) cursor = o.at;
  };

  const finishing = (o: BisectOptions): ConstructLineOptions => ({
    color: o.color,
    over: o.over,
    label: o.label,
    aid: false,
  });

  const perpendicularBisector = (
    a: ConstructSpot,
    b: ConstructSpot,
    o: BisectOptions = {},
  ): ConstructLine => {
    if (same(a, b))
      throw new Error(`perpendicularBisector() needs two different points, got ${name(a)} twice.`);
    begin(o);
    const len = dist(a, b);
    const ext = o.extend ?? len * 0.2;

    if (o.compass === false) {
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const n = unit([-(b.y - a.y), b.x - a.x]);

      const [p, q]: ConstructSpot[] = [-1, 1].map((s): ConstructSpot => ({
        kind: "point",
        x: m.x + s * n[0] * len * 0.5,
        y: m.y + s * n[1] * len * 0.5,
      }));

      return addLine(p!, q!, true, [ext, ext], finishing(o));
    }

    const toward = Math.atan2(b.y - a.y, b.x - a.x) / DEG;
    let arcs: CompassCircle[] = [];

    together(() => {
      arcs = [
        circle(a, b, { aid: true, arc: { from: toward - 78, to: toward + 78 } }),
        circle(b, a, { aid: true, arc: { from: toward + 102, to: toward + 258 } }),
      ];
    });
    const [p, q] = cross(arcs[0]!, arcs[1]!, { aid: true });

    return addLine(p!, q!, true, [ext, ext], finishing(o));
  };

  const angleBisector = (
    a: ConstructSpot,
    b: ConstructSpot,
    c: ConstructSpot,
    o: BisectOptions = {},
  ): ConstructLine => {
    if (same(a, b) || same(b, c))
      throw new Error(
        `angleBisector() needs the vertex in the middle and two other points, got ${name(a)}, ${name(b)} and ${name(c)}.`,
      );
    begin(o);
    const [ua, uc] = [unit(sub(a, b)), unit(sub(c, b))];
    const arm = Math.min(dist(a, b), dist(c, b)) * 0.55;
    const middle = unit([ua[0] + uc[0], ua[1] + uc[1]]);

    if (length(middle) < EPS || o.compass === false) {
      const tip: ConstructSpot = {
        kind: "point",
        x: b.x + (middle[0] || -ua[1]) * arm,
        y: b.y + (middle[1] || ua[0]) * arm,
      };

      return addLine(b, tip, true, [0, o.extend ?? arm], finishing(o));
    }

    const [p, q]: ConstructSpot[] = [ua, uc].map((u): ConstructSpot => ({
      kind: "point",
      x: b.x + u[0] * arm,
      y: b.y + u[1] * arm,
    }));

    const [angleA, angleC] = [Math.atan2(ua[1], ua[0]), Math.atan2(uc[1], uc[0])];
    const turn = Math.atan2(ua[0] * uc[1] - ua[1] * uc[0], dot(ua, uc));
    const from = (turn > 0 ? angleA : angleC) / DEG - 10;
    const sweep = Math.abs(turn) / DEG + 20;

    const cuts = intersections(
      { kind: "circle", center: p!, radius: dist(p!, q!) },
      { kind: "circle", center: q!, radius: dist(p!, q!) },
    );

    const far = dist(cuts[0]!, b) > dist(cuts[1]!, b) ? 0 : 1;

    const heading = (from_: ConstructSpot, to: ConstructSpot) =>
      Math.atan2(to.y - from_.y, to.x - from_.x) / DEG;

    let arcs: CompassCircle[] = [];

    circle(b, p!, { aid: true, arc: { from, to: from + sweep } });
    together(() => {
      const [hp, hq] = [heading(p!, cuts[far]!), heading(q!, cuts[far]!)];

      arcs = [
        circle(p!, q!, { aid: true, arc: { from: hp - 28, to: hp + 28 } }),
        circle(q!, p!, { aid: true, arc: { from: hq - 28, to: hq + 28 } }),
      ];
    });
    const [d] = cross(arcs[0]!, arcs[1]!, { aid: true, pick: far });

    return addLine(b, d!, true, [0, o.extend ?? dist(b, d!) * 0.7], finishing(o));
  };

  const through = (
    line: RuledLine,
    p: ConstructSpot,
    direction: Vec,
    o: ConstructLineOptions,
  ): ConstructLine => {
    const len = dist(line.a, line.b);

    const q: ConstructSpot = {
      kind: "point",
      x: p.x + direction[0] * len,
      y: p.y + direction[1] * len,
    };

    return addLine(p, q, true, extension(o, len * 0.3), o);
  };

  const polygon = (corners: readonly ConstructSpot[], o: ConstructPolygonOptions = {}): void => {
    if (corners.length < 3)
      throw new Error(`polygon() needs at least three points, got ${corners.length}.`);
    const span = slot("fill", o);
    const color = o.color ?? palette.fill;

    polygons.push(corners);
    add(o.aid, (world) => {
      const d = `${corners
        .map((p, i) => `${i ? "L" : "M"}${round(world.px(p).x)} ${round(world.px(p).y)}`)
        .join("")}Z`;

      return (
        <g>
          <path
            d={d}
            fill={color}
            fillOpacity={o.opacity ?? 0.2}
            animation={motion({ opacity: 0 }).to({ opacity: 1 }, span)}
          />
          {o.outline && (
            <path
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={1.8}
              strokeLinejoin="round"
              animation={drawOn(span)}
            />
          )}
        </g>
      );
    });

    const middle: ConstructSpot = {
      kind: "point",
      x: corners.reduce((s, p) => s + p.x, 0) / corners.length,
      y: corners.reduce((s, p) => s + p.y, 0) / corners.length,
    };

    label(o.label, span, o, (world) => world.px(middle), color);
  };

  const angle = (
    a: ConstructSpot,
    b: ConstructSpot,
    c: ConstructSpot,
    o: AngleOptions = {},
  ): void => {
    if (same(a, b) || same(b, c))
      throw new Error(
        `angle() needs the vertex in the middle and two other points, got ${name(a)}, ${name(b)} and ${name(c)}.`,
      );
    const [ua, uc] = [unit(sub(a, b)), unit(sub(c, b))];
    const turn = Math.atan2(ua[0] * uc[1] - ua[1] * uc[0], dot(ua, uc));

    const square =
      (o.mark ?? (Math.abs(Math.abs(turn) - Math.PI / 2) < 0.5 * DEG ? "square" : "arc")) ===
      "square";

    const [radius, count] = [o.radius ?? 26, o.count ?? 1];

    if (!(radius > 0) || !(count >= 1))
      throw new Error(
        `angle() needs a positive radius and a count of 1 or more, got ${radius} and ${count}.`,
      );
    const span = slot("angle", o);
    const color = colorOf(o, palette.angle);
    const inner = square ? radius * 0.55 : radius;
    const outer = square ? inner : radius + (count - 1) * 4.5;

    add(o.aid, (world) => {
      const v = world.px(b);
      const at = (u: Vec, r: number) => `${round(v.x + u[0] * r)} ${round(v.y - u[1] * r)}`;

      const d = square
        ? `M${at(ua, inner)}L${at([ua[0] + uc[0], ua[1] + uc[1]], inner)}L${at(uc, inner)}`
        : Array.from({ length: count }, (_, i) => {
            const r = radius + i * 4.5;

            return `M${at(ua, r)}A${r} ${r} 0 0 ${turn > 0 ? 0 : 1} ${at(uc, r)}`;
          }).join("");

      return (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          animation={drawOn(span)}
        />
      );
    });
    label(
      o.label,
      span,
      o,
      (world, box) => {
        const middle = unit([ua[0] + uc[0], ua[1] + uc[1]]);
        const direction: Vec = length(middle) < EPS ? [-ua[1], ua[0]] : middle;

        return stand(world.px(b), direction, box, (square ? outer * 1.4 : outer) + LABEL_GAP);
      },
      color,
    );
  };

  const tick = (segment: RuledLine, o: TickOptions = {}): void => {
    const count = o.count ?? 1;

    if (!(count >= 1)) throw new Error(`tick() needs a count of 1 or more, got ${count}.`);
    const span = slot("point", o);
    const color = colorOf(o, palette.ink);

    add(o.aid, (world) => {
      const [p, q] = [world.px(segment.a), world.px(segment.b)];
      const along = unit([q.x - p.x, q.y - p.y]);
      const across: Vec = [-along[1], along[0]];
      const middle = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };

      const d = Array.from({ length: count }, (_, i) => {
        const shift = (i - (count - 1) / 2) * 5;
        const [cx, cy] = [middle.x + along[0] * shift, middle.y + along[1] * shift];

        return `M${round(cx - across[0] * 5)} ${round(cy - across[1] * 5)}L${round(cx + across[0] * 5)} ${round(cy + across[1] * 5)}`;
      }).join("");

      return (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          animation={motion({ opacity: 0 }).to({ opacity: 1 }, span)}
        />
      );
    });
  };

  const settle = (o: SettleOptions = {}): void => {
    const at = o.at ?? batch?.start ?? cursor;
    const over = o.over ?? 0.8;

    for (const piece of pieces)
      if (piece.aid && !piece.settle) piece.settle = { at, over, faint: o.faint ?? faint };
    end = Math.max(end, at + over);

    if (!batch) cursor = at + over + pace.gap;
  };

  const world = (): World => {
    const anchors = points;

    return {
      points,
      lines,
      circles,
      polygons,
      px,
      center: anchors.length
        ? [
            anchors.reduce((s, p) => s + p.x, 0) / anchors.length,
            anchors.reduce((s, p) => s + p.y, 0) / anchors.length,
          ]
        : [0, 0],
    };
  };

  const render = (): SvgNode => {
    const w = world();

    return (
      <g>
        {pieces.map((piece) => {
          const drawn = piece.render(w);

          return piece.settle ? (
            <g
              animation={motion({ opacity: 1 }).to(
                { opacity: piece.settle.faint },
                spanOf(piece.settle.at, piece.settle.over),
              )}
            >
              {drawn}
            </g>
          ) : (
            drawn
          );
        })}
      </g>
    );
  };

  return {
    get node() {
      return render();
    },
    get time() {
      return cursor;
    },
    get span() {
      return spanOf(firstAt, end - firstAt);
    },
    get bounds() {
      const w = world();

      const boxes = [
        ...made.map((p) => p.box),
        ...labels.map((l) => {
          const { x, y } = l.place(w);

          return rect(x - l.w / 2, y - l.h / 2, l.w, l.h);
        }),
      ];

      return boxes.length === 0
        ? rect(origin.x, origin.y, 0, 0)
        : boxes.reduce((a, b) => a.union(b));
    },
    get parts() {
      return [...made];
    },
    part(id) {
      const found = made.find((p) => p.id === id);

      if (!found)
        throw new Error(
          `construct() has no ${JSON.stringify(id)}. Its parts are ${made
            .slice(0, 6)
            .map((p) => JSON.stringify(p.id))
            .join(", ")}${made.length > 6 ? ", …" : ""}.`,
        );

      return found;
    },
    point,
    segment: (a, b, o = {}) => addLine(a, b, false, [0, 0], o),
    line: (a, b, o = {}) => addLine(a, b, true, extension(o, dist(a, b) * 0.25), o),
    circle,
    // SAFETY: intersect keeps one point for a line pair or a pick and both otherwise, which are the cases its overloads promise.
    intersect: intersect as Construction["intersect"],
    midpoint: (a, b, label_, o) => point((a.x + b.x) / 2, (a.y + b.y) / 2, label_, o),
    perpendicularBisector,
    angleBisector,
    parallel: (line, p, o = {}) => through(line, p, unit(sub(line.b, line.a)), o),
    perpendicular: (line, p, o = {}) => {
      const d = unit(sub(line.b, line.a));

      return through(line, p, [-d[1], d[0]], o);
    },
    polygon,
    angle,
    tick,
    together,
    step: (pause = pace.step) => {
      cursor += pause;

      return cursor;
    },
    settle,
  };
}
