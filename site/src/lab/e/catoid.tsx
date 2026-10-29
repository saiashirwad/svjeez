/** @jsxImportSource svjeez */
/** @jsxRuntime automatic */
import { css, def, ease, enter, exit, fx, motion, render, sampled, shake, wiggle, type Child, type Hex, type Stack } from "svjeez";
import type { Genome } from "./genome";

const genome: Genome = /*genome*/ {"seed":412,"length":3.4,"girth":40,"plan":"line","heads":2,"arrangement":"ends","ears":2,"eyes":2,"bodyEyes":0,"legs":6,"legSide":"belly","legLength":1,"tails":1,"tailLength":1,"tailAt":0.5,"tip":"tuft","dimension":"flat","slice":0.5,"oid":"cat","oidness":0,"fur":"ginger","pattern":"tabby","quirk":"spin","ink":1} /*end*/;

export const W = 640;
export const H = 400;
const DUR = 8;
/** One cat of body, in px before fitting. */
export const CAT = 120;
const INK: Hex = "#2A2320";
const PAPER = "#F4EFE2";
const PINK: Hex = "#E98C9A";
const FIT = { x0: 18, x1: W - 18, y0: 14, y1: 352 };

interface Pt {
  readonly x: number;
  readonly y: number;
}
interface Frame {
  readonly p: Pt;
  readonly t: Pt;
  /** The belly side. */
  readonly n: Pt;
}

const PALETTES = {
  ginger: { base: "#EE9B4F", dark: "#B9612C", light: "#FCE6CC", eye: "#D9E25A" },
  grey: { base: "#A6ABB3", dark: "#5D636C", light: "#E6E8EB", eye: "#9FD7A0" },
  cream: { base: "#F1DDB8", dark: "#C49A5F", light: "#FFF7E8", eye: "#7EC4E8" },
  calico: { base: "#F7F1E7", dark: "#2B2522", light: "#E58B3A", eye: "#E8C548" },
  void: { base: "#1F1B24", dark: "#3B3444", light: "#3B3444", eye: "#F6EB5E" },
  cosmic: { base: "#2E2368", dark: "#5B45BA", light: "#F6E27A", eye: "#FF8FD0" },
} as const;
const BREAD = { base: "#D9A15A", dark: "#A8692E", light: "#F6DDB0", eye: "#3B2A1E" } as const;

const WORDS = ["mrrp", "mrow", "mlem", "prrt", "nyeh", "meep", "mau", "brrp", "mreow", "hhhh"];

/** What head i says. Long bodies drag the r out. */
const wordFor = (g: Genome, i: number) => {
  const w = WORDS[(g.seed + i * 3) % WORDS.length]!;
  return g.length > 4 && w.includes("r") ? w.replace("r", "r".repeat(Math.min(9, Math.round(g.length)))) : w;
};
const speechSize = (r: number) => Math.min(24, Math.max(12, r * 0.62));

const mulberry = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const r1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Pt, b: Pt, k = 1): Pt => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const unit = (a: Pt): Pt => {
  const l = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / l, y: a.y / l };
};
const polyline = (pts: readonly Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${r1(p.x)} ${r1(p.y)}`).join("");

/** The body's centerline before resampling, dense enough that its length is its arc length. */
const centerline = (g: Genome, L: number, G: number, reach: number): Pt[] => {
  const pts: Pt[] = [];
  if (g.plan === "line") {
    const row = 470;
    if (L <= row) {
      const arch = Math.min(16, L * 0.08);
      for (let i = 0; i <= 200; i++) {
        const u = i / 200;
        pts.push({ x: -L / 2 + u * L, y: -arch * Math.sin(Math.PI * u) });
      }
      return pts;
    }
    // Too long for one row: the tube folds back on itself, row under row.
    const gap = Math.max(G * 1.9, G + reach * 1.6 + 16);
    let left = L;
    let y = 0;
    let dir = 1;
    while (left > 0) {
      const run = Math.min(row, left);
      const x0 = dir > 0 ? -row / 2 : row / 2;
      for (let i = 0; i <= 60; i++) pts.push({ x: x0 + dir * run * (i / 60), y });
      left -= run;
      if (left <= 0) break;
      const turn = Math.min((Math.PI * gap) / 2, left);
      const cx = dir > 0 ? row / 2 : -row / 2;
      for (let i = 1; i <= 40; i++) {
        const a = (turn / (gap / 2)) * (i / 40);
        pts.push({ x: cx + dir * (gap / 2) * Math.sin(a), y: y + gap / 2 - (gap / 2) * Math.cos(a) });
      }
      left -= turn;
      y += gap;
      dir = -dir;
    }
    return pts;
  }
  if (g.plan === "loop") {
    const sweep = (330 / 360) * Math.PI * 2;
    const R = Math.max(L / sweep, G * 0.9);
    const start = -Math.PI / 2 + (Math.PI * 2 - sweep) / 2;
    for (let i = 0; i <= 240; i++) {
      const a = start + sweep * (i / 240);
      pts.push({ x: R * Math.cos(a), y: R * Math.sin(a) });
    }
    return pts;
  }
  if (g.plan === "spiral") {
    const b = (G * 1.25 + 8) / (Math.PI * 2);
    const a0 = G * 0.8;
    let theta = 0;
    let len = 0;
    let prev = { x: a0, y: 0 };
    pts.push(prev);
    while (len < Math.max(L, G * 3)) {
      theta += 0.04;
      const r = a0 + b * theta;
      const p = { x: r * Math.cos(theta), y: r * Math.sin(theta) };
      len += Math.hypot(p.x - prev.x, p.y - prev.y);
      pts.push(p);
      prev = p;
    }
    return pts;
  }
  const raw: Pt[] = [];
  for (let i = 0; i <= 400; i++) {
    const t = 0.3 + (Math.PI * 2 - 0.6) * (i / 400);
    raw.push({ x: Math.sin(t) + 2 * Math.sin(2 * t), y: -(Math.cos(t) - 2 * Math.cos(2 * t)) });
  }
  let len = 0;
  for (let i = 1; i < raw.length; i++) len += Math.hypot(raw[i]!.x - raw[i - 1]!.x, raw[i]!.y - raw[i - 1]!.y);
  const k = Math.max(L, G * 9) / len;
  return raw.map((p) => ({ x: p.x * k, y: p.y * k }));
};

/** Resamples a polyline to `count` points evenly spaced along its length. */
const resample = (pts: readonly Pt[], count: number): Pt[] => {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  const total = acc.at(-1)!;
  const out: Pt[] = [];
  let j = 1;
  for (let i = 0; i < count; i++) {
    const d = (total * i) / (count - 1);
    while (j < pts.length - 1 && acc[j]! < d) j++;
    const a = pts[j - 1]!;
    const b = pts[j]!;
    const span = acc[j]! - acc[j - 1]! || 1;
    const u = clamp((d - acc[j - 1]!) / span, 0, 1);
    out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
  }
  return out;
};

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
}

export interface Layout {
  readonly G: number;
  readonly L: number;
  readonly spine: readonly Pt[];
  readonly frames: readonly Frame[];
  readonly heads: readonly Head[];
  readonly legs: readonly (Limb & { readonly length: number; readonly width: number })[];
  readonly tails: readonly (Limb & { readonly length: number; readonly width: number })[];
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

const legAngle = (d: Pt) => (Math.atan2(-d.x, d.y) * 180) / Math.PI;
const tailAngle = (d: Pt) => (Math.atan2(d.x, -d.y) * 180) / Math.PI;

export const layout = (g: Genome): Layout => {
  const rand = mulberry(g.seed * 7 + 3);
  const G = g.girth;
  const L = g.length * CAT;
  const horse = g.oid === "horse" ? g.oidness : 0;
  const loaf = g.oid === "loaf" ? g.oidness : 0;
  const legLength = (G * 0.4 + 24) * g.legLength * (1 + horse * 0.8) * (1 - loaf * 0.65);
  const legWidth = clamp(G * 0.3, 6, 16);
  const reach = g.legs ? legLength + G * 0.3 : 0;

  const dense = centerline(g, L, G, reach);
  const count = clamp(Math.round(L / 7), 30, 240);
  const spine = resample(dense, count);
  const center = spine.reduce((c, p) => ({ x: c.x + p.x / spine.length, y: c.y + p.y / spine.length }), { x: 0, y: 0 });

  let frames: Frame[] = spine.map((p, i) => {
    const t = unit(sub(spine[Math.min(i + 1, spine.length - 1)]!, spine[Math.max(i - 1, 0)]!));
    return { p, t, n: { x: -t.y, y: t.x } };
  });
  if (g.plan !== "line") {
    const out = frames.reduce((s, f) => s + f.n.x * (f.p.x - center.x) + f.n.y * (f.p.y - center.y), 0);
    if (out < 0) frames = frames.map((f) => ({ ...f, n: { x: -f.n.x, y: -f.n.y } }));
  }
  const at = (s: number): Frame => frames[clamp(Math.round(s * (frames.length - 1)), 0, frames.length - 1)]!;

  const hr = clamp(G * 0.85, 16, 46);
  const hat = g.oid === "hat" ? 0.9 + 1.6 * g.oidness : 0;
  const heads: Head[] = [];
  const front = at(1);
  const rear = at(0);
  const faceOf = (t: Pt) => (t.x >= -0.05 ? 1 : -1);
  for (let i = 0; i < g.heads; i++) {
    if (g.arrangement === "stack") {
      const k = 0.86 ** i;
      const base = add(front.p, front.t, hr * 0.5);
      const lift = Array.from({ length: i }, (_, j) => hr * 0.86 ** j * (1.55 + hat * 0.85)).reduce((a, b) => a + b, 0);
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
      const f = at(s);
      const back = { x: -f.n.x, y: -f.n.y };
      heads.push({ at: add(f.p, back, G * 0.5 + hr * 1.1), r: hr * 0.8, face: faceOf(f.t) * (i % 2 ? -1 : 1), neck: f.p });
    }
  }

  const legs = Array.from({ length: g.legs }, (_, i) => {
    const s = g.legs === 1 ? 0.5 : 0.12 + (0.76 * i) / (g.legs - 1);
    const f = at(s);
    const side = g.legSide === "belly" ? 1 : g.legSide === "back" ? -1 : i % 2 ? -1 : 1;
    const d = { x: f.n.x * side, y: f.n.y * side };
    return { at: add(f.p, d, G * 0.25), angle: legAngle(d), s, length: legLength, width: legWidth };
  });

  const tailLength = CAT * 0.55 * g.tailLength * (1 + horse * 0.3);
  const tailWidth = clamp(G * 0.26, 5, 14);
  const tails = Array.from({ length: g.tails }, (_, i) => {
    const spread = i - (g.tails - 1) / 2;
    if (g.tailAt <= 0.04 || g.tailAt >= 0.96) {
      const f = g.tailAt <= 0.04 ? rear : front;
      const out = g.tailAt <= 0.04 ? { x: -f.t.x, y: -f.t.y } : f.t;
      const up = unit(add(out, { x: 0, y: -1 }, 0.9));
      const a = Math.atan2(up.y, up.x) + spread * 0.45;
      const d = { x: Math.cos(a), y: Math.sin(a) };
      return { at: add(f.p, out, G * 0.3), angle: tailAngle(d), s: g.tailAt <= 0.04 ? 0 : 1, length: tailLength, width: tailWidth };
    }
    const s = clamp(g.tailAt + spread * 0.08, 0.05, 0.95);
    const f = at(s);
    const side = g.legSide === "back" ? 1 : -1;
    const d = unit(add({ x: f.n.x * side, y: f.n.y * side }, f.t, spread * 0.3));
    return { at: add(f.p, d, G * 0.3), angle: tailAngle(d), s, length: tailLength, width: tailWidth };
  });

  const bodyEyes = Array.from({ length: g.bodyEyes }, (_, i) => {
    const f = at(clamp((i + 0.5 + (rand() - 0.5) * 0.6) / g.bodyEyes, 0.08, 0.92));
    return { ...add(f.p, f.n, (rand() - 0.5) * G * 0.3), r: clamp(G * (0.13 + rand() * 0.08), 4, 11) };
  });

  // Everything that can be drawn, as circles, so the fit leaves nothing outside the frame.
  const marks: (Pt & { r: number })[] = [];
  for (const p of spine) marks.push({ ...p, r: G / 2 + 4 });
  for (const l of legs) {
    const a = ((l.angle + 90) * Math.PI) / 180;
    marks.push({ x: l.at.x + Math.cos(a) * l.length, y: l.at.y + Math.sin(a) * l.length, r: l.width + l.length * 0.3 });
  }
  const tipSize = g.tip === "kitten" ? Math.max(9, G * 0.32) * 2 + 24 : g.tip === "fork" ? tailLength * 0.35 : tailWidth * 1.4;
  for (const t of tails) {
    const a = (t.angle * Math.PI) / 180;
    const [lx, ly] = [t.length * 0.24, -t.length];
    const tip = { x: t.at.x + lx * Math.cos(a) - ly * Math.sin(a), y: t.at.y + lx * Math.sin(a) + ly * Math.cos(a) };
    marks.push({ ...tip, r: tipSize + t.length * 0.26 });
    marks.push({ ...add(t.at, sub(tip, t.at), 0.55), r: t.width + t.length * 0.16 });
  }
  const speech = (at: Pt, r: number, face: number, text: string) => {
    const size = speechSize(r);
    const x = at.x + face * r * 0.55;
    const y = at.y - r * (1.45 + hat * 0.9);
    marks.push({ x: x - 10, y, r: size * 0.6 }, { x: x + 6 + size * 0.62 * text.length, y: y - size * 0.35, r: size * 0.5 });
  };
  let orbit: Layout["orbit"];
  if (g.arrangement === "orbit" && heads.length) {
    const xs = marks.map((m) => m.x);
    const ys = marks.map((m) => m.y);
    orbit = { rx: (Math.max(...xs) - Math.min(...xs)) / 2 + hr * 0.9, ry: (Math.max(...ys) - Math.min(...ys)) / 2 + hr * 0.9 };
    for (const a of [0, 0.5, 1, 1.5]) marks.push({ x: center.x + orbit.rx * Math.cos(a * Math.PI), y: center.y + orbit.ry * Math.sin(a * Math.PI), r: hr * 1.5 });
    for (const a of [0, 0.5, 1, 1.5])
      speech({ x: center.x + orbit.rx * Math.cos(a * Math.PI), y: center.y + orbit.ry * Math.sin(a * Math.PI) }, hr * 0.9, 1, wordFor(g, 0));
  } else
    heads.forEach((h, i) => {
      marks.push({ ...h.at, r: h.r * 1.6 });
      marks.push({ x: h.at.x, y: h.at.y - h.r * (1.7 + hat), r: h.r * (0.5 + hat * 0.3) });
      speech(h.at, h.r, h.face, wordFor(g, i));
    });

  const ys = spine.map((p) => p.y);
  const floor = Math.max(...ys) + G * 0.5 + 6;
  const top = Math.min(...ys);
  // A melted catoid slumps to where its paws were and spreads out.
  const paws = Math.max(0, ...legs.map((l) => l.length * Math.cos((l.angle * Math.PI) / 180)));
  const puddle = floor + paws * 0.85;
  const melt = (p: Pt): Pt => {
    if (g.dimension !== "liquid") return p;
    const drop = clamp((puddle - G * 0.3 - p.y) * 0.85, 0, 999);
    const spread = 1 + 0.5 * clamp((puddle - p.y) / (puddle - top + G), 0, 1);
    return { x: center.x + (p.x - center.x) * spread, y: p.y + drop };
  };
  if (!heads.length) {
    const mid = at(0.5).p;
    speech({ x: mid.x, y: mid.y - G * 0.9 }, G * 0.73, 1, `(${wordFor(g, 0)})`);
  }
  if (g.dimension === "liquid") {
    const sink = sub(melt(center), center);
    for (const m of [...marks]) marks.push({ ...melt(m), r: m.r }, ...(orbit ? [{ ...add(m, sink), r: m.r }] : []));
  }

  let x0 = Math.min(...marks.map((m) => m.x - m.r));
  let x1 = Math.max(...marks.map((m) => m.x + m.r));
  let y0 = Math.min(...marks.map((m) => m.y - m.r));
  let y1 = Math.max(...marks.map((m) => m.y + m.r));
  // A specimen that turns all the way round needs the circle its box sweeps.
  if (g.quirk === "float" || (g.quirk === "spin" && g.heads === 0)) {
    const c = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
    const R = Math.max(...marks.map((m) => Math.hypot(m.x - c.x, m.y - c.y) + m.r));
    [x0, x1, y0, y1] = [c.x - R, c.x + R, c.y - R, c.y + R];
  }
  const room = { x: FIT.x1 - FIT.x0 - (g.quirk === "split" ? 84 : 0), y: FIT.y1 - FIT.y0 - (g.quirk === "float" ? 30 : 0) };
  const scale = Math.min(1.5, room.x / (x1 - x0), room.y / (y1 - y0));
  const ox = (FIT.x0 + FIT.x1) / 2 - ((x0 + x1) / 2) * scale;
  const oy = (FIT.y0 + FIT.y1) / 2 + (g.quirk === "float" ? 15 : 0) - ((y0 + y1) / 2) * scale;

  return { G, L, spine, frames, heads, legs, tails, bodyEyes, center, orbit, scale, ox, oy, floor, melt };
};

// ---------- drawing ----------

const MELT = { at: 0.6, over: 2.4, back: 5.2, rebound: 1.4 };
const meltMotion = (d: Pt) =>
  motion({ x: 0, y: 0 })
    .at(MELT.at)
    .to({ x: r1(d.x), y: r1(d.y) }, MELT.over, ease.inOut)
    .at(MELT.back)
    .to({ x: 0, y: 0 }, MELT.rebound, ease.pop);

/** Visibility of a part at w in the fourth dimension as the slice sweeps through it. */
const sliceAt = (g: Genome, w: number, t: number) => {
  const plane = (g.slice * 2 - 1) * 0.7 + 0.75 * Math.sin((Math.PI * 2 * t) / DUR);
  return Math.sqrt(clamp(1 - ((w - plane) / 0.85) ** 2, 0, 1));
};
const sliced = (g: Genome, w: number) =>
  sampled((t) => ({ scale: Math.round(sliceAt(g, w, t) * 50) / 50 }), { duration: DUR, step: 0.1, tolerance: { scale: 0.03 } });

/** A group whose rotate and scale pivot on 0,0: an invisible square makes its box symmetric. */
const Pivot = ({ size, children, animation }: { size: number; children: Child; animation?: Stack<"rotate" | "scale"> }) => (
  <g animation={animation}>
    <rect x={-size} y={-size} width={size * 2} height={size * 2} fill="none" />
    {children}
  </g>
);

export default function build(): string {
  const g = genome;
  const lay = layout(g);
  const rand = mulberry(g.seed);
  const { G, frames, spine } = lay;
  const loafy = g.oid === "loaf" && g.oidness > 0.5;
  const pal = loafy ? BREAD : PALETTES[g.fur];
  const ink: Hex = !loafy && (g.fur === "void" || g.fur === "cosmic") ? "#8C7DAA" : INK;
  const k = clamp((g.oidness - 0.15) / 0.85, 0, 1);
  const dog = g.oid === "dog" ? k : 0;
  const horse = g.oid === "horse" ? k : 0;
  const loaf = g.oid === "loaf" ? k : 0;
  const hatHeight = g.oid === "hat" ? 0.9 + 1.6 * g.oidness : 0;
  const liquid = g.dimension === "liquid";
  const four = g.dimension === "4d";
  const word = (i: number) => wordFor(g, i);

  const breath = def.property("breath", { syntax: "number", inherits: true, initial: 1 });
  const breathing = four
    ? sampled(
        (t) => ({ [breath]: Math.round((1 + 0.05 * Math.sin((Math.PI * 2 * t) / 2)) * (0.35 + 0.65 * sliceAt(g, 0, t)) * 100) / 100 }),
        { duration: DUR, step: 0.1, tolerance: { [breath]: 0.02 } },
      )
    : liquid
      ? motion({ [breath]: 1 })
          .at(MELT.at)
          .to({ [breath]: 1.3 }, MELT.over, ease.inOut)
          .at(MELT.back)
          .to({ [breath]: 1 }, MELT.rebound, ease.pop)
      : motion({ [breath]: 1 }).to({ [breath]: 1.07 }, 2, ease.inOut).to({ [breath]: 1 }, 2, ease.inOut).loop(4);

  const style = css`
    .co { stroke-width: calc(${G + 5}px * ${breath} + 0px); }
    .cf { stroke-width: calc(${G}px * ${breath}); }
    .ct { stroke-width: calc(${r1(G * 0.84)}px * ${breath}); }
  `;

  const meltBy = (p: Pt) => sub(lay.melt(p), p);
  /** The part's own motions: melting toward the floor, or flickering through the slice. */
  const partMotion = (p: Pt, w: number) => (liquid ? meltMotion(meltBy(p)) : four ? sliced(g, w) : undefined);

  // The body: one outline and one fill, then the pieces that cross over themselves drawn again on top.
  const bodyD = polyline(spine);
  const over: [number, number][] = [];
  const gapIdx = Math.ceil((G * 2.2) / (lay.L / spine.length));
  for (let j = 0; j < spine.length; j++)
    for (let i = 0; i < j - gapIdx; i++)
      if (Math.hypot(spine[i]!.x - spine[j]!.x, spine[i]!.y - spine[j]!.y) < G * 1.1) {
        const last = over.at(-1);
        if (last && j - last[1] <= 3) last[1] = j;
        else over.push([j, j]);
        break;
      }
  const pieces = liquid ? [] : over.map(([a, b]) => [Math.max(0, a - 4), Math.min(spine.length - 1, b + 4)] as const);
  const step = lay.L / (spine.length - 1);
  const stripes = g.pattern === "tabby" ? `${r1(G * 0.22)} ${r1(G * 0.4)}` : undefined;

  type Layer = "co" | "cf" | "ct";
  const layer = (kind: Layer, from: number, to: number, cap: "round" | "butt") => {
    const d = polyline(spine.slice(from, to + 1));
    if (kind === "co") return <path d={d} class="co" fill="none" stroke={ink} strokeLinecap={cap} strokeLinejoin="round" />;
    if (kind === "cf") return <path d={d} class="cf" fill="none" stroke={pal.base} strokeLinecap={cap} strokeLinejoin="round" />;
    return (
      stripes && (
        <path d={d} class="ct" fill="none" stroke={pal.dark} strokeDasharray={stripes} strokeDashoffset={r1(-from * step)} strokeLinecap="butt" opacity={0.8} />
      )
    );
  };
  const bodyPath = (from: number, to: number, cap: "round" | "butt") => (
    <>
      {layer("co", from, to, cap)}
      {layer("cf", from, to, cap)}
      {layer("ct", from, to, cap)}
    </>
  );
  // Melting moves the body in short segments, each to where its middle melts, all on the CSS clock with the parts.
  const SEG = 6;
  const segments = Array.from({ length: Math.ceil((spine.length - 1) / SEG) }, (_, k) => [k * SEG, Math.min(spine.length - 1, (k + 1) * SEG)] as const);
  const meltedBody = (["co", "cf", "ct"] as const).map((kind) =>
    segments.map(([a, b]) => <g animation={meltMotion(meltBy(spine[Math.round((a + b) / 2)]!))}>{layer(kind, a, b, "round")}</g>),
  );

  const spotColors: Hex[] = g.fur === "calico" ? [PALETTES.calico.light, PALETTES.calico.dark] : g.fur === "cosmic" ? [pal.light] : [pal.dark];
  const spotCount = g.pattern === "spots" || g.fur === "calico" || g.fur === "cosmic" ? Math.round(clamp(lay.L / 28, 4, 40)) : 0;
  const spots = Array.from({ length: spotCount }, (_, i) => {
    const f = frames[Math.floor(rand() * frames.length)]!;
    const p = add(f.p, f.n, (rand() - 0.5) * G * 0.45);
    const r = g.fur === "cosmic" ? 1.2 + rand() * 1.8 : G * (0.1 + rand() * (g.fur === "calico" ? 0.22 : 0.1));
    return <circle cx={r1(p.x)} cy={r1(p.y)} r={r1(r)} fill={spotColors[i % spotColors.length]} animation={partMotion(p, 0)} />;
  });

  const blinkAt = () => {
    const a = 0.5 + rand() * 3;
    return [a, a + 3.6 + rand() * 0.6] as const;
  };
  const blinkOpen = ([a, b]: readonly [number, number]) =>
    motion({ opacity: 1 }).at(a).set({ opacity: 0 }).at(a + 0.16).set({ opacity: 1 }).at(b).set({ opacity: 0 }).at(b + 0.16).set({ opacity: 1 });
  const blinkShut = ([a, b]: readonly [number, number]) =>
    motion({ opacity: 0 }).at(a).set({ opacity: 1 }).at(a + 0.16).set({ opacity: 0 }).at(b).set({ opacity: 1 }).at(b + 0.16).set({ opacity: 0 });

  const Eye = ({ x, y, r, look, blink }: { x: number; y: number; r: number; look?: Stack<"x">; blink: readonly [number, number] }) => (
    <g transform={`translate(${r1(x)} ${r1(y)})`}>
      <g animation={blinkOpen(blink)}>
        <circle r={r1(r)} fill={pal.eye} stroke={ink} strokeWidth={1.6} />
        <g animation={look}>
          <ellipse rx={r1(r * 0.36)} ry={r1(r * 0.78)} fill={INK} />
          <circle cx={r1(-r * 0.12)} cy={r1(-r * 0.3)} r={r1(Math.max(1, r * 0.18))} fill="#fff" />
        </g>
      </g>
      <path d={`M${r1(-r)} 0Q0 ${r1(r * 0.7)} ${r1(r)} 0`} fill="none" stroke={ink} strokeWidth={1.8} strokeLinecap="round" animation={blinkShut(blink)} />
    </g>
  );

  const EYE_SPOTS = [
    [0, -0.55],
    [-0.74, 0.3],
    [0.74, 0.3],
    [0, 0.62],
    [-0.34, -0.8],
    [0.34, -0.8],
  ] as const;

  const Face = ({ r, face, eyes, ears, seed, mini }: { r: number; face: number; eyes: number; ears: number; seed: string; mini?: boolean }) => {
    const blink = blinkAt();
    const look = wiggle({ x: r * 0.12 }, { seed: `look${seed}`, rate: 1.2, period: 4 });
    const spread = ears <= 1 ? 0 : Math.min(85, 28 + ears * 11);
    const earList = Array.from({ length: ears }, (_, i) => (ears <= 1 ? 0 : -spread + (2 * spread * i) / (ears - 1)));
    const twitch = Math.floor(rand() * Math.max(1, ears));
    const earShape = (a: number, i: number) => {
      const rad = (a * Math.PI) / 180;
      const x = r * 0.82 * Math.sin(rad);
      const y = -r * 0.82 * Math.cos(rad);
      const h = r * (0.78 + horse * 0.5 - loaf * 0.45);
      const w = r * (0.7 - horse * 0.25);
      const flop = dog > 0.5;
      const shape = flop
        ? `M${r1(-w * 0.4)} 0C${r1(-w * 0.7)} ${r1(h * 0.6)} ${r1(w * 0.2)} ${r1(h * 1.1)} ${r1(w * 0.45)} ${r1(h * 0.2)}Z`
        : loaf > 0.5
          ? `M${r1(-w / 2)} 0Q0 ${r1(-h * 1.6)} ${r1(w / 2)} 0Z`
          : `M${r1(-w / 2)} 0L${r1(w * 0.05)} ${r1(-h)}L${r1(w / 2)} 0Z`;
      return (
        <g transform={`translate(${r1(x)} ${r1(y)}) rotate(${r1(flop ? a + Math.sign(a || face) * 60 : a)})`}>
          <Pivot size={h} animation={i === twitch ? shake({ at: 2.4 + rand() * 4, over: 0.45 }, { rotate: 14 }) : undefined}>
            <path d={shape} fill={flop ? pal.dark : pal.base} stroke={ink} strokeWidth={2.2} strokeLinejoin="round" />
            {!flop && loaf < 0.5 && <path d={`M${r1(-w * 0.22)} 0L${r1(w * 0.03)} ${r1(-h * 0.6)}L${r1(w * 0.22)} 0Z`} fill={PINK} />}
          </Pivot>
        </g>
      );
    };
    const snout = Math.max(dog, horse);
    const sx = face * r * (0.55 + snout * 0.55);
    const sy = r * (0.25 + horse * 0.2);
    const eyeR = eyes === 1 ? r * 0.4 : eyes === 2 ? r * 0.25 : r * 0.21;
    const eyePlaces: [number, number][] =
      eyes === 1 ? [[0, -0.08]] : eyes === 0 ? [] : [[-0.38, -0.1], [0.38, -0.1], ...EYE_SPOTS.slice(0, eyes - 2).map(([x, y]) => [x, y] as [number, number])];
    const mouthAt = snout > 0.3 ? { x: sx + face * r * 0.1, y: sy + r * 0.3 } : { x: 0, y: r * 0.42 };
    return (
      <>
        {earList.map(earShape)}
        {loaf > 0.5 ? (
          <rect x={r1(-r * 1.15)} y={r1(-r * 0.92)} width={r1(r * 2.3)} height={r1(r * 1.84)} rx={r1(r * 0.62)} fill={pal.base} stroke={ink} strokeWidth={2.6} />
        ) : (
          <ellipse rx={r1(r * (1.08 + horse * 0.1))} ry={r1(r)} fill={pal.base} stroke={ink} strokeWidth={2.6} />
        )}
        {loaf > 0.5 && <path d={`M${r1(-r * 0.9)} ${r1(-r * 0.62)}Q0 ${r1(-r * 0.95)} ${r1(r * 0.9)} ${r1(-r * 0.62)}`} fill="none" stroke={pal.dark} strokeWidth={3} strokeLinecap="round" />}
        {g.pattern === "tabby" && !mini && (
          <path d={`M${r1(-r * 0.3)} ${r1(-r * 0.92)}l${r1(r * 0.08)} ${r1(r * 0.28)}M0 ${r1(-r)}v${r1(r * 0.32)}M${r1(r * 0.3)} ${r1(-r * 0.92)}l${r1(-r * 0.08)} ${r1(r * 0.28)}`} stroke={pal.dark} strokeWidth={r1(Math.max(2, r * 0.1))} strokeLinecap="round" />
        )}
        {snout > 0.3 && (
          <>
            <ellipse cx={r1(sx)} cy={r1(sy)} rx={r1(r * (0.4 + snout * 0.3))} ry={r1(r * 0.42)} fill={g.pattern === "socks" ? pal.light : pal.base} stroke={ink} strokeWidth={2.4} />
            <ellipse cx={r1(sx + face * r * (0.25 + snout * 0.25))} cy={r1(sy - r * 0.12)} rx={r1(r * 0.12)} ry={r1(r * 0.09)} fill={INK} />
          </>
        )}
        {eyePlaces.map(([x, y]) => (
          <Eye x={x * r + (snout > 0.3 ? -face * r * 0.12 : 0)} y={y * r} r={eyeR} look={look} blink={blink} />
        ))}
        {snout <= 0.3 && <path d={`M${r1(-r * 0.09)} ${r1(r * 0.2)}h${r1(r * 0.18)}l${r1(-r * 0.09)} ${r1(r * 0.1)}Z`} fill={PINK} stroke={ink} strokeWidth={1} strokeLinejoin="round" />}
        <path
          d={`M${r1(mouthAt.x - r * 0.2)} ${r1(mouthAt.y - r * 0.05)}q${r1(r * 0.1)} ${r1(r * 0.14)} ${r1(r * 0.2)} 0q${r1(r * 0.1)} ${r1(r * 0.14)} ${r1(r * 0.2)} 0`}
          fill="none"
          stroke={ink}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
        {dog <= 0.5 && !mini && rand() < 0.5 && (
          <rect
            x={r1(mouthAt.x - r * 0.07)}
            y={r1(mouthAt.y + r * 0.04)}
            width={r1(r * 0.14)}
            height={r1(r * 0.17)}
            rx={r1(r * 0.07)}
            fill={PINK}
            stroke={ink}
            strokeWidth={1}
            animation={motion({ opacity: 0 }).at(blink[1] - 1.6).set({ opacity: 1 }).at(blink[1] - 0.5).set({ opacity: 0 })}
          />
        )}
        {dog > 0.5 && <rect x={r1(mouthAt.x - r * 0.09)} y={r1(mouthAt.y + r * 0.04)} width={r1(r * 0.18)} height={r1(r * 0.26)} rx={r1(r * 0.09)} fill={PINK} stroke={ink} strokeWidth={1.2} />}
        {!mini && snout <= 0.3 && (
          <path
            d={[-1, 1].map((s) => [0.1, 0.24, 0.38].map((y) => `M${r1(s * r * 0.5)} ${r1(r * y)}l${r1(s * r * 0.55)} ${r1((y - 0.24) * r * 0.8)}`).join("")).join("")}
            stroke={ink}
            strokeWidth={1}
            opacity={0.7}
          />
        )}
        {horse > 0.4 && (
          <path d={`M${r1(-face * r * 0.2)} ${r1(-r * 0.95)}l${r1(-face * r * 0.3)} ${r1(-r * 0.25)}l${r1(-face * r * 0.05)} ${r1(r * 0.35)}l${r1(-face * r * 0.35)} ${r1(-r * 0.15)}l${r1(-face * r * 0.0)} ${r1(r * 0.4)}`} fill={pal.dark} stroke={ink} strokeWidth={1.6} strokeLinejoin="round" />
        )}
        {hatHeight > 0 && (
          <g transform={`translate(0 ${r1(-r * 0.82)})`}>
            <rect x={r1(-r * 0.62)} y={r1(-r * hatHeight)} width={r1(r * 1.24)} height={r1(r * hatHeight)} rx={2} fill={INK} />
            <rect x={r1(-r * 0.62)} y={r1(-r * 0.32)} width={r1(r * 1.24)} height={r1(r * 0.16)} fill="#B33A3A" />
            <ellipse rx={r1(r * 1.02)} ry={r1(r * 0.17)} fill={INK} />
          </g>
        )}
      </>
    );
  };

  const Speech = ({ text, size, delay }: { text: string; size: number; delay: number }) => (
    <g animation={[enter({ at: delay, over: 0.3 }, { scale: 0, rotate: -25 }, ease.pop), exit({ at: delay + 1.15, over: 0.35 }, { opacity: 0, y: -10 })]}>
      <path d={`M-4 6l-7 7M2 8l1 9M-9 -1l-9 -2`} stroke={ink} strokeWidth={1.8} strokeLinecap="round" />
      <text x={6} y={0} fontSize={r1(size)} fontStyle="italic" fontWeight={700} fontFamily="ui-rounded, 'SF Pro Rounded', system-ui, sans-serif" fill={INK}>
        {text}
      </text>
    </g>
  );

  // A tail and what's on the end of it, pointing up from 0,0 before its rotation.
  const Tail = ({ length: Lt, width: tw, seed }: { length: number; width: number; seed: string }) => {
    const c = Lt * 0.22;
    const d = `M0 0C${r1(c)} ${r1(-Lt * 0.35)} ${r1(-c * 1.4)} ${r1(-Lt * 0.6)} ${r1(c * 0.4)} ${r1(-Lt * 0.86)}S${r1(c * 1.5)} ${r1(-Lt * 1.04)} ${r1(c * 1.1)} ${r1(-Lt)}`;
    const tip = { x: c * 1.1, y: -Lt };
    const stroke = (dd: string, w: number) => (
      <>
        <path d={dd} fill="none" stroke={ink} strokeWidth={r1(w + 4.5)} strokeLinecap="round" />
        <path d={dd} fill="none" stroke={pal.base} strokeWidth={r1(w)} strokeLinecap="round" />
        {g.pattern === "tabby" && <path d={dd} fill="none" stroke={pal.dark} strokeWidth={r1(w * 0.85)} strokeDasharray={`${r1(w * 0.5)} ${r1(w * 0.9)}`} />}
      </>
    );
    let end: Child;
    if (g.tip === "tuft") end = <circle cx={r1(tip.x)} cy={r1(tip.y)} r={r1(tw * 0.85)} fill={pal.dark} stroke={ink} strokeWidth={2} />;
    else if (g.tip === "eye") end = <Eye x={tip.x} y={tip.y} r={tw * 1.25} look={wiggle({ x: tw * 0.4 }, { seed: `tail${seed}`, rate: 2, period: 2 })} blink={blinkAt()} />;
    else if (g.tip === "kitten") {
      const kr = Math.max(9, G * 0.32);
      end = (
        <g transform={`translate(${r1(tip.x)} ${r1(tip.y - kr * 0.6)})`}>
          <Pivot size={kr * 2} animation={wiggle({ rotate: 18 }, { seed: `kit${seed}`, rate: 1.5, period: 4 })}>
            <Face r={kr} face={1} eyes={2} ears={2} seed={`k${seed}`} mini />
          </Pivot>
          <g transform={`translate(${r1(kr * 0.8)} ${r1(-kr * 1.4)})`}>
            <Speech text="mew" size={Math.max(10, kr * 0.8)} delay={3.3 + rand() * 0.6} />
          </g>
        </g>
      );
    } else {
      const branch = (a: number, i: number) => (
        <g transform={`translate(${r1(tip.x)} ${r1(tip.y)}) rotate(${a})`}>
          <Pivot size={Lt * 0.4} animation={wiggle({ rotate: 20 }, { seed: `fork${seed}${i}`, rate: 2, period: 2 })}>
            {stroke(`M0 0C${r1(Lt * 0.06)} ${r1(-Lt * 0.12)} ${r1(-Lt * 0.06)} ${r1(-Lt * 0.2)} 0 ${r1(-Lt * 0.3)}`, tw * 0.7)}
            <circle cy={r1(-Lt * 0.3)} r={r1(tw * 0.6)} fill={pal.dark} stroke={ink} strokeWidth={1.6} />
          </Pivot>
        </g>
      );
      end = <>{[-38, 34].map(branch)}</>;
    }
    return (
      <Pivot size={Lt * 1.15} animation={wiggle({ rotate: 13 }, { seed: `tail${seed}`, rate: 1.1, period: 4 })}>
        {stroke(d, tw)}
        {end}
      </Pivot>
    );
  };

  const legsDrawn = lay.legs.map((l, i) => {
    const phase = (i * 0.19 + (i % 2) * 0.5) % 1;
    const swing = 20 - Math.min(10, g.legs);
    const walk = sampled((t) => ({ rotate: Math.round(swing * Math.sin(Math.PI * 2 * (t - phase)) * 10) / 10 }), {
      duration: 1,
      step: 0.05,
      tolerance: { rotate: 0.8 },
    }).loop(1);
    const paw = g.pattern === "socks" ? "#FFFFFF" : horse > 0.5 ? INK : pal.base;
    return (
      <g transform={`translate(${r1(l.at.x)} ${r1(l.at.y)})`}>
        <g animation={partMotion(l.at, (rand() - 0.5) * 2)}>
          <g transform={`rotate(${r1(l.angle)})`}>
            <Pivot
              size={l.length + l.width}
              animation={[
                walk,
                liquid && motion({ scale: 1 }).at(MELT.at).to({ scale: 0.25 }, MELT.over, ease.inOut).at(MELT.back).to({ scale: 1 }, MELT.rebound, ease.pop),
              ]}
            >
              <path d={`M0 0V${r1(l.length)}`} stroke={ink} strokeWidth={r1(l.width + 4.5)} strokeLinecap="round" />
              <path d={`M0 0V${r1(l.length)}`} stroke={pal.base} strokeWidth={r1(l.width)} strokeLinecap="round" />
              <ellipse cy={r1(l.length)} rx={r1(l.width * 0.78)} ry={r1(l.width * 0.55)} fill={paw} stroke={ink} strokeWidth={2} />
            </Pivot>
          </g>
        </g>
      </g>
    );
  });

  const tailsDrawn = lay.tails.map((t, i) => (
    <g transform={`translate(${r1(t.at.x)} ${r1(t.at.y)})`}>
      <g animation={partMotion(t.at, (rand() - 0.5) * 2)}>
        <g transform={`rotate(${r1(t.angle)})`}>
          <Tail length={t.length} width={t.width} seed={`${g.seed}-${i}`} />
        </g>
      </g>
    </g>
  ));

  const eyesDrawn = lay.bodyEyes.map((e, i) => (
    <g animation={partMotion(e, (rand() - 0.5) * 2)}>
      <Eye x={e.x} y={e.y} r={e.r} look={wiggle({ x: e.r * 0.3 }, { seed: `be${i}${g.seed}`, rate: 1.5, period: 4 })} blink={blinkAt()} />
    </g>
  ));

  const spin = g.quirk === "spin" ? motion({ rotate: 0 }).at(4.7).to({ rotate: 360 }, 1, ease.inOut) : undefined;
  const QUIRK = { at: 4.6, hatLift: 6.1, back: 6.9 };
  const headsDrawn = lay.heads.map((h, i) => {
    const look = wiggle({ rotate: 11 }, { seed: `head${g.seed}${i}`, rate: 0.9, period: 4 });
    const orbit = lay.orbit
      ? sampled(
          (t) => {
            const a = (Math.PI * 2 * t) / DUR + (Math.PI * 2 * i) / lay.heads.length;
            return { x: r1(lay.orbit!.rx * Math.cos(a)), y: r1(lay.orbit!.ry * Math.sin(a)) };
          },
          { duration: DUR, step: 0.1, tolerance: { translate: 1 } },
        )
      : undefined;
    const vanish =
      g.quirk === "hat" && i === 0
        ? motion({ scale: 1 }).at(QUIRK.at + 0.75).set({ scale: 0.001 }).at(QUIRK.back).to({ scale: 1 }, 0.5, ease.pop)
        : undefined;
    const meow = 0.9 + i * 0.45;
    const neck = h.neck && sub(h.neck, h.at);
    return (
      <g transform={`translate(${r1(h.at.x)} ${r1(h.at.y)})`}>
        <g animation={[orbit, partMotion(h.at, (rand() - 0.5) * 2), vanish]}>
          {neck && (
            <>
              <path d={`M0 0L${r1(neck.x)} ${r1(neck.y)}`} stroke={ink} strokeWidth={r1(h.r * 0.7 + 4.5)} strokeLinecap="round" />
              <path d={`M0 0L${r1(neck.x)} ${r1(neck.y)}`} stroke={pal.base} strokeWidth={r1(h.r * 0.7)} strokeLinecap="round" />
            </>
          )}
          <Pivot size={h.r * (1.9 + hatHeight)} animation={[i === 0 ? spin : undefined, look]}>
            <Face r={h.r} face={h.face} eyes={g.eyes} ears={g.ears} seed={`${i}`} />
          </Pivot>
          <g transform={`translate(${r1(h.face * h.r * 0.55)} ${r1(-h.r * (1.45 + hatHeight * 0.9))})`}>
            <Speech text={word(i)} size={speechSize(h.r)} delay={meow} />
          </g>
        </g>
      </g>
    );
  });

  const mid = frames[Math.floor(frames.length / 2)]!;
  const headless = lay.heads.length === 0 && (
    <g transform={`translate(${r1(mid.p.x)} ${r1(mid.p.y - G * 0.9)})`}>
      <g animation={partMotion(mid.p, 0)}>
        <Speech text={`(${word(0)})`} size={clamp(G * 0.45, 12, 22)} delay={1.2} />
      </g>
    </g>
  );

  const ghost = four && (
    <path
      d={bodyD}
      fill="none"
      stroke="#7B5CFF"
      strokeWidth={G}
      strokeLinecap="round"
      opacity={0.18}
      animation={sampled(
        (t) => ({ x: r1(14 * Math.cos((Math.PI * 2 * t) / 4)), y: r1(10 * Math.sin((Math.PI * 4 * t) / 4)) }),
        { duration: 4, step: 0.1, tolerance: { translate: 1 } },
      ).loop(4)}
    />
  );

  const drips =
    liquid &&
    Array.from({ length: 6 }, (_, i) => {
      const f = frames[Math.floor(rand() * frames.length)]!;
      const p = lay.melt(f.p);
      const at = MELT.at + 0.8 + i * 0.55;
      const fall = Math.max(16, lay.floor - p.y + G * 0.2);
      return (
        <circle
          cx={r1(p.x)}
          cy={r1(p.y + G * 0.35)}
          r={r1(Math.max(3, G * 0.12))}
          fill={pal.base}
          stroke={ink}
          strokeWidth={1.5}
          animation={motion({ opacity: 0, y: 0, scale: 0.4 })
            .at(at)
            .to({ opacity: 1, scale: 1 }, 0.25)
            .to({ y: r1(fall) }, 0.45, ease.in)
            .to({ opacity: 0, scale: 1.6 }, 0.15)}
        />
      );
    });

  const shadowW = Math.max(...spine.map((p) => p.x)) - Math.min(...spine.map((p) => p.x)) + G;
  const shadow = g.plan === "line" && (
    <ellipse
      cx={r1(lay.center.x)}
      cy={r1(lay.floor + Math.max(0, ...lay.legs.map((l) => (Math.cos(((l.angle) * Math.PI) / 180) > 0.3 ? l.length * Math.cos((l.angle * Math.PI) / 180) : 0))) - 2)}
      rx={r1(shadowW * 0.52)}
      ry={r1(G * 0.22 + 3)}
      fill={INK}
      opacity={liquid ? 0.16 : 0.08}
      animation={liquid ? motion({ scale: 1 }).at(MELT.at).to({ scale: 1.35 }, MELT.over, ease.inOut).at(MELT.back).to({ scale: 1 }, MELT.rebound, ease.pop) : undefined}
    />
  );

  const boil = g.ink > 0.05 ? fx.boil({ strength: r1(g.ink * 1.4), rate: 8, seed: g.seed % 50, detail: 0.035 }) : undefined;

  const creature = () => (
    <g transform={`translate(${r1(lay.ox)} ${r1(lay.oy)}) scale(${lay.scale.toFixed(4)})`}>
      {shadow}
      <g style={{ [breath]: 1 }} animation={breathing}>
        {ghost}
        {tailsDrawn}
        {legsDrawn}
        {liquid ? meltedBody : bodyPath(0, spine.length - 1, "round")}
        {spots}
        {pieces.map(([a, b]) => bodyPath(a, b, "butt"))}
        {eyesDrawn}
        {headsDrawn}
        {headless}
        {drips}
      </g>
    </g>
  );

  // The quirk: the one odd thing this specimen does each loop.
  const cx = lay.ox + lay.center.x * lay.scale;
  let stage: Child;
  if (g.quirk === "wrap") {
    stage = (
      <g animation={motion({ x: 0 }).at(QUIRK.at).to({ x: W }, 1.9, ease.inOut).set({ x: 0 })}>
        {creature()}
        <g transform={`translate(${-W} 0)`}>{creature()}</g>
      </g>
    );
  } else if (g.quirk === "split") {
    const half = (left: boolean) => (
      <g animation={motion({ x: 0, rotate: 0 }).at(QUIRK.at).to({ x: left ? -36 : 36, rotate: left ? -6 : 6 }, 0.7, ease.pop).at(QUIRK.at + 1.5).to({ x: 0, rotate: 0 }, 0.5, ease.in)}>
        <g clipPath={def.clipPath({}, <rect x={left ? -W : cx} y={-H} width={left ? cx + W : W * 2} height={H * 3} />)}>{creature()}</g>
      </g>
    );
    stage = (
      <>
        {half(true)}
        {half(false)}
      </>
    );
  } else if (g.quirk === "float") {
    stage = (
      <g animation={motion({ y: 0, rotate: 0 }).at(QUIRK.at).to({ y: -26, rotate: 360 }, 1.8, ease.inOut).to({ y: 0 }, 0.6, ease.pop)}>{creature()}</g>
    );
  } else if (g.quirk === "spin" && lay.heads.length === 0) {
    stage = <g animation={motion({ rotate: 0 }).at(QUIRK.at).to({ rotate: 360 }, 1.2, ease.inOut)}>{creature()}</g>;
  } else stage = creature();

  const hatHead = lay.heads[0];
  const hatAt = hatHead ? { x: lay.ox + hatHead.at.x * lay.scale, y: lay.oy + (hatHead.at.y - hatHead.r * 0.3) * lay.scale } : { x: cx, y: lay.oy + lay.center.y * lay.scale };
  const hr = (hatHead?.r ?? G) * lay.scale;
  const magicHat = g.quirk === "hat" && (
    <g transform={`translate(${r1(hatAt.x)} ${r1(hatAt.y)})`}>
      <g
        animation={motion({ y: -H, rotate: 0 })
          .at(QUIRK.at)
          .to({ y: 0 }, 0.6, ease.in)
          .at(QUIRK.hatLift)
          .to({ y: -H, rotate: 24 }, 0.9, ease.in)}
      >
        <rect x={r1(-hr * 1.1)} y={r1(-hr * 2.2)} width={r1(hr * 2.2)} height={r1(hr * 2.2)} rx={3} fill={INK} />
        <rect x={r1(-hr * 1.1)} y={r1(-hr * 0.55)} width={r1(hr * 2.2)} height={r1(hr * 0.28)} fill="#B33A3A" />
        <ellipse rx={r1(hr * 1.7)} ry={r1(hr * 0.3)} fill={INK} />
      </g>
    </g>
  );

  const QUIRK_WORDS: Record<Genome["quirk"], string> = { spin: "wheee", wrap: "brb", split: "mitosis", hat: "?", float: "hup", none: "" };
  const topY = lay.oy + (Math.min(...spine.map((p) => p.y)) - G) * lay.scale;
  const quirkWord = QUIRK_WORDS[g.quirk] && (
    <g transform={`translate(${r1(Math.min(W - 130, Math.max(40, cx + 30)))} ${r1(Math.max(34, topY - 8))})`}>
      <Speech text={QUIRK_WORDS[g.quirk]} size={18} delay={g.quirk === "hat" ? QUIRK.at + 1.1 : QUIRK.at - 0.5} />
    </g>
  );
  const unitBar = CAT * lay.scale;
  const barX = W - 22 - unitBar;
  return render(
    {
      width: W,
      height: H,
      duration: DUR,
      title: "Catoid",
      desc: `A catoid with ${g.heads} heads, ${g.legs} legs and ${g.tails} tails, ${r1(g.length)} cats long.`,
      css: style,
      reducedMotion: { at: 0.4 },
    },
    <>
      <rect width={W} height={H} fill={PAPER} />
      <path
        d={Array.from({ length: 16 }, (_, i) => `M${i * 40 + 20} 0V${H}`).join("") + Array.from({ length: 10 }, (_, i) => `M0 ${i * 40 + 20}H${W}`).join("")}
        stroke="#D9D0BC"
        strokeWidth={0.6}
        opacity={0.55}
      />
      <g filter={boil}>
        {stage}
        {magicHat}
        {quirkWord}
      </g>
      <g fontFamily="ui-monospace, 'SF Mono', Menlo, monospace" fontSize={11} fill={INK}>
        <path d={`M${r1(barX)} 378v6H${W - 22}v-6`} fill="none" stroke={INK} strokeWidth={1.4} />
        <text x={W - 22} y={372} textAnchor="end" opacity={0.75}>
          1 cat
        </text>
      </g>
    </>,
  );
}
