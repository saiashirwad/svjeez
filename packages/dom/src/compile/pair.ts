import type { ElementNode, Node, Snapshot } from "../schema.ts";
import type { Diagnostic } from "./context.ts";

/** Names an element for pairing, ahead of its `data-key`, `data-part` and `id`. Return undefined to leave it to them. */
export type PairBy = (node: ElementNode) => string | undefined;

/** A node with the key it has next to its siblings: the same in every state that has it. */
export interface Paired<N extends Node = Node> {
  readonly node: N;
  readonly key: string;
  readonly children: readonly Paired[];
}

export const isElement = (paired: Paired): paired is Paired<ElementNode> =>
  paired.node.type === "element";

export interface Pairing {
  readonly roots: readonly Paired<ElementNode>[];
  /** Moves between parents that could not be followed. */
  readonly diagnostics: readonly Diagnostic[];
}

interface Slot {
  readonly node: Node;
  key: string;
  children: Slot[];
  parent?: Slot;
  /** What the node asked to be called, if anything. */
  readonly named?: string;
  /** Names the node across parents too: `pairBy`, `data-key`, a framework identity and `id`, which stand for one thing on the page. */
  readonly global: boolean;
}

const slotOf = (node: Node, parent: Slot | undefined, pairBy?: PairBy): Slot => {
  if (node.type === "text") return { node, key: "", children: [], parent, global: false };

  const asked = pairBy?.(node) || undefined;

  const named = asked ?? (node.key || node.identity || node.part || node.id || undefined);

  const global = asked !== undefined || !!node.key || !!node.identity || (!node.part && !!node.id);

  return { node, key: "", children: [], parent, global, ...(named && { named }) };
};

const wordsOf = (node: Node): string =>
  node.type === "text"
    ? node.runs.map((run) => run.text).join(" ")
    : node.children.map(wordsOf).join(" ");

const bigrams = (text: string): Map<string, number> => {
  const out = new Map<string, number>();

  for (let i = 0; i < text.length - 1; i++) {
    const pair = text.slice(i, i + 2);

    out.set(pair, (out.get(pair) ?? 0) + 1);
  }

  return out;
};

/** 0 to 1: how much of the two strings is the same, by shared letter pairs. */
const likeness = (a: string, b: string): number => {
  if (a === b) return 1;

  if (a.length < 2 || b.length < 2) return 0;

  const [left, right] = [bigrams(a), bigrams(b)];
  let shared = 0;

  for (const [pair, n] of left) shared += Math.min(n, right.get(pair) ?? 0);

  return (2 * shared) / (a.length - 1 + b.length - 1);
};

/** 0 when two nodes cannot be the same thing: different tags, or an element and a text. Else 1 to 2, higher when their words agree. */
const score = (a: Node, b: Node): number => {
  if (a.type !== b.type || (a.type === "element" && b.type === "element" && a.tag !== b.tag))
    return 0;

  return 1 + likeness(wordsOf(a).slice(0, 200), wordsOf(b).slice(0, 200));
};

/** The in-order matching of `before` to `after` with the best total score, as `after` index -> `before` index. */
const matching = (before: readonly Slot[], after: readonly Slot[]): Map<number, number> => {
  const best = Array.from({ length: before.length + 1 }, () =>
    Array.from({ length: after.length + 1 }, () => 0),
  );

  for (let i = before.length - 1; i >= 0; i--)
    for (let j = after.length - 1; j >= 0; j--)
      best[i]![j] = Math.max(
        best[i + 1]![j]!,
        best[i]![j + 1]!,
        score(before[i]!.node, after[j]!.node) > 0
          ? score(before[i]!.node, after[j]!.node) + best[i + 1]![j + 1]!
          : 0,
      );

  const out = new Map<number, number>();
  let [i, j] = [0, 0];

  while (i < before.length && j < after.length) {
    const here = score(before[i]!.node, after[j]!.node);

    if (here > 0 && best[i]![j] === here + best[i + 1]![j + 1]!) out.set(j++, i++);
    else if (best[i]![j] === best[i + 1]![j]) i++;
    else j++;
  }

  return out;
};

const squash = (text: string): string => text.replace(/\s+/g, " ").trim();

/** The tags of an element and everything in it: what its subtree looks like, ignoring words. */
const shapeOf = (node: Node): string =>
  node.type === "text" ? "#" : `${node.tag}(${node.children.map(shapeOf).join(",")})`;

/**
 * Matches without regard to order the siblings that can only be each other: elements with the same tag and shape, and
 * the same words (or nearly: 90% of their letter pairs). A pair counts only when each is the other's single best candidate;
 * duplicates and near-ties are left for `matching`. As `after` index -> `before` index.
 */
const strongMatches = (before: readonly Slot[], after: readonly Slot[]): Map<number, number> => {
  const facts = (slot: Slot) =>
    slot.node.type === "element"
      ? { words: squash(wordsOf(slot.node)).slice(0, 200), shape: shapeOf(slot.node) }
      : undefined;

  const [was, now] = [before.map(facts), after.map(facts)];

  const strength = (i: number, j: number): number => {
    const [a, b] = [was[i], now[j]];

    if (!a || !b || a.shape !== b.shape || !a.words || !b.words) return 0;

    const like = likeness(a.words, b.words);

    return like >= 0.9 ? like : 0;
  };

  const out = new Map<number, number>();

  const best = (scores: number[]): number => {
    const top = Math.max(...scores);

    return top > 0 && scores.filter((one) => one === top).length === 1 ? scores.indexOf(top) : -1;
  };

  before.forEach((_, i) => {
    const j = best(after.map((_, k) => strength(i, k)));

    if (j >= 0 && best(before.map((_, k) => strength(k, j))) === i) out.set(j, i);
  });

  return out;
};

const nameOfKind = (node: Node): string => (node.type === "text" ? "text" : node.tag);

/** Pairs the children of one node as it is in each state (undefined where the state has no such node), then goes down into each pair. */
const level = (parents: readonly (Slot | undefined)[], pairBy: PairBy | undefined): void => {
  const taken = new Set<string>();
  const counts = new Map<string, number>();

  const fresh = (kind: string): string => {
    let key = "";

    for (let n = counts.get(kind) ?? 0; ; n++) {
      key = `${kind}[${n}]`;

      if (!taken.has(key)) {
        counts.set(kind, n + 1);
        break;
      }
    }

    taken.add(key);

    return key;
  };

  const lists = parents.map((parent) => {
    if (parent?.node.type !== "element") return undefined;

    parent.children = parent.node.children.map((node) => slotOf(node, parent, pairBy));

    return parent.children;
  });

  let before: Slot[] | undefined;

  for (const slots of lists) {
    if (!slots) continue;

    const used = new Map<string, number>();

    for (const slot of slots)
      if (slot.named) {
        const n = used.get(slot.named) ?? 0;

        used.set(slot.named, n + 1);
        slot.key = n === 0 ? slot.named : `${slot.named}~${n + 1}`;
        taken.add(slot.key);
      }

    const loose = slots.filter((slot) => !slot.named);
    const was = (before ?? []).filter((slot) => !slot.named);
    // The order-keeping match is the default; a strong match overrides whatever it had for those two.
    const same = matching(was, loose);

    for (const [j, i] of strongMatches(was, loose)) {
      for (const [other, there] of same) if (other === j || there === i) same.delete(other);

      same.set(j, i);
    }

    const matched = new Map<Slot, Slot>();

    loose.forEach((slot, j) => {
      const match = was[same.get(j) ?? -1];

      if (match) matched.set(slot, match);
    });

    // In document order, so a fresh key is numbered the same whichever way the rest matched.
    for (const slot of loose) {
      const match = matched.get(slot);

      slot.key = match ? match.key : fresh(nameOfKind(slot.node));
    }

    before = slots;
  }

  const keys = [...new Set(lists.flatMap((slots) => slots?.map((slot) => slot.key) ?? []))];

  for (const key of keys)
    level(
      lists.map((slots) => slots?.find((slot) => slot.key === key)),
      pairBy,
    );
};

const chain = (slot: Slot): Slot[] => (slot.parent ? [...chain(slot.parent), slot.parent] : []);

const everySlot = (slot: Slot): Slot[] => [slot, ...slot.children.flatMap(everySlot)];

/** Animated properties that act on an element's children as a group. */
const GROUPED = new Set([
  "opacity",
  "transform",
  "translate",
  "rotate",
  "scale",
  "filter",
  "clipPath",
  "maskImage",
]);

const animatesGroup = (node: ElementNode): boolean =>
  (node.animations ?? []).some(
    (one) =>
      (one.playState !== "finished" || one.fill === "forwards" || one.fill === "both") &&
      one.keyframes.some((frame) => Object.keys(frame.props).some((prop) => GROUPED.has(prop))),
  );

const flat = (slot: Slot): boolean => {
  const { node } = slot;

  return (
    node.type === "element" &&
    !node.transform &&
    !node.clip &&
    (node.opacity ?? 1) >= 1 &&
    (!node.blendMode || node.blendMode === "normal") &&
    !node.filter?.length &&
    !node.clipPath &&
    !node.masks?.length &&
    !animatesGroup(node)
  );
};

const nameChain = (slots: readonly Slot[]): string => slots.map((slot) => slot.key).join("/");

/**
 * A thing that sits under different parents in different states moves between them. Each state lays out in page coordinates,
 * so it can ride along at the level of the nearest ancestor that every state shares, when nothing between clips, transforms or fades it.
 * Otherwise it is two things: one leaves and one enters.
 */
const lift = (roots: readonly Slot[], notes: Diagnostic[]): void => {
  const marks = roots.map((root) => {
    const out = new Map<string, Slot[]>();

    for (const slot of everySlot(root))
      if (slot.global && slot.named) out.set(slot.named, [...(out.get(slot.named) ?? []), slot]);

    return out;
  });

  // Shallowest first: lifting a thing changes where the things inside it are, not which parent they have.
  const depths = new Map<string, number>();

  for (const mark of marks)
    for (const [name, [slot]] of mark)
      depths.set(name, Math.min(depths.get(name) ?? Infinity, chain(slot!).length));

  const names = [...depths.keys()].sort((a, b) => depths.get(a)! - depths.get(b)!);

  for (const name of names) {
    const found = marks.map((mark) => mark.get(name));

    // One thing per state, in at least two states.
    if (found.filter(Boolean).length < 2 || found.some((slots) => slots && slots.length > 1))
      continue;

    const slots = found.flatMap((one) => (one ? one : []));
    const chains = slots.map(chain);

    if (chains.every((one) => nameChain(one) === nameChain(chains[0]!))) continue;

    const shared = chains[0]!.findIndex((above, depth) =>
      chains.some((one) => one[depth]?.key !== above.key),
    );

    const depth = shared < 0 ? chains[0]!.length : shared;
    const blocker = chains.flatMap((one) => one.slice(depth)).find((above) => !flat(above));

    if (blocker) {
      notes.push({
        path: nameChain([...chains[0]!, slots[0]!]),
        what: `"${name}" moves between parents, but ${blocker.key} clips, transforms or fades it on the way, so it leaves and a new one enters`,
      });

      continue;
    }

    const homes = slots.map((slot, i) => chains[i]![depth - 1]!);
    let key = name;

    while (homes.some((home) => home.children.some((child) => child.key === key))) key += "~";

    slots.forEach((slot, i) => {
      const home = homes[i]!;

      slot.parent!.children = slot.parent!.children.filter((child) => child !== slot);
      slot.parent = home;
      slot.key = key;
      home.children.push(slot);
    });
  }
};

const frozen = (slot: Slot): Paired => ({
  node: slot.node,
  key: slot.key,
  children: slot.children.map(frozen),
});

/**
 * Gives every node of every snapshot a key that is the same in each state it appears in, so a state-to-state blend knows what became what.
 * Among siblings, a node is named by `pairBy`, then `data-key`, then the framework's `identity`, then `data-part`, then `id`; the rest
 * are matched first by strong, unambiguous likeness (same tag, shape and words) in any order, then by tag and wording keeping order (a longest common subsequence). Whatever has no match gets a key of its own: it enters or exits.
 * The roots always pair with each other.
 */
export const pair = (snapshots: readonly Snapshot[], pairBy?: PairBy): Pairing => {
  const roots = snapshots.map((snapshot) => slotOf(snapshot.root, undefined, pairBy));
  const first = roots[0];

  if (!first) return { roots: [], diagnostics: [] };

  const rootKey = first.named ?? `${first.node.type === "element" ? first.node.tag : "text"}[0]`;

  for (const root of roots) root.key = rootKey;

  level(roots, pairBy);

  const diagnostics: Diagnostic[] = [];

  lift(roots, diagnostics);

  return {
    roots: roots.flatMap((root) => {
      const paired = frozen(root);

      return isElement(paired) ? [paired] : [];
    }),
    diagnostics,
  };
};
