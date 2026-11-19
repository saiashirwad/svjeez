import { ease, type Curve } from "svjeez";

export type Bezier = readonly [x1: number, y1: number, x2: number, y2: number];

/** A CSS timing function as it is drawn: a line, a cubic, or a staircase given by its level in each of its equal intervals. */
export type Easing =
  | { readonly kind: "linear" }
  | { readonly kind: "bezier"; readonly points: Bezier }
  | { readonly kind: "steps"; readonly levels: readonly number[] };

const LINEAR: Easing = { kind: "linear" };

const bezier = (...points: Bezier): Easing => ({ kind: "bezier", points });

const NAMED = new Map<string, Easing>([
  ["linear", LINEAR],
  ["ease", bezier(0.25, 0.1, 0.25, 1)],
  ["ease-in", bezier(0.42, 0, 1, 1)],
  ["ease-out", bezier(0, 0, 0.58, 1)],
  ["ease-in-out", bezier(0.42, 0, 0.58, 1)],
]);

const stepsOf = (count: number, jump: string): Easing | undefined => {
  const at = (k: number): number =>
    jump === "jump-start" || jump === "start"
      ? (k + 1) / count
      : jump === "jump-none"
        ? k / (count - 1)
        : jump === "jump-both"
          ? (k + 1) / (count + 1)
          : k / count;

  if (!Number.isInteger(count) || count < 1 || (jump === "jump-none" && count < 2))
    return undefined;

  return { kind: "steps", levels: Array.from({ length: count }, (_, k) => at(k)) };
};

/** A CSS `<easing-function>` as written in a computed keyframe, or undefined for one that is not drawn (`linear(...)`). */
export const parseEasing = (css: string | undefined): Easing | undefined => {
  const text = (css ?? "linear").trim();
  const named = NAMED.get(text);

  if (named) return named;

  if (text === "step-start") return stepsOf(1, "start");

  if (text === "step-end") return stepsOf(1, "end");

  const call = /^([\w-]+)\((.*)\)$/.exec(text);
  const args = call?.[2]?.split(",").map((part) => part.trim()) ?? [];

  if (call?.[1] === "cubic-bezier" && args.length === 4) {
    const [x1 = NaN, y1 = NaN, x2 = NaN, y2 = NaN] = args.map(Number);

    return [x1, y1, x2, y2].every(Number.isFinite) && x1 >= 0 && x1 <= 1 && x2 >= 0 && x2 <= 1
      ? { kind: "bezier", points: [x1, y1, x2, y2] }
      : undefined;
  }

  if (call?.[1] === "steps" && (args.length === 1 || args.length === 2))
    return stepsOf(Number(args[0]), args[1] ?? "end");

  return undefined;
};

const cubic = (a: number, b: number, u: number): number =>
  3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3;

/** The parameter of the cubic whose x is `x`. */
const paramOf = ([x1, , x2]: Bezier, x: number): number => {
  let [lo, hi] = [0, 1];

  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;

    if (cubic(x1, x2, mid) < x) lo = mid;
    else hi = mid;
  }

  return (lo + hi) / 2;
};

/** The output of an easing at `progress`, 0 to 1. */
export const easedAt = (easing: Easing, progress: number): number => {
  const x = Math.min(1, Math.max(0, progress));

  switch (easing.kind) {
    case "linear":
      return x;
    case "bezier":
      return cubic(easing.points[1], easing.points[3], paramOf(easing.points, x));
    case "steps":
      return x >= 1 ? 1 : easing.levels[Math.floor(x * easing.levels.length)]!;
  }
};

/** The easing for the same motion played backwards: the one that runs a piece from its end to its start. */
export const reversed = (easing: Easing): Easing => {
  switch (easing.kind) {
    case "linear":
      return easing;
    case "bezier": {
      const [x1, y1, x2, y2] = easing.points;

      return bezier(1 - x2, 1 - y2, 1 - x1, 1 - y1);
    }

    case "steps":
      return { kind: "steps", levels: easing.levels.map((_, j, all) => 1 - all.at(-1 - j)!) };
  }
};

type Point = readonly [number, number];

const lerp = (a: Point, b: Point, u: number): Point => [
  a[0] + (b[0] - a[0]) * u,
  a[1] + (b[1] - a[1]) * u,
];

/** The two halves of a cubic cut at parameter `u`, by de Casteljau. */
const cut = (p: readonly [Point, Point, Point, Point], u: number) => {
  const [a, b, c, d] = p;
  const [ab, bc, cd] = [lerp(a, b, u), lerp(b, c, u), lerp(c, d, u)];
  const [abc, bcd] = [lerp(ab, bc, u), lerp(bc, cd, u)];
  const mid = lerp(abc, bcd, u);

  return [
    [a, ab, abc, mid],
    [mid, bcd, cd, d],
  ] as const;
};

/** The part of a bezier easing between two progresses, stretched back to a whole one. Steps are handled by the caller. */
export const windowOf = (easing: Easing, from: number, to: number): Easing => {
  if (easing.kind !== "bezier" || (from <= 1e-9 && to >= 1 - 1e-9)) return easing;

  const [x1, y1, x2, y2] = easing.points;

  const whole: readonly [Point, Point, Point, Point] = [
    [0, 0],
    [x1, y1],
    [x2, y2],
    [1, 1],
  ];

  const [u0, u1] = [paramOf(easing.points, from), paramOf(easing.points, to)];
  const right = u0 <= 1e-9 ? whole : cut(whole, u0)[1];
  const part = u1 >= 1 - 1e-9 ? right : cut(right, (u1 - u0) / (1 - u0))[0];
  const [start, a, b, end] = part;
  const [dx, dy] = [end[0] - start[0], end[1] - start[1]];

  if (dx < 1e-9 || Math.abs(dy) < 1e-9) return LINEAR;

  const unit = (v: number): number => Math.min(1, Math.max(0, v));
  const map = ([x, y]: Point): Point => [unit((x - start[0]) / dx), (y - start[1]) / dy];
  const [p1, p2] = [map(a), map(b)];

  return { kind: "bezier", points: [p1[0], p1[1], p2[0], p2[1]] };
};

/** The core curve that draws a linear or bezier easing. */
export const curveOf = (easing: Easing): Curve =>
  easing.kind === "bezier" ? ease.bezier(...easing.points) : ease.linear;
