import { ease, el, enter, wiggle, type SvgNode } from "svg-motion";
import { BARK, BLOSSOM, BLUSH, CAM, CREAM, D, FERN, GOLD, GRASS, OAK, PERIWINKLE, STONE, T, alpha, at, clamp, hazed, lerp, mix, random, tone } from "./kit";
import { edge, leaf as leafPath, smooth, tapered, type P2 } from "./draw";
import { layer, type Part } from "./paint";
import { TAU, add, bend, cross, dot, lit, mul, perpendicular, sub, unit, type Vec3 } from "./space";

const UP: Vec3 = [0, 1, 0];
type Rng = () => number;

export interface Stand {
  readonly node: SvgNode;
  /** Base depth, for sorting whole plants against each other. */
  readonly depth: number;
}

interface Limb {
  readonly points: readonly Vec3[];
  readonly radii: readonly number[];
  readonly depth: number;
}

interface ClusterSite {
  readonly center: Vec3;
  readonly radius: number;
  readonly count: number;
}

interface Species {
  readonly id: string;
  readonly bark: readonly string[];
  readonly leaves: readonly string[];
  readonly height: number;
  readonly trunk: number;
  readonly trunkRadius: number;
  readonly primary: number;
  readonly third: number;
  readonly spread: number;
  readonly ratio: number;
  readonly shrink: number;
  readonly rise: number;
  readonly bend: number;
  readonly maxDepth: number;
  readonly leafLength: number;
  readonly leafWidth: number;
  readonly leafCount: readonly [number, number];
  readonly cluster: number;
  readonly sway: number;
  readonly droop: number;
  readonly lean: Vec3;
}

const OAK_TREE: Species = {
  id: "oak",
  bark: BARK.oak,
  leaves: OAK,
  height: 9.4,
  trunk: 4.5,
  trunkRadius: 0.47,
  primary: 3,
  third: 0.25,
  spread: 0.86,
  ratio: 0.64,
  shrink: 0.52,
  rise: 0.24,
  bend: 0.16,
  maxDepth: 3,
  leafLength: 0.44,
  leafWidth: 0.19,
  leafCount: [13, 18],
  cluster: 0.52,
  sway: 0.42,
  droop: 0.02,
  lean: [0.12, 1, -0.06],
};

const BIRCH_TREE: Species = {
  id: "birch",
  bark: BARK.birch,
  leaves: OAK,
  height: 7.6,
  trunk: 4.2,
  trunkRadius: 0.24,
  primary: 3,
  third: 0.5,
  spread: 0.52,
  ratio: 0.6,
  shrink: 0.5,
  rise: 0.42,
  bend: 0.1,
  maxDepth: 3,
  leafLength: 0.35,
  leafWidth: 0.15,
  leafCount: [10, 15],
  cluster: 0.45,
  sway: 0.68,
  droop: 0.015,
  lean: [-0.22, 1, 0.1],
};

const BLOSSOM_TREE: Species = {
  id: "blossom",
  bark: BARK.blossom,
  leaves: BLOSSOM,
  height: 5.7,
  trunk: 2.9,
  trunkRadius: 0.3,
  primary: 4,
  third: 0.65,
  spread: 0.94,
  ratio: 0.6,
  shrink: 0.5,
  rise: 0.18,
  bend: 0.22,
  maxDepth: 3,
  leafLength: 0.36,
  leafWidth: 0.21,
  leafCount: [8, 13],
  cluster: 0.5,
  sway: 0.82,
  droop: 0.03,
  lean: [0.2, 1, 0.18],
};

const directionAt = (points: readonly Vec3[], i: number): Vec3 => unit(sub(points[Math.min(points.length - 1, i + 1)]!, points[Math.max(0, i - 1)]!));

const pointAt = (points: readonly Vec3[], t: number): Vec3 => {
  const x = clamp(t) * (points.length - 1);
  const i = Math.min(points.length - 2, Math.floor(x));
  return add(points[i]!, mul(sub(points[i + 1]!, points[i]!), x - i));
};

const grow = (rng: Rng, spec: Species, start: Vec3, dir: Vec3, length: number, radius: number, depth: number, limbs: Limb[], sites: ClusterSite[]): void => {
  const steps = Math.max(depth === 0 ? 6 : 4, Math.round(length / 0.42));
  const points: Vec3[] = [start];
  const radii: number[] = [radius];
  let heading = unit(dir);
  let point = start;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const wobble = unit(add(mul(perpendicular(heading, UP), (rng() - 0.5) * spec.bend), mul(perpendicular(heading, [0, 0, 1]), (rng() - 0.5) * spec.bend)));
    heading = unit(add(add(heading, wobble), [0, spec.droop + (depth > 0 ? 0.05 : 0), 0]));
    point = add(point, mul(heading, length / steps));
    points.push(point);
    radii.push(radius * (1 - 0.74 * t) * (1 + 0.05 * Math.sin(t * 6)));
  }
  limbs.push({ points, radii, depth });

  if (depth < spec.maxDepth) {
    const count = depth === 0 ? spec.primary : 2 + (rng() < spec.third ? 1 : 0);
    const from = depth === 0 ? 0.34 : 0.26;
    const base = rng() * TAU;
    for (let k = 0; k < count; k++) {
      const along = lerp(from, 0.94, (k + 0.3 + rng() * 0.4) / count);
      const index = clamp(Math.round(along * (steps - 1)), 1, steps - 2);
      const axis = directionAt(points, index);
      const side = perpendicular(axis, UP);
      const other = unit(cross(axis, side));
      const azimuth = base + (k / count) * TAU + rng() * 0.6;
      const bias = unit(add(mul(side, Math.cos(azimuth)), mul(other, Math.sin(azimuth))));
      const child = unit(add(add(unit(bend(axis, axis, bias, spec.spread * (0.66 + rng() * 0.62))), mul(UP, spec.rise)), mul(UP, depth === 0 ? 0.1 : 0)));
      const childLength = length * spec.ratio * (0.82 + rng() * 0.36);
      const childRadius = radii[index]! * spec.shrink * (0.88 + rng() * 0.24);
      grow(rng, spec, points[index]!, child, childLength, childRadius, depth + 1, limbs, sites);
    }
  }

  const crown = (t: number, scale: number): void => {
    sites.push({
      center: add(pointAt(points, t), mul(directionAt(points, Math.round(t * steps)), 0.13)),
      radius: spec.cluster * scale * (0.82 + rng() * 0.36),
      count: Math.round(lerp(spec.leafCount[0], spec.leafCount[1], rng())),
    });
  };
  if (depth === spec.maxDepth) {
    crown(1, 1);
    crown(0.56 + rng() * 0.18, 0.7);
  } else if (depth === spec.maxDepth - 1) {
    crown(0.6 + rng() * 0.22, 0.82);
  }
};

const limbTone = (rng: Rng, spec: Species, points: readonly Vec3[]): string => {
  const axis = directionAt(points, Math.floor(points.length / 2));
  const normal = unit(cross(axis, perpendicular(axis, UP)));
  const shade = 0.22 + lit(normal) * 0.42 + rng() * 0.12;
  return tone(spec.bark, shade);
};

const limbNode = (rng: Rng, spec: Species, limb: Limb): SvgNode => {
  const points = limb.points.map(at);
  const widths = limb.radii.map((radius) => Math.max(1.15, radius * CAM.unit * 2));
  const depth = points[Math.floor(points.length / 2)]!.depth;
  const color = hazed(limbTone(rng, spec, limb.points), depth);
  const shape = el.path({ d: tapered(points, widths), fill: color });
  if (Math.max(...widths) < 5.5) return shape;
  const p = points[Math.floor(points.length / 2)]!;
  const before = points[Math.max(0, Math.floor(points.length / 2) - 1)]!;
  const after = points[Math.min(points.length - 1, Math.floor(points.length / 2) + 1)]!;
  const tangent = { x: after.x - before.x, y: after.y - before.y };
  const normal = { x: -tangent.y, y: tangent.x };
  const side = normal.x * -0.5 + normal.y * -0.9 > 0 ? 1 : -1;
  const shine = el.path({
    d: edge(points, widths, 0.34 * side, 0.15),
    fill: hazed(tone(spec.bark, 0.78 + rng() * 0.16), depth),
    opacity: 0.55,
  });
  void p;
  return el.g({}, [shape, shine]);
};

const leafColor = (spec: Species, rng: Rng, normal: Vec3, height: number, depth: number, below: boolean): string => {
  const face = Math.abs(dot(unit(normal), unit([-0.42, 0.72, 0.55])));
  const shade = clamp(0.24 + face * 0.62 + height * 0.14 - (below ? 0.14 : 0) + (rng() - 0.5) * 0.16);
  return hazed(tone(spec.leaves, shade), depth);
};

const leavesAt = (rng: Rng, spec: Species, site: ClusterSite, base: Vec3): Part[] => {
  const out: Part[] = [];
  const outward = unit([site.center[0] - base[0], 0, site.center[2] - base[2]]);
  for (let i = 0; i < site.count; i++) {
    const theta = rng() * TAU;
    const z = rng() * 2 - 1;
    const reach = Math.sqrt(1 - z * z);
    const shell: Vec3 = [Math.cos(theta) * reach, z, Math.sin(theta) * reach];
    const center = add(site.center, add(mul(shell, site.radius * Math.cbrt(rng())), [0, 0.02, 0]));
    const face = shell[1] > 0.9 ? UP : outward;
    const facing = unit(add(add(mul(shell, 0.9), mul(face, 0.34)), mul(UP, 0.24)));
    const flank = unit(cross(facing, Math.abs(dot(facing, UP)) > 0.94 ? [0, 0, 1] : UP));
    const length = spec.leafLength * (0.74 + rng() * 0.52);
    const width = spec.leafWidth * (0.78 + rng() * 0.44);
    const basePoint = add(center, mul(facing, -length / 2));
    const tip = add(center, add(mul(facing, length / 2), [0, -length * 0.06 * (1 + spec.droop * 8), 0]));
    const waist = add(center, mul(facing, length * 0.07));
    const left = add(waist, mul(flank, width / 2));
    const right = sub(waist, mul(flank, width / 2));
    const normal = cross(facing, flank);
    const height = clamp((center[1] - base[1]) / spec.height);
    const depth = at(center).depth;
    out.push({
      depth,
      node: el.path({
        d: leafPath(at(basePoint), at(tip), at(left), at(right)),
        fill: leafColor(spec, rng, normal, height, depth, center[1] < site.center[1]),
      }),
    });
  }
  return out;
};

const flutter = [
  wiggle({ x: 0.9, y: 0.45, rotate: 1 }, { seed: "leaf-a", rate: 1.2, period: D / 2 }),
  wiggle({ x: 1.2, y: 0.5, rotate: -1.2 }, { seed: "leaf-b", rate: 1, period: D / 2 }),
  wiggle({ x: 0.7, y: 0.35, rotate: 0.8 }, { seed: "leaf-c", rate: 1.4, period: D / 2 }),
] as const;

const clusterAt = (rng: Rng, spec: Species, site: ClusterSite, index: number, base: Vec3): Part => {
  const leaves = leavesAt(rng, spec, site, base);
  leaves.sort((a, b) => a.depth - b.depth);
  const spot = at(site.center);
  const height = clamp((site.center[1] - 0.2) / spec.height);
  const open = T.crown + height * (T.crowned - T.crown - 0.55) + rng() * 0.24;
  const grow = enter({ at: open, over: 0.5 }, { opacity: 0, scale: 0.16 }, ease.pop);
  const node = el.g(
    {
      animation: [grow, flutter[index % flutter.length]!],
      style: { transformBox: "view-box", transformOrigin: `${spot.x}px ${spot.y}px` },
    },
    leaves.map((part) => part.node),
  );
  const depth = leaves.reduce((sum, leaf) => sum + leaf.depth, 0) / Math.max(1, leaves.length);
  return { depth, node };
};

const groundShadow = (base: Vec3, spread: number): Part => {
  const spot = at(base);
  return {
    depth: -1,
    node: el.ellipse({
      cx: spot.x,
      cy: spot.y + 1,
      rx: spread * CAM.unit,
      ry: spread * CAM.unit * Math.sin((CAM.pitch * Math.PI) / 180),
      fill: alpha("#081a1c", 0.22),
    }),
  };
};

const tree = (spec: Species, base: Vec3, seed: number): Stand => {
  const rng = random(seed);
  const limbs: Limb[] = [];
  const sites: ClusterSite[] = [];
  grow(rng, spec, base, spec.lean, spec.trunk, spec.trunkRadius, 0, limbs, sites);

  const shadow = groundShadow(base, spec.id === "oak" ? 2.3 : 1.5);
  const parts: Part[] = [shadow];
  for (const limb of limbs) {
    const mid = limb.points[Math.floor(limb.points.length / 2)]!;
    parts.push({ depth: at(mid).depth, node: limbNode(rng, spec, limb) });
  }
  sites.forEach((site, i) => parts.push(clusterAt(rng, spec, site, seed + i, base)));

  const spot = at(base);
  const life = enter({ at: T.grow, over: 2.9 }, { opacity: 0, scale: 0.04 }, ease.out).at(T.fall).to({ opacity: 0, scale: 0.96 }, 1.9, ease.in);
  const wind = wiggle({ rotate: spec.sway, x: 0.9 }, { seed: `wind-${seed}`, rate: 0.55, period: D });
  const node = el.g(
    {
      animation: [life, wind],
      style: { transformBox: "view-box", transformOrigin: `${spot.x}px ${spot.y}px` },
    },
    [layer(parts)],
  );
  return { node, depth: spot.depth };
};

export const oak = (base: Vec3): Stand => tree(OAK_TREE, base, 71);
export const birch = (base: Vec3): Stand => tree(BIRCH_TREE, base, 173);
export const blossom = (base: Vec3): Stand => tree(BLOSSOM_TREE, base, 281);

/** A fern: curved fronds with paired pinnae, drawn as real leaves in 3D. */
export const fern = (base: Vec3, seed: number): Stand => {
  const rng = random(seed);
  const parts: Part[] = [];
  const fronds = 5 + Math.floor(rng() * 3);
  const start = rng() * TAU;
  for (let f = 0; f < fronds; f++) {
    const azimuth = start + (f / fronds) * TAU + (rng() - 0.5) * 0.3;
    const dir: Vec3 = [Math.cos(azimuth), 0, Math.sin(azimuth)];
    const reach = 1.15 + rng() * 0.6;
    const lift = 0.95 + rng() * 0.5;
    const mid = add(base, add(mul(dir, reach * 0.48), [0, lift * 0.92, 0]));
    const tip = add(base, add(mul(dir, reach), [0, lift * 0.36, 0]));
    const spine = Array.from({ length: 8 }, (_, i) => {
      const t = i / 7;
      return add(add(mul(base, (1 - t) * (1 - t)), mul(mid, 2 * (1 - t) * t)), mul(tip, t * t));
    });
    const spineScreen = spine.map(at);
    const stemColor = hazed(tone(FERN, 0.36 + rng() * 0.1), at(mid).depth);
    parts.push({ depth: at(mid).depth, node: el.path({ d: tapered(spineScreen, spineScreen.map((_, i) => Math.max(0.8, 2.2 * (1 - i / 8)))), fill: stemColor }) });
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 1; i < 7; i++) {
        const t = i / 7;
        const point = pointAt(spine, t);
        const tangent = unit(sub(pointAt(spine, Math.min(1, t + 0.02)), pointAt(spine, Math.max(0, t - 0.02))));
        const across = unit(cross(tangent, UP));
        const facing = unit(add(add(mul(across, side * 0.94), mul(tangent, 0.26)), mul(UP, 0.12)));
        const pinna = (0.17 + 0.22 * (1 - t)) * (0.7 + rng() * 0.5);
        const flank = unit(cross(facing, UP));
        const basePoint = add(point, mul(across, side * 0.02));
        const tipPoint = add(basePoint, mul(facing, pinna));
        const waist = add(basePoint, mul(facing, pinna * 0.52));
        const left = add(waist, mul(flank, pinna * 0.3));
        const right = sub(waist, mul(flank, pinna * 0.3));
        const normal = cross(facing, flank);
        const depth = at(basePoint).depth;
        parts.push({
          depth,
          node: el.path({
            d: leafPath(at(basePoint), at(tipPoint), at(left), at(right)),
            fill: hazed(tone(FERN, clamp(0.3 + lit(normal) * 0.5 + t * 0.16 + rng() * 0.08)), depth),
          }),
        });
      }
    }
  }
  const spot = at(base);
  const growth = enter({ at: T.under + rng() * 2.4, over: 0.75 }, { opacity: 0, scale: 0.1 }, ease.pop).at(T.fall + rng()).to({ opacity: 0, scale: 0.85 }, 1.5, ease.in);
  const wind = flutter[(seed + 1) % flutter.length]!;
  const node = el.g(
    { animation: [growth, wind], style: { transformBox: "view-box", transformOrigin: `${spot.x}px ${spot.y}px` } },
    [layer(parts)],
  );
  return { node, depth: spot.depth };
};

type FlowerKind = "cream" | "blush" | "blue";

const FLOWERS: Record<FlowerKind, { readonly petals: readonly string[]; readonly eye: readonly string[] }> = {
  cream: { petals: CREAM, eye: GOLD },
  blush: { petals: BLUSH, eye: GOLD },
  blue: { petals: PERIWINKLE, eye: GOLD },
};

/** A small stand of flowers, each on its own arcing stem. */
export const flowers = (base: Vec3, seed: number, kind: FlowerKind): Stand => {
  const rng = random(seed);
  const palette = FLOWERS[kind];
  const parts: Part[] = [];
  const count = 3 + Math.floor(rng() * 3);
  const facing = unit([-0.25, 0.86, 0.4]);
  const u = unit(cross(facing, UP));
  const v = unit(cross(facing, u));
  for (let i = 0; i < count; i++) {
    const azimuth = (i / count) * TAU + rng() * 0.8;
    const lean = 0.3 + rng() * 0.32;
    const top = add(base, [Math.cos(azimuth) * lean, 0.95 + rng() * 0.55, Math.sin(azimuth) * lean]);
    const mid = add(add(base, [0, 0.42 + rng() * 0.2, 0]), mul([Math.cos(azimuth), 0, Math.sin(azimuth)], lean * 0.36));
    const stem = Array.from({ length: 6 }, (_, k) => {
      const t = k / 5;
      return add(add(mul(base, (1 - t) * (1 - t)), mul(mid, 2 * (1 - t) * t)), mul(top, t * t));
    });
    const stemScreen = stem.map(at);
    parts.push({
      depth: at(mid).depth,
      node: el.path({ d: smooth(stemScreen), fill: "none", stroke: hazed(tone(GRASS, 0.34 + rng() * 0.1), at(mid).depth), strokeWidth: 2.1, strokeLinecap: "round" }),
    });
    const leafAt = pointAt(stem, 0.45);
    const leafFacing = unit([Math.cos(azimuth + 1.4), 0.18, Math.sin(azimuth + 1.4)]);
    const leafFlank = unit(cross(leafFacing, UP));
    const leafLen = 0.32 + rng() * 0.1;
    parts.push({
      depth: at(leafAt).depth,
      node: el.path({
        d: leafPath(at(leafAt), at(add(leafAt, mul(leafFacing, leafLen))), at(add(add(leafAt, mul(leafFacing, leafLen * 0.55)), mul(leafFlank, leafLen * 0.24))), at(add(add(leafAt, mul(leafFacing, leafLen * 0.55)), mul(leafFlank, -leafLen * 0.24)))),
        fill: hazed(tone(GRASS, 0.48 + rng() * 0.2), at(leafAt).depth),
      }),
    });
    const petals = 6;
    const petalsNode: SvgNode[] = [];
    for (let p = 0; p < petals; p++) {
      const angle = (p / petals) * TAU + rng() * 0.16;
      const out = unit(add(mul(u, Math.cos(angle)), mul(v, Math.sin(angle))));
      const petalLen = 0.14 + rng() * 0.07;
      const petalWidth = petalLen * 0.56;
      const petalFlank = unit(cross(out, facing));
      const petalBase = add(top, mul(facing, 0.01));
      const petalTip = add(petalBase, mul(out, petalLen));
      const waist = add(petalBase, mul(out, petalLen * 0.6));
      petalsNode.push(
        el.path({
          d: leafPath(at(petalBase), at(petalTip), at(add(waist, mul(petalFlank, petalWidth))), at(add(waist, mul(petalFlank, -petalWidth)))),
          fill: hazed(tone(palette.petals, 0.55 + rng() * 0.45), at(top).depth),
        }),
      );
    }
    const spot = at(top);
    petalsNode.push(el.circle({ cx: spot.x, cy: spot.y, r: 2.1, fill: tone(palette.eye, 0.85) }), el.circle({ cx: spot.x - 0.5, cy: spot.y - 0.6, r: 0.7, fill: "#fff6d8" }));
    const bloom = enter({ at: T.bloom + 0.25 + i * 0.22 + rng() * 0.2, over: 0.55 }, { opacity: 0, scale: 0.1 }, ease.pop);
    parts.push({
      depth: at(top).depth + 0.02,
      node: el.g({ animation: bloom, style: { transformBox: "view-box", transformOrigin: `${spot.x}px ${spot.y}px` } }, petalsNode),
    });
  }
  const spot = at(base);
  const growth = enter({ at: T.bloom + rng() * 1.1, over: 0.7 }, { opacity: 0, scale: 0.1 }, ease.pop).at(T.fall + 1).to({ opacity: 0, scale: 0.8 }, 1.4, ease.in);
  const wind = flutter[seed % flutter.length]!;
  const node = el.g(
    { animation: [growth, wind], style: { transformBox: "view-box", transformOrigin: `${spot.x}px ${spot.y}px` } },
    [layer(parts)],
  );
  return { node, depth: spot.depth };
};

/** A tuft of grass blades: one ribbon per blade, two tones per tuft. */
export const tuft = (base: Vec3, seed: number): Stand => {
  const rng = random(seed);
  const blades = 6 + Math.floor(rng() * 5);
  const dark: string[] = [];
  const light: string[] = [];
  for (let i = 0; i < blades; i++) {
    const azimuth = rng() * TAU;
    const height = 0.42 + rng() * 0.62;
    const bendAmount = 0.12 + rng() * 0.36;
    const tip = add(base, [Math.cos(azimuth) * bendAmount, height, Math.sin(azimuth) * bendAmount]);
    const mid = add(base, [Math.cos(azimuth) * bendAmount * 2.1, height * 0.58, Math.sin(azimuth) * bendAmount * 2.1]);
    const points: P2[] = [];
    const widths: number[] = [];
    for (let k = 0; k < 5; k++) {
      const t = k / 4;
      points.push(at(add(add(mul(base, (1 - t) * (1 - t)), mul(mid, 2 * (1 - t) * t)), mul(tip, t * t))));
      widths.push(Math.max(0.35, (2.4 + rng() * 1.6) * (1 - t * 0.86)));
    }
    const bright = i === 0 ? false : i === 1 ? true : rng() < 0.44;
    (bright ? light : dark).push(tapered(points, widths));
  }
  const spot = at(base);
  const node = el.g(
    {
      animation: [
        enter({ at: T.under + rng() * 3, over: 0.6 }, { opacity: 0, scale: 0.2 }, ease.pop).at(T.fall + 0.4).to({ opacity: 0, scale: 0.8 }, 1.2, ease.in),
        flutter[seed % flutter.length]!,
      ],
      style: { transformBox: "view-box", transformOrigin: `${spot.x}px ${spot.y}px` },
    },
    [
      el.path({ d: dark.join(""), fill: hazed(tone(GRASS, 0.28 + rng() * 0.1), spot.depth) }),
      el.path({ d: light.join(""), fill: hazed(tone(GRASS, 0.6 + rng() * 0.18), spot.depth) }),
    ],
  );
  return { node, depth: spot.depth };
};

/** A few flat, faceted stones resting on the moss. */
export const stones = (base: Vec3, seed: number): Stand => {
  const rng = random(seed);
  const parts: Part[] = [];
  const count = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < count; i++) {
    const center = add(base, [(rng() - 0.5) * 0.7, 0, (rng() - 0.5) * 0.7]);
    const radius = 0.16 + rng() * 0.26;
    const lift = 0.04 + rng() * 0.12;
    const ring = 7;
    const top = Array.from({ length: ring }, (_, k) => {
      const angle = (k / ring) * TAU;
      return add(center, [Math.cos(angle) * radius * 0.72, lift, Math.sin(angle) * radius * 0.72]);
    });
    const bottom = Array.from({ length: ring }, (_, k) => {
      const angle = (k / ring) * TAU;
      return add(center, [Math.cos(angle) * radius, 0.005, Math.sin(angle) * radius]);
    });
    const topScreen = top.map(at);
    const bottomScreen = bottom.map(at);
    for (let k = 0; k < ring; k++) {
      const j = (k + 1) % ring;
      const quad = [bottomScreen[k]!, bottomScreen[j]!, topScreen[j]!, topScreen[k]!];
      const face = unit(cross(sub(top[j]!, top[k]!), sub(top[k]!, bottom[k]!)));
      const depth = (at(top[k]!).depth + at(bottom[j]!).depth) / 2;
      parts.push({ depth, node: el.path({ d: `M${quad.map((p) => `${p.x} ${p.y}`).join("L")}Z`, fill: hazed(tone(STONE, 0.18 + lit(face) * 0.5 + rng() * 0.1), depth) }) });
    }
    parts.push({ depth: at(center).depth + 0.5, node: el.path({ d: smooth(topScreen, true), fill: hazed(tone(STONE, 0.55 + rng() * 0.2), at(center).depth) }) });
  }
  const spot = at(base);
  return {
    node: el.g({ animation: enter({ at: T.under, over: 1 }, { opacity: 0, scale: 0.4 }, ease.pop) }, [layer(parts)]),
    depth: spot.depth,
  };
};

/** The seed that starts the story: a warm bead that sinks into the moss. */
export const seed = (base: Vec3): Stand => {
  const spot = at(base);
  const node = el.g(
    { animation: enter({ at: T.seed, over: 0.5 }, { opacity: 0, scale: 0.2 }, ease.pop).at(T.grow + 0.3).to({ opacity: 0, scale: 1.8 }, 0.7, ease.in) },
    [
      el.circle({ cx: spot.x, cy: spot.y - 2, r: 15, fill: alpha("#ffefb0", 0.16) }),
      el.circle({ cx: spot.x, cy: spot.y - 2, r: 4.2, fill: "#ffe8a8" }),
      el.circle({ cx: spot.x - 1, cy: spot.y - 3.4, r: 1.5, fill: "#fffbe6" }),
    ],
  );
  return { node, depth: spot.depth + 3 };
};

/** Scattered fallen blossom petals, lying flat on the moss. */
export const fallenPetals = (base: Vec3, seed: number): Stand => {
  const rng = random(seed);
  const parts: Part[] = [];
  for (let i = 0; i < 14; i++) {
    const angle = rng() * TAU;
    const radius = 0.4 + rng() * 2.3;
    const center = add(base, [Math.cos(angle) * radius, 0.012 + rng() * 0.01, Math.sin(angle) * radius]);
    const facing = unit([rng() - 0.5, 0.02, rng() - 0.5]);
    const flank = unit(cross(facing, UP));
    const size = 0.09 + rng() * 0.06;
    parts.push({
      depth: at(center).depth,
      node: el.path({
        d: leafPath(at(add(center, mul(facing, -size))), at(add(center, mul(facing, size))), at(add(add(center, mul(flank, size * 0.52)), mul(facing, size * 0.1))), at(add(add(center, mul(flank, -size * 0.52)), mul(facing, size * 0.1)))),
        fill: mix(tone(BLOSSOM, 0.5 + rng() * 0.4), "#f7d4c6", 0.3),
        opacity: 0.75,
      }),
    });
  }
  const spot = at(base);
  const life = enter({ at: T.grow + 0.8, over: 2.2 }).at(T.fall).to({ opacity: 0 }, 1.8, ease.in);
  return { node: el.g({ animation: life }, [layer(parts)]), depth: -1e5 + spot.depth };
};
