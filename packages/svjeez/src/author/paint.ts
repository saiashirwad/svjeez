import { boxCorners } from "../model/geometry";
import { lerpPoint } from "../model/curve";
import { SceneError } from "../model/scene-error";
import type {
  Animated,
  Blend,
  Box,
  Color as ModelColor,
  Gradient as ModelGradient,
  Paint as ModelPaint,
  Pattern as ModelPattern,
  Stop,
  Vec,
} from "../model/ir";
import { isLane } from "../model/lane";
import { placeIn, type Place } from "./refs";
import { isColor } from "../model/painted";
import { noMix, same, type Mix } from "../model/steps";
import type { Child } from "./nodes";
import type { Anim } from "./track";
import type { Color, Paint } from "./values";
import type { Effect } from "./effects";
import { isArray, isNumber, isString } from "../model/guards";
import { hexBytes, hexOf, type Hex } from "../model/color";

export type Stops = readonly Color[] | readonly (readonly [offset: number, color: Color])[];

export type RadialFit = "cover" | "inside";

export type RadialShape = "circle" | "ellipse";

export type Gradient =
  | { readonly kind: "linear"; readonly from: Vec; readonly to: Vec; readonly stops: Stops }
  | { readonly kind: "linear"; readonly angle: number; readonly stops: Stops }
  | {
      readonly kind: "radial";
      readonly center: Vec;
      readonly radius: number | readonly [rx: number, ry: number];
      readonly stops: Stops;
    }
  | {
      readonly kind: "radial";
      readonly center: Place | Vec;
      readonly fit?: RadialFit;
      readonly shape?: RadialShape;
      readonly stops: Stops;
    };

export interface Pattern {
  readonly kind: "pattern";
  readonly size: Vec;
  readonly tile: Child;
  readonly offset: Anim<Vec>;
  readonly rotate: number;
}

export interface PatternOptions {
  readonly size: Vec;
  readonly tile: Child;
  readonly offset?: Anim<Vec>;
  /** Clockwise rotation of the pattern tile grid in degrees (default 0). */
  readonly rotate?: number;
}

export interface LinearOptions {
  readonly from: Vec;
  readonly to: Vec;
  readonly stops: Stops;
}

export interface LinearAcrossOptions {
  readonly angle?: number;
  readonly stops: Stops;
}

export interface RadialOptions {
  readonly center: Vec;
  /** A circle's radius, or `[rx, ry]` for an ellipse. */
  readonly radius: number | readonly [rx: number, ry: number];
  readonly stops: Stops;
}

export interface RadialAcrossOptions {
  /** A named place or fractional `[fx, fy]` point across the node's box (default `"center"`). */
  readonly center?: Place | Vec;
  /** `"cover"` (default) reaches the farthest corner; `"inside"` reaches the nearest edge (inscribed circle). */
  readonly fit?: RadialFit;
  /** `"circle"` (default), or `"ellipse"` to stretch to the box's aspect, with `fit` read per axis. */
  readonly shape?: RadialShape;
  readonly stops: Stops;
}

const finite = (point: Vec): boolean => point.every((value) => Number.isFinite(value));

const checked = (stops: Stops, caller: string): Stops => {
  if (stops.length < 2)
    throw new SceneError(
      `${caller} needs two stops or more, got ${stops.length}. For one color, fill with the color itself.`,
    );
  const pairs = stops.filter(isArray);

  if (pairs.length !== 0 && pairs.length !== stops.length)
    throw new SceneError(
      `${caller} takes stops as colors, spread evenly, or as [offset, color] pairs, not both in one list.`,
    );
  let last = 0;

  for (const [offset] of pairs) {
    if (!(offset >= last && offset <= 1))
      throw new SceneError(
        `${caller} needs stop offsets from 0 to 1 that never decrease, got ${pairs.map(([each]) => each).join(", ")}.`,
      );
    last = offset;
  }

  return stops;
};

export const linear = Object.assign(
  ({ from, to, stops }: LinearOptions): Gradient => {
    if (!finite(from) || !finite(to))
      throw new SceneError(
        `linear() needs finite points, got [${from.join(", ")}] and [${to.join(", ")}].`,
      );

    return { kind: "linear", from, to, stops: checked(stops, "linear()") };
  },
  {
    across: ({ angle = 0, stops }: LinearAcrossOptions): Gradient => {
      if (!Number.isFinite(angle))
        throw new SceneError(`linear.across() needs a finite angle, got ${angle}.`);

      return { kind: "linear", angle, stops: checked(stops, "linear.across()") };
    },
  },
);

export const radial = Object.assign(
  ({ center, radius, stops }: RadialOptions): Gradient => {
    if (!finite(center))
      throw new SceneError(`radial() needs a finite center, got [${center.join(", ")}].`);

    const radii = isNumber(radius) ? [radius] : radius;

    if (radii.length === 0 || radii.length > 2 || !radii.every((r) => r > 0 && Number.isFinite(r)))
      throw new SceneError(
        `radial() needs a positive radius, or [rx, ry] both positive, got ${isNumber(radius) ? radius : `[${radius.join(", ")}]`}.`,
      );

    return { kind: "radial", center, radius, stops: checked(stops, "radial()") };
  },
  {
    across: ({
      center = "center",
      fit = "cover",
      shape = "circle",
      stops,
    }: RadialAcrossOptions): Gradient => {
      if (isArray(center) && !finite(center))
        throw new SceneError(
          `radial.across() needs a finite fractional center, got [${center.join(", ")}].`,
        );

      if (shape !== "circle" && shape !== "ellipse")
        throw new SceneError(
          `radial.across() takes a shape of "circle" or "ellipse", got ${JSON.stringify(shape)}.`,
        );

      return {
        kind: "radial",
        center,
        fit,
        ...(shape === "ellipse" && { shape }),
        stops: checked(stops, "radial.across()"),
      };
    },
  },
);

export const pattern = ({ size, tile, offset = [0, 0], rotate = 0 }: PatternOptions): Pattern => {
  if (!size.every((side) => side > 0 && Number.isFinite(side)))
    throw new SceneError(
      `pattern() needs a tile size of two positive numbers, got [${size.join(", ")}].`,
    );

  if (!Number.isFinite(rotate))
    throw new SceneError(`pattern() needs a finite rotate angle, got ${rotate}.`);

  return { kind: "pattern", size, tile, offset, rotate };
};

export interface Noise {
  readonly kind: "noise";
  readonly frequency: Anim<number> | Anim<Vec>;
  readonly octaves: number;
  readonly seed: number;
  readonly type: "fractal" | "turbulence";
  readonly ramp: Stops;
  readonly stitch: boolean;
  readonly rotate: number;
}

export interface NoiseOptions {
  /**
   * Noise cycles per unit, one number or `[fx, fy]` (around 0.005 is a soft mottle, 0.5 a fine grain). A track
   * animates it.
   */
  readonly frequency: Anim<number> | Anim<Vec>;
  /** Layers of finer noise, 1 or more (default 3). */
  readonly octaves?: number;
  /** Picks the noise; the same seed draws the same picture. */
  readonly seed: number;
  /** `"fractal"` (default) is a soft cloud; `"turbulence"` has sharp creases, like marble or fibre. */
  readonly type?: "fractal" | "turbulence";
  /**
   * The colors noise intensity maps to, low to high, as colors spread evenly or `[offset, color]` pairs. Intensity
   * gathers around 0.5, so the middle of the ramp covers most of the surface. Translucent colors make a texture to
   * lay over another fill. Stops blend in sRGB, so colors ported from a raw `feTurbulence` (linearRGB by default)
   * need converting.
   */
  readonly ramp: Stops;
  /** Smooths the noise to tile seamlessly at the edges of the node's box. */
  readonly stitch?: boolean;
  /**
   * Clockwise degrees to turn the noise field about the center of the node's box (default 0), so grain stretched
   * with `frequency: [fx, fy]` can run along a limb. The node itself does not turn.
   */
  readonly rotate?: number;
}

/** Leaves a part unpainted: a node whose fill and stroke are both `none` is left out of the scene. */
export interface None {
  readonly kind: "none";
}

/** One layer of a layered fill or stroke, painted over the layers before it. */
export interface PaintLayer {
  readonly paint: Anim<Paint>;
  /** How it composites onto the layers under it. */
  readonly blend?: "normal" | Blend;
  readonly opacity?: Anim<number>;
  /** Effects on this layer alone, such as `emboss()` lighting a noise layer's relief. */
  readonly effects?: readonly Effect[];
}

/** What a `fill` or stroke `color` takes: one paint, or layers painted bottom to top. */
export type Paints = Anim<Paint> | readonly (Anim<Paint> | PaintLayer)[];

export const none: None = Object.freeze({ kind: "none" });

const wholeAtLeast = (value: number, low: number): boolean =>
  Number.isInteger(value) && value >= low;

export const noise = ({
  frequency,
  octaves = 3,
  seed,
  type = "fractal",
  ramp,
  stitch = false,
  rotate = 0,
}: NoiseOptions): Noise => {
  const still = isNumber(frequency) || isArray(frequency) ? frequency : undefined;

  if (
    still !== undefined &&
    ![still].flat().every((value) => isNumber(value) && value >= 0 && Number.isFinite(value))
  )
    throw new SceneError(
      `noise() needs a frequency of 0 or more, as one number or [fx, fy], got ${JSON.stringify(frequency)}.`,
      "Try frequency: 0.01 for a soft mottle, or [0.9, 0.06] for fibres stretched along y.",
    );

  if (!wholeAtLeast(octaves, 1))
    throw new SceneError(`noise() needs a whole number of 1 or more octaves, got ${octaves}.`);

  if (!Number.isInteger(seed))
    throw new SceneError(`noise() needs a whole-number seed, got ${seed}.`);

  if (type !== "fractal" && type !== "turbulence")
    throw new SceneError(
      `noise() has type "${String(type)}", but a type is "fractal" or "turbulence".`,
    );

  if (!isArray(ramp))
    throw new SceneError(
      `noise() needs a ramp of colors, got ${JSON.stringify(ramp)}.`,
      'Give it two colors or more, as in ramp: ["#0d2f63", "#1d58a8"].',
    );

  if (!isNumber(rotate) || !Number.isFinite(rotate))
    throw new SceneError(
      `noise() needs rotate as a finite number of degrees, got ${JSON.stringify(rotate)}.`,
    );

  return {
    kind: "noise",
    frequency,
    octaves,
    seed,
    type,
    ramp: checked(ramp, "noise()"),
    stitch,
    rotate,
  };
};

export const isNoise = (paint: unknown): paint is Noise =>
  typeof paint === "object" && paint !== null && "kind" in paint && paint.kind === "noise";

export const isNone = (paint: unknown): paint is None =>
  typeof paint === "object" && paint !== null && "kind" in paint && paint.kind === "none";

export const isPaintLayer = (paint: unknown): paint is PaintLayer =>
  typeof paint === "object" && paint !== null && !isArray(paint) && "paint" in paint;

/** The layers a fill or stroke color paints, bottom to top, with `none` layers left out. */
export const layersOfPaints = (given: Paints): PaintLayer[] =>
  (isArray(given) ? given : [given])
    .map((each): PaintLayer => (isPaintLayer(each) ? each : { paint: each }))
    .filter((layer) => !isNone(layer.paint));

const opaque = (hex: Hex): Hex => {
  const [r, g, b] = hexBytes(hexOf(hex, "noise()", true));

  return `#${[r, g, b].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
};

/**
 * The solid color a noise fill paints under its filter: opaque, so the filter reads the node's whole shape, and the
 * ramp color nearest its middle, so checks that read the fill see about what shows.
 */
export const standIn = ({ ramp }: Noise): Color => {
  const placed = ramp.map((stop, i) =>
    isArray(stop) ? stop : ([i / (ramp.length - 1), stop] as const),
  );

  const [, middle] = placed.reduce((best, each) =>
    Math.abs(each[0] - 0.5) < Math.abs(best[0] - 0.5) ? each : best,
  );

  if (isString(middle)) return opaque(middle);

  return hexBytes(middle.light)[3] === 255 && hexBytes(middle.dark)[3] === 255
    ? middle
    : opaque(middle.light);
};

const DEG = Math.PI / 180;

const isPattern = (paint: ModelPaint): paint is ModelPattern =>
  "kind" in paint && paint.kind === "pattern";

export const isGradient = (paint: ModelPaint): paint is ModelGradient => "stops" in paint;

export const isWrittenGradient = (paint: Paint): paint is Gradient =>
  typeof paint === "object" && (paint.kind === "linear" || paint.kind === "radial");

export const isWrittenPattern = (paint: Paint): paint is Pattern =>
  typeof paint === "object" && paint.kind === "pattern";

export const gradientOf = (
  given: Gradient,
  box: Box | undefined,
  color: (value: Color) => ModelColor,
  where: string,
): ModelGradient => {
  const pairs = given.stops.map((stop, i): Stop => {
    const [offset, value] = isArray(stop) ? stop : [i / (given.stops.length - 1), stop];

    return { offset, color: color(value) };
  });

  const measured = (form: string): Box => {
    if (!box)
      throw new SceneError(
        `${where} has ${form}, which spreads over the node's box, and this paint has no box to spread over. Give the gradient its points: ${given.kind === "linear" ? "linear({ from, to, stops })" : "radial({ center, radius, stops })"}.`,
      );

    if (!(box.width > 0 || box.height > 0))
      throw new SceneError(
        `${where} has ${form} on a box with no size, so it has nothing to spread over.`,
      );

    return box;
  };

  if ("from" in given) return { kind: "linear", from: given.from, to: given.to, stops: pairs };

  if ("angle" in given) {
    const { x, y, width, height } = measured("linear.across()");
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

  if ("radius" in given) {
    const [rx, ry] = isNumber(given.radius) ? [given.radius, given.radius] : given.radius;

    return {
      kind: "radial",
      center: given.center,
      radius: rx,
      ...(ry !== rx && { squash: ry / rx }),
      stops: pairs,
    };
  }

  const area = measured("radial.across()");

  const center: Vec = isArray(given.center)
    ? [area.x + given.center[0] * area.width, area.y + given.center[1] * area.height]
    : placeIn(area, given.center, [0, 0], "radial.across()");

  if (given.shape === "ellipse") {
    const near = [
      Math.min(center[0] - area.x, area.x + area.width - center[0]),
      Math.min(center[1] - area.y, area.y + area.height - center[1]),
    ] as const;

    const far = [
      Math.max(center[0] - area.x, area.x + area.width - center[0]),
      Math.max(center[1] - area.y, area.y + area.height - center[1]),
    ] as const;

    const reach = given.fit === "inside" ? near : far;
    const scale = given.fit === "inside" ? 1 : Math.SQRT2;

    const rx = reach[0] > 0 ? reach[0] * scale : reach[1] * scale;
    const ry = reach[1] > 0 ? reach[1] * scale : rx;

    return {
      kind: "radial",
      center,
      radius: rx,
      ...(ry !== rx && { squash: ry / rx }),
      stops: pairs,
    };
  }

  const inside = Math.min(
    center[0] - area.x,
    area.x + area.width - center[0],
    center[1] - area.y,
    area.y + area.height - center[1],
  );

  const radius =
    given.fit === "inside"
      ? inside > 0
        ? inside
        : Math.min(area.width, area.height) / 2
      : Math.max(...boxCorners(area).map(([px, py]) => Math.hypot(px - center[0], py - center[1])));

  return {
    kind: "radial",
    center,
    radius,
    stops: pairs,
  };
};

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

const lifted = (color: ModelColor, like: ModelGradient): ModelGradient => ({
  ...like,
  stops: like.stops.map((stop) => ({ offset: stop.offset, color })),
});

export const blendable = <P extends Animated<ModelPaint> | undefined>(
  paint: P,
  where: string,
): P => {
  if (paint === undefined || !isLane(paint)) return paint;
  const values = paint.keys.map((key) => key.value);

  if (values.some(isPattern)) {
    if (values.some((value) => !same(value, values[0])))
      throw new SceneError(
        `${where} would blend a pattern with a different paint, and a pattern blends with nothing but itself. Keep the same pattern on every key, or draw two shapes and fade one into the other.`,
      );

    return paint;
  }

  const gradients = values.filter(isGradient);

  if (gradients.length === 0) return paint;
  const kind = gradients[0]!.kind;
  const odd = gradients.find((value) => value.kind !== kind);

  if (odd !== undefined)
    throw new SceneError(
      `${where} moves from a ${kind} gradient to a ${odd.kind} one, and the two kinds don't blend. Give every key a ${kind} gradient, or draw two shapes and fade one into the other.`,
    );

  const count = Math.max(...gradients.map((value) => value.stops.length));

  const near = (i: number): ModelGradient =>
    values.slice(i + 1).find(isGradient) ?? values.slice(0, i).reverse().find(isGradient)!;

  const keys = paint.keys.map((key, i) => ({
    ...key,
    value: isColor(key.value)
      ? lifted(key.value, padded(near(i), count))
      : isGradient(key.value)
        ? padded(key.value, count)
        : key.value,
  }));

  // SAFETY: the lane is the one given, each key's value a paint of the same lane, so P holds it.
  return { ...paint, keys } as P;
};

export const mixPaint: Mix<ModelPaint> = (a, b, amount, where) => {
  if (!isGradient(a) || !isGradient(b)) return noMix(a, b, amount, where);

  const stops = a.stops.map((stop, i): Stop => ({
    offset: stop.offset + (b.stops[i]!.offset - stop.offset) * amount,
    color: noMix(stop.color, b.stops[i]!.color, amount, where),
  }));

  if (a.kind === "linear" && b.kind === "linear")
    return {
      kind: "linear",
      from: lerpPoint(a.from, b.from, amount),
      to: lerpPoint(a.to, b.to, amount),
      stops,
    };

  if (a.kind === "radial" && b.kind === "radial")
    return {
      kind: "radial",
      center: lerpPoint(a.center, b.center, amount),
      radius: a.radius + (b.radius - a.radius) * amount,
      ...((a.squash !== undefined || b.squash !== undefined) && {
        squash: (a.squash ?? 1) + ((b.squash ?? 1) - (a.squash ?? 1)) * amount,
      }),
      stops,
    };

  return noMix(a, b, amount, where);
};
