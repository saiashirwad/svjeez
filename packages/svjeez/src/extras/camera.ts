import { el } from "../el";
import type { Point, Rect } from "../geometry";
import { ease, motion, type Motion, type Seconds } from "../motion";
import type { Child, SvgNode } from "../svg";
import { shownSpan, type Shown } from "./timeline";

export type CameraStop = Shown & {
  /** Fit and center this region in the frame. `"all"` leaves the content unmoved. */
  readonly target: Rect | "all";
};

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

interface CameraBase {
  readonly frame: Rect;
  readonly stops: readonly CameraStop[];
  readonly over?: Seconds;
  readonly children: Child;
}

export type CameraProps =
  | (CameraBase & { readonly steady?: false; readonly origin?: undefined })
  | (CameraBase & {
      /** Hold `children` at their size on screen instead of zooming with the camera. Needs `origin`. */
      readonly steady: true;
      /** The point `children` is drawn around, in the camera's content space. */
      readonly origin: Point;
    });

/**
 * Pan and zoom `children` to each stop's target as the stop starts; a stop at 0 is the opening view, else it opens on
 * `"all"`. Clip it yourself.
 *
 * With `steady` it holds `children` at their size on screen while a `Camera` with the same `frame`, `stops` and `over`
 * zooms: it scales them by the inverse of the camera's zoom around `origin`, the point they sit on, so a marker or
 * label stays put on the map and stays the same size. Put it inside the other `Camera`'s children.
 */
export function Camera({
  frame,
  stops,
  over = 0.5,
  steady,
  origin,
  children,
}: CameraProps): SvgNode {
  if (steady) {
    const hold = stops.reduce<Motion<"scale">>(
      (t, stop) => {
        const span = shownSpan(stop.show, stop.during, "Camera()");
        const { target } = stop;
        const scale = 1 / fit(frame, target).scale;

        return span.at === 0 ? t.set({ scale }) : t.at(span.at).to({ scale }, over, ease.inOut);
      },
      motion({ scale: 1 }),
    );

    return el.g(
      { style: { transformOrigin: `${origin.x}px ${origin.y}px` }, animation: hold },
      children,
    );
  }

  const track = stops.reduce<Motion<"x" | "y" | "scale">>(
    (t, stop) => {
      const { at } = shownSpan(stop.show, stop.during, "Camera()");

      return at === 0
        ? t.set(fit(frame, stop.target))
        : t.at(at).to(fit(frame, stop.target), over, ease.inOut);
    },
    motion({ x: 0, y: 0, scale: 1 }),
  );

  return el.g(
    { style: { transformOrigin: "0 0", transformBox: "view-box" }, animation: track },
    children,
  );
}

/** @deprecated use `<Camera steady origin={...}>`, where `origin` is this `at` */
export function Steady({
  at,
  ...rest
}: CameraBase & {
  /** The point `children` is drawn around, in the camera's content space. */
  readonly at: Point;
}): SvgNode {
  return Camera({ ...rest, steady: true, origin: at });
}
