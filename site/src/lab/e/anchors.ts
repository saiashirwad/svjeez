import { sample } from "svjeez";
import type { Part } from "./edit";
import { form } from "./form";
import type { Genome } from "./genome";
import { add, DURATION, type Pt } from "./geometry";
import { tailTip, type Layout } from "./layout";
import { meltBy, meltMotion, meltScale, wag, walk } from "./motions";

/** A part the stage can grab, where the file draws it at one moment, in layout px. */
export interface Anchor {
  readonly key: string;
  readonly part: Part;
  readonly at: Pt;
  readonly r: number;
  /** An eye on the body, not on a head. */
  readonly eyeOnBody: boolean;
}

/** The file's timeline, as `sample` reads it. */
const FILE = { duration: DURATION };

/** `local` turned `angle` degrees about `from`, then moved there. */
const turned = (from: Pt, angle: number, local: Pt): Pt => {
  const [cos, sin] = [Math.cos((angle * Math.PI) / 180), Math.sin((angle * Math.PI) / 180)];

  return { x: from.x + local.x * cos - local.y * sin, y: from.y + local.x * sin + local.y * cos };
};

/**
 * The motions the file gives each grabbable part, built once, read at any moment of the loop: legs walk, tails wag,
 * and a liquid specimen melts. The quirk that moves the whole creature is left out.
 */
export const anchorsOf = (g: Genome, lay: Layout) => {
  const liquid = form(g).liquid;
  const melted = (p: Pt) => (liquid ? meltMotion(meltBy(lay, p)) : undefined);

  const moved = (p: Pt, melt: ReturnType<typeof melted>, t: number): Pt =>
    melt ? add(p, sample(melt, t, FILE)) : p;

  const legs = lay.legs.map((l, i) => ({
    l,
    melt: melted(l.at),
    swing: [walk(g, i), liquid && meltScale(0.25)],
  }));

  const tails = lay.tails.map((l, i) => ({ l, melt: melted(l.at), wag: wag(g, i) }));
  const heads = lay.orbit ? [] : lay.heads.map((h) => ({ h, melt: melted(h.at) }));
  const eyes = lay.bodyEyes.map((e) => ({ e, melt: melted(e) }));

  return (t: number): Anchor[] => [
    ...heads.map(({ h, melt }, i) => ({
      key: `heads-${i}`,
      part: "heads" as const,
      at: moved(h.at, melt, t),
      r: h.r,
      eyeOnBody: false,
    })),
    ...legs.map(({ l, melt, swing }, i) => {
      const { rotate = 0, scale = 1 } = sample(swing, t, FILE);

      return {
        key: `legs-${i}`,
        part: "legs" as const,
        at: turned(moved(l.at, melt, t), l.angle + rotate, { x: 0, y: l.length * scale }),
        r: l.width,
        eyeOnBody: false,
      };
    }),
    ...tails.map(({ l, melt, wag }, i) => ({
      key: `tails-${i}`,
      part: "tails" as const,
      at: turned(moved(l.at, melt, t), l.angle + sample(wag, t, FILE).rotate, tailTip(l.length)),
      r: l.width * 1.4,
      eyeOnBody: false,
    })),
    ...eyes.map(({ e, melt }, i) => ({
      key: `eyes-${i}`,
      part: "eyes" as const,
      at: moved(e, melt, t),
      r: e.r,
      eyeOnBody: true,
    })),
  ];
};
