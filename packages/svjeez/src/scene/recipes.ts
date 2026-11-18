import { ease, type Ease, type Seconds } from "../motion";
import { random } from "../random";
import { checkWindow, span, type Span, type When } from "../span";
import type { Vec } from "./ir";
import { pair } from "./lane";
import { motion, track, type LayerValues, type Motion, type Track } from "./track";

const REST = { offset: [0, 0], rotate: 0, scale: 1, opacity: 1 } as const;

const closed = ({ at, over }: Span, what: string): Span => {
  checkWindow(at, over, what);

  return { at, over };
};

// SAFETY: values is a LayerValues, so its own keys are layer value names.
const named = (values: LayerValues): (keyof LayerValues)[] =>
  Object.keys(values) as (keyof LayerValues)[];

const rest = (values: LayerValues): LayerValues =>
  Object.fromEntries(named(values).map((name) => [name, REST[name]]));

/** Arrive from `from` to rest. Without `from` it is a fade-in. */
export const enter = (
  when: Span,
  from: LayerValues = { opacity: 0 },
  curve: Ease = ease.out,
): Motion => {
  const { at, over } = closed(when, "enter()");

  return motion(from).to(rest(from), span(at, over), curve);
};

/** Leave rest for `to`. Without `to` it is a fade-out. */
export const exit = (
  when: Span,
  to: LayerValues = { opacity: 0 },
  curve: Ease = ease.out,
): Motion => {
  const { at, over } = closed(when, "exit()");

  return motion().to(to, span(at, over), curve);
};

export interface WiggleOptions {
  /** Pins the noise. Change it to reroll. */
  readonly seed: string | number;
  /** Samples per second. Default 8. */
  readonly rate?: number;
  /** Shape between samples. `ease.inOut` (default) drifts; `ease.hold` jitters. */
  readonly ease?: Ease;
  /** Loop length, snapped to divide the scene. Default 2s. */
  readonly period?: Seconds;
}

/** Seeded noise around rest, looping seamlessly. Values are baked at call time, so output is reproducible. */
export const wiggle = (amplitude: LayerValues, options: WiggleOptions): Motion => {
  const period = options.period ?? 2;
  const rate = options.rate ?? 8;

  if (!Number.isFinite(period) || period <= 0)
    throw new Error(`wiggle() needs a positive period, got ${period}.`);

  if (!(rate > 0 && Number.isFinite(rate)))
    throw new Error(`wiggle() needs a positive rate, got ${rate}.`);
  const count = Math.max(2, Math.round(rate * period));
  const next = random(String(options.seed));

  const noise = (amp: number): number[] =>
    Array.from({ length: count }, () => amp * (next() * 2 - 1));

  const opacity = amplitude.opacity === undefined ? undefined : noise(amplitude.opacity);
  const rotate = amplitude.rotate === undefined ? undefined : noise(amplitude.rotate);
  const scale = amplitude.scale === undefined ? undefined : pair(amplitude.scale).map(noise);
  const offset = amplitude.offset === undefined ? undefined : amplitude.offset.map(noise);

  const at = (index: number): LayerValues => {
    const i = index % count;

    return {
      ...(opacity && { opacity: Math.min(1, Math.max(0, 1 + opacity[i]!)) }),
      ...(rotate && { rotate: rotate[i]! }),
      ...(scale && { scale: [1 + scale[0]![i]!, 1 + scale[1]![i]!] as const }),
      ...(offset && { offset: [offset[0]![i]!, offset[1]![i]!] as const }),
    };
  };

  let layer = motion(at(0));

  for (let i = 1; i <= count; i++)
    layer = layer.to(
      at(i),
      span(((i - 1) * period) / count, period / count),
      options.ease ?? ease.inOut,
    );

  return layer.loop(period);
};

/** A `trim` that strokes the outline on, from nothing to all of it. */
export const draw = (when: Span, curve: Ease = ease.out): Track<Vec> => {
  const { at, over } = closed(when, "draw()");

  return track([0, 0]).to([0, 1], span(at, over), curve);
};

/** A `rotate` that turns once every `every` seconds, forever. */
export const spin = ({ every }: { readonly every: Seconds }): Track<number> => {
  if (!(every > 0 && Number.isFinite(every)))
    throw new Error(`spin() needs a positive every, got ${every}.`);

  return track(0).to(360, span(0, every), ease.linear).loop(every);
};

const isList = (spans: When | readonly When[]): spans is readonly When[] => Array.isArray(spans);

const merge = (list: readonly When[]): [number, number][] => {
  const out: [number, number][] = [];

  for (const { at, over } of [...list].sort((a, b) => a.at - b.at)) {
    const until = over === undefined ? Infinity : at + over;
    const last = out.at(-1);

    if (last && at <= last[1]) last[1] = Math.max(last[1], until);
    else out.push([at, until]);
  }

  return out;
};

/**
 * An `opacity` that is 1 during each span and 0 outside. Fades sit inside the span. Overlapping or touching spans
 * merge; a span shorter than two fades shrinks them. `fade: 0` cuts. A span without `over` stays to the end.
 */
export const show = (
  spans: When | readonly When[],
  { fade = 0.3 }: { readonly fade?: Seconds } = {},
): Track<number> => {
  const list: readonly When[] = isList(spans) ? spans : [spans];

  if (!(fade >= 0 && Number.isFinite(fade)))
    throw new Error(`show() needs a fade of 0 or more, got ${fade}.`);

  for (const { at, over } of list) {
    if (!Number.isFinite(at) || at < 0)
      throw new Error(`show() needs a start of 0 or later, got ${at}.`);

    if (over !== undefined && !(over > 0 && Number.isFinite(over)))
      throw new Error(`show() needs a positive over, or none to stay to the end, got ${over}.`);
  }

  const merged = merge(list);
  let shown = track(fade === 0 && merged[0]?.[0] === 0 ? 1 : 0);

  for (const [a, b] of merged) {
    const f = Math.min(fade, (b - a) / 2);

    if (f > 0) shown = shown.to(1, span(a, f));
    else if (a > 0) shown = shown.set(1, a);

    if (b === Infinity) continue;
    shown = f > 0 ? shown.to(0, span(b - f, f)) : shown.set(0, b);
  }

  return shown;
};
