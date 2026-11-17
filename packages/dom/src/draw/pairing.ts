import type { Box, Item, TextRun } from "../tree.ts";
import { FIELDS } from "./text.tsx";

export type PairBy = (box: Box) => string | undefined;

export type Boxed = Exclude<Item, TextRun>;

const signature = (it: Item, pairBy?: PairBy): string => {
  if (it.kind !== "box") return it.kind;

  const own = pairBy?.(it);

  if (own !== undefined) return `pair:${own}`;

  if (it.key !== undefined) return `key:${it.key}`;

  return it.part !== undefined ? `#${it.part}` : it.tag;
};

const textOf = (it: Item): string =>
  it.kind === "text" ? it.text : it.kind === "box" ? it.children.map(textOf).join(" ") : "";

const likeness = (a: string, b: string): number => {
  if (a === b) return 1;

  const x = new Set(a.split(/\s+/).filter(Boolean));
  const y = new Set(b.split(/\s+/).filter(Boolean));
  const shared = [...x].filter((w) => y.has(w)).length;

  return shared / (x.size + y.size - shared || 1);
};

export const align = (
  olds: readonly Item[],
  news: readonly Item[],
  pairBy?: PairBy,
): [Item | undefined, Item | undefined][] => {
  const a = olds.map((it) => signature(it, pairBy));
  const b = news.map((it) => signature(it, pairBy));
  const ta = olds.map(textOf);
  const tb = news.map(textOf);
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

export const runsOf = (it: Item, out: TextRun[] = [], skip?: ReadonlySet<Box>): TextRun[] => {
  if (it.kind === "text") out.push(it);
  else if (it.kind === "box" && !it.transform && !skip?.has(it))
    for (const child of it.children) runsOf(child, out, skip);

  return out;
};

const boxesOf = (it: Item, out: Box[] = []): Box[] => {
  if (it.kind !== "box") return out;

  out.push(it);

  if (!it.transform) for (const child of it.children) boxesOf(child, out);

  return out;
};

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

export const insideOf = (it: Item, boxes: ReadonlySet<Box>, out: Box[] = []): Box[] => {
  if (it.kind !== "box") return out;

  if (boxes.has(it)) out.push(it);
  else if (!it.transform) for (const child of it.children) insideOf(child, boxes, out);

  return out;
};

export interface Carried {
  readonly carried: ReadonlyMap<Box, Box>;
  readonly left: ReadonlySet<Box>;
  readonly above: ReadonlySet<Box>;
}

const ancestors = (root: Box, target: Box): Box[] | undefined => {
  for (const child of root.children) {
    if (child.kind !== "box") continue;

    if (child === target) return [];

    const below = ancestors(child, target);

    if (below) return [child, ...below];
  }

  return undefined;
};

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

export const sameTransform = (a: Boxed, b: Boxed): boolean =>
  JSON.stringify(a.transform) === JSON.stringify(b.transform);

export interface Moves {
  readonly moved: ReadonlyMap<TextRun, TextRun>;
  readonly gone: ReadonlySet<TextRun>;
}

export const movesOf = (a: Box, b: Box, pairBy?: PairBy, carried?: Carried): Moves => {
  const skip = new Set<Box>([...(carried?.left ?? []), ...(carried?.carried.keys() ?? [])]);
  const olds: TextRun[] = [];
  const news: TextRun[] = [];
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
