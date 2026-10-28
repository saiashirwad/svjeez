import { el } from "../el";
import type { Point, Rect } from "../geometry";
import { ease, motion, type Motion, type Seconds, type Span } from "../motion";
import type { Child, SvgNode } from "../svg";

export interface CameraStop {
  readonly during: Span;
  /** Fit and center this region in the frame. `"all"` leaves the content unmoved. */
  readonly target: Rect | "all";
}

/** The x, y and scale that fit `target` inside `frame`, centered. */
export const fit = (frame: Rect, target: Rect | "all") => {
  if (target === "all") return { x: 0, y: 0, scale: 1 };

  if (!(target.w > 0 && target.h > 0))
    throw new Error(
      `Camera() needs a target with a positive width and height, got ${target.w} by ${target.h}.`,
    );
  const scale = Math.min(frame.w / target.w, frame.h / target.h);

  return {
    x: frame.x + (frame.w - target.w * scale) / 2 - target.x * scale,
    y: frame.y + (frame.h - target.h * scale) / 2 - target.y * scale,
    scale,
  };
};

/** Pan and zoom `children` to each stop's target as the stop starts; a stop at 0 is the opening view, else it opens on `"all"`. Clip it yourself. */
export function Camera({
  frame,
  stops,
  over = 0.5,
  children,
}: {
  readonly frame: Rect;
  readonly stops: readonly CameraStop[];
  readonly over?: Seconds;
  readonly children: Child;
}): SvgNode {
  const track = stops.reduce<Motion<"x" | "y" | "scale">>(
    (t, { during: span, target }) =>
      span.at === 0
        ? t.set(fit(frame, target))
        : t.at(span.at).to(fit(frame, target), over, ease.inOut),
    motion({ x: 0, y: 0, scale: 1 }),
  );

  return el.g(
    { style: { transformOrigin: "0 0", transformBox: "view-box" }, animation: track },
    children,
  );
}

/**
 * Holds `children` at their size on screen while a `Camera` with the same `frame`, `stops` and `over` zooms: it scales
 * them by the inverse of the camera's zoom around `at`, the point they sit on, so a marker or label stays put on the
 * map and stays the same size. Put it inside the `Camera`'s children.
 */
export function Steady({
  frame,
  stops,
  over = 0.5,
  at,
  children,
}: {
  readonly frame: Rect;
  readonly stops: readonly CameraStop[];
  readonly over?: Seconds;
  /** The point `children` is drawn around, in the camera's content space. */
  readonly at: Point;
  readonly children: Child;
}): SvgNode {
  const track = stops.reduce<Motion<"scale">>(
    (t, { during: span, target }) => {
      const scale = 1 / fit(frame, target).scale;

      return span.at === 0 ? t.set({ scale }) : t.at(span.at).to({ scale }, over, ease.inOut);
    },
    motion({ scale: 1 }),
  );

  return el.g({ style: { transformOrigin: `${at.x}px ${at.y}px` }, animation: track }, children);
}
