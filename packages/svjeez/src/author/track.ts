import { SceneError } from "../model/scene-error";
import { DEFAULT_EASE, EPSILON, type Seconds } from "../model/time";
import { num } from "../model/format";
import { span, type Span, type Spanned, type When } from "./span";
import type { Vec } from "../model/ir";
import type { Curve } from "./spring";
import { isAnchor, type Anchor } from "./refs";
import type { Geometry } from "./values";
import { Passage, type Timing } from "../model/steps";
import {
  mappedTrack,
  together,
  type Derived,
  type MapOptions,
  type Source,
  type Together,
  type ValuesOf,
} from "./derived";

/** What a step of a track can go to: a point track can also go to an anchor, resolved after layout. */
export type Goal<T> = T extends Vec ? T | Anchor : T;

/** A timeline you declare, write in scene order, and nodes read. Every write returns the same track. */
export interface Track<T> {
  /** The span of the step written last. */
  readonly span: Spanned;
  to(value: Goal<T>, when: Span, curve?: Curve): Track<T>;
  set(value: Goal<T>, when: When): Track<T>;
  loop(period: Seconds): Track<T>;
  repeat(times: number | { readonly until: Seconds }): Track<T>;
  rewind(over: Seconds, curve?: Curve): Track<T>;
  map<U>(fn: (value: T) => U, options?: MapOptions): Derived<U>;
  with<const S extends readonly Source[]>(...others: S): Together<[T, ...ValuesOf<S>]>;
}

export type Anim<T> = T | Track<T> | Derived<T>;

/** The passage a track or a motion layer writes into, and the one node that has read it. */
abstract class Written<V extends object> {
  #passage: Passage<V>;
  #last: Spanned | undefined;
  #reader: string | undefined;
  readonly #noun: string;

  constructor(passage: Passage<V>, noun: string) {
    this.#passage = passage;
    this.#noun = noun;
  }

  get passage(): Passage<V> {
    return this.#passage;
  }

  get span(): Spanned {
    if (!this.#last)
      throw new SceneError(
        `span is the span of the step written last, but nothing is written on this ${this.#noun} yet.`,
        "Write a to() or set() first, then read its span.",
      );

    return this.#last;
  }

  /** A scene reads this as it lowers; from then on a write could change nothing, so it is refused. */
  readBy(where: string): void {
    this.#reader ??= where;
  }

  protected write(
    what: string,
    next: (passage: Passage<V>) => Passage<V>,
    step?: () => Spanned,
  ): void {
    if (this.#reader !== undefined)
      throw new SceneError(
        `${what} writes a ${this.#noun} that ${this.#reader} has already read. A scene reads its ${this.#noun}s when scene()'s callback returns, so a step written later changes nothing.`,
        `Write the ${this.#noun} inside scene()'s callback, before it returns.`,
      );
    this.#passage = next(this.#passage);

    if (step) this.#last = step();
  }
}

// SAFETY: a step may hold an anchor where a point track expects a point; goals.ts resolves it before any mix sees it, and readOf refuses it anywhere else.
const stored = <T>(goal: Goal<T>): T => goal as T;

export class ValueTrack<T> extends Written<{ readonly value: T }> implements Track<T> {
  constructor(passage: Passage<{ readonly value: T }>) {
    super(passage, "track");
  }

  to(value: Goal<T>, when: Span, curve: Curve = DEFAULT_EASE): this {
    this.write(
      "to()",
      (passage) => passage.to({ value: stored(value) }, when, curve),
      () => span(when.start, when.over),
    );

    return this;
  }

  set(value: Goal<T>, when: When): this {
    this.write(
      "set()",
      (passage) => passage.set({ value: stored(value) }, when),
      () => span(when.start, 0),
    );

    return this;
  }

  loop(period: Seconds): this {
    this.write("loop()", (passage) => passage.loop(period));

    return this;
  }

  repeat(times: number | { readonly until: Seconds }): this {
    this.write("repeat()", (passage) => passage.repeat(times));

    return this;
  }

  rewind(over: Seconds, curve: Curve = DEFAULT_EASE): this {
    this.write("rewind()", (passage) => passage.rewind(over, curve));

    return this;
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

interface Reading {
  readonly offset: Seconds;
  readonly where: string;
}

let readings: Map<unknown, Reading> | undefined;

/** Tracks are read on one clock per scene: the clock of the node that reads them. */
export const reading = <T>(lower: () => T): T => {
  const outer = readings;

  readings = new Map();

  try {
    return lower();
  } finally {
    readings = outer;
  }
};

const clockOf = (offset: Seconds): string =>
  offset === 0 ? "the scene's clock" : `the clock of a sequence that starts at ${num(offset)}s`;

/** Whether any step of a track goes to an anchor, which only a node's at can follow. */
export const goesToAnchor = <T>(value: Track<T>): boolean =>
  passageOf(value).data.steps.some((step) => isAnchor(step.values.value));

/** The passage of a track as a node reads it on that node's clock. Steps that go to anchors are still in it. */
export const readGoals = <T>(
  value: Track<T>,
  { clock }: Timing,
  where: string,
): Passage<{ readonly value: T }> => {
  if (!(value instanceof ValueTrack))
    throw new SceneError("A track is built with track() or a recipe.");
  const { passage } = value;
  const first = readings?.get(value);

  if (passage.data.period === undefined) {
    if (first && Math.abs(first.offset - clock.offset) > EPSILON)
      throw new SceneError(
        `${first.where} and ${where} read the same track, but they count time on different clocks: ${clockOf(first.offset)} and ${clockOf(clock.offset)}.`,
        "A track's spans mean one clock. Make a track for each clock, or put both nodes in the same <Sequence>.",
      );

    if (!first) readings?.set(value, { offset: clock.offset, where });
  }

  value.readBy(where);

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

export interface LayerValues {
  readonly offset?: Vec;
  readonly rotate?: number;
  readonly scale?: number | Vec;
  readonly opacity?: number;
}

export interface Motion {
  /** The span of the step written last. */
  readonly span: Spanned;
  to(values: LayerValues, when: Span, curve?: Curve): Motion;
  set(values: LayerValues, when: When): Motion;
  loop(period: Seconds): Motion;
  repeat(times: number | { readonly until: Seconds }): Motion;
  rewind(over: Seconds, curve?: Curve): Motion;
}

export type Layers = Motion | readonly (Motion | false | null | undefined)[];

export class LayerMotion extends Written<LayerValues> implements Motion {
  constructor(passage: Passage<LayerValues>) {
    super(passage, "motion");
  }

  to(values: LayerValues, when: Span, curve: Curve = DEFAULT_EASE): this {
    this.write(
      "to()",
      (passage) => passage.to(values, when, curve),
      () => span(when.start, when.over),
    );

    return this;
  }

  set(values: LayerValues, when: When): this {
    this.write(
      "set()",
      (passage) => passage.set(values, when),
      () => span(when.start, 0),
    );

    return this;
  }

  loop(period: Seconds): this {
    this.write("loop()", (passage) => passage.loop(period));

    return this;
  }

  repeat(times: number | { readonly until: Seconds }): this {
    this.write("repeat()", (passage) => passage.repeat(times));

    return this;
  }

  rewind(over: Seconds, curve: Curve = DEFAULT_EASE): this {
    this.write("rewind()", (passage) => passage.rewind(over, curve));

    return this;
  }
}

export const motion = (initial: LayerValues = {}): Motion =>
  new LayerMotion(new Passage({ initial, steps: [] }));

export const layersOf = (stack: Layers | undefined): LayerMotion[] => {
  const list: readonly (Motion | false | null | undefined)[] = Array.isArray(stack)
    ? stack
    : [stack];

  return list.filter((entry): entry is LayerMotion => {
    if (!entry) return false;

    if (!(entry instanceof LayerMotion))
      throw new SceneError("motion takes layers built with motion() or a recipe.");

    return true;
  });
};
