import { el } from "../el";
import type { Rect } from "../geometry";
import { ease, motion, type Motion, type Seconds, type Span } from "../motion";
import type { Child, SvgNode } from "../svg";

export interface CameraStop {
  readonly at: Span;
  /** Fit and center this region in the frame. `"all"` leaves the content unmoved. */
  readonly view: Rect | "all";
}

/** The x, y and scale that fit `view` inside `frame`, centered. */
export const fit = (frame: Rect, view: Rect | "all") => {
  if (view === "all") return { x: 0, y: 0, scale: 1 };
  if (!(view.w > 0 && view.h > 0)) throw new Error("A camera view needs a positive width and height.");
  const scale = Math.min(frame.w / view.w, frame.h / view.h);
  return { x: frame.x + (frame.w - view.w * scale) / 2 - view.x * scale, y: frame.y + (frame.h - view.h * scale) / 2 - view.y * scale, scale };
};

/** Pan and zoom `children` to each stop's view as the stop starts; a stop at 0 is the opening view, else it opens on `"all"`. Clip it yourself. */
export function Camera({ frame, stops, over = 0.5, children }: { readonly frame: Rect; readonly stops: readonly CameraStop[]; readonly over?: Seconds; readonly children: Child }): SvgNode {
  const track = stops.reduce<Motion<"x" | "y" | "scale">>(
    (t, { at, view }) => (at.at === 0 ? t.set(fit(frame, view)) : t.at(at.at).to(fit(frame, view), over, ease.inOut)),
    motion({ x: 0, y: 0, scale: 1 }),
  );
  return el.g({ style: { transformOrigin: "0 0", transformBox: "view-box" }, animation: track }, children);
}
