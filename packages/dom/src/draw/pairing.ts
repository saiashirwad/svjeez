import type { Box, Item, TextRun } from "../tree.ts";

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

/** Every text run under an item, but none under a box that turned: those can't slide on their own. */
export const runsOf = (it: Item, out: TextRun[] = []): TextRun[] => {
  if (it.kind === "text") out.push(it);
  else if (it.kind === "box" && !it.transform) for (const child of it.children) runsOf(child, out);

  return out;
};

/** An item without the runs in `drop`, or nothing when it is one of them. */
export const without = (it: Item, drop: ReadonlySet<TextRun>): Item | undefined => {
  if (it.kind === "text") return drop.has(it) ? undefined : it;

  if (it.kind !== "box" || it.transform || !runsOf(it).some((r) => drop.has(r))) return it;

  return { ...it, children: it.children.flatMap((c) => without(c, drop) ?? []) };
};

export const sameFace = (a: TextRun, b: TextRun): boolean =>
  a.size === b.size &&
  a.weight === b.weight &&
  a.family === b.family &&
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
export const movesOf = (a: Box, b: Box, pairBy?: PairBy): Moves => {
  const olds: TextRun[] = [];
  const news: TextRun[] = [];

  const visit = (x: Box, y: Box) => {
    for (const [old, it] of align(x.children, y.children, pairBy)) {
      if (old && it) {
        if (old.kind === "box" && it.kind === "box" && sameTransform(old, it)) visit(old, it);
      } else if (old) runsOf(old, olds);
      else if (it) runsOf(it, news);
    }
  };

  visit(a, b);

  const moved = new Map<TextRun, TextRun>();
  const gone = new Set<TextRun>();

  for (const n of news) {
    let best: TextRun | undefined;
    let far = n.size * 0.75;

    for (const o of olds) {
      if (gone.has(o) || o.placeholder || n.placeholder || o.text !== n.text || !sameFace(o, n))
        continue;

      const d = Math.hypot(o.x - n.x, o.y - n.y);

      if (d <= far) {
        best = o;
        far = d;
      }
    }

    if (best) {
      moved.set(n, best);
      gone.add(best);
    }
  }

  return { moved, gone };
};
