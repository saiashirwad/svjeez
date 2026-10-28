import type { Point } from "./layout/box";

export type { Point };

export type Edge = "top" | "right" | "bottom" | "left";

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly top: Point;
  readonly right: Point;
  readonly bottom: Point;
  readonly left: Point;
  readonly center: Point;
  pad(n: number): Rect;
  union(other: Rect): Rect;
  /** The point `t` of the way along `edge`, left to right or top to bottom. */
  side(edge: Edge, t: number): Point;
}

export const rect = (x: number, y: number, w: number, h: number): Rect => ({
  x,
  y,
  w,
  h,
  top: { x: x + w / 2, y },
  right: { x: x + w, y: y + h / 2 },
  bottom: { x: x + w / 2, y: y + h },
  left: { x, y: y + h / 2 },
  center: { x: x + w / 2, y: y + h / 2 },
  pad: (n) => rect(x - n, y - n, w + n * 2, h + n * 2),
  union: (o) => {
    const [left, top] = [Math.min(x, o.x), Math.min(y, o.y)];
    return rect(left, top, Math.max(x + w, o.x + o.w) - left, Math.max(y + h, o.y + o.h) - top);
  },
  side: (edge, t) =>
    edge === "top" || edge === "bottom" ? { x: x + w * t, y: edge === "top" ? y : y + h } : { x: edge === "left" ? x : x + w, y: y + h * t },
});
