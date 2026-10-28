export interface Icon {
  /** Side of the square viewBox the paths are drawn on. */
  readonly grid: number;
  /** "stroke" icons are outlines to stroke; "fill" icons are shapes to fill. */
  readonly kind: "stroke" | "fill";
  /** One path per drawn piece, in source order, so each can animate on its own. */
  readonly paths: readonly string[];
}
