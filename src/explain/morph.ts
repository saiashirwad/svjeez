import { el } from "../el";
import { ease, motion, type Motion, type Seconds, type Span } from "../motion";
import type { SvgNode } from "../svg";
import { number, text, type Code, type Word } from "./code";

export interface MorphOptions {
  /** One per transition: the move into `versions[i + 1]` starts at `at[i].at`. */
  readonly at: readonly Span[];
  readonly over?: Seconds;
  /** Line numbers for the longest version, fading as lines come and go. */
  readonly gutter?: boolean;
}

/**
 * Pairs `[i, j]` of words that carry over from `a` to `b`. The longest common subsequence of contents
 * anchors the order; leftovers pair by equal content, nearest first, so swapped words cross.
 * Runs named with the same id pair first, in order, whatever their content.
 */
export function match(a: readonly Word[], b: readonly Word[]): [number, number][] {
  const named = a.flatMap((w, i): [number, number][] => {
    if (w.id === undefined) return [];
    const k = a.slice(0, i).filter((v) => v.id === w.id).length;
    const j = b.findIndex((v, j) => v.id === w.id && b.slice(0, j).filter((u) => u.id === w.id).length === k);
    return j < 0 ? [] : [[i, j]];
  });
  const [ia, ib] = [a.flatMap((_, i) => (named.some(([x]) => x === i) ? [] : [i])), b.flatMap((_, j) => (named.some(([, y]) => y === j) ? [] : [j]))];
  return [...named, ...unnamed(ia.map((i) => a[i]!), ib.map((j) => b[j]!)).map(([i, j]): [number, number] => [ia[i]!, ib[j]!])];
}

const unnamed = (a: readonly Word[], b: readonly Word[]): [number, number][] => {
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) lcs[i]![j] = a[i]!.text === b[j]!.text ? 1 + lcs[i + 1]![j + 1]! : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
  const pairs: [number, number][] = [];
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i]!.text === b[j]!.text) pairs.push([i++, j++]);
    else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) i++;
    else j++;
  }
  const [usedA, usedB] = [new Set(pairs.map(([i]) => i)), new Set(pairs.map(([, j]) => j))];
  const distance = ([i, j]: [number, number]) => Math.hypot(a[i]!.x - b[j]!.x, a[i]!.y - b[j]!.y);
  const candidates = a.flatMap((w, i) => (usedA.has(i) ? [] : b.flatMap((v, j): [number, number][] => (usedB.has(j) || v.text !== w.text ? [] : [[i, j]]))));
  for (const pair of candidates.sort((p, q) => distance(p) - distance(q))) {
    if (usedA.has(pair[0]) || usedB.has(pair[1])) continue;
    usedA.add(pair[0]);
    usedB.add(pair[1]);
    pairs.push(pair);
  }
  return pairs;
};

interface Chain {
  readonly word: Word;
  readonly code: Code;
  track?: Motion<"x" | "y" | "opacity">;
}

/** Animate code from version to version: kept words move, removed words fade out, new words fade in. */
export function morph(versions: readonly Code[], { at, over = 0.8, gutter = false }: MorphOptions): { readonly node: SvgNode } {
  if (versions.length === 0 || at.length !== versions.length - 1 || !(over > 0)) throw new Error("morph() needs versions, one span per transition and a positive duration.");
  at.forEach((span, i) => {
    if (i > 0 && span.at < at[i - 1]!.at + over) throw new Error(`morph() transition ${i} starts before transition ${i - 1} ends.`);
  });
  const half = over / 2;
  const born = (word: Word, code: Code, start?: Seconds): Chain => ({
    word,
    code,
    track: start === undefined ? undefined : motion({ opacity: 0 }).at(start + half).to({ opacity: 1 }, half),
  });
  const chains = versions[0]!.words.map((word) => born(word, versions[0]!));
  let live = chains.slice();
  at.forEach(({ at: start }, i) => {
    const [before, after] = [versions[i]!, versions[i + 1]!];
    const pairs = match(before.words, after.words);
    const kept = new Map(pairs.map(([a, b]) => [b, live[a]!]));
    const stays = new Set(pairs.map(([a]) => a));
    const gone = live.filter((_, a) => !stays.has(a));
    for (const chain of gone) chain.track = (chain.track ?? motion<{}>()).at(start).to({ opacity: 0 }, half);
    live = after.words.map((word, j) => {
      const chain = kept.get(j);
      if (!chain) {
        chains.push(born(word, after, start));
        return chains.at(-1)!;
      }
      chain.track = (chain.track ?? motion<{}>()).at(start).to({ x: word.x - chain.word.x, y: word.y - chain.word.y }, over, ease.inOut);
      return chain;
    });
  });
  const numbers = gutter ? lineNumbers(versions, at, over) : [];
  return { node: el.g({}, [numbers, chains.map((chain) => text(chain.word, chain.code.metrics, chain.track))]) };
}

const lineNumbers = (versions: readonly Code[], at: readonly Span[], over: Seconds): SvgNode[] =>
  Array.from({ length: Math.max(...versions.map((v) => v.lineCount)) }, (_, i) => {
    const shown = (v: Code) => i < v.lineCount;
    let track = motion({ opacity: shown(versions[0]!) ? 1 : 0 });
    at.forEach(({ at: start }, k) => {
      const [was, is] = [shown(versions[k]!), shown(versions[k + 1]!)];
      if (was !== is) track = track.at(is ? start + over / 2 : start).to({ opacity: is ? 1 : 0 }, over / 2);
    });
    return number(i + 1, versions[0]!.metrics, track);
  });
