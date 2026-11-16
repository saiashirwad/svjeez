export type Scheme = "light" | "dark";

const dark = matchMedia("(prefers-color-scheme: dark)");
export const calm = matchMedia("(prefers-reduced-motion: reduce)");

/** The scheme the page shows: the toggle's choice, else the system's. An <img> SVG follows the same one. */
export const scheme = (): Scheme => {
  const chosen = document.documentElement.dataset.theme;

  return chosen === "light" || chosen === "dark" ? chosen : dark.matches ? "dark" : "light";
};

/** The OS's scheme. Safari answers an <img> SVG's prefers-color-scheme with this one, whatever color-scheme the page or
 * the img sets, so an img that must show the other one gets a copy pinned to it. */
export const systemScheme = (): Scheme => (dark.matches ? "dark" : "light");

/** The SVG with its prefers-color-scheme queries answered for `scheme`, so it shows that scheme in any browser. */
export const pinScheme = (svg: string, scheme: Scheme) =>
  svg.replace(/\(\s*prefers-color-scheme\s*:\s*(light|dark)\s*\)/g, (_, query) =>
    query === scheme ? "(min-width: 0)" : "(max-width: -1px)",
  );

/** Fired on window when the toggle or the OS changes the scheme. */
export const THEMECHANGE = "themechange";

// The OS switching changes what a page left on system shows, and which imgs Safari needs pinned under any choice.
dark.addEventListener("change", () => dispatchEvent(new Event(THEMECHANGE)));
