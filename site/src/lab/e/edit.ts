import { withGene, type Genome } from "./genome";
import type { Pt } from "./geometry";
import type { Layout } from "./layout";

export const PARTS = ["heads", "ears", "eyes", "legs", "tails"] as const;

export type Part = (typeof PARTS)[number];

/** Catoid space to the 640×400 frame, and back. */
export const toScreen = (lay: Layout, p: Pt): Pt => ({
  x: lay.ox + p.x * lay.scale,
  y: lay.oy + p.y * lay.scale,
});

const toCatoid = (lay: Layout, p: Pt): Pt => ({
  x: (p.x - lay.ox) / lay.scale,
  y: (p.y - lay.oy) / lay.scale,
});

/** Where on the specimen a point lands: the nearest stretch of body, which side of it, and any head under it. */
export const hitTest = (lay: Layout, vp: Pt) => {
  const p = toCatoid(lay, vp);
  let best = 0;
  let bestD = Infinity;
  lay.frames.forEach((f, i) => {
    const d = Math.hypot(f.p.x - p.x, f.p.y - p.y);

    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  const f = lay.frames[best]!;
  const s = best / (lay.frames.length - 1);
  const belly = (p.x - f.p.x) * f.n.x + (p.y - f.p.y) * f.n.y > 0;

  const head = lay.orbit
    ? -1
    : lay.heads.findIndex((h) => Math.hypot(h.at.x - p.x, h.at.y - p.y) < h.r * 1.4);

  return { s, belly, head, near: bestD < lay.G * 1.2 + 30 };
};

/** A tail dropped near either end of the body sits at that end. */
const tailAt = (s: number) => (s < 0.06 ? 0 : s > 0.94 ? 1 : s);

/** One more of a part, dropped at `vp` on the stage or, without a point, wherever it goes by default. */
export const addPart = (from: Genome, lay: Layout, part: Part, vp?: Pt): Genome => {
  const hit = vp ? hitTest(lay, vp) : undefined;
  let g = from;

  if (part === "heads") g = withGene(g, "heads", g.heads + 1);

  if (part === "ears") g = withGene(g, "ears", g.ears + 1);

  if (part === "eyes")
    g =
      hit && hit.head < 0 && hit.near
        ? withGene(g, "bodyEyes", g.bodyEyes + 1)
        : withGene(g, "eyes", g.eyes + 1);

  if (part === "legs") {
    const side = hit ? (hit.belly ? "belly" : "back") : g.legSide;
    g = withGene(g, "legs", g.legs + 1);
    g = withGene(g, "legSide", from.legs === 0 || from.legSide === side ? side : "both");
  }

  if (part === "tails") {
    g = withGene(g, "tails", g.tails + 1);

    if (hit) g = withGene(g, "tailAt", tailAt(hit.s));
  }

  return g;
};

export const removePart = (g: Genome, part: Part, eyeOnBody = false): Genome =>
  part === "eyes" && eyeOnBody
    ? withGene(g, "bodyEyes", g.bodyEyes - 1)
    : withGene(g, part, g[part] - 1);

/** A tail or leg handle dropped on the body moves to where it landed. Heads and eyes stay put. */
export const moveOnBody = (g: Genome, lay: Layout, part: Part, vp: Pt): Genome => {
  const hit = hitTest(lay, vp);

  if (part === "tails") return withGene(g, "tailAt", tailAt(hit.s));

  if (part === "legs") return withGene(g, "legSide", hit.belly ? "belly" : "back");

  return g;
};
