import type { Look } from "svjeez/page";
import { DEFAULT_PALETTE, themeOf, type PaletteId } from "../palettes";
import { palette } from "./palette";
import { scheme } from "./scheme";

// A player compares looks by their theme function, so a palette has one function for good.
const themers = new Map<PaletteId, NonNullable<Look["theme"]>>();

const themer = (id: PaletteId) => {
  const known = themers.get(id);

  if (known) return known;
  const made = (svg: string) => themeOf(id, svg);
  themers.set(id, made);

  return made;
};

/** How an img must look now: its own data-scheme or the page's, and the page's palette when the scene is themed. */
export const look = (img: HTMLImageElement): Look => {
  const own = img.dataset.scheme;
  const id = palette();

  return {
    scheme: own === "light" || own === "dark" ? own : scheme(),
    theme: "themed" in img.dataset && id !== DEFAULT_PALETTE ? themer(id) : undefined,
  };
};
