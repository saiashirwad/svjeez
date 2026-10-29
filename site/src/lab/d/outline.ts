export type Point = readonly [x: number, y: number];

/** A closed drawing centered on its mean, y up, its longer side 2 long: the units the scene measures its circles in. */
export type Outline = readonly Point[];

export const outlineOf = (points: readonly Point[]): Outline => {
  const n = points.length;
  const mx = points.reduce((s, [x]) => s + x, 0) / n;
  const my = points.reduce((s, [, y]) => s + y, 0) / n;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);

  const half =
    Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 || 1;

  return points.map(([x, y]) => [(x - mx) / half, -(y - my) / half]);
};
