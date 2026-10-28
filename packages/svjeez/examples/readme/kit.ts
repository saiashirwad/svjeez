import { adaptive, tomorrow, tomorrowNight } from "svjeez/extras";

export const { theme, css } = adaptive({ dark: tomorrowNight, light: tomorrow });

export const CSS = [css, ".mono,.mono text{font-family:'JetBrains Mono','SF Mono',ui-monospace,Menlo,Consolas,monospace;font-variant-ligatures:none}"].join("\n");

export { mono } from "../fonts/faces";
