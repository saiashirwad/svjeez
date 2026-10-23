import { def, el, type Color, type SvgNode } from "svg-motion";
import { CAM, C, MOSS, ORIGIN, ROCK, alpha, at, clamp, hazed, lit, mix, random, tone } from "./kit";
import { disc, smooth, tapered } from "./draw";
import { layer, type Part } from "./paint";
import { TAU, add, cross, mul, sub, unit, type Vec3 } from "./space";

export const R = 6.0;

const SECTORS = 56;
const LAYERS = 9;
const SKIRT = 11;

const rng = random(4242);

export const edgeRadius = (angle: number): number => R * (1 + 0.045 * Math.sin(3 * angle + 1.3) + 0.028 * Math.sin(7 * angle + 4.1) + 0.016 * Math.sin(11 * angle - 1.7));

/** A gentle mossy mound, highest around the oak's roots. */
export const height = (x: number, z: number): number => {
  const d = clamp(Math.hypot(x, z) / R);
  const mound = 0.42 * Math.exp(-(((x + 1.1) ** 2 + (z - 0.2) ** 2) / 7)) + 0.22 * Math.exp(-(((x - 2.7) ** 2 + (z + 1.7) ** 2) / 5));
  return 0.06 + mound * (1 - d * d) + 0.025 * Math.sin(x * 1.7 + z * 1.3) + 0.015 * Math.sin(x * 3.1 - z * 2.2);
};

export const ground = (x: number, z: number): Vec3 => [x, height(x, z), z];

const ring = (angle: number, radius: number, y: number): Vec3 => [Math.cos(angle) * radius, y, Math.sin(angle) * radius];

const topFill = def.linearGradient({ x1: 0.16, y1: 0.06, x2: 0.82, y2: 0.98 }, (
  <>
    <stop offset={0} stopColor="#7da45f" />
    <stop offset={0.4} stopColor="#4d7849" />
    <stop offset={1} stopColor="#213f32" />
  </>
));

const topShade = def.radialGradient({ gradientUnits: "userSpaceOnUse", cx: ORIGIN.x - 80, cy: ORIGIN.y - 50, r: 280 }, (
  <>
    <stop offset={0} stopColor="#d6e79f" stopOpacity={0.26} />
    <stop offset={0.55} stopColor="#8cb86c" stopOpacity={0.08} />
    <stop offset={1} stopColor="#1c3a2d" stopOpacity={0} />
  </>
));

const topEdge = (): readonly Vec3[] => Array.from({ length: SECTORS }, (_, s) => {
  const angle = (s / SECTORS) * TAU;
  const radius = edgeRadius(angle);
  return ring(angle, radius, height(Math.cos(angle) * radius, Math.sin(angle) * radius));
});

const topPath = (): string => smooth(topEdge().map(at), true);

/** The underside: stacked, jagged bands of rock, each lit by the same low sun. */
const skirt = (): Part[] => {
  const parts: Part[] = [];
  for (let l = 0; l < SKIRT; l++) {
    const t = l / SKIRT;
    const next = (l + 1) / SKIRT;
    for (let s = 0; s < SECTORS; s++) {
      const a0 = (s / SECTORS) * TAU;
      const a1 = ((s + 1) / SECTORS) * TAU;
      const point = (angle: number, layer: number): Vec3 => {
        const u = layer / SKIRT;
        const jag = 1 + 0.045 * Math.sin(angle * 7 + layer * 1.8) + 0.026 * Math.sin(angle * 13 - layer * 0.8);
        const radius = edgeRadius(angle + 0.12 * u) * (1 - 0.84 * u ** 1.12) * jag;
        const y = -0.05 - 4.12 * u ** 1.04 - 0.12 * Math.sin(angle * 5 + layer * 0.7) * u;
        return ring(angle, radius, y);
      };
      const corners = [point(a0, l), point(a1, l), point(a1, l + 1), point(a0, l + 1)] as const;
      const normal = unit(cross(sub(corners[1], corners[0]), sub(corners[2], corners[0])));
      const face = normal[1] < 0 ? mul(normal, -1) : normal;
      const light = Math.max(0, face[0] * -0.55 + face[1] * 0.78 + face[2] * 0.32);
      const band = 0.12 + light * 0.42 + (l % 2) * 0.06 + rng() * 0.05;
      const mossy = l < 2 && rng() < 0.34;
      const color = mossy ? mix(tone(ROCK, band), tone(MOSS, 0.16 + band * 0.36), 0.5) : tone(ROCK, band);
      const points = corners.map(at);
      const depth = points.reduce((sum, p) => sum + p.depth, 0) / 4;
      parts.push({
        depth,
        node: el.path({
          d: `M${points.map((p) => `${p.x} ${p.y}`).join("L")}Z`,
          fill: hazed(color, depth),
          stroke: hazed(color, depth),
          strokeWidth: 0.6,
          strokeLinejoin: "round",
        }),
      });
    }
  }

  const tip: Vec3[] = Array.from({ length: SECTORS }, (_, s) => {
    const angle = (s / SECTORS) * TAU;
    return ring(angle, 0.32 * edgeRadius(angle), -5.05 - 0.35 * Math.sin(angle * 3 + 1));
  });
  parts.push({ depth: at([0, -5, 0]).depth, node: el.path({ d: smooth(tip.map(at), true), fill: "#172628", stroke: "#172628", strokeWidth: 0.8 }) });

  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * TAU + 0.4;
    const start = ring(angle, edgeRadius(angle) * (0.5 + rng() * 0.24), -2.8 - rng() * 0.9);
    const end = add(start, [Math.cos(angle) * (0.2 + rng() * 0.3), -1.1 - rng() * 1.5, Math.sin(angle) * (0.2 + rng() * 0.3)]);
    const mid = add(start, [Math.cos(angle) * 0.8, -0.5, Math.sin(angle) * 0.8]);
    const points = [start, mid, end].map(at);
    const depth = points.reduce((sum, p) => sum + p.depth, 0) / 3;
    parts.push({
      depth,
      node: el.path({ d: tapered(points, [5.2, 3.4, 1.1]), fill: "#3c2f24", opacity: 0.9 }),
    });
  }
  return parts;
};

/** The moss itself: one soft surface with a few broader patches and contour lines. */
const surface = (): { readonly fill: SvgNode; readonly detail: SvgNode } => {
  const edge = topEdge();
  const patch = random(77);
  const patches: SvgNode[] = [];
  for (let i = 0; i < 52; i++) {
    const angle = patch() * TAU;
    const radius = Math.sqrt(patch()) * R * 0.9;
    const center = ground(Math.cos(angle) * radius, Math.sin(angle) * radius);
    const size = 0.22 + patch() * 0.78;
    const toneIndex = patch();
    const dirt = toneIndex > 0.94;
    const color = dirt ? mix("#6a5a3e", tone(MOSS, 0.25), 0.35) : tone(MOSS, 0.14 + toneIndex * 0.62);
    patches.push(el.path({ d: disc(center, [1, 0, 0], [0, 0, 1], size, at, 9), fill: color, opacity: 0.22 + patch() * 0.25 }));
  }

  const contours: SvgNode[] = [0.46, 0.68, 0.84].map((fraction, i) => {
    const points = Array.from({ length: 64 }, (_, s) => {
      const angle = (s / 64) * TAU;
      const radius = R * fraction * (1 + 0.028 * Math.sin(angle * 5 + i));
      return at(ground(Math.cos(angle) * radius, Math.sin(angle) * radius));
    });
    return el.path({ d: smooth(points, true), fill: "none", stroke: "#c6dfa0", strokeWidth: 0.9, opacity: 0.16 - i * 0.03 });
  });

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * TAU + 0.3;
    const radius = R * (0.9 + rng() * 0.06);
    const center = ground(Math.cos(angle) * radius, Math.sin(angle) * radius);
    patches.push(el.path({ d: disc(center, [1, 0, 0], [0, 0, 1], 0.35 + rng() * 0.5, at, 8), fill: "#6b5a3d", opacity: 0.26 }));
  }

  return {
    fill: el.g({}, [
      el.path({ d: topPath(), fill: topFill }),
      el.path({ d: topPath(), fill: topShade }),
    ]),
    detail: el.g({}, [
      ...patches,
      ...contours,
      el.path({ d: topPath(), fill: "none", stroke: "#b8d68f", strokeWidth: 1.3, opacity: 0.55 }),
    ]),
  };
};

/** The grassy fringe spilling over the rim. */
const fringe = (): { readonly back: Part[]; readonly front: Part[] } => {
  const edge = topEdge();
  const center = at([0, 0, 0]);
  const back: Part[] = [];
  const front: Part[] = [];
  for (let s = 0; s < SECTORS; s++) {
    if (s % 2 === 1) continue;
    const angle = (s / SECTORS) * TAU;
    const top = edge[s]!;
    const next = edge[(s + 1) % SECTORS]!;
    const out = unit([Math.cos(angle), 0, Math.sin(angle)]);
    const width = 0.12 + rng() * 0.22;
    const drop = 0.12 + rng() * 0.5;
    const tangent = unit(sub(next, top));
    const p0 = add(top, mul(tangent, -width / 2));
    const p1 = add(top, mul(tangent, width / 2));
    const tip = add(add(top, mul(out, 0.1 + rng() * 0.18)), [0, -drop, 0]);
    const points = [p0, p1, tip].map(at);
    const depth = points.reduce((sum, p) => sum + p.depth, 0) / 3;
    const part: Part = {
      depth,
      node: el.path({ d: `M${points.map((p) => `${p.x} ${p.y}`).join("L")}Z`, fill: tone(MOSS, 0.2 + rng() * 0.4), opacity: 0.95 }),
    };
    (depth > center.depth ? front : back).push(part);
  }
  return { back, front };
};

/** The island: a mossy cap, a banded rock underside, and the roots of the world. */
export const island = (): SvgNode => {
  const surfaceNode = surface();
  const skirtParts = skirt();
  const rim = fringe();
  return el.g({}, [layer([...skirtParts, ...rim.back]), surfaceNode.fill, surfaceNode.detail, layer(rim.front)]);
};

/** Full island bounds, for scattering plants. */
export const inside = (x: number, z: number, margin = 0.6): boolean => Math.hypot(x, z) < edgeRadius(Math.atan2(z, x)) - margin;
