import { adaptive, base16 } from "svjeez/extras";

// One palette, two schemes: warm paper by day, blue ink-black by night. Slots follow base16.
export const { theme, css: themeCss } = adaptive({
  dark: base16("#14162A", "#1D2038", "#2D3150", "#6C7196", "#999EC0", "#C9CCE6", "#EEEFFA", "#FFFFFF", "#FF7A6E", "#FFA05C", "#FFD166", "#8FD19E", "#6FD0C8", "#7FA2FF", "#B79CFF", "#C98F6A"),
  light: base16("#FBF1DE", "#FFFBF2", "#E6D9BF", "#A39780", "#6E6450", "#3F382B", "#221D14", "#14100A", "#D9483B", "#E8772E", "#E0A21B", "#4F8A5B", "#2F8C88", "#3A5FC8", "#7E52C2", "#A66B43"),
});

type Pair = readonly [dark: string, light: string];

/** Scene colors that differ per scheme, as CSS variables: `v.sea` is `var(--sea)`. */
export const palette = <const T extends Record<string, Pair>>(pairs: T) => {
  const decl = (index: 0 | 1) =>
    Object.entries(pairs)
      .map(([name, pair]) => `--${name}:${pair[index]}`)
      .join(";");
  return {
    v: Object.fromEntries(Object.keys(pairs).map((name) => [name, `var(--${name})`])) as { [K in keyof T]: string },
    css: `svg{${decl(0)}}\n@media (prefers-color-scheme:light){svg{${decl(1)}}}`,
  };
};

/** Show an element in one scheme only. */
export const SCHEME_CSS = "@media (prefers-color-scheme:light){.night{display:none}}\n@media (prefers-color-scheme:dark){.day{display:none}}";

/** Seeded, so every build scatters things the same way. */
export const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
