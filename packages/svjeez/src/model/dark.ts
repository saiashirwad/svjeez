import type { Animated, Scene, SceneNode } from "./ir";
import { isLane } from "./lane";
import { wrapped } from "./sample";
import { EPSILON, isHold, type Seconds } from "./time";

export type Stretch = readonly [from: Seconds, to: Seconds];

const CLEAR = 1e-6;

/** The stretches, sorted and apart, that cover every stretch given. */
export const merged = (stretches: readonly Stretch[]): Stretch[] => {
  const sorted = [...stretches].sort((a, b) => a[0] - b[0]);
  const out: [Seconds, Seconds][] = [];

  for (const [from, to] of sorted) {
    const last = out.at(-1);

    if (last && from <= last[1] + CLEAR) last[1] = Math.max(last[1], to);
    else out.push([from, to]);
  }

  return out;
};

/** When an opacity holds at 0, so nothing under it shows: sorted, merged stretches of the scene's `duration`. */
export const darkOf = (opacity: Animated<number>, duration: Seconds): Stretch[] => {
  if (!isLane(opacity)) return opacity <= CLEAR ? [[0, duration]] : [];
  const keys = wrapped(opacity, duration);
  const [first, last] = [keys[0]!, keys.at(-1)!];
  const out: Stretch[] = [];

  if (first.value <= CLEAR && first.t > 0) out.push([0, first.t]);

  for (let i = 1; i < keys.length; i++) {
    const [a, b] = [keys[i - 1]!, keys[i]!];

    if (a.value <= CLEAR && (b.value <= CLEAR || isHold(b.ease))) out.push([a.t, b.t]);
  }

  if (last.value <= CLEAR && last.t < duration) out.push([last.t, duration]);

  return merged(out);
};

/** When none of `nodes` shows, any one of them being at opacity 0 enough. */
export const hiddenOf = (nodes: readonly SceneNode[], duration: Seconds): Stretch[] =>
  merged(nodes.flatMap((node) => node.layers.flatMap((layer) => darkOf(layer.opacity, duration))));

/** What of `stretches` falls outside `dark`. */
export const outside = (stretches: readonly Stretch[], dark: readonly Stretch[]): Stretch[] =>
  stretches.flatMap((stretch) =>
    dark.reduce<Stretch[]>(
      (left, [from, to]) =>
        left.flatMap(([a, b]): Stretch[] => {
          if (to <= a + CLEAR || from >= b - CLEAR) return [[a, b]];

          return [
            ...(from > a + CLEAR ? [[a, from] as const] : []),
            ...(to < b - CLEAR ? [[to, b] as const] : []),
          ];
        }),
      [stretch],
    ),
  );

/** Seconds a cull keeps a node drawn on each side of a dark stretch, so a SMIL clock a little off the CSS one never hides it while it shows. */
const MARGIN = 0.5;

/** The shortest dark stretch, past its margins, worth a cull. */
const LEAST = 1;

/**
 * When the SVG stops drawing a group that fades to 0 and holds there: moving content under an animated opacity is
 * otherwise drawn, filters and all, every frame it is invisible. The caller says whether anything inside moves and
 * whether the group runs on a page clock (then it is never culled). Only when the still frame has the group at 0 too,
 * since reduced motion freezes the CSS but not the SMIL that culls it.
 */
export const culledOf = (
  node: SceneNode,
  scene: Pick<Scene, "duration" | "loop" | "still">,
  { moves, clocked }: { readonly moves: boolean; readonly clocked: boolean },
): Stretch[] => {
  const { duration, loop, still } = scene;

  if (
    node.kind !== "group" ||
    clocked ||
    !moves ||
    !node.layers.some((layer) => isLane(layer.opacity))
  )
    return [];
  const dark = hiddenOf([node], duration);

  if (still !== undefined && !dark.some(([from, to]) => still >= from && still <= to)) return [];
  const wraps = dark[0]?.[0] === 0 && dark.at(-1)?.[1] === duration;
  const free = !loop || wraps;

  return dark.flatMap(([from, to]): Stretch[] => {
    const start = from <= EPSILON && free ? 0 : from + MARGIN;
    const end = to >= duration - EPSILON && free ? duration : to - MARGIN;

    return end - start >= LEAST ? [[start, end]] : [];
  });
};
