import type { Cubic, Geometry as Outline, Vec } from "../model/ir";
import { SceneError } from "../model/scene-error";
import { isArray } from "../model/guards";
import { merge, pointAt, rotated, scaled, spline } from "./geometry";
import { moved } from "./holes";
import { Group, type Child, type SceneElement } from "./nodes";
import { sampled } from "./recipes";
import type { Interval } from "./span";
import { random } from "./random";
import type { Geometry } from "./values";

/**
 * Drawing primitives that take what a describer knows (a few points, some widths, a target) instead of Bézier
 * handles. Each returns plain geometry, so it composes with `merge`, `sampled`, `track(...).to(...)` and the rest.
 */

/** Control-handle length, as a share of the radius, for a cubic that traces a quarter circle. */
const ARC = 0.5523;

const round = (n: number): number => Math.round(n * 100) / 100;
const point = ([x, y]: Vec): Vec => [round(x), round(y)];

const finitePoints = (points: readonly Vec[], what: string): void => {
  for (const p of points)
    if (!p.every(Number.isFinite))
      throw new SceneError(`${what} needs finite points, got ${JSON.stringify(p)}.`);
};

/** The width `share` (0..1) of the way along a list spread evenly from start to end. */
const widthAt = (widths: readonly number[], share: number): number => {
  if (widths.length === 1) return widths[0]!;
  const at = share * (widths.length - 1);
  const i = Math.min(widths.length - 2, Math.floor(at));

  return widths[i]! + (widths[i + 1]! - widths[i]!) * (at - i);
};

const brushed = (points: readonly Vec[], width: number | readonly number[]) => {
  if (points.length < 2)
    throw new SceneError(`brush() needs two points or more, got ${points.length}.`);
  finitePoints(points, "brush()");
  const widths = isArray(width) ? width : [width];

  if (widths.length === 0 || !widths.every((w) => w >= 0 && Number.isFinite(w)))
    throw new SceneError(
      `brush() needs widths of 0 or more, got ${JSON.stringify(width)}. Write [start, end] to taper.`,
    );

  return { center: spline(points), widths };
};

export interface BrushOptions {
  /**
   * How many centerline samples the outline uses (a whole number, 1 or more). Fewer is smaller and stiffer: an
   * animated brush stores every outline point per keyframe. Default: 1 for a straight two-point brush, else
   * `points * 6` between 12 and 48.
   */
  readonly samples?: number;
}

export interface BrushPlace {
  /** The centerline point. */
  readonly point: Vec;
  /** The direction of the centerline there, in degrees. */
  readonly angle: number;
  /** The full width of the brush there. */
  readonly width: number;
}

const brushOutline = (
  points: readonly Vec[],
  width: number | readonly number[],
  { samples: wanted }: BrushOptions = {},
): Outline => {
  const { center, widths } = brushed(points, width);

  if (wanted !== undefined && !(Number.isInteger(wanted) && wanted >= 1))
    throw new SceneError(`brush() needs a whole number of samples of 1 or more, got ${wanted}.`);
  // A straight brush with a linear taper is exact from its two ends; curves and swells need samples between.
  const straight = points.length === 2 && widths.length <= 2;
  const count = wanted ?? (straight ? 1 : Math.min(48, Math.max(12, points.length * 6)));

  const rows = Array.from({ length: count + 1 }, (_, i) => {
    const share = i / count;
    const at = pointAt(center, share);
    const a = (at.angle * Math.PI) / 180;
    const dir: Vec = [Math.cos(a), Math.sin(a)];

    return {
      at: at.point,
      dir,
      half: widthAt(widths, share) / 2,
    };
  });

  const side = (sign: number) =>
    rows.map(({ at, dir, half }) =>
      point([at[0] - dir[1] * half * sign, at[1] + dir[0] * half * sign]),
    );

  /** The curves of an open spline through `points`: exactly a line for two points. */
  const curvesThrough = (points: readonly Vec[]): Cubic[] => {
    const outline = spline(points);

    return outline.kind === "path" ? [...outline.contours[0]!.curves] : [];
  };

  /**
   * A round end: two quarter-circle cubics past sample `index`, from the side at `from` around to the other side.
   * `outward` is 1 at the end of the stroke and -1 at its start.
   */
  const cap = (index: number, outward: number, from: Vec): Cubic[] => {
    const { at, dir, half } = rows[index]!;
    const d: Vec = [dir[0] * outward, dir[1] * outward];
    const n: Vec = [from[0] - at[0], from[1] - at[1]];
    const h = Math.hypot(n[0], n[1]) || 1;
    const u: Vec = [n[0] / h, n[1] / h];
    const k = half * ARC;
    const tip = point([at[0] + d[0] * half, at[1] + d[1] * half]);
    const end = point([at[0] - u[0] * half, at[1] - u[1] * half]);

    return [
      [
        point([from[0] + d[0] * k, from[1] + d[1] * k]),
        point([tip[0] + u[0] * k, tip[1] + u[1] * k]),
        tip,
      ],
      [
        point([tip[0] - u[0] * k, tip[1] - u[1] * k]),
        point([end[0] + d[0] * k, end[1] + d[1] * k]),
        end,
      ],
    ];
  };

  const left = side(1);
  const right = side(-1).reverse();

  return {
    kind: "path",
    contours: [
      {
        start: left[0]!,
        curves: [
          ...curvesThrough(left),
          ...cap(count, 1, left.at(-1)!),
          ...curvesThrough(right),
          ...cap(0, -1, right.at(-1)!),
        ],
        closed: true,
      },
    ],
    rule: "nonzero",
  };
};

/**
 * A filled stroke through `points` whose width changes along it: a neck, a limb, a tail, a branch, a tentacle.
 * `width` is one number, or widths spread evenly from start to end (`[8, 1]` tapers, `[3, 9, 3]` swells in the
 * middle). The ends are rounded. The outline's point count depends only on the inputs (and `samples`), never on
 * where the points are, so a brush can be sampled. `brush.at(points, width, share)` reads the centerline point,
 * angle and width `share` (0..1) of the way along, to attach something to it.
 */
export const brush = Object.assign(brushOutline, {
  at: (points: readonly Vec[], width: number | readonly number[], share: number): BrushPlace => {
    const { center, widths } = brushed(points, width);

    if (!(share >= 0 && share <= 1))
      throw new SceneError(`brush.at() needs a share from 0 to 1, got ${share}.`);
    const at = pointAt(center, share);

    return { point: at.point, angle: at.angle, width: widthAt(widths, share) };
  },
});

export interface BlobOptions {
  /** 0 joins the points with straight lines, 0.5 (default) is smooth, 1 bulges. */
  readonly round?: number;
}

/** A smooth closed shape through `points`, for bodies, heads, leaves, clouds, pots and stones. */
export const blob = (
  points: readonly Vec[],
  { round: tension = 0.5 }: BlobOptions = {},
): Outline => {
  if (points.length < 3)
    throw new SceneError(`blob() needs three points or more, got ${points.length}.`);
  finitePoints(points, "blob()");

  return spline(points, { closed: true, tension });
};

export interface LimbOptions {
  /**
   * Which side of the line from root to target the joints bow toward, looking from the root: `1` (default) its
   * right, `-1` its left. A leg facing right bends its knee forward with `-1`.
   */
  readonly bend?: 1 | -1;
}

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];
const hypot = (v: Vec): number => Math.hypot(v[0], v[1]);

/** Moves `from` toward `to` until it is `length` away from `to`. */
const keep = (from: Vec, to: Vec, length: number): Vec => {
  const d = sub(from, to);
  const n = hypot(d) || 1;

  return [to[0] + (d[0] / n) * length, to[1] + (d[1] / n) * length];
};

/**
 * The joints of a chain of bones from `root` with the given `lengths`, bent so its tip reaches `target` (or points at
 * it, straight, when it is too far). Returns `lengths.length + 1` points, root first: draw them with `brush`, `line`
 * or circles. Two bones solve exactly; more bones solve by FABRIK from a pose bowed toward `bend`.
 */
const solveLimb = (
  root: Vec,
  lengths: readonly number[],
  target: Vec,
  { bend = 1 }: LimbOptions = {},
): Vec[] => {
  if (lengths.length === 0 || !lengths.every((l) => l > 0 && Number.isFinite(l)))
    throw new SceneError(
      `limb() needs one or more positive bone lengths, got ${JSON.stringify(lengths)}.`,
    );
  finitePoints([root, target], "limb()");

  const toward = sub(target, root);
  const reach = hypot(toward);
  const total = lengths.reduce((a, b) => a + b, 0);
  const heading = Math.atan2(toward[1], toward[0]);

  if (reach >= total || reach === 0) {
    const out: Vec[] = [root];
    let run = 0;

    for (const l of lengths) {
      run += l;
      out.push([root[0] + Math.cos(heading) * run, root[1] + Math.sin(heading) * run]);
    }

    return out.map(point);
  }

  if (lengths.length === 2) {
    const [a, b] = [lengths[0]!, lengths[1]!];
    const cos = (a * a + reach * reach - b * b) / (2 * a * reach);
    const angle = heading + Math.acos(Math.max(-1, Math.min(1, cos))) * bend;

    const knee: Vec = [root[0] + Math.cos(angle) * a, root[1] + Math.sin(angle) * a];

    return [root, knee, target].map(point);
  }

  // Start bowed toward `bend` so FABRIK settles on that side, then alternate passes until the tip lands.
  const joints: Vec[] = [root];
  let run = 0;

  for (const l of lengths) {
    run += l;
    const share = run / total;
    const bow = Math.sin(share * Math.PI) * total * 0.35 * bend;
    joints.push([
      root[0] + Math.cos(heading) * share * reach - Math.sin(heading) * bow,
      root[1] + Math.sin(heading) * share * reach + Math.cos(heading) * bow,
    ]);
  }

  // The bowed pose only seeds the direction; its bones are the wrong lengths until at least one pass runs.
  for (let pass = 0; pass < 40; pass++) {
    joints[joints.length - 1] = target;

    for (let i = joints.length - 2; i >= 0; i--)
      joints[i] = keep(joints[i]!, joints[i + 1]!, lengths[i]!);
    joints[0] = root;

    for (let i = 1; i < joints.length; i++)
      joints[i] = keep(joints[i]!, joints[i - 1]!, lengths[i - 1]!);

    if (hypot(sub(joints.at(-1)!, target)) < 0.01) break;
  }

  return joints.map(point);
};

export interface LimbPoseProps extends LimbOptions {
  /**
   * The shoulder, where the first bone starts. A function moves it over time. `root`, `reach` and `aim` are all in
   * the parent group's coordinates, so a foot target on the floor stays planted while the hip bobs.
   */
  readonly root: Vec | ((t: number) => Vec);
  /** Bone lengths, root first. */
  readonly bones: readonly number[];
  /** Where the tip should be at time `t`, in the same frame as `root`. */
  readonly reach: (t: number) => Vec;
}

export interface LimbProps extends LimbPoseProps {
  /** The window `reach` is sampled over. */
  readonly over: Interval;
  /**
   * A world point the tip joint's content faces: its +x axis points at `aim(t)`, in the same frame as `root`.
   * Without it the tip content turns with the last bone.
   */
  readonly aim?: (t: number) => Vec;
  /** Degrees an animated angle may be off by when keyframes are dropped (default 0.2). */
  readonly tolerance?: number;
  /** Seconds between samples (default: `sampled`'s own). */
  readonly step?: number;
  /** Draws bone `index` in its own frame: from [0, 0], pointing along +x, `length` long. */
  readonly bone: (length: number, index: number) => Child;
  /** Drawn at every joint, the root and the tip included, in the frame of the bone that ends there. */
  readonly joint?: (index: number) => Child;
}

export interface LimbPose {
  /** `bones.length + 1` points, root first, in the parent's frame. */
  readonly joints: Vec[];
  /** Each bone's angle in the parent's frame, in degrees. */
  readonly angles: number[];
}

const DEG = 180 / Math.PI;

/** `angle` plus whole turns, so it lies within half a turn of `near`. */
const nearest = (angle: number, near: number): number =>
  angle + 360 * Math.round((near - angle) / 360);

const fixed = (root: LimbPoseProps["root"]): root is Vec => Array.isArray(root);

const rootAt = (root: LimbPoseProps["root"], t: number): Vec => (fixed(root) ? root : root(t));

/**
 * The pose `<Limb>` draws at time `t`: its joints and each bone's world angle in degrees. One source of truth, so
 * your own code (a light cone, a shadow, a hand) can never disagree with the chain. Angles are not unwrapped.
 */
const pose =
  ({ root, bones, reach, bend }: LimbPoseProps): ((t: number) => LimbPose) =>
  (t) => {
    const joints = solveLimb(rootAt(root, t), bones, reach(t), bend === undefined ? {} : { bend });

    const angles = bones.map((_, i) => {
      const [a, b] = [joints[i]!, joints[i + 1]!];

      return Math.atan2(b[1] - a[1], b[0] - a[0]) * DEG;
    });

    return { joints, angles };
  };

export const limb = Object.assign(solveLimb, { pose });

/**
 * A chain of bones that moves as nested rotations: each bone is drawn once, and each joint has one animated
 * `rotate` track. Tiny next to `brush(limb(...))`, which stores every outline; use that for bending, organic shapes.
 * With a function `root` the whole chain moves, and `reach` stays in the parent's frame.
 */
export const Limb = (props: LimbProps): SceneElement => {
  const { root, bones, over, aim, tolerance = 0.2, step, bone, joint } = props;
  const solve = pose(props);
  const sampling = { tolerance, ...(step !== undefined && { step }) };

  // Local joint angles, then (with `aim`) the tip content's turn relative to the last bone.
  const rowAt = (t: number): number[] => {
    const { joints, angles } = solve(t);
    const row = angles.map((world, i) => world - (angles[i - 1] ?? 0));

    if (aim) {
      const tip = joints.at(-1)!;
      const to = aim(t);
      row.push(Math.atan2(to[1] - tip[1], to[0] - tip[0]) * DEG - angles.at(-1)!);
    }

    return row;
  };

  // Angles are unwrapped against a fine table walked from the start, so no two samples jump by a turn.
  const rows = 512;
  const table: number[][] = [];

  for (let r = 0; r <= rows; r++) {
    const row = rowAt(over.start + (over.over * r) / rows);
    const before = table.at(-1);
    table.push(before ? row.map((a, i) => nearest(a, before[i]!)) : row);
  }

  const angle = (index: number) => (t: number) => {
    const at = Math.min(rows, Math.max(0, Math.round(((t - over.start) / over.over) * rows)));

    return nearest(rowAt(t)[index]!, table[at]![index]!);
  };

  const tip = (): Child => {
    const content = joint?.(bones.length);

    if (!aim || !content) return content;

    return Group({
      rotate: sampled(angle(bones.length), over, sampling),
      origin: { frame: [0, 0] },
      children: content,
    });
  };

  const chain = (index: number): SceneElement =>
    Group({
      rotate: sampled(angle(index), over, sampling),
      origin: { frame: [0, 0] },
      children: [
        bone(bones[index]!, index),
        joint?.(index),
        Group({
          offset: [bones[index]!, 0],
          children: [index + 1 < bones.length ? chain(index + 1) : tip()],
        }),
      ],
    });

  return Group({
    offset: fixed(root) ? root : sampled(root, over, sampling),
    children: chain(0),
  });
};

export interface ScatterOptions {
  /** The line or outline to place copies along. */
  readonly along: Geometry;
  readonly count: number;
  /** Degrees each copy turns away from the direction of `along` (default 0: copies point along it). */
  readonly angle?: number;
  /** Flip every other copy to the other side, mirrored, like leaves on a stem. */
  readonly alternate?: boolean;
  /** 0 (default) is even; 1 varies place, angle and size a lot. */
  readonly jitter?: number;
  /** Picks the variation; the same seed scatters the same way. */
  readonly seed?: number | string;
}

const copies = (
  shape: Geometry,
  { along, count, angle = 0, alternate = false, jitter = 0, seed = 0 }: ScatterOptions,
): Outline[] => {
  if (!Number.isInteger(count) || count < 1)
    throw new SceneError(`scatter() needs a whole count of 1 or more, got ${count}.`);

  if (!(jitter >= 0 && jitter <= 1))
    throw new SceneError(`scatter() needs a jitter from 0 to 1, got ${jitter}.`);
  const next = random(seed);
  const wobble = () => (next() * 2 - 1) * jitter;

  return Array.from({ length: count }, (_, i) => {
    const share = Math.min(1, Math.max(0, (i + 0.5 + wobble() * 0.4) / count));
    const at = pointAt(along, share);
    const flip = alternate && i % 2 === 1;
    const size = 1 + wobble() * 0.25;
    const base = scaled(shape, flip ? [size, -size] : size);
    const turn = at.angle + (flip ? -angle : angle) + wobble() * 20;

    return moved(rotated(base, turn), at.point);
  });
};

/**
 * Copies of `shape` placed along `along` and merged into one geometry: leaves, feathers, scales, grass, spikes,
 * bricks. Draw `shape` at the origin, pointing along +x; each copy is turned to follow `along`.
 * `scatter.each(shape, options)` returns the same copies unmerged, in order, so each can have its own fill or motion.
 */
export const scatter = Object.assign(
  (shape: Geometry, options: ScatterOptions): Outline => merge(...copies(shape, options)),
  { each: copies },
);
