import { type Pt } from "./geometry";
import { clamp } from "../util";
import type { Plan } from "./genome";

type Centerline = (L: number, G: number, reach: number) => Pt[];

/** The longest a straight row runs before the tube folds back. */
const ROW = 470;

const line: Centerline = (L, G, reach) => {
  const pts: Pt[] = [];

  if (L <= ROW) {
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
    const run = Math.min(ROW, left);
    const x0 = dir > 0 ? -ROW / 2 : ROW / 2;

    for (let i = 0; i <= 60; i++) pts.push({ x: x0 + dir * run * (i / 60), y });
    left -= run;

    if (left <= 0) break;
    const turn = Math.min((Math.PI * gap) / 2, left);
    const cx = dir > 0 ? ROW / 2 : -ROW / 2;

    for (let i = 1; i <= 40; i++) {
      const a = (turn / (gap / 2)) * (i / 40);
      pts.push({ x: cx + dir * (gap / 2) * Math.sin(a), y: y + gap / 2 - (gap / 2) * Math.cos(a) });
    }

    left -= turn;
    y += gap;
    dir = -dir;
  }

  return pts;
};

const loop: Centerline = (L, G) => {
  const pts: Pt[] = [];
  const sweep = (330 / 360) * Math.PI * 2;
  const R = Math.max(L / sweep, G * 0.9);
  const start = -Math.PI / 2 + (Math.PI * 2 - sweep) / 2;

  for (let i = 0; i <= 240; i++) {
    const a = start + sweep * (i / 240);
    pts.push({ x: R * Math.cos(a), y: R * Math.sin(a) });
  }

  return pts;
};

const spiral: Centerline = (L, G) => {
  const pts: Pt[] = [];
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
};

const knot: Centerline = (L, G) => {
  const raw: Pt[] = [];

  for (let i = 0; i <= 400; i++) {
    const t = 0.3 + (Math.PI * 2 - 0.6) * (i / 400);
    raw.push({ x: Math.sin(t) + 2 * Math.sin(2 * t), y: -(Math.cos(t) - 2 * Math.cos(2 * t)) });
  }

  let len = 0;

  for (let i = 1; i < raw.length; i++)
    len += Math.hypot(raw[i]!.x - raw[i - 1]!.x, raw[i]!.y - raw[i - 1]!.y);
  const k = Math.max(L, G * 9) / len;

  return raw.map((p) => ({ x: p.x * k, y: p.y * k }));
};

/** The body's centerline before resampling, dense enough that its length is its arc length. */
export const CENTERLINES: Record<Plan, Centerline> = { line, loop, spiral, knot };

/** Resamples a polyline to `count` points evenly spaced along its length. */
export const resample = (pts: readonly Pt[], count: number): Pt[] => {
  const acc = [0];

  for (let i = 1; i < pts.length; i++)
    acc.push(acc[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
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
