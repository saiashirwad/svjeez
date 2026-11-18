const SLOTS = [
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
] as const;

export type Slot = (typeof SLOTS)[number];

export type Base16 = Readonly<Record<Slot, string>>;

export interface Palette {
  readonly light: Base16;
  readonly dark: Base16;
}

export const paletteCss = (palette: Palette): string => {
  const decl = (side: Base16) => SLOTS.map((slot) => `--${slot}:${side[slot]}`).join(";");

  return `:root{${decl(palette.light)}}@media (prefers-color-scheme:dark){:root{${decl(palette.dark)}}}`;
};
