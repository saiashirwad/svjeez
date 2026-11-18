import { ease, type Ease, type Seconds } from "../motion";
import type { Span } from "../span";
import type { Vec } from "./ir";
import { Passage } from "./steps";

/**
 * One value over time, on the clock it sits in: the scene's, or a `<Sequence>`'s. Steps may be written in any order,
 * and two that overlap throw. Between steps the value holds.
 */
export interface Track<T> {
  to(value: T, when: Span, curve?: Ease): Track<T>;
  /** A hard cut. It has no length, so it takes a time, not a span. */
  set(value: T, at: Seconds): Track<T>;
  /** Repeat every `period` seconds, forever. The period is snapped so it divides the scene. */
  loop(period: Seconds): Track<T>;
  /** Play the passage so far again, a number of times or until a time. */
  repeat(times: number | { readonly until: Seconds }): Track<T>;
  /** At the end of the clock, glide back to the first value. Nothing can follow. */
  rewind(over: Seconds, curve?: Ease): Track<T>;
}

export type Anim<T> = T | Track<T>;

export class ValueTrack<T> implements Track<T> {
  constructor(readonly passage: Passage<{ readonly value: T }>) {}

  to(value: T, when: Span, curve: Ease = ease.out): ValueTrack<T> {
    return new ValueTrack(this.passage.to({ value }, when, curve));
  }

  set(value: T, at: Seconds): ValueTrack<T> {
    return new ValueTrack(this.passage.set({ value }, at));
  }

  loop(period: Seconds): ValueTrack<T> {
    return new ValueTrack(this.passage.loop(period));
  }

  repeat(times: number | { readonly until: Seconds }): ValueTrack<T> {
    return new ValueTrack(this.passage.repeat(times));
  }

  rewind(over: Seconds, curve: Ease = ease.out): ValueTrack<T> {
    return new ValueTrack(this.passage.rewind(over, curve));
  }
}

/** Start a track. `initial` is the value before the first step. */
export function track(initial: number): Track<number>;
export function track(initial: Vec): Track<Vec>;
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
  to(values: LayerValues, when: Span, curve?: Ease): Motion;
  set(values: LayerValues, at: Seconds): Motion;
  loop(period: Seconds): Motion;
  repeat(times: number | { readonly until: Seconds }): Motion;
  rewind(over: Seconds, curve?: Ease): Motion;
}

export type Stack = Motion | readonly (Motion | false | null | undefined)[];

export class LayerMotion implements Motion {
  constructor(readonly passage: Passage<LayerValues>) {}

  to(values: LayerValues, when: Span, curve: Ease = ease.out): LayerMotion {
    return new LayerMotion(this.passage.to(values, when, curve));
  }

  set(values: LayerValues, at: Seconds): LayerMotion {
    return new LayerMotion(this.passage.set(values, at));
  }

  loop(period: Seconds): LayerMotion {
    return new LayerMotion(this.passage.loop(period));
  }

  repeat(times: number | { readonly until: Seconds }): LayerMotion {
    return new LayerMotion(this.passage.repeat(times));
  }

  rewind(over: Seconds, curve: Ease = ease.out): LayerMotion {
    return new LayerMotion(this.passage.rewind(over, curve));
  }
}

/** Start a motion layer. `initial` is each value before its first step; one it leaves out starts at rest. */
export const motion = (initial: LayerValues = {}): Motion =>
  new LayerMotion(new Passage({ initial, steps: [] }));

export const layersOf = (stack: Stack | undefined): LayerMotion[] => {
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
