import { motion, type Ease } from "svjeez";

/** One transition: when it starts, how long it lasts, and its ease. */
export interface Tween {
  readonly at: number;
  readonly over: number;
  readonly ease: Ease;
}

/**
 * Opacity over part of the tween, as `[start, length, from, to]`. An element that leaves goes in the first half and
 * one that arrives comes in the second, so neither overlaps siblings still sliding. Two versions of one element swap
 * in the middle: the new one comes in over the old before the old goes, so where they overlap the two never add up
 * to much less than one.
 */
const WINDOWS = {
  exit: [0, 0.5, 1, 0],
  enter: [0.5, 0.5, 0, 1],
  swapOut: [0.45, 0.4, 1, 0],
  swapIn: [0.15, 0.4, 0, 1],
  // A shadow only one side has comes or goes over the whole tween, as a color fading would.
  in: [0, 1, 0, 1],
  out: [0, 1, 1, 0],
} as const;

export const fade = (tween: Tween, mode: keyof typeof WINDOWS) => {
  const [start, length, from, to] = WINDOWS[mode];

  return motion({ opacity: from })
    .at(tween.at + start * tween.over)
    .to({ opacity: to }, length * tween.over, tween.ease);
};

/** A slide by `(dx, dy)` into place. */
export const slideIn = (tween: Tween, dx: number, dy: number) =>
  motion({ x: dx, y: dy }).at(tween.at).to({ x: 0, y: 0 }, tween.over, tween.ease);
