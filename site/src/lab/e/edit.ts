import { withGene } from "./genome";
import type { Pt } from "./geometry";
import { set, state } from "./state";

export const PARTS = ["heads", "ears", "eyes", "legs", "tails"] as const;
export type Part = (typeof PARTS)[number];

/** The part a control names. Throws on a name the page markup should never hold. */
export const partNamed = (name: string | undefined): Part => {
  const part = PARTS.find((p) => p === name);
  if (!part) throw new Error(`No part named ${name}`);
  return part;
};

/** Catoid space to the 640×400 frame, and back. */
export const toScreen = (p: Pt) => ({ x: state.lay.ox + p.x * state.lay.scale, y: state.lay.oy + p.y * state.lay.scale });
const toCatoid = (p: Pt) => ({ x: (p.x - state.lay.ox) / state.lay.scale, y: (p.y - state.lay.oy) / state.lay.scale });

/** Where on the specimen a point lands: the nearest stretch of body, which side of it, and any head under it. */
export const hitTest = (vp: Pt) => {
  const { lay } = state;
  const p = toCatoid(vp);
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
  const head = lay.orbit ? -1 : lay.heads.findIndex((h) => Math.hypot(h.at.x - p.x, h.at.y - p.y) < h.r * 1.4);
  return { s, belly, head, near: bestD < lay.G * 1.2 + 30 };
};

/** A tail dropped near either end of the body sits at that end. */
const tailAt = (s: number) => (s < 0.06 ? 0 : s > 0.94 ? 1 : s);

export const addPart = (part: Part, vp?: Pt) => {
  const hit = vp ? hitTest(vp) : undefined;
  const from = state.genome;
  let g = from;
  if (part === "heads") g = withGene(g, "heads", g.heads + 1);
  if (part === "ears") g = withGene(g, "ears", g.ears + 1);
  if (part === "eyes") g = hit && hit.head < 0 && hit.near ? withGene(g, "bodyEyes", g.bodyEyes + 1) : withGene(g, "eyes", g.eyes + 1);
  if (part === "legs") {
    const side = hit ? (hit.belly ? "belly" : "back") : g.legSide;
    g = withGene(g, "legs", g.legs + 1);
    g = withGene(g, "legSide", from.legs === 0 || from.legSide === side ? side : "both");
  }
  if (part === "tails") {
    g = withGene(g, "tails", g.tails + 1);
    if (hit) g = withGene(g, "tailAt", tailAt(hit.s));
  }
  set(g);
};

export const removePart = (part: Part, eyeOnBody = false) => {
  const { genome } = state;
  if (part === "eyes" && eyeOnBody) set(withGene(genome, "bodyEyes", genome.bodyEyes - 1));
  else set(withGene(genome, part, genome[part] - 1));
};

/** A tail or leg handle dropped on the body moves to where it landed. Heads and eyes stay put. */
export const moveOnBody = (part: Part, vp: Pt) => {
  const hit = hitTest(vp);
  if (part === "tails") set(withGene(state.genome, "tailAt", tailAt(hit.s)));
  if (part === "legs") set(withGene(state.genome, "legSide", hit.belly ? "belly" : "back"));
};
