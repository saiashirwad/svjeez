import { SceneError } from "./scene-error";
import { num } from "./format";
import { segments } from "./pathTokens";

export type PathData = `M${string}` | `m${string}`;

type Vec = readonly [number, number];

type Cubic = readonly [Vec, Vec, Vec];

export interface Ring {
  readonly start: Vec;
  readonly curves: readonly Cubic[];
  readonly closed: boolean;
}

const ARITY = new Map([
  ["M", 2],
  ["L", 2],
  ["H", 1],
  ["V", 1],
  ["C", 6],
  ["S", 4],
  ["Q", 4],
  ["T", 2],
  ["A", 7],
  ["Z", 0],
]);

const lerp = (a: Vec, b: Vec, u: number): Vec => [
  a[0] + (b[0] - a[0]) * u,
  a[1] + (b[1] - a[1]) * u,
];

const line = (a: Vec, b: Vec): Cubic => [lerp(a, b, 1 / 3), lerp(a, b, 2 / 3), b];

const arc = (
  from: Vec,
  rx: number,
  ry: number,
  angle: number,
  large: boolean,
  sweep: boolean,
  to: Vec,
): Cubic[] => {
  if (rx === 0 || ry === 0 || (from[0] === to[0] && from[1] === to[1])) return [line(from, to)];
  const phi = (angle * Math.PI) / 180;
  const [cos, sin] = [Math.cos(phi), Math.sin(phi)];
  const dx = (from[0] - to[0]) / 2;
  const dy = (from[1] - to[1]) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  let [a, b] = [Math.abs(rx), Math.abs(ry)];
  const grow = (x1 * x1) / (a * a) + (y1 * y1) / (b * b);

  if (grow > 1) [a, b] = [a * Math.sqrt(grow), b * Math.sqrt(grow)];
  const num2 = a * a * b * b - a * a * y1 * y1 - b * b * x1 * x1;
  const den = a * a * y1 * y1 + b * b * x1 * x1;
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num2 / den));
  const cx1 = (k * a * y1) / b;
  const cy1 = (-k * b * x1) / a;
  const cx = cos * cx1 - sin * cy1 + (from[0] + to[0]) / 2;
  const cy = sin * cx1 + cos * cy1 + (from[1] + to[1]) / 2;

  const theta = (ux: number, uy: number, vx: number, vy: number) =>
    Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);

  const start = theta(1, 0, (x1 - cx1) / a, (y1 - cy1) / b);
  let delta = theta((x1 - cx1) / a, (y1 - cy1) / b, (-x1 - cx1) / a, (-y1 - cy1) / b);

  if (!sweep && delta > 0) delta -= 2 * Math.PI;

  if (sweep && delta < 0) delta += 2 * Math.PI;
  const pieces = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2)));
  const step = delta / pieces;
  const t = (4 / 3) * Math.tan(step / 4);

  const at = (u: number): Vec => [
    cx + a * Math.cos(u) * cos - b * Math.sin(u) * sin,
    cy + a * Math.cos(u) * sin + b * Math.sin(u) * cos,
  ];

  const tangent = (u: number): Vec => [
    -a * Math.sin(u) * cos - b * Math.cos(u) * sin,
    -a * Math.sin(u) * sin + b * Math.cos(u) * cos,
  ];

  return Array.from({ length: pieces }, (_, i): Cubic => {
    const [u0, u1] = [start + i * step, start + (i + 1) * step];
    const [p0, p1] = [at(u0), at(u1)];
    const [d0, d1] = [tangent(u0), tangent(u1)];

    return [
      [p0[0] + t * d0[0], p0[1] + t * d0[1]],
      [p1[0] - t * d1[0], p1[1] - t * d1[1]],
      i === pieces - 1 ? to : p1,
    ];
  });
};

const parse = (d: string): Ring[] => {
  const rings: Ring[] = [];
  let curves: Cubic[] = [];
  let start: Vec = [0, 0];
  let pen: Vec = [0, 0];
  let control: Vec | undefined;
  let quad: Vec | undefined;
  let open = false;

  const finish = (closed: boolean) => {
    if (open) rings.push({ start, curves, closed });
    curves = [];
    open = false;
  };

  for (const { letter, numbers: n } of segments(d)) {
    if (letter === "") continue;
    const upper = letter.toUpperCase();
    const arity = ARITY.get(upper);

    if (arity === undefined)
      throw new SceneError(`matchPaths() cannot read the "${letter}" command in "${d}".`);
    const relative = letter !== upper;

    if (upper === "Z") {
      if (open && (pen[0] !== start[0] || pen[1] !== start[1])) curves.push(line(pen, start));
      pen = start;
      finish(true);
      control = quad = undefined;
      continue;
    }

    if (n.length === 0 || n.length % arity !== 0)
      throw new SceneError(`matchPaths() found ${n.length} numbers after "${letter}" in "${d}".`);

    for (let i = 0; i < n.length; i += arity) {
      const v = n.slice(i, i + arity);
      const abs = (x: number, y: number): Vec => (relative ? [pen[0] + x, pen[1] + y] : [x, y]);
      let next: Vec;
      let lastControl: Vec | undefined;
      let lastQuad: Vec | undefined;

      if (upper === "M" && i === 0) {
        finish(false);
        start = pen = abs(v[0]!, v[1]!);
        open = true;
        control = quad = undefined;
        continue;
      }

      if (!open) {
        start = pen;
        open = true;
      }

      switch (upper) {
        case "M":
        case "L":
        case "T":
          next = abs(v[0]!, v[1]!);

          if (upper === "T") {
            const q: Vec = quad ? [2 * pen[0] - quad[0], 2 * pen[1] - quad[1]] : pen;
            curves.push([lerp(pen, q, 2 / 3), lerp(next, q, 2 / 3), next]);
            lastQuad = q;
          } else curves.push(line(pen, next));
          break;
        case "H":
          next = [relative ? pen[0] + v[0]! : v[0]!, pen[1]];
          curves.push(line(pen, next));
          break;
        case "V":
          next = [pen[0], relative ? pen[1] + v[0]! : v[0]!];
          curves.push(line(pen, next));
          break;
        case "C": {
          const c1 = abs(v[0]!, v[1]!);
          const c2 = abs(v[2]!, v[3]!);
          next = abs(v[4]!, v[5]!);
          curves.push([c1, c2, next]);
          lastControl = c2;
          break;
        }

        case "S": {
          const c1: Vec = control ? [2 * pen[0] - control[0], 2 * pen[1] - control[1]] : pen;
          const c2 = abs(v[0]!, v[1]!);
          next = abs(v[2]!, v[3]!);
          curves.push([c1, c2, next]);
          lastControl = c2;
          break;
        }

        case "Q": {
          const q = abs(v[0]!, v[1]!);
          next = abs(v[2]!, v[3]!);
          curves.push([lerp(pen, q, 2 / 3), lerp(next, q, 2 / 3), next]);
          lastQuad = q;
          break;
        }

        default:
          next = abs(v[5]!, v[6]!);
          curves.push(...arc(pen, v[0]!, v[1]!, v[2]!, v[3] !== 0, v[4] !== 0, next));
      }

      pen = next;
      control = lastControl;
      quad = lastQuad;
    }
  }

  finish(false);

  return rings;
};

export const ringsOf = (d: string): Ring[] => parse(d);

const halve = (from: Vec, [c1, c2, to]: Cubic): [Cubic, Cubic] => {
  const a = lerp(from, c1, 0.5);
  const b = lerp(c1, c2, 0.5);
  const c = lerp(c2, to, 0.5);
  const ab = lerp(a, b, 0.5);
  const bc = lerp(b, c, 0.5);
  const mid = lerp(ab, bc, 0.5);

  return [
    [a, ab, mid],
    [bc, c, to],
  ];
};

const chord = (from: Vec, curve: Cubic) => Math.hypot(curve[2][0] - from[0], curve[2][1] - from[1]);

const split = (ring: Ring, count: number): Ring => {
  const curves = ring.curves.length > 0 ? [...ring.curves] : [line(ring.start, ring.start)];

  while (curves.length < count) {
    let longest = 0;
    let best = -1;

    curves.forEach((curve, i) => {
      const length = chord(i === 0 ? ring.start : curves[i - 1]![2], curve);

      if (length > best) [best, longest] = [length, i];
    });
    const from = longest === 0 ? ring.start : curves[longest - 1]![2];
    curves.splice(longest, 1, ...halve(from, curves[longest]!));
  }

  return { ...ring, curves };
};

const rotate = (ring: Ring, by: number): Ring => {
  if (by === 0) return ring;
  const curves = [...ring.curves.slice(by), ...ring.curves.slice(0, by)];

  return { ...ring, start: ring.curves[by - 1]![2], curves };
};

const ends = (ring: Ring): Vec[] => ring.curves.map((curve) => curve[2]);

const align = (ring: Ring, target: Ring): Ring => {
  if (!ring.closed || !target.closed) return ring;
  const [a, b] = [ends(ring), ends(target)];
  let best = 0;
  let error = Infinity;

  for (let by = 0; by < a.length; by++) {
    let sum = 0;

    for (let i = 0; i < a.length && sum < error; i++) {
      const p = a[(i + by) % a.length]!;
      const q = b[i]!;
      sum += (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
    }

    if (sum < error) [error, best] = [sum, by];
  }

  return rotate(ring, best);
};

const middle = (ring: Ring): Vec => {
  const points = [ring.start, ...ends(ring)];
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);

  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
};

export const matchRings = (parsed: readonly (readonly Ring[])[]): Ring[][] => {
  const count = Math.max(...parsed.map((rings) => rings.length));

  const filled = parsed.map((rings, v) =>
    Array.from({ length: count }, (_, r): Ring => {
      const own = rings[r];

      if (own) return own;

      const donor = [...parsed.slice(0, v).reverse(), ...parsed.slice(v + 1)].find(
        (other) => other[r],
      );

      const at = middle(donor![r]!);

      return { start: at, curves: [], closed: donor![r]!.closed };
    }),
  );

  const sizes = Array.from({ length: count }, (_, r) =>
    Math.max(1, ...filled.map((rings) => rings[r]!.curves.length)),
  );

  const even = filled.map((rings) => rings.map((ring, r) => split(ring, sizes[r]!)));

  for (let v = 1; v < even.length; v++)
    even[v] = even[v]!.map((ring, r) => align(ring, even[v - 1]![r]!));

  return even;
};

export const blendPaths = (a: string, b: string, amount: number): PathData => {
  const to = segments(b).flatMap((s) => s.numbers);
  let k = 0;

  // SAFETY: every command letter of `a` is kept, so the result is path data like `a`.
  return segments(a)
    .map(
      ({ letter, numbers: n }) => letter + n.map((x) => num(x + (to[k++]! - x) * amount)).join(" "),
    )
    .join("") as PathData;
};

export const commandsOf = (d: string): string =>
  segments(d)
    .map((s) => s.letter + "#".repeat(s.numbers.length))
    .join("");
