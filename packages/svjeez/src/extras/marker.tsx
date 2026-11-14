/** @jsxImportSource svjeez */
import { motion, type Motion } from "../motion";
import type { Rect } from "../geometry";
import type { Color } from "../attributes";
import { defaultDark, type Base16 } from "./theme";
import type { SvgNode } from "../svg";
import type { Shown } from "./timeline";

export function Marker({
  stops,
  theme = defaultDark,
  color = theme.base09,
  over = 0.4,
}: {
  readonly stops: readonly (Shown & { readonly target: Rect })[];
  readonly theme?: Base16;
  readonly color?: Color;
  readonly over?: number;
}): SvgNode {
  if (stops.length === 0) throw new Error("Marker() needs at least one stop, got none.");

  if (!(over > 0)) throw new Error(`Marker() needs a positive over, got ${over}.`);
  const first = stops[0]!.target;
  let position: Motion<"x" | "y"> = motion({ x: 0, y: 0 });
  let size: Motion<"width" | "height"> = motion({ width: first.w, height: first.h });

  for (const stop of stops.slice(1)) {
    const { target } = stop;
    const { at } = stop.show;
    position = position.at(at).to({ x: target.x - first.x, y: target.y - first.y }, over);
    size = size.at(at).to({ width: target.w, height: target.h }, over);
  }

  return (
    <g animation={position}>
      <rect
        x={first.x}
        y={first.y}
        width={first.w}
        height={first.h}
        rx={6}
        fill={color}
        fillOpacity={0.1}
        stroke={color}
        strokeOpacity={0.4}
        strokeWidth={1}
        animation={size}
      />
    </g>
  );
}
