import { ease, type Seconds } from "../time";
import type { Span } from "./span";
import type { Vec } from "./ir";
import type { Curve } from "./spring";
import type { Geometry } from "./values";
import { Passage } from "./steps";
import {
  mappedTrack,
  together,
  type Derived,
  type MapOptions,
  type Source,
  type Together,
  type ValuesOf,
} from "./derived";

/**
 * One value over time, on the clock it sits in: the scene's, or a `<Sequence>`'s. Steps may be written in any order,
 * and two that overlap throw, unless the first is a spring: a step that starts while a spring moves cuts it there and starts from where it is, and a spring that cuts in carries its speed on. Between steps the value holds.
 */
export interface Track<T> {
  to(value: T, when: Span, curve?: Curve): Track<T>;
  /** A hard cut. It has no length, so it takes a time, not a span. */
  set(value: T, time: Seconds): Track<T>;
  /** Repeat every `period` seconds, forever. The period is snapped so it divides the scene. */
  loop(period: Seconds): Track<T>;
  /** Play the passage so far again, a number of times or until a time. */
  repeat(times: number | { readonly until: Seconds }): Track<T>;
  /** At the end of the clock, glide back to the first value. Nothing can follow. */
  rewind(over: Seconds, curve?: Curve): Track<T>;
  /**
   * A track that is `fn` of this one at every moment: `theta.map((t) => -t * 2)`. Its source must be numbers or
   * points; the result may be any value a prop takes.
   */
  map<U>(fn: (value: T) => U, options?: MapOptions): Derived<U>;
  /** This track read together with others, to `map` them into one: `x.with(y).map((x, y) => [x, y])`. */
  with<const S extends readonly Source[]>(...others: S): Together<[T, ...ValuesOf<S>]>;
}

/** What every prop that can move takes: a still value, a track, or a track derived from others. */
export type Anim<T> = T | Track<T> | Derived<T>;

export class ValueTrack<T> implements Track<T> {
  constructor(readonly passage: Passage<{ readonly value: T }>) {}

  to(value: T, when: Span, curve: Curve = ease.out): ValueTrack<T> {
    return new ValueTrack(this.passage.to({ value }, when, curve));
  }

  set(value: T, time: Seconds): ValueTrack<T> {
    return new ValueTrack(this.passage.set({ value }, time));
  }

  loop(period: Seconds): ValueTrack<T> {
    return new ValueTrack(this.passage.loop(period));
  }

  repeat(times: number | { readonly until: Seconds }): ValueTrack<T> {
    return new ValueTrack(this.passage.repeat(times));
  }

  rewind(over: Seconds, curve: Curve = ease.out): ValueTrack<T> {
    return new ValueTrack(this.passage.rewind(over, curve));
  }

  map<U>(fn: (value: T) => U, options: MapOptions = {}): Derived<U> {
    return mappedTrack(this, fn, options);
  }

  with<const S extends readonly Source[]>(...others: S): Together<[T, ...ValuesOf<S>]> {
    // SAFETY: a track of anything but numbers or points is refused when it is lowered, where its values are read.
    return together([this as Track<number>, ...others]) as Together<[T, ...ValuesOf<S>]>;
  }
}

/** Start a track. `initial` is the value before the first step. */
export function track(initial: number): Track<number>;
export function track(initial: Vec): Track<Vec>;
export function track(initial: Geometry): Track<Geometry>;
export function track<T>(initial: T): Track<T>;
export function track<T>(initial: T): Track<T> {
  return new ValueTrack(new Passage({ initial: { value: initial }, steps: [] }));
}

export const isTrack = <T>(value: Anim<T>): value is Track<T> => value instanceof ValueTrack;

export const passageOf = <T>(value: Track<T>): Passage<{ readonly value: T }> => {
  if (!(value instanceof ValueTrack)) throw new Error("A track is built with track() or a recipe.");

  return value.passage;
};

/** What a motion layer can move. A node's own props move everything else. */
export interface LayerValues {
  /** How far the node sits from where `at` puts it. */
  readonly offset?: Vec;
  /** Degrees, clockwise. */
  readonly rotate?: number;
  readonly scale?: number | Vec;
  readonly opacity?: number;
}

/**
 * One layer of motion over a node, as a group around it would be. Layers stack, the first outermost, so two can move
 * the same thing: a dot that fades in on one layer wanders on another.
 */
export interface Motion {
  to(values: LayerValues, when: Span, curve?: Curve): Motion;
  set(values: LayerValues, time: Seconds): Motion;
  loop(period: Seconds): Motion;
  repeat(times: number | { readonly until: Seconds }): Motion;
  rewind(over: Seconds, curve?: Curve): Motion;
}

/** What a node's `motion` takes: one layer, or several, the first outermost. */
export type Layers = Motion | readonly (Motion | false | null | undefined)[];

export class LayerMotion implements Motion {
  constructor(readonly passage: Passage<LayerValues>) {}

  to(values: LayerValues, when: Span, curve: Curve = ease.out): LayerMotion {
    return new LayerMotion(this.passage.to(values, when, curve));
  }

  set(values: LayerValues, time: Seconds): LayerMotion {
    return new LayerMotion(this.passage.set(values, time));
  }

  loop(period: Seconds): LayerMotion {
    return new LayerMotion(this.passage.loop(period));
  }

  repeat(times: number | { readonly until: Seconds }): LayerMotion {
    return new LayerMotion(this.passage.repeat(times));
  }

  rewind(over: Seconds, curve: Curve = ease.out): LayerMotion {
    return new LayerMotion(this.passage.rewind(over, curve));
  }
}

/** Start a motion layer. `initial` is each value before its first step; one it leaves out starts at rest. */
export const motion = (initial: LayerValues = {}): Motion =>
  new LayerMotion(new Passage({ initial, steps: [] }));

export const layersOf = (stack: Layers | undefined): LayerMotion[] => {
  const list: readonly (Motion | false | null | undefined)[] = Array.isArray(stack)
    ? stack
    : [stack];

  return list.filter((entry): entry is LayerMotion => {
    if (!entry) return false;

    if (!(entry instanceof LayerMotion))
      throw new Error("motion takes layers built with motion() or a recipe.");

    return true;
  });
};
