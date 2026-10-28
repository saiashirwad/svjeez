import { el } from "../el";
import { ease, motion, type Motion, type Seconds, type Span, type Stack } from "../motion";
import type { SvgNode } from "../svg";
import { number, type Code } from "./code";

/** A placed piece morph() can carry between versions. `text` is the match key. */
export interface MorphPiece {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly id?: string;
}

/** Anything morph() animates: its pieces, and how to draw one with a motion. */
export interface Morphable<P extends MorphPiece = MorphPiece> {
  readonly words: readonly P[];
  draw(piece: P, animation?: Stack<"x" | "y" | "opacity">): SvgNode;
}

export interface MorphOptions {
  /** One per transition: the move into `versions[i + 1]` starts at `at[i]`. */
  readonly at: readonly Seconds[];
  readonly over?: Seconds;
  /** Line numbers for the longest version, fading as lines come and go. Needs `code()` versions. */
  readonly gutter?: boolean;
}

/**
 * Pairs `[i, j]` of words that carry over from `a` to `b`. The longest common subsequence of contents
 * anchors the order; leftovers pair by equal content, nearest first, so swapped words cross.
 * Runs named with the same id pair first, in order, whatever their content.
 */
export function match(a: readonly MorphPiece[], b: readonly MorphPiece[]): [number, number][] {
  const named = a.flatMap((w, i): [number, number][] => {
    if (w.id === undefined) return [];
    const k = a.slice(0, i).filter((v) => v.id === w.id).length;

    const j = b.findIndex(
      (v, j) => v.id === w.id && b.slice(0, j).filter((u) => u.id === w.id).length === k,
    );

    return j < 0 ? [] : [[i, j]];
  });

  const [ia, ib] = [
    a.flatMap((_, i) => (named.some(([x]) => x === i) ? [] : [i])),
    b.flatMap((_, j) => (named.some(([, y]) => y === j) ? [] : [j])),
  ];

  return [
    ...named,
    ...unnamed(
      ia.map((i) => a[i]!),
      ib.map((j) => b[j]!),
    ).map(([i, j]): [number, number] => [ia[i]!, ib[j]!]),
  ];
}

const unnamed = (a: readonly MorphPiece[], b: readonly MorphPiece[]): [number, number][] => {
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));

  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i]![j] =
        a[i]!.text === b[j]!.text
          ? 1 + lcs[i + 1]![j + 1]!
          : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
  const pairs: [number, number][] = [];

  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i]!.text === b[j]!.text) pairs.push([i++, j++]);
    else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) i++;
    else j++;
  }

  const [usedA, usedB] = [new Set(pairs.map(([i]) => i)), new Set(pairs.map(([, j]) => j))];
  const distance = ([i, j]: [number, number]) => Math.hypot(a[i]!.x - b[j]!.x, a[i]!.y - b[j]!.y);

  const candidates = a.flatMap((w, i) =>
    usedA.has(i)
      ? []
      : b.flatMap((v, j): [number, number][] =>
          usedB.has(j) || v.text !== w.text ? [] : [[i, j]],
        ),
  );

  for (const pair of candidates.sort((p, q) => distance(p) - distance(q))) {
    if (usedA.has(pair[0]) || usedB.has(pair[1])) continue;
    usedA.add(pair[0]);
    usedB.add(pair[1]);
    pairs.push(pair);
  }

  return pairs;
};

interface Chain {
  readonly word: MorphPiece;
  readonly source: Morphable;
  track?: Motion<"x" | "y" | "opacity">;
}

export interface MorphResult {
  readonly node: SvgNode;
  readonly spans: readonly Span[];
  readonly end: Seconds;
}

/**
 * Animate code, or any `Morphable` such as a `tex()` formula, from version to version: kept words move, removed words fade out, new words fade in. Runs paired by id with new text cross-fade as they move.
 * `spans[i]` is when the move into `versions[i + 1]` runs; `end` is when the last one settles, or 0 for a single version.
 */
export function morph(versions: readonly Code[], options: MorphOptions): MorphResult;
export function morph(
  versions: readonly Morphable[],
  options: Omit<MorphOptions, "gutter">,
): MorphResult;
export function morph(
  versions: readonly Morphable[],
  { at, over = 0.8, gutter = false }: MorphOptions,
): MorphResult {
  if (versions.length === 0 || at.length !== versions.length - 1 || !(over > 0))
    throw new Error(
      `morph() needs one start per transition and a positive duration, got ${versions.length} versions, ${at.length} starts and over ${over}.`,
    );
  at.forEach((start, i) => {
    if (i > 0 && start < at[i - 1]! + over)
      throw new Error(`morph() transition ${i} starts before transition ${i - 1} ends.`);
  });
  if (gutter && !versions.every(isCode))
    throw new Error("morph() draws a gutter only for code() versions.");
  const half = over / 2;

  const born = (word: MorphPiece, source: Morphable, start?: Seconds): Chain => ({
    word,
    source,
    track:
      start === undefined
        ? undefined
        : motion({ opacity: 0 })
            .at(start + half)
            .to({ opacity: 1 }, half),
  });

  const chains = versions[0]!.words.map((word) => born(word, versions[0]!));
  let live = chains.slice();
  at.forEach((start, i) => {
    const [before, after] = [versions[i]!, versions[i + 1]!];
    const pairs = match(before.words, after.words);
    const kept = new Map(pairs.map(([a, b]) => [b, a]));
    const stays = new Set(pairs.map(([a]) => a));
    const gone = live.filter((_, a) => !stays.has(a));

    for (const chain of gone)
      chain.track = (chain.track ?? motion<{}>()).at(start).to({ opacity: 0 }, half);
    live = after.words.map((word, j) => {
      const a = kept.get(j);

      if (a === undefined) return chains[chains.push(born(word, after, start)) - 1]!;
      const [chain, from] = [live[a]!, before.words[a]!];
      const to = { x: word.x - chain.word.x, y: word.y - chain.word.y };

      if (from.text === word.text) {
        chain.track = (chain.track ?? motion<{}>()).at(start).to(to, over, ease.inOut);

        return chain;
      }

      chain.track = (chain.track ?? motion<{}>())
        .at(start)
        .to({ ...to, opacity: 0 }, over, ease.inOut);

      const next: Chain = {
        word,
        source: after,
        track: motion({ x: from.x - word.x, y: from.y - word.y, opacity: 0 })
          .at(start)
          .to({ x: 0, y: 0, opacity: 1 }, over, ease.inOut),
      };

      return chains[chains.push(next) - 1]!;
    });
  });
  const numbers = gutter ? lineNumbers(versions as readonly Code[], at, over) : [];

  return {
    node: el.g({}, [
      numbers,
      chains.map((chain) => chain.source.draw(chain.word, chain.track)),
    ]),
    spans: at.map((start): Span => ({ at: start, over })),
    end: at.length > 0 ? at.at(-1)! + over : 0,
  };
}

const isCode = (v: Morphable): v is Code => "lineCount" in v;

const lineNumbers = (versions: readonly Code[], at: readonly Seconds[], over: Seconds): SvgNode[] =>
  Array.from({ length: Math.max(...versions.map((v) => v.lineCount)) }, (_, i) => {
    const shown = (v: Code) => i < v.lineCount;
    let track = motion({ opacity: shown(versions[0]!) ? 1 : 0 });
    at.forEach((start, k) => {
      const [was, is] = [shown(versions[k]!), shown(versions[k + 1]!)];

      if (was !== is)
        track = track.at(is ? start + over / 2 : start).to({ opacity: is ? 1 : 0 }, over / 2);
    });

    return number(i + 1, versions[0]!.metrics, track);
  });
