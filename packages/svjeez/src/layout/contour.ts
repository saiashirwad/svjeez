import type { Point } from "./box";

/** One level line, in the grid's own units: `x` runs over columns and `y` over rows. */
export interface Polyline {
  readonly points: readonly Point[];
  /** The last point joins the first, so the line is not repeated at its end. */
  readonly closed: boolean;
}

type Segment = readonly [number, number];

/**
 * The lines where a grid of samples crosses `level`, by marching squares. `values` is row-major, `cols * rows`
 * samples on a unit lattice. Samples at or above `level` count as inside. A NaN sample leaves its cells empty.
 * Segments are joined at the edges they share, so a curve comes back as one polyline, closed when it loops.
 */
export function marchingSquares(
  values: ArrayLike<number>,
  cols: number,
  rows: number,
  level: number,
): Polyline[] {
  const at = (i: number, j: number): number => values[j * cols + i]!;
  // Edge ids: 2k is the edge from sample k to its right neighbour, 2k + 1 the edge down to the next row.
  const across = (i: number, j: number): number => 2 * (j * cols + i);
  const down = (i: number, j: number): number => 2 * (j * cols + i) + 1;
  const segments: Segment[] = [];

  for (let j = 0; j + 1 < rows; j++) {
    for (let i = 0; i + 1 < cols; i++) {
      const [tl, tr, br, bl] = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];

      if (Number.isNaN(tl + tr + br + bl)) continue;

      const top = across(i, j);
      const bottom = across(i, j + 1);
      const left = down(i, j);
      const right = down(i + 1, j);
      const mask = +(tl >= level) * 8 + +(tr >= level) * 4 + +(br >= level) * 2 + +(bl >= level);
      const centerIn = (tl + tr + br + bl) / 4 >= level;

      const found: Segment[] = (() => {
        switch (mask) {
          case 1:
          case 14:
            return [[left, bottom]];
          case 2:
          case 13:
            return [[bottom, right]];
          case 3:
          case 12:
            return [[left, right]];
          case 4:
          case 11:
            return [[top, right]];
          case 5:
            return centerIn
              ? [
                  [left, top],
                  [bottom, right],
                ]
              : [
                  [top, right],
                  [left, bottom],
                ];
          case 6:
          case 9:
            return [[top, bottom]];
          case 7:
          case 8:
            return [[left, top]];
          case 10:
            return centerIn
              ? [
                  [top, right],
                  [left, bottom],
                ]
              : [
                  [left, top],
                  [bottom, right],
                ];
          default:
            return [];
        }
      })();

      segments.push(...found);
    }
  }

  const crossing = (edge: number): Point => {
    const k = edge >> 1;
    const [i, j] = [k % cols, Math.floor(k / cols)];
    const from = values[k]!;
    const horizontal = (edge & 1) === 0;
    const to = horizontal ? at(i + 1, j) : at(i, j + 1);
    const t = (level - from) / (to - from);

    return horizontal ? { x: i + t, y: j } : { x: i, y: j + t };
  };

  const meeting = new Map<number, number[]>();

  segments.forEach(([a, b], s) => {
    for (const edge of [a, b]) meeting.set(edge, [...(meeting.get(edge) ?? []), s]);
  });

  const used = new Set<number>();

  /** Segments joined end to end from `edge`, as the edges they pass through. */
  const follow = (edge: number): number[] => {
    const out: number[] = [];
    let current = edge;

    for (;;) {
      const next = meeting.get(current)!.find((n) => !used.has(n));

      if (next === undefined) return out;
      used.add(next);
      const [a, b] = segments[next]!;
      current = a === current ? b : a;
      out.push(current);
    }
  };

  const lines: Polyline[] = [];

  segments.forEach(([a, b], s) => {
    if (used.has(s)) return;
    used.add(s);

    const ahead = follow(b);
    const closed = ahead.at(-1) === a;
    const edges = closed ? [a, b, ...ahead.slice(0, -1)] : [...follow(a).reverse(), a, b, ...ahead];

    lines.push({ points: edges.map(crossing), closed });
  });

  return lines;
}
