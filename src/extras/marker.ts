import { el } from "../el";
import { motion, type Motion, type Span } from "../motion";
import type { Rect } from "../geometry";
import type { Color } from "../attributes";
import type { SvgNode } from "../svg";

export function Marker({ stops, color = "#f6c96b", over = 0.4 }: { readonly stops: readonly { readonly during: Span; readonly target: Rect }[]; readonly color?: Color; readonly over?: number }): SvgNode {
  if (!stops.length || !(over > 0)) throw new Error("Marker needs stops and a positive transition duration.");
  const first = stops[0]!.target;
  let position: Motion<"x" | "y"> = motion({ x: 0, y: 0 });
  let size: Motion<"width" | "height"> = motion({ width: first.w, height: first.h });
  for (const { during, target } of stops.slice(1)) {
    position = position.at(during.at).to({ x: target.x - first.x, y: target.y - first.y }, over);
    size = size.at(during.at).to({ width: target.w, height: target.h }, over);
  }
  return el.g({ animation: position }, el.rect({ x: first.x, y: first.y, width: first.w, height: first.h, rx: 6, fill: color, fillOpacity: 0.1, stroke: color, strokeOpacity: 0.4, strokeWidth: 1, animation: size }));
}
