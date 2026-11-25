import { mix } from "svjeez";
import type { Hex, Theme, Token } from "svjeez/tools";

type Rgba = readonly [number, number, number, number];

const bytes = (hex: Hex): Rgba => {
  const [r = 0, g = 0, b = 0, a = 255] = (hex.slice(1).match(/../g) ?? []).map((pair) =>
    parseInt(pair, 16),
  );

  return [r, g, b, a / 255];
};

const CLEAR: Hex = "#00000000";

/** How far apart two colors are: the largest difference of a channel, both schemes. */
const distance = (a: readonly number[], b: readonly number[]) =>
  Math.max(...a.map((value, i) => Math.abs(value - b[i]!)));

/** The token, or the mix of two at a whole percent, closest to `target` (light rgb then dark rgb), within `within`. */
const opaque = (target: readonly number[], theme: Theme, within: number): Token | undefined => {
  const all = Object.values(theme);

  const rgb = (token: Token) => [
    ...bytes(token.light).slice(0, 3),
    ...bytes(token.dark).slice(0, 3),
  ];

  let best: { token: Token; off: number } | undefined;

  for (const token of all) {
    const off = distance(rgb(token), target);

    if (off <= within && (!best || off < best.off)) best = { token, off };
  }

  if (best) return best.token;

  for (const [i, a] of all.entries())
    for (const b of all.slice(i + 1)) {
      const [x, y] = [rgb(a), rgb(b)];
      const span = x.reduce((sum, value, k) => sum + (value - y[k]!) ** 2, 0);

      if (span === 0) continue;

      const share =
        x.reduce((sum, value, k) => sum + (target[k]! - y[k]!) * (value - y[k]!), 0) / span;

      const percent = Math.round(share * 100);

      if (percent < 1 || percent > 99) continue;

      const off = distance(
        x.map((value, k) => Math.round(value * (percent / 100) + y[k]! * (1 - percent / 100))),
        target,
      );

      if (off <= within && (!best || off < best.off))
        best = { token: mix(a, b, percent / 100), off };
    }

  return best?.token;
};

/**
 * The theme's token for a color that is `light` in one scheme and `dark` in the other: a token, a `mix()` of two at a whole
 * percent, or either mixed with transparent for a color with alpha. Undefined when nothing in the theme makes it.
 */
export const fromTheme = (light: Hex, dark: Hex, theme: Theme): Token | undefined => {
  const [l, d] = [bytes(light), bytes(dark)];
  const alpha = Math.round(l[3] * 100) / 100;

  if (alpha <= 0 || Math.abs(l[3] - d[3]) > 0.02) return undefined;

  const color = opaque([...l.slice(0, 3), ...d.slice(0, 3)], theme, Math.min(2 / alpha, 16));

  if (!color || alpha >= 1) return color;

  return mix(color, CLEAR, alpha);
};

/** The CSS that gives the page a theme's tokens as custom properties, light and under `prefers-color-scheme: dark`. */
export const themeCss = (theme: Theme): string => {
  const declared = (scheme: "light" | "dark") =>
    Object.values(theme)
      .map((token) => `--${token.name}:${token[scheme]}`)
      .join(";");

  return `:root{${declared("light")}}@media (prefers-color-scheme:dark){:root{${declared("dark")}}}`;
};
