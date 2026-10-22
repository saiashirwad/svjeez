import { isChannel, spec, type Channel, type Values } from "./channels";

export type Seconds = number;

/** A transition window. `over` is a duration, never an end time. */
export interface Span {
  readonly at: Seconds;
  readonly over: Seconds;
}

declare const easeBrand: unique symbol;

/** Structured, so CSS and SMIL each compile it. An ease always shapes the transition it is passed to. */
export type Ease = { readonly [easeBrand]: true } & (
  | { readonly kind: "linear" }
  | { readonly kind: "bezier"; readonly points: readonly [number, number, number, number] }
  /** `count` equal jumps, each at the end of its slice. */
  | { readonly kind: "steps"; readonly count: number }
);

const bezier = (x1: number, y1: number, x2: number, y2: number): Ease => ({ kind: "bezier", points: [x1, y1, x2, y2] }) as unknown as Ease;

const steps = (count: number): Ease => {
  if (!Number.isInteger(count) || count < 1) throw new Error(`ease.steps needs a positive whole count, got ${count}.`);
  return { kind: "steps", count } as unknown as Ease;
};

export const ease = {
  linear: { kind: "linear" } as unknown as Ease,
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
  /** 0 for a hard cut. */
  readonly over: Seconds;
  readonly ease: Ease;
  readonly values: Values;
}

export interface MotionData {
  readonly initial: Values;
  readonly steps: readonly Step[];
  readonly cursor: Seconds;
  readonly period?: Seconds;
  readonly label?: string;
}

declare const motionChannels: unique symbol;

type Exact<V, Allowed extends PropertyKey> = V & { readonly [P in Exclude<keyof V, Allowed>]: never };

/**
 * One layer of animation for one element. Immutable. `K` is the set of channels it touches, so the
 * JSX `animation` prop rejects channels the tag cannot animate.
 *
 * Time is a cursor: `at` moves it, `to` and `set` start at it and advance it. Between transitions
 * every channel holds its value.
 */
export interface Motion<K extends Channel = Channel> {
  readonly [motionChannels]?: K;
  /** Move the cursor to an absolute time on the scene timeline, or on the loop after `.loop`. */
  at(time: Seconds): Motion<K>;
  wait(duration: Seconds): Motion<K>;
  /** Transition from the current values to `values`, starting at the cursor. `ease` (default `ease.out`) shapes this transition. */
  to<const V extends Values>(values: Exact<V, Channel>, over: Seconds, curve?: Ease): Motion<K | (keyof V & Channel)>;
  /** Hard cut at the cursor. */
  set<const V extends Values>(values: Exact<V, Channel>): Motion<K | (keyof V & Channel)>;
  /** Repeat every `period` seconds. Render snaps the period so it divides the scene duration. */
  loop(period: Seconds): Motion<K>;
  /** Readable keyframe and class names. Never needs to be unique. */
  label(name: string): Motion<K>;
}

/** Stack layers on one element. Index 0 is outermost. Falsy entries are dropped. */
export type Stack<K extends Channel = Channel> = Motion<K> | readonly (Motion<K> | false | null | undefined)[];

const time = (value: Seconds, what: string): Seconds => {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${what} must be a finite, non-negative number of seconds, got ${value}.`);
  return value;
};

const checkValues = (values: Values): Values => {
  const keys = Object.keys(values);
  if (keys.length === 0) throw new Error("A transition needs at least one channel.");
  for (const key of keys) {
    if (!isChannel(key)) throw new Error(`"${key}" is not an animatable channel.`);
    const value = values[key];
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error(`${key} must be finite, got ${value}.`);
  }
  return values;
};

const end = (step: Step): Seconds => step.start + step.over;

/** Float slack for contiguous steps built from divided periods. */
const EPSILON = 1e-9;

const sharedLane = (a: Values, b: Values): Channel | undefined =>
  (Object.keys(a) as Channel[]).find((c) => (Object.keys(b) as Channel[]).some((d) => spec(c).lane === spec(d).lane));

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

  to(values: Values, over: Seconds, curve: Ease = ease.out): Track {
    if (!(time(over, "to() duration") > 0)) throw new Error("to() needs a positive duration. Use set() for a cut.");
    return this.push({ start: this.data.cursor, over, ease: curve, values: checkValues(values) });
  }

  set(values: Values): Track {
    return this.push({ start: this.data.cursor, over: 0, ease: ease.hold, values: checkValues(values) });
  }

  loop(period: Seconds): Track {
    if (!(time(period, "loop()") > 0)) throw new Error("loop() needs a positive period.");
    const last = Math.max(0, ...this.data.steps.map(end));
    if (last > period + EPSILON) throw new Error(`loop(${period}) is shorter than the motion, which runs until ${last}s.`);
    return this.with({ period });
  }

  label(name: string): Track {
    if (!/^[A-Za-z][\w-]*$/.test(name)) throw new Error(`Label "${name}" must be a CSS identifier.`);
    return this.with({ label: name });
  }

  private push(step: Step): Track {
    const { period } = this.data;
    if (period !== undefined && end(step) > period + EPSILON) throw new Error(`A step ending at ${end(step)}s overruns loop(${period}).`);
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
export function motion<const V extends Values = {}>(initial?: Exact<V, Channel>): Motion<keyof V & Channel> {
  return new Track({ initial: initial ?? {}, steps: [], cursor: 0 });
}

export const dataOf = (value: Motion): MotionData => (value as unknown as Track).data;

export const isMotion = (value: unknown): value is Motion => value instanceof Track;
