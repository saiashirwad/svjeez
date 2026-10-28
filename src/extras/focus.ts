import { def } from "../defs";
import { el } from "../el";
import type { Rect } from "../geometry";
import { motion, type Seconds, type Span } from "../motion";
import type { Child, SvgNode } from "../svg";
import { during } from "./timeline";

export interface FocusStop {
  readonly during: Span;
  readonly target: Rect | readonly Rect[];
}

/** Merge spans that touch, so back-to-back stops keep the dim instead of flashing bright between them. */
const merged = (spans: readonly Span[]): Span[] =>
  [...spans]
    .sort((a, b) => a.at - b.at)
    .reduce<Span[]>((out, span) => {
      const last = out.at(-1);
      if (last && span.at <= last.at + last.over) out[out.length - 1] = { at: last.at, over: Math.max(last.over, span.at + span.over - last.at) };
      else out.push(span);
      return out;
    }, []);

/** Dim `children` to `dim` except the stop's rects, during each stop. A mask, so it works over any background. */
export function Focus({ stops, dim = 0.3, fade = 0.3, children }: { readonly stops: readonly FocusStop[]; readonly dim?: number; readonly fade?: Seconds; readonly children: Child }): SvgNode {
  if (!(dim >= 0 && dim <= 1)) throw new Error(`Focus() needs dim between 0 and 1, got ${dim}.`);
  const shade = merged(stops.map((stop) => stop.during)).reduce((track, { at, over }) => {
    const f = Math.min(fade, over / 2);
    return track.at(at).to({ opacity: dim }, f).at(at + over - f).to({ opacity: 1 }, f);
  }, motion({ opacity: 1 }));
  const mask = def.mask({}, [
    el.rect({ x: "-10%", y: "-10%", width: "120%", height: "120%", fill: "#fff", animation: shade }),
    stops.map((stop) => el.g({ animation: during(stop.during, fade) }, [stop.target].flat().map((r) => el.rect({ x: r.x, y: r.y, width: r.w, height: r.h, fill: "#fff" })))),
  ]);
  return el.g({ mask }, children);
}
