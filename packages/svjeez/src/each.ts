import { stagger, type Span, type Spanned } from "./span";
import type { Seconds } from "./motion";

export interface Each {
  readonly index: number;
  readonly count: number;
  /** This piece's span in a `stagger(first, count, step)` over every piece: `draw(each.stagger(span(0.2, 0.9), 0.07))`. */
  stagger(first: Span, step: Seconds): Spanned;
}

export const eachOf = (index: number, count: number): Each => ({
  index,
  count,
  stagger: (first, step) => stagger(first, count, step)[index]!,
});
