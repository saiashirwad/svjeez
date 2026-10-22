import { clamp, spec, type RestChannel, type Values } from "./channels";
import { ease, motion, type Ease, type Motion, type Seconds, type Span } from "./motion";

type Exact<V, Allowed extends PropertyKey> = V & { readonly [P in Exclude<keyof V, Allowed>]: never };
type Shake = "x" | "y" | "rotate";

const span = ({ at, over }: Span, what: string): Span => {
  if (!Number.isFinite(at) || at < 0) throw new Error(`${what} starts at ${at}; spans start at 0 or later.`);
  if (!Number.isFinite(over) || over <= 0) throw new Error(`${what} lasts ${over}; spans need a positive duration.`);
  return { at, over };
};

const rest = (values: Values<RestChannel>): Values<RestChannel> =>
  Object.fromEntries(Object.keys(values).map((channel) => [channel, spec(channel as RestChannel).identity]));

/** Arrive from `from` to rest. Without `from` it is a fade-in. */
export function enter(at: Span, from?: undefined, curve?: Ease): Motion<"opacity">;
export function enter<V extends Values<RestChannel>>(at: Span, from: Exact<V, RestChannel>, curve?: Ease): Motion<keyof V & RestChannel>;
export function enter(at: Span, from: Values<RestChannel> = { opacity: 0 }, curve: Ease = ease.out): Motion {
  const { at: start, over } = span(at, "enter()");
  return motion(from).at(start).to(rest(from), over, curve);
}

/** Leave rest for `to`. Without `to` it is a fade-out. */
export function exit(at: Span, to?: undefined, curve?: Ease): Motion<"opacity">;
export function exit<V extends Values<RestChannel>>(at: Span, to: Exact<V, RestChannel>, curve?: Ease): Motion<keyof V & RestChannel>;
export function exit(at: Span, to: Values<RestChannel> = { opacity: 0 }, curve: Ease = ease.out): Motion {
  const { at: start, over } = span(at, "exit()");
  return motion().at(start).to(to, over, curve);
}

/** Stroke a shape on, 0 → 1. Render adds pathLength/dasharray and hides the round-cap dot at 0. */
export const draw = (at: Span, curve: Ease = ease.out): Motion<"draw"> => {
  const { at: start, over } = span(at, "draw()");
  return motion({ draw: 0 }).at(start).to({ draw: 1 }, over, curve);
};

/** Damped oscillation around rest. Deterministic. `rate` is direction changes per second. */
export function shake<V extends Values<Shake>>(at: Span, amplitude: Exact<V, Shake>, options: { readonly rate?: number } = {}): Motion<keyof V & Shake> {
  const { at: start, over } = span(at, "shake()");
  const count = Math.max(2, Math.round(over * (options.rate ?? 12)));
  const swing = (k: number): Values<Shake> =>
    Object.fromEntries(Object.entries(amplitude as Values<Shake>).map(([channel, amp]) => [channel, k === count ? 0 : (k % 2 ? -1 : 1) * amp * (1 - k / count)]));
  let track: Motion = motion().at(start);
  for (let k = 1; k <= count; k++) track = track.to(swing(k), over / count, ease.linear);
  return track as Motion<keyof V & Shake>;
}

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

const fnv1a = (text: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return hash >>> 0;
};

const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Seeded noise around rest, looping seamlessly. Values are baked at call time, so output is reproducible. */
export function wiggle<V extends Values<RestChannel>>(amplitude: Exact<V, RestChannel>, options: WiggleOptions): Motion<keyof V & RestChannel> {
  const period = options.period ?? 2;
  const count = Math.max(2, Math.round((options.rate ?? 8) * period));
  const random = mulberry32(fnv1a(String(options.seed)));
  const channels = (Object.keys(amplitude) as RestChannel[]).sort();
  const samples = channels.map((channel) => {
    const amp = (amplitude as Values<RestChannel>)[channel] ?? 0;
    const base = spec(channel).identity ?? 0;
    return Array.from({ length: count }, () => clamp(channel, base + amp * (random() * 2 - 1)));
  });
  const at = (i: number): Values<RestChannel> => Object.fromEntries(channels.map((channel, c) => [channel, samples[c]![i % count]]));
  let track: Motion = motion(at(0));
  for (let i = 1; i <= count; i++) track = track.to(at(i), period / count, options.ease ?? ease.inOut);
  return track.loop(period) as Motion<keyof V & RestChannel>;
}
