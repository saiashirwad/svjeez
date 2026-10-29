import type { Hex } from "svjeez";
import { form, type Form } from "./form";
import type { Genome } from "./genome";
import { mulberry, type Pt } from "./geometry";
import { layout, type Layout } from "./layout";
import { BREAD, INK, PALETTES, type Palette } from "./palette";

/** Everything a drawing part reads: the genome, how it is laid out, its colors, and the one seeded random stream. */
export interface Cx {
  readonly g: Genome;
  readonly f: Form;
  readonly lay: Layout;
  readonly pal: Palette;
  readonly ink: Hex;
  /** Parts draw in a fixed order and take their random numbers from here, so the same genome draws the same file. */
  readonly rand: () => number;
}

export const newCx = (g: Genome): Cx => {
  const f = form(g);

  return {
    g,
    f,
    lay: layout(g),
    rand: mulberry(g.seed),
    pal: f.bread ? BREAD : PALETTES[g.fur],
    ink: !f.bread && (g.fur === "void" || g.fur === "cosmic") ? "#8C7DAA" : INK,
  };
};

export const r1 = (v: number) => Math.round(v * 10) / 10;

export const polyline = (pts: readonly Pt[]) =>
  pts.map((p, i) => `${i ? "L" : "M"}${r1(p.x)} ${r1(p.y)}`).join("");
