export type Scheme = "light" | "dark";

const dark = matchMedia("(prefers-color-scheme: dark)");
export const calm = matchMedia("(prefers-reduced-motion: reduce)");

/** The scheme the page shows: the toggle's choice, else the system's. An <img> SVG follows the same one. */
export const scheme = (): Scheme => {
  const chosen = document.documentElement.dataset.theme;

  return chosen === "light" || chosen === "dark" ? chosen : dark.matches ? "dark" : "light";
};

/** Fired on window when the toggle changes the scheme. */
export const THEMECHANGE = "themechange";
