import type { Animated, Box, SceneNode, Vec } from "../model/ir";
import { isLane } from "../model/lane";
import type { Place } from "./refs";

/**
 * Which point of a node `at` names: a place on its box, or two fractions of it, across and down, so `[0.5, 1]` is
 * the middle of the bottom edge. The box is what the node paints, a shape's stroke included.
 */
export type AnchorPlace = Place | readonly [across: number, down: number];

/** What a text's `anchor` also takes: a point on its first line's baseline, at the start, middle or end of its column. */
export type TextAnchorPlace = AnchorPlace | "baseline-left" | "baseline" | "baseline-right";

/** The nine places on a box, as fractions across and down. A ref names the same points: `"top-left"` is `card.topLeft`. */
export const PLACES = {
  "top-left": [0, 0],
  top: [0.5, 0],
  "top-right": [1, 0],
  left: [0, 0.5],
  center: [0.5, 0.5],
  right: [1, 0.5],
  "bottom-left": [0, 1],
  bottom: [0.5, 1],
  "bottom-right": [1, 1],
} as const satisfies Readonly<Record<Place, readonly [number, number]>>;

/** Every place, quoted and listed, for an error that says what to write. */
export const PLACE_LIST = Object.keys(PLACES)
  .map((name) => `"${name}"`)
  .join(", ");

const BASELINE = {
  "baseline-left": 0,
  baseline: 0.5,
  "baseline-right": 1,
} as const;

const isPlace = (name: Exclude<TextAnchorPlace, readonly number[]>): name is keyof typeof PLACES =>
  Object.hasOwn(PLACES, name);

const isBaseline = (
  name: Exclude<TextAnchorPlace, readonly number[]>,
): name is keyof typeof BASELINE => Object.hasOwn(BASELINE, name);

const isPair = (value: TextAnchorPlace | undefined): value is readonly [number, number] =>
  Array.isArray(value) && value.length === 2 && value.every((n) => Number.isFinite(n));

const isName = (
  value: TextAnchorPlace | undefined,
): value is Exclude<TextAnchorPlace, readonly number[]> => typeof value === "string";

/**
 * The point of a node's own frame that `anchor` names on `box`, the top-left when it names none. `baseline` is where a text's first baseline is
 * down its frame; only a text has one. `where` names the node, as `"card"`.
 */
export const pinned = (
  anchor: TextAnchorPlace | undefined,
  box: Box,
  where: string,
  baseline?: number,
): Vec => {
  if (anchor === undefined) return [box.x, box.y];
  // An untyped caller may write anything, so each form is checked for what it is.
  const named = isName(anchor) && isPlace(anchor) ? PLACES[anchor] : undefined;
  const along = isName(anchor) && isBaseline(anchor) ? BASELINE[anchor] : undefined;

  if (!named && !isPair(anchor) && along === undefined)
    throw new Error(
      `anchor on ${where} takes a place, one of ${PLACE_LIST}${baseline === undefined ? "" : ', or on a text "baseline-left", "baseline" or "baseline-right"'}, or two fractions of the box such as [0.5, 1], got ${isName(anchor) ? `"${anchor}"` : JSON.stringify(anchor)}.`,
    );

  if (along !== undefined && baseline === undefined)
    throw new Error(
      `anchor="${String(anchor)}" on ${where} names a baseline, which only a <Text> has. Use a place on the box, such as "bottom".`,
    );

  if (box.width === 0 && box.height === 0)
    throw new Error(
      `anchor on ${where} names a point of its box, but the box is empty: it draws nothing at rest. Drop anchor and place it by at alone.`,
    );

  if (along !== undefined) return [box.x + box.width * along, baseline!];
  const [u, v] = named ?? (isPair(anchor) ? anchor : [0, 0]);

  return [box.x + box.width * u, box.y + box.height * v];
};

/** Whether an outline has coordinates of its own, which stay where they are written when the shape has no `at`. */
export const hasCoordinates = (kind: string): boolean =>
  kind === "line" || kind === "polygon" || kind === "path";

/**
 * The point of a node's frame that its `at` names, given the kind it was written as, its `anchor` and its final `box`: a point of the
 * box, the top-left unless `anchor` says, or for a group or an instance with no anchor, the frame's own origin.
 */
export const homeOf = (
  kind: SceneNode["kind"],
  node: SceneNode,
  anchor: TextAnchorPlace | undefined,
  box: Box,
): Vec => {
  const where = `"${node.key}"`;

  if (kind === "group" || kind === "instance")
    return anchor === undefined ? [0, 0] : pinned(anchor, box, where);

  return pinned(anchor, box, where, kind === "text" ? baselineOf(node) : undefined);
};

/** How far down its frame a text's first baseline is: a morph's crossfade holds texts in a group, each in its frame. */
export const baselineOf = (node: SceneNode): number => {
  if (node.kind === "text") return node.lines[0]?.at[1] ?? 0;

  return node.kind === "group" && node.children[0] ? baselineOf(node.children[0]) : 0;
};

export const minus = ([x, y]: Vec, [dx, dy]: Vec): Vec => [x - dx, y - dy];

/** An `at` that puts the point `home` of the node's frame where it said, moved to put the frame's origin there. */
export const homed = (at: Animated<Vec>, home: Vec): Animated<Vec> => {
  if (home[0] === 0 && home[1] === 0) return at;

  if (!isLane(at)) return minus(at, home);

  // A curved key's control points move with it, so the curve keeps its shape.
  const [head, next, ...rest] = at.keys.map((key) => ({
    ...key,
    value: minus(key.value, home),
    ...(key.via && { via: [minus(key.via[0], home), minus(key.via[1], home)] as const }),
  }));

  return { ...at, keys: [head!, next!, ...rest] };
};
