import type { Color, Stop } from "../schema.ts";
import { isThemed } from "../schema.ts";

type Rgba = readonly [r: number, g: number, b: number, a: number];

const parse = (color: string): Rgba => {
  const [r = 0, g = 0, b = 0, a = 1] =
    /^rgba?\((.+)\)$/
      .exec(color.trim())?.[1]
      ?.split(/[\s,/]+/)
      .map(Number) ?? [];

  return [r, g, b, a];
};

/** `rgba()` of two colors `t` of the way from `a` to `b`, mixed in premultiplied alpha like CSS. */
const mixPlain = (a: string, b: string, t: number): string => {
  const [x, y] = [parse(a), parse(b)];
  const alpha = x[3] + (y[3] - x[3]) * t;

  const channel = (i: number) =>
    alpha > 0 ? (x[i]! * x[3] + (y[i]! * y[3] - x[i]! * x[3]) * t) / alpha : 0;

  return `rgba(${[0, 1, 2].map((i) => Math.round(channel(i))).join(", ")}, ${Math.round(alpha * 1000) / 1000})`;
};

const inScheme = (color: Color, scheme: "light" | "dark"): string =>
  isThemed(color) ? color[scheme] : color;

/** A color `t` of the way from `a` to `b`. A themed one mixes in each scheme. */
export const mix = (a: Color, b: Color, t: number): Color => {
  const light = mixPlain(inScheme(a, "light"), inScheme(b, "light"), t);

  if (!isThemed(a) && !isThemed(b)) return light;

  return { light, dark: mixPlain(inScheme(a, "dark"), inScheme(b, "dark"), t) };
};

/** More repeats than this are drawn once: every repeat is stops in the scene. */
const MOST_REPEATS = 400;

/**
 * The stops of a repeating gradient unrolled across `lo` to `hi` (in the stops' own units), as offsets from 0 to 1 over that span.
 * The period is the first stop to the last. Undefined when there is none (one point), or when it would take too many repeats.
 */
export const unroll = (stops: readonly Stop[], lo: number, hi: number): Stop[] | undefined => {
  const first = stops[0]!.offset;
  const period = stops[stops.length - 1]!.offset - first;

  if (!(period > 1e-6) || !(hi > lo)) return undefined;

  const [from, to] = [Math.floor((lo - first) / period), Math.ceil((hi - first) / period)];

  if (to - from + 1 > MOST_REPEATS) return undefined;
  const all: Stop[] = [];

  for (let n = from; n <= to; n++)
    for (const stop of stops) all.push({ offset: stop.offset + n * period, color: stop.color });

  const at = (t: number, after: boolean): Color => {
    const i = after
      ? all.findLastIndex((stop) => stop.offset <= t)
      : all.findIndex((stop) => stop.offset >= t);

    const [a, b] = after ? [all[i], all[i + 1]] : [all[i - 1], all[i]];

    if (!a) return b!.color;

    if (!b) return a.color;

    return b.offset > a.offset
      ? mix(a.color, b.color, (t - a.offset) / (b.offset - a.offset))
      : (after ? b : a).color;
  };

  const inside = all.filter((stop) => stop.offset > lo && stop.offset < hi);
  const span = hi - lo;

  return [{ offset: lo, color: at(lo, true) }, ...inside, { offset: hi, color: at(hi, false) }].map(
    (stop) => ({ offset: (stop.offset - lo) / span, color: stop.color }),
  );
};

/** `color` all but clear: one step of 255, which is as clear as a hex can be while keeping its color. */
const clearOf = (color: string): string => {
  const [r, g, b] = parse(color);

  return `rgba(${r}, ${g}, ${b}, 0.004)`;
};

/**
 * Stops where a clear one takes the color of its nearest neighbor that shows, so it fades to nothing rather than to grey.
 * CSS mixes gradient colors premultiplied, where a clear stop has no color of its own; SVG mixes them as they are.
 */
export const bleed = (stops: readonly Stop[]): Stop[] => {
  const themed = stops.some((stop) => isThemed(stop.color));
  const read = (stop: Stop, scheme: "light" | "dark") => inScheme(stop.color, scheme);

  const per = (["light", "dark"] as const).map((scheme) =>
    stops.map((stop, i) => {
      const own = read(stop, scheme);

      if (parse(own)[3] > 0) return own;

      const near = [...stops.slice(i + 1), ...stops.slice(0, i).reverse()]
        .map((other) => read(other, scheme))
        .find((color) => parse(color)[3] > 0);

      return near ? clearOf(near) : own;
    }),
  );

  return stops.map(({ offset }, i) => ({
    offset,
    color: themed ? { light: per[0]![i]!, dark: per[1]![i]! } : per[0]![i]!,
  }));
};
