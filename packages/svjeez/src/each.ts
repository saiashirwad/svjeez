import { stagger, type Span, type Spanned } from "./span";
import type { Seconds } from "./motion";

/** What a per-piece `animation` callback is told about the piece it is building, and how many there are. */
export interface Each {
  /** Where this piece is in the run, from 0. */
  readonly index: number;
  /** How many pieces the run has, so a cascade needs no count of its own. */
  readonly count: number;
  /** This piece's span in a `stagger(first, count, step)` over every piece: `draw(each.stagger(span(0.2, 0.9), 0.07))`. */
  stagger(first: Span, step: Seconds): Spanned;
}

export const eachOf = (index: number, count: number): Each => ({
  index,
  count,
  stagger: (first, step) => stagger(first, count, step)[index]!,
});
