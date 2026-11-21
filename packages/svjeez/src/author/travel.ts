import { SceneError } from "../model/scene-error";
import { isLane } from "../model/lane";
import type { Lane, SceneNode, Vec } from "../model/ir";
import type { Names } from "./names";
import { isPlaced, placedLike } from "./identity";
import { same } from "../model/steps";

export const shifted = (lane: Lane<Vec>, move: (value: Vec) => Vec): Lane<Vec> => {
  const [head, next, ...rest] = lane.keys.map((key) => ({
    ...key,
    value: move(key.value),
    ...(key.via && { via: [move(key.via[0]), move(key.via[1])] as const }),
  }));

  return { ...lane, keys: [head!, next!, ...rest] };
};

interface Spot {
  readonly node: SceneNode;
  /** The groups above it, outermost first. */
  readonly chain: readonly SceneNode[];
}

const leafOf = (key: string): string => key.slice(key.lastIndexOf("/") + 1);

const spotsOf = (list: readonly SceneNode[], chain: readonly SceneNode[] = []): Spot[] =>
  list.flatMap((node) => [
    { node, chain },
    ...(node.kind === "group" ? spotsOf(node.children, [...chain, node]) : []),
  ]);

/** How far the groups between a node and the group it travels in carry it. */
const carried = (names: Names, key: string, chain: readonly SceneNode[]): Vec => {
  let x = 0;
  let y = 0;

  for (const group of chain) {
    const still =
      !isLane(group.at) &&
      group.layers.every(
        (layer) =>
          !isLane(layer.offset) &&
          layer.rotate === 0 &&
          same(layer.scale, [1, 1]) &&
          layer.skew === 0 &&
          layer.opacity === 1,
      );

    if (!still)
      throw new SceneError(
        `morph() can't carry "${leafOf(key)}" out of ${names.named(group.key)}: that container moves, turns, scales or fades inside a state, and a node that changes containers travels on its own.`,
        "Keep the containers it leaves and enters still in every state (a morph moves them between states), or key the node differently in each container so it fades out and in.",
        names.whereOf(group.key),
      );

    if (group.clip !== undefined || group.mask !== undefined)
      throw new SceneError(
        `morph() can't carry "${leafOf(key)}" out of ${names.named(group.key)}: it clips or masks its children, and a travelling node would leave the clip.`,
        "Drop the clip or mask on the container, or key the node differently in each container so it fades out and in.",
        names.whereOf(group.key),
      );

    // SAFETY: the check above found each of these still, so each is a plain point.
    for (const offset of [group.at, ...group.layers.map((layer) => layer.offset)] as Vec[]) {
      const [dx, dy] = offset;

      x += dx;
      y += dy;
    }
  }

  return [x, y];
};

const renamed = (node: SceneNode, from: string, to: string): SceneNode => {
  const key = to + node.key.slice(from.length);

  const copy: SceneNode =
    node.kind === "group"
      ? { ...node, key, children: node.children.map((child) => renamed(child, from, to)) }
      : { ...node, key };

  return placedLike(copy, node);
};

const moved = (node: SceneNode, [dx, dy]: Vec): SceneNode => {
  const move = (at: Vec): Vec => [at[0] + dx, at[1] + dy];

  return placedLike(
    { ...node, at: isLane(node.at) ? shifted(node.at, move) : move(node.at) },
    node,
  );
};

const commonPrefix = (chains: readonly (readonly SceneNode[])[]): number => {
  const [first, ...rest] = chains;
  let length = first!.length;

  for (const chain of rest) {
    let same = 0;

    while (same < length && same < chain.length && chain[same]!.key === first![same]!.key) same++;
    length = same;
  }

  return length;
};

/**
 * A node keyed alike in several states, once in each, but under different parents, is one node that
 * changes containers. It is taken out of its containers and put after everything else in the closest
 * container its states share, so it travels above the ones it leaves and enters, and keeps the key
 * it has in the last state it is in. A key that repeats inside a state keeps matching per parent.
 */
export const travelling = (
  states: readonly (readonly SceneNode[])[],
  names: Names,
): readonly (readonly SceneNode[])[] => {
  const all = states.map((list) => spotsOf(list));
  const found = new Map<string, (Spot | undefined)[]>();
  const repeats = new Set<string>();

  all.forEach((spots, s) => {
    for (const spot of spots) {
      if (isPlaced(spot.node)) continue;
      const leaf = leafOf(spot.node.key);
      const seen = found.get(leaf) ?? states.map(() => undefined);

      if (seen[s]) repeats.add(leaf);
      found.set(leaf, seen.with(s, spot));
    }
  });

  const changes = [...found].filter(([leaf, seen]) => {
    const present = seen.filter((spot) => spot !== undefined);

    return (
      !repeats.has(leaf) &&
      present.length > 1 &&
      present.some((spot) => parentOf(spot.node.key) !== parentOf(present[0]!.node.key))
    );
  });

  const leaves = new Set(changes.map(([leaf]) => leaf));

  // What sits inside a travelling node goes with it.
  const travellers = changes.filter(([, seen]) =>
    seen.every((spot) => spot === undefined || !spot.chain.some((g) => leaves.has(leafOf(g.key)))),
  );

  if (travellers.length === 0) return states;

  const removing = states.map(() => new Set<SceneNode>());
  const adding = states.map(() => new Map<string, SceneNode[]>());

  for (const [, seen] of travellers) {
    const present = seen.flatMap((spot, s) => (spot ? [{ spot, s }] : []));
    const depth = commonPrefix(present.map(({ spot }) => spot.chain));
    const home = present.at(-1)!.spot.node.key;

    for (const { spot, s } of present) {
      const shift = carried(names, spot.node.key, spot.chain.slice(depth));
      const container = spot.chain[depth - 1]?.key ?? "";
      const node = moved(renamed(spot.node, spot.node.key, home), shift);

      for (const key of subtree(node)) {
        const before = names.entryOf(key.replace(home, spot.node.key));

        if (before && !names.entryOf(key)) names.set(key, before);
      }

      removing[s]!.add(spot.node);
      adding[s]!.set(container, [...(adding[s]!.get(container) ?? []), node]);
    }
  }

  return states.map((list, s) => {
    const rewrite = (nodes: readonly SceneNode[]): SceneNode[] =>
      nodes.flatMap((node): SceneNode[] => {
        if (removing[s]!.has(node)) return [];

        if (node.kind !== "group") return [node];

        const children = [...rewrite(node.children), ...(adding[s]!.get(node.key) ?? [])];

        return [placedLike({ ...node, children }, node)];
      });

    return [...rewrite(list), ...(adding[s]!.get("") ?? [])];
  });
};

const parentOf = (key: string): string => key.slice(0, Math.max(0, key.lastIndexOf("/")));

const subtree = (node: SceneNode): string[] => [
  node.key,
  ...(node.kind === "group" ? node.children.flatMap(subtree) : []),
];
