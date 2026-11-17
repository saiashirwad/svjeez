import { pathLength, type Point } from "../geometry";
import type { ChannelValues } from "../channels";
import { ease, motion, type Motion, type Seconds, type Span } from "../motion";
import { chain, span as makeSpan, stagger, type Spanned, type When } from "../span";

export type Timeline<K extends string> = { readonly [P in K]: Spanned } & {
  /** When the last scene ends. */
  readonly end: Seconds;
};

export interface TimelineOptions {
  /** When the first scene starts, so a timeline can lay out the beats inside another's scene. */
  readonly at?: Seconds;
  /** Seconds between scenes. Not scaled by `pace`. */
  readonly gap?: Seconds;
  /** Multiplies every scene length. */
  readonly pace?: number;
}

export interface ShowOptions {
  /** Seconds each fade takes, inside the span. A span shorter than two fades shrinks them. 0 cuts. Default 0.3. */
  readonly fade?: Seconds;
}

const isList = (spans: When | readonly When[]): spans is readonly When[] => Array.isArray(spans);

/**
 * On during each span, off outside. Fades sit inside the span: in over its first `fade` seconds and out over its last.
 * Spans that overlap or touch merge, so fades never collide, and a span shorter than two fades shrinks them. `fade: 0`
 * cuts: a shot in an edit. A span without `over` stays to the end and never fades out. No spans, never shown.
 */
export const show = (
  spans: When | readonly When[],
  { fade = 0.3 }: ShowOptions = {},
): Motion<"opacity"> => {
  const list: readonly When[] = isList(spans) ? spans : [spans];

  if (!(fade >= 0 && Number.isFinite(fade)))
    throw new Error(`show() needs a fade of 0 or more, got ${fade}.`);

  if (list.length === 0) return motion({ opacity: 0 });

  for (const { at, over } of list) {
    if (!Number.isFinite(at) || at < 0)
      throw new Error(`show() needs a start of 0 or later, got ${at}.`);

    if (over !== undefined && !(over > 0 && Number.isFinite(over)))
      throw new Error(`show() needs a positive over, or none to stay to the end, got ${over}.`);
  }

  const merged = mergeSpans(list);

  if (fade === 0)
    return merged.reduce(
      (track, [a, b], i) => {
        const on = i === 0 && a === 0 ? track : track.set({ opacity: 1 }, a);

        return b === Infinity ? on : on.set({ opacity: 0 }, b);
      },
      motion({ opacity: merged[0]![0] === 0 ? 1 : 0 }),
    );

  return merged.reduce(
    (track, [a, b]) => {
      const f = Math.min(fade, (b - a) / 2);
      const on = track.to({ opacity: 1 }, makeSpan(a, f));

      return b === Infinity ? on : on.to({ opacity: 0 }, makeSpan(b - f, f));
    },
    motion({ opacity: 0 }),
  );
};

/** When a thing is on screen. */
export interface Shown {
  readonly show: Span;
}

/** How a shot arrives or leaves. Each move but `cut` passes through these values while transparent. No blur: a shot holds many animated elements, and a filter over them repaints every frame. */
const MOVES = {
  cut: {},
  fade: {},
  rise: { y: 24 },
  zoom: { scale: 0.94 },
  slide: { x: 80 },
} as const satisfies Record<string, ChannelValues<"x" | "y" | "scale">>;

export type ShotMove = keyof typeof MOVES;

export interface ShotOptions {
  /** How the shot arrives at the span's start. Default `"cut"`. */
  readonly enter?: ShotMove;
  /** How it leaves by the span's end: `rise` lifts away, `zoom` grows past the viewer, `slide` goes left. Default `"cut"`. */
  readonly exit?: ShotMove;
  /** Seconds each move takes, at most half the span. Default 0.45. */
  readonly over?: Seconds;
}

type ShotChannel = "opacity" | "x" | "y" | "scale";

/**
 * A shot in an edit that moves in and out. Both moves happen inside the span, so shots laid end to end hand over
 * through the background: put each one on the `<g>` that holds the shot.
 */
export const shot = (
  { at, over }: Span,
  { enter = "cut", exit = "cut", over: move = 0.45 }: ShotOptions = {},
): Motion<ShotChannel> => {
  if (!(at >= 0 && over > 0 && move > 0))
    throw new Error(
      `shot() needs a non-negative start, a positive length and a positive move, got at ${at}, over ${over} and move ${move}.`,
    );
  const f = Math.min(move, over / 2);
  const from = MOVES[enter];
  const to: ChannelValues<ShotChannel> = { opacity: 0, ...mirror(MOVES[exit]) };
  const channels = { ...from, ...to };
  const still = Object.fromEntries(Object.keys(channels).map((c) => [c, c === "scale" ? 1 : 0]));

  const start: ChannelValues<ShotChannel> =
    at === 0 && enter === "cut" ? { ...still, opacity: 1 } : { ...still, ...from, opacity: 0 };

  // SAFETY: every key of start, still and to is a ShotChannel, from MOVES or opacity.
  const track = motion(start as { opacity: number }) as Motion<ShotChannel>;

  const shown =
    start.opacity === 1
      ? track
      : enter === "cut"
        ? track.set({ opacity: 1 }, at)
        : track.to({ ...still, opacity: 1 }, makeSpan(at, f), ease.out);

  return exit === "cut"
    ? shown.set({ opacity: 0 }, at + over)
    : shown.to(to, makeSpan(at + over - f, f), ease.in);
};

/** The leaving side of a move: what rose in from below lifts away above, what grew in keeps growing. */
const mirror = (values: ChannelValues<"x" | "y" | "scale">): ChannelValues<"x" | "y" | "scale"> =>
  Object.fromEntries(Object.entries(values).map(([c, v]) => [c, c === "scale" ? 2 - v : -v]));

/**
 * When each of several things starts, as an option of `reveal` and the diagrams: a start, from which they follow
 * `step` apart, or one time each, in order, to keep two of them in step.
 */
export type Beats = Seconds | readonly Seconds[];

const isStart = (at: Beats): at is Seconds => typeof at === "number";

/**
 * A span `over` long for each of `count` things given as `Beats`, checked: a start of 0 or later, staggered `step`
 * apart, or exactly `count` times of 0 or later in order. `what` names the caller in errors.
 */
export const spansOf = (
  at: Beats,
  count: number,
  step: Seconds,
  over: Seconds,
  what: string,
): Spanned[] => {
  if (isStart(at)) {
    if (!(at >= 0)) throw new Error(`${what} needs a non-negative start, got ${at}.`);

    return stagger(makeSpan(at, over), count, step);
  }

  if (at.length !== count) throw new Error(`${what} needs ${count} times, got ${at.length}.`);

  if (at.some((t, i) => !(t >= 0) || (i > 0 && t < at[i - 1]!)))
    throw new Error(`${what} needs non-negative times in order, got ${at.join(", ")}.`);

  return at.map((t) => makeSpan(t, over));
};

/** Spans as `[start, end]` pairs in order, with those that overlap, touch or sit closer than `gap` joined into one. */
export const mergeSpans = (spans: readonly When[], gap: Seconds = 0): [Seconds, Seconds][] =>
  spans
    .map(({ at, over }): [Seconds, Seconds] => [at, over === undefined ? Infinity : at + over])
    .sort((a, b) => a[0] - b[0])
    .reduce<[Seconds, Seconds][]>((out, [a, b]) => {
      const last = out.at(-1);

      if (last && (a <= last[1] || a - last[1] < gap)) last[1] = Math.max(last[1], b);
      else out.push([a, b]);

      return out;
    }, []);

export interface TravelOptions {
  readonly at: Seconds;
  readonly speed?: number;
  readonly over?: Seconds;
}

export interface HeadingOptions extends TravelOptions {
  /**
   * Turn the token to face the way it moves. `true` points its +x axis along the path. A number adds that many degrees,
   * so an icon drawn pointing up takes 90.
   */
  readonly heading: true | number;
}

/**
 * A token that appears at `at`, runs `points` at constant speed and vanishes at the end. Draw it at the origin.
 * `over` fixes the trip's duration; otherwise `speed` in px/s sets it. With `heading` it also turns to follow the
 * path, easing between the directions of consecutive legs, and the motion gains a `rotate` channel.
 */
export function travel(points: readonly Point[], options: HeadingOptions): Motion<Heading>;
export function travel(points: readonly Point[], options: TravelOptions): Motion<Travel>;
export function travel(
  points: readonly Point[],
  options: TravelOptions & { readonly heading?: true | number },
): Motion<Heading> {
  const { at, speed = 300, over, heading } = options;

  const legs = points.slice(1).flatMap((point, i) => {
    const from = points[i]!;
    const length = Math.hypot(point.x - from.x, point.y - from.y);

    return length > 0
      ? [{ point, length, angle: (Math.atan2(point.y - from.y, point.x - from.x) * 180) / Math.PI }]
      : [];
  });

  const total = pathLength(points);
  const duration = over ?? total / speed;

  if (!(total > 0 && duration > 0))
    throw new Error(
      `travel() needs a path of positive length and a positive speed or duration, got length ${total} over ${duration}s.`,
    );

  const turns =
    heading === undefined
      ? []
      : facings(
          legs.map((leg) => leg.angle),
          heading,
        );

  const first: TokenStart = {
    opacity: 0,
    x: points[0]!.x,
    y: points[0]!.y,
  };

  if (heading !== undefined) first.rotate = turns[0]!;

  const start: Motion<Heading> = motion<TokenStart>(first).set({ opacity: 1 }, at);

  // The legs run end to end from `at`, each for its share of the length.
  const [, ...runs] = chain(makeSpan(at, 0), ...legs.map((leg) => (duration * leg.length) / total));

  return legs
    .reduce((track, leg, i) => {
      const to = { x: leg.point.x, y: leg.point.y };

      return track.to(
        heading === undefined ? to : { ...to, rotate: turns[i + 1]! },
        runs[i]!,
        ease.linear,
      );
    }, start)
    .set({ opacity: 0 }, runs.at(-1)?.end ?? at);
}

export type Travel = "x" | "y" | "opacity";

export type Heading = Travel | "rotate";

/** Where a travelling token starts, hidden: `rotate` only when it follows a heading. */
type TokenStart = {
  opacity: number;
  x: number;
  y: number;
  rotate?: number;
};

/**
 * The heading at each vertex of a path whose legs point `angles` degrees: the mean of the two legs that meet there,
 * the first and last leg's own at the ends. Each is shifted by multiples of 360 to sit within 180 of the one before,
 * so the token turns the short way and never spins.
 */
const facings = (angles: readonly number[], offset: true | number): number[] => {
  const shift = offset === true ? 0 : offset;
  const turned: number[] = [];

  const vertex = angles.map((angle, i) => {
    if (i === 0) return angle;
    const before = angles[i - 1]!;

    return before + wrap(angle - before) / 2;
  });

  vertex.push(angles.at(-1)!);

  for (const angle of vertex) {
    const last = turned.at(-1);
    turned.push(last === undefined ? angle : last + wrap(angle - last));
  }

  return turned.map((angle) => angle + shift);
};

/** `angle` brought into -180 to 180. */
const wrap = (angle: number) => angle - 360 * Math.round(angle / 360);

export interface ReadingOptions {
  /** Words read per second. Default 3.5. */
  readonly wps?: number;
  /** Fewest seconds returned. Default 2. */
  readonly min?: Seconds;
  /** Seconds added after the last word. Default 1. */
  readonly settle?: Seconds;
}

/** Seconds a viewer needs to read `text`: words / wps + settle, at least `min`. */
export const readingTime = (
  text: string | readonly string[],
  { wps = 3.5, min = 2, settle = 1 }: ReadingOptions = {},
): Seconds => {
  if (
    !(
      wps > 0 &&
      Number.isFinite(wps) &&
      min >= 0 &&
      Number.isFinite(min) &&
      settle >= 0 &&
      Number.isFinite(settle)
    )
  )
    throw new Error(
      `readingTime() needs a positive wps and a min and settle of 0 or more, got wps ${wps}, min ${min} and settle ${settle}.`,
    );

  return Math.max(min, [text].flat().join(" ").split(/\s+/).filter(Boolean).length / wps + settle);
};

/** Consecutive named scenes, `gap` apart. */
export function timeline<const T extends Record<string, Seconds>>(
  durations: T,
  options: TimelineOptions = {},
): Timeline<keyof T & string> {
  const { at: start = 0, gap = 0, pace = 1 } = options;

  if (!(start >= 0 && gap >= 0 && pace > 0))
    throw new Error(
      `timeline() needs a non-negative start and gap and a positive pace, got at ${start}, gap ${gap} and pace ${pace}.`,
    );
  const spans: Record<string, Spanned> = {};
  let end = start;

  for (const [i, [name, length]] of Object.entries(durations).entries()) {
    if (name === "end") throw new Error(`"${name}" is reserved in a timeline.`);

    if (!(length > 0)) throw new Error(`Scene ${name} needs a positive length, got ${length}.`);
    const at = i === 0 ? start : end + gap;
    spans[name] = makeSpan(at, length * pace);
    end = at + length * pace;
  }

  // SAFETY: the loop above sets a span for every name in `durations`, so the keys of `spans` are exactly K.
  return {
    ...spans,
    end,
  } as Timeline<keyof T & string>;
}
