import { SceneError } from "svjeez/tools";
import { sourceLines, type Highlighted, type Piece } from "./highlight.ts";

/** One node `<Code>` draws: its pieces, set at a 0-based line and column of the source. */
export interface CodePart {
  readonly key: string;
  readonly line: number;
  readonly col: number;
  readonly pieces: readonly Piece[];
}

/** How `<Code>` cuts highlighted lines into the nodes it draws, and what it keys them by, so a morph can match them. */
export type Split = (code: Highlighted) => readonly CodePart[];

interface Token {
  readonly text: string;
  readonly line: number;
  readonly col: number;
}

const LEX = /[\p{L}\p{N}_]+|[-+*/<>=!&|^~%@.:?#$\\]+|\S/gu;

const lex = (lines: readonly string[]): Token[] =>
  lines.flatMap((text, line) =>
    [...text.matchAll(LEX)].map((match) => ({ text: match[0], line, col: match.index })),
  );

const textOf = (line: readonly Piece[]): string => line.map(([, text]) => text).join("");

const keyOf = (text: string, n: number): string =>
  `${text.replaceAll("%", "%25").replaceAll("/", "%2F")}#${n}`;

const slice = (line: readonly Piece[], from: number, to: number): Piece[] => {
  let at = 0;

  return line.flatMap(([role, text]): Piece[] => {
    const [start, a, b] = [at, Math.max(at, from), Math.min(at + text.length, to)];

    at += text.length;

    return b > a ? [[role, text.slice(a - start, b - start)]] : [];
  });
};

const partsOf = (
  code: Highlighted,
  tokens: readonly Token[],
  keys: readonly string[],
): CodePart[] =>
  tokens.map(({ text, line, col }, i) => ({
    key: keys[i]!,
    line,
    col,
    pieces: slice(code[line] ?? [], col, col + text.length),
  }));

const occurrences = (tokens: readonly Token[]): string[] => {
  const seen = new Map<string, number>();

  return tokens.map(({ text }) => {
    const n = seen.get(text) ?? 0;

    seen.set(text, n + 1);

    return keyOf(text, n);
  });
};

/** Pairs of indices into `a` and `b` that a longest common subsequence of their texts matches. */
const common = (a: readonly Token[], b: readonly Token[]): (readonly [number, number])[] => {
  const table = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0),
  );

  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      table[i]![j] =
        a[i]!.text === b[j]!.text
          ? table[i + 1]![j + 1]! + 1
          : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
  const pairs: (readonly [number, number])[] = [];
  let [i, j] = [0, 0];

  while (i < a.length && j < b.length) {
    if (a[i]!.text === b[j]!.text) pairs.push([i++, j++]);
    else if (table[i + 1]![j]! >= table[i]![j + 1]!) i++;
    else j++;
  }

  return pairs;
};

/** Keys for `next` that carry over from `before`: in-order matches first, then a same-text token that moved, nearest line first; the rest get keys no state has used. */
const carried = (
  before: readonly Token[],
  keysBefore: readonly string[],
  next: readonly Token[],
  used: ReadonlySet<string>,
): string[] => {
  const keys = Array.from<string | undefined>({ length: next.length });
  const taken = new Set<number>();

  for (const [i, j] of common(before, next)) {
    keys[j] = keysBefore[i];
    taken.add(i);
  }

  next.forEach((token, j) => {
    if (keys[j] !== undefined) return;

    const distance = (i: number) =>
      Math.abs(before[i]!.line - token.line) * 1e4 + Math.abs(before[i]!.col - token.col);

    const nearest = before
      .flatMap((other, i) => (other.text === token.text && !taken.has(i) ? [i] : []))
      .toSorted((a, b) => distance(a) - distance(b))[0];

    if (nearest === undefined) return;
    keys[j] = keysBefore[nearest];
    taken.add(nearest);
  });

  const mine = new Set(keys.flatMap((key) => key ?? []));

  return next.map((token, j) => {
    const kept = keys[j];

    if (kept !== undefined) return kept;
    let n = 0;

    while (used.has(keyOf(token.text, n)) || mine.has(keyOf(token.text, n))) n++;
    mine.add(keyOf(token.text, n));

    return keyOf(token.text, n);
  });
};

const signature = (tokens: readonly Token[]): string => tokens.map(({ text }) => text).join("\n");

/** The default: one node per line that has any text, keyed `line-1`, `line-2`… by its 1-based number. */
export const lines: Split = (code) =>
  code.flatMap((line, index) =>
    textOf(line).trim() === ""
      ? []
      : [{ key: `line-${index + 1}`, line: index, col: 0, pieces: line }],
  );

/** Sources morphed through, keyed together: tokens a diff of each source against the one before it matches keep one key, so they move. */
const across = (...sources: readonly string[]): Split => {
  const known = new Map<string, readonly string[]>();
  const used = new Set<string>();
  let before: { readonly tokens: readonly Token[]; readonly keys: readonly string[] } | undefined;

  for (const source of sources) {
    const tokens = lex(sourceLines(source));
    const seen = known.get(signature(tokens));

    const keys =
      seen ?? (before ? carried(before.tokens, before.keys, tokens, used) : occurrences(tokens));

    keys.forEach((key) => used.add(key));
    known.set(signature(tokens), keys);
    before = { tokens, keys };
  }

  return (code) => {
    const tokens = lex(code.map(textOf));
    const keys = known.get(signature(tokens));

    if (keys === undefined)
      throw new SceneError(
        "This <Code>'s source is not one of the sources given to codeTokens.across().",
        "Pass every source the morph goes through, in order: by={codeTokens.across(before, after)}.",
      );

    return partsOf(code, tokens, keys);
  };
};

/**
 * One node per token (a word, a run of operator characters, or one other character), keyed by its text and
 * how many times that text came before it in the source (`let#0`, `let#1`…), so a morph moves tokens both sources share.
 * `codeTokens.across(a, b, …)` keys by a diff of the sources instead, so a rewrite that adds or drops a repeated token keeps the rest in place.
 */
export const codeTokens: Split & { readonly across: typeof across } = Object.assign(
  (code: Highlighted): readonly CodePart[] => {
    const found = lex(code.map(textOf));

    return partsOf(code, found, occurrences(found));
  },
  { across },
);
