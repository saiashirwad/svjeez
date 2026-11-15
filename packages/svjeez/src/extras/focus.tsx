/** @jsxImportSource svjeez */
import { def } from "../defs";
import type { Rect } from "../geometry";
import { motion, type Seconds } from "../motion";
import type { Child, SvgNode } from "../svg";
import { mergeSpans, show, type Shown } from "./timeline";

export type FocusStop = Shown & {
  readonly target: Rect | readonly Rect[];
};

/** Dim `children` to `dim` except the stop's rects, during each stop. A mask, so it works over any background. */
export function Focus({
  stops,
  dim = 0.3,
  fade = 0.3,
  children,
}: {
  readonly stops: readonly FocusStop[];
  readonly dim?: number;
  readonly fade?: Seconds;
  readonly children: Child;
}): SvgNode {
  if (!(dim >= 0 && dim <= 1)) throw new Error(`Focus() needs dim between 0 and 1, got ${dim}.`);

  if (!(fade >= 0 && Number.isFinite(fade)))
    throw new Error(`Focus() needs a fade of 0 or more, got ${fade}.`);

  /** Stops that touch merge, so back-to-back stops keep the dim instead of flashing bright between them. With `fade: 0` the dim cuts, as `show()` does. */
  const shade = mergeSpans(stops.map((stop) => stop.show)).reduce(
    (track, [at, end]) => {
      if (fade === 0) {
        const on = track.at(at).set({ opacity: dim });

        return end === Infinity ? on : on.at(end).set({ opacity: 1 });
      }

      const f = Math.min(fade, (end - at) / 2);
      const on = track.at(at).to({ opacity: dim }, f);

      return end === Infinity ? on : on.at(end - f).to({ opacity: 1 }, f);
    },
    motion({ opacity: 1 }),
  );

  const mask = def.mask({}, [
    <rect x="-10%" y="-10%" width="120%" height="120%" fill="#fff" animation={shade} />,
    stops.map((stop) => (
      <g animation={show(stop.show, { fade })}>
        {[stop.target].flat().map((r) => (
          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#fff" />
        ))}
      </g>
    )),
  ]);

  return <g mask={mask}>{children}</g>;
}
