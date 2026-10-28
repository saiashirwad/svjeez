// The palettes a reader can pick in the header. Scenes that paint with the base16 variables, the page and its code all follow the pick.
import { gruvboxDark, gruvboxLight, solarizedDark, solarizedLight, systemDark, systemLight, tomorrow, tomorrowNight, type Base16 } from "svjeez/extras";

export interface Palette {
  readonly id: string;
  readonly label: string;
  readonly light: Base16;
  readonly dark: Base16;
}

/** In picker order. The first is the default, the look the scenes are built with (`palette` in examples/style.ts). */
export const PALETTES = [
  { id: "system", label: "System", light: systemLight, dark: systemDark },
  { id: "tomorrow", label: "Tomorrow", light: tomorrow, dark: tomorrowNight },
  { id: "solarized", label: "Solarized", light: solarizedLight, dark: solarizedDark },
  { id: "gruvbox", label: "Gruvbox", light: gruvboxLight, dark: gruvboxDark },
] as const satisfies readonly Palette[];

export type PaletteId = (typeof PALETTES)[number]["id"];

export const DEFAULT_PALETTE: PaletteId = PALETTES[0].id;

/** Whether a rendered scene paints with the base16 variables, so a palette can recolor it. */
export const themed = (svg: string) => svg.includes("var(--base");
