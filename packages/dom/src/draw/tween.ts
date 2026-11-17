import { motion, span, type Ease } from "svjeez";

export interface Tween {
  readonly at: number;
  readonly over: number;
  readonly ease: Ease;
}

const WINDOWS = {
  exit: [0, 0.5, 1, 0],
  enter: [0.5, 0.5, 0, 1],
  swapOut: [0.45, 0.4, 1, 0],
  swapIn: [0.15, 0.4, 0, 1],
  textOut: [0, 0.45, 1, 0],
  handOut: [0, 0.7, 1, 0],
  handIn: [0.15, 0.55, 0, 1],
  textIn: [0.45, 0.55, 0, 1],
  in: [0, 1, 0, 1],
  out: [0, 1, 1, 0],
} as const;

export const fade = (tween: Tween, mode: keyof typeof WINDOWS) => {
  const [start, length, from, to] = WINDOWS[mode];

  return motion({ opacity: from }).to(
    { opacity: to },
    span(tween.at + start * tween.over, length * tween.over),
    tween.ease,
  );
};

export const slideIn = (tween: Tween, dx: number, dy: number) =>
  motion({ x: dx, y: dy }).to({ x: 0, y: 0 }, span(tween.at, tween.over), tween.ease);
