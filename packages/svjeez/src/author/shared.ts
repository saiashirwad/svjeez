import { apply, inverse, layerMatrix, times, type Matrix } from "../check/boxes";
import type { Animated, Layer, Lane, SceneNode, Vec } from "../model/ir";
import { isLane, mapLane } from "../model/lane";
import { valueAt } from "../model/sample";
import { isSceneError, SceneError } from "../model/scene-error";
import { Passage, laneOf, mixNumber, mixVec, type Timing } from "../model/steps";
import { DEFAULT_EASE, EPSILON, ease, type Seconds } from "../model/time";
import { num } from "../model/format";
import { merge } from "./morph";
import type { Names } from "./names";
import { span } from "./span";
import type { Seams } from "./series-share";
import type { Curve } from "./spring";

/** Where one child of the series plays, in scene seconds. */
export interface Played {
  readonly start: Seconds;
  readonly end: Seconds;
}

interface Copy {
  /** The nodes above it inside its child, outermost first. */
  readonly chain: readonly SceneNode[];
  readonly node: SceneNode;
}

const ownKey = (key: string): string => key.slice(key.lastIndexOf("/") + 1).split("~")[0]!;

const copiesIn = (list: readonly SceneNode[], key: string, chain: SceneNode[] = []): Copy[] =>
  list.flatMap((node) => [
    ...(ownKey(node.key) === key ? [{ chain, node }] : []),
    ...(node.kind === "group" ? copiesIn(node.children, key, [...chain, node]) : []),
  ]);

const frameAt = (chain: readonly SceneNode[], t: Seconds): Matrix =>
  chain.reduce<Matrix>(
    (matrix, node) =>
      node.layers.reduce(
        (inner, layer) => times(inner, layerMatrix(layer, node.origin, t)),
        times(matrix, [1, 0, 0, 1, ...valueAt(node.at, t, mixVec)]),
      ),
    [1, 0, 0, 1, 0, 0],
  );

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

const sameFrame = (a: Matrix, b: Matrix): boolean =>
  a.every((value, i) => Math.abs(value - b[i]!) < 1e-6);

/** A matrix as a layer's parts: its move, then the turn, scale and skew `layerMatrix` builds. */
interface Parts {
  readonly move: Vec;
  readonly rotate: number;
  readonly scale: Vec;
  readonly skew: number;
}

const DEG = 180 / Math.PI;

const partsOf = ([a, b, c, d, e, f]: Matrix): Parts => {
  const sx = Math.hypot(a, b);
  const angle = Math.atan2(b, a);
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];

  return {
    move: [e, f],
    rotate: angle * DEG,
    scale: [sx, -sin * c + cos * d],
    skew: Math.atan((cos * c + sin * d) / sx) * DEG,
  };
};

const matrixOf = ({ move, rotate, scale, skew }: Parts): Matrix =>
  times(
    [1, 0, 0, 1, ...move],
    layerMatrix({ offset: [0, 0], rotate, scale, skew, opacity: 1 }, [0, 0], 0),
  );

/** `parts` taken `amount` of the way from nothing. */
const partly = ({ move, rotate, scale, skew }: Parts, amount: number): Parts => ({
  move: [move[0] * amount, move[1] * amount],
  rotate: rotate * amount,
  scale: [1 + (scale[0] - 1) * amount, 1 + (scale[1] - 1) * amount],
  skew: skew * amount,
});

/**
 * The layer that, right after a node's `at`, does what `outer` does before it: `outer · T(at) = T(at) · layer`. Its
 * offset makes up for the turn being around the node's origin rather than its parent's.
 */
interface Still {
  readonly offset: Vec;
  readonly rotate: number;
  readonly scale: Vec;
  readonly skew: number;
}

const layerFor = (outer: Matrix, at: Vec, origin: Vec): Still => {
  const { rotate, scale, skew } = partsOf(outer);
  const [x, y] = [at[0] + origin[0], at[1] + origin[1]];
  const [mx, my] = apply([outer[0], outer[1], outer[2], outer[3], 0, 0], [x, y]);

  return {
    offset: [outer[4] + mx - x, outer[5] + my - y],
    rotate,
    scale,
    skew,
  };
};

const mapAt = (at: Animated<Vec>, frame: Matrix): Animated<Vec> =>
  isLane(at) ? mapLane(at, (point) => apply(frame, point)) : apply(frame, at);

/**
 * A copy drawn in another frame: `frame` takes the parent it was drawn in to the parent it is tweened in. A move
 * shifts its `at`; a turn, scale or skew goes on a first layer of its own.
 */
const reframed = (node: SceneNode, frame: Matrix, turns: boolean): SceneNode => {
  const linear: Matrix = [frame[0], frame[1], frame[2], frame[3], 0, 0];

  if (!turns) return { ...node, at: mapAt(node.at, frame) };
  const { rotate, scale, skew } = partsOf(linear);
  const [ox, oy] = node.origin;
  const [mx, my] = apply(linear, node.origin);

  return {
    ...node,
    at: mapAt(node.at, frame),
    layers: [{ offset: [mx - ox, my - oy], rotate, scale, skew, opacity: 1 }, ...node.layers],
  };
};

const turnsOf = (frame: Matrix): boolean =>
  !sameFrame([frame[0], frame[1], frame[2], frame[3], 0, 0], IDENTITY);

/** Seconds between the samples of a correction for parents that move during a tween. */
const STEP = 1 / 30;

const lane = <T>(keys: readonly (readonly [Seconds, T])[]): Lane<T> => {
  const [first, second, ...rest] = keys.map(([t, value], i) => ({
    t,
    value,
    ...(i > 0 && { ease: ease.linear }),
  }));

  return { kind: "lane", keys: [first!, second!, ...rest] };
};

const rekeyed = (node: SceneNode, from: string, to: string): SceneNode => {
  const key = to + node.key.slice(from.length);
  const { id: _, ...rest } = node;

  // SAFETY: only the key, id, mask and a group's children change, so the node keeps its kind and fields.
  return {
    ...rest,
    key,
    ...(node.mask && { mask: rekeyed(node.mask, from, to) }),
    ...(node.kind === "group" && {
      children: node.children.map((child) => rekeyed(child, from, to)),
    }),
  } as SceneNode;
};

const unturnable = (key: string, own: string, names: Names): never => {
  throw new SceneError(
    `<Series share="${key}"> can't tween "${key}": a group around it scales it to nothing, so there is no frame to tween it in.`,
    "Keep the groups around a shared node from scaling to 0 during the seam.",
    names.whereOf(own),
  );
};

/** Gives each node in `node` back the id its own copy had: a merge keeps one, and two copies can't share it. */
const withIds = (node: SceneNode, own: SceneNode): SceneNode => {
  const ids = new Map<string, string>();

  const collect = (each: SceneNode): void => {
    if (each.id !== undefined) ids.set(each.key, each.id);

    if (each.mask) collect(each.mask);

    if (each.kind === "group") each.children.forEach(collect);
  };

  collect(own);

  const put = (each: SceneNode): SceneNode => {
    const { id: _, ...rest } = each;
    const id = ids.get(each.key);

    // SAFETY: only the id, mask and a group's children change, so the node keeps its kind and fields.
    return {
      ...rest,
      ...(id !== undefined && { id }),
      ...(each.mask && { mask: put(each.mask) }),
      ...(each.kind === "group" && { children: each.children.map(put) }),
    } as SceneNode;
  };

  return put(node);
};

const replaced = (list: readonly SceneNode[], target: SceneNode, by: SceneNode): SceneNode[] =>
  list.map((node) =>
    node === target
      ? by
      : node.kind === "group"
        ? { ...node, children: replaced(node.children, target, by) }
        : node,
  );

interface Seam {
  readonly from: number;
  readonly start: Seconds;
  readonly over: Seconds;
}

/** How far a tween over `seam` has gone at each time, eased as the morph eases it. */
const progressOf = (seam: Seam, curve: Curve, timing: Timing): ((t: Seconds) => number) => {
  const passage = new Passage<{ readonly value: number }>({ initial: { value: 0 }, steps: [] }).to(
    { value: 1 },
    span(seam.start, seam.over),
    curve,
  );

  const progress = laneOf(passage.data, 0, timing, mixNumber, "<Series share>");

  return (t) => valueAt(progress, t, mixNumber);
};

/** One neighbour of a copy, in the copy's parent's frame: where it is at the seam's middle, and how that frame drifts. */
interface Neighbour {
  readonly seam: Seam;
  /** From the neighbour's parent to the copy's, at time t. */
  readonly frame: (t: Seconds) => Matrix;
  readonly reference: Matrix;
  /** How much of the neighbour the tween shows at time t. */
  readonly weight: (t: Seconds) => number;
}

/**
 * When the parents of a copy or its neighbour move during a seam, the merge (done with both frames fixed at the seam's
 * middle) is off by how far the frames drift from there: a first layer, sampled over the seam, makes up the
 * difference, in as much as the tween shows the neighbour.
 */
const drifted = (node: SceneNode, neighbours: readonly Neighbour[]): SceneNode => {
  const moving = neighbours.filter(({ seam, frame, reference }) =>
    Array.from({ length: 9 }, (_, k) => seam.start + (seam.over * k) / 8).some(
      (t) => !sameFrame(frame(t), reference),
    ),
  );

  if (moving.length === 0) return node;

  const moments = [
    ...new Set(
      moving.flatMap(({ seam }) => {
        const count = Math.max(2, Math.ceil(seam.over / STEP));

        return Array.from({ length: count + 1 }, (_, k) => seam.start + (seam.over * k) / count);
      }),
    ),
  ].sort((a, b) => a - b);

  const layers = moments.map((t) => {
    const outer = moving.reduce<Matrix>((matrix, { frame, reference, weight }) => {
      const back = inverse(reference)!;

      return times(matrix, matrixOf(partly(partsOf(times(frame(t), back)), weight(t))));
    }, IDENTITY);

    return [t, layerFor(outer, valueAt(node.at, t, mixVec), node.origin)] as const;
  });

  const field = <T>(read: (layer: Still) => T): Animated<T> =>
    lane(layers.map(([t, layer]) => [t, read(layer)] as const));

  const correction: Layer = {
    offset: field((layer) => layer.offset),
    rotate: field((layer) => layer.rotate),
    scale: field((layer) => layer.scale),
    skew: field((layer) => layer.skew),
    opacity: 1,
  };

  return { ...node, layers: [correction, ...node.layers] };
};

/**
 * Tweens each shared node across the seams of a series: every copy of it, in each child, morphs from the version
 * before into its own over the seam it enters on, and into the version after over the seam it leaves on. Both copies
 * at a seam then draw the same shape at every moment, so the crossfade between the children shows one node changing.
 */
export const shareAcross = (
  children: readonly (readonly SceneNode[])[],
  played: readonly Played[],
  seams: Seams,
  timing: Timing,
  names: Names,
): SceneNode[][] => {
  const out = children.map((list) => [...list]);

  for (const key of seams.keys) {
    const copies = out.map((list, i): Copy | undefined => {
      const found = copiesIn(list, key);

      if (found.length > 1)
        throw new SceneError(
          `<Series share="${key}"> finds ${found.length} nodes keyed "${key}" in child ${i + 1}, and tweens one per child.`,
          "Key the node that carries over apart from the rest.",
          names.whereOf(found[1]!.node.key),
        );

      return found[0];
    });

    if (copies.filter(Boolean).length < 2)
      throw new SceneError(
        `<Series share="${key}"> finds a node keyed "${key}" in ${copies.some(Boolean) ? "only one child" : "no child"}, so nothing carries over.`,
        `Give the node each child draws key="${key}".`,
      );

    const tweens: Seam[] = [];

    copies.forEach((copy, i) => {
      const next = copies[i + 1];

      if (!copy || !next) return;
      const [leaving, into] = [played[i]!, played[i + 1]!];
      const middle = (leaving.end + into.start) / 2;
      const over = seams.over ?? Math.max(0, leaving.end - into.start);

      if (over <= EPSILON) return;
      const start = middle - over / 2;

      if (start < leaving.start - EPSILON || start + over > into.end + EPSILON)
        throw new SceneError(
          `<Series share="${key}"> tweens over ${num(over)}s at the seam after child ${i + 1}, from ${num(start)}s to ${num(start + over)}s, past the two children it joins.`,
          "Give share a shorter over.",
        );

      const earlier = tweens.at(-1);

      if (earlier && start < earlier.start + earlier.over - EPSILON)
        throw new SceneError(
          `<Series share="${key}">'s tween into child ${i + 2} starts at ${num(start)}s, before the one into child ${i + 1} ends at ${num(earlier.start + earlier.over)}s.`,
          "Give share a shorter over, or the child between them a longer length.",
        );

      tweens.push({ from: i, start: Math.max(0, start), over });
    });

    copies.forEach((copy, i) => {
      if (!copy) return;
      const before = tweens.find((seam) => seam.from === i - 1);
      const after = tweens.find((seam) => seam.from === i);

      if (!before && !after) return;
      const own = copy.node.key;

      const curve = seams.curve ?? DEFAULT_EASE;

      const neighbours = [
        before && ([before, copies[i - 1]!, true] as const),
        after && ([after, copies[i + 1]!, false] as const),
      ].flatMap((each): Neighbour[] => {
        if (!each) return [];
        const [seam, other, earlier] = each;

        const frame = (t: Seconds): Matrix =>
          times(
            inverse(frameAt(copy.chain, t)) ?? unturnable(key, own, names),
            frameAt(other.chain, t),
          );

        const progress = progressOf(seam, curve, timing);

        return [
          {
            seam,
            frame,
            reference: frame(seam.start + seam.over / 2),
            weight: (t) => (earlier ? 1 - progress(t) : progress(t)),
          },
        ];
      });

      const turns = neighbours.some(({ reference }) => turnsOf(reference));

      const placed = (node: SceneNode, frame: Matrix): SceneNode[] => [
        rekeyed(reframed(node, frame, turns), node.key, own),
      ];

      const states = [
        ...(before ? [placed(copies[i - 1]!.node, neighbours[0]!.reference)] : []),
        turns ? [rekeyed(reframed(copy.node, IDENTITY, true), own, own)] : [copy.node],
        ...(after ? [placed(copies[i + 1]!.node, neighbours.at(-1)!.reference)] : []),
      ];

      const spans = [before, after].flatMap((seam) => (seam ? [span(seam.start, seam.over)] : []));

      const merged = (() => {
        try {
          return merge(states, spans, timing, names, {
            ...(seams.curve !== undefined && { curve: seams.curve }),
          });
        } catch (error) {
          if (!isSceneError(error)) throw error;
          const into = before ? i : i + 1;

          throw new SceneError(
            `<Series share="${key}"> can't tween "${key}" from child ${into} into child ${into + 1}: ${error.problem}`,
            error.fix ??
              `Draw "${key}" as the same kind of node, with the same parts, in both children.`,
            names.whereOf(own),
          );
        }
      })();

      out[i] = replaced(out[i]!, copy.node, withIds(drifted(merged[0]!, neighbours), copy.node));
    });
  }

  return out;
};
