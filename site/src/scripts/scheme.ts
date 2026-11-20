export type Scheme = "light" | "dark";

const dark = matchMedia("(prefers-color-scheme: dark)");
export const calm = matchMedia("(prefers-reduced-motion: reduce)");

export const scheme = (): Scheme => {
  const chosen = document.documentElement.dataset.theme;

  return chosen === "light" || chosen === "dark" ? chosen : dark.matches ? "dark" : "light";
};

/** The OS's scheme. Safari answers an <img> SVG's prefers-color-scheme with this one, whatever color-scheme the page or
 * the img sets, so an img that must show the other one gets a copy pinned to it. */
export const systemScheme = (): Scheme => (dark.matches ? "dark" : "light");

export const THEMECHANGE = "themechange";

// The OS switching changes what a page left on system shows, and which imgs Safari needs pinned under any choice.
dark.addEventListener("change", () => dispatchEvent(new Event(THEMECHANGE)));
