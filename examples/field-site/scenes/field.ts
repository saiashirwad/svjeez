import type { Vec } from "svjeez";

/** The scene's size, in its own units. */
export const WIDTH = 1600;
export const HEIGHT = 1000;

/** One unit of length, u, in scene units: the scale bar's length, and the r in the field's formulas. */
export const UNIT = 100;

/** Where a charge or the probe can go: progress 0 to 1 on its clocks runs from one edge of this box to the other. */
export const LEFT = 80;
export const RIGHT = 1520;
export const TOP = 80;
export const BOTTOM = 920;

export interface Charge {
  /** Its hit name and the prefix of its two clocks. */
  readonly name: "a" | "b" | "c" | "d";
  /** Its charge, in q. */
  readonly q: number;
  /** Where it starts. */
  readonly at: Vec;
}

export const CHARGES: readonly Charge[] = [
  { name: "a", q: 2, at: [520, 420] },
  { name: "b", q: -2, at: [1080, 560] },
  { name: "c", q: 1, at: [800, 760] },
  { name: "d", q: -1, at: [1170, 260] },
];

export const PROBE: Vec = [330, 700];

/** Equipotentials sit this far apart in potential. */
export const STEP = 0.5;

export interface Sample {
  /** The field, in q per u, x right and y down. */
  readonly e: Vec;
  /** The potential, 0 one unit from a lone charge. */
  readonly phi: number;
}

/**
 * The field and potential of line charges seen end on, at `point`: each pushes with q / r along the line from it and
 * adds -q ln r to the potential. The shader works the same sums per pixel.
 */
export const sample = (point: Vec, charges: readonly Pick<Charge, "q" | "at">[]): Sample => {
  let [ex, ey, phi] = [0, 0, 0];

  for (const { q, at } of charges) {
    const dx = (point[0] - at[0]) / UNIT;
    const dy = (point[1] - at[1]) / UNIT;
    const square = Math.max(dx * dx + dy * dy, 0.0004);

    ex += (q * dx) / square;
    ey += (q * dy) / square;
    phi -= q * 0.5 * Math.log(square);
  }

  return { e: [ex, ey], phi };
};

const key = ([x, y]: Vec): string => `${Math.round(x * 10)},${Math.round(y * 10)}`;

/** Joins loose segments end to end into lines. */
const join = (segments: readonly (readonly [Vec, Vec])[]): Vec[][] => {
  const ends = new Map<string, number[]>();
  const used = new Set<number>();

  segments.forEach(([a, b], index) => {
    for (const end of [a, b]) ends.set(key(end), [...(ends.get(key(end)) ?? []), index]);
  });

  const next = (point: Vec): readonly [Vec, Vec] | undefined => {
    const index = ends.get(key(point))?.find((each) => !used.has(each));

    if (index === undefined) return undefined;
    used.add(index);
    const [a, b] = segments[index]!;

    return key(a) === key(point) ? [a, b] : [b, a];
  };

  const lines: Vec[][] = [];

  segments.forEach(([a, b], index) => {
    if (used.has(index)) return;
    used.add(index);
    const line: Vec[] = [a, b];

    for (let step = next(b); step; step = next(step[1])) line.push(step[1]);

    for (let step = next(a); step; step = next(step[1])) line.unshift(step[1]);
    lines.push(line);
  });

  return lines;
};

/** The equipotential where the potential is `level`, as lines, by marching squares over a grid `cell` units apart, kept 2 units inside the edges. */
export const equipotential = (level: number, cell: number): Vec[][] => {
  const columns = Math.floor((WIDTH - 4) / cell) + 1;
  const rows = Math.floor((HEIGHT - 4) / cell) + 1;
  const point = (column: number, row: number): Vec => [2 + column * cell, 2 + row * cell];

  const grid = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => sample(point(column, row), CHARGES).phi),
  );

  const segments: [Vec, Vec][] = [];

  const cross = (a: Vec, va: number, b: Vec, vb: number): Vec => {
    const t = (level - va) / (vb - va);

    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };

  for (let row = 0; row < rows - 1; row++) {
    for (let column = 0; column < columns - 1; column++) {
      const corners = [
        point(column, row),
        point(column + 1, row),
        point(column + 1, row + 1),
        point(column, row + 1),
      ];

      const values = [
        grid[row]![column]!,
        grid[row]![column + 1]!,
        grid[row + 1]![column + 1]!,
        grid[row + 1]![column]!,
      ];

      const hits = [0, 1, 2, 3].flatMap((edge): Vec[] => {
        const [i, j] = [edge, (edge + 1) % 4];
        const [vi, vj] = [values[i]!, values[j]!];

        return vi < level !== vj < level ? [cross(corners[i]!, vi, corners[j]!, vj)] : [];
      });

      if (hits.length === 2) segments.push([hits[0]!, hits[1]!]);

      if (hits.length === 4) segments.push([hits[0]!, hits[1]!], [hits[2]!, hits[3]!]);
    }
  }

  return join(segments);
};
