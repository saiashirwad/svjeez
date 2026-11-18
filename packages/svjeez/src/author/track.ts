import { ease, type Seconds } from "../model/time";
import type { Span } from "./span";
import type { Vec } from "../model/ir";
import type { Curve } from "./spring";
import type { Geometry } from "./values";
import { Passage } from "../model/steps";
import {
  mappedTrack,
  together,
  type Derived,
  type MapOptions,
  type Source,
  type Together,
  type ValuesOf,
} from "./derived";

export interface Track<T> {
  to(value: T, when: Span, curve?: Curve): Track<T>;
  set(value: T, time: Seconds): Track<T>;
  loop(period: Seconds): Track<T>;
  repeat(times: number | { readonly until: Seconds }): Track<T>;
  rewind(over: Seconds, curve?: Curve): Track<T>;
  map<U>(fn: (value: T) => U, options?: MapOptions): Derived<U>;
  with<const S extends readonly Source[]>(...others: S): Together<[T, ...ValuesOf<S>]>;
}

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

export interface LayerValues {
  readonly offset?: Vec;
  readonly rotate?: number;
  readonly scale?: number | Vec;
  readonly opacity?: number;
}

export interface Motion {
  to(values: LayerValues, when: Span, curve?: Curve): Motion;
  set(values: LayerValues, time: Seconds): Motion;
  loop(period: Seconds): Motion;
  repeat(times: number | { readonly until: Seconds }): Motion;
  rewind(over: Seconds, curve?: Curve): Motion;
}

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
