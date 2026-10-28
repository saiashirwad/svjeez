import { el, motion, rect, type Color, type SvgNode } from "svjeez";
import { appWindow } from "svjeez/extras";
import { css, mono, theme } from "../style";

const SANS = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',system-ui,sans-serif";
const ROUND = "ui-rounded,'SF Pro Rounded',-apple-system,system-ui,sans-serif";

export const CSS = [
  css,
  `.sans text,.sans{font-family:${SANS}}`,
  `.round text,.round{font-family:${ROUND};font-variant-numeric:tabular-nums}`,
].join("\n");

/** Seeded, so every build scatters things the same way. */
export const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** The window every card shares: traffic lights and a title bar. The page adds the shadow, so the canvas stays transparent around it. A `mono` title names a file or a shell. */
export const chrome = (
  w: number,
  h: number,
  title: string,
  options: { bar?: number; mono?: boolean } = {},
) => {
  const win = appWindow(rect(0.5, 0.5, w - 1, h - 1), {
    theme,
    title,
    dots: "traffic",
    bar: options.bar ?? 40,
    radius: 12,
    class: options.mono ? undefined : "sans",
  });

  return options.mono ? { ...win, node: el.g({ fontFamily: mono }, [win.node]) } : win;
};

/** Fade everything out just before the loop restarts, so the jump back to the first frame is not seen. */
export const outro = (duration: number) =>
  motion({ opacity: 1 })
    .at(duration - 0.5)
    .to({ opacity: 0 }, 0.5);

/** Gray bars standing in for lines of text. */
export const skeleton = (
  x: number,
  y: number,
  widths: readonly number[],
  {
    gap = 16,
    height = 7,
    fill = theme.base02,
  }: { gap?: number; height?: number; fill?: Color } = {},
): SvgNode[] =>
  widths.map((w, i) => el.rect({ x, y: y + i * gap, width: w, height, rx: height / 2, fill }));
