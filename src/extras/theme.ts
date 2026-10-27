import type { Color } from "../attributes";

/** A base16 scheme: 00-07 run background to foreground, 08-0F are the accents. */
export type Base16 = { readonly [K in Slot]: Color };
export type Slot = `base0${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | "A" | "B" | "C" | "D" | "E" | "F"}`;

const SLOTS = ["00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "0A", "0B", "0C", "0D", "0E", "0F"].map((n) => `base${n}` as Slot);

/** Build a scheme from 16 hex colors, base00 first. */
export const base16 = (...colors: readonly Color[]): Base16 => {
  if (colors.length !== 16) throw new Error(`base16() takes 16 colors, got ${colors.length}.`);
  return Object.fromEntries(SLOTS.map((slot, i) => [slot, colors[i]])) as Base16;
};

/** What a run of code or terminal output is, so the scheme can color it. */
export type Role = keyof typeof ROLES;

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

export const tint = (theme: Base16, role: Role): Color => theme[ROLES[role]];

/**
 * One scheme that follows the viewer's color scheme. Its colors are CSS variables; pass `css` to `render`.
 * Light wins under `prefers-color-scheme: light`, dark otherwise.
 */
export const adaptive = ({ dark, light }: { readonly dark: Base16; readonly light: Base16 }): { readonly theme: Base16; readonly css: string } => {
  const vars = (scheme: Base16) => SLOTS.map((slot) => `--${slot}:${scheme[slot]}`).join(";");
  return {
    theme: base16(...SLOTS.map((slot): Color => `var(--${slot})`)),
    css: `svg{${vars(dark)}}\n@media (prefers-color-scheme:light){svg{${vars(light)}}}`,
  };
};

export const defaultDark = base16("#181818", "#282828", "#383838", "#585858", "#b8b8b8", "#d8d8d8", "#e8e8e8", "#f8f8f8", "#ab4642", "#dc9656", "#f7ca88", "#a1b56c", "#86c1b9", "#7cafc2", "#ba8baf", "#a16946");
export const defaultLight = base16("#f8f8f8", "#e8e8e8", "#d8d8d8", "#b8b8b8", "#585858", "#383838", "#282828", "#181818", "#ab4642", "#dc9656", "#f7ca88", "#a1b56c", "#86c1b9", "#7cafc2", "#ba8baf", "#a16946");
export const tomorrowNight = base16("#1d1f21", "#282a2e", "#373b41", "#969896", "#b4b7b4", "#c5c8c6", "#e0e0e0", "#ffffff", "#cc6666", "#de935f", "#f0c674", "#b5bd68", "#8abeb7", "#81a2be", "#b294bb", "#a3685a");
export const tomorrow = base16("#ffffff", "#e0e0e0", "#d6d6d6", "#8e908c", "#969896", "#4d4d4c", "#282a2e", "#1d1f21", "#c82829", "#f5871f", "#eab700", "#718c00", "#3e999f", "#4271ae", "#8959a8", "#a3685a");
