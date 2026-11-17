import type { Point } from "./layout/box";

export const simplify = (points: readonly Point[], tolerance: number): Point[] => {
  if (points.length < 3 || tolerance <= 0) return [...points];

  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const todo: [number, number][] = [[0, points.length - 1]];

  for (let range = todo.pop(); range; range = todo.pop()) {
    const [first, last] = range;
    const [a, b] = [points[first]!, points[last]!];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    let [far, worst] = [-1, tolerance];

    for (let i = first + 1; i < last; i++) {
      const p = points[i]!;

      const miss =
        length === 0
          ? Math.hypot(p.x - a.x, p.y - a.y)
          : Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / length;

      if (miss > worst) [far, worst] = [i, miss];
    }

    if (far < 0) continue;
    keep[far] = 1;
    todo.push([first, far], [far, last]);
  }

  return points.filter((_, i) => keep[i]);
};
