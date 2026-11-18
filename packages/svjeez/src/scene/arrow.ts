import { EPSILON, type Seconds } from "../time";
import type { Animated, Geometry, Key, Lane, Layer, ShapeNode, Vec } from "./ir";
import { atRest, isLane } from "./lane";
import type { Common, SceneElement, StrokeProps } from "./nodes";
import type { Anchor } from "./refs";
import { blendVec, breaksOf, follow, laneFrom, unrolled, valueAt } from "./sample";
import { ease } from "./spring";
import type { Connect } from "./settle";
import type { Anim } from "./track";
import { lookOf, paintedBoxOf } from "./painted";

/**
 * An arrow, or a plain line, between two points, each a point in the arrow's frame or an anchor on a node. It
 * lowers to shapes. The shaft starts at `from` and is turned to point at `to`, so an end that follows a moving
 * node moves and turns it; a straight shaft that also stretches is drawn at its longest and trimmed to length, so
 * only a bent one that stretches needs its geometry to move.
 */
export interface ArrowProps extends Omit<Common, "at" | "anchor" | "origin" | "rotate" | "scale"> {
  readonly from: Vec | Anchor;
  readonly to: Vec | Anchor;
  /** As a shape's stroke, with a width of 1.5 and round caps and joins unless you say. */
  readonly stroke: StrokeProps;
  /** How far the middle bows out sideways, as a share of the length: positive bows to the right of the way it goes. Default 0. */
  readonly bend?: number;
  /** Room left free at each end, so the arrow stops short of what it joins. Default 0. */
  readonly inset?: number;
  /** The part of the line that is drawn, as two fractions of its length. The head rides the drawn end. */
  readonly trim?: Anim<Vec>;
  /** How long the head's two strokes are, in px, or `"none"` for a plain line. Default 8. */
  readonly head?: number | "none";
}

/** The head's strokes open this far either side of the shaft, in radians: the look of the annotations' Arrow. */
const SPREAD = 0.45;

const DEG = 180 / Math.PI;

const turn = ([x, y]: Vec, degrees: number): Vec => {
  const a = degrees / DEG;

  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
};

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];

/** A bent shaft of length 1 from the origin along x: a quadratic through the bow, written as a cubic. */
const bow = (bend: number): readonly [Vec, Vec, Vec, Vec] => {
  const control: Vec = [0.5, bend];

  return [
    [0, 0],
    [control[0] * (2 / 3), control[1] * (2 / 3)],
    [1 + (control[0] - 1) * (2 / 3), control[1] * (2 / 3)],
    [1, 0],
  ];
};

const cubicAt = (p: readonly [Vec, Vec, Vec, Vec], u: number): Vec => {
  const s = 1 - u;
  const [a, b, c, d] = [s * s * s, 3 * s * s * u, 3 * s * u * u, u * u * u];

  return [
    a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0],
    a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1],
  ];
};

const SEGMENTS = 64;

/**
 * Where a fraction of a shaft's length lies on it and which way it heads there, for a shaft of length 1. Bending
 * scales with length, so this holds at any length.
 */
const along = (
  bend: number,
): ((fraction: number) => { readonly at: Vec; readonly heading: number }) => {
  if (bend === 0) return (fraction) => ({ at: [fraction, 0], heading: 0 });
  const curve = bow(bend);
  const points = Array.from({ length: SEGMENTS + 1 }, (_, i) => cubicAt(curve, i / SEGMENTS));
  const lengths = [0];

  for (let i = 1; i <= SEGMENTS; i++)
    lengths.push(
      lengths[i - 1]! +
        Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]),
    );
  const total = lengths.at(-1)!;

  return (fraction) => {
    const goal = Math.min(1, Math.max(0, fraction)) * total;

    const i = Math.max(
      1,
      lengths.findIndex((length) => length >= goal - EPSILON),
    );

    const [a, b] = [points[i - 1]!, points[i]!];
    const share = (goal - lengths[i - 1]!) / Math.max(EPSILON, lengths[i]! - lengths[i - 1]!);

    return {
      at: [a[0] + (b[0] - a[0]) * share, a[1] + (b[1] - a[1]) * share],
      heading: Math.atan2(b[1] - a[1], b[0] - a[0]) * DEG,
    };
  };
};

/** The shaft at `length`, from `start` and turned by `angle`: in the frame it is drawn in. */
const shaftOf = (bend: number, length: number, start: Vec, angle: number): Geometry => {
  const place = ([x, y]: Vec): Vec => add(start, turn([x * length, y * length], angle));

  if (bend === 0) return { kind: "line", from: place([0, 0]), to: place([1, 0]) };
  const [p0, c1, c2, p3] = bow(bend);

  return {
    kind: "path",
    contours: [{ start: place(p0), curves: [[place(c1), place(c2), place(p3)]], closed: false }],
    rule: "nonzero",
  };
};

/** The head's two strokes, its tip at `tip`, pointing `angle` degrees. */
const headOf = (size: number, tip: Vec, angle: number): Geometry => {
  const barb = (side: number): Vec =>
    add(tip, turn([-size * Math.cos(SPREAD), side * size * Math.sin(SPREAD)], angle));

  return { kind: "polygon", points: [barb(-1), tip, barb(1)], closed: false };
};

const isOpen = (trim: Vec): boolean => trim[1] - trim[0] > EPSILON;

/** 1 while any of the line is drawn, else 0, cut where the trim leaves or reaches nothing. */
const shownBy = (trim: Animated<Vec>, duration: Seconds): Animated<number> => {
  if (!isLane(trim)) return isOpen(trim) ? 1 : 0;
  const keys = unrolled(trim, duration);
  const out: Key<number>[] = [];

  keys.forEach((key, i) => {
    const next = keys[i + 1];
    const value = isOpen(key.value) || (next !== undefined && isOpen(next.value)) ? 1 : 0;
    const last = out.at(-1);

    if (!last)
      out.push({ t: 0, value: key.t > EPSILON ? (isOpen(keys[0]!.value) ? 1 : 0) : value });

    if (out.at(-1)!.value === value) return;

    if (key.t <= out.at(-1)!.t + EPSILON) out[out.length - 1] = { ...out.at(-1)!, value };
    else out.push({ t: key.t, value, ease: ease.hold });
  });

  const [first, second, ...rest] = out;

  if (!second) return first!.value;
  const lane: Lane<number> = { kind: "lane", keys: [first!, second, ...rest] };

  return lane;
};

/**
 * The moment whose pose a connector shows at `t`: `t` itself while any of it is drawn, else the next moment it is,
 * or the last when it never is again. A hidden connector holds still, so nothing is written for a pose no one sees.
 */
const seenBy = (shown: Animated<number>, duration: Seconds): ((t: Seconds) => Seconds) => {
  if (!isLane(shown)) return (t) => t;
  const keys = unrolled(shown, duration);

  /** Where each stretch of time in which the connector shows starts and ends. */
  const windows = keys.flatMap((key, i): (readonly [Seconds, Seconds])[] =>
    key.value > 0.5 ? [[i === 0 ? 0 : key.t, keys[i + 1]?.t ?? duration]] : [],
  );

  if (windows.length === 0) return (t) => t;

  return (t) => {
    if (windows.some(([start, end]) => t >= start - EPSILON && t <= end + EPSILON)) return t;
    const next = windows.find(([start]) => start > t);

    return next ? next[0] : windows.at(-1)![1];
  };
};

/** `value` as the connector shows it: a lane that only moves while the connector is hidden is held still. */
const steadyWhileHidden = (
  value: Animated<Vec>,
  seen: (t: Seconds) => Seconds,
  breaks: readonly Seconds[],
): Animated<Vec> => {
  if (!isLane(value)) return value;

  const held = laneFrom(
    follow((t) => valueAt(value, seen(t), blendVec), breaks, NEAR, [], [value], true),
    ([x, y]): Vec => [x!, y!],
  );

  return isLane(held) ? value : held;
};

const layer = (rotate: Animated<number>, opacity: Animated<number>): Layer[] =>
  !isLane(rotate) && !isLane(opacity) && rotate === 0 && opacity === 1
    ? []
    : [{ offset: [0, 0], rotate, scale: [1, 1], opacity }];

/** How far a followed point may stray, in px, and a followed angle, in degrees. */
const NEAR = 0.05;

const ANGLE = 0.02;

interface Pose {
  readonly start: Vec;
  readonly angle: number;
  readonly length: number;
}

const connect =
  (bend: number, size: number, inset: number): Connect =>
  ([from, to], children, duration) => {
    // SAFETY: a connector's children are the shapes it lowered itself: its shaft, then its head when it has one.
    const [shaft, head] = children as readonly ShapeNode[];
    const trim = shaft!.trim ?? ([0, 1] as const);
    const path = along(bend);

    const pose = (t: Seconds): Pose => {
      const [a, b] = [valueAt(from!, t, blendVec), valueAt(to!, t, blendVec)];
      const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
      const distance = Math.hypot(dx, dy);
      const [ux, uy] = distance > EPSILON ? [dx / distance, dy / distance] : [1, 0];

      return {
        start: [a[0] + ux * inset, a[1] + uy * inset],
        angle: Math.atan2(uy, ux) * DEG,
        length: Math.max(0, distance - inset * 2),
      };
    };

    const tipOf = (t: Seconds): readonly [Vec, number] => {
      const { start, angle, length } = pose(t);
      const end = path(valueAt(trim, t, blendVec)[1]);

      return [
        add(start, turn([end.at[0] * length, end.at[1] * length], angle)),
        angle + end.heading,
      ];
    };

    const shown = shownBy(trim, duration);
    const moving = isLane(from!) || isLane(to!);

    /** A shape of the connector redrawn: turned around the start of the shaft, or its head's tip. */
    const drawn = (
      node: ShapeNode,
      geometry: Animated<Geometry>,
      at: Animated<Vec>,
      layers: Layer[],
      rest: Animated<Vec> | undefined,
    ): ShapeNode => {
      const { trim: _, ...plain } = node;

      return {
        ...plain,
        geometry,
        at,
        box: paintedBoxOf(atRest(geometry), lookOf({ stroke: node.stroke, trim: rest })),
        origin: [0, 0],
        layers,
        ...(rest !== undefined && { trim: rest }),
      };
    };

    if (!moving && !isLane(trim)) {
      const { start, angle, length } = pose(0);
      const [tip, heading] = tipOf(0);
      const shows = isOpen(trim) && length > EPSILON ? 1 : 0;

      return [
        drawn(shaft!, shaftOf(bend, length, start, angle), [0, 0], [], shaft!.trim),
        ...(head
          ? [drawn(head, headOf(size, tip, heading), [0, 0], layer(0, shows), undefined)]
          : []),
      ];
    }

    const ends = [from!, to!, trim];
    const breaks = breaksOf(ends, duration);
    const seen = seenBy(shown, duration);
    const posed = (t: Seconds): Pose => pose(seen(t));

    // The shaft's frame sits on `from` and turns there, so a far end that moves turns it without moving its start:
    // the inset is part of the drawing, and only the angle and the length are lanes, each of one number.
    const at = steadyWhileHidden(from!, seen, breaks);

    const stretch = follow((t) => [posed(t).length], breaks, NEAR, [], ends);
    const longest = Math.max(EPSILON, ...stretch.map((key) => key.values[0]!));
    const fixed = laneFrom(stretch, ([value]) => value!);

    // An angle is as close as the far end of the arrow needs: within NEAR there, and never looser than ANGLE.
    const turning = Math.max(ANGLE, (NEAR / (inset + longest + size)) * DEG);

    const angle = laneFrom(
      follow((t) => [posed(t).angle], breaks, turning, [0], ends),
      ([value]) => value!,
    );

    const start: Vec = [inset, 0];

    const [geometry, rest] = !isLane(fixed)
      ? [shaftOf(bend, fixed, start, 0), shaft!.trim]
      : bend === 0
        ? [
            shaftOf(0, longest, start, 0),
            laneFrom(
              follow(
                (t) => {
                  const share = Math.min(1, posed(t).length / longest);
                  const [a, b] = valueAt(trim, t, blendVec);

                  return [a * share, b * share];
                },
                breaks,
                NEAR / longest,
                [],
                ends,
              ),
              ([a, b]): Vec => [a!, b!],
            ),
          ]
        : [laneFrom(stretch, ([value]) => shaftOf(bend, value!, start, 0)), shaft!.trim];

    if (!head) return [drawn(shaft!, geometry, at, layer(angle, 1), rest)];

    /** Where the drawn end is along the turned shaft, and which way it heads there. */
    const end = (t: Seconds): readonly [Vec, number] => {
      const { length } = posed(t);
      const reached = path(valueAt(trim, t, blendVec)[1]);

      return [[inset + reached.at[0] * length, reached.at[1] * length], reached.heading];
    };

    // The head turns with the shaft, around the same point, and rides out along it: a move inside the turn.
    const ride: Layer = {
      offset: laneFrom(
        follow((t) => end(t)[0], breaks, NEAR, [], ends, true),
        ([x, y]): Vec => [x!, y!],
      ),
      rotate: laneFrom(
        follow((t) => [end(t)[1]], breaks, turning, [0], ends),
        ([value]) => value!,
      ),
      scale: [1, 1],
      opacity: 1,
    };

    return [
      drawn(shaft!, geometry, at, layer(angle, 1), rest),
      drawn(
        head,
        headOf(size, [0, 0], 0),
        at,
        [{ offset: [0, 0], rotate: angle, scale: [1, 1], opacity: shown }, ride],
        undefined,
      ),
    ];
  };

const isNumber = (value: Anim<number>): value is number => typeof value === "number";

/** A straight or bent arrow between two points or anchors, or a plain line with `head="none"`. The head rides the drawn end, so a `trim` that draws the line on carries it. */
export const Arrow = (props: ArrowProps): SceneElement => {
  const label = "<Arrow>";
  const { from, to, stroke, bend = 0, inset = 0, trim, head = 8, ...common } = props;

  if ("at" in common || "anchor" in common)
    throw new Error(
      `${label} is placed by its from and to, so it takes no ${"at" in common ? "at" : "anchor"}.`,
    );

  if (head !== "none" && !(head > 0 && Number.isFinite(head)))
    throw new Error(
      `${label} needs a head longer than 0, got ${String(head)}. For a plain line, write head="none".`,
    );

  if (stroke === undefined || stroke.color === undefined)
    throw new Error(`${label} needs a stroke with a color, as in stroke={{ color: theme.text }}.`);
  const { width = 1.5, cap = "round", join = "round", ...rest } = stroke;

  if (isNumber(width) && !(width >= 0 && Number.isFinite(width)))
    throw new Error(`${label} needs a stroke width of 0 or more, got ${width}.`);

  if (!(inset >= 0 && Number.isFinite(inset)))
    throw new Error(`${label} needs an inset of 0 or more, got ${inset}.`);

  if (!Number.isFinite(bend)) throw new Error(`${label} needs a finite bend, got ${bend}.`);
  const drawn: StrokeProps = { ...rest, width, cap, join };
  const size = head === "none" ? 0 : head;

  return {
    type: "group",
    props: common,
    children: [
      {
        type: "shape",
        props: {
          key: "shaft",
          geometry: { kind: "line", from: [0, 0], to: [1, 0] },
          stroke: drawn,
          ...(trim !== undefined && { trim }),
        },
      },
      ...(size > 0
        ? [
            {
              type: "shape",
              props: { key: "head", geometry: headOf(size, [0, 0], 0), stroke: drawn },
            } as const,
          ]
        : []),
    ],
    settle: { kind: "connect", label, ends: [from, to], connect: connect(bend, size, inset) },
  };
};
