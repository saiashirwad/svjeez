// The one look for code in every example: editors, code explainers, terminals and code labels.
// The site's code blocks and playground read the same palette and font, so a scene and the page around it match.
import { adaptive, systemDark, systemLight } from "svjeez/extras";
import { mono } from "./fonts/faces";

/** The palette, light and dark. */
export const palette = { light: systemLight, dark: systemDark } as const;

/** The palette as one scheme that follows the viewer. Pass `css` to `render`. */
export const { theme, css } = adaptive(palette);

/** JetBrains Mono, embedded, with ligatures off so `=>` stays two characters. Use it as `font` or `fontFamily`. */
export { mono };

/** The family name the site loads for the same font. */
export const MONO_FAMILY = "JetBrains Mono";
