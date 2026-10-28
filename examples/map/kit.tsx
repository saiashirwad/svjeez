import { google } from "@svjeez/fonts";
import { def, type Font, type Paint, type Ref, type SvgNode } from "svjeez";

export const W = 960;
export const H = 640;
export const D = 22;

export const C = {
  paper: "#EBDDBB",
  land: "#F1E5C6",
  sea: "#DCCDA6",
  ink: "#3B2A1A",
  faded: "#7A6142",
  river: "#3F5E6E",
  red: "#9E2B1E",
  ember: "#E0662A",
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
