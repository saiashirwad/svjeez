import { adaptive, systemDark, systemLight } from "svjeez";
import { mono } from "./fonts/faces";

/** The palette, light and dark. */
export const palette = { light: systemLight, dark: systemDark } as const;

/** The palette as one scheme that follows the viewer. Pass `css` to `render`. */
export const { theme, css } = adaptive(palette);

/** JetBrains Mono, embedded, with ligatures off so `=>` stays two characters. Use it as `font` or `fontFamily`. */
export { mono };

/** The family name the site loads for the same font. */
export const MONO_FAMILY = "JetBrains Mono";
