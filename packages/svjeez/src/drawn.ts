import type { Rect } from "./geometry";
import type { Spanned } from "./span";
import type { SvgNode } from "./svg";

/**
 * One piece of a drawn result that a scene can point at: a bar, a region, a diagram node, a part of a formula. A
 * package adds its own geometry (a point, path data, a centroid) as extra fields.
 */
export interface Part<Id extends string = string> {
  readonly id: Id;
  /** Where the part sits once it has played, in scene px. */
  readonly box: Rect;
  /**
   * When the part plays: a bar grows, a region fills, a node appears. A part that is there from the start has the
   * instant `span(0, 0)`. Place what follows it with `part.span.next(…)` or `part.span.end`.
   */
  readonly span: Spanned;
}

/**
 * What a package that lays out at compile time hands back once it has drawn: the node to put in the scene, when it
 * plays, the box it covers, and its parts by id. Charts, maps, formulas and diagrams all return one, so an
 * annotation reads the same `part(id).box` and `part(id).span` whichever drew it.
 */
export interface Drawn<P extends Part = Part> {
  readonly node: SvgNode;
  /** From the first part starting to play to the last one finishing. The instant 0 when nothing plays. */
  readonly span: Spanned;
  /** Everything drawn, in scene px. */
  readonly bounds: Rect;
  /** Every part, in the order it is drawn. */
  readonly parts: readonly P[];
  /** The part with this id. Throws, naming some that exist, when none has it. */
  part(id: P["id"]): P;
}
