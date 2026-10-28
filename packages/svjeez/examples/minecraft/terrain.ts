import { GRID, random } from "./kit";

export interface Column {
  readonly x: number;
  readonly z: number;
  readonly top: number;
  readonly depth: number;
  readonly kind: "grass" | "sand" | "stone" | "lake";
}

const rand = random(11);
const lattice = (): readonly number[] => Array.from({ length: 25 }, rand);
const [heights, hangs] = [lattice(), lattice()];

const smooth = (t: number) => t * t * (3 - 2 * t);

const noise = (field: readonly number[], x: number, z: number): number => {
  const [u, v] = [(x / GRID) * 4, (z / GRID) * 4];
  const [i, j] = [Math.floor(u), Math.floor(v)];
  const [fu, fv] = [smooth(u - i), smooth(v - j)];
  const at = (a: number, b: number) => field[Math.min(4, b) * 5 + Math.min(4, a)]!;
  const top = at(i, j) + (at(i + 1, j) - at(i, j)) * fu;
  const bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * fu;

  return top + (bottom - top) * fv;
};

export const LAKE = { x: 3.4, z: 9.4, radius: 2.2 } as const;
export const HILL = { x: 10, z: 3, radius: 2.8 } as const;
export const PLOT = { x: 5, z: 3, size: 5, top: 3 } as const;

const reach = (x: number, z: number, around: { readonly x: number; readonly z: number }) =>
  Math.hypot(x - around.x, z - around.z);

const columnAt = (x: number, z: number): Column | undefined => {
  const middle = GRID / 2 - 0.5;
  const out = Math.hypot(x - middle, z - middle) / (GRID / 2 + 0.2);

  if (out + 0.3 * (noise(hangs, x, z) - 0.5) >= 1) return;
  const lake = reach(x, z, LAKE) < LAKE.radius;
  const hill = Math.max(0, 1 - reach(x, z, HILL) / HILL.radius);
  const inPlot = x >= PLOT.x && x < PLOT.x + PLOT.size && z >= PLOT.z && z < PLOT.z + PLOT.size;
  const rolling = Math.round(2.7 + (noise(heights, x, z) - 0.45) * 2.4 * (1.1 - out));

  const top = lake
    ? 2
    : inPlot
      ? PLOT.top
      : Math.min(4, Math.max(out > 0.75 ? 2 : 3, rolling + Math.round(hill * 2.2)));

  const depth = Math.max(
    0,
    Math.round(3 * Math.max(0, 1 - out) ** 1.2 + (noise(hangs, z, x) - 0.5)),
  );

  const kind = lake
    ? "lake"
    : top >= 4
      ? "stone"
      : top === 2 || reach(x, z, LAKE) < LAKE.radius + 1.2
        ? "sand"
        : "grass";

  return { x, z, top, depth, kind };
};

export const COLUMNS: readonly Column[] = Array.from({ length: GRID * GRID }, (_, i) =>
  columnAt(i % GRID, Math.floor(i / GRID)),
).filter((column): column is Column => column !== undefined);

const byCell = new Map(COLUMNS.map((column) => [`${column.x},${column.z}`, column]));

export const columnOf = (x: number, z: number): Column | undefined => byCell.get(`${x},${z}`);
