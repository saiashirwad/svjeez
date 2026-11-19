import type { Color } from "svjeez/tools";
import { mix, type Look } from "./kit.tsx";

/** The i-th categorical color of a diagram's palette; past the last it repeats, softened. */
export const series = (l: Look, i: number): Color => {
  const base = l.series[i % l.series.length]!;
  const round = Math.floor(i / l.series.length);

  return round === 0 ? base : mix(base, l.colors.background, Math.max(0.35, 0.75 - round * 0.2));
};
