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

const skirtPoint = (angle: number, layer: number): Vec3 => {
  const u = layer / SKIRT;
  const jag = 1 + 0.045 * Math.sin(angle * 7 + layer * 1.8) + 0.026 * Math.sin(angle * 13 - layer * 0.8);
  const radius = edgeRadius(angle + 0.12 * u) * (1 - 0.84 * u ** 1.12) * jag;
  const y = -0.05 - 4.12 * u ** 1.04 - 0.12 * Math.sin(angle * 5 + layer * 0.7) * u;
  return ring(angle, radius, y);
};

/** The underside: stacked, jagged bands of rock, each lit by the same low sun. */
const skirt = (): Part[] => {
  const parts: Part[] = [];
  for (let l = 0; l < SKIRT; l++) {
    for (let s = 0; s < SECTORS; s++) {
      const a0 = (s / SECTORS) * TAU;
      const a1 = ((s + 1) / SECTORS) * TAU;
      const corners = [skirtPoint(a0, l), skirtPoint(a1, l), skirtPoint(a1, l + 1), skirtPoint(a0, l + 1)] as const;
      const normal = unit(cross(sub(corners[1], corners[0]), sub(corners[2], corners[0])));
      const face = normal[1] < 0 ? mul(normal, -1) : normal;
      const light = Math.max(0, face[0] * -0.55 + face[1] * 0.78 + face[2] * 0.32);
      const band = 0.12 + light * 0.44 + (l % 2) * 0.065 + rng() * 0.05;
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

  for (const layer of [2, 4, 6, 8]) {
    const points = Array.from({ length: SECTORS }, (_, s) => at(skirtPoint((s / SECTORS) * TAU, layer)));
    parts.push({
      depth: 1e6,
      node: el.path({ d: smooth(points, true), fill: "none", stroke: "#78958a", strokeWidth: 0.9, opacity: 0.16 }),
    });
  }

  const cap: Vec3[] = Array.from({ length: SECTORS }, (_, s) => {
    const angle = (s / SECTORS) * TAU;
    return ring(angle, 0.12 * edgeRadius(angle), -4.35 - 0.18 * Math.sin(angle * 3 + 1));
  });
  parts.push({ depth: at([0, -4.3, 0]).depth, node: el.path({ d: smooth(cap.map(at), true), fill: "#0d191b", stroke: "#0d191b", strokeWidth: 0.8 }) });

  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * TAU + 0.7;
    const start = ring(angle, edgeRadius(angle) * (0.28 + rng() * 0.2), -2.4 - rng() * 0.8);
    const mid = add(start, [Math.cos(angle) * 0.24, -0.5 - rng() * 0.4, Math.sin(angle) * 0.24]);
    const end = add(start, [Math.cos(angle) * (0.42 + rng() * 0.2), -1.1 - rng() * 0.9, Math.sin(angle) * (0.42 + rng() * 0.2)]);
    const points = [start, mid, end].map(at);
    const depth = points.reduce((sum, p) => sum + p.depth, 0) / 3;
    parts.push({
      depth,
      node: el.path({ d: tapered(points, [3.2, 1.8, 0.4]), fill: "#221c16", opacity: 0.9 }),
    });
  }
  return parts;
};

/** The moss itself: one soft surface with a few broad, broken patches. */
const surface = (): { readonly fill: SvgNode; readonly detail: SvgNode } => {
  const patch = random(77);
  const patches: SvgNode[] = [];
  for (let i = 0; i < 16; i++) {
    const angle = patch() * TAU;
    const radius = Math.sqrt(patch()) * R * 0.88;
    const center = ground(Math.cos(angle) * radius, Math.sin(angle) * radius);
    const size = 0.3 + patch() * 0.6;
    const toneIndex = patch();
    const dirt = toneIndex > 0.96;
    const color = dirt ? mix("#5f5038", tone(MOSS, 0.3), 0.4) : tone(MOSS, 0.3 + toneIndex * 0.3);
    for (let lobe = 0; lobe < 3; lobe++) {
      const shift = 0.5 * size;
      const offset = ground(Math.cos(angle + lobe * 2.1) * shift, Math.sin(angle + lobe * 2.1) * shift);
      patches.push(
        el.path({
          d: disc(add(center, [offset[0] * 0.4, 0, offset[2] * 0.4]), [1, 0, 0], [0, 0, 1], size * (0.45 + patch() * 0.3), at, 8),
          fill: color,
          opacity: 0.05 + patch() * 0.06,
        }),
      );
    }
  }

  for (let i = 0; i < 70; i++) {
    const angle = patch() * TAU;
    const radius = Math.sqrt(patch()) * R * 0.94;
    const center = ground(Math.cos(angle) * radius, Math.sin(angle) * radius);
    patches.push(
      el.path({
        d: disc(center, [1, 0, 0], [0, 0, 1], 0.03 + patch() * 0.1, at, 6),
        fill: patch() > 0.5 ? "#7ea85f" : "#214a36",
        opacity: 0.14 + patch() * 0.14,
      }),
    );
  }

  return {
    fill: el.g({}, [
      el.path({ d: topPath(), fill: topFill }),
      el.path({ d: topPath(), fill: topShade }),
    ]),
    detail: el.g({}, [...patches, el.path({ d: topPath(), fill: "none", stroke: "#a8c97d", strokeWidth: 1, opacity: 0.26 })]),
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
    const width = 0.09 + rng() * 0.16;
    const drop = 0.08 + rng() * 0.34;
    const tangent = unit(sub(next, top));
    const p0 = add(top, mul(tangent, -width / 2));
    const p1 = add(top, mul(tangent, width / 2));
    const tip = add(add(top, mul(out, 0.06 + rng() * 0.12)), [0, -drop, 0]);
    const points = [p0, p1, tip].map(at);
    const depth = points.reduce((sum, p) => sum + p.depth, 0) / 3;
    const part: Part = {
      depth,
      node: el.path({ d: `M${points.map((p) => `${p.x} ${p.y}`).join("L")}Z`, fill: tone(MOSS, 0.14 + rng() * 0.32), opacity: 0.95 }),
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
