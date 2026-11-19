import { DEFAULT_PALETTE, PALETTES, type PaletteId } from "../palettes";

export type { PaletteId };

export const PALETTECHANGE = "palettechange";

/** The palette the page wears: its data-palette, set before paint from localStorage (layouts/Base.astro). */
export const palette = (): PaletteId =>
  PALETTES.find(({ id }) => id === document.documentElement.dataset.palette)?.id ?? DEFAULT_PALETTE;

export const choose = (id: PaletteId) => {
  const root = document.documentElement;

  if (id === DEFAULT_PALETTE) delete root.dataset.palette;
  else root.dataset.palette = id;

  try {
    if (id === DEFAULT_PALETTE) localStorage.removeItem("palette");
    else localStorage.setItem("palette", id);
  } catch {}

  dispatchEvent(new Event(PALETTECHANGE));
};
