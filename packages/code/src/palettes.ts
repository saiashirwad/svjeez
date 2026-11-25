import { tokens } from "svjeez";
import type { Hex } from "svjeez/tools";
import { ROLES, type CodeRole, type Palette } from "./roles.ts";

export type { CodeRole, Palette } from "./roles.ts";

export interface PaletteColors {
  readonly light: Readonly<Record<CodeRole, Hex>>;
  readonly dark: Readonly<Record<CodeRole, Hex>>;
}

export const palette = (name: string, { light, dark }: PaletteColors): Palette => {
  const named = (colors: Readonly<Record<CodeRole, Hex>>) =>
    Object.fromEntries(ROLES.map((role) => [`${name}-${role}`, colors[role]]));

  const made = tokens({ light: named(light), dark: named(dark) });

  // SAFETY: ROLES lists every CodeRole, and each of them was given a token named after it above.
  return Object.fromEntries(ROLES.map((role) => [role, made[`${name}-${role}`]!])) as Palette;
};

type Slots = readonly [
  text: Hex,
  muted: Hex,
  soft: Hex,
  purple: Hex,
  blue: Hex,
  green: Hex,
  orange: Hex,
  yellow: Hex,
  red: Hex,
];

const colors = ([text, muted, soft, purple, blue, green, orange, yellow, red]: Slots) => ({
  plain: text,
  comment: muted,
  punctuation: soft,
  keyword: purple,
  string: green,
  number: orange,
  constant: orange,
  variable: red,
  function: blue,
  type: yellow,
  attribute: yellow,
  tag: red,
  inserted: green,
  deleted: red,
});

const pair = (light: Slots, dark: Slots, name: string) =>
  palette(name, { light: colors(light), dark: colors(dark) });

export const tomorrow = pair(
  [
    "#4d4d4c",
    "#6d6f6b",
    "#6d6f6d",
    "#8959a8",
    "#416faa",
    "#5c7200",
    "#ab5708",
    "#896b00",
    "#c82829",
  ],
  [
    "#c5c8c6",
    "#969896",
    "#b4b7b4",
    "#b294bb",
    "#81a2be",
    "#b5bd68",
    "#de935f",
    "#f0c674",
    "#cc6666",
  ],
  "tomorrow",
);

export const solarized = pair(
  [
    "#586e75",
    "#627274",
    "#5c7077",
    "#6166c0",
    "#2074af",
    "#667500",
    "#bd4615",
    "#8c6a00",
    "#d32724",
  ],
  [
    "#93a1a1",
    "#6e868f",
    "#839496",
    "#777cc8",
    "#268bd2",
    "#859900",
    "#e25418",
    "#b58900",
    "#e1504e",
  ],
  "solarized",
);

export const gruvbox = pair(
  [
    "#504945",
    "#7e6d4d",
    "#665c54",
    "#8f3f71",
    "#076678",
    "#74700d",
    "#af3a03",
    "#996411",
    "#9d0006",
  ],
  [
    "#d5c4a1",
    "#8f8277",
    "#bdae93",
    "#d3869b",
    "#83a598",
    "#b8bb26",
    "#fe8019",
    "#fabd2f",
    "#fb4934",
  ],
  "gruvbox",
);

export const rosePine = pair(
  [
    "#575279",
    "#716b80",
    "#6f6b89",
    "#7e649b",
    "#286983",
    "#286983",
    "#995f10",
    "#c2423c",
    "#ab526c",
  ],
  [
    "#e0def4",
    "#837f9a",
    "#908caa",
    "#c4a7e7",
    "#3e8fb0",
    "#3b8dad",
    "#f6c177",
    "#ebbcba",
    "#eb6f92",
  ],
  "rosePine",
);
