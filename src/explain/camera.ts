import { el } from "../el";
import { motion, type Motion, type Span } from "../motion";
import type { Rect } from "../geometry";
import type { Child, SvgNode } from "../svg";

export function Camera({ viewport, stops, over = 0.5, children }: { readonly viewport: { readonly w: number; readonly h: number }; readonly stops: readonly { readonly at: Span; readonly view: Rect | "all" }[]; readonly over?: number; readonly children: Child }): SvgNode {
  if (!(viewport.w > 0 && viewport.h > 0 && over > 0) || !stops.length) throw new Error("Camera needs a positive viewport, transition duration and at least one stop.");
  const values = (view: Rect | "all") => {
    if (view === "all") return { x: 0, y: 0, scale: 1 };
    if (!(view.w > 0 && view.h > 0)) throw new Error("Camera view must have positive dimensions.");
    const scale = Math.min(viewport.w / view.w, viewport.h / view.h);
    return { x: (viewport.w - view.w * scale) / 2 - view.x * scale, y: (viewport.h - view.h * scale) / 2 - view.y * scale, scale };
  };
  let track: Motion<"x" | "y" | "scale"> = motion(values(stops[0]!.view));
  for (const stop of stops.slice(1)) track = track.at(stop.at.at).to(values(stop.view), over);
  return el.g({ style: { transformOrigin: "0 0", transformBox: "view-box" }, animation: track }, children);
}
