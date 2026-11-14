/** The file's frame in px, and how long its loop runs in seconds. */
export const W = 640;
export const H = 400;
export const DURATION = 8;

/** The moment the file holds still at under reduced motion. */
export const STILL_AT = 0.4;

export interface Pt {
  readonly x: number;
  readonly y: number;
}

export const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: Pt, b: Pt, k = 1): Pt => ({ x: a.x + b.x * k, y: a.y + b.y * k });

export const unit = (a: Pt): Pt => {
  const l = Math.hypot(a.x, a.y) || 1;

  return { x: a.x / l, y: a.y / l };
};
