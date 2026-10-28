import type { Box, Point } from "./box";

/** A 2D vector field: the arrow `[u, v]` at `(x, y)`. */
export type VectorField = (x: number, y: number) => readonly [number, number];

export interface TraceOptions {
  readonly bounds: Box;
  /** Gap kept between neighbouring lines, in the field's units. */
  readonly spacing: number;
  /** Length of one integration step. */
  readonly step: number;
  /** Longest a line may run, in length units. */
  readonly maxLength: number;
  /** Lines shorter than this are dropped. */
  readonly minLength: number;
  /** Trace from exactly these points and do not fill the gaps. */
  readonly seeds?: readonly Point[];
}

interface Sample extends Point {
  readonly line: number;
  /** Steps from the seed: positive going with the field, negative going against it. */
  readonly index: number;
}

const STILL = 1e-9;

/** Douglas-Peucker: the fewest of `points` that keep every dropped point within `tolerance` of the line. */
export function simplify(points: readonly Point[], tolerance: number): Point[] {
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
}

/**
 * Streamlines of `field` that keep `spacing` between neighbours (Jobard and Lefer): trace one line both ways from a
 * seed by Runge-Kutta, then seed the next lines a spacing to either side of it. A line ends at the bounds, at a
 * stagnation point, near another line, or at `maxLength`. Each line runs with the field.
 */
export function traceStreamlines(field: VectorField, options: TraceOptions): Point[][] {
  const { bounds, spacing, step, maxLength, minLength } = options;
  const test = spacing / 2;
  const owned = Math.ceil((test * 3) / step);
  const cells = new Map<string, Sample[]>();
  const key = (x: number, y: number): string => `${Math.floor(x / test)},${Math.floor(y / test)}`;

  const inside = ({ x, y }: Point): boolean =>
    x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h;

  /** A sample of an earlier line, or a sample of this one that is not just behind the head, within `radius`. */
  const crowded = (p: Point, radius: number, mine: readonly Sample[], index = 0): boolean => {
    const [cx, cy] = [Math.floor(p.x / test), Math.floor(p.y / test)];
    const reach = Math.ceil(radius / test);

    for (let i = cx - reach; i <= cx + reach; i++)
      for (let j = cy - reach; j <= cy + reach; j++)
        for (const s of cells.get(`${i},${j}`) ?? [])
          if (Math.hypot(s.x - p.x, s.y - p.y) < radius) return true;

    return mine.some(
      (s) => Math.abs(s.index - index) > owned && Math.hypot(s.x - p.x, s.y - p.y) < radius,
    );
  };

  const direction = (p: Point, sign: number): readonly [number, number] | undefined => {
    const [u, v] = field(p.x, p.y);
    const m = Math.hypot(u, v);

    return m > STILL && Number.isFinite(m) ? [(sign * u) / m, (sign * v) / m] : undefined;
  };

  /** One Runge-Kutta step of the normalised field. */
  const advance = (p: Point, sign: number): Point | undefined => {
    const k1 = direction(p, sign);

    if (!k1) return;
    const k2 = direction({ x: p.x + (k1[0] * step) / 2, y: p.y + (k1[1] * step) / 2 }, sign);

    if (!k2) return;
    const k3 = direction({ x: p.x + (k2[0] * step) / 2, y: p.y + (k2[1] * step) / 2 }, sign);

    if (!k3) return;
    const k4 = direction({ x: p.x + k3[0] * step, y: p.y + k3[1] * step }, sign);

    if (!k4) return;

    return {
      x: p.x + ((k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) * step) / 6,
      y: p.y + ((k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) * step) / 6,
    };
  };

  const run = (
    seed: Point,
    sign: 1 | -1,
    line: number,
    mine: Sample[],
    budget: number,
  ): Sample[] => {
    const out: Sample[] = [];
    let head = seed;

    for (let n = 1; n * step <= budget; n++) {
      const next = advance(head, sign);

      if (!next || !inside(next)) break;

      const index = sign * n;

      if (crowded(next, test, mine, index)) break;
      const sample = { ...next, line, index };
      out.push(sample);
      mine.push(sample);
      head = next;
    }

    return out;
  };

  const lines: Point[][] = [];
  const queue: Point[] = [...(options.seeds ?? [])];
  const free = (p: Point): boolean => inside(p) && !crowded(p, spacing, []);

  const grow = (seed: Point): void => {
    const line = lines.length;
    const mine: Sample[] = [{ ...seed, line, index: 0 }];
    const ahead = run(seed, 1, line, mine, maxLength);
    const behind = run(seed, -1, line, mine, maxLength - ahead.length * step);
    const samples = [...behind.reverse(), mine[0]!, ...ahead];

    if ((samples.length - 1) * step < minLength) return;

    for (const s of samples) {
      const k = key(s.x, s.y);
      cells.set(k, [...(cells.get(k) ?? []), s]);
    }

    lines.push(samples.map(({ x, y }) => ({ x, y })));

    if (options.seeds) return;

    const every = Math.max(1, Math.round(spacing / step));

    samples.forEach((s, i) => {
      if (i % every !== 0) return;
      const a = samples[Math.max(0, i - 1)]!;
      const b = samples[Math.min(samples.length - 1, i + 1)]!;
      const length = Math.hypot(b.x - a.x, b.y - a.y);

      if (length === 0) return;
      const [nx, ny] = [-(b.y - a.y) / length, (b.x - a.x) / length];

      for (const side of [1, -1])
        queue.push({ x: s.x + nx * spacing * side, y: s.y + ny * spacing * side });
    });
  };

  if (options.seeds) {
    for (const seed of queue) if (inside(seed)) grow(seed);

    return lines;
  }

  queue.push({ x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 });

  // When the queue runs dry a scan over the bounds reaches any region no line has crossed.
  const columns = Math.ceil(bounds.w / spacing) + 1;
  const total = columns * (Math.ceil(bounds.h / spacing) + 1);
  let scanned = 0;

  for (;;) {
    let seed = queue.shift();

    while (!seed && scanned < total) {
      const p = {
        x: bounds.x + (scanned % columns) * spacing,
        y: bounds.y + Math.floor(scanned / columns) * spacing,
      };

      scanned++;

      if (free(p)) seed = p;
    }

    if (!seed) return lines;

    if (free(seed)) grow(seed);
  }
}
