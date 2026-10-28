import type { Color } from "../attributes";

/** A base16 scheme: 00-07 run background to foreground, 08-0F are the accents. */
export type Base16 = { readonly [K in Slot]: Color };

export type Slot =
  `base0${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | "A" | "B" | "C" | "D" | "E" | "F"}`;

const SLOTS: readonly Slot[] = [
  "base00",
  "base01",
  "base02",
  "base03",
  "base04",
  "base05",
  "base06",
  "base07",
  "base08",
  "base09",
  "base0A",
  "base0B",
  "base0C",
  "base0D",
  "base0E",
  "base0F",
];

/** Build a scheme from 16 hex colors, base00 first. */
export const base16 = (...colors: readonly Color[]): Base16 => {
  if (colors.length !== 16) throw new Error(`base16() needs 16 colors, got ${colors.length}.`);

  // SAFETY: the length check above gives one color per slot in SLOTS, so every Slot key is present.
  return Object.fromEntries(SLOTS.map((slot, i) => [slot, colors[i]])) as Base16;
};

/** What a run of code or terminal output is, so the scheme can color it. */
export type CodeRole = keyof typeof ROLES;

/** Slots follow the base16 styling guidelines; the ANSI names are for terminal output. */
const ROLES = {
  plain: "base05",
  muted: "base03",
  comment: "base03",
  punct: "base04",
  keyword: "base0E",
  fn: "base0D",
  string: "base0B",
  number: "base09",
  constant: "base09",
  type: "base0A",
  variable: "base08",
  tag: "base08",
  red: "base08",
  green: "base0B",
  yellow: "base0A",
  blue: "base0D",
  magenta: "base0E",
  cyan: "base0C",
} as const satisfies Record<string, Slot>;

export const tint = (theme: Base16, role: CodeRole): Color => theme[ROLES[role]];

export interface VariablesResult<K extends string> {
  readonly vars: { readonly [N in K]: `var(--${N})` };
  readonly css: string;
}

/** CSS variables with defaults. `vars.sky` is `var(--sky)`; pass `css` to `render`. With `light`, those values win under prefers-color-scheme: light. */
export const variables = <const K extends string>(
  dark: Readonly<Record<K, string>>,
  light?: Readonly<Record<K, string>>,
): VariablesResult<K> => {
  // SAFETY: Object.keys of a Record<K, string> lists exactly its K keys, and those are strings.
  const names = Object.keys(dark) as K[];

  for (const name of names)
    if (!/^[A-Za-z_][\w-]*$/.test(name))
      throw new Error(`variables() needs CSS identifiers for names, got "${name}".`);

  const declarations = (values: Readonly<Record<K, string>>) =>
    names.map((name) => `--${name}:${values[name]}`).join(";");

  // SAFETY: names are the keys of `dark`, so each one gets exactly one `var(--name)` entry.
  return {
    vars: Object.fromEntries(names.map((name) => [name, `var(--${name})`])) as {
      [N in K]: `var(--${N})`;
    },
    css: `svg{${declarations(dark)}}${light ? `\n@media (prefers-color-scheme:light){svg{${declarations(light)}}}` : ""}`,
  };
};

/**
 * One scheme that follows the viewer's color scheme. Its colors are CSS variables; pass `css` to `render`.
 * Light wins under `prefers-color-scheme: light`, dark otherwise.
 */
export interface AdaptiveResult {
  readonly theme: Base16;
  readonly css: string;
}

export const adaptive = ({
  dark,
  light,
}: {
  readonly dark: Base16;
  readonly light: Base16;
}): AdaptiveResult => {
  const { vars, css } = variables(dark, light);

  return { theme: vars, css };
};

export const defaultDark = /* @__PURE__ */ base16(
  "#181818",
  "#282828",
  "#383838",
  "#585858",
  "#b8b8b8",
  "#d8d8d8",
  "#e8e8e8",
  "#f8f8f8",
  "#ab4642",
  "#dc9656",
  "#f7ca88",
  "#a1b56c",
  "#86c1b9",
  "#7cafc2",
  "#ba8baf",
  "#a16946",
);

export const defaultLight = /* @__PURE__ */ base16(
  "#f8f8f8",
  "#e8e8e8",
  "#d8d8d8",
  "#b8b8b8",
  "#585858",
  "#383838",
  "#282828",
  "#181818",
  "#ab4642",
  "#dc9656",
  "#f7ca88",
  "#a1b56c",
  "#86c1b9",
  "#7cafc2",
  "#ba8baf",
  "#a16946",
);

export const tomorrowNight = /* @__PURE__ */ base16(
  "#1d1f21",
  "#282a2e",
  "#373b41",
  "#969896",
  "#b4b7b4",
  "#c5c8c6",
  "#e0e0e0",
  "#ffffff",
  "#cc6666",
  "#de935f",
  "#f0c674",
  "#b5bd68",
  "#8abeb7",
  "#81a2be",
  "#b294bb",
  "#a3685a",
);

export const tomorrow = /* @__PURE__ */ base16(
  "#ffffff",
  "#e0e0e0",
  "#d6d6d6",
  "#8e908c",
  "#969896",
  "#4d4d4c",
  "#282a2e",
  "#1d1f21",
  "#c82829",
  "#f5871f",
  "#eab700",
  "#718c00",
  "#3e999f",
  "#4271ae",
  "#8959a8",
  "#a3685a",
);

/** White and system gray by day, with the system accent colors. Pairs with `systemDark` in `adaptive`. */
export const systemLight = /* @__PURE__ */ base16(
  "#FFFFFF",
  "#F5F5F7",
  "#E5E5EA",
  "#8E8E93",
  "#6E6E73",
  "#1D1D1F",
  "#1D1D1F",
  "#000000",
  "#E5453B",
  "#E8751A",
  "#E5A50A",
  "#2FA84F",
  "#1B9AAA",
  "#0A6CFF",
  "#9B51E0",
  "#A66B43",
);

/** Near-black by night, with the system accent colors. Pairs with `systemLight` in `adaptive`. */
export const systemDark = /* @__PURE__ */ base16(
  "#1E1E20",
  "#2A2A2D",
  "#3A3A3D",
  "#7C7C82",
  "#A1A1A6",
  "#E5E5EA",
  "#F5F5F7",
  "#FFFFFF",
  "#FF6961",
  "#FF9F0A",
  "#FFD60A",
  "#32D74B",
  "#64D2FF",
  "#5EA0FF",
  "#C58AFF",
  "#AC8E68",
);

/** Solarized by night. Pairs with `solarizedLight` in `adaptive`. */
export const solarizedDark = /* @__PURE__ */ base16(
  "#002b36",
  "#073642",
  "#586e75",
  "#657b83",
  "#839496",
  "#93a1a1",
  "#eee8d5",
  "#fdf6e3",
  "#dc322f",
  "#cb4b16",
  "#b58900",
  "#859900",
  "#2aa198",
  "#268bd2",
  "#6c71c4",
  "#d33682",
);

/** Solarized by day: the dark ramp reversed, the same accents. Pairs with `solarizedDark` in `adaptive`. */
export const solarizedLight = /* @__PURE__ */ base16(
  "#fdf6e3",
  "#eee8d5",
  "#93a1a1",
  "#839496",
  "#657b83",
  "#586e75",
  "#073642",
  "#002b36",
  "#dc322f",
  "#cb4b16",
  "#b58900",
  "#859900",
  "#2aa198",
  "#268bd2",
  "#6c71c4",
  "#d33682",
);

/** Gruvbox medium by night. Pairs with `gruvboxLight` in `adaptive`. */
export const gruvboxDark = /* @__PURE__ */ base16(
  "#282828",
  "#3c3836",
  "#504945",
  "#665c54",
  "#bdae93",
  "#d5c4a1",
  "#ebdbb2",
  "#fbf1c7",
  "#fb4934",
  "#fe8019",
  "#fabd2f",
  "#b8bb26",
  "#8ec07c",
  "#83a598",
  "#d3869b",
  "#d65d0e",
);

/** Gruvbox medium by day. Pairs with `gruvboxDark` in `adaptive`. */
export const gruvboxLight = /* @__PURE__ */ base16(
  "#fbf1c7",
  "#ebdbb2",
  "#d5c4a1",
  "#bdae93",
  "#665c54",
  "#504945",
  "#3c3836",
  "#282828",
  "#9d0006",
  "#af3a03",
  "#b57614",
  "#79740e",
  "#427b58",
  "#076678",
  "#8f3f71",
  "#d65d0e",
);
