import { def } from "../defs";
import { el } from "../el";
import type { Rect } from "../geometry";
import { motion, type Seconds, type Span } from "../motion";
import type { Child, SvgNode } from "../svg";
import { during, mergeSpans } from "./timeline";

export interface FocusStop {
  readonly during: Span;
  readonly target: Rect | readonly Rect[];
}

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

  /** Stops that touch merge, so back-to-back stops keep the dim instead of flashing bright between them. */
  const shade = mergeSpans(stops.map((stop) => stop.during)).reduce(
    (track, [at, end]) => {
      const f = Math.min(fade, (end - at) / 2);

      return track
        .at(at)
        .to({ opacity: dim }, f)
        .at(end - f)
        .to({ opacity: 1 }, f);
    },
    motion({ opacity: 1 }),
  );

  const mask = def.mask({}, [
    el.rect({
      x: "-10%",
      y: "-10%",
      width: "120%",
      height: "120%",
      fill: "#fff",
      animation: shade,
    }),
    stops.map((stop) =>
      el.g(
        { animation: during(stop.during, fade) },
        [stop.target]
          .flat()
          .map((r) => el.rect({ x: r.x, y: r.y, width: r.w, height: r.h, fill: "#fff" })),
      ),
    ),
  ]);

  return el.g({ mask }, children);
}
