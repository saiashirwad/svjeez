import type {
  Animated,
  Box,
  Color as ModelColor,
  Gradient as ModelGradient,
  Paint as ModelPaint,
  Stop,
  Vec,
} from "../model/ir";
import { isLane } from "../model/lane";
import { placeIn, type Place } from "./refs";
import { noMix, type Mix } from "../model/steps";
import type { Color } from "./values";

/**
 * Gradients as paint values. Points are in the node's own frame, as its geometry's are; `linear.across` and
 * `radial.across` place them on the node's box instead, measured when the scene compiles.
 */

/** Colors spread evenly from start to end, or each with its offset from 0 to 1. */
export type Stops = readonly Color[] | readonly (readonly [offset: number, color: Color])[];

/** A linear or radial gradient, as `linear()`, `radial()` and their `across` forms make one. */
export type Gradient =
  | { readonly kind: "linear"; readonly from: Vec; readonly to: Vec; readonly stops: Stops }
  | { readonly kind: "linear"; readonly angle: number; readonly stops: Stops }
  | {
      readonly kind: "radial";
      readonly center: Vec;
      readonly radius: number;
      readonly stops: Stops;
    }
  | { readonly kind: "radial"; readonly around: Place; readonly stops: Stops };

export interface LinearOptions {
  /** Where the first stop sits, in the node's frame. */
  readonly from: Vec;
  /** Where the last stop sits. */
  readonly to: Vec;
  readonly stops: Stops;
}

export interface LinearAcrossOptions {
  /** The way the colors run, in degrees clockwise from three o'clock: 0 runs left to right, 90 top to bottom. Default 0. */
  readonly angle?: number;
  readonly stops: Stops;
}

export interface RadialOptions {
  /** Where the first stop sits, in the node's frame. */
  readonly center: Vec;
  /** How far from the center the last stop sits. */
  readonly radius: number;
  readonly stops: Stops;
}

export interface RadialAcrossOptions {
  /** Where on the box the first stop sits. The last reaches the box's farthest corner. Default `"center"`. */
  readonly center?: Place;
  readonly stops: Stops;
}

const isPair = (stop: Color | readonly [number, Color]): stop is readonly [number, Color] =>
  Array.isArray(stop);

const finite = (point: Vec): boolean => point.every((value) => Number.isFinite(value));

const checked = (stops: Stops, caller: string): Stops => {
  if (stops.length < 2)
    throw new Error(
      `${caller} needs two stops or more, got ${stops.length}. For one color, fill with the color itself.`,
    );
  const pairs = stops.filter(isPair);

  if (pairs.length !== 0 && pairs.length !== stops.length)
    throw new Error(
      `${caller} takes stops as colors, spread evenly, or as [offset, color] pairs, not both in one list.`,
    );
  let last = 0;

  for (const [offset] of pairs) {
    if (!(offset >= last && offset <= 1))
      throw new Error(
        `${caller} needs stop offsets from 0 to 1 that never decrease, got ${pairs.map(([each]) => each).join(", ")}.`,
      );
    last = offset;
  }

  return stops;
};

/** Colors that blend along a line from `from` to `to`, in the node's frame. */
export const linear = Object.assign(
  ({ from, to, stops }: LinearOptions): Gradient => {
    if (!finite(from) || !finite(to))
      throw new Error(
        `linear() needs finite points, got [${from.join(", ")}] and [${to.join(", ")}].`,
      );

    return { kind: "linear", from, to, stops: checked(stops, "linear()") };
  },
  {
    /**
     * Colors that run across the node's box at `angle`, so the box's first corner that way gets the first stop and the
     * opposite corner the last, as CSS `linear-gradient` does. The box is the one the node has at rest.
     */
    across: ({ angle = 0, stops }: LinearAcrossOptions): Gradient => {
      if (!Number.isFinite(angle))
        throw new Error(`linear.across() needs a finite angle, got ${angle}.`);

      return { kind: "linear", angle, stops: checked(stops, "linear.across()") };
    },
  },
);

/** Colors that blend outward from `center` to a circle of `radius`, in the node's frame. */
export const radial = Object.assign(
  ({ center, radius, stops }: RadialOptions): Gradient => {
    if (!finite(center))
      throw new Error(`radial() needs a finite center, got [${center.join(", ")}].`);

    if (!(radius > 0 && Number.isFinite(radius)))
      throw new Error(`radial() needs a positive radius, got ${radius}.`);

    return { kind: "radial", center, radius, stops: checked(stops, "radial()") };
  },
  {
    /** Colors that blend outward from a place on the node's box to its farthest corner. The box is the one at rest. */
    across: ({ center = "center", stops }: RadialAcrossOptions): Gradient => ({
      kind: "radial",
      around: center,
      stops: checked(stops, "radial.across()"),
    }),
  },
);

const DEG = Math.PI / 180;

const corners = ({ x, y, width, height }: Box): Vec[] => [
  [x, y],
  [x + width, y],
  [x + width, y + height],
  [x, y + height],
];

/** Whether a paint in the model is a gradient rather than a color. */
export const isGradient = (paint: ModelPaint): paint is ModelGradient => "stops" in paint;

/** Whether a paint as written is a gradient rather than a hex color or a token. */
export const isWrittenGradient = (paint: Gradient | Color): paint is Gradient =>
  typeof paint === "object" && paint.kind !== "token";

/**
 * `given` in the model, its points in the node's frame. `box` is what an `across` gradient spreads over; without
 * one, as for a paint that has no box to measure, such a gradient is an error naming `where`.
 */
export const gradientOf = (
  given: Gradient,
  box: Box | undefined,
  color: (value: Color) => ModelColor,
  where: string,
): ModelGradient => {
  const pairs = given.stops.map((stop, i): Stop => {
    const [offset, value] = isPair(stop) ? stop : [i / (given.stops.length - 1), stop];

    return { offset, color: color(value) };
  });

  const measured = (form: string): Box => {
    if (!box)
      throw new Error(
        `${where} has ${form}, which spreads over the node's box, and this paint has no box to spread over. Give the gradient its points: ${given.kind === "linear" ? "linear({ from, to, stops })" : "radial({ center, radius, stops })"}.`,
      );

    if (!(box.width > 0 || box.height > 0))
      throw new Error(
        `${where} has ${form} on a box with no size, so it has nothing to spread over.`,
      );

    return box;
  };

  if ("from" in given) return { kind: "linear", from: given.from, to: given.to, stops: pairs };

  if ("angle" in given) {
    const { x, y, width, height } = measured("linear.across()");
    // A right angle's cosine is 6e-17, not 0: snapped, so the points come out as written.
    const snap = (value: number): number => (Math.abs(value) < 1e-12 ? 0 : value);
    const [dx, dy] = [snap(Math.cos(given.angle * DEG)), snap(Math.sin(given.angle * DEG))];
    const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
    const [cx, cy] = [x + width / 2, y + height / 2];

    return {
      kind: "linear",
      from: [cx - dx * half, cy - dy * half],
      to: [cx + dx * half, cy + dy * half],
      stops: pairs,
    };
  }

  if ("center" in given)
    return { kind: "radial", center: given.center, radius: given.radius, stops: pairs };
  const area = measured("radial.across()");
  const center = placeIn(area, given.around, [0, 0], "radial.across()");

  return {
    kind: "radial",
    center,
    radius: Math.max(
      ...corners(area).map(([px, py]) => Math.hypot(px - center[0], py - center[1])),
    ),
    stops: pairs,
  };
};

/** `gradient` with `count` stops: its last stop repeated, which draws the same gradient. */
const padded = (gradient: ModelGradient, count: number): ModelGradient => {
  const last = gradient.stops.at(-1)!;

  return {
    ...gradient,
    stops: [
      ...gradient.stops,
      ...Array.from({ length: count - gradient.stops.length }, () => last),
    ],
  };
};

/** A color as a gradient shaped like `like`: every stop that color, which draws the color. */
const lifted = (color: ModelColor, like: ModelGradient): ModelGradient => ({
  ...like,
  stops: like.stops.map((stop) => ({ offset: stop.offset, color })),
});

/**
 * A paint lane whose keys all blend: all colors, or all gradients of one kind with as many stops. A color among
 * gradients becomes a gradient shaped like the nearest one, every stop that color, and a gradient with fewer stops
 * repeats its last, so neither changes what is drawn at its key. A linear and a radial gradient don't blend.
 */
export const blendable = <P extends Animated<ModelPaint> | undefined>(
  paint: P,
  where: string,
): P => {
  if (paint === undefined || !isLane(paint)) return paint;
  const values = paint.keys.map((key) => key.value);
  const gradients = values.filter(isGradient);

  if (gradients.length === 0) return paint;
  const kind = gradients[0]!.kind;
  const odd = gradients.find((value) => value.kind !== kind);

  if (odd !== undefined)
    throw new Error(
      `${where} moves from a ${kind} gradient to a ${odd.kind} one, and the two kinds don't blend. Give every key a ${kind} gradient, or draw two shapes and fade one into the other.`,
    );

  const count = Math.max(...gradients.map((value) => value.stops.length));

  /** The gradient a color at key `i` takes its shape from: the next one, or else the one before. */
  const near = (i: number): ModelGradient =>
    values.slice(i + 1).find(isGradient) ?? values.slice(0, i).reverse().find(isGradient)!;

  const keys = paint.keys.map((key, i) => ({
    ...key,
    value: isGradient(key.value)
      ? padded(key.value, count)
      : lifted(key.value, padded(near(i), count)),
  }));

  // SAFETY: the lane is the one given, each key's value a paint of the same lane, so P holds it.
  return { ...paint, keys } as P;
};

const mixPoint = (a: Vec, b: Vec, u: number): Vec => [
  a[0] + (b[0] - a[0]) * u,
  a[1] + (b[1] - a[1]) * u,
];

/**
 * The paint `amount` of the way between two that `blendable` allows: a gradient's points and offsets blend, and
 * colors only where they are the same, as for any color cut partway through a transition.
 */
export const mixPaint: Mix<ModelPaint> = (a, b, amount, where) => {
  if (!isGradient(a) || !isGradient(b)) return noMix(a, b, amount, where);

  const stops = a.stops.map((stop, i): Stop => ({
    offset: stop.offset + (b.stops[i]!.offset - stop.offset) * amount,
    color: noMix(stop.color, b.stops[i]!.color, amount, where),
  }));

  if (a.kind === "linear" && b.kind === "linear")
    return {
      kind: "linear",
      from: mixPoint(a.from, b.from, amount),
      to: mixPoint(a.to, b.to, amount),
      stops,
    };

  if (a.kind === "radial" && b.kind === "radial")
    return {
      kind: "radial",
      center: mixPoint(a.center, b.center, amount),
      radius: a.radius + (b.radius - a.radius) * amount,
      stops,
    };

  return noMix(a, b, amount, where);
};
