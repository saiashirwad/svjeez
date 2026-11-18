import type { Animated, Box, SceneNode, Vec } from "../model/ir";
import { isLane } from "../model/lane";
import type { Place } from "./refs";

export type AnchorPlace = Place | readonly [across: number, down: number];

export type TextAnchorPlace = AnchorPlace | "baseline-left" | "baseline" | "baseline-right";

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

export const pinned = (
  anchor: TextAnchorPlace | undefined,
  box: Box,
  where: string,
  baseline?: number,
): Vec => {
  if (anchor === undefined) return [box.x, box.y];
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

export const hasCoordinates = (kind: string): boolean =>
  kind === "line" || kind === "polygon" || kind === "path";

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

export const baselineOf = (node: SceneNode): number => {
  if (node.kind === "text") return node.lines[0]?.at[1] ?? 0;

  return node.kind === "group" && node.children[0] ? baselineOf(node.children[0]) : 0;
};

export const minus = ([x, y]: Vec, [dx, dy]: Vec): Vec => [x - dx, y - dy];

export const homed = (at: Animated<Vec>, home: Vec): Animated<Vec> => {
  if (home[0] === 0 && home[1] === 0) return at;

  if (!isLane(at)) return minus(at, home);

  const [head, next, ...rest] = at.keys.map((key) => ({
    ...key,
    value: minus(key.value, home),
    ...(key.via && { via: [minus(key.via[0], home), minus(key.via[1], home)] as const }),
  }));

  return { ...at, keys: [head!, next!, ...rest] };
};
