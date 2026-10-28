import type { Color } from "svjeez";

type Pair = readonly [dark: string, light: string];

/** Scene colors that differ per scheme, as CSS variables: `v.sea` is `var(--sea)`. */
export const palette = <const T extends Record<string, Pair>>(pairs: T) => {
  const decl = (index: 0 | 1) =>
    Object.entries(pairs)
      .map(([name, pair]) => `--${name}:${pair[index]}`)
      .join(";");

  // SAFETY: the keys come from pairs, so each key of T is present in the result
  return {
    v: Object.fromEntries(Object.keys(pairs).map((name) => [name, `var(--${name})`])) as {
      [K in keyof T]: Color;
    },
    css: `svg{${decl(0)}}\n@media (prefers-color-scheme:light){svg{${decl(1)}}}`,
  };
};

/** Show an element in one scheme only. */
export const SCHEME_CSS =
  "@media (prefers-color-scheme:light){.night{display:none}}\n@media (prefers-color-scheme:dark){.day{display:none}}";

/** Seeded, so every build scatters things the same way. */
export const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
