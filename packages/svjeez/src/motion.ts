import {
  isChannel,
  spec,
  valueOf,
  type Target,
  type TargetValue,
  type TargetValues,
} from "./channels";
import { declarationOf, isProperty } from "./properties";

import type { Span } from "./span";

export type Seconds = number;

export type { Span };

declare const easeBrand: unique symbol;

/** Structured, so CSS and SMIL each compile it. An ease always shapes the transition it is passed to. */
export type Ease = { readonly [easeBrand]: true } & EaseBody;

type EaseBody =
  | { readonly kind: "linear" }
  | { readonly kind: "bezier"; readonly points: readonly [number, number, number, number] }
  /** `count` equal jumps, each at the end of its slice. */
  | { readonly kind: "steps"; readonly count: number };

// SAFETY: easeBrand is declare-only, so no runtime value carries it. Every caller passes a finished EaseBody, and this only adds the compile-time brand.
const brand = (body: EaseBody): Ease => body as Ease;

const bezier = (x1: number, y1: number, x2: number, y2: number): Ease => {
  if (![x1, y1, x2, y2].every(Number.isFinite) || x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1)
    throw new Error(
      `ease.bezier needs x1 and x2 between 0 and 1 and a finite y1 and y2, got ${x1}, ${y1}, ${x2}, ${y2}.`,
    );

  return brand({ kind: "bezier", points: [x1, y1, x2, y2] });
};

const steps = (count: number): Ease => {
  if (!Number.isInteger(count) || count < 1)
    throw new Error(`ease.steps needs a positive whole count, got ${count}.`);

  return brand({ kind: "steps", count });
};

export const ease = {
  linear: brand({ kind: "linear" }),
  in: bezier(0.55, 0.06, 0.68, 0.19),
  out: bezier(0.23, 1, 0.32, 1),
  inOut: bezier(0.77, 0, 0.175, 1),
  /** Overshoots, then settles. */
  pop: bezier(0.34, 1.56, 0.64, 1),
  /** Hold the old value and jump at the end: the jagged, hand-drawn look. */
  hold: steps(1),
  steps,
  bezier,
} as const;

export interface Step {
  readonly start: Seconds;
  readonly over: Seconds;
  readonly ease: Ease;
  readonly values: TargetValues;
  /** A cut back to these channels' initial values, which each lane resolves because `initial` may come from an attribute. `values` is empty. */
  readonly restore?: readonly Target[];
  /** `repeat({ until })` stops this transition here, partway. */
  readonly until?: Seconds;
}

export interface MotionData {
  readonly initial: TargetValues;
  readonly steps: readonly Step[];
  readonly cursor: Seconds;
  readonly period?: Seconds;
  readonly label?: string;
  /** `rewind`: glide every channel back to its initial value, ending at the end of the clock. */
  readonly rewind?: { readonly over: Seconds; readonly ease: Ease };
  /** `repeat` unrolled passes into steps, so a lane that grows past its key cap can say why. */
  readonly repeated?: boolean;
}

declare const motionChannels: unique symbol;

export type Exact<V, Allowed extends PropertyKey> = V & {
  readonly [P in Exclude<keyof V, Allowed>]: never;
};

/**
 * One layer of animation for one element. Immutable. `K` is the set of channels it touches, so the
 * JSX `animation` prop rejects channels the tag cannot animate.
 *
 * Time is a cursor: `at` moves it, `to` and `set` start at it and advance it. Between transitions
 * every channel holds its value. Times are on the clock the motion sits in: the scene's, or a `<Clip>`'s.
 */
export interface Motion<K extends Target = Target> {
  readonly [motionChannels]?: K;
  /** Move the cursor to a time on the clock the motion sits in, or on the loop after `.loop`. */
  at(time: Seconds): Motion<K>;
  wait(duration: Seconds): Motion<K>;
  /**
   * Transition from the current values to `values`. A number starts at the cursor and takes that long; a span moves the
   * cursor to `span.at` and takes `span.over`. `ease` (default `ease.out`) shapes this transition.
   */
  to<const V extends TargetValues>(
    values: Exact<V, Target>,
    over: Seconds | Span,
    curve?: Ease,
  ): Motion<K | (keyof V & Target)>;
  /** Hard cut at the cursor. */
  set<const V extends TargetValues>(values: Exact<V, Target>): Motion<K | (keyof V & Target)>;
  /** Repeat every `period` seconds, forever. Render snaps the period so it divides the scene duration. */
  loop(period: Seconds): Motion<K>;
  /**
   * Play the passage written so far again, then hold. A count is how many times it plays in all; `{ until }` repeats it
   * until that time, cutting the last pass short. The passage runs from the first transition to the cursor, and each
   * pass starts from the channels' initial values. The passes become keyframes, so a long repeat costs keys: for a spin
   * that never stops use `.loop()`.
   */
  repeat(times: number | { readonly until: Seconds }): Motion<K>;
  /** At the end of the clock, glide every channel back to its initial value over `over` seconds. Nothing can follow. */
  rewind(over: Seconds, curve?: Ease): Motion<K>;
  /** Readable keyframe and class names. Never needs to be unique. */
  label(name: string): Motion<K>;
}

/** Stack layers on one element. Index 0 is outermost. Falsy entries are dropped. */
export type Stack<K extends Target = Target> =
  | Motion<K>
  | readonly (Motion<K> | false | null | undefined)[];

const time = (value: Seconds, what: string): Seconds => {
  if (!Number.isFinite(value) || value < 0)
    throw new Error(`${what} needs a finite, non-negative number of seconds, got ${value}.`);

  return value;
};

const isWindow = (value: Seconds | Span): value is Span => typeof value === "object";

const isUntil = (
  value: number | { readonly until: Seconds },
): value is { readonly until: Seconds } => typeof value === "object";

const isNumeric = (value: TargetValue | undefined): value is number => typeof value === "number";

const checkValues = (values: TargetValues, what = "A transition"): TargetValues => {
  const keys = Object.keys(values);

  if (keys.length === 0 && what === "A transition")
    throw new Error("A transition needs at least one channel.");

  for (const key of keys) {
    if (isProperty(key)) declarationOf(key);
    else if (!isChannel(key)) throw new Error(`"${key}" is not an animatable channel.`);
    // SAFETY: the check above accepted key as a property or a channel, and both are Target names.
    const value = valueOf(values, key as Target);

    if (isNumeric(value) && !Number.isFinite(value))
      throw new Error(`${what} needs a finite ${key}, got ${value}.`);
  }

  return values;
};

const end = (step: Step): Seconds =>
  step.until === undefined ? step.start + step.over : Math.min(step.start + step.over, step.until);

/** Most steps `repeat` unrolls, far above any lane's key cap, so a runaway count fails before it fills memory. */
const MAX_UNROLLED = 20000;

/** Absolute slack, in seconds, when comparing times. */
export const EPSILON = 1e-9;

/** Relative to a timeline, the gap that separates two keys meant to be one instant apart. */
export const NUDGE = 1e-5;

// SAFETY: checkValues rejects every key that is not a Target before a step can store its values, so the keys of a step are Target names.
const sharedLane = (a: TargetValues, b: TargetValues): Target | undefined =>
  (Object.keys(a) as Target[]).find((c) =>
    (Object.keys(b) as Target[]).some((d) => spec(c).lane === spec(d).lane),
  );

class Track implements Motion {
  constructor(readonly data: MotionData) {}

  private with(patch: Partial<MotionData>): Track {
    return new Track({ ...this.data, ...patch });
  }

  at(when: Seconds): Track {
    return this.with({ cursor: time(when, "at()") });
  }

  wait(duration: Seconds): Track {
    return this.with({ cursor: this.data.cursor + time(duration, "wait()") });
  }

  to(values: TargetValues, over: Seconds | Span, curve: Ease = ease.out): Track {
    if (isWindow(over)) {
      if (over.over === undefined)
        throw new Error(
          `to() needs a span with an over, got { at: ${over.at} } alone. A transition takes time: use span(${over.at}, over).`,
        );

      return this.at(over.at).to(values, over.over, curve);
    }

    if (!(time(over, "to()") > 0))
      throw new Error(`to() needs a positive duration, got ${over}. Use set() for a cut.`);

    return this.push({ start: this.data.cursor, over, ease: curve, values: checkValues(values) });
  }

  set(values: TargetValues): Track {
    return this.push({
      start: this.data.cursor,
      over: 0,
      ease: ease.hold,
      values: checkValues(values),
    });
  }

  loop(period: Seconds): Track {
    if (!(time(period, "loop()") > 0))
      throw new Error(`loop() needs a positive period, got ${period}.`);
    const last = Math.max(0, ...this.data.steps.map(end));

    if (last > period + EPSILON)
      throw new Error(`loop(${period}) is shorter than the motion, which runs until ${last}s.`);

    return this.with({ period });
  }

  repeat(times: number | { readonly until: Seconds }): Track {
    const { steps } = this.data;

    this.open("repeat()");

    if (steps.length === 0)
      throw new Error("repeat() needs a passage to repeat: write a transition first.");

    if (isUntil(times)) {
      if (!Number.isFinite(times.until))
        throw new Error(`repeat() needs a finite until, got ${times.until}.`);
    } else if (!Number.isInteger(times) || times < 1)
      throw new Error(`repeat() needs a whole number of plays of 1 or more, got ${times}.`);

    const from = Math.min(...steps.map((step) => step.start));
    const to = Math.max(this.data.cursor, ...steps.map(end));
    const length = to - from;
    const limit = isUntil(times) ? times.until : Infinity;

    if (!(length > 0))
      throw new Error(
        `repeat() needs a passage with a length, from the first transition at ${from}s to the cursor at ${to}s. Add a transition or a wait().`,
      );

    if (limit !== Infinity && !(limit > to + EPSILON))
      throw new Error(
        `repeat({ until: ${limit} }) needs a time after the passage ends, at ${to}s.`,
      );

    const passes = isUntil(times) ? Math.ceil((limit - from) / length - EPSILON) : times;

    if (passes * steps.length > MAX_UNROLLED)
      throw new Error(
        `repeat() would unroll ${passes} passes of ${steps.length} steps into keyframes. Use .loop(period) for a motion that never stops.`,
      );

    // SAFETY: a key of a step's values is a Target name, since checkValues validated it when the step was written.
    const touched = [...new Set(steps.flatMap((step) => Object.keys(step.values)))] as Target[];
    const copies: Step[] = [...steps];

    for (let pass = 1; pass < passes; pass++) {
      const shift = pass * length;

      copies.push({ start: from + shift, over: 0, ease: ease.hold, values: {}, restore: touched });

      for (const step of steps) {
        const start = step.start + shift;

        if (start >= limit - EPSILON) continue;
        const own = step.until === undefined ? Infinity : step.until + shift;
        const stop = start + step.over > limit + EPSILON ? Math.min(own, limit) : own;

        copies.push(stop === Infinity ? { ...step, start } : { ...step, start, until: stop });
      }
    }

    return this.with({
      steps: copies,
      cursor: limit === Infinity ? from + passes * length : limit,
      repeated: true,
    });
  }

  rewind(over: Seconds, curve: Ease = ease.out): Track {
    if (!(time(over, "rewind()") > 0))
      throw new Error(`rewind() needs a positive duration, got ${over}.`);

    this.open("rewind()");

    return this.with({ rewind: { over, ease: curve } });
  }

  label(name: string): Track {
    if (!/^[A-Za-z][\w-]*$/.test(name))
      throw new Error(`Label "${name}" must be a CSS identifier.`);

    return this.with({ label: name });
  }

  /** Nothing can follow `rewind()`, which is pinned to the end of the clock. */
  private open(what: string): void {
    if (this.data.rewind)
      throw new Error(`${what} can't follow rewind(), which runs to the end of the clock.`);
  }

  private push(step: Step): Track {
    const { period } = this.data;

    this.open("A transition");

    if (period !== undefined && end(step) > period + EPSILON)
      throw new Error(`A step ending at ${end(step)}s overruns loop(${period}).`);

    for (const other of this.data.steps) {
      const lane = sharedLane(step.values, other.values);

      if (lane && step.start < end(other) - EPSILON && other.start < end(step) - EPSILON) {
        throw new Error(
          `Two transitions move \`${spec(lane).lane}\` between ${Math.max(step.start, other.start)}s and ${Math.min(end(step), end(other))}s. Move them in one .to(), or stack two motions.`,
        );
      }
    }

    return this.with({ steps: [...this.data.steps, step], cursor: end(step) });
  }
}

/** Start a motion. `initial` is each channel's value before its first transition. */
export function motion<const V extends TargetValues = {}>(
  initial?: Exact<V, Target>,
): Motion<keyof V & Target> {
  return new Track({
    initial: initial ? checkValues(initial, "motion()") : {},
    steps: [],
    cursor: 0,
  });
}

// SAFETY: Track is the only class that implements Motion, and motion() is its only constructor, so a Motion is always a Track.
export const dataOf = (value: Motion): MotionData => (value as Track).data;

export const isMotion = (value: unknown): value is Motion => value instanceof Track;
