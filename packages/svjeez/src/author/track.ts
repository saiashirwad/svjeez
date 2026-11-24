import { SceneError } from "../model/scene-error";
import { DEFAULT_EASE, EPSILON, ease, type Seconds } from "../model/time";
import { num } from "../model/format";
import { span, type Span, type When } from "./span";
import type { Vec } from "../model/ir";
import { isSpring, type Curve } from "./spring";
import { isAnchor, type Anchor } from "./refs";
import type { Geometry } from "./values";
import { Passage, type LoopOptions, type Timing } from "../model/steps";
import {
  mappedTrack,
  together,
  type Derived,
  type MapOptions,
  type Source,
  type Together,
  type ValuesOf,
} from "./derived";
import { isString } from "../model/guards";

/** What a step of a track can go to: a point track can also go to an anchor, resolved after layout. */
export type Goal<T> = T extends Vec ? T | Anchor : T;

/**
 * A timeline nodes read. A track is a value: `to`, `set`, `loop`, `repeat` and `rewind` each return a new track with
 * that step added, and leave the one they are called on as it was.
 */
export interface Track<T> {
  /** The span of the last step. */
  readonly span: Span;
  to(value: Goal<T>, when: When, curve?: Curve): Track<T>;
  set(value: Goal<T>, when: When): Track<T>;
  loop(period: Seconds, options?: LoopOptions): Track<T>;
  repeat(times: number | { readonly until: Seconds }): Track<T>;
  rewind(over: Seconds, curve?: Curve): Track<T>;
  map<U>(fn: (value: T) => U, options?: MapOptions): Derived<U>;
  with<const S extends readonly Source[]>(...others: S): Together<[T, ...ValuesOf<S>]>;
}

export type Anim<T> = T | Track<T> | Derived<T>;

/** The curve a step takes unless told: keystrokes come at an even pace, so a string track's steps are linear. */
const curveFor = <T>(value: T): Curve => (isString(value) ? ease.linear : DEFAULT_EASE);

// SAFETY: a step may hold an anchor where a point track expects a point; goals.ts resolves it before any mix sees it, and readOf refuses it anywhere else.
const stored = <T>(goal: Goal<T>): T => goal as T;

class ValueTrack<T> implements Track<T> {
  readonly passage: Passage<{ readonly value: T }>;
  readonly #last: Span | undefined;

  constructor(passage: Passage<{ readonly value: T }>, last?: Span) {
    this.passage = passage;
    this.#last = last;
  }

  get span(): Span {
    if (!this.#last)
      throw new SceneError(
        "span is the span of the last step, but this track has no step yet.",
        "Add a to() or set() first, then read its span.",
      );

    return this.#last;
  }

  to(value: Goal<T>, when: When, curve: Curve = curveFor(value)): Track<T> {
    const next = this.passage.to({ value: stored(value) }, when, curve);
    const over = when.over ?? (isSpring(curve) ? curve.settle : 0);

    return new ValueTrack(next, span(when.start, over));
  }

  set(value: Goal<T>, when: When): Track<T> {
    return new ValueTrack(this.passage.set({ value: stored(value) }, when), span(when.start, 0));
  }

  loop(period: Seconds, options?: LoopOptions): Track<T> {
    return new ValueTrack(this.passage.loop(period, options), this.#last);
  }

  repeat(times: number | { readonly until: Seconds }): Track<T> {
    return new ValueTrack(this.passage.repeat(times), this.#last);
  }

  rewind(over: Seconds, curve: Curve = curveFor(this.passage.data.initial.value)): Track<T> {
    return new ValueTrack(this.passage.rewind(over, curve), this.#last);
  }

  map<U>(fn: (value: T) => U, options: MapOptions = {}): Derived<U> {
    return mappedTrack(this, fn, options);
  }

  with<const S extends readonly Source[]>(...others: S): Together<[T, ...ValuesOf<S>]> {
    // SAFETY: a track of anything but numbers or points is refused when it is lowered, where its values are read.
    return together([this as Track<number>, ...others]) as Together<[T, ...ValuesOf<S>]>;
  }
}

export function track(initial: number): Track<number>;
export function track(initial: Vec): Track<Vec>;
export function track(initial: Geometry): Track<Geometry>;
export function track<T>(initial: T): Track<T>;
export function track<T>(initial: T): Track<T> {
  if (isAnchor(initial))
    throw new SceneError(
      `A track starts at a value, but track(${initial.label}) starts at an anchor.`,
      "Start it at a point, as in track([0, 0]), then write .to(anchor, span(…)).",
    );

  return new ValueTrack(new Passage({ initial: { value: initial }, steps: [] }));
}

export const isTrack = <T>(value: Anim<T>): value is Track<T> => value instanceof ValueTrack;

export const passageOf = <T>(value: Track<T>): Passage<{ readonly value: T }> => {
  if (!(value instanceof ValueTrack))
    throw new SceneError("A track is built with track() or a recipe.");

  return value.passage;
};

const clockOf = (offset: Seconds): string =>
  offset === 0 ? "the scene's clock" : `the clock of a sequence that starts at ${num(offset)}s`;

/** Whether any step of a track goes to an anchor, which only a node's at can follow. */
export const goesToAnchor = <T>(value: Track<T>): boolean =>
  passageOf(value).data.steps.some((step) => isAnchor(step.values.value));

/** The passage of a track as a node reads it on that node's clock. Steps that go to anchors are still in it. */
export const readGoals = <T>(
  value: Track<T>,
  { clock, reads }: Timing,
  where: string,
): Passage<{ readonly value: T }> => {
  if (!(value instanceof ValueTrack))
    throw new SceneError("A track is built with track() or a recipe.");
  const { passage } = value;
  const first = reads.get(value);

  if (passage.data.period === undefined) {
    if (first && Math.abs(first.offset - clock.offset) > EPSILON)
      throw new SceneError(
        `${first.where} and ${where} read the same track, but they count time on different clocks: ${clockOf(first.offset)} and ${clockOf(clock.offset)}.`,
        "A track's spans mean one clock. Make a track for each clock, or put both nodes in the same <Sequence>.",
      );

    if (!first) reads.set(value, { offset: clock.offset, where });
  }

  return passage;
};

/** The passage of a track as a node reads it, where only a node's at may go to an anchor. */
export const readOf = <T>(
  value: Track<T>,
  timing: Timing,
  where: string,
): Passage<{ readonly value: T }> => {
  if (goesToAnchor(value))
    throw new SceneError(
      `${where} follows a track with a step that goes to an anchor, which only the at of a node (or a group's offset) can follow.`,
      "Use that track for at, or write a point track of its own here.",
    );

  return readGoals(value, timing, where);
};

/** A layer of plain numbers, as enter() and exit() take them. */
export interface LayerValues {
  readonly offset?: Vec;
  readonly rotate?: number;
  readonly scale?: number | Vec;
  readonly skew?: number;
  readonly opacity?: number;
}

/** A passing effect on top of a node's own props: the props a node has, each a value or a track. */
export interface Layer {
  readonly offset?: Anim<Vec>;
  readonly rotate?: Anim<number>;
  readonly scale?: Anim<number> | Anim<Vec>;
  readonly skew?: Anim<number>;
  readonly opacity?: Anim<number>;
}

export type Layers = Layer | readonly (Layer | false | null | undefined)[];

const LAYER_KEYS = ["offset", "rotate", "scale", "skew", "opacity"];

export const layersOf = (stack: Layers | undefined, where: string): Layer[] => {
  const list: readonly (Layer | false | null | undefined)[] = Array.isArray(stack)
    ? stack
    : [stack];

  return list.filter((entry): entry is Layer => {
    if (!entry) return false;

    if (Object.getPrototypeOf(entry) !== Object.prototype)
      throw new SceneError(
        `motion on ${where} takes layers: plain objects of offset, rotate, scale, skew and opacity, each a value or a track.`,
        "Write motion={{ opacity: track(0).to(1, span(1, 0.3)) }}, or use enter(), exit() or wiggle().",
      );
    const unknown = Object.keys(entry).find((key) => !LAYER_KEYS.includes(key));

    if (unknown !== undefined)
      throw new SceneError(
        `A motion layer holds offset, rotate, scale, skew and opacity, and ${where} gives it "${unknown}".`,
        "Keep those five keys, and move anything else onto the node.",
      );

    return true;
  });
};
