import { google } from "@svjeez/fonts";
import { theme } from "../gallery-style";
import { def, type Font, type Paint, type Ref, type SvgNode } from "svjeez";

export const W = 960;
export const H = 540;

/** Where a y from the original 3:2 layout (drawn 108 to 610 tall) lands on the 16:9 sheet. Sizes stay; only places move. */
export const Y = (y: number): number => Math.round((70 + (y - 108) * 0.885) * 10) / 10;
export const D = 22;

/** Base16 slots, so the site's palette picker and light and dark recolor the map. Paper, land and sea step through the scheme's three background slots. */
export const C = {
  paper: theme.base00,
  land: theme.base01,
  sea: theme.base02,
  ink: theme.base06,
  faded: theme.base04,
  river: theme.base0D,
  red: theme.base08,
  ember: theme.base09,
} as const;

export const roman = await google("Cinzel");
export const uncial = await google("Uncial Antiqua");

/** Mulberry32, so every tree and peak lands in the same place on every build. */
export const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const n = (v: number) => Math.round(v * 10) / 10;

/** Passes a motion or a span through for the intro copy of the map, and drops it for the still copy. */
export type Play = <T>(value: T) => T | undefined;

export const PLAY: Play = (value) => value;

export const STILL: Play = () => undefined;

/** Outline paths to a tenth of a px, which is plenty for lettering and saves a digit per number. */
export const coarse = (d: string) => d.replace(/\d+\.\d+/g, (v) => `${n(+v)}`);

const symbols = new Map<string, Ref<"symbol">>();

/** One symbol per path, so the animated and still copies of the map share their geometry. */
export const pathSymbol = (d: string): Ref<"symbol"> => {
  let symbol = symbols.get(d);

  if (!symbol) symbols.set(d, (symbol = def.symbol({ style: "overflow:visible" }, <path d={d} />)));

  return symbol;
};

/** A line of outlined text from a shared symbol, readable by assistive tech. */
export function Words({
  face,
  text,
  size,
  x,
  y,
  fill = C.ink,
  anchor = "start",
}: {
  face: Font;
  text: string;
  size: number;
  x: number;
  y: number;
  fill?: Paint;
  anchor?: "start" | "middle" | "end";
}): SvgNode {
  const shift = { start: 0, middle: 0.5, end: 1 }[anchor] * face.measure(text, size);

  return (
    <use
      href={pathSymbol(coarse(face.path(text, { size, x: x - shift, y }).d))}
      fill={fill}
      role="img"
      aria-label={text}
    />
  );
}
