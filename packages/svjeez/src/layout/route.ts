import type { Box, Point, Size } from "./box";

/** A run of edge between two ranks: it leaves the upper rank at `xa` and enters the lower one at `xb`. */
export interface Crossing {
  readonly id: number;
  readonly xa: number;
  readonly xb: number;
}

const SAME = 0.5;
const CLEAR = 6;

const overlaps = (c: Crossing, d: Crossing) =>
  Math.min(c.xa, c.xb) - CLEAR < Math.max(d.xa, d.xb) + CLEAR &&
  Math.min(d.xa, d.xb) - CLEAR < Math.max(c.xa, c.xb) + CLEAR;

/**
 * Whether `d` must run above `c` so neither crosses the other: of two jogs heading the same way, the one that starts
 * further along turns first; and a jog that leaves at the x where another enters runs above it, or their verticals
 * would overlap.
 */
const over = (c: Crossing, d: Crossing): boolean => {
  if (Math.abs(d.xa - c.xb) <= SAME) return true;

  if (Math.abs(c.xa - d.xb) <= SAME || !overlaps(c, d)) return false;
  const [cr, dr] = [c.xb > c.xa, d.xb > d.xa];

  return cr === dr && (cr ? d.xa > c.xa : d.xa < c.xa);
};

/**
 * Gives each bent crossing a horizontal track in the gap, numbered top to bottom: interval colouring in an order that
 * keeps fans from crossing. Crossings in `merging` share an entry with another edge; they take the lowest tracks so
 * they join it just above the arrowhead, and two meeting from opposite sides share a track.
 */
export const tracks = (
  crossings: readonly Crossing[],
  merging: ReadonlySet<number>,
): { readonly track: ReadonlyMap<number, number>; readonly count: number } => {
  const track = new Map<number, number>();
  const used: Crossing[][] = [];

  const colour = (list: readonly Crossing[], floor: number) => {
    const pending = [...list].sort((a, b) => Math.min(a.xa, a.xb) - Math.min(b.xa, b.xb));
    const above = (c: Crossing) => list.filter((d) => d !== c && over(c, d));

    while (pending.length > 0) {
      const ready = pending.findIndex((c) => above(c).every((d) => track.has(d.id)));
      const c = pending.splice(Math.max(0, ready), 1)[0]!;

      let k = Math.max(
        floor,
        ...above(c).flatMap((d) => (track.has(d.id) ? [track.get(d.id)! + 1] : [])),
      );

      const clash = (d: Crossing) =>
        overlaps(c, d) && !(Math.abs(c.xb - d.xb) <= SAME && (c.xa - c.xb) * (d.xa - d.xb) < 0);

      while (used[k]?.some(clash)) k++;
      (used[k] ??= []).push(c);
      track.set(c.id, k);
    }
  };

  const bent = crossings.filter((c) => Math.abs(c.xa - c.xb) > SAME);
  colour(
    bent.filter((c) => !merging.has(c.id)),
    0,
  );
  colour(
    bent.filter((c) => merging.has(c.id)),
    used.length,
  );

  return { track, count: used.length };
};

const hits = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Whether the segment `p`–`q` runs through the inside of `b`. */
const crosses = (p: Point, q: Point, b: Box): boolean =>
  Math.max(p.x, q.x) > b.x &&
  Math.min(p.x, q.x) < b.x + b.w &&
  Math.max(p.y, q.y) > b.y &&
  Math.min(p.y, q.y) < b.y + b.h;

/**
 * Centers each label on its own edge, on the longest straight run first, sliding along it (clear of `bend` at each
 * end) until the box clears every node, every label already placed and every other line. With no clear spot, the
 * spot with the fewest collisions wins.
 */
export const placeLabels = (
  edges: readonly { readonly points: readonly Point[]; readonly label?: Size }[],
  obstacles: readonly Box[],
  bend: number,
): (Box | undefined)[] => {
  const runs = edges.map((e) => e.points.slice(1).map((q, k) => [e.points[k]!, q] as const));
  const placed: Box[] = [];

  return edges.map((e, i) => {
    const label = e.label;

    if (!label) return undefined;
    const own = runs[i]!;

    const heading = (k: number) => {
      const [p, q] = own[k]!;

      return `${Math.sign(q.x - p.x)},${Math.sign(q.y - p.y)}`;
    };

    /** The middle of a jog, which a renderer turns into one S-curve, so nothing there stays straight. */
    const jog = (k: number) => k > 0 && k < own.length - 1 && heading(k - 1) === heading(k + 1);
    const straight = own.map((_, k) => k).filter((k) => !jog(k));

    const candidates = (straight.length > 0 ? straight : own.map((_, k) => k))
      .map((k) => {
        const [p, q] = own[k]!;

        return { p, q, k, vertical: p.x === q.x, length: Math.hypot(q.x - p.x, q.y - p.y) };
      })
      .sort((a, b) => b.length - a.length || Number(b.vertical) - Number(a.vertical))
      .flatMap(({ p, q, k, vertical, length }) => {
        const along = vertical ? label.h : label.w;
        const room = (length - along) / 2 - bend;

        const shifts =
          room < 0
            ? [0]
            : [
                0,
                ...Array.from({ length: Math.floor(room / 4) }, (_, n) => [
                  (n + 1) * 4,
                  -(n + 1) * 4,
                ]).flat(),
              ];

        const [cx, cy] = [(p.x + q.x) / 2, (p.y + q.y) / 2];

        return shifts.map((s) => ({
          k,
          short: room < 0,
          box: {
            x: (vertical ? cx : cx + s) - label.w / 2,
            y: (vertical ? cy + s : cy) - label.h / 2,
            ...label,
          },
        }));
      });

    const cost = ({ k, short, box }: (typeof candidates)[number]) =>
      (obstacles.filter((o) => hits(box, o)).length + placed.filter((o) => hits(box, o)).length) *
        8 +
      runs.reduce(
        (n, segments, j) =>
          n + segments.filter(([p, q], m) => !(j === i && m === k) && crosses(p, q, box)).length,
        0,
      ) *
        2 +
      (short ? 1 : 0);

    let best = candidates[0]!;
    let least = Infinity;

    for (const c of candidates) {
      const n = cost(c);

      if (n < least) [best, least] = [c, n];

      if (n === 0) break;
    }

    placed.push(best.box);

    return best.box;
  });
};
