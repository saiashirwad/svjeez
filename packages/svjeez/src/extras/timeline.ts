import { pathLength, type Point } from "../geometry";
import { ease, motion, type Motion, type Seconds, type Span } from "../motion";

export type Timeline<K extends string> = { readonly [P in K]: Span } & {
  /** From the first scene's start to the last one's end. */
  readonly duration: Seconds;
  /** When the last scene ends. */
  readonly end: Seconds;
  /** Fade in at the scene's start and out by its end. */
  show(name: K): Motion<"opacity">;
  /** Fade in at the scene's start and stay. */
  enter(name: K): Motion<"opacity">;
};

export interface TimelineOptions {
  /** When the first scene starts, so a timeline can lay out the beats inside another's scene. */
  readonly at?: Seconds;
  /** Seconds between scenes. Not scaled by `pace`. */
  readonly gap?: Seconds;
  readonly fade?: Seconds;
  /** Multiplies every scene length. */
  readonly pace?: number;
}

/** Fade in at the span's start, hold, fade out by its end. */
export const during = ({ at, over }: Span, fade: Seconds = 0.3): Motion<"opacity"> => {
  const f = Math.min(fade, over / 2);

  return motion({ opacity: 0 })
    .at(at)
    .to({ opacity: 1 }, f)
    .at(at + over - f)
    .to({ opacity: 0 }, f);
};

/** On for the span and off outside it, with hard cuts: a shot in an edit. */
export const cut = ({ at, over }: Span): Motion<"opacity"> =>
  (at > 0 ? motion({ opacity: 0 }).at(at).set({ opacity: 1 }) : motion({ opacity: 1 }))
    .at(at + over)
    .set({ opacity: 0 });

/** When each of several things happens: a start, from which they follow `step` apart, or one time each. */
export type Beats = Seconds | readonly Seconds[];

const isStart = (at: Beats): at is Seconds => typeof at === "number";

/** `count` times from `at`. A list must have one time per thing, in order. */
export const beats = (at: Beats, count: number, step: Seconds, what: string): Seconds[] => {
  if (isStart(at)) {
    if (!(at >= 0)) throw new Error(`${what} needs a non-negative start, got ${at}.`);

    return Array.from({ length: count }, (_, i) => at + i * step);
  }

  if (at.length !== count) throw new Error(`${what} needs ${count} times, got ${at.length}.`);

  if (at.some((t, i) => !(t >= 0) || (i > 0 && t < at[i - 1]!)))
    throw new Error(`${what} needs non-negative times in order, got ${at.join(", ")}.`);

  return [...at];
};

/** Spans as `[start, end]` pairs in order, with those that overlap, touch or sit closer than `gap` joined into one. */
export const mergeSpans = (spans: readonly Span[], gap: Seconds = 0): [Seconds, Seconds][] =>
  spans
    .map(({ at, over }): [Seconds, Seconds] => [at, at + over])
    .sort((a, b) => a[0] - b[0])
    .reduce<[Seconds, Seconds][]>((out, [a, b]) => {
      const last = out.at(-1);

      if (last && (a <= last[1] || a - last[1] < gap)) last[1] = Math.max(last[1], b);
      else out.push([a, b]);

      return out;
    }, []);

/** On during each span, off between. Spans closer than two fades merge, so fades never overlap. */
export const visible = (spans: readonly Span[], fade: Seconds = 0.15): Motion<"opacity"> =>
  mergeSpans(spans, fade * 2).reduce(
    (track, [a, b]) =>
      track
        .at(a)
        .to({ opacity: 1 }, Math.min(fade, (b - a) / 2))
        .at(b)
        .to({ opacity: 0 }, fade),
    motion({ opacity: 0 }),
  );

/**
 * A token that appears at `at`, runs `points` at constant speed and vanishes at the end. Draw it at the origin.
 * `over` fixes the trip's duration; otherwise `speed` in px/s sets it.
 */
export const travel = (
  points: readonly Point[],
  {
    at,
    speed = 300,
    over,
  }: { readonly at: Seconds; readonly speed?: number; readonly over?: Seconds },
): Motion<"x" | "y" | "opacity"> => {
  const legs = points.slice(1).flatMap((point, i) => {
    const length = Math.hypot(point.x - points[i]!.x, point.y - points[i]!.y);

    return length > 0 ? [{ point, length }] : [];
  });

  const total = pathLength(points);
  const duration = over ?? total / speed;

  if (!(total > 0 && duration > 0))
    throw new Error(
      `travel() needs a path of positive length and a positive speed or duration, got length ${total} over ${duration}s.`,
    );

  const start: Motion<"x" | "y" | "opacity"> = motion({
    opacity: 0,
    x: points[0]!.x,
    y: points[0]!.y,
  })
    .at(at)
    .set({ opacity: 1 });

  return legs
    .reduce(
      (track, leg) =>
        track.to({ x: leg.point.x, y: leg.point.y }, (duration * leg.length) / total, ease.linear),
      start,
    )
    .set({ opacity: 0 });
};

/** Seconds a viewer needs to read `text`: words / wps + settle, at least `min`. */
export const readingTime = (
  text: string | readonly string[],
  { wps = 3.5, min = 2, settle = 1 } = {},
): Seconds =>
  Math.max(min, [text].flat().join(" ").split(/\s+/).filter(Boolean).length / wps + settle);

/** Consecutive named scenes, `gap` apart. */
export function timeline<const T extends Record<string, Seconds>>(
  durations: T,
  options: TimelineOptions = {},
): Timeline<keyof T & string> {
  const { at: start = 0, gap = 0, fade = 0.3, pace = 1 } = options;

  if (!(start >= 0 && gap >= 0 && fade > 0 && pace > 0))
    throw new Error(
      `timeline() needs a non-negative start and gap, a positive fade and a positive pace, got at ${start}, gap ${gap}, fade ${fade} and pace ${pace}.`,
    );
  const spans: Record<string, Span> = {};
  let end = start;

  for (const [i, [name, length]] of Object.entries(durations).entries()) {
    if (name === "duration" || name === "end" || name === "show" || name === "enter")
      throw new Error(`"${name}" is reserved in a timeline.`);

    if (!(length > 0)) throw new Error(`Scene ${name} needs a positive length, got ${length}.`);
    const at = i === 0 ? start : end + gap;
    spans[name] = { at, over: length * pace };
    end = at + length * pace;
  }

  const span = (name: string): Span => {
    const found = spans[name];

    if (!found) throw new Error(`No scene named ${name}.`);

    return found;
  };

  // SAFETY: the loop above sets a span for every name in `durations`, so the keys of `spans` are exactly K.
  return {
    ...spans,
    duration: end - start,
    end,
    show: (name: string) => during(span(name), fade),
    enter: (name: string) =>
      motion({ opacity: 0 })
        .at(span(name).at)
        .to({ opacity: 1 }, Math.min(fade, span(name).over)),
  } as Timeline<keyof T & string>;
}
