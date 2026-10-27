import { el } from "../el";
import { motion, type Motion, type Span } from "../motion";
import type { Color } from "../attributes";
import type { SvgNode } from "../svg";
import type { Layout, PlacedToken } from "./code";

/** Stable occurrence identities preserve repeated tokens while LCS keeps their relative order. */
export function match(a: readonly PlacedToken[], b: readonly PlacedToken[]): readonly (readonly [number, number])[] {
  const keys = (tokens: readonly PlacedToken[]) => {
    const counts = new Map<string, number>();
    return tokens.map(({ content }) => {
      const n = (counts.get(content) ?? 0) + 1;
      counts.set(content, n);
      return JSON.stringify([content, n]);
    });
  };
  const x = keys(a), y = keys(b);
  const dp = Array.from({ length: x.length + 1 }, () => new Uint32Array(y.length + 1));
  for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--)
    dp[i]![j] = x[i] === y[j] ? 1 + dp[i + 1]![j + 1]! : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const pairs: [number, number][] = [];
  let i = 0, j = 0;
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) { pairs.push([i++, j++]); continue; }
    if (dp[i + 1]![j]! >= dp[i]![j + 1]!) i++; else j++;
  }
  return pairs;
}

interface Chain { token: PlacedToken; layout: Layout; track: Motion<"x" | "y" | "opacity">; current: PlacedToken }
export interface Morph { readonly node: SvgNode; step(index: number): Layout }
export function morph(versions: readonly Layout[], options: { readonly at: readonly Span[]; readonly over: number }): Morph {
  if (!versions.length || versions.length !== options.at.length || !Number.isFinite(options.over) || options.over <= 0) throw new Error("morph() needs versions, one span per version and a positive duration.");
  const starts = options.at.map(s => s.at);
  if (starts.some((n, i) => !Number.isFinite(n) || n < 0 || (i > 0 && n < starts[i - 1]! + options.over))) throw new Error("morph() transitions must be ordered and non-overlapping.");
  const chains: Chain[] = [];
  const make = (token: PlacedToken, layout: Layout, visible: boolean, start: number): Chain => {
    const track = visible ? motion({ x: 0, y: 0, opacity: 1 }) : motion({ x: 0, y: 0, opacity: 0 }).at(start).to({ opacity: 1 }, options.over);
    const chain = { token, current: token, layout, track }; chains.push(chain); return chain;
  };
  let active = versions[0]!.tokens.map(token => make(token, versions[0]!, starts[0] === 0, starts[0]!));
  for (let step = 1; step < versions.length; step++) {
    const before = versions[step - 1]!, after = versions[step]!, at = starts[step]!;
    const pairs = match(before.tokens, after.tokens);
    const byNew = new Map(pairs.map(([a, b]) => [b, a]));
    const old = new Set(pairs.map(([a]) => a));
    active.forEach((chain, i) => { if (!old.has(i)) chain.track = chain.track.at(at).to({ opacity: 0 }, options.over); });
    active = after.tokens.map((token, i) => {
      const previous = byNew.get(i);
      if (previous === undefined) return make(token, after, false, at);
      const chain = active[previous]!;
      chain.track = chain.track.at(at).to({ x: token.x - chain.token.x, y: token.y - chain.token.y }, options.over);
      chain.current = token;
      return chain;
    });
  }
  return {
    node: el.g({}, chains.map(({ token: t, layout, track }) => el.text({ x: t.x, y: t.y + layout.options.fontSize, fontSize: layout.options.fontSize, fontFamily: "monospace", fill: t.color as Color | undefined, fontStyle: (t.fontStyle ?? 0) & 1 ? "italic" : undefined, fontWeight: (t.fontStyle ?? 0) & 2 ? "bold" : undefined, xmlSpace: "preserve", animation: track }, t.content))),
    step(index) { const value = versions[index]; if (!value) throw new Error(`morph.step(): invalid index ${index}.`); return value; },
  };
}
