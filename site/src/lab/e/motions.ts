import { def, ease, motion, sampled, wiggle } from "svjeez";
import { clamp } from "../util";
import { DURATION, sub, type Pt } from "./geometry";
import type { Genome } from "./genome";
import type { Layout } from "./layout";
import { r1, type Cx } from "./look";

/** When the melt starts, how long it takes, when it reverses and how long the rebound is. */
export const MELT = { at: 0.6, over: 2.4, back: 5.2, rebound: 1.4 };

export const meltMotion = (d: Pt) =>
  motion({ x: 0, y: 0 })
    .at(MELT.at)
    .to({ x: r1(d.x), y: r1(d.y) }, MELT.over, ease.inOut)
    .at(MELT.back)
    .to({ x: 0, y: 0 }, MELT.rebound, ease.pop);

/** A scale that shrinks while the specimen melts and comes back with the rebound. */
export const meltScale = (to: number) =>
  motion({ scale: 1 })
    .at(MELT.at)
    .to({ scale: to }, MELT.over, ease.inOut)
    .at(MELT.back)
    .to({ scale: 1 }, MELT.rebound, ease.pop);

/** Visibility of a part at w in the fourth dimension as the slice sweeps through it. */
export const sliceAt = (slice: number, w: number, t: number) => {
  const plane = (slice * 2 - 1) * 0.7 + 0.75 * Math.sin((Math.PI * 2 * t) / DURATION);

  return Math.sqrt(clamp(1 - ((w - plane) / 0.85) ** 2, 0, 1));
};

const sliced = (slice: number, w: number) =>
  sampled((t) => ({ scale: sliceAt(slice, w, t) }), {
    duration: DURATION,
    step: 0.1,
    precision: 2,
    tolerance: { scale: 0.03 },
  });

export const meltBy = (lay: Layout, p: Pt) => sub(lay.melt(p), p);

/** Leg `i` swings about its hip once a second, each leg on its own phase. */
export const walk = (g: Genome, i: number) => {
  const phase = (i * 0.19 + (i % 2) * 0.5) % 1;
  const swing = 20 - Math.min(10, g.legs);

  return sampled((t) => ({ rotate: swing * Math.sin(Math.PI * 2 * (t - phase)) }), {
    duration: 1,
    step: 0.05,
    precision: 1,
    tolerance: { rotate: 0.8 },
  }).loop(1);
};

/** Tail `i` sways about its root. */
export const wag = (g: Genome, i: number) =>
  wiggle({ rotate: 13 }, { seed: `tail${g.seed}-${i}`, rate: 1.1, period: 4 });

/** The part's own motions: melting toward the floor, or flickering through the slice. */
export const partMotion = (cx: Cx, p: Pt, w: number) =>
  cx.f.liquid ? meltMotion(meltBy(cx.lay, p)) : cx.f.four ? sliced(cx.g.slice, w) : undefined;

/** The body's thickness is a registered property, so one motion on it swells every stroke at once. */
export const breathing = (cx: Cx) => {
  const breath = def.property("breath", { syntax: "number", inherits: true, initial: 1 });
  const { f, g } = cx;

  const motionOf = f.four
    ? sampled(
        (t) => ({
          [breath]:
            (1 + 0.05 * Math.sin((Math.PI * 2 * t) / 2)) * (0.35 + 0.65 * sliceAt(g.slice, 0, t)),
        }),
        { duration: DURATION, step: 0.1, precision: 2, tolerance: { [breath]: 0.02 } },
      )
    : f.liquid
      ? motion({ [breath]: 1 })
          .at(MELT.at)
          .to({ [breath]: 1.3 }, MELT.over, ease.inOut)
          .at(MELT.back)
          .to({ [breath]: 1 }, MELT.rebound, ease.pop)
      : motion({ [breath]: 1 })
          .to({ [breath]: 1.07 }, 2, ease.inOut)
          .to({ [breath]: 1 }, 2, ease.inOut)
          .loop(4);

  return { breath, motion: motionOf };
};
