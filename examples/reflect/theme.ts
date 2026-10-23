import type { Attrs, Color } from "svg-motion";

export const W = 1440;
export const H = 1160;
/** One turn of the star field. The rings turn 270° in the same time, which their 8-fold dots hide. */
export const D = 70;

/** Center of the black hole, its rings and its stars. */
export const O = { x: 720, y: 741 } as const;

export const C = {
  bg: "#030014",
  ink: "#F4F0FF",
  text: "#EFEDFD",
  violet: "#BA9CFF",
  lilac: "#CFB8FF",
  link: "#8B7CF6",
  select: "#4F3FD0",
} as const satisfies Record<string, Color>;

export const CSS = [
  `.ui{font-family:"Inter V",Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}`,
  `.display{font-family:AeonikPro,"Aeonik Pro",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-weight:500}`,
  `.u{text-decoration:underline;text-underline-offset:3px}`,
].join("");

export const ui = (size: number, fill: Color, extra: Attrs<"text"> = {}): Attrs<"text"> => ({ class: "ui", fontSize: size, fill, ...extra });

export const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** The app window's outer edge. Its 8px inset frames the screenshot area. */
export const FRAME = { x: 112, y: 697, width: 1216, height: 766 } as const;
