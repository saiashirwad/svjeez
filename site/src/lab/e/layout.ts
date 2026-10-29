// Where everything on a specimen sits. Pure math, no svjeez: the page lays the overlay's handles out from the same numbers
// the worker draws the file from.
import { clamp } from "../util";
import { CENTERLINES, resample } from "./centerline";
import { form, type Form } from "./form";
import type { Genome } from "./genome";
import { add, mulberry, sub, unit, W, type Pt } from "./geometry";
import { QUIRK } from "./quirk";

/** One cat of body, in px before fitting. */
export const CAT = 120;
const FIT = { x0: 18, x1: W - 18, y0: 14, y1: 352 };

export interface Frame {
  readonly p: Pt;
  readonly t: Pt;
  /** The belly side. */
  readonly n: Pt;
}

export interface Head {
  readonly at: Pt;
  readonly r: number;
  /** 1 faces right, -1 faces left. */
  readonly face: number;
  /** Where a neck meets the body, for heads that sprout from the back. */
  readonly neck?: Pt;
}

export interface Limb {
  readonly at: Pt;
  /** Rotation in degrees that turns local +y (legs) or -y (tails) toward where the limb points. */
  readonly angle: number;
  readonly s: number;
  readonly length: number;
  readonly width: number;
}

export interface Layout {
  readonly G: number;
  readonly L: number;
  readonly spine: readonly Pt[];
  readonly frames: readonly Frame[];
  readonly heads: readonly Head[];
  readonly legs: readonly Limb[];
  readonly tails: readonly Limb[];
  readonly bodyEyes: readonly (Pt & { readonly r: number })[];
  readonly center: Pt;
  readonly orbit?: { readonly rx: number; readonly ry: number };
  /** Catoid space to the 640×400 frame. */
  readonly scale: number;
  readonly ox: number;
  readonly oy: number;
  readonly floor: number;
  readonly melt: (p: Pt) => Pt;
}

const WORDS = ["mrrp", "mrow", "mlem", "prrt", "nyeh", "meep", "mau", "brrp", "mreow", "hhhh"];

/** What head i says. Long bodies drag the r out. */
export const wordFor = (g: Genome, i: number) => {
  const w = WORDS[(g.seed + i * 3) % WORDS.length]!;

  return g.length > 4 && w.includes("r")
    ? w.replace("r", "r".repeat(Math.min(9, Math.round(g.length))))
    : w;
};

export const speechSize = (r: number) => Math.min(24, Math.max(12, r * 0.62));

const legAngle = (d: Pt) => (Math.atan2(-d.x, d.y) * 180) / Math.PI;
const tailAngle = (d: Pt) => (Math.atan2(d.x, -d.y) * 180) / Math.PI;

/** Each spine point with its tangent and belly normal. Closed plans point the normal inward. */
const bodyFrames = (g: Genome, spine: readonly Pt[], center: Pt): Frame[] => {
  const frames: Frame[] = spine.map((p, i) => {
    const t = unit(sub(spine[Math.min(i + 1, spine.length - 1)]!, spine[Math.max(i - 1, 0)]!));

    return { p, t, n: { x: -t.y, y: t.x } };
  });

  if (g.plan === "line") return frames;

  const out = frames.reduce(
    (s, f) => s + f.n.x * (f.p.x - center.x) + f.n.y * (f.p.y - center.y),
    0,
  );

  return out < 0 ? frames.map((f) => ({ ...f, n: { x: -f.n.x, y: -f.n.y } })) : frames;
};

interface Body {
  readonly g: Genome;
  readonly f: Form;
  readonly G: number;
  readonly center: Pt;
  readonly at: (s: number) => Frame;
}

const placeHeads = ({ g, f, G, center, at }: Body, hr: number): Head[] => {
  const heads: Head[] = [];
  const front = at(1);
  const rear = at(0);
  const faceOf = (t: Pt) => (t.x >= -0.05 ? 1 : -1);

  for (let i = 0; i < g.heads; i++) {
    if (g.arrangement === "stack") {
      const k = 0.86 ** i;
      const base = add(front.p, front.t, hr * 0.5);

      const lift = Array.from(
        { length: i },
        (_, j) => hr * 0.86 ** j * (1.55 + f.hat * 0.85),
      ).reduce((a, b) => a + b, 0);

      heads.push({ at: { x: base.x, y: base.y - lift }, r: hr * k, face: faceOf(front.t) });
    } else if (g.arrangement === "orbit") {
      heads.push({ at: center, r: hr * 0.9, face: i % 2 ? -1 : 1 });
    } else if (i === 0) {
      heads.push({ at: add(front.p, front.t, hr * 0.5), r: hr, face: faceOf(front.t) });
    } else if (i === 1) {
      const t = { x: -rear.t.x, y: -rear.t.y };
      heads.push({ at: add(rear.p, t, hr * 0.5), r: hr, face: faceOf(t) });
    } else {
      const s = clamp(0.5 + (i - 3) * 0.16 + (i % 2 ? 0.08 : -0.08), 0.2, 0.8);
      const fr = at(s);
      const back = { x: -fr.n.x, y: -fr.n.y };
      heads.push({
        at: add(fr.p, back, G * 0.5 + hr * 1.1),
        r: hr * 0.8,
        face: faceOf(fr.t) * (i % 2 ? -1 : 1),
        neck: fr.p,
      });
    }
  }

  return heads;
};

const legLengthOf = (g: Genome, f: Form, G: number) =>
  (G * 0.4 + 24) * g.legLength * f.legGrowth * f.legShrink;

const placeLegs = ({ g, f, G, at }: Body): Limb[] => {
  const length = legLengthOf(g, f, G);
  const width = clamp(G * 0.3, 6, 16);

  return Array.from({ length: g.legs }, (_, i) => {
    const s = g.legs === 1 ? 0.5 : 0.12 + (0.76 * i) / (g.legs - 1);
    const fr = at(s);
    const side = g.legSide === "belly" ? 1 : g.legSide === "back" ? -1 : i % 2 ? -1 : 1;
    const d = { x: fr.n.x * side, y: fr.n.y * side };

    return { at: add(fr.p, d, G * 0.25), angle: legAngle(d), s, length, width };
  });
};

const placeTails = ({ g, f, G, at }: Body): Limb[] => {
  const length = CAT * 0.55 * g.tailLength * f.tailGrowth;
  const width = clamp(G * 0.26, 5, 14);
  const rear = at(0);
  const front = at(1);

  return Array.from({ length: g.tails }, (_, i) => {
    const spread = i - (g.tails - 1) / 2;

    if (g.tailAt <= 0.04 || g.tailAt >= 0.96) {
      const fr = g.tailAt <= 0.04 ? rear : front;
      const out = g.tailAt <= 0.04 ? { x: -fr.t.x, y: -fr.t.y } : fr.t;
      const up = unit(add(out, { x: 0, y: -1 }, 0.9));
      const a = Math.atan2(up.y, up.x) + spread * 0.45;
      const d = { x: Math.cos(a), y: Math.sin(a) };

      return {
        at: add(fr.p, out, G * 0.3),
        angle: tailAngle(d),
        s: g.tailAt <= 0.04 ? 0 : 1,
        length,
        width,
      };
    }

    const s = clamp(g.tailAt + spread * 0.08, 0.05, 0.95);
    const fr = at(s);
    const side = g.legSide === "back" ? 1 : -1;
    const d = unit(add({ x: fr.n.x * side, y: fr.n.y * side }, fr.t, spread * 0.3));

    return { at: add(fr.p, d, G * 0.3), angle: tailAngle(d), s, length, width };
  });
};

const placeBodyEyes = ({ g, G, at }: Body): (Pt & { r: number })[] => {
  const rand = mulberry(g.seed * 7 + 3);

  return Array.from({ length: g.bodyEyes }, (_, i) => {
    const fr = at(clamp((i + 0.5 + (rand() - 0.5) * 0.6) / g.bodyEyes, 0.08, 0.92));

    return {
      ...add(fr.p, fr.n, (rand() - 0.5) * G * 0.3),
      r: clamp(G * (0.13 + rand() * 0.08), 4, 11),
    };
  });
};

type Mark = Pt & { r: number };

/** The parts that decide how big the specimen is, and where it sits on the floor. */
interface Parts extends Body {
  readonly spine: readonly Pt[];
  readonly heads: readonly Head[];
  readonly legs: readonly Limb[];
  readonly tails: readonly Limb[];
  readonly hr: number;
}

/** Circles around everything that can be drawn, so the fit leaves nothing outside the frame. */
const fitFrame = (p: Parts) => {
  const { g, f, G, spine, heads, legs, tails, center, at, hr } = p;
  const marks: Mark[] = [];

  for (const q of spine) marks.push({ ...q, r: G / 2 + 4 });

  for (const l of legs) {
    const a = ((l.angle + 90) * Math.PI) / 180;
    marks.push({
      x: l.at.x + Math.cos(a) * l.length,
      y: l.at.y + Math.sin(a) * l.length,
      r: l.width + l.length * 0.3,
    });
  }

  for (const t of tails) {
    const tipSize =
      g.tip === "kitten"
        ? Math.max(9, G * 0.32) * 2 + 24
        : g.tip === "fork"
          ? t.length * 0.35
          : t.width * 1.4;

    const a = (t.angle * Math.PI) / 180;
    const [lx, ly] = [t.length * 0.24, -t.length];

    const tip = {
      x: t.at.x + lx * Math.cos(a) - ly * Math.sin(a),
      y: t.at.y + lx * Math.sin(a) + ly * Math.cos(a),
    };

    marks.push({ ...tip, r: tipSize + t.length * 0.26 });
    marks.push({ ...add(t.at, sub(tip, t.at), 0.55), r: t.width + t.length * 0.16 });
  }

  const speech = (where: Pt, r: number, face: number, text: string) => {
    const size = speechSize(r);
    const x = where.x + face * r * 0.55;
    const y = where.y - r * (1.45 + f.hat * 0.9);
    marks.push(
      { x: x - 10, y, r: size * 0.6 },
      { x: x + 6 + size * 0.62 * text.length, y: y - size * 0.35, r: size * 0.5 },
    );
  };

  let orbit: Layout["orbit"];

  if (g.arrangement === "orbit" && heads.length) {
    const xs = marks.map((m) => m.x);
    const ys = marks.map((m) => m.y);
    orbit = {
      rx: (Math.max(...xs) - Math.min(...xs)) / 2 + hr * 0.9,
      ry: (Math.max(...ys) - Math.min(...ys)) / 2 + hr * 0.9,
    };

    for (const a of [0, 0.5, 1, 1.5])
      marks.push({
        x: center.x + orbit.rx * Math.cos(a * Math.PI),
        y: center.y + orbit.ry * Math.sin(a * Math.PI),
        r: hr * 1.5,
      });

    for (const a of [0, 0.5, 1, 1.5])
      speech(
        {
          x: center.x + orbit.rx * Math.cos(a * Math.PI),
          y: center.y + orbit.ry * Math.sin(a * Math.PI),
        },
        hr * 0.9,
        1,
        wordFor(g, 0),
      );
  } else
    heads.forEach((h, i) => {
      marks.push({ ...h.at, r: h.r * 1.6 });
      marks.push({ x: h.at.x, y: h.at.y - h.r * (1.7 + f.hat), r: h.r * (0.5 + f.hat * 0.3) });
      speech(h.at, h.r, h.face, wordFor(g, i));
    });

  const ys = spine.map((q) => q.y);
  const floor = Math.max(...ys) + G * 0.5 + 6;
  const top = Math.min(...ys);
  // A melted catoid slumps to where its paws were and spreads out.
  const paws = Math.max(0, ...legs.map((l) => l.length * Math.cos((l.angle * Math.PI) / 180)));
  const puddle = floor + paws * 0.85;

  const melt = (q: Pt): Pt => {
    if (!f.liquid) return q;
    const drop = clamp((puddle - G * 0.3 - q.y) * 0.85, 0, 999);
    const spread = 1 + 0.5 * clamp((puddle - q.y) / (puddle - top + G), 0, 1);

    return { x: center.x + (q.x - center.x) * spread, y: q.y + drop };
  };

  if (!heads.length) {
    const mid = at(0.5).p;
    speech({ x: mid.x, y: mid.y - G * 0.9 }, G * 0.73, 1, `(${wordFor(g, 0)})`);
  }

  if (f.liquid) {
    const sink = sub(melt(center), center);

    marks.push(
      ...marks.flatMap((m) => [
        { ...melt(m), r: m.r },
        ...(orbit ? [{ ...add(m, sink), r: m.r }] : []),
      ]),
    );
  }

  let x0 = Math.min(...marks.map((m) => m.x - m.r));
  let x1 = Math.max(...marks.map((m) => m.x + m.r));
  let y0 = Math.min(...marks.map((m) => m.y - m.r));
  let y1 = Math.max(...marks.map((m) => m.y + m.r));
  const quirk = QUIRK[g.quirk].fit(g);

  if (quirk.sweep) {
    const c = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
    const R = Math.max(...marks.map((m) => Math.hypot(m.x - c.x, m.y - c.y) + m.r));
    [x0, x1, y0, y1] = [c.x - R, c.x + R, c.y - R, c.y + R];
  }

  const room = { x: FIT.x1 - FIT.x0 - quirk.trimX, y: FIT.y1 - FIT.y0 - quirk.trimY };
  const scale = Math.min(1.5, room.x / (x1 - x0), room.y / (y1 - y0));
  const ox = (FIT.x0 + FIT.x1) / 2 - ((x0 + x1) / 2) * scale;
  const oy = (FIT.y0 + FIT.y1) / 2 + quirk.dropY - ((y0 + y1) / 2) * scale;

  return { orbit, scale, ox, oy, floor, melt };
};

export const layout = (g: Genome): Layout => {
  const f = form(g);
  const G = g.girth;
  const L = g.length * CAT;
  const legReach = g.legs ? legLengthOf(g, f, G) + G * 0.3 : 0;

  const spine = resample(CENTERLINES[g.plan](L, G, legReach), clamp(Math.round(L / 7), 30, 240));

  const center = spine.reduce(
    (c, p) => ({ x: c.x + p.x / spine.length, y: c.y + p.y / spine.length }),
    { x: 0, y: 0 },
  );

  const frames = bodyFrames(g, spine, center);

  const at = (s: number): Frame =>
    frames[clamp(Math.round(s * (frames.length - 1)), 0, frames.length - 1)]!;

  const body: Body = { g, f, G, center, at };
  const hr = clamp(G * 0.85, 16, 46);
  const heads = placeHeads(body, hr);
  const legs = placeLegs(body);
  const tails = placeTails(body);
  const bodyEyes = placeBodyEyes(body);
  const fit = fitFrame({ ...body, spine, heads, legs, tails, hr });

  return { G, L, spine, frames, heads, legs, tails, bodyEyes, center, ...fit };
};
