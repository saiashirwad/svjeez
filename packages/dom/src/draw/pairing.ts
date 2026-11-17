import type { Box, Item, TextRun } from "../tree.ts";
import { FIELDS } from "./text.tsx";

/** Overrides how boxes pair: boxes that get the same string pair, whatever their tag. */
export type PairBy = (box: Box) => string | undefined;

/** An item with a box of its own, which can carry a transform. */
export type Boxed = Exclude<Item, TextRun>;

/**
 * What two children must share to pair up: a key, else a part, else the tag. Classes don't count, because a state
 * change is often a class change and that element should morph. Text pairs with text, in order.
 */
const signature = (it: Item, pairBy?: PairBy): string => {
  if (it.kind !== "box") return it.kind;

  const own = pairBy?.(it);

  if (own !== undefined) return `pair:${own}`;

  if (it.key !== undefined) return `key:${it.key}`;

  return it.part !== undefined ? `#${it.part}` : it.tag;
};

/** All the text under an item, so siblings that share a signature can be told apart by what they say. */
const textOf = (it: Item): string =>
  it.kind === "text" ? it.text : it.kind === "box" ? it.children.map(textOf).join(" ") : "";

/** How alike two texts are, from 0 to 1: the words they share over the words either has. */
const likeness = (a: string, b: string): number => {
  if (a === b) return 1;

  const x = new Set(a.split(/\s+/).filter(Boolean));
  const y = new Set(b.split(/\s+/).filter(Boolean));
  const shared = [...x].filter((w) => y.has(w)).length;

  return shared / (x.size + y.size - shared || 1);
};

/**
 * Pairs two lists of siblings by their longest common run of signatures, so an element inserted in the middle leaves
 * the ones around it paired. Among pairings of the same length, the one whose pairs say the most alike wins, so a
 * `<div>` inserted before another `<div>` doesn't take its place. Unpaired items come back with the other side
 * undefined, in drawing order.
 */
export const align = (
  olds: readonly Item[],
  news: readonly Item[],
  pairBy?: PairBy,
): [Item | undefined, Item | undefined][] => {
  const a = olds.map((it) => signature(it, pairBy));
  const b = news.map((it) => signature(it, pairBy));
  const ta = olds.map(textOf);
  const tb = news.map(textOf);
  // A pair counts 1, plus a likeness bonus too small for all of them together to outweigh one more pair.
  const bonus = 0.5 / (Math.min(a.length, b.length) + 1);
  const weight = (i: number, j: number) => 1 + bonus * likeness(ta[i]!, tb[j]!);

  const lcs = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0),
  );

  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i]![j] = Math.max(
        a[i] === b[j] ? lcs[i + 1]![j + 1]! + weight(i, j) : 0,
        lcs[i + 1]![j]!,
        lcs[i]![j + 1]!,
      );

  const out: [Item | undefined, Item | undefined][] = [];
  let i = 0;
  let j = 0;

  while (i < a.length || j < b.length) {
    if (
      i < a.length &&
      j < b.length &&
      a[i] === b[j] &&
      lcs[i]![j]! === lcs[i + 1]![j + 1]! + weight(i, j)
    )
      out.push([olds[i++], news[j++]]);
    else if (j < b.length && (i >= a.length || lcs[i]![j + 1]! >= lcs[i + 1]![j]!))
      out.push([undefined, news[j++]]);
    else out.push([olds[i++], undefined]);
  }

  return out;
};

/**
 * Every text run under an item, but none under a box that turned (those can't slide on their own) or under a box in
 * `skip`.
 */
export const runsOf = (it: Item, out: TextRun[] = [], skip?: ReadonlySet<Box>): TextRun[] => {
  if (it.kind === "text") out.push(it);
  else if (it.kind === "box" && !it.transform && !skip?.has(it))
    for (const child of it.children) runsOf(child, out, skip);

  return out;
};

/** Every box under an item, itself included, but none under a box that turned. */
const boxesOf = (it: Item, out: Box[] = []): Box[] => {
  if (it.kind !== "box") return out;

  out.push(it);

  if (!it.transform) for (const child of it.children) boxesOf(child, out);

  return out;
};

/** An item without the runs in `drop` and the boxes in `boxes`, or nothing when it is one of them. */
export const without = (
  it: Item,
  drop: ReadonlySet<TextRun>,
  boxes: ReadonlySet<Box> = new Set(),
): Item | undefined => {
  if (it.kind === "text") return drop.has(it) ? undefined : it;

  if (it.kind === "box" && boxes.has(it)) return undefined;

  if (
    it.kind !== "box" ||
    it.transform ||
    (!runsOf(it).some((r) => drop.has(r)) && !boxesOf(it).some((b) => boxes.has(b)))
  )
    return it;

  return { ...it, children: it.children.flatMap((c) => without(c, drop, boxes) ?? []) };
};

/** The boxes in `boxes` under an item, outermost only, in drawing order. */
export const insideOf = (it: Item, boxes: ReadonlySet<Box>, out: Box[] = []): Box[] => {
  if (it.kind !== "box") return out;

  if (boxes.has(it)) out.push(it);
  else if (!it.transform) for (const child of it.children) insideOf(child, boxes, out);

  return out;
};

/**
 * Keyed elements that changed parent in one transition: `data-key` names one element page-wide, so the element
 * that leaves one parent and the one with its key that arrives in another are the same, and it moves rather than
 * fading out in one place and in at the other. `carried` maps each arrival to what left; `left` is what left.
 * Only elements that would otherwise fade count, so siblings that pair in place keep doing so, and an element
 * inside one that moves goes with it.
 */
export interface Carried {
  readonly carried: ReadonlyMap<Box, Box>;
  readonly left: ReadonlySet<Box>;
  /**
   * Arrivals drawn over the whole page while they move, as a dragged element is: inside its new parent, siblings
   * that come later would cover it on its way. Only those whose ancestors, old and new, neither clip nor fade.
   */
  readonly above: ReadonlySet<Box>;
}

/** The boxes from `root` (left out) down to `target`'s parent, or undefined when it isn't under `root`. */
const ancestors = (root: Box, target: Box): Box[] | undefined => {
  for (const child of root.children) {
    if (child.kind !== "box") continue;

    if (child === target) return [];

    const below = ancestors(child, target);

    if (below) return [child, ...below];
  }

  return undefined;
};

/** A box that draws its children as they are: no clip, no fade, no blend, no mask. */
const plain = (b: Box) =>
  !b.clip && b.opacity >= 1 && b.darkOpacity === undefined && !b.blend && !b.isolate && !b.mask;

export const carriedOf = (a: Box, b: Box, pairBy?: PairBy): Carried => {
  const gone: Box[] = [];
  const came: Box[] = [];

  const visit = (x: Box, y: Box) => {
    for (const [old, it] of align(x.children, y.children, pairBy)) {
      if (old?.kind === "box" && it?.kind === "box") {
        if (sameTransform(old, it)) visit(old, it);
      } else {
        if (old) boxesOf(old, gone);

        if (it) boxesOf(it, came);
      }
    }
  };

  visit(a, b);

  // A key the page uses twice names no one element.
  const count = (root: Box) => {
    const seen = new Map<string, number>();

    for (const box of boxesOf(root))
      if (box.key !== undefined) seen.set(box.key, (seen.get(box.key) ?? 0) + 1);

    return seen;
  };

  const inA = count(a);
  const inB = count(b);

  const byKey = new Map(
    gone.flatMap((box) => (box.key !== undefined ? [[box.key, box] as const] : [])),
  );

  const carried = new Map<Box, Box>();
  const left = new Set<Box>();
  // Boxes inside a pair already taken, which move with it.
  const taken = new Set<Box>();

  for (const box of came) {
    const key = box.key;
    const old = key === undefined ? undefined : byKey.get(key);

    if (
      !old ||
      taken.has(box) ||
      taken.has(old) ||
      inA.get(key!) !== 1 ||
      inB.get(key!) !== 1 ||
      !sameTransform(old, box)
    )
      continue;

    carried.set(box, old);
    left.add(old);

    for (const inner of [...boxesOf(box), ...boxesOf(old)]) taken.add(inner);
  }

  const above = new Set(
    [...carried].flatMap(([box, old]) =>
      [...(ancestors(b, box) ?? [b]), ...(ancestors(a, old) ?? [a])].every(plain) ? [box] : [],
    ),
  );

  return { carried, left, above };
};

export const sameFace = (a: TextRun, b: TextRun): boolean =>
  a.size === b.size &&
  a.weight === b.weight &&
  a.family === b.family &&
  a.stretch === b.stretch &&
  a.style === b.style &&
  a.letterSpacing === b.letterSpacing;

/** A matrix doesn't tween as a whole, so only items with the same transform morph. */
export const sameTransform = (a: Boxed, b: Boxed): boolean =>
  JSON.stringify(a.transform) === JSON.stringify(b.transform);

/**
 * Text that left with one element and arrived with another in one transition, saying the same in the same face at
 * nearly the same place, as when an app swaps an editor for the rendered text. `moved` maps each arrival to what
 * left; `gone` is what left.
 */
export interface Moves {
  readonly moved: ReadonlyMap<TextRun, TextRun>;
  readonly gone: ReadonlySet<TextRun>;
}

/** The moves from `a` to `b`, found on the same walk the drawing makes, among the runs it would fade out and in. */
export const movesOf = (a: Box, b: Box, pairBy?: PairBy, carried?: Carried): Moves => {
  const skip = new Set<Box>([...(carried?.left ?? []), ...(carried?.carried.keys() ?? [])]);
  const olds: TextRun[] = [];
  const news: TextRun[] = [];
  // Text a field lost whole (it shows its placeholder now): it may have gone anywhere, so it can land far away.
  const emptied = new Set<TextRun>();

  const visit = (x: Box, y: Box) => {
    for (const [old, it] of align(x.children, y.children, pairBy)) {
      if (old && it) {
        if (old.kind === "box" && it.kind === "box" && sameTransform(old, it)) visit(old, it);
        else if (
          old.kind === "text" &&
          it.kind === "text" &&
          FIELDS.has(x.tag) &&
          !old.placeholder &&
          it.placeholder
        ) {
          olds.push(old);
          emptied.add(old);
        }
      } else if (old) runsOf(old, olds, skip);
      else if (it) runsOf(it, news, skip);
    }
  };

  visit(a, b);

  const moved = new Map<TextRun, TextRun>();
  const gone = new Set<TextRun>();

  for (const n of news) {
    let best: TextRun | undefined;
    let far = n.size * 0.75;
    let lost: TextRun | undefined;

    for (const o of olds) {
      if (gone.has(o) || o.placeholder || n.placeholder || o.text !== n.text) continue;

      if (emptied.has(o)) {
        lost ??= o;
        continue;
      }

      if (!sameFace(o, n)) continue;

      const d = Math.hypot(o.x - n.x, o.y - n.y);

      if (d <= far) {
        best = o;
        far = d;
      }
    }

    best ??= lost;

    if (best) {
      moved.set(n, best);
      gone.add(best);
    }
  }

  return { moved, gone };
};
