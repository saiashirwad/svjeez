import { SceneError } from "../model/scene-error";
import type { Names } from "./names";
import type { Animated, Box, SceneNode, Vec } from "../model/ir";
import { isLane } from "../model/lane";
import type { Place } from "./refs";
import { isPoint } from "../model/guards";
import { sub } from "../model/vec";

/** Where on a box an anchor pins: one of the nine places, or two fractions `[across, down]` of the box. */
export type AnchorPlace = Place | readonly [across: number, down: number];

/**
 * What `anchor` takes on a `<Text>`: an AnchorPlace ("top-left", "top", "top-right", "left", "center", "right",
 * "bottom-left", "bottom", "bottom-right", or `[across, down]`) or a point on the text's baseline: "baseline-left",
 * "baseline" (centered) or "baseline-right".
 */
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
} as const satisfies Readonly<Record<string, Vec>>;

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

  if (!named && !isPoint(anchor) && along === undefined)
    throw new SceneError(
      `anchor on ${where} takes a place, one of ${PLACE_LIST}${baseline === undefined ? "" : ', or on a text "baseline-left", "baseline" or "baseline-right"'}, or two fractions of the box such as [0.5, 1], got ${isName(anchor) ? `"${anchor}"` : JSON.stringify(anchor)}.`,
    );

  if (along !== undefined && baseline === undefined)
    throw new SceneError(
      `anchor="${String(anchor)}" on ${where} names a baseline, which only a <Text> has. Use a place on the box, such as "bottom".`,
    );

  if (box.width === 0 && box.height === 0)
    throw new SceneError(
      `anchor on ${where} names a point of its box, but the box is empty: it draws nothing at rest. Drop anchor and place it by at alone.`,
    );

  if (along !== undefined) return [box.x + box.width * along, baseline!];
  const [u, v] = named ?? (isPoint(anchor) ? anchor : [0, 0]);

  return [box.x + box.width * u, box.y + box.height * v];
};

export const homeOf = (
  names: Names,
  kind: SceneNode["kind"],
  node: SceneNode,
  anchor: TextAnchorPlace | undefined,
  box: Box,
  framed = false,
): Vec => {
  if (framed) return [0, 0];

  return pinned(anchor, box, names.named(node.key), kind === "text" ? baselineOf(node) : undefined);
};

const baselineOf = (node: SceneNode): number => {
  if (node.kind === "text") return node.lines[0]?.at[1] ?? 0;

  return node.kind === "group" && node.children[0] ? baselineOf(node.children[0]) : 0;
};

export const homed = (at: Animated<Vec>, home: Vec): Animated<Vec> => {
  if (home[0] === 0 && home[1] === 0) return at;

  if (!isLane(at)) return sub(at, home);

  const [head, next, ...rest] = at.keys.map((key) => ({
    ...key,
    value: sub(key.value, home),
    ...(key.via && { via: [sub(key.via[0], home), sub(key.via[1], home)] as const }),
  }));

  return { ...at, keys: [head!, next!, ...rest] };
};
