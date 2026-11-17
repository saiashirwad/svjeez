/** @jsxImportSource svjeez */
import { motion, type Motion } from "../motion";
import type { Rect } from "../geometry";
import type { Color } from "../attributes";
import { defaultDark } from "./theme";
import type { SvgNode } from "../svg";
import type { Shown } from "./timeline";
import { span } from "../span";

/**
 * A soft box that glides between the targets of `stops`: appears at the first stop's `show.at`, moves at each
 * later one's. A stop's `over` is not used. `color` defaults to the dark scheme's accent.
 */
export function Marker({
  stops,
  color = defaultDark.base09,
  over = 0.4,
}: {
  readonly stops: readonly (Shown & { readonly target: Rect })[];
  readonly color?: Color;
  readonly over?: number;
}): SvgNode {
  if (stops.length === 0) throw new Error("Marker() needs at least one stop, got none.");

  if (!(over > 0)) throw new Error(`Marker() needs a positive over, got ${over}.`);
  const first = stops[0]!.target;
  let position: Motion<"x" | "y"> = motion({ x: 0, y: 0 });
  const start = stops[0]!.show.at;

  let size: Motion<"width" | "height" | "opacity"> = motion({
    width: first.w,
    height: first.h,
    opacity: start > 0 ? 0 : 1,
  });

  if (start > 0) size = size.to({ opacity: 1 }, span(start, over));

  for (const stop of stops.slice(1)) {
    const { target } = stop;
    const { at } = stop.show;
    position = position.to({ x: target.x - first.x, y: target.y - first.y }, span(at, over));
    size = size.to({ width: target.w, height: target.h }, span(at, over));
  }

  return (
    <g animation={position}>
      <rect
        x={first.x}
        y={first.y}
        width={first.w}
        height={first.h}
        rx={8}
        fill={color}
        fillOpacity={0.14}
        animation={size}
      />
    </g>
  );
}
