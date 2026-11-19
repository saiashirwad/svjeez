import { tokens } from "svjeez";
import type { Hex, Theme } from "svjeez/tools";
import type { CodeRole } from "@svjeez/code/palettes";
import { theme } from "@examples/colors.ts";

// The scenes paint with the examples theme's tokens. A palette is new values for them, which restyle() swaps into a
// scene's SVG, and the page's own colors under :root[data-palette] (styles/code.ts).

export type Name = keyof typeof theme;

/** The theme's tokens in the order a palette lists them: the greys from background to text, then the accents. */
const NAMES = [
  "background",
  "surface",
  "raised",
  "border",
  "muted",
  "text",
  "red",
  "orange",
  "yellow",
  "green",
  "cyan",
  "blue",
  "magenta",
] as const satisfies readonly Name[];

type Hexes<T extends readonly unknown[]> = { readonly [I in keyof T]: Hex };

type Row = Hexes<typeof NAMES>;

const named = (row: Row) =>
  // SAFETY: a Row has one color for each of NAMES, so every Name gets one.
  Object.fromEntries(NAMES.map((name, i) => [name, row[i]])) as Record<Name, Hex>;

const ramp = (light: Row, dark: Row): Theme<Name> =>
  tokens({ light: named(light), dark: named(dark) });

export interface Palette {
  readonly id: string;
  readonly label: string;
  readonly theme: Theme<Name>;
}

// The base16 palettes the old site wore, slot by slot: base00 to base05 for the greys, base08 to base0E for the accents.
/** In picker order. The first is the default, the look the scenes are built with (examples/theme.ts). */
export const PALETTES = [
  { id: "system", label: "System", theme },
  {
    id: "solarized",
    label: "Solarized",
    theme: ramp(
      [
        "#fdf6e3",
        "#eee8d5",
        "#93a1a1",
        "#839496",
        "#657b83",
        "#586e75",
        "#dc322f",
        "#cb4b16",
        "#b58900",
        "#859900",
        "#2aa198",
        "#268bd2",
        "#6c71c4",
      ],
      [
        "#002b36",
        "#073642",
        "#586e75",
        "#657b83",
        "#839496",
        "#93a1a1",
        "#dc322f",
        "#cb4b16",
        "#b58900",
        "#859900",
        "#2aa198",
        "#268bd2",
        "#6c71c4",
      ],
    ),
  },
  {
    id: "gruvbox",
    label: "Gruvbox",
    theme: ramp(
      [
        "#fbf1c7",
        "#ebdbb2",
        "#d5c4a1",
        "#bdae93",
        "#665c54",
        "#504945",
        "#9d0006",
        "#af3a03",
        "#b57614",
        "#79740e",
        "#427b58",
        "#076678",
        "#8f3f71",
      ],
      [
        "#282828",
        "#3c3836",
        "#504945",
        "#665c54",
        "#bdae93",
        "#d5c4a1",
        "#fb4934",
        "#fe8019",
        "#fabd2f",
        "#b8bb26",
        "#8ec07c",
        "#83a598",
        "#d3869b",
      ],
    ),
  },
  {
    id: "rose-pine",
    label: "Rosé Pine",
    theme: ramp(
      [
        "#faf4ed",
        "#fffaf3",
        "#f2e9de",
        "#9893a5",
        "#797593",
        "#575279",
        "#b4637a",
        "#ea9d34",
        "#d7827e",
        "#286983",
        "#56949f",
        "#286983",
        "#907aa9",
      ],
      [
        "#191724",
        "#1f1d2e",
        "#26233a",
        "#6e6a86",
        "#908caa",
        "#e0def4",
        "#eb6f92",
        "#f6c177",
        "#ebbcba",
        "#31748f",
        "#9ccfd8",
        "#3e8fb0",
        "#c4a7e7",
      ],
    ),
  },
] as const satisfies readonly Palette[];

export type PaletteId = (typeof PALETTES)[number]["id"];

export const DEFAULT_PALETTE: PaletteId = PALETTES[0].id;

/** Which token paints each code role, in a code scene's palette and in the page's code blocks. */
export const CODE = {
  plain: "text",
  comment: "muted",
  punctuation: "muted",
  keyword: "magenta",
  string: "green",
  number: "orange",
  constant: "orange",
  variable: "red",
  function: "blue",
  type: "yellow",
  tag: "red",
  inserted: "green",
  deleted: "red",
} as const satisfies Record<CodeRole, Name>;

// SAFETY: CODE has exactly the CodeRole keys, as its `satisfies` checks.
const ROLES = Object.keys(CODE) as CodeRole[];

/** Whether a scene paints with the theme's tokens, and so follows the palette. */
export const themed = (svg: string) => NAMES.some((name) => svg.includes(`--${name}:`));

/**
 * The tokens a scene is repainted with: the palette's, and for each code palette it uses (`palette(name, …)` from
 * @svjeez/code, as `--<name>-<role>`) the palette's color for each role. Undefined for the default palette.
 */
export const themeOf = (id: PaletteId, svg: string): Theme | undefined => {
  if (id === DEFAULT_PALETTE) return undefined;
  const { theme: values } = PALETTES.find((p) => p.id === id)!;
  const code = new Set([...svg.matchAll(/--([\w-]+)-keyword:/g)].map(([, name]) => name!));

  const roles = [...code].flatMap((name) =>
    ROLES.map((role) => {
      const { light, dark } = values[CODE[role]];

      return { kind: "token" as const, name: `${name}-${role}`, light, dark };
    }),
  );

  return { ...values, ...Object.fromEntries(roles.map((token) => [token.name, token])) };
};
