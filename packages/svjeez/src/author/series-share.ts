import { isArray, isString } from "../model/guards";
import { SceneError } from "../model/scene-error";
import type { Seconds } from "../model/time";
import type { Curve } from "./spring";

/** What a `<Series share>` tweens across its seams. */
export interface SeriesShare {
  /** The key, or keys, of the nodes that carry over: one node with that key in each child that has it. */
  readonly keys: string | readonly string[];
  /**
   * Seconds the tween takes, centered on the seam. Left out, it is the overlap of the two children (with a negative
   * `gap`), and with no overlap the node snaps from one child's version to the next.
   */
  readonly over?: Seconds;
  readonly curve?: Curve;
}

export type Share = string | readonly string[] | SeriesShare;

export interface Seams {
  readonly keys: readonly string[];
  readonly over?: Seconds;
  readonly curve?: Curve;
}

export const seamsOf = (share: Share): Seams => {
  const given: SeriesShare = isString(share) || isArray(share) ? { keys: share } : share;
  const keys = isString(given.keys) ? [given.keys] : [...given.keys];

  if (keys.length === 0 || keys.some((key) => !isString(key) || key === ""))
    throw new SceneError(
      `<Series share> needs one key or more, got ${JSON.stringify(given.keys)}.`,
      'Name the keyed node every child draws, as in <Series share="horizon">.',
    );

  if (given.over !== undefined && !(given.over >= 0 && Number.isFinite(given.over)))
    throw new SceneError(`<Series share> needs an over of 0 or more seconds, got ${given.over}.`);

  return {
    keys,
    ...(given.over !== undefined && { over: given.over }),
    ...(given.curve !== undefined && { curve: given.curve }),
  };
};
